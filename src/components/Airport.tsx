"use client";
import { memo, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group } from 'three';
import { airport, airportCamera, getAircraftState, parkedAircraft } from '@/lib/airport';

type XYZ = [number, number, number];
function Block({ at, size, color }: { at: XYZ; size: XYZ; color: string }) {
  return <mesh position={at}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>;
}
const Plane = memo(function Plane({ color, gearRef }: { color: string; gearRef?: React.RefObject<Group | null> }) {
  return <group>
    <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.85, 10, 4, 12]} /><meshStandardMaterial color="#f1f5f9" /></mesh>
    <Block at={[0, 0.05, -0.3]} size={[18, 0.18, 2.2]} color={color} />
    <Block at={[0, 0.3, -4.5]} size={[6.5, 0.15, 1.3]} color={color} />
    <Block at={[0, 1.3, -4.8]} size={[0.18, 2.8, 1.8]} color={color} />
    <Block at={[0, 0.5, 4.8]} size={[1.25, 0.5, 1.4]} color="#164e63" />
    {[-1, 1].map(side => <group key={side}>
      {[-3, -1.8, -0.6, 0.6, 1.8, 3].map(z => <Block key={z} at={[side * 0.83, 0.28, z]} size={[0.04, 0.3, 0.42]} color="#0e7490" />)}
      <mesh position={[side * 3.7, -0.6, 0.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.55, 0.55, 2.4, 10]} /><meshStandardMaterial color="#475569" /></mesh>
    </group>)}
    <group ref={gearRef}>
      {[[-1.1, -1.15, -1.2], [1.1, -1.15, -1.2], [0, -1.15, 3.8]].map((point, i) => <mesh key={i} position={point as XYZ} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.25, 10]} /><meshStandardMaterial color="#111827" />
      </mesh>)}
    </group>
  </group>;
});
const AirportSite = memo(function AirportSite() {
  return <group position={[airport.x, 0, airport.z]}>
    <Block at={[0, -0.43, 0]} size={[330, 0.06, 220]} color="#70855d" />
    <Block at={[0, -0.36, 20]} size={[290, 0.08, 20]} color="#263445" />
    <Block at={[0, -0.35, 55]} size={[230, 0.08, 9]} color="#475569" />
    {[-110, 100].map(x => <Block key={x} at={[x, -0.35, 37.5]} size={[9, 0.08, 35]} color="#475569" />)}
    {Array.from({ length: 19 }, (_, i) => <Block key={i} at={[-135 + i * 15, -0.3, 20]} size={[7, 0.03, 0.45]} color="#f8fafc" />)}
    {[-1, 1].map(side => <group key={side}>
      {[-140, -100, -60, -20, 20, 60, 100, 140].map(x => <mesh key={x} position={[x, -0.1, 11 * side + 20]}>
        <sphereGeometry args={[0.2, 6, 4]} /><meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.5} />
      </mesh>)}
      {[-6, -3, 0, 3, 6].map(z => <Block key={z} at={[side * 126, -0.29, 20 + z]} size={[10, 0.03, 1]} color="#ffffff" />)}
    </group>)}
    <Block at={[-25, -0.35, -25]} size={[145, 0.08, 55]} color="#94a3b8" />
    <Block at={[0, 3, -70]} size={[72, 7, 18]} color="#dbe4e8" />
    <Block at={[0, 3.1, -60.9]} size={[65, 3.8, 0.15]} color="#164e63" />
    <Block at={[0, 6.8, -67]} size={[78, 0.6, 26]} color="#0e7490" />
    <Block at={[100, 7, -70]} size={[6, 15, 6]} color="#94a3b8" />
    <Block at={[100, 15.8, -70]} size={[10, 3.5, 10]} color="#164e63" />
    <Block at={[100, 17.8, -70]} size={[12, 0.5, 12]} color="#e2e8f0" />
    {parkedAircraft.map((plane, i) => <group key={i} position={[plane.x, 1.2, plane.z]} rotation={[0, Math.PI, 0]}><Plane color={i ? '#f97316' : '#0e7490'} /></group>)}
    <Html position={[0, 9, -65]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><span className="railway-sign">{airport.name}<small>TERMINAL · RUNWAY 09 / 27</small></span></Html>
  </group>;
});
function FlyingPlane({ index, serverTime }: { index: number; serverTime?: number }) {
  const ref = useRef<Group>(null), gear = useRef<Group>(null), tilt = useRef<Group>(null);
  const clock = useRef({ time: 0, received: 0 });
  useEffect(() => { clock.current = { time: serverTime ?? Date.now(), received: performance.now() }; }, [serverTime]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const state = getAircraftState(index, (clock.current.time + performance.now() - clock.current.received) / 1000);
    ref.current.position.set(state.x, state.y, state.z);
    const turn = state.yaw - ref.current.rotation.y;
    ref.current.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-8 * Math.min(delta, 0.05)));
    if (tilt.current) tilt.current.rotation.set(state.pitch, 0, state.bank);
    if (gear.current) gear.current.visible = state.gear;
  });
  return <group ref={ref}><group ref={tilt}><Plane color={index ? '#f97316' : '#0284c7'} gearRef={gear} /></group></group>;
}
export default function Airport({ focused, serverTime }: { focused: boolean; serverTime?: number }) {
  const camera = useThree(state => state.camera);
  useEffect(() => {
    if (!focused) return;
    const far = camera.far;
    return () => { camera.far = far; camera.updateProjectionMatrix(); };
  }, [focused, camera]);
  useFrame(({ size, camera: frameCamera }) => {
    if (!focused) return;
    const pose = airportCamera(size.width / size.height);
    frameCamera.position.set(pose.x, pose.y, pose.z);
    if (frameCamera.far !== pose.far) { frameCamera.far = pose.far; frameCamera.updateProjectionMatrix(); }
    frameCamera.lookAt(airport.x, 0, airport.z);
  });
  return <group><AirportSite /><FlyingPlane index={0} serverTime={serverTime} /><FlyingPlane index={1} serverTime={serverTime} /></group>;
}
