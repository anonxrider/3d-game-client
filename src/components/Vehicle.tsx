"use client";

function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.45} metalness={0.2} /></mesh>;
}

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SpotLight, Object3D } from 'three';

import Rider from './HumanCharacter';
export { default as Rider } from './HumanCharacter';

import { headLightMaterial, lightingState } from './Lighting';

export default function Vehicle({ kind, color, occupied }: { kind: 'car' | 'bike' | 'cycle'; color: string; occupied: boolean }) {
  const bike = kind === 'bike';
  const cycle = kind === 'cycle';
  const leftLightRef = useRef<SpotLight>(null);
  const rightLightRef = useRef<SpotLight>(null);
  const leftTargetRef = useRef<Object3D>(null), rightTargetRef = useRef<Object3D>(null);

  useFrame((_, delta) => {
    if (leftLightRef.current && leftTargetRef.current) leftLightRef.current.target = leftTargetRef.current;
    if (rightLightRef.current && rightTargetRef.current) rightLightRef.current.target = rightTargetRef.current;
    const alpha = 1 - Math.exp(-12 * Math.min(delta, 0.05));
    const targetIntensity = occupied ? lightingState.night * 5 : 0;
    if (leftLightRef.current) leftLightRef.current.intensity += (targetIntensity - leftLightRef.current.intensity) * alpha;
    if (rightLightRef.current) rightLightRef.current.intensity += (targetIntensity - rightLightRef.current.intensity) * alpha;
  });

  return <group>
    <object3D ref={leftTargetRef} position={[-0.63, 0.3, 8]} />
    <object3D ref={rightTargetRef} position={[0.63, 0.3, 8]} />
    {cycle ? <>
      <Box position={[0, 0.68, 0]} size={[0.18, 0.12, 1.55]} color={color} />
      <Box position={[0, 0.92, -0.15]} size={[0.42, 0.08, 0.8]} color="#475569" />
      <Box position={[0, 0.97, 0.75]} size={[0.85, 0.08, 0.08]} color="#cbd5e1" />
      <Box position={[0, 0.8, 0.28]} size={[0.14, 0.42, 0.08]} color={color} />
    </> : bike ? <>
      <Box position={[0, 0.65, 0]} size={[0.3, 0.3, 1.5]} color={color} />
      <Box position={[0, 0.91, -0.2]} size={[0.45, 0.15, 0.8]} color="#172033" />
      <Box position={[0, 0.85, 0.43]} size={[0.46, 0.42, 0.5]} color={color} />
      <Box position={[0, 1.12, 0.8]} size={[0.85, 0.09, 0.1]} color="#cbd5e1" />
      <Box position={[0, 0.76, 0.86]} size={[0.12, 0.65, 0.12]} color="#cbd5e1" />
      <Box position={[0, 1, 0.94]} size={[0.25, 0.2, 0.08]} color="#fef3c7" />
      <mesh position={[0, 1, 0.99]} material={headLightMaterial}>
        <planeGeometry args={[0.23, 0.18]} />
      </mesh>
    </> : <>
      <Box position={[0, 0.62, 0]} size={[1.9, 0.55, 3.6]} color={color} />
      <Box position={[0, 1.04, -0.1]} size={[1.65, 0.55, 1.85]} color="#19394e" />
      <Box position={[0, 1.36, -0.1]} size={[1.8, 0.14, 1.95]} color={color} />
      {[-0.63, 0.63].map((x, idx) => <group key={x}>
        {/* Front glowing headlights */}
        <mesh position={[x, 0.7, 1.81]} material={headLightMaterial}>
          <boxGeometry args={[0.4, 0.18, 0.05]} />
        </mesh>
        {/* Actual light emitted */}
        {occupied && <spotLight ref={idx === 0 ? leftLightRef : rightLightRef} position={[x, 0.7, 1.81]} angle={Math.PI / 4} penumbra={0.5} distance={30} intensity={0} />}
        <mesh position={[x, 0.7, -1.81]}><boxGeometry args={[0.4, 0.16, 0.04]} /><meshStandardMaterial color="#ef4444" /></mesh>
      </group>)}
    </>}
    {(bike || cycle ? [[0, -0.85], [0, 0.85]] : [[-0.95, -1.1], [0.95, -1.1], [-0.95, 1.1], [0.95, 1.1]]).map(([x, z], i) => (
      <group key={i} position={[x, 0.36, z]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[cycle ? 0.42 : 0.36, cycle ? 0.42 : 0.36, bike || cycle ? 0.2 : 0.32, 16]} /><meshStandardMaterial color="#151b25" /></mesh>
        <mesh><cylinderGeometry args={[cycle ? 0.28 : 0.19, cycle ? 0.28 : 0.19, bike || cycle ? 0.215 : 0.34, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} /></mesh>
      </group>
    ))}
    {occupied && (bike || cycle) && <group position={[0, 0.34, -0.18]}><Rider seated riding /></group>}
  </group>;
}
