"use client";

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PointLight } from 'three';
import { Text } from '@react-three/drei';
import { streetProps, type BusConfig, type PetConfig } from './world';
import HumanCharacter from './HumanCharacter';

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
function Bus({ config }: { config?: BusConfig }) {
  const { type = 'city', name = 'CITY BUS', color1 = '#fbbf24', color2 = '#fef3c7' } = config || {};
  const isMini = type === 'mini';
  const isDouble = type === 'double';
  
  const busRef = useRef<THREE.Group>(null);
  const ped1 = useRef<THREE.Group>(null);
  const ped2 = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const totalT = clock.elapsedTime;
    const cycleT = totalT % 15;
    const stopIndex = Math.floor(totalT / 15) % 5;
    const startZ = 200 - stopIndex * 100;
    
    let busZ = startZ;
    if (cycleT >= 5) {
      busZ = startZ - ((cycleT - 5) / 10) * 100;
    }
    if (busRef.current) busRef.current.position.z = busZ;
    
    if (ped1.current) {
      if (cycleT < 1) {
        ped1.current.visible = false;
      } else if (cycleT < 3) {
        ped1.current.visible = true;
        const p = (cycleT - 1) / 2;
        ped1.current.position.set(1.4 + 1.6 * p, 0.9, 0 - 1.5 * p);
      } else {
        ped1.current.visible = true;
        ped1.current.position.set(3, 0.9, startZ - busZ - 1.5);
      }
    }
    
    if (ped2.current) {
      if (cycleT < 2) {
        ped2.current.visible = true;
        ped2.current.position.set(3, 0.9, startZ - busZ + 1.5);
      } else if (cycleT < 4) {
        ped2.current.visible = true;
        const p = (cycleT - 2) / 2;
        ped2.current.position.set(3 - 1.6 * p, 0.9, (startZ - busZ + 1.5) * (1 - p));
      } else if (cycleT < 5) {
        ped2.current.visible = false;
      } else {
        ped2.current.visible = true;
        ped2.current.position.set(3, 0.9, (startZ - 100) - busZ + 1.5);
      }
    }
  });

  return <group>
    <group ref={busRef}>
      <group scale={[1, isDouble ? 1.6 : 1, isMini ? 0.7 : 1]}>
        <Block at={[0, 1.5, 0]} size={[2.8, 2.3, 8.4]} color={color1} />
        <Block at={[0, 2.77, 0]} size={[2.8, 0.24, 8.4]} color={color2} />
        <Block at={[0, 2.05, 4.21]} size={[2.4, 1, 0.05]} color="#21465c" />
        <Block at={[0, 0.68, 4.24]} size={[2.7, 0.24, 0.1]} color="#374151" />
        {[-1, 1].map(side => <group key={side}>
          {[-2.7, -1.35, 0, 1.35, 2.7].map(z => <Block key={z} at={[side * 1.41, 2.02, z]} size={[0.04, 0.9, 1.1]} color="#21465c" />)}
          <Block at={[side * 1.41, 1.25, 0]} size={[0.04, 0.17, 8]} color="#f8fafc" />
          <Block at={[side * 0.9, 1, 4.24]} size={[0.4, 0.3, 0.05]} color="#fff7c2" />
        </group>)}
      </group>
      {[-1, 1].map(side => <group key={side}>
        {[-2.65 * (isMini ? 0.7 : 1), 2.65 * (isMini ? 0.7 : 1)].map(z => <mesh key={z} position={[side * 1.3, 0.55, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.2, 16]} /><meshStandardMaterial color="#172033" />
        </mesh>)}
      </group>)}
      <Sign at={[0, (isDouble ? 1.6 : 1) * 2.55, (isMini ? 0.7 : 1) * 4.3]}>{name}</Sign>
      
      <group ref={ped1}>
        <group position={[0, -0.9, 0]}><HumanCharacter color="#ef4444" /></group>
      </group>
      <group ref={ped2}>
        <group position={[0, -0.9, 0]}><HumanCharacter color="#3b82f6" /></group>
      </group>
    </group>
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

