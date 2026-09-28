import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ethera-tests-'));
for (const file of ['components/world', 'lib/railway', 'lib/terrain', 'lib/airport', 'lib/destinations', 'lib/traffic', 'lib/birds', 'lib/day-night', 'lib/weather', 'lib/pathfinding', 'lib/walk-motion', 'lib/world-runtime', 'lib/world-server', 'app/api/world/route']) {
  const destination = path.join(temp, `${file}.js`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const source = fs.readFileSync(path.join(__dirname, '../src', `${file}.ts`), 'utf8').replace("'@/lib/world-runtime'", "'../../../lib/world-runtime'");
  fs.writeFileSync(destination, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { default: { WorldServer } } = await import(pathToFileURL(path.join(temp, 'lib/world-server.js')).href);
const { default: { POST } } = await import(pathToFileURL(path.join(temp, 'app/api/world/route.js')).href);
after(() => fs.rmSync(temp, { recursive: true, force: true }));
const idle = { forward: 0, turn: 0, brake: true };

test('two clients see movement, names, and isolated rooms without exposing tokens', () => {
  const world = new WorldServer();
  const a = world.join('crew', 'Alice', 1000), b = world.join('crew', 'Bob', 1000);
  world.join('other', 'Carol', 1000);
  world.update('crew', a.token, { forward: 1, turn: 0, brake: false }, false, 1000);
  const snapshot = world.update('crew', b.token, idle, false, 1200);
  assert.equal(snapshot.players.length, 2);
  const alice = snapshot.players.find(p => p.name === 'Alice');
  assert.ok(alice.z < -0.5 && alice.z > -1, 'walking accelerates smoothly toward full speed');
  assert.ok(!JSON.stringify(snapshot).includes(a.token));
  assert.equal(world.update('other', a.token, idle, false, 1200), null);
});

test('driver ownership is exclusive, passengers synchronize, and leaving transfers ownership', () => {
  const world = new WorldServer();
  const a = world.join('crew', 'Alice', 1000), b = world.join('crew', 'Bob', 1000);
  const room = world.rooms.get('crew');
  for (const m of room.players.values()) { m.person.x = 2; m.person.z = -1; }
  world.update('crew', a.token, idle, true, 1000);
  let snapshot = world.update('crew', b.token, idle, true, 1000);
  assert.equal(snapshot.vehicles[1].owner, a.snapshot.self);
  assert.equal(snapshot.players.find(p => p.id === b.snapshot.self).vehicle, 1);
  world.update('crew', a.token, { forward: 1, turn: 0, brake: false }, false, 1000);
  snapshot = world.update('crew', b.token, idle, false, 1200);
  assert.ok(snapshot.vehicles[1].z < -3);
  assert.equal(snapshot.players.find(p => p.id === a.snapshot.self).z, snapshot.vehicles[1].z);
  world.leave('crew', a.token);
  snapshot = world.update('crew', b.token, idle, false, 1200);
  assert.equal(snapshot.vehicles[1].owner, b.snapshot.self);
  assert.equal(snapshot.vehicles[1].speed, 0);
});

test('braking enables a safe exit and disconnects release occupied vehicles', () => {
  const world = new WorldServer();
  const a = world.join('crew', 'Alice', 1000), b = world.join('crew', 'Bob', 1000);
  const room = world.rooms.get('crew');
  room.players.get(a.token).person.x = 2; room.players.get(a.token).person.z = -1;
  world.update('crew', a.token, idle, true, 1000);
  room.vehicles[1].speed = 5;
  let snapshot = world.update('crew', a.token, idle, true, 1000);
  assert.equal(snapshot.players[0].vehicle, 1);
  assert.match(snapshot.players[0].message, /Brake/);
  room.vehicles[1].speed = 0;
  snapshot = world.update('crew', a.token, idle, true, 1000);
  assert.equal(snapshot.players[0].vehicle, null);
  assert.equal(snapshot.vehicles[1].owner, null);
  world.update('crew', a.token, idle, true, 1000);
  world.update('crew', b.token, idle, false, 14000);
  snapshot = world.update('crew', b.token, idle, false, 17000);
  assert.equal(snapshot.players.length, 1);
  assert.equal(snapshot.vehicles[1].owner, null);
});

test('stale controls stop movement and room capacity is enforced', () => {
  const world = new WorldServer();
  const a = world.join('crew', 'Alice', 1000), b = world.join('crew', 'Bob', 1000);
  world.update('crew', a.token, { forward: 1, turn: 0, brake: false }, false, 1000);
  const snapshot = world.update('crew', b.token, idle, false, 2000);
  assert.equal(snapshot.players[0].z, 0);
  for (let i = 0; i < 10; i++) world.join('crew', 'Guest', 2000);
  assert.throws(() => world.join('crew', 'Extra', 2000), /full/);
});

test('route validates input and authenticates two independent client sessions', async (t) => {
  let accountId = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id: ++accountId, name: `Player ${accountId}`, score: 23 }));
  const send = body => POST(new Request('http://localhost/api/world', { method: 'POST', headers: { origin: 'http://localhost' }, body: JSON.stringify(body) }));
  assert.equal((await send({ action: 'join', room: '../bad' })).status, 400);
  const a = await (await send({ action: 'join', room: 'test', name: 'Alice', authToken: 'test-auth' })).json();
  const b = await (await send({ action: 'join', room: 'test', name: 'Bob', authToken: 'test-auth' })).json();
  assert.notEqual(a.token, b.token);
  const snapshot = await (await send({ action: 'update', room: 'test', token: b.token, input: idle, interact: false })).json();
  assert.equal(snapshot.players.length, 2);
  assert.equal((await send({ action: 'update', room: 'test', token: a.token, input: { ...idle, forward: 99 }, interact: false })).status, 400);
  assert.equal((await send({ action: 'update', room: 'test', token: a.token, input: { ...idle, targetPoint: { x: 'bad', z: 0 } }, interact: false })).status, 400);
  assert.equal((await send({ action: 'update', room: 'test', token: 'fake', input: idle, interact: false })).status, 401);
  assert.equal((await POST(new Request('http://localhost/api/world', { method: 'POST', headers: { origin: 'http://evil.test' }, body: '{}' }))).status, 400);
});

