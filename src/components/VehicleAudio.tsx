"use client";

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Snapshot } from '@/lib/multiplayer';

type Voice = {
  engine: OscillatorNode;
  siren: OscillatorNode;
  engineGain: GainNode;
  sirenGain: GainNode;
  pan: StereoPannerNode;
};
const RANGE = 55;
const MAX_VOICES = 6;

/** One bounded audio mixer for the world, listening from the player's position. */
export default function VehicleAudio({ snapshot }: { snapshot: Snapshot }) {
  const mixer = useRef<{ context: AudioContext; master: GainNode; voices: Map<number, Voice> } | null>(null);
  const elapsed = useRef(0);

  useEffect(() => {
    const unlock = () => {
      try {
        if (!mixer.current) {
          const context = new AudioContext();
          const master = context.createGain();
          master.gain.value = 0;
          const limiter = context.createDynamicsCompressor();
          master.connect(limiter);
          limiter.connect(context.destination);
          mixer.current = { context, master, voices: new Map() };
        }
        if (mixer.current.context.state === 'suspended') void mixer.current.context.resume().catch(() => {});
      } catch { /* Browsers without audio support can still play the game. */ }
    };
    const silence = () => {
      const state = mixer.current;
      if (!state) return;
      state.master.gain.cancelScheduledValues(state.context.currentTime);
      state.master.gain.setValueAtTime(0, state.context.currentTime);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('blur', silence);
    document.addEventListener('visibilitychange', silence);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('blur', silence);
      document.removeEventListener('visibilitychange', silence);
      const state = mixer.current;
      if (state) {
        for (const voice of state.voices.values()) {
          voice.engine.stop(); voice.siren.stop();
        }
        void state.context.close().catch(() => {});
      }
      mixer.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.08) return;
    elapsed.current = 0;
    const state = mixer.current;
    if (!state || state.context.state !== 'running') return;
    const { context, master, voices } = state;
    const now = context.currentTime;
    const self = snapshot.players.find(p => p.id === snapshot.self);
    const audible = self && self.interior === null && !document.hidden && document.hasFocus();
    master.gain.setTargetAtTime(audible ? 0.42 : 0, now, 0.1);
    const center = self?.vehicle != null ? snapshot.vehicles[self.vehicle] ?? self : self;
    const nearest = audible && center ? snapshot.vehicles.map((vehicle, index) => ({
      vehicle, index, distance: Math.hypot(vehicle.x - center.x, vehicle.z - center.z),
    })).filter(({ vehicle, distance }) => vehicle.kind !== 'cycle' && distance < RANGE
      && (vehicle.autopilot || vehicle.owner !== null || Math.abs(vehicle.speed) > 0.1))
      .sort((a, b) => a.distance - b.distance).slice(0, MAX_VOICES) : [];
    const active = new Set(nearest.map(v => v.index));
    for (const [index, voice] of voices) {
      if (active.has(index)) continue;
      voice.engineGain.gain.setTargetAtTime(0, now, 0.04);
      voice.sirenGain.gain.setTargetAtTime(0, now, 0.04);
      voice.engine.stop(now + 0.2); voice.siren.stop(now + 0.2);
      voice.engine.addEventListener('ended', () => {
        voice.engine.disconnect(); voice.siren.disconnect();
        voice.engineGain.disconnect(); voice.sirenGain.disconnect(); voice.pan.disconnect();
      }, { once: true });
      voices.delete(index);
    }
    for (const { vehicle, index, distance } of nearest) {
      let voice = voices.get(index);
      if (!voice) {
        const engine = context.createOscillator(), siren = context.createOscillator();
        const engineGain = context.createGain(), sirenGain = context.createGain();
        const pan = context.createStereoPanner();
        engine.type = 'triangle'; siren.type = 'sine';
        engineGain.gain.value = 0; sirenGain.gain.value = 0;
        engine.connect(engineGain); siren.connect(sirenGain);
        engineGain.connect(pan); sirenGain.connect(pan); pan.connect(master);
        engine.start(); siren.start();
        voice = { engine, siren, engineGain, sirenGain, pan };
        voices.set(index, voice);
      }
      const volume = Math.pow(1 - distance / RANGE, 2);
      const speed = Math.min(Math.abs(vehicle.speed), 35);
      voice.engine.frequency.setTargetAtTime((vehicle.kind === 'bike' ? 85 : vehicle.service === 'fire' ? 38 : 48) + speed * 3.5, now, 0.12);
      voice.engineGain.gain.setTargetAtTime(volume * (0.12 + speed / 220), now, 0.12);
      const emergency = vehicle.police || vehicle.service;
      const phase = now * (vehicle.service === 'ambulance' ? 3.5 : vehicle.service === 'fire' ? 1.8 : 2.6) + index;
      voice.siren.frequency.setTargetAtTime(680 + Math.sin(phase) * 260, now, 0.07);
      voice.sirenGain.gain.setTargetAtTime(emergency ? volume * 0.17 : 0, now, 0.12);
      if (center) {
        const dx = vehicle.x - center.x, dz = vehicle.z - center.z;
        const right = -dx * Math.cos(center.yaw) + dz * Math.sin(center.yaw);
        voice.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, right / Math.max(distance, 1))), now, 0.12);
      }
    }
  });
  return null;
}
