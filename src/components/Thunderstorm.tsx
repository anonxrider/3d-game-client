"use client";

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { LineBasicMaterial, LineSegments } from 'three';
import { getWeather } from '@/lib/weather';

export default function Thunderstorm({ clock, interior }: {
  clock: RefObject<{ time: number; received: number }>; interior: boolean;
}) {
  const bolt = useRef<LineSegments>(null);
  const material = useRef<LineBasicMaterial>(null);
  const audio = useRef<AudioContext | null>(null);
  const noise = useRef<AudioBuffer | null>(null);
  const playedStrike = useRef<number | null>(null);
  const previous = useRef<number | null>(null);
  const reducedMotion = useRef(false);
  const positions = useMemo(() => new Float32Array([
    0, 70, 0, -5, 55, 0, -5, 55, 0, 3, 47, 0,
    3, 47, 0, -7, 30, 0, -7, 30, 0, -2, 33, 0,
    -2, 33, 0, -12, 10, 0, 3, 47, 0, 13, 38, 2,
    13, 38, 2, 10, 28, 3,
  ]), []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener('change', update);
    const unlock = () => {
      try {
        if (!audio.current) {
          const context = new AudioContext();
          audio.current = context;
          const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          noise.current = buffer;
        }
        if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
      } catch { /* Sound is optional when browser audio is unavailable. */ }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      media.removeEventListener('change', update);
      if (audio.current) void audio.current.close().catch(() => {});
      audio.current = null;
      noise.current = null;
    };
  }, []);
  useFrame(({ camera }) => {
    const now = clock.current.time + performance.now() - clock.current.received;
    const storm = getWeather(now);
    if (bolt.current && material.current) {
      bolt.current.visible = !interior && !reducedMotion.current && storm.flash > 0;
      // Keep distant lightning visible without adding shadow maps or extra lights.
      bolt.current.position.set(camera.position.x, camera.position.y, camera.position.z - 100);
      material.current.opacity = storm.flash;
    }
    const last = previous.current;
    previous.current = now;
    const context = audio.current;
    if (last === null || now - last > 2000 || document.hidden || storm.rain <= 0 ||
        playedStrike.current === storm.strikeAt || last >= storm.thunderAt || now < storm.thunderAt || !context || context.state !== 'running' || !noise.current) return;
    playedStrike.current = storm.strikeAt;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise.current;
    filter.type = 'lowpass';
    filter.frequency.value = interior ? 180 : 450;
    const start = context.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(interior ? 0.12 : 0.3, start + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 3.8);
    source.connect(filter).connect(gain).connect(context.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start();
    source.stop(start + 4);
  });
  return <lineSegments ref={bolt} frustumCulled={false} visible={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <lineBasicMaterial ref={material} color="#e2edff" transparent opacity={0} fog={false} toneMapped={false} depthWrite={false} />
  </lineSegments>;
}