test('new street obstacles block movement while spawns and the main road remain clear', async () => {
  const { default: { streetProps, hitsScenery, vehicleSpawns } } = await import(pathToFileURL(path.join(temp, 'components/world.js')).href);
  const collisionWorld = new WorldServer();
  collisionWorld.join('collision', 'Tester', 1000);
  const collisionRoom = collisionWorld.rooms.get('collision');
  for (const prop of streetProps) {
    assert.ok(hitsScenery(prop.x, prop.z, 0.4), `${prop.kind} must block players`);
    assert.ok(collisionWorld.blocked(collisionRoom, prop.x, prop.z, 1.9), `${prop.kind} must block cars`);
  }
  for (const vehicle of vehicleSpawns) assert.equal(hitsScenery(vehicle.x, vehicle.z, vehicle.kind === 'car' ? 1.9 : 1), false);
  for (let z = -40; z < 40; z += 2) assert.equal(hitsScenery(0, z, 1.9), false, `main road at ${z}`);
  // Rotated bus: its long axis follows the horizontal road.
  assert.ok(hitsScenery(26.5, -1.8, 0.4));
  assert.equal(hitsScenery(23, 1, 0.4), false);
});

test('seats are exclusive, freeze walking, and become available after standing or disconnecting', async () => {
  const { default: { seats } } = await import(pathToFileURL(path.join(temp, 'components/world.js')).href);
  const world = new WorldServer();
  const a = world.join('seats', 'Alice', 1000), b = world.join('seats', 'Bob', 1000);
  const room = world.rooms.get('seats');
  const seat = seats[0];
  for (const member of room.players.values()) { member.person.x = seat.x + 1; member.person.z = seat.z; }
  world.update('seats', a.token, idle, true, 1000);
  let snapshot = world.update('seats', b.token, idle, true, 1000);
  assert.equal(snapshot.players[0].seat, 0);
  assert.equal(snapshot.players[1].seat, null);
  assert.match(snapshot.players[1].message, /already sitting/);
  world.update('seats', a.token, { forward: 1, turn: 1, brake: false }, false, 1000);
  snapshot = world.update('seats', b.token, idle, false, 1200);
  assert.equal(snapshot.players[0].x, seat.x);
  assert.equal(snapshot.players[0].z, seat.z);
  snapshot = world.update('seats', a.token, idle, true, 1200);
  assert.equal(snapshot.players[0].seat, null);
  assert.equal(world.blocked(room, snapshot.players[0].x, snapshot.players[0].z, 0.4), false);
  world.update('seats', b.token, idle, true, 1200);
  world.leave('seats', b.token);
  room.players.get(a.token).person.x = seat.x + 1; room.players.get(a.token).person.z = seat.z;
  snapshot = world.update('seats', a.token, idle, true, 1200);
  assert.equal(snapshot.players[0].seat, 0);
});

test('players can enter the same home, walk inside, and leave only through its exit', async () => {
  const { default: { buildings, blockedInside } } = await import(pathToFileURL(path.join(temp, 'components/world.js')).href);
  const world = new WorldServer();
  const a = world.join('homes', 'Alice', 1000), b = world.join('homes', 'Bob', 1000);
  const room = world.rooms.get('homes'), home = buildings[0];
  for (const m of room.players.values()) { m.person.x = home.x; m.person.z = home.z; m.person.score = home.cost; }
  world.update('homes', a.token, idle, true, 1000);
  let snapshot = world.update('homes', b.token, idle, true, 1000);
  assert.ok(snapshot.players.every(p => p.interior === home.id));
  world.update('homes', a.token, { forward: 1, turn: 0, brake: false }, false, 1000);
  snapshot = world.update('homes', b.token, idle, false, 1200);
  assert.ok(snapshot.players[0].z < 2.3);
  assert.equal(blockedInside(snapshot.players[0].x, snapshot.players[0].z), false);
  room.players.get(a.token).person.z = -1;
  snapshot = world.update('homes', a.token, idle, true, 1200);
  assert.equal(snapshot.players[0].interior, home.id);
  assert.match(snapshot.players[0].message, /EXIT/);
  room.players.get(a.token).person.z = 2.3;
  snapshot = world.update('homes', a.token, idle, true, 1200);
  assert.equal(snapshot.players[0].interior, null);
  assert.equal(snapshot.players[0].x, home.x);
  assert.equal(snapshot.players[0].z, home.z);
  assert.equal(snapshot.players[1].interior, home.id);
  assert.ok(blockedInside(4, 0));
  assert.ok(blockedInside(-2.5, -1.7));
});

