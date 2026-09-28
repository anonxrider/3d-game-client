import { hitsAirport, inAirport } from '../lib/airport';
import { inMountainFootprint } from '../lib/terrain';
import { hitsRailwaySupport } from '../lib/railway';

type HouseType = 'house' | 'hospital' | 'playground';
type HouseSpawn = { x: number; z: number; color: string; type: HouseType };
type TreeSpawn = [number, number];
type VehicleKind = 'car' | 'bike' | 'cycle';
type VehicleShopItem = { kind: VehicleKind; name: string; cost: number; x: number; z: number; spawnX: number; spawnZ: number; color: string };

const districtNames = ['Maple', 'Willow', 'Cedar', 'Rosewood', 'Silver', 'Amber', 'Pine', 'Oak', 'Lotus', 'Sunrise', 'Birch', 'Emerald'];
const districtTypes = ['Heights', 'Gardens', 'Park', 'Meadows', 'Grove', 'Square', 'Hills', 'Valley', 'Crossing', 'Quarter', 'Fields', 'Vista'];

/** Stable names across clients, reloads, and the entire explorable world. */
export function getAreaName(x: number, z: number) {
  const gx = Math.floor((x + 100) / 200);
  const gz = Math.floor((z + 100) / 200);
  if (gx === 0 && gz === 0) return 'Ethera Central';
  const index = (value: number, length: number) => ((value % length) + length) % length;
  const name = `${districtNames[index(gx * 7 + gz * 3, districtNames.length)]} ${districtTypes[index(gz * 5 + gx, districtTypes.length)]}`;
  const eastWest = gx === 0 ? '' : `${gx > 0 ? 'E' : 'W'}${Math.abs(gx)}`;
  const northSouth = gz === 0 ? '' : `${gz > 0 ? 'S' : 'N'}${Math.abs(gz)}`;
  return `${name} · ${[eastWest, northSouth].filter(Boolean).join(' ')}`;
}

function getPlaceName(house: HouseSpawn) {
  const blockX = Math.floor((house.x + 100) / 40) % 5;
  const blockZ = Math.floor((house.z + 100) / 40) % 5;
  const number = ((blockX + 5) % 5) * 20 + ((blockZ + 5) % 5) * 4
    + (house.x > Math.round(house.x / 40) * 40 ? 1 : 0)
    + (house.z > Math.round(house.z / 40) * 40 ? 2 : 0) + 1;
  const kind = house.type === 'hospital' ? 'Hospital' : house.type === 'playground' ? 'Playground' : 'Residence';
  return `${getAreaName(house.x, house.z)} · ${kind} ${number}`;
}

function createSeededRandom(seed = 0x45_54_48_45) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = createSeededRandom();
const generatedHouses: HouseSpawn[] = [];
const generatedTrees: TreeSpawn[] = [];
const generatedStreetProps: { kind: 'fruit' | 'bench' | 'chair' | 'bus' | 'hotel' | 'streetlight', x: number, z: number, yaw: number, width: number, depth: number }[] = [
  { kind: 'fruit', x: -7, z: -16, yaw: Math.PI / 2, width: 3.4, depth: 2 },
  { kind: 'fruit', x: 7, z: 19, yaw: -Math.PI / 2, width: 3.4, depth: 2 },
  { kind: 'bus', x: 23, z: -1.8, yaw: Math.PI / 2, width: 2.8, depth: 8.4 },
  { kind: 'hotel', x: 31, z: -15, yaw: 0, width: 10, depth: 8 },
];

const colors = ['#dfbfa8', '#c7dfb1', '#a8cddd', '#f1c99b', '#bed9ce', '#d8c9ef', '#f0c4b4', '#bbd3ea', '#eadbaa'];

const CITY_BLOCK_RADIUS = 25;

