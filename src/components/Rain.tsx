"use client";

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, LineBasicMaterial, LineSegments } from 'three';
import { getTerrainHeight } from '@/lib/terrain';

export default function Rain({ weather, interior }: { weather: RefObject<{ rain: number }>; interior: boolean }) {
  const lines = useRef<LineSegments>(null);
  const material = useRef<LineBasicMaterial>(null);
  const attribute = useRef<BufferAttribute>(null);
  const positions = useMemo(() => new Float32Array(700 * 6), []);
  useFrame(({ camera, clock }) => {
    if (!lines.current || !material.current || !attribute.current) return;
    lines.current.visible = !interior && weather.current.rain > 0.001;
    if (!lines.current.visible) return;
    material.current.opacity = weather.current.rain * 0.5;
    const time = clock.elapsedTime;
    const values = attribute.current.array;
    // A single draw call, fixed particle count, and no allocations in the frame loop.
    for (let i = 0; i < 700; i++) {
      const x = camera.position.x + ((i * 17.371 + time * 2) % 64) - 32;
      const z = camera.position.z + ((i * 29.713) % 64) - 32;
      const y = camera.position.y + 24 - ((i * 3.719 + time * 24) % 48);
      const floor = getTerrainHeight(x, z) - 0.45;
      const offset = i * 6;
      values[offset] = x;
      values[offset + 1] = Math.max(floor, y);
      values[offset + 2] = z;
      values[offset + 3] = y > floor ? x - 0.1 : x;
      values[offset + 4] = Math.max(floor, y - 1.2);
      values[offset + 5] = z;
    }
    attribute.current.needsUpdate = true;
  });
  return <lineSegments ref={lines} frustumCulled={false} visible={false}>
    <bufferGeometry><bufferAttribute ref={attribute} attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <lineBasicMaterial ref={material} color="#bcd3e5" transparent opacity={0} depthWrite={false} />
  </lineSegments>;
}
