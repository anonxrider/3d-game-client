export const DAY_LENGTH_MS = 20 * 60 * 1000;
const smooth = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
export function getDayCycle(serverTime: number) {
  const phase = ((serverTime % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS / DAY_LENGTH_MS;
  const hour = phase * 24;
  const angle = phase * Math.PI * 2 - Math.PI / 2;
  const elevation = Math.sin(angle);
  const daylight = smooth(-0.12, 0.22, elevation);
  const twilight = 1 - smooth(0, 0.3, Math.abs(elevation));
  const minutes = Math.floor(hour * 60);
  const nextTransition = hour < 5 ? { hour: 5, name: 'Sunrise' }
    : hour < 7 ? { hour: 7, name: 'Day' }
    : hour < 17 ? { hour: 17, name: 'Sunset' }
    : hour < 19 ? { hour: 19, name: 'Night' }
    : { hour: 29, name: 'Sunrise' };
  const secondsRemaining = Math.ceil((nextTransition.hour - hour) / 24 * DAY_LENGTH_MS / 1000);
  const countdown = `${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`;
  return { nextPeriod: nextTransition.name, countdown, hour, angle, elevation, daylight, night: 1 - daylight, twilight,
    label: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    period: hour < 5 || hour >= 19 ? 'Night' : hour < 7 ? 'Sunrise' : hour < 17 ? 'Day' : 'Sunset',
  };
}
