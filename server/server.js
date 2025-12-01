
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'families.db');
// We use the same API Key for simplicity
const GOOGLE_API_KEY = process.env.API_KEY || process.env.VITE_API_KEY;

if (!fs.existsSync(DATA_DIR)){
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- Database Setup ---
console.log(`Initializing database at ${DB_PATH}`);
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    last_updated INTEGER
  )
`);

// --- Express Setup ---
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- WebSocket Logic ---
const clients = new Map();

wss.on('connection', (ws) => {
  let currentFamilyId = null;

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'JOIN') {
        currentFamilyId = parsed.familyId;
        if (!clients.has(currentFamilyId)) {
          clients.set(currentFamilyId, new Set());
        }
        clients.get(currentFamilyId).add(ws);
      }
    } catch (e) { console.error('WS Error', e); }
  });

  ws.on('close', () => {
    if (currentFamilyId && clients.has(currentFamilyId)) {
      clients.get(currentFamilyId).delete(ws);
      if (clients.get(currentFamilyId).size === 0) {
        clients.delete(currentFamilyId);
      }
    }
  });
});

const broadcastUpdate = (familyId) => {
  if (clients.has(familyId)) {
    const message = JSON.stringify({ type: 'UPDATE', familyId });
    for (const client of clients.get(familyId)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
};

// --- API Routes ---

app.get('/api/health', (req, res) => res.send('FamEats Sync Server Running'));

// --- GOOGLE PLACES PROXY ---
app.post('/api/places/search', async (req, res) => {
    if (!GOOGLE_API_KEY) {
        console.error("CRITICAL: API Key missing in server environment");
        return res.status(500).json({ error: "Server configuration error: API Key missing" });
    }

    const { query, latitude, longitude, type, minRating, limit } = req.body;

    try {
        const requestBody = {
            textQuery: query,
            maxResultCount: limit || 5,
        };

        // Add location bias if coordinates exist
        if (latitude && longitude) {
            requestBody.locationBias = {
                circle: {
                    center: { latitude, longitude },
                    radius: 5000.0 // 5km radius bias
                }
            };
        }
        
        if (minRating) {
            requestBody.minRating = minRating;
        }

        console.log(`[Proxy] Searching Places: ${query}`);

        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                // Request specific fields to save data/latency
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryType,places.types'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Proxy] Google API Error (${response.status}):`, errText);
            return res.status(response.status).json({ error: "Maps API Error", details: errText });
        }

        const data = await response.json();
        console.log(`[Proxy] Success. Found ${data.places ? data.places.length : 0} results.`);
        res.json(data.places || []);

    } catch (error) {
        console.error("[Proxy] Internal Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/family/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT data, last_updated FROM families WHERE id = ?');
    const result = stmt.get(req.params.id);
    
    if (result) {
      res.json({ data: result.data, lastUpdated: result.last_updated });
    } else {
      res.status(404).json({ error: 'Family not found' });
    }
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post('/api/family', (req, res) => {
  try {
    const { familyId, data } = req.body;
    if (!familyId || !data) return res.status(400).json({ error: 'Missing familyId or data' });

    const stmt = db.prepare(`
      INSERT INTO families (id, data, last_updated) 
      VALUES (?, ?, ?) 
      ON CONFLICT(id) DO UPDATE SET 
      data = excluded.data, 
      last_updated = excluded.last_updated
    `);

    const info = stmt.run(familyId, data, Date.now());
    broadcastUpdate(familyId);
    res.json({ success: true, updated: info.changes });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get('*', (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(index)) {
        res.sendFile(index);
    } else {
        res.send('FamEats API Running. Frontend build not found in /public.');
    }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  if (!GOOGLE_API_KEY) {
      console.warn("WARNING: API_KEY is missing. Maps Proxy will fail.");
  } else {
      const masked = GOOGLE_API_KEY.substring(0, 4) + '...';
      console.log(`API Key configured: ${masked}`);
  }
});
