import { destinations } from './destinations';
import { railwayStations, RAIL_HEIGHT } from './railway';
import { inAirport, inAirportOperations } from './airport';
import { clearRoadSegment, isTrafficRoad, trafficLoop, type TrafficRoute } from './traffic';
import { getTerrainHeight } from './terrain';
import { randomUUID } from 'node:crypto';
import { hitsScenery, vehicleSpawns, seats, buildings, blockedInside, nearbyInteraction, vehicleShopItems } from '../components/world';
import type { Input, Person, CarState, Snapshot, Coin, VehicleKind } from './multiplayer';

import { findPath } from './pathfinding';

type Member = { person: Person; input: Input; seen: number; sequence: number; userId?: number; pathTarget?: {x: number, z: number}; path?: {x: number, z: number}[] };
type Npc = { person: Person; target: { x: number; z: number }; wait: number; cell?: string };
type Room = { airportPrepared?: boolean; players: Map<string, Member>; vehicles: CarState[]; coins: Coin[]; tick: number; emptySince?: number; npcs: Npc[]; populationCells?: Set<string>; trafficCells?: Map<string, number[]>; trafficPool?: number[]; trafficRoutes?: Map<number, TrafficRoute> };
const colors = ['#38bdf8', '#fb7185', '#a3e635', '#c084fc', '#fbbf24', '#2dd4bf'];
const idle: Input = { forward: 0, turn: 0, brake: true };
const WORLD_LIMIT = 5000;
const CAR_COLLISION_RADIUS = 1.05;
const BIKE_COLLISION_RADIUS = 0.75;
const CYCLE_COLLISION_RADIUS = 0.65;
const EMPTY_ROOM_TTL = 60 * 60 * 1000;
const TRAFFIC_SPEED = 4;
// Keep a 3×3 neighborhood active around each player; overlapping areas share entities.
const POPULATION_CELL_SIZE = 200;
const COINS_PER_CELL = 25;
const NPC_NAMES = ['Asha', 'Ravi', 'Maya', 'Arjun', 'Neha', 'Kabir', 'Isha', 'Dev'];
export class WorldServer {
  rooms = new Map<string, Room>();
  pendingAwards = new Map<string, { id: string; user_id: number; value: number }>();
  cleanup(now: number) {
    for (const [name, room] of this.rooms) {
      for (const [token, member] of room.players) if (now - member.seen > 15000) this.remove(room, token);
      if (!room.players.size) {
        room.emptySince ??= now;
        if (now - room.emptySince > EMPTY_ROOM_TTL) this.rooms.delete(name);
      }
    }
  }
  remove(room: Room, token: string) {
    const member = room.players.get(token);
    if (member) for (const [index, vehicle] of room.vehicles.entries()) if (vehicle.owner === member.person.id) {
      const nextDriver = [...room.players.values()].find(m => m.person.vehicle === index && m.person.id !== member.person.id);
      vehicle.owner = nextDriver?.person.id ?? null;
      vehicle.speed = 0;
    }
    room.players.delete(token);
  }
  blocked(room: Room, x: number, z: number, radius: number, ignore = -1) {
    return Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT || hitsScenery(x, z, radius)
      || room.vehicles.some((v, i) => i !== ignore && Math.hypot(x - v.x, z - v.z) < radius + this.vehicleRadius(v.kind));
  }
  vehicleRadius(kind: VehicleKind) {
    if (kind === 'car') return CAR_COLLISION_RADIUS;
    if (kind === 'cycle') return CYCLE_COLLISION_RADIUS;
    return BIKE_COLLISION_RADIUS;
  }
  vehicleCapacity(kind: VehicleKind) {
    if (kind === 'car') return 4;
    return 2;
  }
  vehicleForwardSpeed(kind: VehicleKind) {
    if (kind === 'car') return 17;
    if (kind === 'cycle') return 8;
    return 12;
  }
  populationCells(room: Room) {
    const cells = new Set<string>();
    for (const { person } of room.players.values()) {
      const center = person.interior === null ? person : buildings.find(b => b.id === person.interior) ?? person;
      const gx = Math.floor(center.x / POPULATION_CELL_SIZE);
      const gz = Math.floor(center.z / POPULATION_CELL_SIZE);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const x = gx + dx, z = gz + dz;
        if (x * POPULATION_CELL_SIZE < WORLD_LIMIT && (x + 1) * POPULATION_CELL_SIZE > -WORLD_LIMIT
          && z * POPULATION_CELL_SIZE < WORLD_LIMIT && (z + 1) * POPULATION_CELL_SIZE > -WORLD_LIMIT) cells.add(`${x}:${z}`);
      }
    }
    return cells;
  }
  cellAt(x: number, z: number) {
    return `${Math.floor(x / POPULATION_CELL_SIZE)}:${Math.floor(z / POPULATION_CELL_SIZE)}`;
  }
  npcTarget(npc: Npc) {
    // Walk along a clear road verge instead of targeting the middle of houses.
    const gz = Number(npc.cell?.split(':')[1] ?? 0);
    const index = Number(npc.person.id.split('-').at(-1) ?? 0);
    const start = gz * POPULATION_CELL_SIZE + 30 + Math.floor(index / 2) * 80;
    return { x: npc.person.x, z: npc.target.z > start ? start : start + 24 };
  }
  syncPopulation(room: Room) {
    const cells = this.populationCells(room);
    if (room.populationCells?.size === cells.size && [...cells].every(cell => room.populationCells!.has(cell))) return;
    room.populationCells = cells;
    room.trafficCells ??= new Map();
    room.trafficPool ??= [];
    room.trafficRoutes ??= new Map();
    room.npcs = room.npcs.filter(npc => npc.cell && cells.has(npc.cell));
    room.coins = room.coins.filter(coin => cells.has(this.cellAt(coin.x, coin.z)));
    for (const [cell, indices] of room.trafficCells) {
      if (cells.has(cell)) continue;
      for (const index of indices) {
        const vehicle = room.vehicles[index];
        // Vehicles taken by players become permanent; their indices never change.
        if (!vehicle.autopilot || vehicle.owner !== null || [...room.players.values()].some(m => m.person.vehicle === index)) continue;
        vehicle.autopilot = false;
        vehicle.speed = 0;
        vehicle.x = vehicle.z = WORLD_LIMIT + 1000;
        room.trafficPool.push(index);
        room.trafficRoutes.delete(index);
      }
      room.trafficCells.delete(cell);
    }
    for (const cell of cells) {
      const [gx, gz] = cell.split(':').map(Number);
      if (!room.npcs.some(npc => npc.cell === cell)) {
        for (let i = 0; i < 4; i++) {
          const x = gx * POPULATION_CELL_SIZE + 46 + (i % 2) * 80;
          const z = gz * POPULATION_CELL_SIZE + 30 + Math.floor(i / 2) * 80;
          if (inAirport(x, z) || this.blocked(room, x, z, 0.4)) continue;
          const person: Person = { id: `npc-${cell}-${i}`, name: NPC_NAMES[Math.abs(gx + gz + i) % NPC_NAMES.length], color: colors[Math.abs(gx - gz + i) % colors.length], x, z, yaw: 0, vehicle: null, seat: null, interior: null, message: '', score: 0, unlocked: [] };
          room.npcs.push({ person, target: { x, z: z + 24 }, wait: i * 0.4, cell });
        }
      }
      if (room.trafficCells.has(cell)) continue;
      const indices: number[] = [];
      const points = trafficLoop(gx, gz);
      const staticBlocked = (x: number, z: number) => hitsScenery(x, z, CAR_COLLISION_RADIUS);
      const safeLoop = points.every((point, i) => clearRoadSegment(point, points[(i + 1) % points.length], staticBlocked));
      if (safeLoop) for (let i = 0; i < points.length; i++) {
        const { x, z } = points[i];
        if (this.blocked(room, x, z, CAR_COLLISION_RADIUS) || [...room.players.values()].some(m => Math.hypot(m.person.x - x, m.person.z - z) < 8)) continue;
        const next = (i + 1) % points.length;
        const yaw = Math.atan2(points[next].x - x, points[next].z - z);
        const vehicle: CarState = { kind: 'car', color: '#38bdf8', x, z, yaw, speed: TRAFFIC_SPEED, owner: null, autopilot: true };
        const index = room.trafficPool.pop() ?? room.vehicles.length;
        room.vehicles[index] = vehicle;
        room.trafficRoutes.set(index, { points, next });
        indices.push(index);
      }
      room.trafficCells.set(cell, indices);
    }
    this.replenishCoins(room);
  }
  advanceNpcs(room: Room, dt: number) {
    for (const npc of room.npcs) {
      if (npc.wait > 0) {
        npc.wait -= dt;
        continue;
      }
      const p = npc.person;
      const dx = npc.target.x - p.x;
      const dz = npc.target.z - p.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.35) {
        npc.wait = 0.8 + Math.random() * 2.2;
        npc.target = this.npcTarget(npc);
        continue;
      }
      p.yaw = Math.atan2(dx, dz);
      const step = Math.min(2.1 * dt, distance);
      const nextX = p.x + Math.sin(p.yaw) * step;
      const nextZ = p.z + Math.cos(p.yaw) * step;
      if (!this.blocked(room, nextX, nextZ, 0.35)) {
        p.x = nextX;
        p.z = nextZ;
      } else {
        npc.target = this.npcTarget(npc);
        npc.wait = 0.4;
      }
    }
  }
  steerTraffic(room: Room, vehicle: CarState, index: number, dt: number) {
    room.trafficRoutes ??= new Map();
    let route = room.trafficRoutes.get(index);
    if (!route) {
      // Attach traffic retained by development reloads without teleporting it.
      const points = trafficLoop(Math.floor(vehicle.x / 200), Math.floor(vehicle.z / 200));
      const blocked = (x: number, z: number) => hitsScenery(x, z, this.vehicleRadius(vehicle.kind));
      const next = points.map((point, i) => ({ point, i, distance: Math.hypot(point.x - vehicle.x, point.z - vehicle.z) }))
        .sort((a, b) => a.distance - b.distance)
        .find(({ point }) => clearRoadSegment(vehicle, point, blocked))?.i;
      if (next === undefined || !points.every((p, i) => clearRoadSegment(p, points[(i + 1) % points.length], blocked))) { vehicle.speed = 0; return; }
      route = { points, next };
      room.trafficRoutes.set(index, route);
    }
    const target = route.points[route.next];
    const dx = target.x - vehicle.x, dz = target.z - vehicle.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.0001) { route.next = (route.next + 1) % route.points.length; vehicle.speed = 0; return; }
    const step = Math.min(distance, TRAFFIC_SPEED * Math.max(0, Math.min(dt, 0.25)));
    const nextX = vehicle.x + dx / distance * step;
    const nextZ = vehicle.z + dz / distance * step;
    // A blocked lane means wait, never reverse or steer across grass/buildings.
    if (!isTrafficRoad(nextX, nextZ) || this.blocked(room, nextX, nextZ, this.vehicleRadius(vehicle.kind), index)
      || [...room.players.values()].some(m => m.person.interior === null && m.person.vehicle === null && Math.hypot(nextX - m.person.x, nextZ - m.person.z) < 2)) {
      vehicle.speed = 0;
      return;
    }
    vehicle.x = nextX;
    vehicle.z = nextZ;
    vehicle.yaw = Math.atan2(dx, dz);
    vehicle.speed = TRAFFIC_SPEED;
    if (step === distance) route.next = (route.next + 1) % route.points.length;
  }

  platformBlocked(person: Person, x: number, z: number) {
    const station = railwayStations.find(s => s.id === person.station);
    return !station || Math.abs(x - station.x) > 45 || z < 3 || z > 6;
  }
  travel(room: Room, member: Member, id: string) {
    const destination = destinations.find(d => d.id === id);
    const p = member.person;
    if (!destination) { p.message = 'Unknown destination'; return; }
    if (p.vehicle !== null) { p.message = 'Exit your vehicle before travelling'; return; }
    const candidates = [0, -3, 3, -6, 6, -9, 9, -12, 12, -15, 15, -18, 18].map(offset => ({ x: destination.x + offset, z: destination.z }));
    const spawn = candidates.find(point => (destination.station
      ? !this.platformBlocked({ ...p, station: destination.station }, point.x, point.z)
      : !this.blocked(room, point.x, point.z, 0.4))
      && ![...room.players.values()].some(other => other !== member && other.person.interior === null
        && (other.person.station ?? null) === destination.station && Math.hypot(other.person.x - point.x, other.person.z - point.z) < 0.8));
    if (!spawn) { p.message = 'Destination is busy — try again shortly'; return; }
    p.x = spawn.x; p.z = spawn.z; p.yaw = Math.PI;
    p.interior = null; p.seat = null; p.station = destination.station;
    member.input = { ...idle }; member.path = undefined; member.pathTarget = undefined;
    p.message = destination.station ? `${destination.name} · Walk along the platform · E to return to street` : `Arrived at ${destination.name}`;
    this.syncPopulation(room);
  }
  replenishCoins(room: Room) {
    room.coins ??= [];
    for (const cell of room.populationCells ?? []) {
      const [gx, gz] = cell.split(':').map(Number);
      let count = room.coins.filter(c => this.cellAt(c.x, c.z) === cell).length;
      for (let attempts = 0; count < COINS_PER_CELL && attempts < 300; attempts++) {
        const x = gx * POPULATION_CELL_SIZE + Math.floor(Math.random() * POPULATION_CELL_SIZE);
        const z = gz * POPULATION_CELL_SIZE + Math.floor(Math.random() * POPULATION_CELL_SIZE);
        if (inAirportOperations(x, z) || Math.hypot(x, z) < 3 || this.blocked(room, x, z, 0.6)) continue;
        if (room.coins.some(c => Math.hypot(x - c.x, z - c.z) < 3)) continue;
        if ([...room.players.values()].some(m => m.person.interior === null && Math.hypot(x - m.person.x, z - m.person.z) < 2)) continue;
        room.coins.push({ id: randomUUID(), value: Math.floor(Math.random() * 10) + 1, x, z });
        count++;
      }
    }
  }
  advance(room: Room, now: number) {
    if (!room.airportPrepared) {
      // Existing development rooms may still contain city cars in the new airfield.
      const retired = new Set<number>();
      room.trafficPool ??= [];
      room.vehicles.forEach((vehicle, index) => {
        if (!inAirport(vehicle.x, vehicle.z, 8) || vehicle.owner !== null || [...room.players.values()].some(m => m.person.vehicle === index)) return;
        vehicle.x = vehicle.z = WORLD_LIMIT + 1000;
        vehicle.autopilot = false; vehicle.speed = 0;
        room.trafficRoutes?.delete(index);
        room.trafficPool!.push(index); retired.add(index);
      });
      for (const [cell, indices] of room.trafficCells ?? []) room.trafficCells!.set(cell, indices.filter(index => !retired.has(index)));
      room.coins = room.coins.filter(coin => !inAirportOperations(coin.x, coin.z));
      room.npcs = room.npcs.filter(npc => !inAirport(npc.person.x, npc.person.z));
      room.airportPrepared = true;
    }
    this.syncPopulation(room);
    let remaining = Math.min(Math.max((now - room.tick) / 1000, 0), 0.25);
    room.tick = now;
    while (remaining > 0.00001) {
      const dt = Math.min(remaining, 1 / 30); remaining -= dt;
      for (const member of room.players.values()) {
        const p = member.person;
        const input = now - member.seen > 500 ? idle : member.input;
        if (p.seat !== null) continue;
        if (p.vehicle !== null) {
          const index = p.vehicle, v = room.vehicles[index];
          v.owner ??= p.id;
          if (v.owner === p.id) {
            const target = input.brake ? 0 : input.forward * (input.forward < 0 ? 5 : this.vehicleForwardSpeed(v.kind));
            v.speed += (target - v.speed) * (1 - Math.exp(-(input.brake ? 9 : input.forward ? 1.6 : 2.5) * dt));
            const yaw = v.yaw - input.turn * Math.min(Math.abs(v.speed) / 4, 1) * Math.sign(v.speed) * 1.6 * dt;
            const x = v.x + Math.sin(yaw) * v.speed * dt, z = v.z + Math.cos(yaw) * v.speed * dt;
            if (!this.blocked(room, x, z, this.vehicleRadius(v.kind), index)) { v.x = x; v.z = z; v.yaw = yaw; } else v.speed = 0;
          }
          p.x = v.x; p.z = v.z; p.yaw = v.yaw;
        } else {
          let moveDx = 0, moveDz = 0;
          if (input.targetPoint) {
            if (!member.pathTarget || member.pathTarget.x !== input.targetPoint.x || member.pathTarget.z !== input.targetPoint.z) {
              member.pathTarget = input.targetPoint;
              // Compute path (run max 500 nodes to keep it fast)
              const path = findPath(p.x, p.z, input.targetPoint.x, input.targetPoint.z, (x, z) => p.station ? this.platformBlocked(p, x, z) : this.blocked(room, x, z, 0.4), 1.0, 500);
              member.path = path || undefined;
            }
            if (member.path && member.path.length > 0) {
              const nextNode = member.path[0];
              const tx = nextNode.x - p.x;
              const tz = nextNode.z - p.z;
              const dist = Math.hypot(tx, tz);
              if (dist > 0.2) {
                p.yaw = Math.atan2(tx, tz);
                const speed = 5 * dt;
                const step = Math.min(speed, dist);
                moveDx = Math.sin(p.yaw) * step;
                moveDz = Math.cos(p.yaw) * step;
              } else {
                member.path.shift();
                if (member.path.length === 0) input.targetPoint = null;
              }
            } else {
              input.targetPoint = null; // No path found or reached
            }
          } else {
            member.pathTarget = undefined;
            member.path = undefined;
            if (input.turn) {
              p.yaw -= input.turn * 4.0 * dt;
            }
            if (input.forward) {
              const speed = 5 * dt;
              moveDx = Math.sin(p.yaw) * input.forward * speed;
              moveDz = Math.cos(p.yaw) * input.forward * speed;
            }
          }
          if (moveDx !== 0 || moveDz !== 0) {
            let hit = false;
            if (!(p.station ? this.platformBlocked(p, p.x + moveDx, p.z) : p.interior ? blockedInside(p.x + moveDx, p.z) : this.blocked(room, p.x + moveDx, p.z, 0.4))) p.x += moveDx;
            else hit = true;
            if (!(p.station ? this.platformBlocked(p, p.x, p.z + moveDz) : p.interior ? blockedInside(p.x, p.z + moveDz) : this.blocked(room, p.x, p.z + moveDz, 0.4))) p.z += moveDz;
            else hit = true;
            if (hit && input.targetPoint) {
               // Re-calculate on collision? Or just clear it.
               // It's safer to clear it to avoid getting stuck in a loop.
               input.targetPoint = null; 
               member.path = undefined;
            }
          }
        }
      }
      room.vehicles.forEach((vehicle, index) => {
        if (!vehicle.autopilot || vehicle.owner !== null) return;
        if ([...room.players.values()].some(member => member.person.vehicle === index)) return;
        this.steerTraffic(room, vehicle, index, dt);
      });
      this.advanceNpcs(room, dt);
    }

    // Coin collection
    if (!room.coins?.length) this.replenishCoins(room);
    // Upgrade coins retained by the development server during Fast Refresh.
    for (const coin of room.coins) coin.value ??= Math.floor(Math.random() * 10) + 1;
    for (const member of room.players.values()) {
      const p = member.person;
      if (typeof p.score !== 'number') p.score = 0; // Initialize score for older cached players
      if (p.interior !== null || p.station) continue;
      const coinIndex = room.coins.findIndex(c => Math.hypot(p.x - c.x, p.z - c.z) < 1.5);
      if (coinIndex !== -1) {
        const coin = room.coins[coinIndex];
        if (member.userId !== undefined) this.pendingAwards.set(coin.id, { id: coin.id, user_id: member.userId, value: coin.value });
        p.score += coin.value;
        room.coins.splice(coinIndex, 1);
        this.replenishCoins(room);
      }
    }
  }
  join(name: string, displayName: string, now = Date.now(), account?: { id: number; score: number }) {
    this.cleanup(now);
    let room = this.rooms.get(name);
    
    // Disconnect any ghost sessions for the same user before joining
    if (room) {
      for (const [token, member] of room.players) {
        if (account && member.userId === account.id) {
          this.remove(room, token);
        }
      }
      if (!room.players.size) room.emptySince = now;
    }

    if (!room) {
      if (this.rooms.size >= 100) throw new Error('Server full. Try again later.');
      room = { players: new Map(), vehicles: vehicleSpawns.map(v => ({ ...v, yaw: Math.PI, speed: 0, owner: null, autopilot: false })), coins: [], tick: now, npcs: [] };
      this.syncPopulation(room);
      this.rooms.set(name, room);
    }
    if (room.players.size >= 12) throw new Error('This room is full (12 players).');
    room.emptySince = undefined;
    this.advance(room, now);
    const token = randomUUID(), id = randomUUID();
    const index = room.players.size;
    const spawn = Array.from({ length: 120 }, (_, i) => ({ x: (i % 3 - 1) * 0.9, z: Math.floor(i / 3) * 0.9 }))
      .find(point => !this.blocked(room, point.x, point.z, 0.4) && ![...room.players.values()].some(m => m.person.interior === null && Math.hypot(point.x - m.person.x, point.z - m.person.z) < 0.8));
    if (!spawn) throw new Error('Spawn area is blocked. Try again shortly.');
    room.players.set(token, { person: { id, name: displayName, color: colors[index % colors.length], x: spawn.x, z: spawn.z, yaw: Math.PI, vehicle: null, seat: null, interior: null, message: '', score: account?.score ?? 0, unlocked: [] }, input: idle, seen: now, sequence: -1, userId: account?.id });
    this.syncPopulation(room);
    return { token, snapshot: this.snapshot(room, id) };
  }
  snapshot(room: Room, self: string): Snapshot {
    return { serverTime: room.tick, self, players: [...room.players.values()].map(m => ({ ...m.person, y: m.person.station ? RAIL_HEIGHT + 1.05 : m.person.interior === null ? getTerrainHeight(m.person.x, m.person.z) : 0 })), vehicles: room.vehicles.map(v => ({ ...v })), coins: room.coins.map(c => ({ ...c })), npcs: room.npcs.map(npc => ({ ...npc.person, y: getTerrainHeight(npc.person.x, npc.person.z) })) };
  }
  update(name: string, token: string, input: Input, interact: boolean, now = Date.now(), sequence?: number) {
    this.cleanup(now);
    const room = this.rooms.get(name), member = room?.players.get(token);
    if (!room || !member) return null;
    room.npcs ??= [];
    this.syncPopulation(room);
    // A timed-out request can still reach the server after its successor.
    if (sequence !== undefined && sequence <= member.sequence) return this.snapshot(room, member.person.id);
    member.sequence = sequence ?? member.sequence + 1;
    member.seen = now;
    member.input = input;
    this.advance(room, now);
    const p = member.person;
    p.message = '';
    if (input.destination !== undefined) { this.travel(room, member, input.destination); return this.snapshot(room, p.id); }
    if (interact) {
      if (p.station) {
        const station = railwayStations.find(s => s.id === p.station)!;
        const exit = [10, 14, 18, 22].map(z => ({ x: station.x, z })).find(point => !this.blocked(room, point.x, point.z, 0.4)
          && ![...room.players.values()].some(m => m !== member && !m.person.station && m.person.interior === null && Math.hypot(m.person.x - point.x, m.person.z - point.z) < 0.8));
        if (exit) { p.x = exit.x; p.z = exit.z; p.station = null; member.input = { ...idle }; member.path = undefined; member.pathTarget = undefined; }
        else p.message = 'Street exit is blocked — try again shortly';
      } else if (p.vehicle !== null) {
        const index = p.vehicle, v = room.vehicles[index];
        if (Math.abs(v.speed) > 1 && v.owner === p.id) p.message = 'Brake with SPACE before getting out';
        else {
          const distance = v.kind === 'car' ? 2.7 : 1.8;
          const angle = [Math.PI / 2, -Math.PI / 2, Math.PI, 0].find(a => !this.blocked(room, v.x + Math.sin(v.yaw + a) * distance, v.z + Math.cos(v.yaw + a) * distance, 0.4, index));
          if (angle === undefined) p.message = 'Exit blocked — move to an open area';
          else { 
            p.x = v.x + Math.sin(v.yaw + angle) * distance; p.z = v.z + Math.cos(v.yaw + angle) * distance; p.vehicle = null; 
            if (v.owner === p.id) {
              v.speed = 0;
              v.autopilot = false;
              const passengers = [...room.players.values()].filter(m => m.person.vehicle === index && m.person.id !== p.id);
              v.owner = passengers.length > 0 ? passengers[0].person.id : null;
            }
          }
        }
      } else if (p.seat !== null) {
        const seat = seats[p.seat];
        const angle = [0, Math.PI / 2, -Math.PI / 2, Math.PI].find(a => !this.blocked(room, seat.x + Math.sin(seat.yaw + a) * 2, seat.z + Math.cos(seat.yaw + a) * 2, 0.4));
        if (angle === undefined) p.message = 'Not enough room to stand — wait for the path to clear';
        else { p.x = seat.x + Math.sin(seat.yaw + angle) * 2; p.z = seat.z + Math.cos(seat.yaw + angle) * 2; p.seat = null; }
      } else if (p.interior !== null) {
        const building = buildings.find(b => b.id === p.interior)!;
        if (Math.hypot(p.x, p.z - 2.3) > 1.5) p.message = 'Walk to the EXIT door and press E';
        else if (this.blocked(room, building.x, building.z, 0.4)) p.message = 'Entrance blocked outside — try again shortly';
        else { p.interior = null; p.x = building.x; p.z = building.z; p.yaw = 0; }
      } else {
        const stationEntrance = railwayStations.find(s => Math.hypot(p.x - s.x, p.z - 10) < 2.2);
        if (stationEntrance) { this.travel(room, member, stationEntrance.id); return this.snapshot(room, p.id); }
        const target = nearbyInteraction(p.x, p.z, room.vehicles);
        if (!target) p.message = 'Approach a seat, front door, or vehicle and press E';
        else if (target.kind === 'vehicleShop') {
          const item = vehicleShopItems[target.index];
          if (p.score < item.cost) {
            p.message = `${item.name} costs ${item.cost} coins (You have ${p.score}).`;
          } else {
            const spawn = [
              { x: item.spawnX, z: item.spawnZ },
              { x: item.spawnX, z: item.spawnZ + 2.8 },
              { x: item.spawnX, z: item.spawnZ - 2.8 },
              { x: item.spawnX - 2.8, z: item.spawnZ },
            ].find(point => !this.blocked(room, point.x, point.z, this.vehicleRadius(item.kind)));
            if (!spawn) p.message = 'Shop parking is full. Move a vehicle and try again.';
            else {
              p.score -= item.cost;
              if (member.userId !== undefined) {
                const id = randomUUID();
                this.pendingAwards.set(id, { id, user_id: member.userId, value: -item.cost });
              }
              const vehicle: CarState = { kind: item.kind, color: item.color, x: spawn.x, z: spawn.z, yaw: Math.PI / 2, speed: 0, owner: p.id, autopilot: false };
              room.vehicles.push(vehicle);
              p.vehicle = room.vehicles.length - 1;
              p.x = vehicle.x; p.z = vehicle.z; p.yaw = vehicle.yaw;
              p.message = `Purchased ${item.name}!`;
            }
          }
        } else if (target.kind === 'building') {
          const building = buildings[target.index];
          p.unlocked ??= [];
          if (!p.unlocked.includes(building.id) && building.cost !== undefined && building.cost > 0) {
            if (p.score >= building.cost) {
              p.score -= building.cost;
              p.unlocked.push(building.id);
              p.interior = building.id; p.x = 0; p.z = 2.3; p.yaw = Math.PI;
              // To deduct score from backend, we can queue a negative award.
              if (member.userId !== undefined) {
                 const id = randomUUID();
                 this.pendingAwards.set(id, { id, user_id: member.userId, value: -building.cost });
              }
            } else {
              p.message = `${building.name} is locked. Need ${building.cost} coins (You have ${p.score}).`;
            }
          } else {
            p.interior = building.id; p.x = 0; p.z = 2.3; p.yaw = Math.PI;
          }
        } else if (target.kind === 'seat') {
          if ([...room.players.values()].some(m => m.person.seat === target.index)) p.message = 'Someone is already sitting here';
          else { const seat = seats[target.index]; p.seat = target.index; p.x = seat.x; p.z = seat.z; p.yaw = seat.yaw; }
        } else {
          const v = room.vehicles[target.index];
          const capacity = this.vehicleCapacity(v.kind);
          const occupants = [...room.players.values()].filter(m => m.person.vehicle === target.index);
          if (occupants.length >= capacity) p.message = 'This vehicle is full';
          else { 
            v.autopilot = false;
            if (v.owner === null) v.owner = p.id;
            p.vehicle = target.index; p.x = v.x; p.z = v.z; p.yaw = v.yaw; 
          }
        }
      }
    }
    return this.snapshot(room, p.id);
  }
  leave(name: string, token: string) {
    const room = this.rooms.get(name);
    if (room) {
      this.remove(room, token);
      if (!room.players.size) room.emptySince = Date.now();
    }
  }
}