test('every building entrance is accessible and hotel entry is supported', async () => {
  const { default: { buildings, hitsScenery } } = await import(pathToFileURL(path.join(temp, 'components/world.js')).href);
  const world = new WorldServer();
  const a = world.join('hotel', 'Alice', 1000), room = world.rooms.get('hotel');
  for (const building of buildings) assert.equal(hitsScenery(building.x, building.z, 0.4), false, building.id);
  const hotel = buildings.find(b => b.id === 'hotel');
  const p = room.players.get(a.token).person; p.x = hotel.x; p.z = hotel.z; p.score = hotel.cost;
  const snapshot = world.update('hotel', a.token, idle, true, 1000);
  assert.equal(snapshot.players[0].interior, 'hotel');
});

test('late and duplicate updates cannot overwrite controls or repeat an interaction', () => {
  const world = new WorldServer();
  const a = world.join('ordered', 'Alice', 1000);
  const room = world.rooms.get('ordered');
  const p = room.players.get(a.token).person;
  p.x = 2; p.z = -1;
  world.update('ordered', a.token, idle, true, 1000, 2);
  assert.equal(p.vehicle, 1);
  world.update('ordered', a.token, idle, true, 1001, 2);
  assert.equal(p.vehicle, 1, 'duplicate interaction must not exit');
  world.update('ordered', a.token, { forward: 1, turn: 0, brake: false }, false, 1002, 4);
  world.update('ordered', a.token, idle, true, 1003, 3);
  assert.equal(room.players.get(a.token).input.forward, 1);
  assert.equal(p.vehicle, 1);
});

test('a replacement player gets a clear spawn after another player leaves', () => {
  const world = new WorldServer();
  const a = world.join('spawn', 'Alice', 1000);
  world.join('spawn', 'Bob', 1000);
  const c = world.join('spawn', 'Carol', 1000);
  world.leave('spawn', a.token);
  const d = world.join('spawn', 'Dana', 1000);
  const carol = d.snapshot.players.find(p => p.id === c.snapshot.self);
  const dana = d.snapshot.players.find(p => p.id === d.snapshot.self);
  assert.ok(Math.hypot(carol.x - dana.x, carol.z - dana.z) >= 0.8);
  assert.equal(world.blocked(world.rooms.get('spawn'), dana.x, dana.z, 0.4), false);
});

test('coins spawn in clear space, award points, and respawn for all clients', () => {
  const world = new WorldServer();
  const a = world.join('coins', 'Alice', 1000);
  const b = world.join('coins', 'Bob', 1000);
  const room = world.rooms.get('coins');
  assert.equal(a.snapshot.coins.length, 225);
  assert.ok(a.snapshot.coins.every(c => Math.hypot(c.x, c.z) >= 3));
  for (const coin of room.coins) assert.equal(world.blocked(room, coin.x, coin.z, 0.6), false);
  for (const c of room.coins) assert.ok(Number.isInteger(c.value) && c.value >= 1 && c.value <= 10);
  const coin = room.coins[0];
  const person = room.players.get(a.token).person;
  person.x = coin.x; person.z = coin.z;
  person.interior = 'home-0';
  world.update('coins', a.token, idle, false, 1000);
  assert.equal(person.score, 0);
  person.interior = null;
  const collected = world.update('coins', a.token, idle, false, 1000);
  assert.equal(person.score, coin.value);
  assert.equal(collected.coins.length, room.populationCells.size * 25);
  for (const c of collected.coins) assert.ok(Number.isInteger(c.value) && c.value >= 1 && c.value <= 10);
  assert.ok(!collected.coins.some(c => c.id === coin.id));
  assert.ok(a.snapshot.coins.some(c => c.id === coin.id), 'previous snapshots stay unchanged');
  const other = world.update('coins', b.token, idle, false, 1000);
  assert.deepEqual(other.coins, collected.coins);
  assert.equal(other.players.find(p => p.id === a.snapshot.self).score, coin.value);
  for (const c of other.coins) assert.equal(world.blocked(room, c.x, c.z, 0.6), false);
  room.coins = [];
  assert.equal(world.update('coins', a.token, idle, false, 1000).coins.length, room.populationCells.size * 25);
});


test('authenticated coin awards are queued once and restore the saved score', () => {
  const world = new WorldServer();
  const a = world.join('saved', 'Alice', 1000, { id: 42, score: 100 });
  assert.equal(a.snapshot.players[0].score, 100);
  const room = world.rooms.get('saved');
  const coin = room.coins[0];
  const player = room.players.get(a.token).person;
  player.x = coin.x; player.z = coin.z;
  world.update('saved', a.token, idle, false, 1000, 1);
  world.update('saved', a.token, idle, false, 1000, 1);
  assert.equal(player.score, 100 + coin.value);
  assert.deepEqual([...world.pendingAwards.values()], [{ id: coin.id, user_id: 42, value: coin.value }]);
});