// Generate a massive city block grid
for (let gx = -CITY_BLOCK_RADIUS; gx <= CITY_BLOCK_RADIUS; gx++) {
  for (let gz = -CITY_BLOCK_RADIUS; gz <= CITY_BLOCK_RADIUS; gz++) {
    const cx = gx * 40;
    const cz = gz * 40;

    // Spawn area / center block has a custom layout
    if (gx === 0 && gz === 0) {
      generatedHouses.push(
        { type: 'house', x: -13, z: -12, color: '#f1c99b' },
        { type: 'house', x: 13, z: -14, color: '#bed9ce' },
        { type: 'house', x: -14, z: 13, color: '#d8c9ef' },
        { type: 'house', x: 14, z: 15, color: '#f0c4b4' }
      );
      generatedTrees.push([-7, -7], [7, -7], [-8, 7], [8, 7], [-20, -6], [21, -7]);
      generatedStreetProps.push({ kind: 'bench', x: -7, z: 12, yaw: Math.PI / 2, width: 2.8, depth: 0.9 }, { kind: 'bench', x: 7, z: -12, yaw: -Math.PI / 2, width: 2.8, depth: 0.9 });
      continue;
    }

    // 4 houses per block
    const r = random();
    const type1 = r < 0.05 ? 'hospital' : r < 0.15 ? 'playground' : 'house';
    const type2 = random() < 0.1 ? 'playground' : 'house';
    generatedHouses.push({ type: type1, x: cx - 12, z: cz - 12, color: colors[Math.abs(gx + gz) % colors.length] });
    generatedHouses.push({ type: 'house', x: cx + 12, z: cz - 12, color: colors[Math.abs(gx * gz) % colors.length] });
    generatedHouses.push({ type: type2, x: cx - 12, z: cz + 12, color: colors[Math.abs(gx - gz) % colors.length] });
    generatedHouses.push({ type: 'house', x: cx + 12, z: cz + 12, color: colors[Math.abs(gx + gz * 2) % colors.length] });

    // Trees along the roads
    generatedTrees.push([cx - 19, cz - 8], [cx - 19, cz + 8], [cx + 19, cz - 8], [cx + 19, cz + 8]);
    generatedTrees.push([cx - 8, cz - 19], [cx + 8, cz - 19], [cx - 8, cz + 19], [cx + 8, cz + 19]);

    // Benches, chairs, and streetlights
    if (Math.abs(gx + gz) % 2 === 0) {
      generatedStreetProps.push({ kind: 'bench', x: cx - 4.8, z: cz + 12, yaw: Math.PI / 2, width: 2.8, depth: 0.9 });
      generatedStreetProps.push({ kind: 'streetlight', x: cx - 4.5, z: cz + 8, yaw: Math.PI / 2, width: 0.5, depth: 0.5 });
      generatedStreetProps.push({ kind: 'streetlight', x: cx + 4.5, z: cz - 8, yaw: -Math.PI / 2, width: 0.5, depth: 0.5 });
    } else {
      generatedStreetProps.push({ kind: 'chair', x: cx + 12, z: cz - 4.8, yaw: 0, width: 0.8, depth: 0.8 });
      generatedStreetProps.push({ kind: 'streetlight', x: cx - 8, z: cz - 4.5, yaw: 0, width: 0.5, depth: 0.5 });
      generatedStreetProps.push({ kind: 'streetlight', x: cx + 8, z: cz + 4.5, yaw: Math.PI, width: 0.5, depth: 0.5 });
    }
  }
}

// Reserve custom building footprints so generated homes cannot overlap them.
export const houses = generatedHouses.filter(h => !inAirport(h.x, h.z, 18) && !inMountainFootprint(h.x, h.z, 18) && !(Math.abs(h.x + 30) < 11 && Math.abs(h.z - 28) < 15) && !(Math.abs(h.x - 31) < 12 && Math.abs(h.z + 15) < 11)).map(h => ({ ...h, name: getPlaceName(h) }));
export const trees = generatedTrees.filter(([x, z]) => !inAirport(x, z, 3) && !inMountainFootprint(x, z, 2));
export const streetProps = generatedStreetProps.filter(p => !inAirport(p.x, p.z, 8) && !inMountainFootprint(p.x, p.z, 8));

const generatedVehicles: { kind: 'car' | 'bike', x: number, z: number, color: string }[] = [
  { kind: 'car', x: -2.5, z: -7, color: '#38bdf8' },
  { kind: 'bike', x: 2.5, z: -3, color: '#fb923c' },
  { kind: 'car', x: 2.5, z: 12, color: '#f43f5e' },
  { kind: 'bike', x: -3, z: 8, color: '#a3e635' },
  { kind: 'car', x: -2.5, z: 43, color: '#facc15' },
  { kind: 'bike', x: 2.5, z: -43, color: '#22c55e' },
  { kind: 'car', x: 43, z: 2.5, color: '#c084fc' },
  { kind: 'bike', x: -43, z: -2.5, color: '#fb7185' },
  { kind: 'car', x: -2.5, z: 83, color: '#06b6d4' },
  { kind: 'bike', x: 83, z: 2.5, color: '#f97316' },
];

