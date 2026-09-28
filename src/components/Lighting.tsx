"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AmbientLight, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, Object3D, PointsMaterial } from 'three';
import { getDayCycle } from '@/lib/day-night';
import { getWeather } from '@/lib/weather';
import Rain from './Rain';
import Thunderstorm from './Thunderstorm';

export const windowMaterial = new MeshStandardMaterial({ color: '#a5e8f5', metalness: 0.3, roughness: 0.2, emissive: '#ffd58a', emissiveIntensity: 0 });
export const streetLightMaterial = new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe4a3', emissiveIntensity: 0 });
export const headLightMaterial = new MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4ce', emissiveIntensity: 0 });
export const lightingState = { night: 0 };

export default function DayNightCycle({ serverTime, interior = false }: { serverTime?: number; interior?: boolean }) {
  const ambient = useRef<AmbientLight>(null), sun = useRef<DirectionalLight>(null), hemisphere = useRef<HemisphereLight>(null);
  const target = useRef<Object3D>(null), sunDisc = useRef<Mesh>(null), moon = useRef<Mesh>(null), sky = useRef<Group>(null), stars = useRef<PointsMaterial>(null);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const weather = useRef({ rain: 0 });
  const clock = useRef({ time: 0, received: 0 });
  const palette = useMemo(() => ({ sky: new Color(), flash: new Color('#dce8ff'), overcast: new Color('#576777'), day: new Color('#bfd6e1'), night: new Color('#0b1630'), dusk: new Color('#d48d78'), sun: new Color('#fff3df'), moon: new Color('#9bbafa') }), []);
  const positions = useMemo(() => {
    const values = new Float32Array(600 * 3);
    let seed = 71;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 600; i++) {
      const azimuth = random() * Math.PI * 2, y = 0.1 + random() * 0.9, radius = Math.sqrt(1 - y * y);
      values.set([Math.cos(azimuth) * radius * 400, y * 400, Math.sin(azimuth) * radius * 400], i * 3);
    }
    return values;
  }, []);
  useEffect(() => { clock.current = { time: serverTime ?? Date.now(), received: performance.now() }; }, [serverTime]);
  useFrame(({ camera, scene }) => {
    const now = clock.current.time + performance.now() - clock.current.received;
    const state = getDayCycle(now);
    const storm = getWeather(now);
    weather.current.rain = storm.rain;
    const flash = interior || reducedMotion.current ? 0 : storm.flash;
    lightingState.night = state.night;
    palette.sky.copy(palette.night).lerp(palette.day, state.daylight).lerp(palette.dusk, state.twilight * 0.65).lerp(palette.overcast, weather.current.rain * (0.25 + state.daylight * 0.5));
    palette.sky.lerp(palette.flash, flash * 0.55);
    scene.background = palette.sky;
    if (scene.fog) scene.fog.color.copy(palette.sky);
    if (ambient.current) ambient.current.intensity = interior ? 0.65 : 0.3 + state.daylight * 0.2 + flash * 1.5;
    if (hemisphere.current) hemisphere.current.intensity = 0.35 + state.daylight * 0.65;
    if (target.current) target.current.position.copy(camera.position);
    if (sun.current && target.current) {
      sun.current.target = target.current;
      const sign = state.elevation >= 0 ? 1 : -1;
      sun.current.position.set(camera.position.x + Math.cos(state.angle) * 70 * sign, camera.position.y + Math.abs(state.elevation) * 70 + 5, camera.position.z + 25);
      sun.current.intensity = (0.25 + state.daylight * 1.25) * (1 - weather.current.rain * 0.7);
      sun.current.color.copy(palette.moon).lerp(palette.sun, state.daylight);
    }
    if (sky.current) sky.current.position.copy(camera.position);
    if (sunDisc.current) {
      sunDisc.current.position.set(Math.cos(state.angle) * 380, state.elevation * 380, -90);
      sunDisc.current.visible = state.elevation > -0.05 && weather.current.rain < 0.5;
    }
    if (moon.current) {
      moon.current.position.set(-Math.cos(state.angle) * 380, -state.elevation * 380, 90);
      moon.current.visible = state.elevation < 0.05 && weather.current.rain < 0.5;
    }
    if (stars.current) stars.current.opacity = state.night * (1 - weather.current.rain);
    windowMaterial.emissiveIntensity = state.night * 0.7;
    streetLightMaterial.emissiveIntensity = state.night * 2.5;
    headLightMaterial.emissiveIntensity = state.night * 2;
  });
  return <>
    <Rain weather={weather} interior={interior} />
    <Thunderstorm clock={clock} interior={interior} />
    <ambientLight ref={ambient} intensity={0.5} />
    <hemisphereLight ref={hemisphere} args={['#dbeafe', '#6b7155', 1]} />
    <directionalLight ref={sun} intensity={1.5} />
    <object3D ref={target} />
    <group ref={sky}>
      <mesh ref={sunDisc}><sphereGeometry args={[9, 16, 12]} /><meshBasicMaterial color="#fff1b5" fog={false} toneMapped={false} /></mesh>
      <mesh ref={moon}><sphereGeometry args={[7, 16, 12]} /><meshBasicMaterial color="#dbeafe" fog={false} toneMapped={false} /></mesh>
      <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial ref={stars} color="#e2e8f0" size={1.2} transparent opacity={0} depthWrite={false} fog={false} /></points>
    </group>
  </>;
}
