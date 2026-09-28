const FLOCK_SPACING = 80;

export function getNearbyFlocks(x: number, z: number) {
  const gx = Math.round(x / FLOCK_SPACING);
  const gz = Math.round(z / FLOCK_SPACING);
  return Array.from({ length: 9 }, (_, index) => {
    const cx = (gx + index % 3 - 1) * FLOCK_SPACING;
    const cz = (gz + Math.floor(index / 3) - 1) * FLOCK_SPACING;
    return { id: `${cx}:${cz}`, x: cx, z: cz };
  });
}

export type BirdPerch = { x: number; y: number; z: number; kind: 'roof' | 'road' };
export const BIRD_CYCLE_SECONDS = 64;

export function getBirdBehavior(road: BirdPerch, roof: BirdPerch, crow: boolean, seconds: number) {
  const offset = road.x * 0.013 + road.z * 0.017 + (crow ? 0 : 23);
  const phase = ((seconds + offset) % BIRD_CYCLE_SECONDS + BIRD_CYCLE_SECONDS) % BIRD_CYCLE_SECONDS;
  const height = Math.max(road.y, roof.y) + 3;
  const roadAir = { ...road, y: height };
  const roofAir = { ...roof, y: height };
  const yaw = Math.atan2(roof.x - road.x, roof.z - road.z);
  const rest = (point: BirdPerch, facing: number) => ({ ...point, yaw: facing + Math.sin(seconds * 0.8) * 0.08, flap: 0, wings: 0, resting: true });
  const fly = (from: BirdPerch, to: BirdPerch, start: number, duration: number, facing: number, opening = 1, closing = 1) => {
    const t = Math.max(0, Math.min(1, (phase - start) / duration));
    const eased = t * t * (3 - 2 * t);
    const wings = opening + (closing - opening) * eased;
    return {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      z: from.z + (to.z - from.z) * eased,
      yaw: facing,
      flap: Math.sin(seconds * (crow ? 8 : 10)) * 0.65 * wings,
      wings,
      resting: false,
      kind: to.kind,
    };
  };
  if (phase < 7) return rest(road, yaw);
  if (phase < 12) return fly(road, roadAir, 7, 5, yaw, 0, 1);
  if (phase < 22) return fly(roadAir, roofAir, 12, 10, yaw);
  if (phase < 26) return fly(roofAir, roof, 22, 4, yaw, 1, 0);
  if (phase < 36) return rest(roof, yaw + Math.PI);
  if (phase < 40) return fly(roof, roofAir, 36, 4, yaw + Math.PI, 0, 1);
  if (phase < 52) return fly(roofAir, roadAir, 40, 12, yaw + Math.PI);
  if (phase < 58) return fly(roadAir, road, 52, 6, yaw + Math.PI, 1, 0);
  return rest(road, yaw);
}