function CrowdPerson({ color, seed }: { color: string, seed: number }) {
  const ref = useRef<THREE.Group>(null);
  
  const state = useRef({
     targetX: Math.cos(seed) * 2,
     targetZ: Math.sin(seed) * 2,
     waitTime: seed,
  });

  useFrame((_, delta) => {
    if (!ref.current) return;
    const s = state.current;
    
    if (s.waitTime > 0) {
       s.waitTime -= delta;
       return;
    }
    
    const dx = s.targetX - ref.current.position.x;
    const dz = s.targetZ - ref.current.position.z;
    const dist = Math.hypot(dx, dz);
    
    if (dist < 0.1) {
       const angle = Math.random() * Math.PI * 2;
       const rad = Math.random() * 2.5;
       s.targetX = Math.cos(angle) * rad;
       s.targetZ = Math.sin(angle) * rad;
       s.waitTime = Math.random() * 5 + 2;
    } else {
       const speed = 1.2;
       const moveDist = Math.min(speed * delta, dist);
       const moveX = (dx / dist) * moveDist;
       const moveZ = (dz / dist) * moveDist;
       ref.current.position.x += moveX;
       ref.current.position.z += moveZ;
       
       const targetYaw = Math.atan2(dx, dz);
       let diff = targetYaw - ref.current.rotation.y;
       while (diff > Math.PI) diff -= Math.PI * 2;
       while (diff < -Math.PI) diff += Math.PI * 2;
       
       ref.current.rotation.y += diff * Math.min(delta * 8, 1);
    }
  });

  return (
    <group ref={ref} position={[Math.cos(seed) * 2, 0, Math.sin(seed) * 2]}>
      <HumanCharacter color={color} />
    </group>
  );
}

function Crowd() {
  return <group>
    {Array.from({ length: 5 }).map((_, i) => {
      const color = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i];
      return <CrowdPerson key={i} color={color} seed={i} />;
    })}
  </group>;
}

function ZebraPedestrian({ offset, direction, delay }: { offset: number, direction: number, delay: number }) {
  const ref = useRef<THREE.Group>(null);
  const color = useMemo(() => ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#38bdf8', '#fbbf24'][Math.floor(Math.random() * 7)], []);
  
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const cycle = (clock.elapsedTime + delay) % 20;
    
    let z = 0;
    let targetYaw = 0;
    const startZ = -3.8 * direction;
    const endZ = 3.8 * direction;
    
    if (cycle < 2) {
       z = startZ;
       targetYaw = direction > 0 ? 0 : Math.PI;
    } else if (cycle < 8) {
       const p = (cycle - 2) / 6;
       z = startZ + (endZ - startZ) * p;
       targetYaw = direction > 0 ? 0 : Math.PI;
    } else if (cycle < 10) {
       z = endZ;
       targetYaw = direction > 0 ? 0 : Math.PI;
    } else if (cycle < 12) {
       z = endZ;
       targetYaw = direction > 0 ? Math.PI : 0;
    } else if (cycle < 18) {
       const p = (cycle - 12) / 6;
       z = endZ + (startZ - endZ) * p;
       targetYaw = direction > 0 ? Math.PI : 0;
    } else {
       z = startZ;
       targetYaw = direction > 0 ? Math.PI : 0;
    }
    
    ref.current.position.set(offset, 0, z);
    
    // simple rotation wrapping
    let diff = targetYaw - ref.current.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ref.current.rotation.y += diff * Math.min(delta * 10, 1);
  });

  return (
    <group ref={ref}>
      <HumanCharacter color={color} />
    </group>
  );
}

function ZebraCrossing() {
  return <group position={[0, 0.52, 0]}>
    {Array.from({ length: 6 }).map((_, i) => (
      <mesh key={i} position={[(i - 2.5) * 1.5, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[0.8, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
    ))}
    <ZebraPedestrian offset={-1.5} direction={1} delay={0} />
    <ZebraPedestrian offset={1.5} direction={-1} delay={3} />
    <ZebraPedestrian offset={0} direction={1} delay={10} />
  </group>;
}

function Fountain() {
  const waterRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.children.forEach((child, i) => {
        const t = (clock.elapsedTime * 1.5 + i * 0.17) % 2; 
        const radius = t * 1.2;
        const angle = i * 2.4; 
        child.position.x = Math.cos(angle) * radius;
        child.position.z = Math.sin(angle) * radius;
        
        const y = 2.6 + 4 * t - 3 * t * t;
        child.position.y = Math.max(1.0, y);
        child.scale.setScalar(Math.max(0, 1 - t * 0.5));
      });
    }
  });

  return <group>
    <mesh position={[0, 0.8, 0]} receiveShadow>
      <cylinderGeometry args={[2.5, 2.5, 0.6, 16]} />
      <meshStandardMaterial color="#94a3b8" roughness={0.8} />
    </mesh>
    <mesh position={[0, 1.0, 0]} receiveShadow>
      <cylinderGeometry args={[2.3, 2.3, 0.1, 16]} />
      <meshStandardMaterial color="#38bdf8" roughness={0.2} metalness={0.8} transparent opacity={0.8} />
    </mesh>
    <mesh position={[0, 1.7, 0]} castShadow>
      <cylinderGeometry args={[0.4, 0.6, 1.4, 8]} />
      <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
    </mesh>
    <mesh position={[0, 2.55, 0]} castShadow>
      <cylinderGeometry args={[1.2, 0.4, 0.3, 8]} />
      <meshStandardMaterial color="#94a3b8" roughness={0.8} />
    </mesh>
    <group ref={waterRef}>
      {Array.from({ length: 60 }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.08, 4, 4]} />
          <meshStandardMaterial color="#7dd3fc" roughness={0.1} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  </group>;
}

