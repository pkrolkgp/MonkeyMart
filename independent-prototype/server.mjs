import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { createLanDiscovery } from './lan-discovery.mjs';

const port = Number(process.env.PORT || 8080);
const html = fileURLToPath(new URL('./index.html', import.meta.url));
export function makeRoom(initial = null) {
  const players = new Map();
  const state = { stock: 0, coins: 0, served: 0, customers: 0 };
  let nextId = 1;
  if (initial) {
    if (!initial.state || !Array.isArray(initial.players) || initial.players.length > 2) throw new TypeError('Invalid room snapshot');
    for (const key of ['stock', 'coins', 'served', 'customers']) {
      const value = initial.state[key];
      if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid economy snapshot');
      state[key] = value;
    }
    for (const p of initial.players) {
      if (!Number.isSafeInteger(p.id) || p.id < 1 || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isSafeInteger(p.carry) || p.carry < 0 || p.carry > 3 || players.has(p.id)) throw new TypeError('Invalid player snapshot');
      players.set(p.id, { id: p.id, x: Math.max(14, Math.min(786, p.x)), y: Math.max(14, Math.min(466, p.y)), carry: p.carry });
      nextId = Math.max(nextId, p.id + 1);
    }
  }
  return {
    state, players,
    join() { if (players.size >= 2) return null; const id = nextId++; players.set(id, { id, x: 150 + (id - 1) * 60, y: 230, carry: 0 }); return id; },
    leave(id) { players.delete(id); },
    exportState() { return { state: { ...state }, players: [...players.values()].map(p => ({ ...p })) }; },
    move(id, dx, dy, dt) {
      const p = players.get(id); if (!p) return;
      dx = Math.max(-1, Math.min(1, Number(dx) || 0)); dy = Math.max(-1, Math.min(1, Number(dy) || 0));
      const length = Math.hypot(dx, dy) || 1, step = 180 * Math.min(.1, Math.max(0, Number(dt) || 0));
      p.x = Math.max(14, Math.min(786, p.x + dx / length * step));
      p.y = Math.max(14, Math.min(466, p.y + dy / length * step));
    },
    act(id) {
      const p = players.get(id); if (!p) return;
      const near = z => Math.hypot(p.x - Math.max(z[0], Math.min(p.x, z[0] + z[2])), p.y - Math.max(z[1], Math.min(p.y, z[1] + z[3]))) < 32;
      if (near([40,45,170,125])) p.carry = Math.min(3, p.carry + 1);
      else if (near([330,65,150,110])) { state.stock += p.carry; p.carry = 0; }
      else if (near([615,65,145,110]) && state.stock && state.customers) { state.stock--; state.customers--; state.coins += 5; state.served++; }
    },
    spawn() { state.customers = Math.min(5, state.customers + 1); },
    snapshot() { return { type: 'snapshot', state: { ...state }, players: [...players.values()].map(p => ({ ...p })) }; }
  };
}
export function startServer(listenPort = port, options = {}) {
  const room = makeRoom(options.initialState ?? null);
  let discovery;
  const server = createServer(async (req, res) => {
    if (req.url === '/api/lan-rooms') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ rooms: discovery?.list() ?? [] }));
      return;
    }
    if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(await readFile(html));
  });
  const wss = new WebSocketServer({ server });
  const broadcast = () => { const msg = JSON.stringify(room.snapshot()); for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(msg); };
  wss.on('connection', ws => {
    const id = room.join();
    if (id === null) { ws.close(1008, 'Room full'); return; }
    ws.send(JSON.stringify({ type: 'welcome', id }));
    broadcast();
    let lastAction = 0;
    ws.on('message', raw => {
      if (raw.length > 512) return;
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'move') room.move(id, msg.dx, msg.dy, msg.dt);
      else if (msg.type === 'act' && Date.now() - lastAction >= 120) { lastAction = Date.now(); room.act(id); }
      else return;
      broadcast();
    });
    ws.on('close', () => { room.leave(id); broadcast(); });
  });
  const timer = setInterval(() => { room.spawn(); broadcast(); }, 5000);
  server.on('close', () => clearInterval(timer));
  const roomId = options.roomId || randomUUID();
  server.listen(listenPort, () => {
    const actualPort = server.address().port;
    discovery = createLanDiscovery({ room: { id: roomId, name: options.roomName || process.env.ROOM_NAME || 'Co-op Market', port: actualPort, players: room.players.size } });
  });
  // Update the advertised occupancy whenever the room changes.
  const updateAdvertisedRoom = () => {
    if (discovery) discovery.room = { ...discovery.room, players: room.players.size };
  };
  wss.on('connection', ws => { updateAdvertisedRoom(); ws.on('close', updateAdvertisedRoom); });
  server.on('close', () => discovery?.close());
  return { server, wss, room, roomId, exportHandoff() { return { roomId, roomName: options.roomName || process.env.ROOM_NAME || 'Co-op Market', ...room.exportState() }; } };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]))) {
  startServer();
  console.log('Independent co-op market: http://localhost:' + port);
}
