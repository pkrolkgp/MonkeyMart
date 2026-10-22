"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Economy } = require("./economy");
const { Room } = require("./room");

test("two players cannot buy the same one-time upgrade or overspend", () => {
  const room = new Room("TEST", { initialBalance: 50,
    upgradePrices: { shelf: 30, machine: 30 } });
  const a = room.join(), b = room.join();
  const bought = room.purchase(a.id, { upgrade: "shelf", requestId: "a1" });
  assert.equal(bought.balance, 20);
  assert.equal(bought.revision, 1);
  assert.throws(() => room.purchase(b.id, { upgrade: "shelf", requestId: "b1" }), /ALREADY_PURCHASED/);
  assert.throws(() => room.purchase(b.id, { upgrade: "machine", requestId: "b2" }), /INSUFFICIENT_FUNDS/);
  assert.deepEqual(room.snapshot().economy.purchasedUpgrades, ["shelf"]);
  assert.equal(room.snapshot().economy.balance, 20);
});

test("retry returns receipt without double charge, request ID cannot change meaning", () => {
  const room = new Room("TEST", { initialBalance: 100,
    upgradePrices: { shelf: 20, machine: 10 } });
  const p = room.join();
  const req = { upgrade: "shelf", requestId: "req-1" };
  assert.equal(room.purchase(p.id, req).duplicate, false);
  assert.equal(room.purchase(p.id, req).duplicate, true);
  assert.throws(() => room.purchase(p.id, { ...req, upgrade: "machine" }), /REQUEST_ID_REUSED/);
  assert.equal(room.snapshot().economy.revision, 1);
  assert.equal(room.snapshot().economy.balance, 80);
});

test("new players see same economy, disconnect does not refund upgrades", () => {
  const room = new Room("TEST", { initialBalance: 20, upgradePrices: { shelf: 20 } });
  const a = room.join();
  room.purchase(a.id, { upgrade: "shelf", requestId: "a1" });
  const b = room.join();
  assert.deepEqual(room.snapshot().economy, {
    revision: 1, balance: 0, upgradePrices: { shelf: 20 },
    purchasedUpgrades: ["shelf"],
  });
  room.leave(a.id);
  assert.equal(room.snapshot().economy.balance, 0);
  assert.throws(() => room.purchase(a.id, { upgrade: "shelf", requestId: "a1" }), /PLAYER_NOT_FOUND/);
  assert.throws(() => room.purchase(b.id, { upgrade: "shelf", requestId: "b1" }), /ALREADY_PURCHASED/);
});

test("untrusted input cannot invent upgrades, prices, balances or invalid identifiers", () => {
  assert.throws(() => new Economy({ initialBalance: -1 }), /INVALID_INITIAL_BALANCE/);
  assert.throws(() => new Economy({ initialBalance: 1.5 }), /INVALID_INITIAL_BALANCE/);
  assert.throws(() => new Economy({ initialBalance: 1_000_000_001 }), /INVALID_INITIAL_BALANCE/);
  assert.throws(() => new Economy({ upgradePrices: { shelf: -1 } }), /INVALID_UPGRADE_PRICES/);
  assert.throws(() => new Economy({ upgradePrices: JSON.parse('{"__proto__":1}') }), /INVALID_UPGRADE_PRICES/);
  assert.throws(() => new Economy({ upgradePrices: { shelf: 0 } }), /INVALID_UPGRADE_PRICES/);
  const room = new Room("TEST", { initialBalance: 10, upgradePrices: { shelf: 10 } });
  const p = room.join();
  assert.throws(() => room.purchase(p.id, { upgrade: "fake", requestId: "1", price: 0 }), /UNKNOWN_UPGRADE/);
  assert.throws(() => room.purchase(p.id, { upgrade: "shelf", requestId: "" }), /INVALID_REQUEST_ID/);
  assert.equal(room.purchase(p.id, { upgrade: "shelf", requestId: "1", price: 0, balance: 1000 }).balance, 0);
  assert.equal(room.snapshot().economy.balance, 0);
});

test("receipt history remains replay-safe after many joins and failed attempts", () => {
  const prices = Object.fromEntries(Array.from({ length: 64 }, (_, i) => ["u" + i, 1]));
  const room = new Room("TEST", { initialBalance: 64, upgradePrices: prices });
  const p = room.join();
  for (let i = 0; i < 64; i++) {
    assert.equal(room.purchase(p.id, { upgrade: "u" + i, requestId: "req-" + i }).duplicate, false);
  }
  assert.equal(room.purchase(p.id, { upgrade: "u0", requestId: "req-0" }).duplicate, true);
  assert.equal(room.snapshot().economy.balance, 0);
  assert.equal(room.snapshot().economy.revision, 64);
});
