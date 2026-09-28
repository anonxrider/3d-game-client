"use client";

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointLight } from 'three';
import { Text } from '@react-three/drei';
import { streetProps } from './world';

type XYZ = [number, number, number];
type StreetProp = (typeof streetProps)[number];
function Block({ at, size, color }: { at: XYZ; size: XYZ; color: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>;
}
function Sign({ at, children, red = false }: { at: XYZ; children: string; red?: boolean }) {
  return (
    <Text
      position={at}
      fontSize={red ? 0.9 : 0.32}
      color={red ? '#ffffff' : '#f8fafc'}
      anchorX="center"
      anchorY="middle"
      outlineWidth={red ? 0.08 : 0.025}
      outlineColor={red ? '#991b1b' : '#0f172a'}
      maxWidth={4.8}
    >
      {children}
    </Text>
  );
}
function Bench({ chair = false }: { chair?: boolean }) {
  const width = chair ? 0.8 : 2.8;
  return <group>
    {[0, 1, 2].map(i => <Block key={i} at={[0, 0.65, -0.28 + i * 0.27]} size={[width, 0.12, 0.22]} color="#b67948" />)}
    {[0.95, 1.2].map(y => <Block key={y} at={[0, y, -0.32]} size={[width, 0.18, 0.12]} color="#b67948" />)}
    {[-1, 1].flatMap(x => [-1, 1].map(z => <Block key={`${x}:${z}`} at={[x * (width / 2 - 0.1), 0.3, z * 0.3]} size={[0.1, 0.6, 0.1]} color="#293747" />))}
    {[-1, 1].map(x => <Block key={x} at={[x * (width / 2 - 0.1), 0.95, -0.32]} size={[0.1, 0.7, 0.1]} color="#293747" />)}
  </group>;
}
function FruitStall() {
  return <group>
    <Block at={[0, 0.5, 0]} size={[3.2, 1, 1.6]} color="#ad784a" />
    <Block at={[0, 1.06, 0]} size={[3.4, 0.12, 1.8]} color="#e6c59a" />
    {[-1.5, 1.5].map(x => <Block key={x} at={[x, 1.6, -0.7]} size={[0.1, 3.2, 0.1]} color="#e6c59a" />)}
    {Array.from({ length: 8 }, (_, i) => <Block key={i} at={[-1.4875 + i * 0.425, 2.9, 0]} size={[0.425, 0.16, 2]} color={i % 2 ? '#fff3d6' : '#e75b4c'} />)}
    {['#ef4444', '#f59e0b', '#84cc16'].map((color, bin) => <group key={color} position={[(bin - 1) * 1.05, 1.2, 0]}>
      <Block at={[0, -0.02, 0]} size={[0.96, 0.18, 1.25]} color="#74472d" />
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * 0.27, 0.15, (Math.floor(i / 3) - 1) * 0.33]} castShadow>
        <sphereGeometry args={[0.16, 8, 6]} /><meshStandardMaterial color={color} roughness={0.65} />
      </mesh>)}
    </group>)}
    <Sign at={[0, 2.48, 1.04]}>FRESH FRUIT</Sign>
  </group>;
}
function Bus() {
  return <group>
    <Block at={[0, 1.5, 0]} size={[2.8, 2.3, 8.4]} color="#fbbf24" />
    <Block at={[0, 2.77, 0]} size={[2.8, 0.24, 8.4]} color="#fef3c7" />
    <Block at={[0, 2.05, 4.21]} size={[2.4, 1, 0.05]} color="#21465c" />
    <Block at={[0, 0.68, 4.24]} size={[2.7, 0.24, 0.1]} color="#374151" />
    {[-1, 1].map(side => <group key={side}>
      {[-2.7, -1.35, 0, 1.35, 2.7].map(z => <Block key={z} at={[side * 1.41, 2.02, z]} size={[0.04, 0.9, 1.1]} color="#21465c" />)}
      <Block at={[side * 1.41, 1.25, 0]} size={[0.04, 0.17, 8]} color="#f8fafc" />
      <Block at={[side * 0.9, 1, 4.24]} size={[0.4, 0.3, 0.05]} color="#fff7c2" />
      {[-2.65, 2.65].map(z => <mesh key={z} position={[side * 1.3, 0.55, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.2, 16]} /><meshStandardMaterial color="#172033" />
      </mesh>)}
    </group>)}
    <Sign at={[0, 2.55, 4.3]}>CITY BUS · PARKED</Sign>
  </group>;
}
function Hotel() {
  return <group>
    <Block at={[0, 4.5, 0]} size={[10, 9, 8]} color="#f2e9de" />
    <Block at={[0, 9.2, 0]} size={[10, 0.4, 8]} color="#a73540" />
    <Block at={[-4.6, 4.5, 4.04]} size={[0.6, 9, 0.1]} color="#dc3545" />
    <Block at={[4.6, 4.5, 4.04]} size={[0.6, 9, 0.1]} color="#dc3545" />
    {[3.8, 6.6].flatMap(y => [-3, -1, 1, 3].map(x => <group key={`${x}:${y}`}>
      <Block at={[x, y, 4.08]} size={[1.4, 1.7, 0.12]} color="#28576b" />
      <Block at={[x, y - 0.9, 4.14]} size={[1.6, 0.12, 0.25]} color="#c3b6ab" />
    </group>))}
    <Block at={[0, 1.2, 4.08]} size={[2.2, 2.4, 0.14]} color="#28576b" />
    <Block at={[0, 1.2, 4.17]} size={[0.08, 2.4, 0.05]} color="#cbd5e1" />
    <Block at={[0, 8.25, 4.15]} size={[4, 1.1, 0.2]} color="#df2437" />
    <Sign at={[0, 8.25, 4.3]} red>OYO</Sign>
    <Sign at={[0, 2.65, 4.3]}>HOTEL · RECEPTION</Sign>
  </group>;
}
import { streetLightMaterial, lightingState } from "./Lighting";

