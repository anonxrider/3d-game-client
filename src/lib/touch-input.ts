/** Independent axes keep full throttle available while steering diagonally. */
export function joystickInput(dx: number, dy: number, radius: number) {
  const axis = (value: number) => {
    const normalized = Math.max(-1, Math.min(1, value / Math.max(1, radius)));
    if (Math.abs(normalized) <= 0.1) return 0;
    return Math.sign(normalized) * Math.max(0, (Math.abs(normalized) - 0.1) / 0.9);
  };
  return { forward: axis(-dy), turn: axis(dx) };
}
