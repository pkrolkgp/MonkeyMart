"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const WebSocket = require("ws");
const { startServer } = require("./server");

function next(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off("message", onMessage); reject(new Error("timeout")); }, 3000);
    const onMessage = data => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString("utf8")));
    };
    socket.once("message", onMessage);
  });
}
async function connect(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  return socket;
}
async function request(socket, payload) {
  const response = next(socket);
  socket.send(JSON.stringify(payload));
  return response;
}
test("WebSocket purchases spend once and synchronize late joiners", { timeout: 12000 }, async () => {
  const server = startServer({ port: 0, initialBalance: 40,
    upgradePrices: { shelf: 30, machine: 20 } });
  const clients = [];
  try {
    await once(server.httpServer, "listening");
    const url = "ws://127.0.0.1:" + server.httpServer.address().port;
    const a = await connect(url); clients.push(a);
    const welcome = await request(a, { type: "create" });
    assert.equal(welcome.economy.balance, 40);
    const b = await connect(url); clients.push(b);
    const joinedNotice = next(a);
    const joined = await request(b, { type: "join", room: welcome.room });
    assert.equal((await joinedNotice).type, "player_joined");
    assert.equal(joined.economy.balance, 40);
    const changedNotice = next(b);
    const purchase = await request(a, { type: "purchase", upgrade: "shelf", requestId: "buy-1",
      price: 0, balance: 9999 });
    assert.equal(purchase.type, "purchase_result");
    assert.equal(purchase.price, 30);
    assert.equal(purchase.balance, 10);
    assert.equal(purchase.duplicate, false);
    const changed = await changedNotice;
    assert.equal(changed.type, "economy_changed");
    assert.equal(changed.balance, 10);
    assert.deepEqual(changed.purchasedUpgrades, ["shelf"]);
    const replay = await request(a, { type: "purchase", upgrade: "shelf", requestId: "buy-1" });
    assert.equal(replay.duplicate, true);
    assert.deepEqual(await request(b, { type: "purchase", upgrade: "shelf", requestId: "buy-1" }),
      { type: "error", error: "ALREADY_PURCHASED" });
    assert.deepEqual(await request(b, { type: "purchase", upgrade: "machine", requestId: "buy-2" }),
      { type: "error", error: "INSUFFICIENT_FUNDS" });
    const snap = await request(b, { type: "snapshot" });
    assert.equal(snap.economy.revision, 1);
    assert.equal(snap.economy.balance, 10);
    assert.deepEqual(snap.economy.purchasedUpgrades, ["shelf"]);
    const c = await connect(url); clients.push(c);
    const cWelcome = await request(c, { type: "join", room: welcome.room });
    assert.equal(cWelcome.economy.balance, 10);
    assert.deepEqual(cWelcome.economy.purchasedUpgrades, ["shelf"]);
  } finally {
    for (const socket of clients) socket.terminate();
    await server.close();
  }
});
