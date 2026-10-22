import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom, startServer } from './server.mjs';

test('state transfer preserves economy and player inventory', () => {
 const first = makeRoom();
 const id = first.join();
 const p = first.players.get(id);
 p.x = 100; p.y = 100;
 first.act(id);
 p.x = 400; p.y = 100;
 first.act(id);
 first.spawn();
 const handoff = first.exportState();
 const next = makeRoom(handoff);
 assert.deepEqual(next.exportState(), handoff);
 next.players.get(id).x = 690;
 next.players.get(id).y = 100;
 next.act(id);
 assert.equal(next.state.coins, 5);
 assert.equal(next.state.stock, 0);
 assert.equal(first.state.coins, 0);
});

test('restore rejects corrupt or duplicate player data', () => {
 assert.throws(() => makeRoom({ state: { stock: -1, coins: 0, served: 0, customers: 0 }, players: [] }));
 assert.throws(() => makeRoom({ state: { stock: 0, coins: 0, served: 0, customers: 0 }, players: [{ id: 1, x: 10, y: 10, carry: 0 }, { id: 1, x: 20, y: 20, carry: 0 }] }));
});

test('server exposes an in-memory handoff snapshot', async t => {
 const game = startServer(0, { roomId: 'handoff-room', roomName: 'Test LAN' });
 t.after(async () => {
   for (const client of game.wss.clients) client.terminate();
   await new Promise(resolve => game.wss.close(resolve));
   await new Promise(resolve => game.server.close(resolve));
 });
 const transfer = game.exportHandoff();
 assert.equal(transfer.roomId, 'handoff-room');
 assert.equal(transfer.roomName, 'Test LAN');
 assert.deepEqual(transfer.players, []);
});
