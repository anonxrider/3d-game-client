"use client";

import { Text } from '@react-three/drei';
import Vehicle from './Vehicle';
import HumanCharacter from './HumanCharacter';

type Point = [number, number, number];
function Part({ at, size, color, glow = false }: { at: Point; size: Point; color: string; glow?: boolean }) {
  return <mesh position={at}><boxGeometry args={size} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow ? 2 : 0} roughness={0.55} /></mesh>;
}

/** Compact service bodies share the existing car footprint and driving physics. */
export function EmergencyVehicle({ service, serverTime, occupied }: { service: 'ambulance' | 'fire'; serverTime: number; occupied: boolean }) {
  const fire = service === 'fire';
  const flash = Math.floor(serverTime / 350) % 2 === 0;
  return <group>
    <Vehicle kind="car" color={fire ? '#dc2626' : '#f8fafc'} occupied={occupied} />
    <Part at={[0, 1.27, -0.63]} size={[1.85, 1.2, 2.2]} color={fire ? '#b91c1c' : '#f8fafc'} />
    <Part at={[0, 1.69, 0.8]} size={[1.6, 0.12, 0.25]} color="#334155" />
    {[-1, 1].map(side => <group key={side}>
      <Part at={[side * 0.56, 1.8, 0.8]} size={[0.38, 0.16, 0.24]} color={side === -1 ? '#ef4444' : '#3b82f6'} glow={side === -1 ? flash : !flash} />
      <group position={[side * 0.94, 1.2, -0.63]} rotation={[0, side * Math.PI / 2, 0]}>
        <Part at={[0, -0.32, 0]} size={[2.1, 0.18, 0.025]} color={fire ? '#fde047' : '#f97316'} />
        <Text position={[0, 0.32, 0.025]} fontSize={0.16} color={fire ? 'white' : '#0f766e'}>{fire ? 'FIRE & RESCUE' : 'AMBULANCE'}</Text>
        {fire ? <>
          <Part at={[0, 0, 0]} size={[1.7, 0.32, 0.025]} color="#94a3b8" />
          {[-0.65, -0.22, 0.22, 0.65].map(x => <Part key={x} at={[x, 0, 0.022]} size={[0.025, 0.28, 0.02]} color="#475569" />)}
        </> : <>
          <Part at={[0, 0, 0.02]} size={[0.13, 0.4, 0.03]} color="#0d9488" />
          <Part at={[0, 0, 0.025]} size={[0.4, 0.13, 0.03]} color="#0d9488" />
        </>}
      </group>
    </group>)}
    {fire && <>
      {[-0.4, 0.4].map(x => <Part key={x} at={[x, 1.97, -0.5]} size={[0.07, 0.09, 2.45]} color="#e2e8f0" />)}
      {[-1.55, -1.2, -0.85, -0.5, -0.15, 0.2, 0.55].map(z => <Part key={z} at={[0, 1.97, z]} size={[0.8, 0.065, 0.07]} color="#cbd5e1" />)}
      <mesh position={[0, 1.25, -1.76]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.075, 6, 16]} /><meshStandardMaterial color="#fbbf24" /></mesh>
    </>}
    <Part at={[0, 0.5, -1.83]} size={[1.65, 0.12, 0.08]} color="#cbd5e1" />
  </group>;
}

export function EmergencyWorker({ duty }: { duty: 'paramedic' | 'firefighter' }) {
  const fire = duty === 'firefighter';
  return <group>
    <HumanCharacter color={fire ? '#b45309' : '#0d9488'} />
    <Part at={[0, 1.14, 0.15]} size={[0.44, 0.06, 0.03]} color="#fef08a" />
    <Part at={[0, 0.97, 0]} size={[0.43, 0.07, 0.29]} color="#334155" />
    {fire ? <>
      <mesh position={[0, 1.8, 0]}><sphereGeometry args={[0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#facc15" /></mesh>
      <Part at={[0, 1.8, 0]} size={[0.43, 0.045, 0.38]} color="#facc15" />
      {[-0.11, 0.11].map(x => <mesh key={x} position={[x, 1.16, -0.22]}><cylinderGeometry args={[0.085, 0.085, 0.46, 8]} /><meshStandardMaterial color="#fde047" /></mesh>)}
    </> : <>
      <Part at={[0.1, 1.31, 0.15]} size={[0.09, 0.12, 0.03]} color="white" />
      <Part at={[0.35, 0.62, 0]} size={[0.24, 0.3, 0.3]} color="#f8fafc" />
      <Part at={[0.35, 0.62, 0.16]} size={[0.06, 0.19, 0.02]} color="#0d9488" />
      <Part at={[0.35, 0.62, 0.17]} size={[0.17, 0.06, 0.02]} color="#0d9488" />
    </>}
  </group>;
}
