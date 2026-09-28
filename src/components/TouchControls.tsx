"use client";

import { useRef } from 'react';

export const TOUCH_INPUT_EVENT = 'ethera-touch-input';
export type TouchInput = { code: string; pressed: boolean };

function Control({ code, label, children }: { code: string; label: string; children: string }) {
  const pointer = useRef<number | null>(null);
  const emit = (pressed: boolean) => window.dispatchEvent(new CustomEvent<TouchInput>(TOUCH_INPUT_EVENT, { detail: { code, pressed } }));
  return <button type="button" aria-label={label}
    onContextMenu={event => event.preventDefault()}
    onPointerDown={event => {
      event.preventDefault();
      if (pointer.current !== null) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      emit(true);
    }}
    onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      pointer.current = null;
      emit(false);
    }}
    onLostPointerCapture={() => { pointer.current = null; emit(false); }}
    onPointerCancel={() => { pointer.current = null; emit(false); }}
  >{children}</button>;
}

export default function TouchControls() {
  return <div className="touch-controls" aria-label="Game controls">
    <div className="touch-steering">
      <Control code="KeyW" label="Move forward">▲</Control>
      <Control code="KeyA" label="Turn left">◀</Control>
      <Control code="KeyS" label="Move backward">▼</Control>
      <Control code="KeyD" label="Turn right">▶</Control>
    </div>
    <div className="touch-actions">
      <Control code="KeyE" label="Interact">E</Control>
      <Control code="Space" label="Brake">Brake</Control>
      <Control code="KeyH" label="Horn">Horn</Control>
    </div>
  </div>;
}
