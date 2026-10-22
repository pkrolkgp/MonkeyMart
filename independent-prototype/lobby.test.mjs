import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';

test('local room directory returns JSON without central lobby', async (t) => {
 const { server, wss } = startServer(0);
 t.after(async () => { for (const client of wss.clients) client.terminate(); await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve)); });
 if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
 const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/lan-rooms');
 assert.equal(response.status, 200);
 assert.match(response.headers.get('content-type'), /application\/json/);
 const data = await response.json();
 assert.ok(Array.isArray(data.rooms));
});
