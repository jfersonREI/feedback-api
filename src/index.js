const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'feedback.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    page TEXT NOT NULL,
    url TEXT,
    helpful INTEGER NOT NULL,
    comment TEXT DEFAULT ''
  )
`);

const API_KEY = process.env.API_KEY || 'change-me';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use('/feedback', limiter);

app.post('/feedback', auth, (req, res) => {
  const { page, url, helpful, comment = '' } = req.body;
  if (typeof helpful !== 'number' || !page) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const stmt = db.prepare(
    'INSERT INTO feedback (page, url, helpful, comment) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(String(page).slice(0, 500), String(url || '').slice(0, 1000), helpful ? 1 : 0, String(comment).slice(0, 2000));
  res.json({ id: result.lastInsertRowid });
});

app.patch('/feedback/:id', auth, (req, res) => {
  const { comment = '' } = req.body;
  const stmt = db.prepare('UPDATE feedback SET comment = ? WHERE id = ?');
  const result = stmt.run(String(comment).slice(0, 2000), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

function exportCsv(period) {
  const rows = db.prepare('SELECT created_at, page, helpful, comment, url FROM feedback ORDER BY created_at').all();
  if (!rows.length) return;

  const header = 'created_at,page,helpful,comment,url\n';
  const body = rows.map(r =>
    [r.created_at, r.page, r.helpful, `"${(r.comment || '').replace(/"/g, '""')}"`, r.url]
      .join(',')
  ).join('\n');

  const filename = `feedback-${period}.csv`;
  fs.writeFileSync(path.join(DATA_DIR, filename), header + body);
  console.log(`Exported ${filename}`);
}

// Biweekly (every other Monday at 2am)
cron.schedule('0 2 * * 1', () => {
  const week = Math.ceil(new Date().getDate() / 7);
  if (week % 2 === 1) exportCsv(`biweekly-${new Date().toISOString().slice(0, 10)}`);
});

// Monthly
cron.schedule('0 2 1 * *', () => exportCsv(new Date().toISOString().slice(0, 7)));

// Quarterly
cron.schedule('0 2 1 1,4,7,10 *', () => {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  exportCsv(`${d.getFullYear()}-Q${q}`);
});

// Yearly
cron.schedule('0 2 1 1 *', () => exportCsv(String(new Date().getFullYear())));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Feedback API running on :${PORT}`));