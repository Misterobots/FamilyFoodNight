
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
// Dockerfile will copy the built 'dist' folder to 'public' inside the container
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

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    const index = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(index)) {
        res.sendFile(index);
    } else {
        // If frontend build is missing, return simple message
        res.send('FamEats API Running. Frontend build not found in /public.');
    }
});

// --- Start Server ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
