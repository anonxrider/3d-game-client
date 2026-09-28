"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, MathUtils, Vector3 } from 'three';
import { railwayStations } from "@/lib/railway";
import { getTerrainHeight } from "@/lib/terrain";
import Vehicle, { Rider } from './Vehicle';
import { useKeyboardControls } from './useKeyboardControls';
import { nearbyInteraction, buildings, vehicleShopItems } from './world';
import type { Person, CarState, Snapshot } from '@/lib/multiplayer';

export type Session = { room: string; token: string; snapshot: Snapshot };

function playHorn() {
  try {
    const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(350, ctx.currentTime);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(400, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime + 0.1, 0.1);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.3);
    osc2.onended = () => { void ctx.close(); };
  } catch {}
}

function Actor({ person, self, observingRailway = false }: { person: Person; self: boolean; observingRailway?: boolean }) {
  const initialPerson = person;
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const [initial] = useState<[number, number, number]>([initialPerson.x, (initialPerson.y ?? (initialPerson.interior === null ? getTerrainHeight(initialPerson.x, initialPerson.z) : 0)) - 0.5, initialPerson.z]);
  const targetRef = useRef(new Vector3());
  const cameraRef = useRef(new Vector3());
  const cameraOffsetRef = useRef(new Vector3());
  const cameraReadyRef = useRef(false);
  const cameraLookRef = useRef(new Vector3(initialPerson?.x || 0, 0.3, initialPerson?.z || 0));
  const bobRef = useRef(0);
  const locationRef = useRef(initialPerson?.interior || null);
  const modeRef = useRef(`${initialPerson?.vehicle}:${initialPerson?.seat}:${initialPerson?.station}`);
  const [initialYaw] = useState(initialPerson?.yaw || 0);
  const [initialColor] = useState(initialPerson?.color || "#38bdf8");
  const [initialName] = useState(initialPerson?.name || "");
  const zoomRef = useRef(1);
  const smoothZoomRef = useRef(1);
  useEffect(() => {
    if (!self) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || !(e.target instanceof HTMLCanvasElement)) return;
      const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      zoomRef.current = MathUtils.clamp(zoomRef.current * Math.exp(MathUtils.clamp(pixels, -200, 200) * 0.0015), 0.5, 3);
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [self]);
  useFrame(({ camera }, delta) => {
    const group = groupRef.current;
    if (!group || !person) return;
    const dt = Math.min(delta, 0.05);
    // Smooth out movement to hide Vercel's serverless latency jitter for the local player
    const alpha = 1 - Math.exp(-(self ? 6 : 14) * dt);
    const moving = Math.hypot(group.position.x - person.x, group.position.z - person.z) > 0.025;
    targetRef.current.set(person.x, (person.y ?? (person.interior === null ? getTerrainHeight(person.x, person.z) : 0)) - 0.5, person.z);
    const changedLocation = locationRef.current !== person.interior || Math.hypot(group.position.x - person.x, group.position.z - person.z) > 60;
    const mode = `${person.vehicle}:${person.seat}:${person.station}`;
    const changedMode = modeRef.current !== mode;
    if (changedLocation || changedMode) {
      group.position.copy(targetRef.current); group.rotation.y = person.yaw;
      locationRef.current = person.interior; modeRef.current = mode;
    }
    else group.position.lerp(targetRef.current, alpha);
    group.position.y = (person.station ? (person.y ?? 13.05) : person.interior === null ? getTerrainHeight(group.position.x, group.position.z) : 0) - 0.5;
    const angle = person.yaw - group.rotation.y;
    group.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha;
    if (bodyRef.current) {
      bobRef.current += moving ? dt * 12 : 0;
      bodyRef.current.position.y = MathUtils.damp(bodyRef.current.position.y, person.seat !== null ? 0.09 : moving ? Math.abs(Math.sin(bobRef.current)) * 0.08 : 0, 12, dt);
    }
    if (self && observingRailway) { cameraReadyRef.current = false; return; }
    if (self) {
      const riding = person.vehicle !== null;
      smoothZoomRef.current = MathUtils.damp(smoothZoomRef.current, zoomRef.current, 10, dt);
      const distance = (riding ? 13 : 10) * smoothZoomRef.current;
      const height = (riding ? 7.5 : 5.5) * smoothZoomRef.current;
      // Position and aim share one moving anchor. Separate translation delays
      // made the character drift/shake on screen, especially at wide zoom.
      targetRef.current.copy(group.position);
      targetRef.current.y += 1.3; // Aim nearer head height so low-flying birds stay in view.
      cameraRef.current.set(-Math.sin(group.rotation.y) * distance, height - 0.8, -Math.cos(group.rotation.y) * distance);
      if (changedLocation || changedMode || !cameraReadyRef.current) {
        cameraLookRef.current.copy(targetRef.current);
        cameraOffsetRef.current.copy(cameraRef.current);
        cameraReadyRef.current = true;
      } else {
        cameraLookRef.current.lerp(targetRef.current, 1 - Math.exp(-10 * dt));
        cameraOffsetRef.current.lerp(cameraRef.current, 1 - Math.exp(-8 * dt));
      }
      camera.position.copy(cameraLookRef.current).add(cameraOffsetRef.current);
      if (person.interior === null) camera.position.y = Math.max(camera.position.y, getTerrainHeight(camera.position.x, camera.position.z) + 1.2);
      camera.lookAt(cameraLookRef.current);
    }
  });
  return <group ref={groupRef} position={initial} rotation={[0, initialYaw, 0]} visible={!!person}>
    <group ref={bodyRef} visible={person?.vehicle === null}><Rider color={initialColor} seated={person?.seat !== null} /></group>
    <Html position={[0, person?.vehicle === null ? 2.2 : 2.8, 0]} center style={{ pointerEvents: 'none' }}>
      <span className={`player-label${self ? ' player-label-self' : ''}`}>{initialName}{self ? ' (you)' : ''}</span>
    </Html>
  </group>;
}
const MemoizedActor = React.memo(Actor);

