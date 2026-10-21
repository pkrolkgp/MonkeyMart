"use strict";
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");
const { RoomManager } = require("./room");

function startServer(options = {}) {
  const manager = new RoomManager({ initialStock: options.initialStock || {} });
  const httpServer = http.createServer((req, res) => {
    const body = JSON.stringify({ service: "monkeymart-coop-transport", status: "ok",
      note: "Transport and shared-inventory prototype: original Monkey Mart is not integrated." });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(body);
  });
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 8192 });
  function send(socket, message) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  function broadcast(room, message, exclude) {
    for (const socket of wss.clients) {
      if (socket !== exclude && socket.room === room) send(socket, message);
    }
  }
  wss.on("connection", socket => {
    socket.room = null;
    socket.playerId = null;
    socket.isAlive = true;
    socket.on("pong", () => { socket.isAlive = true; });
    socket.on("message", data => {
      try {
        const request = JSON.parse(data.toString("utf8"));
        if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("BAD_REQUEST");
        const type = request.type;
        if (type === "create" || type === "join") {
          if (socket.room) throw new Error("ALREADY_IN_ROOM");
          const room = type === "create" ? manager.create() : manager.get(request.room);
          if (!room) throw new Error("ROOM_NOT_FOUND");
          const player = room.join({ name: request.name, skin: request.skin });
          socket.room = room;
          socket.playerId = player.id;
          send(socket, { type: "welcome", playerId: player.id, ...room.snapshot() });
          broadcast(room, { type: "player_joined", player: { ...player, inventory: {} } }, socket);
        } else if (type === "move") {
          if (!socket.room) throw new Error("JOIN_FIRST");
          const changed = socket.room.move(socket.playerId, request.x, request.y, request.seq);
          if (changed) broadcast(socket.room, {
            type: "player_moved", playerId: socket.playerId,
            x: request.x, y: request.y, seq: request.seq,
          }, socket);
        } else if (type === "skin") {
          if (!socket.room) throw new Error("JOIN_FIRST");
          const player = socket.room.setSkin(socket.playerId, request.skin);
          broadcast(socket.room, { type: "player_skin", playerId: player.id, skin: player.skin });
        } else if (type === "action") {
          if (!socket.room) throw new Error("JOIN_FIRST");
          const result = socket.room.act(socket.playerId, request);
          send(socket, { type: "action_result", ...result });
          if (!result.duplicate) broadcast(socket.room, { type: "store_changed", ...result });
        } else if (type === "snapshot") {
          if (!socket.room) throw new Error("JOIN_FIRST");
          send(socket, { type: "snapshot", ...socket.room.snapshot() });
        } else {
          throw new Error("UNKNOWN_MESSAGE");
        }
      } catch (err) {
        send(socket, { type: "error", error: err.message || "INVALID_REQUEST" });
      }
    });
    socket.on("close", () => {
      const room = socket.room;
      if (room) {
        const before = room.store.revision;
        room.leave(socket.playerId);
        if (room.store.revision !== before) {
          broadcast(room, { type: "store_snapshot", ...room.store.snapshot() });
        }
        broadcast(room, { type: "player_left", playerId: socket.playerId });
        manager.removeEmpty(room);
        socket.room = null;
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);
  heartbeat.unref();
  const port = options.port === undefined ? Number(process.env.PORT || 8080) : options.port;
  const host = options.host || "127.0.0.1";
  httpServer.listen(port, host);
  return {
    httpServer, wss, manager,
    close: async () => {
      clearInterval(heartbeat);
      for (const socket of wss.clients) socket.terminate();
      await new Promise((resolve, reject) => wss.close(err => err ? reject(err) : resolve()));
      await new Promise((resolve, reject) => httpServer.close(err => err ? reject(err) : resolve()));
    },
  };
}
if (require.main === module) {
  const server = startServer({ host: process.env.HOST || "127.0.0.1" });
  server.httpServer.on("listening", () =>
    console.log("Monkey Mart co-op transport listening on " +
      JSON.stringify(server.httpServer.address())));
}
module.exports = { startServer };