function LampGlow() {
  const light = useRef<PointLight>(null);
  useFrame(() => { if (light.current) light.current.intensity = lightingState.night * 35; });
  return <pointLight ref={light} position={[0, 4.5, 1.6]} color="#ffe4a3" intensity={0} distance={12} decay={2} />;
}
function StreetLight({ illuminate }: { illuminate: boolean }) {
  return <group>
    {illuminate && <LampGlow />}
    {/* Pole */}
    <Block at={[0, 2.5, 0]} size={[0.15, 5, 0.15]} color="#475569" />
    {/* Arm */}
    <Block at={[0, 4.9, 0.8]} size={[0.1, 0.1, 1.6]} color="#475569" />
    {/* Bulb housing */}
    <Block at={[0, 4.9, 1.6]} size={[0.4, 0.2, 0.6]} color="#334155" />
    {/* Glowing Bulb */}
    <mesh position={[0, 4.8, 1.6]} material={streetLightMaterial}>
      <boxGeometry args={[0.3, 0.1, 0.5]} />
    </mesh>
  </group>;
}

export default function StreetProps({ props = streetProps, center = { x: 0, z: 0 } }: { props?: StreetProp[]; center?: { x: number; z: number } }) {
  const lit = useMemo(() => new Set(props.filter(p => p.kind === 'streetlight')
    .sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z)).slice(0, 4)), [props, center]);
  return <group>{props.map((prop) => <group key={`${prop.kind}:${prop.x}:${prop.z}`} position={[prop.x, -0.5, prop.z]} rotation={[0, prop.yaw, 0]}>
    {prop.kind === 'bench' && <Bench />}
    {prop.kind === 'chair' && <Bench chair />}
    {prop.kind === 'fruit' && <FruitStall />}
    {prop.kind === 'bus' && <Bus />}
    {prop.kind === 'hotel' && <Hotel />}
    {prop.kind === 'streetlight' && <StreetLight illuminate={lit.has(prop)} />}
  </group>)}</group>;
}
