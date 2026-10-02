// Personal notifications, comments and recurring tasks.

const PEOPLE_FIELD = { tasks: 'assignees', documents: 'assignees', projects: 'members', brainstorms: 'participants' };
const NOUN = { tasks: 'taak', documents: 'document', projects: 'project', brainstorms: 'brainstorm', meetings: 'vergadering', contacts: 'contact' };
const TITLE_FIELD = { tasks: 'title', documents: 'title', projects: 'name', brainstorms: 'title', meetings: 'title', contacts: 'name' };
const COMMENTABLE = ['tasks', 'projects', 'documents', 'meetings', 'brainstorms', 'contacts'];

function addInterval(dateStr, recurrence) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (recurrence === 'dagelijks') dt.setUTCDate(dt.getUTCDate() + 1);
  else if (recurrence === 'wekelijks') dt.setUTCDate(dt.getUTCDate() + 7);
  else if (recurrence === 'tweewekelijks') dt.setUTCDate(dt.getUTCDate() + 14);
  else if (recurrence === 'maandelijks') dt.setUTCMonth(dt.getUTCMonth() + 1);
  else if (recurrence === 'kwartaal') dt.setUTCMonth(dt.getUTCMonth() + 3);
  else if (recurrence === 'jaarlijks') dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  else return null;
  return dt.toISOString().slice(0, 10);
}

