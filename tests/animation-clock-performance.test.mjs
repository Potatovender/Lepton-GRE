import { test } from "node:test";
import assert from "node:assert/strict";
import { FramePerformanceMonitor } from "../src/animation/frame-performance.js";

test("performance warning requires more than two seconds below 15 completed FPS", () => {
  const monitor = new FramePerformanceMonitor();
  monitor.frame(5000); // compilation/warm-up before the first frame is excluded
  for (let t = 5100; t <= 7000; t += 100) monitor.frame(t);
  assert.equal(monitor.slow, false);
  for (let t = 7100; t <= 7500; t += 100) monitor.frame(t);
  assert.equal(monitor.slow, true);
  assert.equal(monitor.fps, 10);
  for (let t = 7525; t <= 9500; t += 25) monitor.frame(t);
  assert.equal(monitor.slow, false);
  assert.equal(monitor.fps, 40);
});

test("short stalls, pauses, edits and hidden tabs do not accumulate into a slow warning", () => {
  const monitor = new FramePerformanceMonitor();
  monitor.frame(0);
  for (let t = 100; t <= 1500; t += 100) monitor.frame(t);
  for (let t = 1525; t <= 2000; t += 25) monitor.frame(t);
  for (let t = 2100; t <= 3500; t += 100) monitor.frame(t);
  assert.equal(monitor.slow, false);
  monitor.frame(50000, false);
  assert.equal(monitor.start, null);
  assert.equal(monitor.lowMs, 0);
  monitor.frame(60000);
  assert.equal(monitor.frames, 0);
  monitor.reset();
  assert.equal(monitor.slow, false);
});

test("15 FPS is not below the threshold", () => {
  const monitor = new FramePerformanceMonitor();
  monitor.frame(0);
  for (let t = 1; t <= 90; t++) monitor.frame(t * 1000 / 15);
  assert.equal(monitor.slow, false);
});
