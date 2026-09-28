import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joystickInput } from '../src/lib/touch-input';

test('joystick has a dead zone and releases to zero', () => {
  assert.equal(Math.abs(joystickInput(2, -2, 40).forward), 0);
  assert.equal(Math.abs(joystickInput(2, -2, 40).turn), 0);
  assert.deepEqual(joystickInput(0, 0, 40), { forward: 0, turn: 0 });
});
test('full steering does not reduce throttle and dragging beyond the stick stays bounded', () => {
  assert.deepEqual(joystickInput(40, -40, 40), { forward: 1, turn: 1 });
  assert.deepEqual(joystickInput(-400, 400, 40), { forward: -1, turn: -1 });
});
test('partial travel remains proportional and adapts to joystick size', () => {
  const small = joystickInput(20, -20, 40);
  assert.deepEqual(small, joystickInput(30, -30, 60));
  assert.ok(small.forward > 0.4 && small.forward < 0.5);
  assert.ok(Number.isFinite(joystickInput(0, 0, 0).turn));
});
