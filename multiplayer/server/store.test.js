"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("./store");
const { Room } = require("./room");

test("atomic stock: competing players cannot both collect the final product", () => {
  const room = new Room("TEST", { initialStock: { banana: 1 } });
  const a = room.join(), b = room.join();
  assert.equal(room.act(a.id, { action: "collect", item: "banana", quantity: 1, requestId: "1" }).revision, 1);
  assert.throws(() => room.act(b.id, { action: "collect", item: "banana", quantity: 1, requestId: "1" }), /OUT_OF_STOCK/);
  assert.equal(room.snapshot().store.stock.banana, 0);
  assert.equal(room.snapshot().players.find(p => p.id === a.id).inventory.banana, 1);
});
test("retries don't duplicate products or change revision", () => {
  const room = new Room("TEST", { initialStock: { apple: 2 } });
  const p = room.join();
  const req = { action: "collect", item: "apple", quantity: 1, requestId: "req-1" };
  assert.equal(room.act(p.id, req).duplicate, false);
  assert.equal(room.act(p.id, req).duplicate, true);
  assert.equal(room.snapshot().store.revision, 1);
  assert.equal(room.snapshot().store.stock.apple, 1);
  assert.throws(() => room.act(p.id, { ...req, quantity: 2 }), /REQUEST_ID_REUSED/);
});
test("dropping from the inventory returns to shared stock", () => {
  const room = new Room("TEST", { initialStock: { carrot: 3 } });
  const p = room.join();
  room.act(p.id, { action: "collect", item: "carrot", quantity: 2, requestId: "c" });
  room.act(p.id, { action: "drop", item: "carrot", quantity: 1, requestId: "d" });
  assert.equal(room.snapshot().store.stock.carrot, 2);
  assert.equal(room.snapshot().players[0].inventory.carrot, 1);
  assert.throws(() => room.act(p.id, { action: "drop", item: "carrot", quantity: 2, requestId: "e" }), /INSUFFICIENT_INVENTORY/);
});
test("disconnect safely returns a player's carried inventory", () => {
  const room = new Room("TEST", { initialStock: { corn: 3 } });
  const p = room.join();
  room.act(p.id, { action: "collect", item: "corn", quantity: 2, requestId: "c" });
  assert.equal(room.leave(p.id), true);
  assert.equal(room.snapshot().store.stock.corn, 3);
  assert.equal(room.snapshot().store.revision, 2);
  assert.equal(room.leave(p.id), false);
});
test("late joiners receive authoritative stock and players' inventory", () => {
  const room = new Room("TEST", { initialStock: { milk: 5 } });
  const a = room.join();
  room.act(a.id, { action: "collect", item: "milk", quantity: 3, requestId: "1" });
  const b = room.join();
  const snapshot = room.snapshot();
  assert.equal(snapshot.store.stock.milk, 2);
  assert.equal(snapshot.players.find(p => p.id === a.id).inventory.milk, 3);
  assert.deepEqual(snapshot.players.find(p => p.id === b.id).inventory, {});
});
test("invalid products, quantities and request IDs rejected", () => {
  assert.throws(() => new Store({ initialStock: { banana: -1 } }), /INVALID_INITIAL_STOCK/);
  assert.throws(() => new Store({ initialStock: JSON.parse('{"__proto__":5}') }), /INVALID_INITIAL_STOCK/);
  const room = new Room("TEST", { initialStock: { banana: 5 } }), p = room.join();
  for (const item of ["__proto__", "toString", "blue berry"]) {
    assert.throws(() => room.act(p.id, { action: "collect", item, quantity: 1, requestId: "x" }), /UNKNOWN_PRODUCT/);
  }
  for (const quantity of [0, -1, 1.5, Infinity, 101]) {
    assert.throws(() => room.act(p.id, { action: "collect", item: "banana", quantity, requestId: "x" }), /INVALID_QUANTITY/);
  }
  assert.throws(() => room.act(p.id, { action: "collect", item: "banana", quantity: 1, requestId: "" }), /INVALID_REQUEST_ID/);
});
