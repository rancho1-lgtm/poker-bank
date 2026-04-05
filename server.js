const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DATA_FILE = path.join(DATA_DIR, 'tournaments.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Tournaments ─────────────────────────────────────────
app.get('/api/tournaments', (req, res) => {
  res.json(readData());
});

app.post('/api/tournaments', (req, res) => {
  const data = readData();
  const entry = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  data.push(entry);
  writeData(data);
  res.json(entry);
});

app.put('/api/tournaments/:id', (req, res) => {
  const data = readData();
  const idx = data.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeData(data);
  res.json(data[idx]);
});

app.delete('/api/tournaments/:id', (req, res) => {
  const data = readData();
  const filtered = data.filter(t => t.id !== req.params.id);
  if (filtered.length === data.length) return res.status(404).json({ error: 'Not found' });
  writeData(filtered);
  res.json({ ok: true });
});

// ── Locations (derived from tournaments) ────────────────
app.get('/api/locations', (req, res) => {
  const data = readData();
  const locs = [...new Set(data.map(t => t.location).filter(Boolean))].sort();
  res.json(locs);
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n========================================');
  console.log('  בנק פוקר של רן ולימלימ - מופעל!');
  console.log('========================================');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`  כתובת ענן: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  } else {
    console.log(`  גישה מקומית:  http://localhost:${PORT}`);
    console.log(`  גישה ברשת:    http://${ip}:${PORT}`);
  }
  console.log('========================================\n');
});
