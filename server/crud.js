const { requireAdmin, hashPassword, publicUser } = require('./auth');

const PRIORITIES = ['urgent', 'hoog', 'normaal', 'laag'];

// Fields a client may write per entity. JSON fields are stored as text and
// parsed again on the way out.
const ENTITIES = {
  contacts: {
    fields: ['kind', 'name', 'company', 'job_title', 'email', 'phone', 'address', 'website', 'notes', 'tags'],
    json: ['tags'],
    required: ['name'],
    order: 'name COLLATE NOCASE',
    label: (r) => r.name,
  },
  projects: {
    fields: ['name', 'description', 'status', 'priority', 'owner_id', 'contact_id', 'start_date', 'deadline', 'folder', 'tags'],
    json: ['tags'],
    required: ['name'],
    order: 'deadline IS NULL, deadline, name COLLATE NOCASE',
    label: (r) => r.name,
  },
  tasks: {
    fields: ['title', 'description', 'status', 'priority', 'assignee_id', 'project_id', 'contact_id', 'meeting_id', 'deadline', 'tags', 'sort'],
    json: ['tags'],
    required: ['title'],
    order: 'sort, id',
    label: (r) => r.title,
  },
  meetings: {
    fields: ['title', 'date', 'location', 'content', 'attendee_users', 'attendee_contacts', 'project_id', 'tags'],
    json: ['tags', 'attendee_users', 'attendee_contacts'],
    required: ['title'],
    order: 'date DESC, id DESC',
    label: (r) => r.title,
  },
  tags: {
    fields: ['name', 'color'],
    json: [],
    required: ['name'],
    order: 'name COLLATE NOCASE',
    label: (r) => r.name,
  },
};

const ACTIVITY_NAMES = { contacts: 'contact', projects: 'project', tasks: 'taak', meetings: 'vergadering', tags: 'tag' };

function decode(cfg, row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of cfg.json) {
    try { out[f] = JSON.parse(out[f] || '[]'); } catch { out[f] = []; }
  }
  return out;
}

function pick(cfg, body) {
  const data = {};
  for (const f of cfg.fields) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (cfg.json.includes(f)) v = JSON.stringify(Array.isArray(v) ? v : []);
    else if (v === '') v = null;
    if (f === 'priority' && v != null && !PRIORITIES.includes(v)) v = 'normaal';
    data[f] = v;
  }
  return data;
}

