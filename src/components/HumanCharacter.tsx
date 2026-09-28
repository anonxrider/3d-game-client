"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';

// All avatars reuse these low-poly resources, including when entering vehicles.
const roundedGeometry = new SphereGeometry(1, 12, 8);
const skin = new MeshStandardMaterial({ color: '#c68d68', roughness: 0.85 });
const hair = new MeshStandardMaterial({ color: '#29201d', roughness: 1 });
const trousers = new MeshStandardMaterial({ color: '#283747', roughness: 0.95 });
const shoes = new MeshStandardMaterial({ color: '#1b2028', roughness: 0.8 });
const eyes = new MeshStandardMaterial({ color: '#241d19', roughness: 0.6 });

type Point = [number, number, number];
function Shape({ position, scale, material }: { position: Point; scale: Point; material: MeshStandardMaterial }) {
  return <mesh position={position} scale={scale} geometry={roundedGeometry} material={material} castShadow receiveShadow dispose={null} />;
}

export default function HumanCharacter({ seated = false, riding = false, color = '#38bdf8' }: { seated?: boolean; riding?: boolean; color?: string }) {
  const shirt = useMemo(() => new MeshStandardMaterial({ color, roughness: 0.9 }), [color]);
  useEffect(() => () => shirt.dispose(), [shirt]);
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null);
  const leftElbow = useRef<Group>(null), rightElbow = useRef<Group>(null);
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null), rightKnee = useRef<Group>(null);
  const motion = useRef({ position: new Vector3(), previous: new Vector3(), ready: false, phase: 0, weight: 0 });

  useFrame((_, delta) => {
    if (!root.current) return;
    const state = motion.current;
    root.current.getWorldPosition(state.position);
    const distance = state.ready ? Math.hypot(state.position.x - state.previous.x, state.position.z - state.previous.z) : 0;
    state.previous.copy(state.position);
    state.ready = true;
    const dt = Math.min(delta, 0.05);
    // Ignore teleports and tie the stride to distance rather than frame rate.
    const speed = distance < 1 && delta > 0 ? distance / delta : 0;
    const walking = !seated && speed > 0.08;
    state.weight = MathUtils.damp(state.weight, walking ? Math.min(speed / 3, 1) : 0, 12, dt);
    if (walking) state.phase = (state.phase + distance * 4.8) % (Math.PI * 2);
    const swing = Math.sin(state.phase) * state.weight;
    const pose = (joint: Group | null, angle: number) => {
      if (joint) joint.rotation.x = MathUtils.damp(joint.rotation.x, angle, 18, dt);
    };
    pose(leftLeg.current, seated ? -1.4 : swing * 0.55);
    pose(rightLeg.current, seated ? -1.4 : -swing * 0.55);
    pose(leftKnee.current, seated ? 1.45 : 0.06 + Math.max(0, -swing) * 0.65);
    pose(rightKnee.current, seated ? 1.45 : 0.06 + Math.max(0, swing) * 0.65);
    pose(leftArm.current, seated ? (riding ? -0.95 : -0.3) : -swing * 0.4);
    pose(rightArm.current, seated ? (riding ? -0.95 : -0.3) : swing * 0.4);
    pose(leftElbow.current, seated ? (riding ? -0.45 : -1) : -0.14 - Math.max(0, swing) * 0.18);
    pose(rightElbow.current, seated ? (riding ? -0.45 : -1) : -0.14 - Math.max(0, -swing) * 0.18);
    if (torso.current) {
      torso.current.rotation.x = MathUtils.damp(torso.current.rotation.x, riding ? 0.18 : walking ? 0.035 : 0, 10, dt);
      torso.current.rotation.z = MathUtils.damp(torso.current.rotation.z, seated ? 0 : swing * 0.025, 10, dt);
    }
  });

  return <group ref={root}>
    <group position={[0, seated ? 0.6 : 0.87, 0]}>
      <Shape position={[0, 0.015, 0]} scale={[0.2, 0.14, 0.13]} material={trousers} />
      <group ref={torso} rotation={[riding ? 0.18 : 0, 0, 0]}>
        <Shape position={[0, 0.29, 0]} scale={[0.25, 0.32, 0.145]} material={shirt} />
        <Shape position={[0, 0.565, 0]} scale={[0.068, 0.1, 0.07]} material={skin} />
        <group position={[0, 0.76, 0]}>
          <Shape position={[0, 0, 0]} scale={[0.135, 0.18, 0.135]} material={skin} />
          <Shape position={[0, 0.09, -0.025]} scale={[0.14, 0.105, 0.128]} material={hair} />
          <Shape position={[0, -0.055, 0.065]} scale={[0.1, 0.095, 0.085]} material={skin} />
          <Shape position={[0, -0.01, 0.131]} scale={[0.025, 0.039, 0.034]} material={skin} />
          {([-1, 1] as const).map(side => <group key={side}>
            <Shape position={[side * 0.132, -0.012, 0]} scale={[0.027, 0.047, 0.03]} material={skin} />
            <Shape position={[side * 0.05, 0.029, 0.122]} scale={[0.014, 0.01, 0.008]} material={eyes} />
          </group>)}
        </group>
        {([-1, 1] as const).map(side => <group key={side} ref={side === -1 ? leftArm : rightArm}
          position={[side * 0.255, 0.47, 0]} rotation={[seated ? (riding ? -0.95 : -0.3) : 0, 0, side * 0.07]}>
          <Shape position={[0, -0.075, 0]} scale={[0.088, 0.125, 0.095]} material={shirt} />
          <Shape position={[0, -0.205, 0]} scale={[0.062, 0.13, 0.063]} material={skin} />
          <group ref={side === -1 ? leftElbow : rightElbow} position={[0, -0.3, 0]} rotation={[seated ? (riding ? -0.45 : -1) : -0.14, 0, 0]}>
            <Shape position={[0, -0.115, 0]} scale={[0.052, 0.14, 0.055]} material={skin} />
            <Shape position={[0, -0.265, 0.008]} scale={[0.046, 0.072, 0.032]} material={skin} />
          </group>
        </group>)}
      </group>
      {([-1, 1] as const).map(side => <group key={side} ref={side === -1 ? leftLeg : rightLeg}
        position={[side * 0.108, -0.035, 0]} rotation={[seated ? -1.4 : 0, 0, 0]}>
        <Shape position={[0, -0.17, 0]} scale={[0.096, 0.215, 0.105]} material={trousers} />
        <group ref={side === -1 ? leftKnee : rightKnee} position={[0, -0.36, 0]} rotation={[seated ? 1.45 : 0.06, 0, 0]}>
          <Shape position={[0, -0.16, 0]} scale={[0.073, 0.195, 0.08]} material={trousers} />
          <Shape position={[0, -0.36, 0.05]} scale={[0.082, 0.063, 0.145]} material={shoes} />
        </group>
      </group>)}
    </group>
  </group>;
}
