const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway mounts a persistent volume at /data — fallback to local ./data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'poker.db'));

// ── Schema ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    location    TEXT NOT NULL,
    entryFee    REAL NOT NULL DEFAULT 0,
    bullets     INTEGER NOT NULL DEFAULT 1,
    otherExpenses REAL NOT NULL DEFAULT 0,
    totalExpenses REAL NOT NULL DEFAULT 0,
    cashed      INTEGER NOT NULL DEFAULT 0,
    winnings    REAL NOT NULL DEFAULT 0,
    createdAt   TEXT NOT NULL
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Tournaments ─────────────────────────────────────────
app.get('/api/tournaments', (req, res) => {
  const rows = db.prepare('SELECT * FROM tournaments ORDER BY date DESC').all();
  res.json(rows.map(toJson));
});

app.post('/api/tournaments', (req, res) => {
  const t = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO tournaments (id, date, location, entryFee, bullets, otherExpenses, totalExpenses, cashed, winnings, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, t.date, t.location, t.entryFee, t.bullets, t.otherExpenses, t.totalExpenses, t.cashed ? 1 : 0, t.winnings || 0, new Date().toISOString());

  const row = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
  res.json(toJson(row));
});

app.put('/api/tournaments/:id', (req, res) => {
  const t = req.body;
  const result = db.prepare(`
    UPDATE tournaments SET date=?, location=?, entryFee=?, bullets=?, otherExpenses=?, totalExpenses=?, cashed=?, winnings=?
    WHERE id=?
  `).run(t.date, t.location, t.entryFee, t.bullets, t.otherExpenses, t.totalExpenses, t.cashed ? 1 : 0, t.winnings || 0, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  const row = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  res.json(toJson(row));
});

app.delete('/api/tournaments/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── Locations (derived from tournaments) ────────────────
app.get('/api/locations', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT location FROM tournaments ORDER BY location').all();
  res.json(rows.map(r => r.location));
});

// ── Helpers ─────────────────────────────────────────────
function toJson(row) {
  return { ...row, cashed: row.cashed === 1 };
}

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