function SharedVehicle({ vehicle }: { vehicle: CarState }) {
  const initialVehicle = vehicle;
  const groupRef = useRef<Group>(null);
  const [initial] = useState<[number, number, number]>([initialVehicle?.x || 0, -0.5, initialVehicle?.z || 0]);
  const [initialYaw] = useState(initialVehicle?.yaw || 0);
  const [kind] = useState(initialVehicle?.kind || 'car');
  const [color] = useState(initialVehicle?.color || '#38bdf8');

  const occupied = vehicle.owner !== null;
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current, alpha = 1 - Math.exp(-14 * Math.min(delta, 0.05));
    g.position.x += (vehicle.x - g.position.x) * alpha;
    g.position.z += (vehicle.z - g.position.z) * alpha;
    g.position.y = getTerrainHeight(g.position.x, g.position.z) - 0.5;
    const angle = vehicle.yaw - g.rotation.y;
    g.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha;
  });
  return <group ref={groupRef} position={initial} rotation={[0, initialYaw, 0]}><Vehicle kind={kind} color={color} occupied={occupied} /></group>;
}
const MemoizedSharedVehicle = React.memo(SharedVehicle);

export const travelDestinationRef = { current: null as string | null };
export const clickTargetRef = { current: null as { x: number, z: number } | null };