function crudRoutes(app, db, broadcast) {
  const log = (user, action, entity, id, label) => {
    db.prepare('INSERT INTO activity (user_id, action, entity, entity_id, label) VALUES (?,?,?,?,?)')
      .run(user.id, action, ACTIVITY_NAMES[entity] || entity, id, label);
    db.prepare("DELETE FROM activity WHERE id <= (SELECT id FROM activity ORDER BY id DESC LIMIT 1 OFFSET 500)").run();
  };

  for (const [entity, cfg] of Object.entries(ENTITIES)) {
    const base = `/api/${entity}`;

    app.get(base, (req, res) => {
      const rows = db.prepare(`SELECT * FROM ${entity} ORDER BY ${cfg.order}`).all();
      res.json(rows.map((r) => decode(cfg, r)));
    });

    app.get(`${base}/:id`, (req, res) => {
      const row = db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Niet gevonden.' });
      res.json(decode(cfg, row));
    });

    app.post(base, (req, res) => {
      if (entity === 'tags' && req.user.role !== 'admin') return res.status(403).json({ error: 'Alleen beheerders kunnen tags aanmaken.' });
      const data = pick(cfg, req.body || {});
      for (const r of cfg.required) {
        if (!data[r] || !String(data[r]).trim()) return res.status(400).json({ error: `Veld "${r}" is verplicht.` });
      }
      if (entity === 'tasks' && data.sort === undefined) {
        data.sort = (db.prepare('SELECT MAX(sort) m FROM tasks').get().m || 0) + 1;
      }
      if (entity === 'tasks' && data.status === 'klaar') data.done_at = new Date().toISOString();
      if (entity !== 'tags') data.created_by = req.user.id;
      const cols = Object.keys(data);
      try {
        const info = db.prepare(
          `INSERT INTO ${entity} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
        ).run(...cols.map((c) => data[c]));
        const row = decode(cfg, db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(info.lastInsertRowid));
        log(req.user, 'aangemaakt', entity, row.id, cfg.label(row));
        broadcast(entity);
        res.json(row);
      } catch (e) {
        res.status(400).json({ error: friendlyError(e) });
      }
    });

    app.patch(`${base}/:id`, (req, res) => {
      if (entity === 'tags' && req.user.role !== 'admin') return res.status(403).json({ error: 'Alleen beheerders kunnen tags wijzigen.' });
      const existing = db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Niet gevonden.' });
      const data = pick(cfg, req.body || {});
      for (const r of cfg.required) {
        if (r in data && (!data[r] || !String(data[r]).trim())) return res.status(400).json({ error: `Veld "${r}" is verplicht.` });
      }
      if (entity === 'tasks' && data.status && data.status !== existing.status) {
        data.done_at = data.status === 'klaar' ? new Date().toISOString() : null;
      }
      if (entity !== 'tags') data.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const cols = Object.keys(data);
      if (cols.length) {
        try {
          db.prepare(`UPDATE ${entity} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
            .run(...cols.map((c) => data[c]), req.params.id);
        } catch (e) {
          return res.status(400).json({ error: friendlyError(e) });
        }
      }
      const row = decode(cfg, db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(req.params.id));
      // Small edits such as dragging a card are not worth an activity line.
      const quiet = cols.every((c) => c === 'sort' || c === 'updated_at');
      if (!quiet) {
        const action = entity === 'tasks' && data.status === 'klaar' && existing.status !== 'klaar' ? 'afgerond' : 'bewerkt';
        log(req.user, action, entity, row.id, cfg.label(row));
      }
      broadcast(entity);
      res.json(row);
    });

    app.delete(`${base}/:id`, (req, res) => {
      if (entity === 'tags' && req.user.role !== 'admin') return res.status(403).json({ error: 'Alleen beheerders kunnen tags verwijderen.' });
      const existing = db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Niet gevonden.' });
      db.prepare(`DELETE FROM ${entity} WHERE id = ?`).run(req.params.id);
      log(req.user, 'verwijderd', entity, existing.id, cfg.label(existing));
      broadcast(entity);
      res.json({ ok: true });
    });
  }

  // Users: everyone can read the list (for assigning), only admins manage it.
  app.get('/api/users', (req, res) => {
    res.json(db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE').all().map(publicUser));
  });

  app.post('/api/users', requireAdmin, (req, res) => {
    const { name, username, password, role, color } = req.body || {};
    if (!name || !username || !password || password.length < 4) {
      return res.status(400).json({ error: 'Vul naam, gebruikersnaam en een wachtwoord (min. 4 tekens) in.' });
    }
    try {
      const info = db.prepare('INSERT INTO users (name, username, pass_hash, role, color) VALUES (?,?,?,?,?)')
        .run(name, username, hashPassword(password), role === 'admin' ? 'admin' : 'member', color || '#6366f1');
      broadcast('users');
      res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)));
    } catch (e) {
      res.status(400).json({ error: friendlyError(e) });
    }
  });

  app.patch('/api/users/:id', requireAdmin, (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Niet gevonden.' });
    const { name, role, color, active, password } = req.body || {};
    const admins = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND active = 1").get().n;
    const losesAdmin = target.role === 'admin' && target.active && (role === 'member' || active === 0 || active === false);
    if (losesAdmin && admins <= 1) return res.status(400).json({ error: 'Er moet minimaal één actieve beheerder blijven.' });
    const data = {};
    if (name) data.name = name;
    if (role) data.role = role === 'admin' ? 'admin' : 'member';
    if (color) data.color = color;
    if (active !== undefined) data.active = active ? 1 : 0;
    if (password) {
      if (password.length < 4) return res.status(400).json({ error: 'Wachtwoord moet minimaal 4 tekens zijn.' });
      data.pass_hash = hashPassword(password);
    }
    const cols = Object.keys(data);
    if (cols.length) {
      db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => data[c]), target.id);
    }
    if (data.active === 0 || data.pass_hash) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    broadcast('users');
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)));
  });

  app.get('/api/activity', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 30, 200);
    res.json(db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?').all(limit));
  });
}

function friendlyError(e) {
  const msg = String(e.message || e);
  if (msg.includes('UNIQUE')) return 'Deze naam bestaat al.';
  if (msg.includes('FOREIGN KEY')) return 'Gekoppeld item bestaat niet (meer).';
  return msg;
}

module.exports = { crudRoutes, ENTITIES };
