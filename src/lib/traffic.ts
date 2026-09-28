import { inAirport } from './airport';
import { inMountainFootprint } from './terrain';

export type RoadPoint = { x: number; z: number };
export type TrafficRoute = { points: RoadPoint[]; next: number };

export function isTrafficRoad(x: number, z: number) {
  if (Math.abs(x) > 4997 || Math.abs(z) > 4997 || inAirport(x, z, 6) || inMountainFootprint(x, z, 3)) return false;
  const dx = Math.abs(x - Math.round(x / 40) * 40);
  const dz = Math.abs(z - Math.round(z / 40) * 40);
  // Leave room for the vehicle body inside the eight-unit-wide road.
  return Math.min(dx, dz) <= 2.6;
}

export function trafficLoop(cellX: number, cellZ: number): RoadPoint[] {
  const x = cellX * 200, z = cellZ * 200;
  return [{ x: x + 39, z: z + 41 }, { x: x + 39, z: z + 161 }, { x: x + 119, z: z + 161 }, { x: x + 119, z: z + 41 }];
}

export function clearRoadSegment(from: RoadPoint, to: RoadPoint, blocked: (x: number, z: number) => boolean) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z)));
  for (let i = 0; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps;
    const z = from.z + (to.z - from.z) * i / steps;
    if (!isTrafficRoad(x, z) || blocked(x, z)) return false;
  }
  return true;
}
