export const mountains = [
  { id: 'pine-summit', name: 'Pine Summit', x: 0, z: -200, radius: 100, height: 36, color: '#64748b' },
  { id: 'silver-peak', name: 'Silver Peak', x: -240, z: -240, radius: 120, height: 48, color: '#475569' },
  { id: 'sunrise-ridge', name: 'Sunrise Ridge', x: 240, z: -240, radius: 110, height: 42, color: '#526174' },
];

// Matches the four-sided cone meshes exactly: a diamond footprint and planar slopes.
export function getTerrainHeight(x: number, z: number) {
  let height = 0;
  for (const mountain of mountains) {
    const slope = 1 - (Math.abs(x - mountain.x) + Math.abs(z - mountain.z)) / mountain.radius;
    height = Math.max(height, mountain.height * slope);
  }
  return height;
}

export function inMountainFootprint(x: number, z: number, margin = 0) {
  return mountains.some(m => Math.abs(x - m.x) + Math.abs(z - m.z) <= m.radius + margin);
}
