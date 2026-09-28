export type WalkMotion = { speed: number; turnSpeed: number };

// Integrate exponential easing as well as its velocity, keeping travel distance
// consistent when the simulation divides elapsed time into different steps.
function ease(current: number, target: number, rate: number, dt: number) {
  const decay = Math.exp(-rate * dt);
  return {
    value: target + (current - target) * decay,
    distance: target * dt + (current - target) * (1 - decay) / rate,
  };
}

export function advanceWalk(motion: WalkMotion, forward: number, turn: number, dt: number, brake = false) {
  const targetSpeed = brake ? 0 : forward * 5;
  const speed = ease(motion.speed, targetSpeed, brake ? 24 : forward === 0 ? 18 : 12, dt);
  const steering = ease(motion.turnSpeed, brake ? 0 : -turn * 4, turn === 0 || brake ? 22 : 16, dt);
  motion.speed = Math.abs(speed.value) < 0.001 ? 0 : speed.value;
  motion.turnSpeed = Math.abs(steering.value) < 0.001 ? 0 : steering.value;
  return { distance: speed.distance, yawDelta: steering.distance };
}
