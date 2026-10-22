"use strict";
const { randomBytes, randomUUID } = require("node:crypto");
const { Store } = require("./store");
const { Economy } = require("./economy");
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
  constructor(code, { initialStock = {}, initialBalance = 0, upgradePrices = {} } = {}) {
    this.code = code;
    this.players = new Map();
    this.store = new Store({ initialStock });
    this.economy = new Economy({ initialBalance, upgradePrices });
  }
  join({ name = "Gracz", skin = "monkey1" } = {}) {
    if (this.players.size >= MAX_PLAYERS) throw new Error("ROOM_FULL");
    const player = { id: randomUUID(), name: asName(name), skin: asSkin(skin), x: 0, y: 0, seq: -1 };
    this.store.addPlayer(player.id);
    this.economy.addPlayer(player.id);
    this.players.set(player.id, player);
    return player;
  }
  leave(id) {
    if (!this.players.has(id)) return false;
    this.store.removePlayer(id);
    this.economy.removePlayer(id);
    return this.players.delete(id);
  }
  act(id, action) { return this.store.transfer(id, action); }
  purchase(id, request) { return this.economy.buy(id, request); }
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
    return { room: this.code, players: Array.from(this.players.values(),
      p => ({ ...p, inventory: this.store.inventoryOf(p.id) })),
      maxPlayers: MAX_PLAYERS, store: this.store.snapshot(),
      economy: this.economy.snapshot() };
  }
}
class RoomManager {
  constructor(options = {}) { this.rooms = new Map(); this.options = options; }
  create() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempts = 0; attempts < 100; attempts++) {
      const bytes = randomBytes(6);
      const code = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
      if (!this.rooms.has(code)) {
        const room = new Room(code, this.options);
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
