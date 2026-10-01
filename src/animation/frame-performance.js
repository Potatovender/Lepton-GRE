// Count completed frames, not animation callbacks or time spent compiling.
export class FramePerformanceMonitor {
  constructor() { this.reset(); }

  reset() {
    this.start = null;
    this.frames = 0;
    this.lowMs = 0;
    this.recoveryMs = 0;
    this.fps = 0;
    this.slow = false;
  }

  frame(timestamp, active = true) {
    if (!active || !Number.isFinite(timestamp)) { this.reset(); return false; }
    if (this.start === null || timestamp < this.start) { this.start = timestamp; return false; }
    this.frames++;
    const elapsed = timestamp - this.start;
    if (elapsed < 500) return false;
    this.fps = this.frames * 1000 / elapsed;
    if (this.fps < 15 - 1e-9) {
      this.lowMs += elapsed;
      this.recoveryMs = 0;
      if (this.lowMs > 2000) this.slow = true;
    } else {
      this.lowMs = 0;
      this.recoveryMs += elapsed;
      if (this.recoveryMs >= 2000) this.slow = false;
    }
    this.start = timestamp;
    this.frames = 0;
    return true;
  }
}