function notifyRoutes(app, db, broadcast) {
  const notify = (userIds, { kind, entity, entityId, title, actorId }) => {
    const ids = [...new Set(userIds)].filter((u) => u && u !== actorId);
    if (!ids.length) return;
    const stmt = db.prepare('INSERT INTO notifications (user_id, kind, entity, entity_id, title, actor_id) VALUES (?,?,?,?,?,?)');
    const trim = db.prepare('DELETE FROM notifications WHERE user_id = ? AND id NOT IN (SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 200)');
    for (const u of ids) {
      stmt.run(u, kind, entity, entityId, title, actorId);
      trim.run(u, u); // keep at most 200 per person
    }
    broadcast('notifications');
  };

  // People involved with a record (assignees/members + owner/creator).
  const peopleOf = (entity, row) => {
    const out = [...(row[PEOPLE_FIELD[entity]] || [])];
    if (row.owner_id) out.push(row.owner_id);
    if (entity === 'meetings') out.push(...(row.attendee_users || []));
    if (row.created_by) out.push(row.created_by);
    return out;
  };

  const afterWrite = (entity, before, after, user) => {
    // "X heeft je toegevoegd aan …"
    const field = PEOPLE_FIELD[entity];
    if (field) {
      const prev = new Set(before ? before[field] || [] : []);
      const added = (after[field] || []).filter((u) => !prev.has(u));
      if (added.length) {
        notify(added, { kind: 'toegewezen', entity, entityId: after.id, title: `${user.name} heeft je toegevoegd aan ${NOUN[entity]} "${after[TITLE_FIELD[entity]]}"`, actorId: user.id });
      }
    }
    // Recurring task completed -> create the next one.
    if (entity === 'tasks' && after.recurrence && after.status === 'klaar' && before && before.status !== 'klaar') {
      const base = after.deadline || new Date().toISOString().slice(0, 10);
      let next = addInterval(base, after.recurrence);
      const today = new Date().toISOString().slice(0, 10);
      while (next && next < today) next = addInterval(next, after.recurrence); // skip missed periods
      if (next) {
        const checklist = (after.checklist || []).map((c) => ({ ...c, done: false }));
        const sort = (db.prepare('SELECT MAX(sort) m FROM tasks').get().m || 0) + 1;
        db.prepare(`INSERT INTO tasks (title, description, status, priority, assignees, assignee_id, project_id, contact_id, deadline, tags, sort, checklist, recurrence, created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          after.title, after.description, 'todo', after.priority, JSON.stringify(after.assignees || []), (after.assignees || [])[0] ?? null,
          after.project_id, after.contact_id, next, JSON.stringify(after.tags || []), sort, JSON.stringify(checklist), after.recurrence, user.id,
        );
        // The finished one stops repeating, the new one carries it on.
        db.prepare('UPDATE tasks SET recurrence = NULL WHERE id = ?').run(after.id);
      }
    }
  };

  const afterDelete = (entity, id) => {
    db.prepare('DELETE FROM comments WHERE entity = ? AND entity_id = ?').run(entity, id);
    db.prepare('DELETE FROM notifications WHERE entity = ? AND entity_id = ?').run(entity, id);
  };

  // ---- notifications ----
  app.get('/api/notifications', (req, res) => {
    res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60').all(req.user.id));
  });
  app.post('/api/notifications/read', (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (ids) {
      const stmt = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?');
      for (const id of ids) stmt.run(id, req.user.id);
    } else {
      db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    }
    broadcast('notifications');
    res.json({ ok: true });
  });

  // ---- comments ----
  const loadRecord = (entity, id) => {
    if (!COMMENTABLE.includes(entity)) return null;
    const row = db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(id);
    if (!row) return null;
    for (const k of ['assignees', 'members', 'participants', 'attendee_users']) {
      if (typeof row[k] === 'string') { try { row[k] = JSON.parse(row[k]); } catch { row[k] = []; } }
    }
    return row;
  };

  app.get('/api/comments', (req, res) => {
    if (!COMMENTABLE.includes(req.query.entity)) return res.status(400).json({ error: 'Onbekend type.' });
    res.json(db.prepare('SELECT * FROM comments WHERE entity = ? AND entity_id = ? ORDER BY id').all(req.query.entity, req.query.entity_id));
  });

  app.get('/api/comments/counts', (req, res) => {
    const rows = db.prepare('SELECT entity, entity_id, COUNT(*) n FROM comments GROUP BY entity, entity_id').all();
    res.json(Object.fromEntries(rows.map((r) => [`${r.entity}:${r.entity_id}`, r.n])));
  });

  app.post('/api/comments', (req, res) => {
    const { entity, entity_id, body } = req.body || {};
    const text = String(body || '').trim();
    if (!text) return res.status(400).json({ error: 'Lege reactie.' });
    const record = loadRecord(entity, entity_id);
    if (!record) return res.status(404).json({ error: 'Item niet gevonden.' });
    const info = db.prepare('INSERT INTO comments (entity, entity_id, body, created_by) VALUES (?,?,?,?)').run(entity, entity_id, text, req.user.id);
    const title = record[TITLE_FIELD[entity]];
    // @mentions: "@sanne" (username) or "@Sanne" (first name)
    const users = db.prepare('SELECT id, name, username FROM users WHERE active = 1').all();
    const mentioned = users.filter((u) => {
      const re = new RegExp(`@(${u.username}|${u.name.split(' ')[0]})\\b`, 'i');
      return re.test(text);
    }).map((u) => u.id);
    notify(mentioned, { kind: 'genoemd', entity, entityId: Number(entity_id), title: `${req.user.name} noemde je bij ${NOUN[entity]} "${title}": ${text.slice(0, 80)}`, actorId: req.user.id });
    const others = peopleOf(entity, record).filter((u) => !mentioned.includes(u));
    notify(others, { kind: 'reactie', entity, entityId: Number(entity_id), title: `${req.user.name} reageerde op ${NOUN[entity]} "${title}": ${text.slice(0, 80)}`, actorId: req.user.id });
    broadcast('comments');
    res.json(db.prepare('SELECT * FROM comments WHERE id = ?').get(info.lastInsertRowid));
  });

  app.delete('/api/comments/:id', (req, res) => {
    const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Niet gevonden.' });
    if (c.created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Je kunt alleen je eigen reacties verwijderen.' });
    db.prepare('DELETE FROM comments WHERE id = ?').run(c.id);
    broadcast('comments');
    res.json({ ok: true });
  });

  return { afterWrite, afterDelete };
}

module.exports = { notifyRoutes, addInterval };
