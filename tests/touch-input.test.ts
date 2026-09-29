import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joystickInput, touchMotion } from '../src/lib/touch-input';

test('joystick has a dead zone and releases to zero', () => {
  assert.equal(Math.abs(joystickInput(2, -2, 40).forward), 0);
  assert.equal(Math.abs(joystickInput(2, -2, 40).turn), 0);
  assert.deepEqual(joystickInput(0, 0, 40), { forward: 0, turn: 0 });
});
test('full steering does not reduce throttle and dragging beyond the stick stays bounded', () => {
  assert.deepEqual(joystickInput(40, -40, 40), { forward: 1, turn: 1 });
  assert.deepEqual(joystickInput(-400, 400, 40), { forward: -1, turn: -1 });
});
test('partial travel is gentle and adapts to joystick size', () => {
  const small = joystickInput(20, -20, 40);
  assert.deepEqual(small, joystickInput(30, -30, 60));
  assert.ok(small.forward > 0.2 && small.forward < 0.3);
  assert.ok(Number.isFinite(joystickInput(0, 0, 0).turn));
});

test('touch walking and driving limit speed and steering without losing reverse', () => {
  assert.deepEqual(touchMotion({ forward: 1, turn: -1 }, 0, false), { forward: 0.7, turn: -0.5 });
  assert.deepEqual(touchMotion({ forward: -1, turn: 1 }, 0, true), { forward: -0.6, turn: 0.55 });
  assert.deepEqual(touchMotion({ forward: 0, turn: 0 }, 0, true), { forward: 0, turn: 0 });
});
test('pedals override stick throttle instead of adding speed or cancelling reverse', () => {
  assert.equal(touchMotion({ forward: 1, turn: 1 }, 1, true).forward, 0.6);
  assert.equal(touchMotion({ forward: 1, turn: 1 }, -1, true).forward, -0.6);
});
test('joystick response increases continuously from the dead zone to full travel', () => {
  let previous = 0;
  for (let distance = 0; distance <= 100; distance++) {
    const current = joystickInput(0, -distance, 100).forward;
    assert.ok(current >= previous && current - previous < 0.02);
    previous = current;
  }
  assert.equal(previous, 1);
});
