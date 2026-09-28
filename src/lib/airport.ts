export const airport = { name: 'Ethera International Airport', x: 320, z: 320, halfWidth: 165, halfDepth: 110 };
export const FLIGHT_CYCLE = 180;
export const parkedAircraft = [{ x: -55, z: -25 }, { x: 5, z: -25 }];
export function inAirport(x: number, z: number, margin = 0) {
  return Math.abs(x - airport.x) <= airport.halfWidth + margin && Math.abs(z - airport.z) <= airport.halfDepth + margin;
}
export function inAirportOperations(x: number, z: number) {
  return Math.abs(x - airport.x) < 155 && z - airport.z > -55 && z - airport.z < 65;
}
export function hitsAirport(x: number, z: number, radius: number) {
  const dx = x - airport.x, dz = z - airport.z;
  return Math.abs(dx) < 36 + radius && Math.abs(dz + 70) < 9 + radius
    || Math.abs(dx - 100) < 5 + radius && Math.abs(dz + 70) < 5 + radius
    || parkedAircraft.some(p => Math.abs(dx - p.x) < 10 + radius && Math.abs(dz - p.z) < 10 + radius);
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function localFlight(t: number) {
  const ground = 1.2;
  if (t < 8) return { x: -110, y: ground, z: 20, stage: 'Ready for takeoff' };
  if (t < 24) { const p = (t - 8) / 16; return { x: -110 + 210 * p * p, y: ground, z: 20, stage: 'Takeoff' }; }
  if (t < 40) { const p = (t - 24) / 16; return { x: 100 + 160 * p, y: ground + (60 - ground) * smooth(p), z: 20, stage: 'Climbing' }; }
  if (t < 116) {
    const p = (t - 40) / 76, q = 1 - p;
    return { x: q ** 3 * 260 + 3 * q * q * p * 480 - 3 * q * p * p * 480 - p ** 3 * 260,
      y: 60 + Math.sin(Math.PI * p) * 25, z: 20 + 3 * q * p * 320, stage: 'Flying circuit' };
  }
  if (t < 136) { const p = (t - 116) / 20; return { x: -260 + 150 * p, y: 60 + (ground - 60) * smooth(p), z: 20, stage: 'Landing' }; }
  if (t < 152) { const p = (t - 136) / 16; return { x: -110 + 210 * (1 - (1 - p) ** 2), y: ground, z: 20, stage: 'Landing rollout' }; }
  if (t < 159) return { x: 100, y: ground, z: 20 + 35 * smooth((t - 152) / 7), stage: 'Taxiing' };
  if (t < 173) return { x: 100 - 210 * smooth((t - 159) / 14), y: ground, z: 55, stage: 'Taxiing' };
  return { x: -110, y: ground, z: 55 - 35 * smooth((t - 173) / 7), stage: 'Taxiing' };
}
export function getAircraftState(index: number, seconds: number) {
  const t = ((seconds + index * FLIGHT_CYCLE / 2) % FLIGHT_CYCLE + FLIGHT_CYCLE) % FLIGHT_CYCLE;
  const p = localFlight(t), next = localFlight(Math.min(179.99999, t + 0.02));
  const dx = next.x - p.x, dz = next.z - p.z;
  return { ...p, x: p.x + airport.x, z: p.z + airport.z,
    yaw: Math.hypot(dx, dz) < 0.000001 ? Math.PI / 2 : Math.atan2(dx, dz),
    pitch: -Math.atan2(next.y - p.y, Math.max(0.00001, Math.hypot(dx, dz))),
    bank: p.stage === 'Flying circuit' ? -0.16 * Math.sin((t - 40) / 76 * Math.PI) : 0,
    gear: p.y < 12,
  };
}
export function airportCamera(aspect: number) {
  const distance = Math.max(220, 170 / (Math.tan(25 * Math.PI / 180) * Math.max(0.3, aspect))) * 1.2;
  return { x: airport.x, y: distance * 0.8, z: airport.z + distance * 0.6, far: distance + 500 };
}
