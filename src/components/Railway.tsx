"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, InstancedMesh, Object3D } from 'three';
import { getAreaName } from './world';
import { getRailCameraPose, getTrainState, railwayStations, RAIL_HEIGHT, RAIL_LIMIT, STATION_SPACING } from '@/lib/railway';

type Point = { x: number; z: number };
function Block({ at, size, color }: { at: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={at}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>;
}

const Station = memo(function Station({ x }: { x: number }) {
  return <group position={[x, RAIL_HEIGHT, 0]}>
    <Html position={[0, 2 - RAIL_HEIGHT, 10]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <span className="street-sign">Station lift · E</span>
    </Html>
    {[-1, 1].map(side => <group key={side}>
      <Block at={[0, 0.15, side * 4.5]} size={[92, 0.8, 4]} color="#cbd5e1" />
      <Block at={[0, 0.57, side * 2.7]} size={[92, 0.04, 0.25]} color="#facc15" />
      <Block at={[0, 4, side * 4.5]} size={[92, 0.3, 4.5]} color="#164e63" />
      {[-36, -12, 12, 36].map(px => <Block key={px} at={[px, 2.2, side * 5.7]} size={[0.3, 3.6, 0.3]} color="#64748b" />)}
      {[-20, 20].map(px => <Block key={px} at={[px, 1, side * 4.8]} size={[5, 0.6, 0.8]} color="#0e7490" />)}
      <Block at={[0, 1.1, side * 6.45]} size={[92, 1.2, 0.12]} color="#64748b" />
    </group>)}
    <Html position={[0, 5.2, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <span className="railway-sign">{getAreaName(x, 0)} Station<small>ETHERA RAIL · LOCAL SHUTTLE</small></span>
    </Html>
  </group>;
});

function Train({ index, serverTime, focused }: { index: number; serverTime?: number; focused: boolean }) {
  const ref = useRef<Group>(null);
  const clock = useRef({ time: 0, received: 0 });
  useEffect(() => {
    clock.current = { time: serverTime ?? Date.now(), received: performance.now() };
  }, [serverTime]);
  useFrame(({ camera, size }) => {
    if (!ref.current || !clock.current.received) return;
    const state = getTrainState(index, (clock.current.time + performance.now() - clock.current.received) / 1000);
    ref.current.position.set(state.x, RAIL_HEIGHT + 0.4, 0);
    ref.current.rotation.y = state.yaw;
    ref.current.visible = true;
    if (focused) {
      const pose = getRailCameraPose(state.x, size.width / size.height);
      camera.position.set(...pose.position);
      camera.lookAt(...pose.target);
    }
  });
  return <group ref={ref} visible={false}>
    {[-9, 0, 9].map((x, i) => <group key={x} position={[x, 0, 0]}>
      <Block at={[0, 1.7, 0]} size={[8.5, 2.6, 2.6]} color={i === 2 ? '#0891b2' : '#e2e8f0'} />
      <Block at={[0, 3.05, 0]} size={[8.5, 0.2, 2.7]} color="#334155" />
      <Block at={[0, 0.65, 0]} size={[8.5, 0.5, 2.65]} color="#0e7490" />
      {[-1, 1].map(side => <group key={side}>
        {[-2.8, -0.9, 0.9, 2.8].map(wx => <Block key={wx} at={[wx, 2.05, side * 1.31]} size={[1.25, 1.1, 0.04]} color="#164e63" />)}
        {[-2.8, 2.8].map(wx => <mesh key={wx} position={[wx, 0.35, side * 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.25, 10]} /><meshStandardMaterial color="#1e293b" />
        </mesh>)}
      </group>)}
      {i < 2 && <Block at={[4.5, 1, 0]} size={[0.7, 0.3, 0.4]} color="#334155" />}
    </group>)}
    <Block at={[13.3, 2, 0]} size={[0.08, 1.1, 2.1]} color="#082f49" />
    {[-0.8, 0.8].map(z => <mesh key={z} position={[13.32, 1.15, z]}>
      <boxGeometry args={[0.1, 0.3, 0.35]} /><meshStandardMaterial color="#fff7cc" emissive="#fff7cc" emissiveIntensity={0.7} />
    </mesh>)}
  </group>;
}

const Track = memo(function Track({ centerX }: { centerX: number }) {
  const sleepers = useRef<InstancedMesh>(null);
  const start = Math.max(-RAIL_LIMIT - 60, centerX - 200);
  const end = Math.min(RAIL_LIMIT + 60, centerX + 200);
  const count = Math.max(0, Math.floor((end - start) / 2));
  useLayoutEffect(() => {
    if (!sleepers.current) return;
    const object = new Object3D();
    for (let i = 0; i < count; i++) {
      object.position.set(start + i * 2, RAIL_HEIGHT, 0);
      object.updateMatrix(); sleepers.current.setMatrixAt(i, object.matrix);
    }
    sleepers.current.count = count;
    sleepers.current.instanceMatrix.needsUpdate = true;
    sleepers.current.computeBoundingSphere();
  }, [start, count]);
  const supports = Array.from({ length: 11 }, (_, i) => (Math.round(centerX / 40) - 5 + i) * 40 + 6).filter(x => Math.abs(x) <= RAIL_LIMIT);
  return <group>
    {supports.map(x => <group key={x}>
      {[-6, 6].map(z => <Block key={z} at={[x, 5.4, z]} size={[0.9, 11.8, 0.9]} color="#94a3b8" />)}
      <Block at={[x, 11.2, 0]} size={[0.9, 0.8, 13]} color="#94a3b8" />
    </group>)}
    <Block at={[0, RAIL_HEIGHT - 0.45, 0]} size={[RAIL_LIMIT * 2 + 120, 0.6, 5]} color="#64748b" />
    {[-0.9, 0.9].map(z => <Block key={z} at={[0, RAIL_HEIGHT + 0.15, z]} size={[RAIL_LIMIT * 2 + 120, 0.15, 0.12]} color="#cbd5e1" />)}
    <instancedMesh ref={sleepers} args={[undefined, undefined, 200]}>
      <boxGeometry args={[0.3, 0.2, 2.8]} /><meshStandardMaterial color="#765743" />
    </instancedMesh>
  </group>;
});

export default function Railway({ center, serverTime, focusedTrain = null }: { center: Point; serverTime?: number; focusedTrain?: number | null }) {
  const stations = useMemo(() => railwayStations.filter(s => Math.abs(s.x - center.x) < 200), [center.x]);
  const segments = useMemo(() => railwayStations.slice(0, -1).flatMap((station, index) =>
    station.x < center.x + 180 && station.x + STATION_SPACING > center.x - 180 ? [index] : []), [center.x]);
  if (Math.abs(center.z) > 180 || Math.abs(center.x) > RAIL_LIMIT + 200) return null;
  return <group>
    <Track centerX={center.x} />
    {stations.map(station => <Station key={station.id} x={station.x} />)}
    {segments.map(index => <Train key={index} index={index} serverTime={serverTime} focused={focusedTrain === index} />)}
  </group>;
}
