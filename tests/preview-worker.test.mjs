// Module mocks isolate worker message ownership from real GPU execution.
import { test } from "node:test";
import assert from "node:assert/strict";

let sequence = 0;
async function fixture(t) {
  const jobs = [], messages = [], instances = [], clocks = [];
  const clockControl = { values: new Map([["t", 2.5]]), directions: new Map([["t", 1]]), error: null };
  class FakeRenderer {
    constructor() { this.diagnostics = null; instances.push(this); }
    setScene(scene) { this.scene = scene; this.diagnostics = { tag: scene.tag, functions: scene.functions.map(() => ({ status: "valid" })), hasErrors: false }; }
    validate() { return this.diagnostics; }
    render(options) {
      options.signal?.throwIfAborted();
      return new Promise((resolve, reject) => jobs.push({ scene: this.scene, options, resolve, reject }));
    }
  }
  t.mock.module(new URL("../src/compiler/snapshot-renderer.js?v=20260917-responsive-video", import.meta.url), {
    exports: { SnapshotRenderer: FakeRenderer }
  });
  t.mock.module(new URL("../src/animation/scene-clock.js?v=20260917-responsive-video", import.meta.url), {
    exports: { createSceneClock(scene, options) {
      if (clockControl.error) throw clockControl.error;
      const clock = { scene: structuredClone(scene), options: structuredClone(options), samples: [],
        stateAt() { return { values: new Map(clockControl.values), directions: new Map(clockControl.directions) }; },
        async stateAtAsync(time, controls) {
          controls.signal?.throwIfAborted(); clock.samples.push({ time, controls });
          return { values: new Map(clockControl.values), directions: new Map(clockControl.directions) };
        }
      };
      clocks.push(clock); return clock;
    } }
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "self");
  globalThis.self = { postMessage: (data, transfer = []) => messages.push({ data, transfer }) };
  t.after(() => previous ? Object.defineProperty(globalThis, "self", previous) : delete globalThis.self);
  await import(`../src/compiler/preview-worker.js?preview-test=${++sequence}`);
  const send = (data) => self.onmessage({ data });
  // Clock reconciliation awaits even paused scenes; do not assume synchronous dispatch.
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const request = (revision = 1, generation = 1) => ({ type: "render", revision, generation, sceneKey: `key-${revision}`,
    scene: { tag: revision, settings: {}, functions: [{ id: "t", kind: "slider", time: true, expression: "0", timeMode: "unbounded", timeRate: "1" }] }, width: 160, height: 90 });
  const result = () => {
    const bitmap = { closes: 0, close() { this.closes++; } };
    const canvas = { transfers: 0, transferToImageBitmap() { this.transfers++; return bitmap; } };
    return { bitmap, canvas, diagnostics: { valid: true }, sliders: [{ id: "t", value: 2.5, min: 0, max: 10 }],
      pointValues: [{ id: "p", value: 7, valid: true }], drawCounts: ["3 draw values", ""], sourceLength: 42 };
  };
  return { jobs, messages, instances, clocks, clockControl, send, flush, request, result };
}

test("worker forwards phases and one transferable bitmap with revision/generation metadata", async (t) => {
  const f = await fixture(t); const job = f.send(f.request());
  await f.flush();
  assert.equal(f.instances.length, 1); assert.equal(f.jobs.length, 1);
  f.jobs[0].options.onPhase("compiling");
  assert.deepEqual(f.messages[0].data, { type: "phase", revision: 1, phase: "compiling", transient: false });
  const result = f.result(); f.jobs[0].resolve(result); await job;
  const sent = f.messages.at(-1);
  assert.equal(sent.data.type, "frame"); assert.equal(sent.data.revision, 1); assert.equal(sent.data.generation, 1);
  assert.equal(sent.data.sceneKey, "key-1"); assert.equal(sent.data.bitmap, result.bitmap);
  assert.deepEqual(sent.transfer, [result.bitmap]); assert.equal(sent.data.canvas, undefined);
  assert.equal(result.canvas.transfers, 1);
  assert.deepEqual(sent.data.sliders, result.sliders); assert.equal(f.jobs[0].options.clockValues, false);
  assert.deepEqual(sent.data.pointValues, result.pointValues); assert.deepEqual(sent.data.drawCounts, result.drawCounts);
});

test("worker cancellation aborts render signal and never transfers a stale bitmap", async (t) => {
  const f = await fixture(t); const job = f.send(f.request());
  await f.flush();
  await f.send({ type: "cancel" }); assert(f.jobs[0].options.signal.aborted);
  const result = f.result(); f.jobs[0].resolve(result); await job;
  assert.equal(result.canvas.transfers, 0);
  assert.equal(f.messages.at(-1).data.type, "cancelled"); assert.equal(f.messages.at(-1).data.generation, 1);
});

test("worker errors report diagnostics and a subsequent request can still complete", async (t) => {
  const f = await fixture(t); const first = f.send(f.request());
  await f.flush();
  f.jobs[0].reject(new Error("shader too large")); await first;
  assert.equal(f.messages[0].data.type, "error"); assert.equal(f.messages[0].data.message, "shader too large");
  assert.equal(f.messages[0].data.diagnostics.tag, 1);
  const second = f.send(f.request(2, 2)); await f.flush(); f.jobs[1].resolve(f.result()); await second;
  assert.equal(f.instances.length, 1, "One renderer/context persists between frames");
  assert.equal(f.messages.at(-1).data.type, "frame");
});

test("cancelled predecessor finishing does not clear the newer job's cancellation controller", async (t) => {
  const f = await fixture(t); const first = f.send(f.request()); await f.flush(); await f.send({ type: "cancel" });
  const second = f.send(f.request(2, 2));
  await f.flush();
  f.jobs[0].resolve(f.result()); await first;
  assert.equal(f.jobs[1].options.signal.aborted, false);
  await f.send({ type: "cancel" }); assert(f.jobs[1].options.signal.aborted);
  f.jobs[1].resolve(f.result()); await second;
  assert.deepEqual(f.messages.map(({ data }) => data.type), ["cancelled", "cancelled"]);
});

test("idle cancellation and unknown messages allocate no render work", async (t) => {
  const f = await fixture(t);
  await f.send({ type: "cancel" }); await f.send({ type: "unknown" });
  assert.equal(f.jobs.length, 0); assert.equal(f.messages.length, 0);
});

test("worker samples the scene clock, forwards sampled values and reuses clocks within a generation", async (t) => {
  const f = await fixture(t); let now = 1000;
  t.mock.method(performance, "now", () => now);
  for (let i = 0; i < 3; i++) {
    now = 1000 + i * 250;
    f.clockControl.values.set("t", 2.5 + i * 0.25);
    const request = { ...f.request(i + 1), animation: { selected: ["t"], directions: { t: 1 } } };
    const job = f.send(request); await f.flush();
    assert.equal(f.jobs[i].scene.functions[0].expression, String(2.5 + i * 0.25));
    assert.equal(f.jobs[i].options.clockValues, true);
    f.jobs[i].resolve(f.result()); await job;
    assert.equal(f.messages.at(-1).data.clockState.values.get("t"), 2.5 + i * 0.25);
  }
  assert.equal(f.clocks.length, 1);
  assert.deepEqual(f.clocks[0].samples.map(({ time }) => time), [0, 0.25, 0.5]);
});

test("worker rebuilds clocks after rate edits and after pause/resume", async (t) => {
  const f = await fixture(t);
  for (const [index, selected] of [[0, ["t"]], [1, ["t"]], [2, []], [3, ["t"]]]) {
    const request = { ...f.request(index + 1, index < 2 ? index + 1 : 2), animation: { selected, directions: {} } };
    if (index > 0) request.scene.functions[0].timeRate = "2";
    const job = f.send(request);
    await f.flush();
    assert.equal(f.jobs[index].options.clockValues, selected.length > 0);
    f.jobs[index].resolve(f.result()); await job;
  }
  assert.equal(f.clocks.length, 3);
});

test("clock errors with an entry ID return a red diagnostic without mutating cached diagnostics", async (t) => {
  const f = await fixture(t);
  const first = f.send(f.request()); await f.flush(); f.jobs[0].resolve(f.result()); await first;
  f.clockControl.error = Object.assign(new Error("Time speed is invalid"), { entryId: "t" });
  await f.send({ ...f.request(2, 2), animation: { selected: ["t"], directions: {} } });
  const { data } = f.messages.at(-1);
  assert.equal(data.type, "error"); assert.equal(data.diagnostics.hasErrors, true);
  assert.deepEqual(data.diagnostics.functions[0], { status: "invalid", message: "Time speed is invalid" });
  assert.equal(f.instances[0].diagnostics.functions[0].status, "valid");
});
