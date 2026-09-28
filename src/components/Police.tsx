"use client";

import { Text } from '@react-three/drei';
import HumanCharacter from './HumanCharacter';
import { trafficAllows } from '@/lib/police';

type Point = [number, number, number];
function Part({ position, size, color, glow = false }: { position: Point; size: Point; color: string; glow?: boolean }) {
  return <mesh position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow ? 2 : 0} /></mesh>;
}

export function PoliceOfficer({ duty, serverTime }: { duty: 'patrol' | 'traffic'; serverTime: number }) {
  const traffic = duty === 'traffic';
  const go = trafficAllows(serverTime, true) || trafficAllows(serverTime, false);
  return <group>
    <HumanCharacter color={traffic ? '#d9f99d' : '#172554'} />
    <Part position={[0, 1.79, 0]} size={[0.31, 0.12, 0.29]} color={traffic ? '#ffffff' : '#172554'} />
    <Part position={[0, 1.74, 0.16]} size={[0.32, 0.035, 0.16]} color="#0f172a" />
    <Part position={[0.11, 1.28, 0.14]} size={[0.07, 0.09, 0.035]} color="#facc15" />
    <Part position={[0, 0.96, 0]} size={[0.43, 0.07, 0.29]} color="#0f172a" />
    <Part position={[-0.23, 1.28, 0.09]} size={[0.08, 0.15, 0.08]} color="#334155" />
    {traffic && <>
      <Part position={[0, 1.14, 0.15]} size={[0.43, 0.045, 0.025]} color="#ffffff" />
      <Part position={[0.42, 1.1, 0]} size={[0.04, 0.65, 0.04]} color="#475569" />
      <mesh position={[0.42, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.21, 0.21, 0.045, 8]} /><meshStandardMaterial color={go ? '#15803d' : '#dc2626'} /></mesh>
      <Text position={[0.42, 1.5, 0.027]} fontSize={0.09} color="white">{go ? 'GO' : 'STOP'}</Text>
    </>}
  </group>;
}

export function PoliceLights({ serverTime }: { serverTime: number }) {
  const flash = Math.floor(serverTime / 350) % 2 === 0;
  return <group>
    <Part position={[0, 1.49, -0.1]} size={[1.2, 0.09, 0.35]} color="#0f172a" />
    <Part position={[-0.38, 1.61, -0.1]} size={[0.42, 0.18, 0.3]} color={flash ? '#ef4444' : '#701a25'} glow={flash} />
    <Part position={[0.38, 1.61, -0.1]} size={[0.42, 0.18, 0.3]} color={flash ? '#172554' : '#3b82f6'} glow={!flash} />
    {([-1, 1] as const).map(side => <group key={side} position={[side * 0.96, 0.68, 0]} rotation={[0, side * Math.PI / 2, 0]}>
      <Part position={[0, 0, 0]} size={[1.7, 0.36, 0.025]} color="#172554" />
      <Text position={[0, 0, 0.02]} fontSize={0.23} color="white">POLICE</Text>
    </group>)}
  </group>;
}
