// Runs the host server without the desktop window (for development, or a PC/NAS
// that only needs to host). Usage: node server/standalone.js [dataDir] [port]
const path = require('path');
const { startServer, DEFAULT_PORT } = require('./index');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '.data'));
const port = Number(process.argv[3]) || DEFAULT_PORT;

startServer({ dataDir, port, staticDir: path.join(__dirname, '..', 'dist') }).then((s) => {
  console.log(`The Break 5 host draait op http://localhost:${s.port}  (data: ${s.dataDir})`);
});
