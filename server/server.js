
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
  );
  
  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    familyId TEXT NOT NULL,
    familyKey TEXT NOT NULL,
    created_at INTEGER
  );
`);

// --- Express Setup ---
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

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

app.get('/api/health', (req, res) => res.send('Family Food Night Sync Server Running'));

// Create or Get Invite Code
app.post('/api/invite', (req, res) => {
    const { familyId, familyKey } = req.body;
    if (!familyId || !familyKey) return res.status(400).json({ error: 'Missing credentials' });

    // Check if an invite already exists for this family
    const existing = db.prepare('SELECT code FROM invites WHERE familyId = ?').get(familyId);
    if (existing) return res.json({ code: existing.code });

    // Generate 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        db.prepare('INSERT INTO invites (code, familyId, familyKey, created_at) VALUES (?, ?, ?, ?)').run(code, familyId, familyKey, Date.now());
        res.json({ code });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create invite' });
    }
});

// Resolve Invite Code
app.get('/api/invite/:code', (req, res) => {
    const invite = db.prepare('SELECT familyId, familyKey FROM invites WHERE code = ?').get(req.params.code);
    if (invite) {
        res.json(invite);
    } else {
        res.status(404).json({ error: 'Invite code expired or invalid' });
    }
});

app.post('/api/places/search', async (req, res) => {
    if (!GOOGLE_API_KEY) return res.status(500).json({ error: "Server configuration error" });
    const { query, latitude, longitude, limit, minRating } = req.body;
    
    try {
        const requestBody = { textQuery: query, maxResultCount: limit || 5 };
        
        // Use a slightly larger radius (15km) to be more forgiving for desktop Wi-Fi geolocation
        if (latitude && longitude) {
            console.log(`Searching with location bias: ${latitude}, ${longitude}`);
            requestBody.locationBias = { circle: { center: { latitude, longitude }, radius: 15000.0 } };
        } else {
            console.log(`Searching without client location. Falling back to IP-based location (likely Server/Netherlands).`);
        }

        if (minRating) requestBody.minRating = minRating;

        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryType'
            },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        res.json(data.places || []);
    } catch (error) {
        console.error("Maps Proxy Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/family/:id', (req, res) => {
  const result = db.prepare('SELECT data, last_updated FROM families WHERE id = ?').get(req.params.id);
  if (result) res.json({ data: result.data, lastUpdated: result.last_updated });
  else res.status(404).json({ error: 'Family not found' });
});

app.post('/api/family', (req, res) => {
  const { familyId, data } = req.body;
  if (!familyId || !data) return res.status(400).json({ error: 'Missing data' });
  db.prepare('INSERT INTO families (id, data, last_updated) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, last_updated = excluded.last_updated').run(familyId, data, Date.now());
  broadcastUpdate(familyId);
  res.json({ success: true });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