for (let gx = -CITY_BLOCK_RADIUS; gx <= CITY_BLOCK_RADIUS; gx++) {
  for (let gz = -CITY_BLOCK_RADIUS; gz <= CITY_BLOCK_RADIUS; gz++) {
    if (gx === 0 && gz === 0) continue; // Skip spawn
    const cx = gx * 40;
    const cz = gz * 40;
    // 30% chance to spawn a vehicle per block
    if (random() < 0.3) {
      const isCar = random() > 0.5;
      const color = colors[Math.floor(random() * colors.length)];
      // Spawn on one of the roads
      if (random() > 0.5) {
        generatedVehicles.push({ kind: isCar ? 'car' : 'bike', x: cx + 2.5, z: cz + 10, color });
      } else {
        generatedVehicles.push({ kind: isCar ? 'car' : 'bike', x: cx - 10, z: cz - 2.5, color });
      }
    }
  }
}

export const vehicleSpawns = generatedVehicles.filter(v => !inAirport(v.x, v.z, 8) && !inMountainFootprint(v.x, v.z, 4));

export const vehicleShopItems: VehicleShopItem[] = [
  { kind: 'cycle', name: 'Cycle', cost: 80, x: -22, z: 24, spawnX: -3, spawnZ: 24, color: '#22c55e' },
  { kind: 'bike', name: 'Bike', cost: 150, x: -22, z: 28, spawnX: -3, spawnZ: 28, color: '#f97316' },
  { kind: 'car', name: 'Car', cost: 300, x: -22, z: 32, spawnX: -3, spawnZ: 32, color: '#38bdf8' },
];

// Static obstacles are indexed once; movement/pathfinding only visits nearby cells.
const CELL_SIZE = 40;
function spatialIndex<T>(items: readonly T[], point: (item: T) => readonly [number, number]) {
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const [x, z] = point(item);
    const key = `${Math.floor(x / CELL_SIZE)}:${Math.floor(z / CELL_SIZE)}`;
    const cell = cells.get(key);
    if (cell) cell.push(item); else cells.set(key, [item]);
  }
  return (x: number, z: number, extent: number, predicate: (item: T) => boolean) => {
    for (let gx = Math.floor((x - extent) / CELL_SIZE); gx <= Math.floor((x + extent) / CELL_SIZE); gx++) {
      for (let gz = Math.floor((z - extent) / CELL_SIZE); gz <= Math.floor((z + extent) / CELL_SIZE); gz++) {
        if (cells.get(`${gx}:${gz}`)?.some(predicate)) return true;
      }
    }
    return false;
  };
}
const nearbyHouses = spatialIndex(houses, h => [h.x, h.z]);
const nearbyTrees = spatialIndex(trees, tree => tree);
const nearbyProps = spatialIndex(streetProps, p => [p.x, p.z]);