test('indexed collision matches full scans at cell boundaries and throughout the city', async () => {
  const { default: w } = await import(pathToFileURL(path.join(temp, 'components/world.js')).href);
  const { default: { hitsRailwaySupport } } = await import(pathToFileURL(path.join(temp, 'lib/railway.js')).href);
  const { default: { hitsAirport } } = await import(pathToFileURL(path.join(temp, 'lib/airport.js')).href);
  const brute = (x, z, radius) => hitsAirport(x, z, radius) || hitsRailwaySupport(x, z, radius) || Math.abs(x + 30) < 3.8 + radius && Math.abs(z - 28) < 8 + radius
    || w.streetProps.some(p => {
      const dx = x - p.x, dz = z - p.z;
      return Math.hypot(Math.max(Math.abs(Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz) - p.width / 2, 0), Math.max(Math.abs(Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) - p.depth / 2, 0)) <= radius;
    }) || w.houses.some(h => Math.abs(x - h.x) < (h.type === 'hospital' ? 6 : h.type === 'playground' ? 7 : 3.5) + radius && Math.abs(z - h.z) < (h.type === 'hospital' ? 6 : h.type === 'playground' ? 7 : 3) + radius)
    || w.trees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.35 + radius);
  let seed = 42;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 600; i++) {
    const x = i < 100 ? (i - 50) * 40 : random() * 2100 - 1050;
    const z = random() * 2100 - 1050;
    const radius = [0.4, 0.75, 1.05, 1.9][i % 4];
    assert.equal(w.hitsScenery(x, z, radius), brute(x, z, radius), `${x},${z},${radius}`);
  }
});


test('distant neighborhoods have coins, walking pedestrians, and moving traffic', () => {
  const world = new WorldServer();
  const a = world.join('explore', 'Explorer', 1000);
  const room = world.rooms.get('explore');
  const person = room.players.get(a.token).person;
  for (const [x, z] of [[850, 850], [-850, -850], [4200, -4200], [4980, 4980]]) {
    person.x = x; person.z = z;
    const snapshot = world.update('explore', a.token, idle, false, 1000);
    const nearby = p => Math.abs(p.x - x) <= 200 && Math.abs(p.z - z) <= 200;
    assert.ok(snapshot.coins.some(nearby), `coins near ${x},${z}`);
    assert.ok(snapshot.npcs.some(nearby), `pedestrians near ${x},${z}`);
    assert.ok(snapshot.vehicles.some(v => v.autopilot && nearby(v)), `traffic near ${x},${z}`);
    const npc = room.npcs.find(n => nearby(n.person) && n.wait === 0);
    const vehicleIndex = room.vehicles.findIndex(v => v.autopilot && nearby(v));
    const vehicle = room.vehicles[vehicleIndex];
    const beforeNpc = { ...npc.person }, beforeVehicle = { ...vehicle };
    world.advanceNpcs(room, 0.1);
    world.steerTraffic(room, vehicle, vehicleIndex, 0.1);
    assert.ok(Math.hypot(npc.person.x - beforeNpc.x, npc.person.z - beforeNpc.z) > 0);
    assert.ok(Math.hypot(vehicle.x - beforeVehicle.x, vehicle.z - beforeVehicle.z) > 0);
    assert.ok(Math.hypot(vehicle.x - beforeVehicle.x, vehicle.z - beforeVehicle.z) <= 0.41, 'traffic never teleports');
  }
});

test('separated players keep their populations and abandoned traffic slots are reused', () => {
  const world = new WorldServer();
  const a = world.join('spread', 'Alice', 1000), b = world.join('spread', 'Bob', 1000);
  const room = world.rooms.get('spread');
  const alice = room.players.get(a.token).person, bob = room.players.get(b.token).person;
  alice.x = 850; alice.z = 850;
  bob.x = -850; bob.z = -850;
  world.update('spread', a.token, idle, false, 1000);
  for (const person of [alice, bob]) {
    assert.ok(room.coins.some(c => Math.hypot(c.x - person.x, c.z - person.z) < 160));
    assert.ok(room.npcs.some(n => Math.hypot(n.person.x - person.x, n.person.z - person.z) < 160));
    assert.ok(room.vehicles.some(v => v.autopilot && Math.hypot(v.x - person.x, v.z - person.z) < 160));
  }
  const npcIds = room.npcs.map(n => n.person.id);
  world.update('spread', b.token, idle, false, 1000);
  assert.deepEqual(room.npcs.map(n => n.person.id), npcIds, 'updates do not duplicate populations');
  const capturedIndex = room.vehicles.findIndex(v => v.autopilot && Math.hypot(v.x - alice.x, v.z - alice.z) < 160);
  const captured = room.vehicles[capturedIndex];
  captured.owner = alice.id; captured.autopilot = false; alice.vehicle = capturedIndex;
  captured.x = alice.x = 2450; captured.z = alice.z = 2450;
  world.update('spread', a.token, idle, false, 1000);
  assert.equal(room.vehicles[capturedIndex], captured, 'occupied indices are preserved');
  const capacity = room.vehicles.length;
  for (let i = 0; i < 5; i++) {
    captured.x = alice.x = 2450 + i * 400;
    world.update('spread', a.token, idle, false, 1000);
  }
  assert.ok(room.vehicles.length <= capacity + 4, 'travel reuses slots rather than growing forever');
  assert.ok(room.npcs.length <= room.populationCells.size * 4);
});


