import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoom } from './server.mjs';

test('two players max and slots reusable', () => {
 const r=makeRoom(), a=r.join(), b=r.join();
 assert.ok(a); assert.ok(b); assert.equal(r.join(),null);
 r.leave(a); assert.ok(r.join());
});
test('server owns inventory and money; checkout requires stock and customer', () => {
 const r=makeRoom(), id=r.join(), p=r.players.get(id);
 p.x=100;p.y=100;r.act(id);assert.equal(p.carry,1);
 p.x=400;p.y=100;r.act(id);assert.equal(p.carry,0);assert.equal(r.state.stock,1);
 p.x=690;p.y=100;r.act(id);assert.equal(r.state.coins,0);
 r.spawn();r.act(id);assert.equal(r.state.coins,5);assert.equal(r.state.stock,0);assert.equal(r.state.served,1);
 r.act(id);assert.equal(r.state.coins,5);
});
test('movement is clamped and snapshot is a detached copy', () => {
 const r=makeRoom(),id=r.join();r.move(id,99999,-99999,100);
 const p=r.players.get(id);assert.ok(p.x<=786&&p.y>=14);
 const snap=r.snapshot();snap.players[0].carry=100;assert.equal(p.carry,0);
});
