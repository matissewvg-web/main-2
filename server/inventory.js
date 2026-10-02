// Stock only changes through movements, so there is always a history of who
// changed what. Every movement stores the signed change (delta) in qty.
function inventoryRoutes(app, db, broadcast) {
  const today = () => new Date().toISOString().slice(0, 10);

  app.get('/api/stock_moves', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 300, 2000);
    const rows = req.query.product_id
      ? db.prepare('SELECT * FROM stock_moves WHERE product_id = ? ORDER BY date DESC, id DESC LIMIT ?').all(req.query.product_id, limit)
      : db.prepare('SELECT * FROM stock_moves ORDER BY date DESC, id DESC LIMIT ?').all(limit);
    res.json(rows);
  });

  app.post('/api/stock_moves', (req, res) => {
    const { product_id, kind, note } = req.body || {};
    const qty = Number(req.body?.qty);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product niet gevonden.' });
    if (!['in', 'uit', 'correctie'].includes(kind)) return res.status(400).json({ error: 'Kies in, uit of correctie.' });
    if (!Number.isFinite(qty) || (kind !== 'correctie' && qty <= 0) || qty < 0) {
      return res.status(400).json({ error: 'Vul een geldig aantal in.' });
    }
    const delta = kind === 'in' ? qty : kind === 'uit' ? -qty : qty - product.stock;
    if (delta === 0 && kind === 'correctie') return res.status(400).json({ error: 'De voorraad is al ' + qty + '.' });
    const run = db.transaction(() => {
      const info = db.prepare('INSERT INTO stock_moves (product_id, kind, qty, note, date, created_by) VALUES (?,?,?,?,?,?)')
        .run(product.id, kind, delta, note || null, req.body.date || today(), req.user.id);
      db.prepare("UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?").run(delta, product.id);
      db.prepare('INSERT INTO activity (user_id, action, entity, entity_id, label) VALUES (?,?,?,?,?)')
        .run(req.user.id, kind === 'in' ? 'aangevuld' : kind === 'uit' ? 'afgeboekt' : 'gecorrigeerd', 'voorraad', product.id, `${product.name} (${delta > 0 ? '+' : ''}${delta})`);
      return info.lastInsertRowid;
    });
    const id = run();
    broadcast('products');
    broadcast('stock_moves');
    res.json({ id, stock: db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id).stock });
  });

  // Undo a movement: reverses its effect on the stock.
  app.delete('/api/stock_moves/:id', (req, res) => {
    const move = db.prepare('SELECT * FROM stock_moves WHERE id = ?').get(req.params.id);
    if (!move) return res.status(404).json({ error: 'Niet gevonden.' });
    db.transaction(() => {
      db.prepare('DELETE FROM stock_moves WHERE id = ?').run(move.id);
      db.prepare("UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?").run(move.qty, move.product_id);
    })();
    broadcast('products');
    broadcast('stock_moves');
    res.json({ ok: true });
  });
}

module.exports = { inventoryRoutes };
