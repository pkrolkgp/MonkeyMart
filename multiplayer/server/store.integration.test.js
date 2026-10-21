"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const WebSocket = require("ws");
const { startServer } = require("./server");
function next(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("socket timeout")), 3000);
    socket.once("message", data => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString("utf8")));
    });
  });
}
async function connected(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  return socket;
}
async function request(socket, message) {
  const response = next(socket);
  socket.send(JSON.stringify(message));
  return response;
}
test("WebSocket clients share finite stock, cannot double collect, and see snapshots", { timeout: 12000 }, async () => {
  const server = startServer({ port: 0, initialStock: { banana: 1 } });
  const clients = [];
  try {
    await once(server.httpServer, "listening");
    const url = "ws://127.0.0.1:" + server.httpServer.address().port;
    const a = await connected(url); clients.push(a);
    const welcomeA = await request(a, { type: "create", name: "a" });
    assert.deepEqual(welcomeA.store, { revision: 0, stock: { banana: 1 } });
    const b = await connected(url); clients.push(b);
    const joined = next(a);
    const welcomeB = await request(b, { type: "join", room: welcomeA.room, name: "b" });
    assert.equal((await joined).type, "player_joined");
    assert.deepEqual(welcomeB.store, { revision: 0, stock: { banana: 1 } });
    const broadcastB = next(b);
    const accepted = await request(a, { type: "action", action: "collect", item: "banana", quantity: 1, requestId: "x1" });
    assert.equal(accepted.type, "action_result");
    assert.equal(accepted.stock, 0);
    assert.equal((await broadcastB).type, "store_changed");
    assert.deepEqual(await request(b, { type: "action", action: "collect", item: "banana", quantity: 1, requestId: "x1" }),
      { type: "error", error: "OUT_OF_STOCK" });
    const replay = await request(a, { type: "action", action: "collect", item: "banana", quantity: 1, requestId: "x1" });
    assert.equal(replay.duplicate, true);
    const snap = await request(b, { type: "snapshot" });
    assert.equal(snap.store.revision, 1);
    assert.equal(snap.store.stock.banana, 0);
    assert.equal(snap.players.find(p => p.id === welcomeA.playerId).inventory.banana, 1);
    const returned = next(b);
    a.close();
    const returnedEvent = await returned;
    assert.equal(returnedEvent.type, "store_snapshot");
    assert.equal(returnedEvent.stock.banana, 1);
  } finally {
    for (const socket of clients) socket.terminate();
    await server.close();
  }
});
