"use strict";
// Shared stock and carried inventory. Trusted integration provides product names
// and starting quantities. A client cannot mint money or add stock.
const PRODUCT_RE = /^[a-zA-Z0-9_:-]{1,64}$/;
const REQUEST_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_ACTION_QUANTITY = 100;
const MAX_RECEIPTS = 128;
function validProduct(s) {
  return typeof s === "string" && PRODUCT_RE.test(s) &&
    !Object.prototype.hasOwnProperty.call(Object.prototype, s) && s !== "prototype";
}
function validQuantity(n) {
  return Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
}
function toObject(map) { return Object.fromEntries(map); }
function normalizeProducts(products) {
  if (!products || typeof products !== "object" || Array.isArray(products)) {
    throw new Error("INVALID_INITIAL_STOCK");
  }
  const entries = Object.entries(products);
  if (entries.length > 512) throw new Error("INVALID_INITIAL_STOCK");
  for (const [item, count] of entries) {
    if (!validProduct(item) || !validQuantity(count)) throw new Error("INVALID_INITIAL_STOCK");
  }
  return new Map(entries);
}
class Store {
  constructor({ initialStock = {} } = {}) {
    this.stock = normalizeProducts(initialStock);
    this.inventory = new Map();
    this.receipts = new Map();
    this.revision = 0;
  }
  addPlayer(id) {
    if (this.inventory.has(id)) throw new Error("PLAYER_EXISTS");
    this.inventory.set(id, new Map());
    this.receipts.set(id, new Map());
  }
  inventoryOf(id) {
    if (!this.inventory.has(id)) throw new Error("PLAYER_NOT_FOUND");
    return toObject(this.inventory.get(id));
  }
  snapshot() { return { revision: this.revision, stock: toObject(this.stock) }; }
  transfer(id, { action, item, quantity, requestId }) {
    const bag = this.inventory.get(id);
    if (!bag) throw new Error("PLAYER_NOT_FOUND");
    if (action !== "collect" && action !== "drop") throw new Error("INVALID_ACTION");
    if (!validProduct(item) || !this.stock.has(item)) throw new Error("UNKNOWN_PRODUCT");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_ACTION_QUANTITY) {
      throw new Error("INVALID_QUANTITY");
    }
    if (typeof requestId !== "string" || !REQUEST_RE.test(requestId)) {
      throw new Error("INVALID_REQUEST_ID");
    }
    const records = this.receipts.get(id);
    const signature = JSON.stringify([action, item, quantity]);
    const previous = records.get(requestId);
    if (previous) {
      if (previous.signature !== signature) throw new Error("REQUEST_ID_REUSED");
      return { ...previous.result, duplicate: true };
    }
    const available = this.stock.get(item);
    const held = bag.get(item) || 0;
    if (action === "collect" && available < quantity) throw new Error("OUT_OF_STOCK");
    if (action === "drop" && held < quantity) throw new Error("INSUFFICIENT_INVENTORY");
    const nextStock = action === "collect" ? available - quantity : available + quantity;
    const nextBag = action === "collect" ? held + quantity : held - quantity;
    if (!validQuantity(nextStock) || !validQuantity(nextBag)) throw new Error("CAPACITY_EXCEEDED");
    this.stock.set(item, nextStock);
    if (nextBag === 0) bag.delete(item);
    else bag.set(item, nextBag);
    this.revision++;
    const result = {
      playerId: id, action, item, quantity, requestId, revision: this.revision,
      stock: nextStock, inventory: nextBag,
    };
    records.set(requestId, { signature, result });
    if (records.size > MAX_RECEIPTS) records.delete(records.keys().next().value);
    return { ...result, duplicate: false };
  }
  removePlayer(id) {
    const bag = this.inventory.get(id);
    if (!bag) return false;
    if (bag.size) {
      for (const [item, quantity] of bag) {
        if (!validQuantity(this.stock.get(item) + quantity)) throw new Error("CAPACITY_EXCEEDED");
      }
      for (const [item, quantity] of bag) this.stock.set(item, this.stock.get(item) + quantity);
      this.revision++;
    }
    this.inventory.delete(id);
    this.receipts.delete(id);
    return bag.size > 0;
  }
}
module.exports = { Store };
