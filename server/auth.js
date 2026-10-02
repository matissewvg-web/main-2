const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

function publicUser(u) {
  if (!u) return null;
  const { pass_hash, ...rest } = u;
  return rest;
}

function isLoopback(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function authRoutes(app, db) {
  const userCount = () => db.prepare('SELECT COUNT(*) n FROM users').get().n;

  app.get('/api/setup/status', (req, res) => {
    res.json({ needsSetup: userCount() === 0, isLocal: isLoopback(req) });
  });

  // The first admin can only be created from the host PC itself, so a colleague
  // on the network cannot claim the admin account of a freshly installed host.
  app.post('/api/setup', (req, res) => {
    if (userCount() > 0) return res.status(400).json({ error: 'Er bestaat al een beheerder.' });
    if (!isLoopback(req)) return res.status(403).json({ error: 'De eerste beheerder moet op de host-pc zelf worden aangemaakt.' });
    const { name, username, password } = req.body || {};
    if (!name || !username || !password || password.length < 4) {
      return res.status(400).json({ error: 'Vul naam, gebruikersnaam en een wachtwoord (min. 4 tekens) in.' });
    }
    const info = db.prepare('INSERT INTO users (name, username, pass_hash, role, color) VALUES (?,?,?,?,?)')
      .run(name, username, hashPassword(password), 'admin', '#6366f1');
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, info.lastInsertRowid);
    res.json({ token, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid)) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username || ''));
    if (!user || !verifyPassword(String(password || ''), user.pass_hash)) {
      return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?,?)').run(token, user.id);
    res.json({ token, user: publicUser(user) });
  });

  // Everything below /api requires a valid session.
  app.use('/api', (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ error: 'Niet ingelogd.' });
    const user = db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.active = 1'
    ).get(String(token));
    if (!user) return res.status(401).json({ error: 'Sessie verlopen, log opnieuw in.' });
    req.user = user;
    req.token = token;
    next();
  });

  app.get('/api/auth/me', (req, res) => res.json(publicUser(req.user)));

  app.post('/api/auth/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    res.json({ ok: true });
  });

  app.post('/api/auth/password', (req, res) => {
    const { current, next } = req.body || {};
    if (!verifyPassword(String(current || ''), req.user.pass_hash)) {
      return res.status(400).json({ error: 'Huidig wachtwoord klopt niet.' });
    }
    if (!next || next.length < 4) return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 4 tekens zijn.' });
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
    res.json({ ok: true });
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Alleen beheerders mogen dit.' });
  next();
}

module.exports = { authRoutes, requireAdmin, hashPassword, publicUser };
