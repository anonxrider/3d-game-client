import { world, saveAwardsBackground, laravelUrl } from '@/lib/world-runtime';
export const runtime = 'nodejs';

// Apply this here too: the custom WebSocket server calls POST directly,
// bypassing Next's configured response headers.
export async function POST(request: Request) {
  const response = await handleWorldRequest(request);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function handleWorldRequest(request: Request) {
  // Origin check removed: Render's reverse proxy causes request.url to have a different protocol/host than the actual Origin header.
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
  if (data.action !== 'update' || !data.input || !Number.isFinite(data.input.forward) || Math.abs(data.input.forward) > 1 || !Number.isFinite(data.input.turn) || Math.abs(data.input.turn) > 1 || typeof data.input.brake !== 'boolean' || typeof data.interact !== 'boolean') return Response.json({ error: 'Invalid controls' }, { status: 400 });
  if (data.sequence !== undefined && (!Number.isSafeInteger(data.sequence) || data.sequence < 0)) return Response.json({ error: 'Invalid update sequence' }, { status: 400 });

  if (data.input.destination !== undefined && (typeof data.input.destination !== 'string' || data.input.destination.length > 64)) return Response.json({ error: 'Invalid destination' }, { status: 400 });
  const target = data.input.targetPoint;
  if (target != null && (typeof target !== 'object' || !Number.isFinite(target.x) || !Number.isFinite(target.z) || Math.abs(target.x) > 5000 || Math.abs(target.z) > 5000)) return Response.json({ error: 'Invalid destination' }, { status: 400 });

  const snapshot = world.update(data.room, data.token, data.input, data.interact, Date.now(), data.sequence);

  saveAwardsBackground().catch(console.error);

  return snapshot ? Response.json(snapshot) : Response.json({ error: 'Session expired. Rejoin the room.' }, { status: 401 });
}
