import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionBuffer } from '../src/lib/motion-buffer';

const pose = (x: number, yaw = 0) => ({ x, z: 0, yaw });

test('local player and ridden vehicle show movement one snapshot earlier', () => {
  const player = new MotionBuffer(50);
  const vehicle = new MotionBuffer(50);
  const remote = new MotionBuffer();
  for (const buffer of [player, vehicle, remote]) {
    buffer.update(pose(0), 1000, 0);
    buffer.update(pose(1), 1050, 50);
    buffer.update(pose(2), 1100, 100);
  }
  assert.equal(player.pose.x, 1);
  assert.equal(vehicle.pose.x, player.pose.x);
  assert.equal(remote.pose.x, 0);
});

test('rendering interpolates between packets and holds safely when packets stop', () => {
  const motion = new MotionBuffer(50);
  motion.update(pose(0), 1000, 0);
  motion.update(pose(1), 1050, 50);
  assert.equal(motion.update(pose(1), 1050, 75).x, 0.5);
  assert.equal(motion.update(pose(1), 1050, 500).x, 1);
});

test('turning crosses the angle boundary by the shortest path', () => {
  const motion = new MotionBuffer(50);
  motion.update(pose(0, Math.PI - 0.1), 1000, 0);
  motion.update(pose(0, -Math.PI + 0.1), 1050, 50);
  assert.ok(Math.abs(motion.update(pose(0), 1050, 75).yaw - Math.PI) < 1e-6);
});

test('teleports and resuming after a long gap discard old movement', () => {
  const motion = new MotionBuffer(50);
  motion.update(pose(0), 1000, 0);
  assert.equal(motion.update(pose(200), 1050, 50, true).x, 200);
  assert.equal(motion.update(pose(300), 2000, 1000).x, 300);
});
