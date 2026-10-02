// Small endpoints that do not fit the generic CRUD routes.
function extraRoutes(app, db, broadcast) {
  // Toggle the current user's vote on a brainstorm idea in one transaction,
  // so two people voting at the same moment never overwrite each other.
  app.post('/api/ideas/:id/vote', (req, res) => {
    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
    if (!idea) return res.status(404).json({ error: 'Idee niet gevonden.' });
    const votes = db.transaction(() => {
      const current = JSON.parse(db.prepare('SELECT votes FROM ideas WHERE id = ?').get(idea.id).votes || '[]');
      const next = current.includes(req.user.id) ? current.filter((v) => v !== req.user.id) : [...current, req.user.id];
      db.prepare('UPDATE ideas SET votes = ? WHERE id = ?').run(JSON.stringify(next), idea.id);
      return next;
    })();
    broadcast('ideas');
    res.json({ votes });
  });
}

module.exports = { extraRoutes };
