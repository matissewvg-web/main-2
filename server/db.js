const { DatabaseSync, backup } = require('node:sqlite');

// Each entry is one schema version. Never edit an old entry; append a new one.
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    color TEXT NOT NULL DEFAULT '#6366f1',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL DEFAULT '#64748b'
  );
  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'persoon',
    name TEXT NOT NULL,
    company TEXT,
    job_title TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    website TEXT,
    notes TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'actief',
    priority TEXT NOT NULL DEFAULT 'normaal',
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    start_date TEXT,
    deadline TEXT,
    folder TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE meetings (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT,
    location TEXT,
    content TEXT NOT NULL DEFAULT '',
    attendee_users TEXT NOT NULL DEFAULT '[]',
    attendee_contacts TEXT NOT NULL DEFAULT '[]',
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'normaal',
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
    deadline TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    sort REAL NOT NULL DEFAULT 0,
    created_by INTEGER,
    done_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE activity (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
  CREATE INDEX idx_tasks_project ON tasks(project_id);
  CREATE INDEX idx_meetings_project ON meetings(project_id);
  INSERT INTO tags (name, color) VALUES
    ('Klant', '#0ea5e9'), ('Leverancier', '#f59e0b'), ('Intern', '#64748b'), ('Financieel', '#10b981');
  `,
  // Phase 2: several people per task, finance access per user, inventory,
  // finance and investments. Money is stored in cents to avoid rounding errors.
  `
  ALTER TABLE users ADD COLUMN can_finance INTEGER NOT NULL DEFAULT 0;
  UPDATE users SET can_finance = 1 WHERE role = 'admin';

  ALTER TABLE tasks ADD COLUMN assignees TEXT NOT NULL DEFAULT '[]';
  UPDATE tasks SET assignees = json_array(assignee_id) WHERE assignee_id IS NOT NULL;

  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    location TEXT,
    unit TEXT NOT NULL DEFAULT 'stuks',
    stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    price_cents INTEGER NOT NULL DEFAULT 0,
    supplier_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    notes TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    archived INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE stock_moves (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    qty REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_moves_product ON stock_moves(product_id);

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'uitgave',
    amount_cents INTEGER NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    description TEXT NOT NULL,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'betaald',
    due_date TEXT,
    vat_rate REAL,
    file_path TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_tx_date ON transactions(date);

  CREATE TABLE investments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'aandelen',
    ticker TEXT,
    notes TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    archived INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE investment_entries (
    id INTEGER PRIMARY KEY,
    investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    quantity REAL,
    note TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_inv_entries ON investment_entries(investment_id);
  `,
];

// Uses the SQLite that ships inside Node/Electron, so the app has no native
// modules that need compiling for Windows.
function openDb(file) {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec('PRAGMA busy_timeout = 5000');

  const db = {
    prepare: (sql) => raw.prepare(sql),
    exec: (sql) => raw.exec(sql),
    transaction: (fn) => (...args) => {
      raw.exec('BEGIN');
      try {
        const out = fn(...args);
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    backup: (dest) => backup(raw, dest),
    close: () => raw.close(),
  };

  const current = raw.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      raw.exec(MIGRATIONS[v]);
      raw.exec(`PRAGMA user_version = ${v + 1}`);
    })();
  }
  return db;
}

module.exports = { openDb };
