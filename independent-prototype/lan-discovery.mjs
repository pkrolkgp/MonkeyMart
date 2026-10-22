import dgram from 'node:dgram';
import { randomUUID } from 'node:crypto';

export const DISCOVERY_PORT = 41287;
export const DISCOVERY_GROUP = '239.255.42.87';
const MAGIC = 'independent-market-lan-v1';

export function encodeAnnouncement(room) {
  if (!room || typeof room.id !== 'string' || !room.id || typeof room.name !== 'string' ||
      !Number.isInteger(room.port) || room.port < 1 || room.port > 65535 ||
      !Number.isInteger(room.players) || room.players < 0 || room.players > 2) throw new TypeError('Invalid room');
  return Buffer.from(JSON.stringify({ protocol: MAGIC, id: room.id, name: room.name.slice(0, 80), port: room.port, players: room.players }));
}

export function decodeAnnouncement(bytes, remoteAddress) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 512 || typeof remoteAddress !== 'string') return null;
  let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { return null; }
  if (!data || data.protocol !== MAGIC || typeof data.id !== 'string' || !data.id ||
      data.id.length > 100 || typeof data.name !== 'string' || data.name.length > 80 ||
      !Number.isInteger(data.port) || data.port < 1 || data.port > 65535 ||
      !Number.isInteger(data.players) || data.players < 0 || data.players > 2) return null;
  return { id: data.id, name: data.name, port: data.port, players: data.players, address: remoteAddress };
}

export function createLanDiscovery({ room = null, port = DISCOVERY_PORT, intervalMs = 1500, ttlMs = 5000, onRooms = () => {} } = {}) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const known = new Map();
  const instanceId = randomUUID();
  let timer, closed = false;
  const list = () => [...known.values()].map(({ seenAt, ...entry }) => entry);
  const prune = () => {
    const now = Date.now();
    let changed = false;
    for (const [id, item] of known) if (now - item.seenAt > ttlMs) { known.delete(id); changed = true; }
    if (changed) onRooms(list());
  };
  socket.on('message', (bytes, info) => {
    const entry = decodeAnnouncement(bytes, info.address);
    if (!entry || entry.id === room?.id) return;
    known.set(entry.id, { ...entry, seenAt: Date.now() });
    onRooms(list());
  });
  socket.on('error', () => { /* errors must not crash gameplay; caller can inspect socket */ });
  socket.bind(port, '0.0.0.0', () => {
    try { socket.addMembership(DISCOVERY_GROUP); socket.setMulticastTTL(1); } catch { /* multicast may be unavailable */ }
    const announce = () => {
      prune();
      if (!room || closed) return;
      try {
        const bytes = encodeAnnouncement(room);
        socket.send(bytes, port, DISCOVERY_GROUP);
      } catch { /* invalid room or unavailable network */ }
    };
    announce();
    timer = setInterval(announce, intervalMs);
    timer.unref();
  });
  return {
    instanceId, list,
    close() { closed = true; clearInterval(timer); socket.close(); },
    get room() { return room; },
    set room(value) { room = value; }
  };
}
