"use client";

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Measure over several seconds so brief loading spikes do not resize the canvas.
export default function AdaptiveResolution() {
  const setDpr = useThree(state => state.setDpr);
  const setFrameloop = useThree(state => state.setFrameloop);
  const sample = useRef({ elapsed: 0, frames: 0, dpr: 1 });
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.5);
    sample.current = { elapsed: 0, frames: 0, dpr };
    setDpr(dpr);
    const visibility = () => {
      sample.current.elapsed = 0;
      sample.current.frames = 0;
      setFrameloop(document.hidden ? 'never' : 'always');
    };
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [setDpr, setFrameloop]);
  useFrame((_, delta) => {
    if (document.hidden || delta > 0.25) return;
    const stats = sample.current;
    stats.elapsed += delta;
    stats.frames++;
    if (stats.elapsed < 3) return;
    const fps = stats.frames / stats.elapsed;
    const ceiling = Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1 : 1.5);
    const next = fps < 42 ? Math.max(0.65, stats.dpr - 0.15)
      : fps > 57 ? Math.min(ceiling, stats.dpr + 0.1) : stats.dpr;
    if (Math.abs(next - stats.dpr) > 0.01) { stats.dpr = next; setDpr(next); }
    stats.elapsed = 0;
    stats.frames = 0;
  });
  return null;
}
