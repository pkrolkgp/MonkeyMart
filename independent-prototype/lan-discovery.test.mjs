import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAnnouncement, decodeAnnouncement, createLanDiscovery } from './lan-discovery.mjs';

test('LAN announcements round-trip and use observed sender IP, not untrusted advertised IP', () => {
 const room = { id: 'room-1', name: 'Sklep', port: 8080, players: 1 };
 const decoded = decodeAnnouncement(encodeAnnouncement({ ...room, address: '1.2.3.4' }), '192.168.1.20');
 assert.deepEqual(decoded, { ...room, address: '192.168.1.20' });
});
test('invalid or oversized LAN announcements are rejected', () => {
 assert.equal(decodeAnnouncement(Buffer.from('not json'), '127.0.0.1'), null);
 assert.equal(decodeAnnouncement(Buffer.alloc(513), '127.0.0.1'), null);
 assert.equal(decodeAnnouncement(Buffer.from(JSON.stringify({ protocol: 'other' })), '127.0.0.1'), null);
 assert.throws(() => encodeAnnouncement({ id: 'a', name: 'b', port: 0, players: 1 }));
 assert.throws(() => encodeAnnouncement({ id: 'a', name: 'b', port: 80, players: 3 }));
});
test('discovery instance can be closed without room or central server', async () => {
 const discovery = createLanDiscovery({ port: 0, intervalMs: 100 });
 assert.deepEqual(discovery.list(), []);
 assert.equal(discovery.room, null);
 discovery.close();
});
