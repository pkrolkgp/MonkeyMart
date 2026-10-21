"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { RoomManager, MAX_PLAYERS } = require("./room");

test("four players share one room, fifth refused", () => {
  const manager = new RoomManager(), room = manager.create();
  const players = Array.from({ length: MAX_PLAYERS }, (_, i) =>
    room.join({ name: "Gracz " + (i + 1), skin: "monkey" + (i + 1) }));
  assert.equal(room.snapshot().players.length, 4);
  assert.equal(new Set(players.map(p => p.id)).size, 4);
  assert.throws(() => room.join(), /ROOM_FULL/);
  assert.ok(room.leave(players[0].id));
  assert.equal(room.join().name, "Gracz");
  assert.equal(manager.get(room.code), room);
});
test("late joiner gets positions and skins", () => {
  const room = new RoomManager().create();
  const a = room.join({ name: "A", skin: "monkey7" });
  assert.equal(room.move(a.id, 42, 24, 1), true);
  const b = room.join({ name: "B", skin: "monkey3" });
  const snapshot = room.snapshot();
  assert.equal(snapshot.players.find(p => p.id === a.id).x, 42);
  assert.equal(snapshot.players.find(p => p.id === b.id).skin, "monkey3");
});
test("stale movement sequence cannot roll back position", () => {
  const room = new RoomManager().create(), player = room.join();
  assert.equal(room.move(player.id, 10, 20, 2), true);
  assert.equal(room.move(player.id, 99, 99, 1), false);
  assert.equal(room.move(player.id, 99, 99, 2), false);
  assert.equal(room.players.get(player.id).x, 10);
  assert.throws(() => room.move(player.id, Infinity, 0, 3), /INVALID_MOVE/);
  assert.throws(() => room.move(player.id, 0, 0, -1), /INVALID_MOVE/);
});
test("custom monkey skins are restricted to existing atlas skins", () => {
  const room = new RoomManager().create(), player = room.join({ skin: "invalid" });
  assert.equal(player.skin, "monkey1");
  assert.equal(room.setSkin(player.id, "monkey17").skin, "monkey17");
  assert.throws(() => room.setSkin(player.id, "other"), /INVALID_SKIN/);
});
test("empty rooms are deleted", () => {
  const manager = new RoomManager();
  const room = manager.create(), player = room.join();
  room.leave(player.id);
  manager.removeEmpty(room);
  assert.equal(manager.get(room.code), undefined);
});
