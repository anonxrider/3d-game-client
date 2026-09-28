"use client";

import { useEffect, useRef } from "react";
import { TOUCH_INPUT_EVENT, type TouchInput } from "./TouchControls";

export function useKeyboardControls() {
  const keys = useRef(new Set<string>());
  const interactRef = useRef(false);
  useEffect(() => {
    const supported = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'Space', 'KeyH']);
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (!supported.has(event.code)) return;
      event.preventDefault();
      keys.current.add(event.code);
      if (event.code === 'KeyE' && !event.repeat) interactRef.current = true;
    };
    const up = (event: KeyboardEvent) => { keys.current.delete(event.code); };
    const clear = () => { keys.current.clear(); interactRef.current = false; };
    const touch = (event: Event) => {
      const { code, pressed } = (event as CustomEvent<TouchInput>).detail;
      if (!supported.has(code)) return;
      if (pressed) keys.current.add(code);
      else keys.current.delete(code);
      if (code === 'KeyE' && pressed) interactRef.current = true;
    };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener(TOUCH_INPUT_EVENT, touch);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clear();
      window.removeEventListener(TOUCH_INPUT_EVENT, touch);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return { keys, interactRef };
}
