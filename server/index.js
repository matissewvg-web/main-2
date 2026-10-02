const express = require('express');
const fs = require('fs');
const path = require('path');
const { openDb } = require('./db');
const { authRoutes, requireAdmin } = require('./auth');
const { crudRoutes } = require('./crud');
const { filesRoutes, searchFiles } = require('./files');
const { createBackups } = require('./backup');

const DEFAULT_PORT = 4750;

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Starts the The Break 5 host server.
 * dataDir holds the database, the shared files ("Bestanden"), the trash and backups.
 * staticDir (optional) is the built interface, so colleagues can also use a browser.
 */
function startServer({ dataDir, port = DEFAULT_PORT, staticDir } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filesRoot = path.join(dataDir, 'Bestanden');
  const trashRoot = path.join(dataDir, 'Prullenbak');
  const db = openDb(path.join(dataDir, 'thebreak5.db'));

  // Live updates: every client keeps one event stream open and refetches
  // whatever collection the host says changed.
  const clients = new Set();
  const broadcast = (topic) => {
    const msg = `data: ${JSON.stringify({ topic })}\n\n`;
    for (const res of clients) res.write(msg);
  };

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    // The desktop app loads its interface from disk, so the API must allow other origins.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api', (req, res, next) => (req.path === '/files/upload' ? next() : express.json({ limit: '20mb' })(req, res, next)));

  app.get('/api/ping', (req, res) => res.json({ app: 'The Break 5', version: require('../package.json').version }));

  authRoutes(app, db);

  app.get('/api/events', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': ok\n\n');
    clients.add(res);
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(keepAlive); clients.delete(res); });
  });

  crudRoutes(app, db, broadcast);
  filesRoutes(app, { filesRoot, trashRoot, broadcast });

  app.get('/api/search', (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const like = `%${q}%`;
    const out = [];
    for (const r of db.prepare('SELECT id, name, company, email FROM contacts WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ? LIMIT 20').all(like, like, like, like)) {
      out.push({ kind: 'contact', id: r.id, title: r.name, sub: [r.company, r.email].filter(Boolean).join(' · ') });
    }
    for (const r of db.prepare('SELECT id, name, status FROM projects WHERE name LIKE ? OR description LIKE ? LIMIT 20').all(like, like)) {
      out.push({ kind: 'project', id: r.id, title: r.name, status: r.status });
    }
    for (const r of db.prepare('SELECT id, title, status, deadline FROM tasks WHERE title LIKE ? OR description LIKE ? LIMIT 30').all(like, like)) {
      out.push({ kind: 'task', id: r.id, title: r.title, status: r.status, deadline: r.deadline });
    }
    for (const r of db.prepare('SELECT id, title, date, content FROM meetings WHERE title LIKE ? OR content LIKE ? LIMIT 20').all(like, like)) {
      const text = stripHtml(r.content);
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      const snippet = i >= 0 ? '…' + text.slice(Math.max(0, i - 30), i + 50) + '…' : '';
      out.push({ kind: 'meeting', id: r.id, title: r.title, date: r.date, snippet });
    }
    for (const f of searchFiles(filesRoot, q, 30)) {
      out.push({ kind: f.type, path: f.path, parent: f.parent, title: f.name, sub: '/' + f.parent, ext: f.ext });
    }
    res.json(out);
  });

  const backups = createBackups({ db, dataDir, filesRoot });
  app.get('/api/backup', (req, res) => res.json(backups.status()));
  app.post('/api/backup/run', requireAdmin, async (req, res) => res.json(await backups.run()));
  app.post('/api/backup/dir', requireAdmin, (req, res) => {
    const dir = String(req.body.dir || '').trim();
    if (!dir || !path.isAbsolute(dir)) return res.status(400).json({ error: 'Geef een volledig pad op, bijv. E:\\Backups' });
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (e) {
      return res.status(400).json({ error: `Map niet bruikbaar: ${e.message}` });
    }
    backups.setDir(dir);
    res.json(backups.status());
  });

  app.get('/api/host-info', (req, res) => res.json({ dataDir, filesRoot, trashRoot }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Onbekende API-route.' }));

  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => {
      resolve({
        port,
        dataDir,
        filesRoot,
        close: () => {
          backups.stop();
          for (const c of clients) c.end();
          server.close();
          server.closeAllConnections();
          db.close();
        },
      });
    });
    server.on('error', reject);
  });
}

module.exports = { startServer, DEFAULT_PORT };