test('rail services dwell, move smoothly, reverse, and stay between their platforms', async () => {
  const { default: rail } = await import(pathToFileURL(path.join(temp, 'lib/railway.js')).href);
  for (let i = 0; i < rail.railwayStations.length - 1; i++) {
    const phaseStart = -i * 7;
    const start = rail.getTrainState(i, phaseStart);
    assert.equal(start.stopped, true);
    assert.equal(rail.getTrainState(i, phaseStart + 7).x, start.x);
    const end = rail.getTrainState(i, phaseStart + 48);
    assert.ok(end.x > start.x);
    assert.equal(end.stopped, true);
    assert.equal(end.yaw, Math.PI);
    assert.equal(rail.getTrainState(i, phaseStart + 96).x, start.x);
    let previous = start.x;
    for (let time = 0.1; time <= 96; time += 0.1) {
      const current = rail.getTrainState(i, phaseStart + time);
      assert.ok(current.x >= start.x - 1e-8 && current.x <= end.x + 1e-8);
      assert.ok(Math.abs(current.x - previous) < 1.4, 'no position jumps');
      previous = current.x;
    }
  }
  assert.equal(rail.hitsRailwaySupport(6, 6, 0.4), true);
  assert.equal(rail.hitsRailwaySupport(0, 0, 1.9), false, 'road remains clear');
});

test('rail camera frames the whole train on desktop and portrait mobile', async () => {
  const { PerspectiveCamera, Vector3 } = await import('three');
  const { default: rail } = await import(pathToFileURL(path.join(temp, 'lib/railway.js')).href);
  for (const aspect of [16 / 9, 1, 9 / 16, 0.4]) {
    const pose = rail.getRailCameraPose(240, aspect);
    const camera = new PerspectiveCamera(50, aspect, 0.5, 600);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    for (const x of [226, 254]) for (const y of [rail.RAIL_HEIGHT + 0.4, rail.RAIL_HEIGHT + 3.6]) for (const z of [-1.4, 1.4]) {
      const projected = new Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95 && projected.z > -1 && projected.z < 1, `train must fit at aspect ${aspect}`);
    }
  }
  for (const x of [-5000, 0, 5000]) {
    const index = rail.nearestTrainIndex(x, 1234);
    const distance = Math.abs(rail.getTrainState(index, 1234).x - x);
    assert.ok(rail.railwayStations.slice(0, -1).every((_, i) => Math.abs(rail.getTrainState(i, 1234).x - x) >= distance));
  }
});


test('bird flocks populate distant places and retain stable flight paths across streaming boundaries', async () => {
  const { default: birds } = await import(pathToFileURL(path.join(temp, 'lib/birds.js')).href);
  for (const [x, z] of [[0, 0], [850, -850], [-4200, 4200]]) {
    const flocks = birds.getNearbyFlocks(x, z);
    assert.equal(flocks.length, 9);
    assert.equal(new Set(flocks.map(f => f.id)).size, 9);
    assert.ok(flocks.some(f => Math.hypot(f.x - x, f.z - z) < 57));

  }
  const before = birds.getNearbyFlocks(39, 0), after = birds.getNearbyFlocks(41, 0);
  assert.equal(before.filter(f => after.some(next => f.id === next.id && next.x === f.x && next.z === f.z)).length, 6);
});


test('birds land on roofs and roads, fold their wings, and take off without position jumps', async () => {
  const { default: birds } = await import(pathToFileURL(path.join(temp, 'lib/birds.js')).href);
  const road = { x: 0, y: -0.07, z: 0, kind: 'road' };
  const roof = { x: 13, y: 5.49, z: -12, kind: 'roof' };
  for (const crow of [true, false]) {
    const offset = crow ? 0 : 23;
    const pose = t => birds.getBirdBehavior(road, roof, crow, t - offset);
    for (const time of [0, 3, 6, 59, 63]) {
      const resting = pose(time);
      assert.equal(resting.resting, true);
      assert.equal(resting.y, road.y);
      assert.equal(resting.wings, 0);
    }
    for (const time of [27, 30, 35]) {
      const resting = pose(time);
      assert.equal(resting.resting, true);
      assert.equal(resting.x, roof.x);
      assert.equal(resting.y, roof.y);
      assert.equal(resting.z, roof.z);
      assert.equal(resting.flap, 0);
    }
    assert.ok(pose(10).y > road.y && pose(10).wings > 0);
    assert.ok(pose(38).y > roof.y && pose(38).wings > 0);
    for (const time of [7, 12, 22, 26, 36, 40, 52, 58, 64]) {
      const before = pose(time - 0.001), after = pose(time + 0.001);
      assert.ok(Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z) < 0.01, `continuous landing/takeoff at ${time}`);
      assert.ok(Math.abs(before.wings - after.wings) < 0.01);
    }
    assert.ok(pose(16).y > roof.y, 'crosses above the roof before descending');
  }
});