export function hitsScenery(x: number, z: number, radius: number) {
  return hitsAirport(x, z, radius) || hitsRailwaySupport(x, z, radius) || hitsVehicleShop(x, z, radius) || hitsStreetProp(x, z, radius) || nearbyHouses(x, z, 7 + radius, h => {
    if (h.type === 'hospital') return Math.abs(x - h.x) < 6 + radius && Math.abs(z - h.z) < 6 + radius;
    if (h.type === 'playground') return Math.abs(x - h.x) < 7 + radius && Math.abs(z - h.z) < 7 + radius;
    return Math.abs(x - h.x) < 3.5 + radius && Math.abs(z - h.z) < 3 + radius;
  }) || nearbyTrees(x, z, 0.35 + radius, ([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.35 + radius);
}

function hitsVehicleShop(x: number, z: number, radius: number) {
  return Math.abs(x + 30) < 3.8 + radius && Math.abs(z - 28) < 8 + radius;
}

export function hitsStreetProp(x: number, z: number, radius: number) {
  return nearbyProps(x, z, 7 + radius, p => {
    const dx = x - p.x, dz = z - p.z;
    const localX = Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz;
    const localZ = Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz;
    const edgeX = Math.max(Math.abs(localX) - p.width / 2, 0);
    const edgeZ = Math.max(Math.abs(localZ) - p.depth / 2, 0);
    return Math.hypot(edgeX, edgeZ) <= radius;
  });
}

export const buildings = [
  ...houses.filter(h => h.type !== 'playground').map((h, i) => ({ id: `${h.type}-${i}`, name: h.name, x: h.x, z: h.type === 'hospital' ? h.z + 6.6 : h.z + 4.1, cost: h.type === 'house' ? 50 + (i % 5) * 20 : 0 })),
  { id: 'hotel', name: 'OYO Hotel', x: 31, z: -9.9, cost: 1 },
];
export const interiorFurniture = [
  { x: -2.5, z: -1.7, width: 2, depth: 1.2, kind: 'sofa', yaw: 0 },
  { x: 2.5, z: -1.5, width: 1.6, depth: 2.3, kind: 'bed', yaw: Math.PI / 2 },
  { x: -1.5, z: 0.4, width: 1.2, depth: 0.8, kind: 'table', yaw: 0 },
];
export const hotelFurniture = [
  { x: 0, z: -3, width: 2, depth: 1, kind: 'table', yaw: 0, floor: 0 }, // Reception
  { x: -6, z: -3, width: 2, depth: 1.2, kind: 'sofa', yaw: Math.PI / 2, floor: 0 }, // Lobby sofa
  { x: 6, z: -3, width: 2, depth: 1.2, kind: 'sofa', yaw: -Math.PI / 2, floor: 0 }, // Lobby sofa
  // Floor 1 Rooms (Offset X by 100 for Floor 1)
  { x: 96, z: -3, width: 1.6, depth: 2.3, kind: 'bed', yaw: 0, floor: 1 },
  { x: 104, z: -3, width: 1.6, depth: 2.3, kind: 'bed', yaw: 0, floor: 1 },
  // Floor 2 Rooms (Offset X by 200 for Floor 2)
  { x: 196, z: -3, width: 1.6, depth: 2.3, kind: 'bed', yaw: 0, floor: 2 },
  { x: 204, z: -3, width: 1.6, depth: 2.3, kind: 'bed', yaw: 0, floor: 2 },
];
export const hotelTeleporters = [
  { x: 0, z: -5.5, label: 'Elevator to Floor 1', destX: 100, destZ: 0 },
  { x: 100, z: -5.5, label: 'Elevator to Floor 2', destX: 200, destZ: 0 },
  { x: 200, z: -5.5, label: 'Elevator to Lobby', destX: 0, destZ: 0 },
];
export const seats = [
  ...streetProps.filter(p => p.kind === 'bench' || p.kind === 'chair').map(p => ({ ...p, interior: null as string | null })),
  ...interiorFurniture.filter(f => f.kind === 'sofa' || f.kind === 'bed').map(f => ({ x: f.x, z: f.z, yaw: f.yaw, interior: 'generic' })),
  ...hotelFurniture.filter(f => f.kind === 'sofa' || f.kind === 'bed').map(f => ({ x: f.x, z: f.z, yaw: f.yaw, interior: 'hotel' }))
];
export function blockedInside(x: number, z: number, id: string | null = null) {
  if (id === 'hotel') {
    // Hotel bounds
    const floor = Math.floor((x + 50) / 100);
    const localX = x - floor * 100;
    if (Math.abs(localX) > 8 || Math.abs(z) > 6 || z > 2.8) return true;
    return hotelFurniture.some(f => Math.abs(x - f.x) < f.width / 2 + 0.4 && Math.abs(z - f.z) < f.depth / 2 + 0.4);
  }
  return Math.abs(x) > 3.6 || Math.abs(z) > 2.6 || interiorFurniture.some(f => Math.abs(x - f.x) < f.width / 2 + 0.4 && Math.abs(z - f.z) < f.depth / 2 + 0.4);
}
type InteractionKind = 'vehicleShop' | 'building' | 'seat' | 'vehicle' | 'teleport';
type Interaction = { kind: InteractionKind; index: number; distance: number; range: number };
const staticInteractions = [
  ...vehicleShopItems.map((p, index) => ({ ...p, index, kind: 'vehicleShop' as const, range: 2.2, interior: null as string | null })),
  ...buildings.map((p, index) => ({ ...p, index, kind: 'building' as const, range: 1.8, interior: null as string | null })),
  ...seats.map((p, index) => ({ ...p, index, kind: 'seat' as const, range: 1.8, interior: p.interior })),
  ...hotelTeleporters.map((p, index) => ({ ...p, index, kind: 'teleport' as const, range: 1.8, interior: 'hotel' })),
];
const nearbyStaticInteractions = spatialIndex(staticInteractions, p => [p.x, p.z]);
export function nearbyInteraction(x: number, z: number, vehicles: readonly { x: number; z: number }[], interiorId: string | null = null): Interaction | undefined {
  let closest: Interaction | undefined;
  const consider = (px: number, pz: number, kind: InteractionKind, index: number, range: number) => {
    const distance = Math.hypot(x - px, z - pz);
    if (distance < range && (!closest || distance < closest.distance)) closest = { kind, index, distance, range };
  };
  nearbyStaticInteractions(x, z, 2.2, p => {
    const pInterior = p.interior === 'generic' && interiorId !== null ? interiorId : p.interior;
    if (pInterior !== interiorId) return false;
    consider(p.x, p.z, p.kind, p.index, p.range);
    return false;
  });
  if (interiorId === null) vehicles.forEach((v, index) => consider(v.x, v.z, 'vehicle', index, 3.4));
  return closest;
}
