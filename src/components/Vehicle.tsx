"use client";

function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.45} metalness={0.2} /></mesh>;
}

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, SpotLight, Object3D } from 'three';

export function Rider({ seated = false, color = "#38bdf8" }: { seated?: boolean; color?: string }) {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const lastPosRef = useRef({ x: 0, z: 0 });

  useFrame((_, delta) => {
    if (seated || !groupRef.current) return;
    
    // Auto-detect movement based on world position
    const worldPos = new Vector3();
    groupRef.current.getWorldPosition(worldPos);
    const moving = Math.hypot(worldPos.x - lastPosRef.current.x, worldPos.z - lastPosRef.current.z) > 0.01;
    lastPosRef.current.x = worldPos.x;
    lastPosRef.current.z = worldPos.z;

    timeRef.current += moving ? delta * 12 : 0;
    
    // Smooth transition
    const alpha = 1 - Math.exp(-15 * delta);
    const targetAngle = moving ? Math.sin(timeRef.current) * 0.9 : 0;
    
    if (leftArmRef.current) leftArmRef.current.rotation.x += (targetAngle - leftArmRef.current.rotation.x) * alpha;
    if (rightArmRef.current) rightArmRef.current.rotation.x += (-targetAngle - rightArmRef.current.rotation.x) * alpha;
    if (leftLegRef.current) leftLegRef.current.rotation.x += (-targetAngle - leftLegRef.current.rotation.x) * alpha;
    if (rightLegRef.current) rightLegRef.current.rotation.x += (targetAngle - rightLegRef.current.rotation.x) * alpha;
  });

  return <group ref={groupRef}>
    <Box position={[0, 1.45, 0]} size={[0.5, 0.5, 0.5]} color="#fcd34d" />
    <Box position={[0, 1.55, -0.04]} size={[0.54, 0.35, 0.5]} color="#172554" />
    <Box position={[0, 0.9, 0]} size={[0.6, 0.65, 0.35]} color={color} />
    
    <Box position={[-0.14, 1.46, 0.26]} size={[0.07, 0.07, 0.03]} color="#0f172a" />
    <Box position={[0.14, 1.46, 0.26]} size={[0.07, 0.07, 0.03]} color="#0f172a" />

    <group position={[-0.4, 1.1, 0]} rotation={[seated ? -0.9 : 0, 0, 0]} ref={leftArmRef}>
      <Box position={[0, -0.25, 0]} size={[0.18, 0.6, 0.18]} color="#fcd34d" />
    </group>
    <group position={[0.4, 1.1, 0]} rotation={[seated ? -0.9 : 0, 0, 0]} ref={rightArmRef}>
      <Box position={[0, -0.25, 0]} size={[0.18, 0.6, 0.18]} color="#fcd34d" />
    </group>

    <group position={[-0.2, 0.6, 0]} rotation={[seated ? -1.1 : 0, 0, 0]} ref={leftLegRef}>
      <Box position={[0, -0.3, 0]} size={[0.23, 0.6, 0.25]} color="#1e293b" />
    </group>
    <group position={[0.2, 0.6, 0]} rotation={[seated ? -1.1 : 0, 0, 0]} ref={rightLegRef}>
      <Box position={[0, -0.3, 0]} size={[0.23, 0.6, 0.25]} color="#1e293b" />
    </group>
  </group>;
}

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
    {occupied && (bike || cycle) && <group position={[0, 0.34, -0.18]}><Rider seated /></group>}
  </group>;
}
