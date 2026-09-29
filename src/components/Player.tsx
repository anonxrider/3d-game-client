"use client";
import { pedestrianScale } from '@/lib/pedestrians';
import { useMobileControls } from './useMobileControls';
import VehicleAudio from './VehicleAudio';
import { EmergencyVehicle, EmergencyWorker } from './EmergencyServices';
import { PoliceOfficer, PoliceLights } from './Police';

import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, MathUtils, Vector3 } from 'three';
import { touchMotion } from '@/lib/touch-input';
import { MotionBuffer } from '@/lib/motion-buffer';
import { railwayStations } from "@/lib/railway";
import { getTerrainHeight } from "@/lib/terrain";
import Vehicle, { Rider } from './Vehicle';
import { useKeyboardControls } from './useKeyboardControls';
import { nearbyInteraction, buildings, vehicleShopItems } from './world';
import type { Person, CarState, Snapshot } from '@/lib/multiplayer';
import { restoreSnapshot } from '@/lib/nearby-snapshot';

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

function Actor({ person, self, serverTime, observingRailway = false }: { person: Person; self: boolean; serverTime: number; observingRailway?: boolean }) {
  const [motion] = useState(() => new MotionBuffer());
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
    const previousX = group.position.x, previousZ = group.position.z;
    targetRef.current.set(person.x, (person.y ?? (person.interior === null ? getTerrainHeight(person.x, person.z) : 0)) - 0.5, person.z);
    const changedLocation = locationRef.current !== person.interior || Math.hypot(group.position.x - person.x, group.position.z - person.z) > 60;
    const mode = `${person.vehicle}:${person.seat}:${person.station}`;
    const changedMode = modeRef.current !== mode;
    if (changedLocation || changedMode) {
      group.position.copy(targetRef.current); group.rotation.y = person.yaw;
      locationRef.current = person.interior; modeRef.current = mode;
    }
    const pose = motion.update(person, serverTime, performance.now(), changedLocation || changedMode);
    group.position.x = pose.x;
    group.position.z = pose.z;
    group.rotation.y = pose.yaw;
    const travelled = changedLocation || changedMode ? 0 : Math.hypot(group.position.x - previousX, group.position.z - previousZ);
    const walkingSpeed = delta > 0 ? travelled / delta : 0;
    const moving = walkingSpeed > 0.1 && person.vehicle === null && person.seat === null;
    group.position.y = (person.y !== undefined ? person.y : person.interior === null ? getTerrainHeight(group.position.x, group.position.z) : 0) - 0.5;
    if (bodyRef.current) {
      // Tie the gait to distance travelled and use a rounded wave so each
      // footfall eases through its low point instead of snapping upward.
      bobRef.current = (bobRef.current + (moving ? travelled * 4.8 : 0)) % (Math.PI * 2);
      const bob = moving ? (1 - Math.cos(bobRef.current)) * 0.025 * Math.min(walkingSpeed / 5, 1) : 0;
      bodyRef.current.position.y = MathUtils.damp(bodyRef.current.position.y, person.seat !== null ? 0.09 : bob, 12, dt);
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
        cameraLookRef.current.copy(targetRef.current);
        cameraOffsetRef.current.lerp(cameraRef.current, 1 - Math.exp(-8 * dt));
      }
      camera.position.copy(cameraLookRef.current).add(cameraOffsetRef.current);
      if (person.interior === null) camera.position.y = Math.max(camera.position.y, getTerrainHeight(camera.position.x, camera.position.z) + 1.2);
      camera.lookAt(cameraLookRef.current);
    }
  });
  return <group ref={groupRef} position={initial} rotation={[0, initialYaw, 0]} visible={!!person}>
    <group ref={bodyRef} visible={person?.vehicle === null}>{person.duty === 'paramedic' || person.duty === 'firefighter' ? <EmergencyWorker duty={person.duty} /> : person.duty ? <PoliceOfficer duty={person.duty} serverTime={serverTime} /> : <Rider color={initialColor} seated={person?.seat !== null} appearance={person.appearance} />}</group>
    <Html position={[0, person?.vehicle === null ? 2.2 * pedestrianScale(person.appearance) : 2.8, 0]} center style={{ pointerEvents: 'none' }}>
      <span className={`player-label${self ? ' player-label-self' : ''}`}>{initialName}{self ? ' (you)' : ''}</span>
    </Html>
  </group>;
}
const MemoizedActor = React.memo(Actor);

