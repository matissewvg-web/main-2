const dgram = require('dgram');
const os = require('os');

// Clients broadcast a question on the office network; the host answers with its
// address so nobody has to type an IP address.
const DISCOVERY_PORT = 47501;
const QUESTION = 'THEBREAK5_DISCOVER';

function startResponder(apiPort) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', (msg, rinfo) => {
    if (msg.toString() !== QUESTION) return;
    const reply = Buffer.from(JSON.stringify({ app: 'The Break 5', name: os.hostname(), port: apiPort }));
    sock.send(reply, rinfo.port, rinfo.address);
  });
  sock.on('error', (e) => console.error('discovery responder', e.message));
  sock.bind(DISCOVERY_PORT);
  return () => sock.close();
}

function broadcastAddresses() {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const ip = i.address.split('.').map(Number);
      const mask = i.netmask.split('.').map(Number);
      out.add(ip.map((b, k) => (b & mask[k]) | (~mask[k] & 255)).join('.'));
    }
  }
  return [...out];
}

function discover(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const found = new Map();
    const sock = dgram.createSocket('udp4');
    sock.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.app !== 'The Break 5') return;
        const url = `http://${rinfo.address}:${data.port}`;
        found.set(url, { url, name: data.name, address: rinfo.address });
      } catch {}
    });
    sock.on('error', () => {});
    sock.bind(() => {
      sock.setBroadcast(true);
      const q = Buffer.from(QUESTION);
      for (const addr of broadcastAddresses()) sock.send(q, DISCOVERY_PORT, addr, () => {});
    });
    setTimeout(() => {
      try { sock.close(); } catch {}
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

function localAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  }
  return out;
}

module.exports = { startResponder, discover, localAddresses };