test('players climb fixed mountains, share elevation, and return smoothly to ground level', async () => {
  const { default: terrain } = await import(pathToFileURL(path.join(temp, 'lib/terrain.js')).href);
  const { Raycaster, Vector3, Mesh, ConeGeometry } = await import('three');
  for (const mountain of terrain.mountains) {
    const mesh = new Mesh(new ConeGeometry(mountain.radius, mountain.height, 4));
    mesh.position.set(mountain.x, mountain.height / 2 - 0.5, mountain.z);
    mesh.updateMatrixWorld();
    for (const [dx, dz] of [[0, 0], [12, -8], [-20, 10]]) {
      const x = mountain.x + dx, z = mountain.z + dz;
      const hit = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObject(mesh)[0];
      assert.ok(hit);
      assert.ok(Math.abs(hit.point.y - (terrain.getTerrainHeight(x, z) - 0.5)) < 0.001, 'rendered surface matches walking height');
    }
    mesh.geometry.dispose(); mesh.material.dispose();
  }
  const world = new WorldServer();
  const a = world.join('hiking', 'Climber', 1000), b = world.join('hiking', 'Friend', 1000);
  const room = world.rooms.get('hiking'), player = room.players.get(a.token).person;
  player.x = 0; player.z = -100; player.yaw = Math.PI;
  // This checks terrain at known distances; start at cruising speed.
  room.players.get(a.token).walkMotion = { speed: 5, turnSpeed: 0 };
  let now = 1000, previousHeight = 0;
  for (let step = 0; step < 100; step++) {
    now += 200;
    world.update('hiking', a.token, { forward: 1, turn: 0, brake: false }, false, now);
    const shared = world.update('hiking', b.token, idle, false, now).players.find(p => p.id === player.id);
    assert.ok(shared.y >= previousHeight - 1e-7);
    assert.ok(shared.y - previousHeight < 0.37);
    previousHeight = shared.y;
  }
  assert.ok(Math.abs(previousHeight - 36) < 0.001, 'summit is reachable');
  room.players.get(a.token).walkMotion = { speed: -5, turnSpeed: 0 };
  for (let step = 0; step < 100; step++) {
    now += 200;
    world.update('hiking', a.token, { forward: -1, turn: 0, brake: false }, false, now);
    world.update('hiking', b.token, idle, false, now);
  }
  assert.ok(terrain.getTerrainHeight(player.x, player.z) < 0.001, 'can descend to the city');
});


test('automatic cars complete road loops, wait at obstructions, and reject mountain routes', async () => {
  const { default: traffic } = await import(pathToFileURL(path.join(temp, 'lib/traffic.js')).href);
  const { default: terrain } = await import(pathToFileURL(path.join(temp, 'lib/terrain.js')).href);
  const world = new WorldServer();
  const a = world.join('roads', 'Tester', 1000), room = world.rooms.get('roads');
  const points = traffic.trafficLoop(10, 10);
  const vehicle = { kind: 'car', color: '#fff', ...points[0], yaw: 0, speed: 4, owner: null, autopilot: true };
  const index = room.vehicles.push(vehicle) - 1;
  room.trafficRoutes.set(index, { points, next: 1 });
  const visited = new Set();
  for (let step = 0; step < 500; step++) {
    const before = { ...vehicle };
    world.steerTraffic(room, vehicle, index, 0.25);
    assert.ok(traffic.isTrafficRoad(vehicle.x, vehicle.z));
    assert.equal(terrain.getTerrainHeight(vehicle.x, vehicle.z), 0);
    assert.ok(Math.hypot(vehicle.x - before.x, vehicle.z - before.z) <= 1.00001);
    visited.add(room.trafficRoutes.get(index).next);
  }
  assert.equal(visited.size, 4, 'visits every side of the loop');
  const target = points[room.trafficRoutes.get(index).next];
  const yaw = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
  const obstacle = { ...vehicle, autopilot: false, x: vehicle.x + Math.sin(yaw) * 2, z: vehicle.z + Math.cos(yaw) * 2 };
  room.vehicles.push(obstacle);
  const before = { ...vehicle };
  world.steerTraffic(room, vehicle, index, 0.25);
  assert.equal(vehicle.x, before.x); assert.equal(vehicle.z, before.z);
  assert.equal(vehicle.yaw, before.yaw); assert.equal(vehicle.speed, 0);
  room.vehicles.pop();
  world.steerTraffic(room, vehicle, index, 0.25);
  assert.ok(vehicle.speed > 0, 'resumes after the road clears');
  assert.equal(traffic.isTrafficRoad(0, -200), false, 'no driving over mountains');
  assert.equal(traffic.isTrafficRoad(12, 12), false, 'no driving over grass');
  assert.ok(a.token);
});


