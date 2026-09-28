// One short shower per eight-minute window, with a varied deterministic start.
export const WEATHER_WINDOW_MS = 8 * 60 * 1000;
export function getWeather(serverTime: number) {
  const window = Math.floor(serverTime / WEATHER_WINDOW_MS);
  const elapsed = serverTime - window * WEATHER_WINDOW_MS;
  const seed = Math.imul(window, 1664525) + 1013904223;
  const start = 90000 + (seed >>> 0) % 180000;
  const duration = 75000;
  const ramp = Math.max(0, Math.min(1, (elapsed - start) / 10000, (start + duration - elapsed) / 10000));
  const rain = ramp * ramp * (3 - 2 * ramp);
  const strikeIndex = elapsed >= start + 54000 ? 2 : elapsed >= start + 35000 ? 1 : 0;
  const strikeAt = window * WEATHER_WINDOW_MS + start + [16000, 35000, 54000][strikeIndex];
  const age = serverTime - strikeAt;
  const flash = age >= 0 && age < 600 && rain > 0.5 ? (1 - age / 600) ** 2 : 0;
  const thunderAt = strikeAt + 1800 + ((seed >>> 0) % 1600);
  return { rain, flash, strikeAt, thunderAt, label: rain > 0 ? 'Rain' : 'Clear' };
}
