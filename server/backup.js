const fs = require('fs');
const path = require('path');

const KEEP = 14;

function createBackups({ db, dataDir, filesRoot }) {
  const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  const setSetting = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);

  const backupDir = () => getSetting('backup_dir') || path.join(dataDir, 'Backups');
  let running = false;

  async function run() {
    if (running) return { ok: false, error: 'Er loopt al een back-up.' };
    running = true;
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const target = path.join(backupDir(), `TheBreak5-${stamp}`);
    try {
      fs.mkdirSync(target, { recursive: true });
      await db.backup(path.join(target, 'thebreak5.db'));
      fs.cpSync(filesRoot, path.join(target, 'Bestanden'), { recursive: true, force: true });
      prune();
      setSetting('last_backup', new Date().toISOString());
      setSetting('last_backup_error', '');
      return { ok: true, path: target };
    } catch (e) {
      setSetting('last_backup_error', `${new Date().toISOString()} ${e.message}`);
      return { ok: false, error: e.message };
    } finally {
      running = false;
    }
  }

  function prune() {
    const dir = backupDir();
    const all = fs.readdirSync(dir).filter((n) => n.startsWith('TheBreak5-')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
      fs.rmSync(path.join(dir, old), { recursive: true, force: true });
    }
  }

  function status() {
    const dir = backupDir();
    let list = [];
    try { list = fs.readdirSync(dir).filter((n) => n.startsWith('TheBreak5-')).sort().reverse(); } catch {}
    return {
      dir,
      sameDiskAsData: path.parse(dir).root.toLowerCase() === path.parse(dataDir).root.toLowerCase(),
      lastBackup: getSetting('last_backup') || null,
      lastError: getSetting('last_backup_error') || null,
      backups: list,
    };
  }

  // Check every hour; back up when the last one is older than 20 hours.
  function tick() {
    const last = getSetting('last_backup');
    if (!last || Date.now() - new Date(last).getTime() > 20 * 3600 * 1000) run();
  }
  const timer = setInterval(tick, 3600 * 1000);
  setTimeout(tick, 60 * 1000);

  return {
    run,
    status,
    setDir: (dir) => setSetting('backup_dir', dir),
    stop: () => clearInterval(timer),
  };
}

module.exports = { createBackups };