test('airport flights take off, land, taxi continuously, and stay separated on the runway', async () => {
  const { default: air } = await import(pathToFileURL(path.join(temp, 'lib/airport.js')).href);
  const stages = new Set();
  let previous = air.getAircraftState(0, 0);
  for (let t = 0.1; t <= air.FLIGHT_CYCLE + 0.01; t += 0.1) {
    const state = air.getAircraftState(0, t), other = air.getAircraftState(1, t);
    stages.add(state.stage);
    assert.ok(Number.isFinite(state.yaw) && Number.isFinite(state.pitch));
    assert.ok(state.y >= 1.2 - 1e-8);
    assert.ok(Math.hypot(state.x - previous.x, state.y - previous.y, state.z - previous.z) < 3, 'no jumps around the flight circuit');
    assert.ok(!(state.y < 3 && other.y < 3), 'only one aircraft occupies the runway/taxiway');
    previous = state;
  }
  for (const stage of ['Takeoff', 'Climbing', 'Flying circuit', 'Landing', 'Landing rollout', 'Taxiing']) assert.ok(stages.has(stage));
  assert.equal(air.getAircraftState(0, 70).gear, false);
  assert.equal(air.getAircraftState(0, 140).gear, true);
  const { default: world } = await import(pathToFileURL(path.join(temp, 'components/world.js')).href);
  assert.ok(world.houses.every(h => !air.inAirport(h.x, h.z, 18)));
  assert.ok(world.vehicleSpawns.every(v => !air.inAirport(v.x, v.z, 8)));
  assert.ok(air.hitsAirport(air.airport.x, air.airport.z - 70, 0.4));
  const { default: traffic } = await import(pathToFileURL(path.join(temp, 'lib/traffic.js')).href);
  assert.equal(traffic.isTrafficRoad(320, 320), false);
});

test('airport camera includes runway and terminal on desktop and portrait screens', async () => {
  const { PerspectiveCamera, Vector3 } = await import('three');
  const { default: air } = await import(pathToFileURL(path.join(temp, 'lib/airport.js')).href);
  for (const aspect of [16 / 9, 1, 9 / 16, 0.4]) {
    const pose = air.airportCamera(aspect);
    const camera = new PerspectiveCamera(50, aspect, 0.5, pose.far);
    camera.position.set(pose.x, pose.y, pose.z);
    camera.lookAt(air.airport.x, 0, air.airport.z); camera.updateMatrixWorld();
    for (const [x, z] of [[-145, 10], [145, 30], [-36, -79], [110, -80]]) {
      const p = new Vector3(air.airport.x + x, 0, air.airport.z + z).project(camera);
      assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1, `airport fits at aspect ${aspect}`);
    }
  }
});

test('existing rooms clear old ambient cars from the airport without moving occupied cars', () => {
  const world = new WorldServer();
  const session = world.join('airport-upgrade', 'Pilot', 1000);
  const room = world.rooms.get('airport-upgrade');
  const parked = { kind: 'car', color: '#fff', x: 320, z: 320, yaw: 0, speed: 0, owner: null, autopilot: false };
  const owned = { ...parked, x: 330, owner: session.snapshot.self };
  room.vehicles.push(parked, owned);
  room.players.get(session.token).person.vehicle = room.vehicles.length - 1;
  room.airportPrepared = false;
  world.advance(room, 1000);
  assert.equal(parked.x, 6000);
  assert.equal(owned.x, 330);
  assert.equal(owned.owner, session.snapshot.self);
});

test('travel moves the player to airport and station platforms with safe walking and exit', async () => {
  const world = new WorldServer();
  const a = world.join('travel', 'Alice', 1000), b = world.join('travel', 'Bob', 1000);
  const room = world.rooms.get('travel');
  let snapshot = world.update('travel', a.token, { ...idle, destination: 'airport' }, false, 1000, 1);
  let player = snapshot.players.find(p => p.id === a.snapshot.self);
  assert.equal(player.x, 320); assert.equal(player.z, 268);
  assert.equal(world.blocked(room, player.x, player.z, 0.4), false);
  snapshot = world.update('travel', a.token, { ...idle, destination: 'station-12' }, false, 1000, 2);
  player = snapshot.players.find(p => p.id === a.snapshot.self);
  assert.equal(player.station, 'station-12'); assert.equal(player.y, 13.05);
  assert.equal(player.z, 4.5);
  snapshot = world.update('travel', b.token, { ...idle, destination: 'station-12' }, false, 1000);
  const other = snapshot.players.find(p => p.id === b.snapshot.self);
  assert.ok(Math.hypot(other.x - player.x, other.z - player.z) >= 0.8);
  for (let i = 1; i <= 20; i++) {
    snapshot = world.update('travel', a.token, { forward: 1, turn: 0, brake: false }, false, 1000 + i * 200, i + 2);
    player = snapshot.players.find(p => p.id === a.snapshot.self);
    assert.ok(player.z >= 3 && player.z <= 6, 'cannot walk off the elevated platform');
    assert.equal(player.y, 13.05);
  }
  snapshot = world.update('travel', a.token, idle, true, 5000, 23);
  player = snapshot.players.find(p => p.id === a.snapshot.self);
  assert.equal(player.station, null); assert.equal(player.y, 0);
  assert.ok(player.z >= 10);
  assert.equal(world.blocked(room, player.x, player.z, 0.4), false);
  snapshot = world.update('travel', a.token, idle, true, 5000, 24);
  player = snapshot.players.find(p => p.id === a.snapshot.self);
  assert.equal(player.station, 'station-12', 'street lift gives access without the travel menu');
  const before = { ...player };
  snapshot = world.update('travel', a.token, { ...idle, destination: 'invalid' }, false, 5000, 25);
  player = snapshot.players.find(p => p.id === a.snapshot.self);
  assert.equal(player.x, before.x); assert.equal(player.z, before.z);
  assert.match(player.message, /Unknown/);
});