export default function Player({ session, observingRailway = false, onSnapshot, onStatus, onConnection, onCount, onInterior }: { session: Session; observingRailway?: boolean; onSnapshot: (snapshot: Snapshot) => void; onStatus: (text: string) => void; onConnection: (text: string) => void; onCount: (count: number) => void; onInterior: (id: string | null) => void }) {
  const [snapshot, setSnapshot] = useState(session.snapshot);
  const { keys, interactRef } = useKeyboardControls();
  const sequenceRef = useRef(0);
  const lastHornRef = useRef(0);
  const observingRef = useRef(observingRailway);
  useEffect(() => {
    observingRef.current = observingRailway;
    clickTargetRef.current = null;
    keys.current.clear();
    interactRef.current = false;
  }, [observingRailway, keys, interactRef]);
  useEffect(() => {
    clickTargetRef.current = null;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    let notice = '', noticeUntil = 0;
    const controller = new AbortController();
    const update = async () => {
      const started = performance.now();
      const sequence = ++sequenceRef.current;
      const held = (...codes: string[]) => !observingRef.current && codes.some(code => keys.current.has(code));
      const destination = travelDestinationRef.current;
      if (destination) { keys.current.clear(); clickTargetRef.current = null; interactRef.current = false; }
      const interact = !observingRef.current && interactRef.current;
      interactRef.current = false;
      const forward = Number(held('KeyW', 'ArrowUp')) - Number(held('KeyS', 'ArrowDown'));
      const turn = Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft'));
      if (forward !== 0 || turn !== 0) clickTargetRef.current = null;
      try {
        const response = await fetch('/api/world', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
          body: JSON.stringify({ action: 'update', room: session.room, token: session.token, sequence, interact, input: {
            destination: destination ?? undefined,
            forward,
            turn,
            brake: observingRef.current || held('Space'),
            targetPoint: observingRef.current ? null : clickTargetRef.current,
          } }),
        });
        if (stopped) return;
        if (response.status === 401) { onConnection('Session expired — leave and rejoin'); return; }
        if (!response.ok) throw new Error('Connection interrupted');
        const next: Snapshot = await response.json();
        if (stopped) return;
        if (travelDestinationRef.current === destination) travelDestinationRef.current = null;
        setSnapshot(next); onSnapshot(next); onCount(next.players.length); onConnection('Connected');
        const me = next.players.find(p => p.id === next.self)!;
        onInterior(me.interior);
        if (me.message) { notice = me.message; noticeUntil = Date.now() + 2000; }
        const target = nearbyInteraction(me.x, me.z, next.vehicles);
        let isVehicleFull = false;
        if (target?.kind === 'vehicle') {
          const v = next.vehicles[target.index];
          const occupants = next.players.filter(p => p.vehicle === target.index).length;
          isVehicleFull = occupants >= (v.kind === 'car' ? 4 : 2);
        }
        const isDriver = me.vehicle !== null && next.vehicles[me.vehicle].owner === me.id;
        
        if (me.vehicle !== null && held('KeyH') && performance.now() - lastHornRef.current > 500) {
          lastHornRef.current = performance.now();
          playHorn();
        }
        
        const hint = me.station ? 'Railway platform · Walk around · E to return to street' : me.seat !== null ? 'Sitting · Press E to stand up'
          : me.interior !== null ? 'Inside · WASD to walk · Approach EXIT and press E to leave'
          : me.vehicle !== null ? (isDriver ? 'WASD / arrows to drive · SPACE brake · H horn · E exit' : 'Passenger · Enjoy the ride · H horn · E exit')
          : target?.kind === 'vehicleShop' ? `Press E to buy ${vehicleShopItems[target.index].name} (${vehicleShopItems[target.index].cost} coins)`
          : target?.kind === 'seat' ? 'Press E to sit down'
          : target?.kind === 'building' ? (!me.unlocked?.includes(buildings[target.index].id) && buildings[target.index].cost > 0 ? `Press E to unlock ${buildings[target.index].name} (${buildings[target.index].cost} coins)` : `Press E to enter ${buildings[target.index].name}`)
          : target?.kind === 'vehicle' ? (isVehicleFull ? `${next.vehicles[target.index].kind} is full` : `Press E to get in ${next.vehicles[target.index].kind}`)
          : railwayStations.some(s => Math.hypot(me.x - s.x, me.z - 10) < 2.2) ? 'Station lift · Press E to go up to the platform'
          : getTerrainHeight(me.x, me.z) > 0 ? `Mountain trail · ${Math.round(getTerrainHeight(me.x, me.z))} m · Keep walking to climb`
          : 'Explore together · E to sit, enter a building, or ride';
        onStatus(Date.now() < noticeUntil ? notice : hint);
      } catch {
        if (!stopped) onConnection('Connection lost — retrying…');
      }
      if (!stopped) timeout = setTimeout(update, Math.max(10, 50 - (performance.now() - started)));
    };
    void update();
    return () => { stopped = true; travelDestinationRef.current = null; clearTimeout(timeout); controller.abort(); };
  }, [session, onSnapshot, keys, interactRef, onStatus, onConnection, onCount, onInterior]);
  const self = snapshot.players.find(p => p.id === snapshot.self);
  const interior = self?.interior ?? null;
  const nearby = (x: number, z: number) => Math.abs(x - (self?.x ?? 0)) < 150 && Math.abs(z - (self?.z ?? 0)) < 150;
  return <>
    {snapshot.players.map(p => p.interior === interior ? <MemoizedActor key={p.id} person={p} self={p.id === snapshot.self} observingRailway={observingRailway} /> : null)}
    {interior === null && snapshot.npcs?.filter(p => nearby(p.x, p.z)).map(p => <MemoizedActor key={p.id} person={p} self={false} />)}
    {interior === null && snapshot.vehicles.map((v, i) => nearby(v.x, v.z) ? <MemoizedSharedVehicle key={i} vehicle={v} /> : null)}
  </>;
}
