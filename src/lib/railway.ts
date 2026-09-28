// Elevated local services keep road traffic and pedestrians clear of moving trains.
export const RAIL_HEIGHT = 12;
export const RAIL_LIMIT = 4800;
export const STATION_SPACING = 400;
export const TRAIN_TRAVEL_SECONDS = 40;
export const TRAIN_DWELL_SECONDS = 8;
export const railwayStations = Array.from({ length: RAIL_LIMIT * 2 / STATION_SPACING + 1 }, (_, index) => ({
  id: `station-${index}`,
  x: -RAIL_LIMIT + index * STATION_SPACING,
  z: 0,
}));

export function getTrainState(index: number, timeSeconds: number) {
  const leg = TRAIN_TRAVEL_SECONDS + TRAIN_DWELL_SECONDS;
  const phase = ((timeSeconds + index * 7) % (leg * 2) + leg * 2) % (leg * 2);
  const reverse = phase >= leg;
  const progress = Math.max(0, Math.min(1, ((phase % leg) - TRAIN_DWELL_SECONDS) / TRAIN_TRAVEL_SECONDS));
  // Zero velocity at each platform avoids sudden starts/stops.
  const eased = progress * progress * (3 - 2 * progress);
  const start = -RAIL_LIMIT + index * STATION_SPACING + 24;
  const end = start + STATION_SPACING - 48;
  return { x: reverse ? end - (end - start) * eased : start + (end - start) * eased, yaw: reverse ? Math.PI : 0, stopped: phase % leg < TRAIN_DWELL_SECONDS };
}

export function hitsRailwaySupport(x: number, z: number, radius: number) {
  const supportX = Math.round((x - 6) / 40) * 40 + 6;
  return Math.abs(supportX) <= RAIL_LIMIT && Math.abs(x - supportX) < 0.45 + radius
    && Math.abs(Math.abs(z) - 6) < 0.45 + radius;
}


export function nearestTrainIndex(x: number, timeSeconds: number) {
  let nearest = 0, distance = Infinity;
  for (let i = 0; i < railwayStations.length - 1; i++) {
    const candidate = Math.abs(getTrainState(i, timeSeconds).x - x);
    if (candidate < distance) { nearest = i; distance = candidate; }
  }
  return nearest;
}

export function getRailCameraPose(x: number, aspect: number) {
  const scale = Math.max(1, 1 / Math.max(0.3, aspect));
  return { position: [x + 18 * scale, RAIL_HEIGHT + 48 * scale, 30 * scale] as [number, number, number], target: [x, RAIL_HEIGHT + 1.8, 0] as [number, number, number] };
}
