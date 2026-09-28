import { WorldServer } from './world-server';
const globalWorld = globalThis as typeof globalThis & { etheraInteractiveWorld?: WorldServer };
export const world = globalWorld.etheraInteractiveWorld ??= new WorldServer();
// Keep active rooms during Fast Refresh while applying updated server methods.
Object.setPrototypeOf(world, WorldServer.prototype);
world.pendingAwards ??= new Map();
export const laravelUrl = process.env.LARAVEL_API_URL || 'https://gameapi.jinskadamthodu.com/api';
let isSaving = false;
export async function saveAwardsBackground() {
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

