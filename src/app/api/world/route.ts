import { WorldServer } from '@/lib/world-server';
export const runtime = 'nodejs';
const globalWorld = globalThis as typeof globalThis & { etheraInteractiveWorld?: WorldServer };
const world = globalWorld.etheraInteractiveWorld ??= new WorldServer();
// Keep active rooms during Fast Refresh while applying updated server methods.
Object.setPrototypeOf(world, WorldServer.prototype);
world.pendingAwards ??= new Map();
const laravelUrl = process.env.LARAVEL_API_URL || 'https://gameapi.jinskadamthodu.com/api';
let isSaving = false;
async function saveAwardsBackground() {
  if (isSaving || world.pendingAwards.size === 0) return;
  isSaving = true;
  try {
    for (const award of Array.from(world.pendingAwards.values())) {
      try {
        const response = await fetch(`${laravelUrl}/game/score`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Game-Server-Key': process.env.GAME_SERVER_KEY || '' },
          body: JSON.stringify(award), signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          world.pendingAwards.delete(award.id);
        }
      } catch {
        // Stop processing this batch on network error, try again next time
        break;
      }
    }
  } finally {
    isSaving = false;
  }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 2048) return Response.json({ error: 'Request too large' }, { status: 413 });
  let data;
  try { data = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!data || typeof data.room !== 'string' || !/^[a-z0-9-]{1,32}$/.test(data.room)) return Response.json({ error: 'Invalid room code' }, { status: 400 });
  if (data.action === 'join') {
    if (typeof data.authToken !== 'string' || !data.authToken) return Response.json({ error: 'Please sign in again' }, { status: 401 });
    try {
      saveAwardsBackground().catch(console.error);
      const response = await fetch(`${laravelUrl}/user`, { headers: { Authorization: `Bearer ${data.authToken}`, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (response.status === 401) return Response.json({ error: 'Please sign in again' }, { status: 401 });
      if (!response.ok) throw new Error('Unable to load saved score');
      const account = await response.json();
      return Response.json(world.join(data.room, account.name, Date.now(), account));
    }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to join' }, { status: 409 }); }
  }
  if (typeof data.token !== 'string') return Response.json({ error: 'Missing session' }, { status: 401 });
  if (data.action === 'leave') {
    saveAwardsBackground().catch(console.error);
    world.leave(data.room, data.token);
    return Response.json({ ok: true });
  }
  if (data.action !== 'update' || !data.input || ![-1, 0, 1].includes(data.input.forward) || ![-1, 0, 1].includes(data.input.turn) || typeof data.input.brake !== 'boolean' || typeof data.interact !== 'boolean') return Response.json({ error: 'Invalid controls' }, { status: 400 });
  if (data.sequence !== undefined && (!Number.isSafeInteger(data.sequence) || data.sequence < 0)) return Response.json({ error: 'Invalid update sequence' }, { status: 400 });

  if (data.input.destination !== undefined && (typeof data.input.destination !== 'string' || data.input.destination.length > 64)) return Response.json({ error: 'Invalid destination' }, { status: 400 });
  const target = data.input.targetPoint;
  if (target != null && (typeof target !== 'object' || !Number.isFinite(target.x) || !Number.isFinite(target.z) || Math.abs(target.x) > 5000 || Math.abs(target.z) > 5000)) return Response.json({ error: 'Invalid destination' }, { status: 400 });

  const snapshot = world.update(data.room, data.token, data.input, data.interact, Date.now(), data.sequence);

  saveAwardsBackground().catch(console.error);

  return snapshot ? Response.json(snapshot) : Response.json({ error: 'Session expired. Rejoin the room.' }, { status: 401 });
}
