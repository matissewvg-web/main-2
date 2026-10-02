const fs = require('fs');
const path = require('path');

// All file paths from clients are relative, forward-slash paths inside the
// files root ("Klanten/Jansen/offerte.pdf"). resolveSafe rejects anything that
// would escape the root.
function makeResolver(root) {
  return function resolveSafe(rel = '') {
    const clean = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
    const full = path.resolve(root, clean);
    if (full !== root && !full.startsWith(root + path.sep)) {
      const err = new Error('Ongeldig pad.');
      err.status = 400;
      throw err;
    }
    return full;
  };
}

function toRel(root, full) {
  return path.relative(root, full).split(path.sep).join('/');
}

const BAD_NAME = /[<>:"/\\|?*\x00-\x1f]/;
function checkName(name) {
  const n = String(name || '').trim();
  if (!n || n === '.' || n === '..' || BAD_NAME.test(n)) {
    const err = new Error('Ongeldige naam. Deze tekens mogen niet: < > : " / \\ | ? *');
    err.status = 400;
    throw err;
  }
  return n;
}

// "offerte.pdf" -> "offerte (2).pdf" when the name is taken.
function uniqueName(dir, name) {
  if (!fs.existsSync(path.join(dir, name))) return name;
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 2; ; i++) {
    const candidate = `${stem} (${i})${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
}

function describe(dir, name) {
  const full = path.join(dir, name);
  let st;
  try { st = fs.statSync(full); } catch { return null; }
  if (st.isDirectory()) {
    let count = 0;
    try { count = fs.readdirSync(full).filter((n) => !n.startsWith('.')).length; } catch {}
    return { name, type: 'folder', count, mtime: st.mtimeMs };
  }
  return { name, type: 'file', size: st.size, mtime: st.mtimeMs, ext: path.extname(name).slice(1).toLowerCase() };
}

function filesRoutes(app, { filesRoot, trashRoot, broadcast }) {
  fs.mkdirSync(filesRoot, { recursive: true });
  fs.mkdirSync(trashRoot, { recursive: true });
  const resolveSafe = makeResolver(filesRoot);

  const wrap = (fn) => (req, res) => {
    try {
      fn(req, res);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.status ? e.message : `Bestandsfout: ${e.message}` });
    }
  };

  app.get('/api/files/list', wrap((req, res) => {
    const dir = resolveSafe(req.query.path);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return res.status(404).json({ error: 'Map niet gevonden.' });
    const items = fs.readdirSync(dir)
      .filter((n) => !n.startsWith('.') && !n.startsWith('~$'))
      .map((n) => describe(dir, n))
      .filter(Boolean)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'nl', { numeric: true }) : a.type === 'folder' ? -1 : 1));
    res.json({ path: toRel(filesRoot, dir), items });
  }));

  app.post('/api/files/folder', wrap((req, res) => {
    const parent = resolveSafe(req.body.path);
    const name = checkName(req.body.name);
    const target = path.join(parent, name);
    if (fs.existsSync(target)) return res.status(400).json({ error: 'Er bestaat al een map of bestand met deze naam.' });
    fs.mkdirSync(target, { recursive: true });
    broadcast('files');
    res.json({ path: toRel(filesRoot, target) });
  }));

  // Streams the request body straight to disk so large files do not sit in memory.
  // overwrite=1 is used when a colleague saves a file they opened from the hub.
  app.put('/api/files/upload', (req, res) => {
    let dir, name;
    try {
      dir = resolveSafe(req.query.path);
      name = checkName(req.query.name);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
    fs.mkdirSync(dir, { recursive: true });
    const finalName = req.query.overwrite === '1' ? name : uniqueName(dir, name);
    const target = path.join(dir, finalName);
    const tmp = path.join(dir, `.upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const out = fs.createWriteStream(tmp);
    req.pipe(out);
    out.on('finish', () => {
      try {
        fs.renameSync(tmp, target);
        broadcast('files');
        res.json({ path: toRel(filesRoot, target), name: finalName });
      } catch (e) {
        fs.rmSync(tmp, { force: true });
        res.status(500).json({ error: `Opslaan mislukt: ${e.message}` });
      }
    });
    const fail = (e) => {
      fs.rmSync(tmp, { force: true });
      if (!res.headersSent) res.status(500).json({ error: `Upload mislukt: ${e.message}` });
    };
    out.on('error', fail);
    req.on('aborted', () => { out.destroy(); fs.rmSync(tmp, { force: true }); });
  });

  app.get('/api/files/download', wrap((req, res) => {
    const file = resolveSafe(req.query.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).json({ error: 'Bestand niet gevonden.' });
    if (req.query.inline === '1') res.sendFile(file);
    else res.download(file, path.basename(file));
  }));

  app.get('/api/files/stat', wrap((req, res) => {
    const file = resolveSafe(req.query.path);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Niet gevonden.' });
    const st = fs.statSync(file);
    res.json({ size: st.size, mtime: st.mtimeMs, type: st.isDirectory() ? 'folder' : 'file' });
  }));

  app.post('/api/files/rename', wrap((req, res) => {
    const from = resolveSafe(req.body.path);
    if (from === filesRoot) return res.status(400).json({ error: 'De hoofdmap kan niet hernoemd worden.' });
    const name = checkName(req.body.name);
    const to = path.join(path.dirname(from), name);
    if (from === to) return res.json({ path: toRel(filesRoot, to) });
    if (fs.existsSync(to) && from.toLowerCase() !== to.toLowerCase()) {
      return res.status(400).json({ error: 'Er bestaat al een map of bestand met deze naam.' });
    }
    fs.renameSync(from, to);
    broadcast('files');
    res.json({ path: toRel(filesRoot, to) });
  }));

  app.post('/api/files/move', wrap((req, res) => {
    const from = resolveSafe(req.body.path);
    const destDir = resolveSafe(req.body.to);
    if (from === filesRoot) return res.status(400).json({ error: 'De hoofdmap kan niet verplaatst worden.' });
    if (destDir === from || destDir.startsWith(from + path.sep)) {
      return res.status(400).json({ error: 'Een map kan niet in zichzelf verplaatst worden.' });
    }
    if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) return res.status(404).json({ error: 'Doelmap niet gevonden.' });
    if (path.dirname(from) === destDir) return res.json({ path: toRel(filesRoot, from) });
    const name = uniqueName(destDir, path.basename(from));
    fs.renameSync(from, path.join(destDir, name));
    broadcast('files');
    res.json({ path: toRel(filesRoot, path.join(destDir, name)) });
  }));

  // Deleting never destroys data: items go to the trash folder on the host.
  app.delete('/api/files', wrap((req, res) => {
    const target = resolveSafe(req.query.path);
    if (target === filesRoot) return res.status(400).json({ error: 'De hoofdmap kan niet verwijderd worden.' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Niet gevonden.' });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    fs.renameSync(target, path.join(trashRoot, uniqueName(trashRoot, `${stamp} ${path.basename(target)}`)));
    broadcast('files');
    res.json({ ok: true });
  }));

  app.get('/api/files/search', wrap((req, res) => {
    res.json(searchFiles(filesRoot, req.query.q, 200));
  }));

  app.get('/api/files/folders', wrap((req, res) => {
    // Flat list of all folders, used by the "link to folder" picker.
    const out = [''];
    const walk = (dir, depth) => {
      if (depth > 8 || out.length > 2000) return;
      for (const n of fs.readdirSync(dir)) {
        if (n.startsWith('.')) continue;
        const full = path.join(dir, n);
        try {
          if (fs.statSync(full).isDirectory()) {
            out.push(toRel(filesRoot, full));
            walk(full, depth + 1);
          }
        } catch {}
      }
    };
    walk(filesRoot, 0);
    res.json(out);
  }));
}

function searchFiles(root, query, limit) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const results = [];
  const walk = (dir, depth) => {
    if (depth > 12 || results.length >= limit) return;
    let names;
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      if (n.startsWith('.') || n.startsWith('~$')) continue;
      const full = path.join(dir, n);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (n.toLowerCase().includes(q)) {
        results.push({
          name: n,
          path: toRel(root, full),
          parent: toRel(root, dir),
          type: st.isDirectory() ? 'folder' : 'file',
          ext: st.isDirectory() ? '' : path.extname(n).slice(1).toLowerCase(),
          size: st.size,
        });
        if (results.length >= limit) return;
      }
      if (st.isDirectory()) walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return results;
}

module.exports = { filesRoutes, searchFiles };
