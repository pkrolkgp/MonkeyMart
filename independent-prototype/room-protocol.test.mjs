import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSuccessor, mergeRoomListings, acceptSnapshot } from './room-protocol.mjs';
test('successor is deterministic and excludes disconnected or incapable peers', () => {
 const peers=[{id:'c',connected:true,canHost:true},{id:'a',connected:true,canHost:true},{id:'b',connected:false,canHost:true},{id:'z',connected:true,canHost:false}];
 assert.equal(chooseSuccessor(peers,'a'),'c');
 assert.equal(chooseSuccessor([...peers].reverse(),'a'),'a');
 assert.equal(chooseSuccessor([{id:'a',connected:true,canHost:true}],'a'),null);
});
test('directory and LAN listings merge by room id with both sources visible',()=>{
 const rooms=mergeRoomListings([{id:'room-1',name:'Local',host:'lan'}],[{id:'room-1',name:'Public',host:'internet'},{id:'room-2',name:'Other'}]);
 assert.equal(rooms.length,2);assert.deepEqual(rooms.find(r=>r.id==='room-1').sources,['internet','lan']);
 assert.equal(rooms.find(r=>r.id==='room-1').host,'lan');
});
test('stale and foreign host snapshots rejected; higher epochs require validation',()=>{
 const old={epoch:2,revision:8,hostId:'a'};
 assert.equal(acceptSnapshot(old,{epoch:2,revision:9,hostId:'a'}),true);
 assert.equal(acceptSnapshot(old,{epoch:2,revision:8,hostId:'a'}),false);
 assert.equal(acceptSnapshot(old,{epoch:2,revision:9,hostId:'b'}),false);
 assert.equal(acceptSnapshot(old,{epoch:3,revision:0,hostId:'b'}),false);
});
