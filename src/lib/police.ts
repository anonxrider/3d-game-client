/** Shared timing keeps officer gestures and server-controlled traffic in sync. */
export function trafficAllows(time: number, northSouth: boolean) {
  const phase = ((time / 1000) % 20 + 20) % 20;
  return northSouth ? phase < 8 : phase >= 10 && phase < 18;
}
