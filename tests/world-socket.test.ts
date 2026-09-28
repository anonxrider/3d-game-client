import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { WorldServer } from '../src/lib/world-server';
import { createWorldSocket } from '../src/lib/world-socket';

test('socket auth, idle broadcasts, controls, reconnect, validation and disconnect stop', { timeout: 15000 }, async t => {
  const world = new WorldServer();
  const alice = world.join('test', 'Alice');
  const bob = world.join('test', 'Bob');
  const wss = createWorldSocket(world, async () => {});
  const server = createServer();
  server.on('upgrade', (req, socket, head) => wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req)));
  const sockets: WebSocket[] = [];
  t.after(async () => {
    sockets.forEach(ws => ws.terminate());
    for (const ws of wss.clients) ws.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  async function connect(token: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}`);
    sockets.push(ws);
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'auth', room: 'test', token }));
    return ws;
  }
  function next(ws: WebSocket) {
    return once(ws, 'message').then(([data]) => JSON.parse(data.toString()));
  }
  const invalid = await connect('invalid');
  assert.equal((await once(invalid, 'close'))[0], 4001);
  const a = await connect(alice.token);
  assert.equal((await next(a)).snapshot.self, alice.snapshot.self);
  const b = await connect(bob.token);
  const initial = (await next(b)).snapshot;
  const later = (await next(b)).snapshot;
  assert.ok(later.serverTime > initial.serverTime, 'idle clients receive live world updates');
  a.send(JSON.stringify({ type: 'input', sequence: 1, interact: false, input: {forward: 1, turn: 0, brake: false} }));
  let moved = false;
  for (let i = 0; i < 8; i++) {
    const snapshot = (await next(b)).snapshot;
    if (snapshot.players.find((p: {id: string}) => p.id === alice.snapshot.self).z < -0.05) { moved = true; break; }
  }
  assert.ok(moved, 'other client sees movement without sending controls');
  a.send(JSON.stringify({ type: 'input', sequence: 0, interact: false, input: {forward: -1, turn: 0, brake: false} }));
  await next(a);
  assert.equal(world.rooms.get('test')!.players.get(alice.token)!.input.forward, 1, 'stale input ignored');
  a.close(); await once(a, 'close');
  await next(b);
  assert.equal(world.rooms.get('test')!.players.get(alice.token)!.input.forward, 0);
  const reconnected = await connect(alice.token);
  assert.equal((await next(reconnected)).sequence, 1);
  reconnected.send(JSON.stringify({ type: 'input', sequence: 2, interact: false, input: { forward: 0.35, turn: -0.6, brake: false } }));
  while ((await next(reconnected)).sequence < 2) {}
  assert.equal(world.rooms.get('test')!.players.get(alice.token)!.input.forward, 0.35);
  assert.equal(world.rooms.get('test')!.players.get(alice.token)!.input.turn, -0.6);
  reconnected.send(JSON.stringify({type:'input',sequence:3,interact:false,input:{forward:99,turn:0,brake:false}}));
  assert.equal((await once(reconnected, 'close'))[0], 1008);
});
