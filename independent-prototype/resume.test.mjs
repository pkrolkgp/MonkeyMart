import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from './server.mjs';

function connect(url) {
 return new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.once('error', reject);
  ws.once('message', bytes => resolve({ ws, message: JSON.parse(bytes.toString()) }));
 });
}
async function closeGame(game) {
 for (const client of game.wss.clients) client.terminate();
 await new Promise(resolve => game.wss.close(resolve));
 await new Promise(resolve => game.server.close(resolve));
}
test('reconnecting to restored room requires original player token', async t => {
 const first = startServer(0);
 t.after(async () => { await closeGame(first); });
 if (!first.server.listening) await new Promise(resolve => first.server.once('listening', resolve));
 const initial = await connect('ws://127.0.0.1:' + first.server.address().port);
 const { id, resumeToken } = initial.message;
 assert.equal(initial.message.type, 'welcome');
 assert.equal(typeof resumeToken, 'string');
 const transferred = first.exportHandoff();
 const second = startServer(0, { initialState: transferred, roomId: transferred.roomId });
 t.after(async () => { await closeGame(second); });
 if (!second.server.listening) await new Promise(resolve => second.server.once('listening', resolve));
 const url = 'ws://127.0.0.1:' + second.server.address().port;
 const resumed = await connect(url + '?player=' + id + '&token=' + encodeURIComponent(resumeToken));
 assert.equal(resumed.message.id, id);
 assert.equal(resumed.message.resumeToken, resumeToken);
 const unauthorized = new WebSocket(url + '?player=' + id + '&token=wrong');
 const closed = new Promise((resolve, reject) => { unauthorized.once('close', code => resolve(code)); unauthorized.once('error', reject); });
 assert.equal(await closed, 1008);
 resumed.ws.terminate(); initial.ws.terminate();
});
