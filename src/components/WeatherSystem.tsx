"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { getWeather } from "@/lib/weather";
import { lightingState } from "./Lighting";

const DROP_COUNT = 5000;

export default function WeatherSystem({ serverTime, center, mobile }: { serverTime?: number; center: { x: number, z: number }; mobile?: boolean }) {
  const dropsRef = useRef<THREE.InstancedMesh>(null);
  const flashLightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  
  const [geometry, material] = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 3);
    geo.translate(0, 0.25, 0); // Origin at bottom
    const mat = new THREE.MeshBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.4 });
    return [geo, mat];
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const audioContext = useRef<AudioContext | null>(null);
  const lastThunderAt = useRef<number>(0);
  
  useEffect(() => {
    const initAudio = () => {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
      audioContext.current?.close();
    };
  }, []);

  const playThunder = () => {
    const ctx = audioContext.current;
    if (!ctx || ctx.state !== 'running') return;
    
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300; 
    
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 500;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1.5, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 3.8);
    
    noise.connect(filter);
    filter.connect(filter2);
    filter2.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start();
  };

  useFrame(({ clock }) => {
    const time = serverTime ?? 0;
    const weather = getWeather(time);
    
    if (flashLightRef.current) {
      flashLightRef.current.intensity = weather.flash * 4 * (1 - lightingState.night * 0.5);
    }
    
    if (weather.thunderAt > lastThunderAt.current && time > weather.thunderAt && time < weather.thunderAt + 1000) {
      lastThunderAt.current = weather.thunderAt;
      playThunder();
    } else if (time > weather.thunderAt + 1000) {
       lastThunderAt.current = weather.thunderAt;
    }
    
    if (scene.fog instanceof THREE.Fog) {
       const baseColor = new THREE.Color("#bfd6e1");
       const rainColor = new THREE.Color("#64748b");
       const targetColor = baseColor.clone().lerp(rainColor, weather.rain);
       scene.fog.color.lerp(targetColor, 0.05);
    }
    
    if (dropsRef.current) {
      if (weather.rain <= 0.01) {
        dropsRef.current.visible = false;
        return;
      }
      dropsRef.current.visible = true;
      
      const count = Math.floor(DROP_COUNT * weather.rain * (mobile ? 0.3 : 1.0));
      dropsRef.current.count = count;
      
      const t = clock.elapsedTime;
      const radius = mobile ? 40 : 70;
      
      for (let i = 0; i < count; i++) {
        const seed1 = (i * 123.456) % 1;
        const seed2 = (i * 789.012) % 1;
        
        const x = center.x + (seed1 - 0.5) * radius * 2;
        const z = center.z + (seed2 - 0.5) * radius * 2;
        
        const fallT = (t * 18 + i * 2.3) % 20;
        const y = 20 - fallT;
        
        dummy.position.set(x, y, z);
        dummy.rotation.set(0.1, 0, 0.1);
        dummy.updateMatrix();
        dropsRef.current.setMatrixAt(i, dummy.matrix);
      }
      dropsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <directionalLight 
        ref={flashLightRef}
        color="#e0f2fe" 
        position={[50, 100, 50]} 
        intensity={0} 
      />
      <instancedMesh 
        ref={dropsRef} 
        args={[geometry, material, DROP_COUNT]}
        visible={false}
      />
    </group>
  );
}
