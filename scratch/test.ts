import { WorldServer } from '../src/lib/world-server';
const world = new WorldServer();
const { snapshot, token } = world.join('test', 'test', Date.now());
console.log('Initial NPC 0:', snapshot.npcs?.[0]);
console.log('Initial Vehicle 4:', snapshot.vehicles[4]);
world.update('test', token, { forward: 0, turn: 0, brake: false }, false, Date.now() + 100);
const snap2 = world.rooms.get('test') ? world.snapshot(world.rooms.get('test')!, snapshot.self) : null;
console.log('After 100ms NPC 0:', snap2?.npcs?.[0]);
console.log('After 100ms Vehicle 4:', snap2?.vehicles[4]);