function SharedVehicle({ vehicle, serverTime }: { vehicle: CarState; serverTime: number }) {
  const [motion] = useState(() => new MotionBuffer());
  const initialVehicle = vehicle;
  const groupRef = useRef<Group>(null);
  const [initial] = useState<[number, number, number]>([initialVehicle?.x || 0, -0.5, initialVehicle?.z || 0]);
  const [initialYaw] = useState(initialVehicle?.yaw || 0);
  const kind = vehicle.kind;
  const color = vehicle.color;

  const occupied = vehicle.owner !== null;
  useFrame(() => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    const teleported = Math.hypot(vehicle.x - g.position.x, vehicle.z - g.position.z) > 60;
    const pose = motion.update(vehicle, serverTime, performance.now(), teleported);
    g.position.x = pose.x;
    g.position.z = pose.z;
    g.position.y = getTerrainHeight(g.position.x, g.position.z) - 0.5;
    g.rotation.y = pose.yaw;
  });
  return <group ref={groupRef} position={initial} rotation={[0, initialYaw, 0]}>{vehicle.service ? <EmergencyVehicle service={vehicle.service} serverTime={serverTime} occupied={occupied} /> : <Vehicle kind={kind} color={vehicle.police ? "#f1f5f9" : color} occupied={occupied} />}{vehicle.police && <PoliceLights serverTime={serverTime} />}</group>;
}
const MemoizedSharedVehicle = React.memo(SharedVehicle);

export const travelDestinationRef = { current: null as string | null };
export const clickTargetRef = { current: null as { x: number, z: number } | null };

