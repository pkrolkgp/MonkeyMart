"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const WebSocket = require("ws");
const { startServer } = require("./server");

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("WebSocket message timeout"));
    }, 2500);
    const onMessage = data => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString("utf8")));
    };
    socket.once("message", onMessage);
  });
}

async function connected(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  return socket;
}

test("real WebSocket clients create, join, move and leave one shared room", { timeout: 12000 }, async () => {
  const server = startServer({ port: 0 });
  const clients = [];
  try {
    await once(server.httpServer, "listening");
    const address = server.httpServer.address();
    const url = "ws://127.0.0.1:" + address.port;
    const first = await connected(url);
    clients.push(first);
    let reply = nextMessage(first);
    first.send(JSON.stringify({ type: "create", name: "Host", skin: "monkey4" }));
    const created = await reply;
    assert.equal(created.type, "welcome");
    assert.equal(created.players.length, 1);
    assert.equal(created.maxPlayers, 4);

    const second = await connected(url);
    clients.push(second);
    const joinedNotice = nextMessage(first);
    reply = nextMessage(second);
    second.send(JSON.stringify({ type: "join", room: created.room, name: "Friend", skin: "monkey2" }));
    const welcome = await reply;
    assert.equal(welcome.type, "welcome");
    assert.equal(welcome.players.length, 2);
    assert.equal(welcome.players.find(p => p.id === created.playerId).skin, "monkey4");
    assert.equal((await joinedNotice).type, "player_joined");

    const movement = nextMessage(first);
    second.send(JSON.stringify({ type: "move", x: 15, y: 22, seq: 1 }));
    const moved = await movement;
    assert.equal(moved.type, "player_moved");
    assert.equal(moved.playerId, welcome.playerId);
    assert.equal(moved.x, 15);

    for (let i = 0; i < 2; i++) {
      const other = await connected(url);
      clients.push(other);
      reply = nextMessage(other);
      other.send(JSON.stringify({ type: "join", room: created.room, name: "Player " + i }));
      assert.equal((await reply).type, "welcome");
    }
    const fifth = await connected(url);
    clients.push(fifth);
    reply = nextMessage(fifth);
    fifth.send(JSON.stringify({ type: "join", room: created.room }));
    assert.deepEqual(await reply, { type: "error", error: "ROOM_FULL" });
    assert.equal(server.manager.get(created.room).players.size, 4);

    const leftNotice = nextMessage(first);
    second.close();
    const left = await leftNotice;
    assert.equal(left.type, "player_left");
    assert.equal(left.playerId, welcome.playerId);
  } finally {
    for (const socket of clients) socket.terminate();
    await server.close();
  }
});
