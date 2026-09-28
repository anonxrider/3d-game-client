"use client";
import { Html } from '@react-three/drei';
import { buildings, interiorFurniture } from './world';
function Box({ at, size, color }: { at: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={at} receiveShadow castShadow><boxGeometry args={size} /><meshStandardMaterial color={color} /></mesh>;
}
export default function Interior({ id }: { id: string }) {
  return <group position={[0, -0.5, 0]}>
    <Box at={[0, -0.1, 0]} size={[8, 0.2, 6]} color="#d9b98f" />
    <Box at={[0, 1.4, -3.1]} size={[8.2, 2.8, 0.2]} color="#efe6d6" />
    {[-1, 1].map(side => <Box key={side} at={[side * 4.1, 0.6, 0]} size={[0.2, 1.2, 6.4]} color="#efe6d6" />)}
    <Box at={[0, 0.015, 0]} size={[2.8, 0.03, 3]} color="#528b96" />
    <Box at={[0, 0.025, 2.6]} size={[1.4, 0.05, 0.6]} color="#22c55e" />
    <Html position={[0, 0.3, 2.8]} center><span className="street-sign">EXIT · E</span></Html>
    <Html position={[0, 3.2, -3]} center><span className="street-sign">{buildings.find(b => b.id === id)?.name} · Welcome inside</span></Html>
    {interiorFurniture.map(f => <group key={f.kind} position={[f.x, 0, f.z]}>
      <Box at={[0, f.kind === 'table' ? 0.65 : 0.35, 0]} size={[f.width, f.kind === 'table' ? 0.15 : 0.7, f.depth]} color={f.kind === 'sofa' ? '#c37351' : f.kind === 'bed' ? '#a6c9db' : '#76523b'} />
      {f.kind === 'sofa' && <Box at={[0, 0.85, -0.5]} size={[f.width, 0.8, 0.2]} color="#c37351" />}
      {f.kind === 'bed' && <Box at={[0, 0.75, -0.7]} size={[1.3, 0.2, 0.5]} color="#fff7ed" />}
      {f.kind === 'table' && [-0.4, 0.4].map(x => <Box key={x} at={[x, 0.3, 0]} size={[0.12, 0.6, 0.5]} color="#76523b" />)}
    </group>)}
  </group>;
}
