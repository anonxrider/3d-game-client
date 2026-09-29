/** Independent axes keep full throttle available while steering diagonally. */
export function joystickInput(dx: number, dy: number, radius: number) {
  const axis = (value: number) => {
    const normalized = Math.max(-1, Math.min(1, value / Math.max(1, radius)));
    if (Math.abs(normalized) <= 0.1) return 0;
    const travel = (Math.abs(normalized) - 0.1) / 0.9;
    return Math.sign(normalized) * travel ** 1.6;
  };
  return { forward: axis(-dy), turn: axis(dx) };
}

/** Scale only touch input; physical keyboard controls retain their full range. */
export function touchMotion(stick: { forward: number; turn: number }, pedals: number, driving: boolean) {
  // Pedals override the vertical stick so steering cannot double the throttle.
  const forward = pedals !== 0 ? pedals : stick.forward;
  return {
    forward: Math.max(-1, Math.min(1, forward)) * (driving ? 0.6 : 0.7),
    turn: Math.max(-1, Math.min(1, stick.turn)) * (driving ? 0.55 : 0.5),
  };
}
