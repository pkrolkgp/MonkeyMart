"use strict";
const { randomBytes, randomUUID } = require("node:crypto");
const MAX_PLAYERS = 4;
const SKINS = new Set(Array.from({ length: 17 }, (_, i) => "monkey" + (i + 1)));

function asSkin(skin) {
  return typeof skin === "string" && SKINS.has(skin) ? skin : "monkey1";
}
function asName(name) {
  return typeof name === "string" ? name.trim().slice(0, 24) || "Gracz" : "Gracz";
}
function finiteCoord(number) {
  return typeof number === "number" && Number.isFinite(number) && Math.abs(number) <= 100000;
}
class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();
  }
  join({ name = "Gracz", skin = "monkey1" } = {}) {
    if (this.players.size >= MAX_PLAYERS) throw new Error("ROOM_FULL");
    const player = { id: randomUUID(), name: asName(name), skin: asSkin(skin), x: 0, y: 0, seq: -1 };
    this.players.set(player.id, player);
    return player;
  }
  leave(id) { return this.players.delete(id); }
  setSkin(id, skin) {
    const player = this.players.get(id);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (typeof skin !== "string" || !SKINS.has(skin)) throw new Error("INVALID_SKIN");
    player.skin = skin;
    return player;
  }
  move(id, x, y, seq) {
    const player = this.players.get(id);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    if (!finiteCoord(x) || !finiteCoord(y) ||
        !Number.isSafeInteger(seq) || seq < 0) throw new Error("INVALID_MOVE");
    if (seq <= player.seq) return false;
    player.x = x;
    player.y = y;
    player.seq = seq;
    return true;
  }
  snapshot() {
    return { room: this.code, players: Array.from(this.players.values(), p => ({ ...p })),
      maxPlayers: MAX_PLAYERS };
  }
}
class RoomManager {
  constructor() { this.rooms = new Map(); }
  create() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempts = 0; attempts < 100; attempts++) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
      if (!this.rooms.has(code)) {
        const room = new Room(code);
        this.rooms.set(code, room);
        return room;
      }
    }
    throw new Error("NO_ROOM_CODES");
  }
  get(code) { return this.rooms.get(String(code || "").toUpperCase()); }
  removeEmpty(room) {
    if (room && room.players.size === 0) this.rooms.delete(room.code);
  }
}
module.exports = { Room, RoomManager, MAX_PLAYERS, SKINS };
