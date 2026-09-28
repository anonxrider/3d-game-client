"use client";

import { useCallback, useEffect, useRef } from "react";
import { TOUCH_INPUT_EVENT, TOUCH_MOVE_EVENT, TOUCH_RESET_EVENT, type TouchInput, type TouchMove } from "./TouchControls";

export function useKeyboardControls() {
  const keys = useRef(new Set<string>());
  const touchKeys = useRef(new Set<string>());
  const interactRef = useRef(false);
  const movement = useRef<TouchMove>({ forward: 0, turn: 0 });
  const resetControls = useCallback(() => {
    keys.current.clear();
    touchKeys.current.clear();
    interactRef.current = false;
    movement.current = { forward: 0, turn: 0 };
    window.dispatchEvent(new Event(TOUCH_RESET_EVENT));
  }, []);
  useEffect(() => {
    const supported = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'Space', 'KeyH']);
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, button, a[href], [role=button]'))) return;
      if (!supported.has(event.code)) return;
      event.preventDefault();
      keys.current.add(event.code);
      if (event.code === 'KeyE' && !event.repeat) interactRef.current = true;
    };
    const up = (event: KeyboardEvent) => { keys.current.delete(event.code); };
    const clear = resetControls;
    const touch = (event: Event) => {
      const { code, pressed } = (event as CustomEvent<TouchInput>).detail;
      if (!supported.has(code)) return;
      if (pressed) touchKeys.current.add(code);
      else touchKeys.current.delete(code);
      if (code === 'KeyE' && pressed) interactRef.current = true;
    };
    const move = (event: Event) => { movement.current = (event as CustomEvent<TouchMove>).detail; };
    window.addEventListener(TOUCH_MOVE_EVENT, move);
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener(TOUCH_INPUT_EVENT, touch);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clear();
      window.removeEventListener(TOUCH_MOVE_EVENT, move);
      window.removeEventListener(TOUCH_INPUT_EVENT, touch);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [resetControls]);
  return { keys, touchKeys, interactRef, movement, resetControls };
}
