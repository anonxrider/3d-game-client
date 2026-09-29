import type { CarState, Snapshot } from './multiplayer';

// The desktop draws dynamic objects within 150 units on each axis. Keep a
// buffer so objects arrive before they enter that range, including its corners.
export const SNAPSHOT_RADIUS = 180;
export type NearbySnapshot = Omit<Snapshot, 'vehicles'> & {
  vehicleEntries: [number, CarState][];
};

export function nearbySnapshot(snapshot: Snapshot): NearbySnapshot {
  const self = snapshot.players.find(player => player.id === snapshot.self);
  const center = self?.vehicle != null ? snapshot.vehicles[self.vehicle] ?? self : self;
  const nearby = (point: { x: number; z: number }) => !!center
    && Math.abs(point.x - center.x) <= SNAPSHOT_RADIUS
    && Math.abs(point.z - center.z) <= SNAPSHOT_RADIUS;
  // Player records remain available for the room roster and map. Retain their
  // occupied vehicles too, so every player's vehicle reference stays valid.
  const occupied = new Set(snapshot.players.map(player => player.vehicle));
  const { vehicles, ...rest } = snapshot;
  const vehicleEntries: NearbySnapshot['vehicleEntries'] = [];
  vehicles.forEach((vehicle, index) => {
    if (nearby(vehicle) || occupied.has(index)) vehicleEntries.push([index, vehicle]);
  });
  return {
    ...rest, vehicleEntries,
    coins: snapshot.coins.filter(nearby),
    npcs: snapshot.npcs?.filter(nearby),
  };
}

export function restoreSnapshot(snapshot: NearbySnapshot): Snapshot {
  const { vehicleEntries, ...rest } = snapshot;
  // Restore the server's stable vehicle slots locally. Array iteration methods
  // used by rendering/interaction skip holes; never serialize this sparse array
  // onto the wire, where holes would become wasteful null entries.
  const vehicles: CarState[] = [];
  for (const [index, vehicle] of vehicleEntries) vehicles[index] = vehicle;
  return { ...rest, vehicles };
}
