import { WebSocket, WebSocketServer } from 'ws';
import type { WorldServer } from './world-server';
import type { Input } from './multiplayer';
import { nearbySnapshot } from './nearby-snapshot';

function validInput(input: Input) {
  return input && Number.isFinite(input.forward) && Math.abs(input.forward) <= 1 && Number.isFinite(input.turn) && Math.abs(input.turn) <= 1
    && typeof input.brake === 'boolean'
    && (input.destination === undefined || (typeof input.destination === 'string' && input.destination.length <= 64))
    && (input.targetPoint == null || (Number.isFinite(input.targetPoint.x) && Number.isFinite(input.targetPoint.z)
      && Math.abs(input.targetPoint.x) <= 5000 && Math.abs(input.targetPoint.z) <= 5000));
}

export function createWorldSocket(world: WorldServer, saveAwards: () => Promise<void>) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  const sessions = new Map<WebSocket, { room: string; token: string }>();
  const idle: Input = { forward: 0, turn: 0, brake: true };
  function sendSnapshot(ws: WebSocket) {
    const session = sessions.get(ws);
    if (!session || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256 * 1024) return;
    const room = world.rooms.get(session.room);
    const member = room?.players.get(session.token);
    if (!room || !member) { ws.close(4001, 'Session expired'); return; }
    ws.send(JSON.stringify({ type: 'snapshot', sequence: member.sequence, snapshot: nearbySnapshot(world.snapshot(room, member.person.id)) }));
  }
  wss.on('connection', ws => {
    const authTimeout = setTimeout(() => ws.close(4001, 'Authentication required'), 5000);
    let windowStart = Date.now(), messages = 0;
    ws.on('error', () => ws.terminate());
    ws.on('message', (raw, binary) => {
      try {
        const now = Date.now();
        if (now - windowStart >= 1000) { windowStart = now; messages = 0; }
        if (binary || ++messages > 60) { ws.close(1008, 'Invalid message rate or format'); return; }
        const data = JSON.parse(raw.toString());
        if (!data || typeof data !== 'object') throw new Error('Invalid message');
        let session = sessions.get(ws);
        if (!session) {
          if (data.type !== 'auth' || typeof data.room !== 'string' || typeof data.token !== 'string'
            || !world.rooms.get(data.room)?.players.has(data.token)) { ws.close(4001, 'Session expired'); return; }
          // One transport owns a session. A reconnect replaces the previous socket.
          for (const [other, active] of sessions) if (active.room === data.room && active.token === data.token) {
            sessions.delete(other); other.close(4002, 'Session connected elsewhere');
          }
          session = { room: data.room, token: data.token };
          sessions.set(ws, session);
          const member = world.rooms.get(session.room)!.players.get(session.token)!;
          member.seen = now;
          member.input = { ...idle };
          clearTimeout(authTimeout);
          sendSnapshot(ws);
          return;
        }
        if (data.type === 'rtc') {
          const room = world.rooms.get(session.room);
          if (!room || typeof data.target !== 'string') return;
          const targetEntry = [...room.players.entries()].find(([token, member]) => member.person.id === data.target);
          if (targetEntry) {
            const targetWs = [...sessions.entries()].find(([ws, s]) => s.room === session.room && s.token === targetEntry[0]);
            const sourceMember = room.players.get(session.token);
            if (targetWs && sourceMember) {
              targetWs[0].send(JSON.stringify({ type: 'rtc', source: sourceMember.person.id, payload: data.payload }));
            }
          }
          return;
        }

        if (data.type !== 'input' || !Number.isSafeInteger(data.sequence) || data.sequence < 0
          || typeof data.interact !== 'boolean' || !validInput(data.input)) throw new Error('Invalid controls');
        if (!world.update(session.room, session.token, data.input, data.interact, now, data.sequence)) {
          ws.close(4001, 'Session expired'); return;
        }
        sendSnapshot(ws);
      } catch { ws.close(1008, 'Invalid message'); }
    });
    ws.on('close', () => {
      clearTimeout(authTimeout);
      const session = sessions.get(ws);
      sessions.delete(ws);
      const member = session && world.rooms.get(session.room)?.players.get(session.token);
      if (member) { member.input = { ...idle }; member.path = undefined; member.pathTarget = undefined; }
    });
  });
  // Simulation and broadcasts continue even when a spectator sends no controls.
  const tick = setInterval(() => {
    const now = Date.now();
    world.cleanup(now);
    for (const name of new Set([...sessions.values()].map(s => s.room))) {
      const room = world.rooms.get(name);
      if (room) world.advance(room, now);
    }
    for (const ws of sessions.keys()) sendSnapshot(ws);
  }, 50);
  const awards = setInterval(() => { void saveAwards().catch(console.error); }, 1000);
  wss.on('close', () => { clearInterval(tick); clearInterval(awards); });
  return wss;
}