test('travel preserves occupied vehicles and duplicate requests cannot teleport again', () => {
  const world = new WorldServer();
  const a = world.join('travel-rules', 'Alice', 1000);
  const room = world.rooms.get('travel-rules'), member = room.players.get(a.token);
  member.person.vehicle = 1; room.vehicles[1].owner = member.person.id;
  let snapshot = world.update('travel-rules', a.token, { ...idle, destination: 'airport' }, false, 1000, 1);
  assert.equal(snapshot.players[0].vehicle, 1);
  assert.match(snapshot.players[0].message, /Exit your vehicle/);
  member.person.vehicle = null; room.vehicles[1].owner = null;
  snapshot = world.update('travel-rules', a.token, { ...idle, destination: 'airport' }, false, 1000, 2);
  member.person.x += 3;
  snapshot = world.update('travel-rules', a.token, { ...idle, destination: 'airport' }, false, 1000, 2);
  assert.equal(snapshot.players[0].x, 323);
});


test('day-night clock repeats smoothly and switches lighting through dawn and dusk', async () => {
  const { default: cycle } = await import(pathToFileURL(path.join(temp, 'lib/day-night.js')).href);
  const at = hour => cycle.getDayCycle(hour / 24 * cycle.DAY_LENGTH_MS);
  assert.equal(at(0).night, 1); assert.equal(at(12).daylight, 1);
  assert.equal(at(12).label, '12:00'); assert.equal(at(24).label, '00:00');
  assert.ok(at(5).daylight < at(6).daylight && at(6).daylight < at(7).daylight);
  assert.ok(at(17).daylight > at(18).daylight && at(18).daylight > at(19).daylight);
  assert.equal(at(6).twilight, 1); assert.equal(at(18).twilight, 1);
  for (let time = 0; time <= cycle.DAY_LENGTH_MS; time += 1000) {
    const a = cycle.getDayCycle(time), b = cycle.getDayCycle(time + 16);
    assert.ok(a.daylight >= 0 && a.daylight <= 1);
    assert.ok(Math.abs(a.daylight - b.daylight) < 0.001);
    assert.deepEqual(a, cycle.getDayCycle(time + cycle.DAY_LENGTH_MS));
  }
});


test('weather has bounded showers, dry intervals, and smooth window boundaries', async () => {
  const { default: { getWeather, WEATHER_WINDOW_MS } } = await import(pathToFileURL(path.join(temp, 'lib/weather.js')).href);
  for (let window = 0; window < 5; window++) {
    let wetSeconds = 0;
    let previous = 0;
    for (let second = 0; second < WEATHER_WINDOW_MS / 1000; second++) {
      const time = window * WEATHER_WINDOW_MS + second * 1000;
      const weather = getWeather(time);
      assert.deepEqual(weather, getWeather(time));
      assert.ok(weather.rain >= 0 && weather.rain <= 1);
      assert.ok(Math.abs(weather.rain - previous) < 0.16);
      if (weather.rain > 0) wetSeconds++;
      previous = weather.rain;
    }
    assert.ok(wetSeconds >= 74 && wetSeconds <= 76);
    assert.equal(getWeather(window * WEATHER_WINDOW_MS).rain, 0);
    assert.equal(previous, 0);
  }
});


test('lightning only occurs in rain with delayed thunder and separated flashes', async () => {
  const { default: { getWeather, WEATHER_WINDOW_MS } } = await import(pathToFileURL(path.join(temp, 'lib/weather.js')).href);
  for (let window = 0; window < 3; window++) {
    const strikes = new Set();
    for (let offset = 0; offset < WEATHER_WINDOW_MS; offset += 100) {
      const now = window * WEATHER_WINDOW_MS + offset;
      const state = getWeather(now);
      assert.ok(state.flash >= 0 && state.flash <= 1);
      if (state.flash > 0) {
        assert.ok(state.rain > 0.5);
        assert.ok(state.thunderAt - state.strikeAt >= 1800);
        assert.ok(state.thunderAt - state.strikeAt < 3400);
        assert.equal(getWeather(state.thunderAt).flash, 0);
        assert.ok(getWeather(state.thunderAt).rain > 0);
        strikes.add(state.strikeAt);
      }
    }
    assert.equal(strikes.size, 3);
    const times = [...strikes];
    assert.ok(times[1] - times[0] >= 19000);
    assert.ok(times[2] - times[1] >= 19000);
  }
});
