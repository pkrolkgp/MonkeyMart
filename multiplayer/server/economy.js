"use strict";
// Independent, asset-free authoritative wallet and one-time upgrades.
// Prices and starting funds come only from trusted server configuration.
const KEY_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const REQUEST_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BALANCE = 1_000_000_000;
const MAX_UPGRADES = 64;

function validKey(key) {
  return typeof key === "string" && KEY_RE.test(key) &&
    !Object.prototype.hasOwnProperty.call(Object.prototype, key) &&
    key !== "prototype";
}
function validBalance(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_BALANCE;
}
function normalizePrices(prices) {
  if (!prices || typeof prices !== "object" || Array.isArray(prices)) {
    throw new Error("INVALID_UPGRADE_PRICES");
  }
  const entries = Object.entries(prices);
  if (entries.length > MAX_UPGRADES ||
      entries.some(([key, price]) => !validKey(key) ||
        !Number.isSafeInteger(price) || price < 1 || price > MAX_BALANCE)) {
    throw new Error("INVALID_UPGRADE_PRICES");
  }
  return new Map(entries);
}

class Economy {
  constructor({ initialBalance = 0, upgradePrices = {} } = {}) {
    if (!validBalance(initialBalance)) throw new Error("INVALID_INITIAL_BALANCE");
    this.balance = initialBalance;
    this.prices = normalizePrices(upgradePrices);
    this.purchased = new Set();
    this.receipts = new Map();
    this.revision = 0;
  }
  addPlayer(id) {
    if (this.receipts.has(id)) throw new Error("PLAYER_EXISTS");
    this.receipts.set(id, new Map());
  }
  removePlayer(id) { this.receipts.delete(id); }
  snapshot() {
    return {
      revision: this.revision, balance: this.balance,
      upgradePrices: Object.fromEntries(this.prices),
      purchasedUpgrades: Array.from(this.purchased).sort(),
    };
  }
  buy(id, { upgrade, requestId } = {}) {
    const receipts = this.receipts.get(id);
    if (!receipts) throw new Error("PLAYER_NOT_FOUND");
    if (!validKey(upgrade) || !this.prices.has(upgrade)) throw new Error("UNKNOWN_UPGRADE");
    if (typeof requestId !== "string" || !REQUEST_RE.test(requestId)) {
      throw new Error("INVALID_REQUEST_ID");
    }
    const previous = receipts.get(requestId);
    if (previous) {
      if (previous.upgrade !== upgrade) throw new Error("REQUEST_ID_REUSED");
      return { ...previous.result, duplicate: true };
    }
    if (this.purchased.has(upgrade)) throw new Error("ALREADY_PURCHASED");
    const price = this.prices.get(upgrade);
    if (this.balance < price) throw new Error("INSUFFICIENT_FUNDS");
    this.balance -= price;
    this.purchased.add(upgrade);
    this.revision++;
    const result = {
      playerId: id, upgrade, requestId, price,
      balance: this.balance, revision: this.revision,
    };
    // One successful purchase per catalog entry: <= MAX_UPGRADES receipts
    // per room, so successful purchase IDs never need eviction/replay risk.
    receipts.set(requestId, { upgrade, result });
    return { ...result, duplicate: false };
  }
}
module.exports = { Economy };
