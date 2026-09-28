"use client";

import { useEffect, useRef, type PointerEvent } from 'react';

export const TOUCH_INPUT_EVENT = 'ethera-touch-input';
export const TOUCH_MOVE_EVENT = 'ethera-touch-move';
export const TOUCH_RESET_EVENT = 'ethera-touch-reset';
export type TouchInput = { code: string; pressed: boolean };
export type TouchMove = { forward: number; turn: number };

function Control({ code, label, icon }: { code: string; label: string; icon: string }) {
  const pointer = useRef<number | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const release = () => {
      pointer.current = null;
      button.current?.removeAttribute('data-pressed');
      window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed: false } }));
    };
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener('blur', release);
    window.addEventListener(TOUCH_RESET_EVENT, release);
    window.addEventListener('resize', release);
    document.addEventListener('visibilitychange', visibility);
    return () => { release(); window.removeEventListener('blur', release); window.removeEventListener(TOUCH_RESET_EVENT, release); window.removeEventListener('resize', release); document.removeEventListener('visibilitychange', visibility); };
  }, [code]);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    event.currentTarget.removeAttribute('data-pressed');
    window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed: false } }));
  };
  return <button ref={button} type="button" aria-label={label} className={`touch-action touch-action-${code}`}
    onContextMenu={event => event.preventDefault()}
    onPointerDown={event => {
      event.preventDefault();
      if (pointer.current !== null || event.button !== 0) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.pressed = 'true';
      window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed: true } }));
    }}
    onPointerUp={release} onLostPointerCapture={release} onPointerCancel={release}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        event.currentTarget.dataset.pressed = 'true';
        window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed: true } }));
      }
    }}
    onKeyUp={event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.removeAttribute('data-pressed');
        window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed: false } }));
      }
    }}
    onBlur={event => {
      event.currentTarget.removeAttribute('data-pressed');
      window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed: false } }));
    }}
  ><span aria-hidden="true">{icon}</span><small>{label}</small></button>;
}

function Thumbstick() {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0, radius: 1 });
  const target = useRef<TouchMove>({ forward: 0, turn: 0 });
  const wake = useRef(() => {});
  const stop = useRef(() => {});
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let forward = 0, turn = 0;
    const emit = () => window.dispatchEvent(new CustomEvent<TouchMove>(TOUCH_MOVE_EVENT, { detail: { forward, turn } }));
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer.current = null;
      target.current = { forward: 0, turn: 0 };
      forward = 0; turn = 0;
      base.current?.removeAttribute('data-active');
      base.current?.style.setProperty('--stick-x', '0px');
      base.current?.style.setProperty('--stick-y', '0px');
      emit();
    };
    const tick = (now: number) => {
      const blend = 1 - Math.exp(-24 * Math.min((now - previous) / 1000, 0.05));
      previous = now;
      forward += (target.current.forward - forward) * blend;
      turn += (target.current.turn - turn) * blend;
      if (Math.abs(forward - target.current.forward) < 0.001) forward = target.current.forward;
      if (Math.abs(turn - target.current.turn) < 0.001) turn = target.current.turn;
      emit();
      frame = forward !== target.current.forward || turn !== target.current.turn ? requestAnimationFrame(tick) : 0;
    };
    const visibility = () => { if (document.hidden) reset(); };
    wake.current = () => {
      if (!frame) { previous = performance.now(); frame = requestAnimationFrame(tick); }
    };
    stop.current = reset;
    window.addEventListener(TOUCH_RESET_EVENT, reset);
    window.addEventListener('resize', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); reset(); wake.current = () => {}; stop.current = () => {}; window.removeEventListener(TOUCH_RESET_EVENT, reset); window.removeEventListener('resize', reset); window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    const dx = (event.clientX - origin.current.x) / origin.current.radius;
    const dy = (event.clientY - origin.current.y) / origin.current.radius;
    const length = Math.hypot(dx, dy);
    const scale = Math.min(length, 1) / (length || 1);
    // A small radial dead zone absorbs thumb jitter; preserve proportional travel.
    const strength = Math.max(0, (Math.min(length, 1) - 0.12) / 0.88);
    target.current = { forward: -dy / (length || 1) * strength, turn: dx / (length || 1) * strength };
    wake.current();
    event.currentTarget.style.setProperty('--stick-x', `${dx * scale * origin.current.radius}px`);
    event.currentTarget.style.setProperty('--stick-y', `${dy * scale * origin.current.radius}px`);
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    // Stop input immediately; the simulation already eases physical deceleration.
    stop.current();
  };
  return <div className="touch-movement"><div ref={base} className="touch-stick" role="group" aria-label="Movement joystick: drag up to move forward, down to reverse, left or right to steer"
    onContextMenu={event => event.preventDefault()}
    onPointerDown={event => {
      event.preventDefault();
      if (pointer.current !== null || event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * 0.3 };
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.active = 'true';
      move(event);
    }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
  ><span className="touch-stick-axis" aria-hidden="true" /><span className="touch-stick-thumb" aria-hidden="true" /></div><span className="touch-caption">MOVE / STEER</span></div>;
}

export default function TouchControls() {
  return <div className="touch-controls" aria-label="Game controls">
    <Thumbstick />
    <div className="touch-actions">
      <Control code="KeyH" label="Horn" icon="♪" />
      <Control code="KeyE" label="Interact" icon="↗" />
      <Control code="Space" label="Brake" icon="Ⅱ" />
    </div>
  </div>;
}
