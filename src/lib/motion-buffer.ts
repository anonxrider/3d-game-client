type Pose = { x: number; z: number; yaw: number };
type Sample = Pose & { time: number };

// Render a short distance behind the server so packet timing does not turn
// constant movement into a repeated acceleration/deceleration cycle.
export class MotionBuffer {
  private samples: Sample[] = [];
  private offset = 0;
  private latest = -Infinity;
  readonly pose: Pose = { x: 0, z: 0, yaw: 0 };

  update(pose: Pose, time: number, now: number, reset = false): Pose {
    if (reset || this.samples.length === 0) {
      this.samples = [{ x: pose.x, z: pose.z, yaw: pose.yaw, time }];
      this.offset = now - time;
      this.latest = time;
    } else if (time > this.latest) {
      // Recover promptly after a disconnected or suspended tab.
      if (time - this.latest > 500) return this.update(pose, time, now, true);
      this.samples.push({ x: pose.x, z: pose.z, yaw: pose.yaw, time });
      this.latest = time;
      // A faster packet improves our estimate without letting slow packets
      // pull the playback clock backwards.
      this.offset = Math.min(this.offset, now - time);
    }
    const renderTime = now - this.offset - 100;
    while (this.samples.length > 2 && this.samples[1].time <= renderTime) this.samples.shift();
    const from = this.samples[0];
    const to = this.samples[1] ?? from;
    const alpha = to.time === from.time ? 1 : Math.max(0, Math.min(1, (renderTime - from.time) / (to.time - from.time)));
    this.pose.x = from.x + (to.x - from.x) * alpha;
    this.pose.z = from.z + (to.z - from.z) * alpha;
    const angle = to.yaw - from.yaw;
    this.pose.yaw = from.yaw + Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha;
    return this.pose;
  }
}