function Pet({ config, seed }: { config?: PetConfig, seed: number }) {
  const { kind = 'dog', color = '#fcd34d' } = config || {};
  const ref = useRef<THREE.Group>(null);
  const legsRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  
  const state = useRef({
     targetX: 0,
     targetZ: 0,
     waitTime: seed,
     walking: false,
  });

  const isDog = kind === 'dog';
  const scale = isDog ? 0.8 : 0.5;

  useFrame((_, delta) => {
    if (!ref.current) return;
    const s = state.current;
    
    if (s.waitTime > 0) {
       s.waitTime -= delta;
       s.walking = false;
    } else {
      const dx = s.targetX - ref.current.position.x;
      const dz = s.targetZ - ref.current.position.z;
      const dist = Math.hypot(dx, dz);
      
      if (dist < 0.1) {
         const angle = Math.random() * Math.PI * 2;
         const rad = Math.random() * (isDog ? 8 : 4);
         s.targetX = Math.cos(angle) * rad;
         s.targetZ = Math.sin(angle) * rad;
         s.waitTime = Math.random() * 8 + 2;
      } else {
         s.walking = true;
         const speed = isDog ? 2.0 : 1.2;
         const moveDist = Math.min(speed * delta, dist);
         const moveX = (dx / dist) * moveDist;
         const moveZ = (dz / dist) * moveDist;
         ref.current.position.x += moveX;
         ref.current.position.z += moveZ;
         
         const targetYaw = Math.atan2(dx, dz);
         let diff = targetYaw - ref.current.rotation.y;
         while (diff > Math.PI) diff -= Math.PI * 2;
         while (diff < -Math.PI) diff += Math.PI * 2;
         
         ref.current.rotation.y += diff * Math.min(delta * 8, 1);
      }
    }
    
    const t = Date.now() / (isDog ? 100 : 150);
    const swing = s.walking ? Math.sin(t) * 0.6 : 0;
    
    if (legsRef.current) {
       legsRef.current.children[0].rotation.x = swing;
       legsRef.current.children[1].rotation.x = -swing;
       legsRef.current.children[2].rotation.x = -swing;
       legsRef.current.children[3].rotation.x = swing;
    }
    
    if (tailRef.current) {
       tailRef.current.rotation.y = s.walking ? Math.sin(t * 1.5) * 0.4 : 0;
    }
  });

  return (
    <group ref={ref} scale={scale} position={[0, 0.4, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      
      <mesh position={[0, 0.55, 0.35]} castShadow>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      
      <mesh position={[0, 0.5, 0.5]} castShadow>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color={isDog ? '#0f172a' : '#f472b6'} roughness={0.8} />
      </mesh>

      <mesh position={[-0.1, 0.72, 0.3]} castShadow>
        <boxGeometry args={[0.05, 0.15, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0.1, 0.72, 0.3]} castShadow>
        <boxGeometry args={[0.05, 0.15, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      <group ref={tailRef} position={[0, 0.45, -0.3]}>
         <mesh position={[0, 0, -0.15]} rotation={[0.4, 0, 0]} castShadow>
           <boxGeometry args={[0.05, 0.05, 0.3]} />
           <meshStandardMaterial color={color} roughness={0.8} />
         </mesh>
      </group>

      <group ref={legsRef}>
        {[[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.2], [0.1, -0.2]].map(([x, z], i) => (
          <group key={i} position={[x, 0.25, z]}>
            <mesh position={[0, -0.125, 0]} castShadow>
               <boxGeometry args={[0.08, 0.25, 0.08]} />
               <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function StreetProps({ props = streetProps, center = { x: 0, z: 0 } }: { props?: StreetProp[]; center?: { x: number; z: number } }) {
  const lit = useMemo(() => new Set(props.filter(p => p.kind === 'streetlight')
    .sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z)).slice(0, 4)), [props, center]);
  return <group>{props.map((prop) => <group key={`${prop.kind}:${prop.x}:${prop.z}`} position={[prop.x, -0.5, prop.z]} rotation={[0, prop.yaw, 0]}>
    {prop.kind === 'bench' && <Bench />}
    {prop.kind === 'chair' && <Bench chair />}
    {prop.kind === 'fruit' && <FruitStall />}
    {prop.kind === 'bus' && <Bus config={prop.busConfig} />}
    {prop.kind === 'hotel' && <Hotel />}
    {prop.kind === 'crowd' && <Crowd />}
    {prop.kind === 'zebra' && <ZebraCrossing />}
    {prop.kind === 'fountain' && <Fountain />}
    {prop.kind === 'pet' && <Pet config={prop.petConfig} seed={prop.x * 123 + prop.z * 456} />}
    {prop.kind === 'streetlight' && <StreetLight illuminate={lit.has(prop)} />}
  </group>)}</group>;
}