export default function Player({ session, observingRailway = false, onSnapshot, onStatus, onConnection, onCount, onInterior }: { session: Session; observingRailway?: boolean; onSnapshot: (snapshot: Snapshot) => void; onStatus: (text: string, hasTarget?: boolean) => void; onConnection: (text: string) => void; onCount: (count: number) => void; onInterior: (id: string | null) => void }) {
  const [snapshot, setSnapshot] = useState(session.snapshot);
  const mobile = useMobileControls();
  const { keys, touchKeys, interactRef, movement, resetControls } = useKeyboardControls();
  const sequenceRef = useRef(0);
  const lastHornRef = useRef(0);
  const observingRef = useRef(observingRailway);
  useEffect(() => {
    observingRef.current = observingRailway;
    clickTargetRef.current = null;
    resetControls();
  }, [observingRailway, resetControls]);
  useEffect(() => {
    clickTargetRef.current = null;
    let stopped = false;
    let socket: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 500;
    let ready = false;
    let lastReceived = performance.now();
    let lastSent = -Infinity;
    let previousControls = '';
    let notice = '', noticeUntil = 0;
    let riding = session.snapshot.players.find(p => p.id === session.snapshot.self)?.vehicle != null;
    let sentTarget: { point: { x: number; z: number }; sequence: number } | null = null;
    const held = (...codes: string[]) => !observingRef.current && codes.some(code => keys.current.has(code) || touchKeys.current.has(code));
    const sendControls = () => {
      if (held('KeyH') && riding && performance.now() - lastHornRef.current > 500) {
        lastHornRef.current = performance.now(); playHorn();
      }
      if (!ready || !socket || socket.readyState !== WebSocket.OPEN) return;
      if (performance.now() - lastReceived > 10000) { socket.close(); return; }
      if (socket.bufferedAmount > 4096) return;
      const destination = travelDestinationRef.current;
      if (destination) { resetControls(); clickTargetRef.current = null; }
      const interact = !observingRef.current && interactRef.current;
      const touch = touchMotion(movement.current, Number(touchKeys.current.has('KeyW')) - Number(touchKeys.current.has('KeyS')), riding);
      const keyboard = (...codes: string[]) => codes.some(code => keys.current.has(code));
      const forward = observingRef.current || destination ? 0 : MathUtils.clamp(Number(keyboard('KeyW', 'ArrowUp')) - Number(keyboard('KeyS', 'ArrowDown')) + Math.round(touch.forward * 100) / 100, -1, 1);
      const turn = observingRef.current || destination ? 0 : MathUtils.clamp(Number(keyboard('KeyD', 'ArrowRight')) - Number(keyboard('KeyA', 'ArrowLeft')) + Math.round(touch.turn * 100) / 100, -1, 1);
      if (forward !== 0 || turn !== 0) clickTargetRef.current = null;
      const input = {
        destination: destination ?? undefined, forward, turn,
        brake: observingRef.current || held('Space'),
        targetPoint: observingRef.current ? null : clickTargetRef.current,
      };
      const controls = JSON.stringify(input);
      // Send changes immediately. Small control heartbeats keep held keys safe
      // (server stops stale controls after 500 ms) and idle sessions alive.
      const heartbeat = forward || turn || input.targetPoint ? 250 : 5000;
      if (!interact && controls === previousControls && performance.now() - lastSent < heartbeat) return;
      const sequence = ++sequenceRef.current;
      socket.send(JSON.stringify({ type: 'input', sequence, interact, input }));
      if (input.targetPoint) sentTarget = { point: input.targetPoint, sequence };
      previousControls = controls;
      lastSent = performance.now();
      interactRef.current = false;
      if (travelDestinationRef.current === destination) travelDestinationRef.current = null;
    };
    const applySnapshot = (next: Snapshot, sequence: number) => {
        const me = next.players.find(p => p.id === next.self);
        if (!me) return;
        sequenceRef.current = Math.max(sequenceRef.current, sequence);
        setSnapshot({ ...next, serverTime: next.serverTime ?? performance.now() }); onSnapshot(next); onCount(next.players.length); onConnection('Connected');
        riding = me.vehicle !== null;
        if (sentTarget && sequence >= sentTarget.sequence && clickTargetRef.current === sentTarget.point && next.targetPoint === null) {
          clickTargetRef.current = null; sentTarget = null;
        }
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
        
        const hint = me.station ? 'Railway platform · Walk around · E to return to street' : me.seat !== null ? 'Sitting · Press E to stand up'
          : me.interior !== null ? 'Inside · WASD to walk · Approach EXIT and press E to leave'
          : me.vehicle !== null ? (isDriver ? 'WASD / arrows to drive · SPACE brake · H horn · E exit' : 'Passenger · Enjoy the ride · H horn · E exit')
          : target?.kind === 'trampoline' ? 'Press E to launch!'
          : target?.kind === 'vehicleShop' ? `Press E to buy ${vehicleShopItems[target.index].name} (${vehicleShopItems[target.index].cost} coins)`
          : target?.kind === 'seat' ? 'Press E to sit down'
          : target?.kind === 'building' ? (!me.unlocked?.includes(buildings[target.index].id) && buildings[target.index].cost > 0 ? `Press E to unlock ${buildings[target.index].name} (${buildings[target.index].cost} coins)` : `Press E to enter ${buildings[target.index].name}`)
          : target?.kind === 'vehicle' ? (isVehicleFull ? `${next.vehicles[target.index].service === "fire" ? "fire engine" : next.vehicles[target.index].service ?? (next.vehicles[target.index].police ? "police car" : next.vehicles[target.index].kind)} is full` : `Press E to get in ${next.vehicles[target.index].service === "fire" ? "fire engine" : next.vehicles[target.index].service ?? (next.vehicles[target.index].police ? "police car" : next.vehicles[target.index].kind)}`)
          : railwayStations.some(s => Math.hypot(me.x - s.x, me.z - 10) < 2.2) ? 'Station lift · Press E to go up to the platform'
          : getTerrainHeight(me.x, me.z) > 0 ? `Mountain trail · ${Math.round(getTerrainHeight(me.x, me.z))} m · Keep walking to climb`
          : 'Explore together · E to sit, enter a building, or ride';
        
        const hasInteractTarget = me.station != null || me.seat !== null || me.interior !== null || me.vehicle !== null || target != null || railwayStations.some(s => Math.hypot(me.x - s.x, me.z - 10) < 2.2);
        onStatus(Date.now() < noticeUntil ? notice : hint, hasInteractTarget);
    };
    const connect = () => {
      if (stopped) return;
      onConnection('Connecting…');
      const url = new URL('/api/world/socket', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(url);
      socket = ws;
      lastReceived = performance.now();
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', room: session.room, token: session.token }));
      ws.onmessage = event => {
        if (stopped || socket !== ws) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'rtc') {
            window.dispatchEvent(new CustomEvent('rtc-receive', { detail: data }));
            return;
          }
          if (data.type !== 'snapshot') return;
          lastReceived = performance.now();
          applySnapshot(restoreSnapshot(data.snapshot), data.sequence);
          if (!ready) {
            ready = true; retryDelay = 500; previousControls = ''; sentTarget = null;
            sendControls();
          }
        } catch { ws.close(1002, 'Invalid snapshot'); }
      };
      ws.onerror = () => ws.close();
      ws.onclose = event => {
        if (stopped || socket !== ws) return;
        ready = false;
        resetControls();
        clickTargetRef.current = null;
        if (event.code === 4001 || event.code === 4002 || event.code === 1008) {
          onConnection(event.code === 4001 ? 'Session expired — leave and rejoin' : 'Connection closed — leave and rejoin');
          return;
        }
        onConnection('Connection lost — reconnecting…');
        reconnect = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 5000);
      };
    };
    const timer = setInterval(() => {
      if (socket && !ready && performance.now() - lastReceived > 10000) socket.close();
      sendControls();
    }, 25);
    const stopInput = () => {
      clickTargetRef.current = null;
      resetControls();
      sendControls();
    };
    const visibility = () => { if (document.hidden) stopInput(); };
    const onSendRtc = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'rtc', target: data.target, payload: data.payload }));
      }
    };
    window.addEventListener('rtc-send', onSendRtc);
    window.addEventListener('blur', stopInput);
    document.addEventListener('visibilitychange', visibility);
    connect();
    return () => {
      window.removeEventListener('rtc-send', onSendRtc);
      window.removeEventListener('blur', stopInput);
      document.removeEventListener('visibilitychange', visibility);
      stopped = true; travelDestinationRef.current = null;
      clearInterval(timer); clearTimeout(reconnect);
      socket?.close();
    };
  }, [session, onSnapshot, keys, touchKeys, interactRef, movement, resetControls, onStatus, onConnection, onCount, onInterior]);
  const self = snapshot.players.find(p => p.id === snapshot.self);
  const interior = self?.interior ?? null;
  const nearby = (x: number, z: number) => Math.abs(x - (self?.x ?? 0)) < (mobile ? 85 : 150) && Math.abs(z - (self?.z ?? 0)) < (mobile ? 85 : 150);
  return <>
    <VehicleAudio snapshot={snapshot} />
    {snapshot.players.map(p => p.interior === interior ? <MemoizedActor key={p.id} person={p} serverTime={snapshot.serverTime ?? 0} self={p.id === snapshot.self} observingRailway={observingRailway} /> : null)}
    {interior === null && snapshot.npcs?.filter(p => nearby(p.x, p.z)).map(p => <MemoizedActor key={p.id} person={p} serverTime={snapshot.serverTime ?? 0} self={false} />)}
    {interior === null && snapshot.vehicles.map((v, i) => nearby(v.x, v.z) ? <MemoizedSharedVehicle key={i} vehicle={v} serverTime={snapshot.serverTime ?? 0} /> : null)}
  </>;
}
