import { test } from "node:test";
import assert from "node:assert/strict";
import { PreviewClient } from "../src/compiler/preview-client.js";

function fixture(t) {
  const workers = [], frames = [], statuses = [], errors = [], diagnostics = [];
  class FakeWorker {
    messages = [];
    terminated = false;
    postMessage(message) { this.messages.push(structuredClone(message)); }
    terminate() { this.terminated = true; }
    receive(data) { this.onmessage?.({ data }); }
    fail(message = "worker crashed") { this.onerror?.({ message }); }
    renders() { return this.messages.filter((message) => message.type === "render"); }
  }
  const client = new PreviewClient({ onFrame: (data) => frames.push(data), onStatus: (data) => statuses.push(data),
    onError: (data) => errors.push(data), onDiagnostics: (data) => diagnostics.push(data),
    workerFactory: () => { const worker = new FakeWorker(); workers.push(worker); return worker; } });
  t.after(() => client.dispose());
  const request = (value, transient = false) => client.request({ scene: { value }, sceneKey: `scene-${value}`, transient });
  const terminal = (worker, job = worker.renders().at(-1), type = "frame") => {
    const bitmap = { closes: 0, close() { this.closes++; } };
    worker.receive({ type, revision: job.revision, generation: job.generation, bitmap, message: "bad shader" });
    return bitmap;
  };
  return { client, workers, frames, statuses, errors, diagnostics, request, terminal };
}

test("diagnostics publish before pixels without releasing the in-flight slot or cancellation watchdog", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t); f.request(0);
  const worker = f.workers[0], initial = worker.renders()[0];
  worker.receive({ type: "diagnostics", revision: initial.revision, generation: initial.generation, diagnostics: { hasErrors: false } });
  assert.equal(f.diagnostics.length, 1); assert.equal(f.client.busy, true);
  f.request(1, true);
  worker.receive({ type: "diagnostics", revision: initial.revision, generation: initial.generation, diagnostics: { hasErrors: false } });
  assert.equal(f.diagnostics.length, 2, "Same-generation diagnostics remain useful during animation");
  assert.equal(worker.renders().length, 1); assert(f.client.pending);
  f.request(2);
  const timer = f.client.timer;
  worker.receive({ type: "diagnostics", revision: initial.revision, generation: initial.generation, diagnostics: { hasErrors: true } });
  assert.equal(f.diagnostics.length, 2, "An older edit must not replace current status");
  assert.equal(f.client.timer, timer); assert.equal(f.client.busy, true); assert.equal(worker.renders().length, 1);
  t.mock.timers.tick(2000);
  assert.equal(f.workers.length, 2); assert.equal(f.workers[1].renders()[0].scene.value, 2);
  worker.receive({ type: "diagnostics", generation: f.client.generation, diagnostics: { hasErrors: true } });
  assert.equal(f.diagnostics.length, 2, "Retired worker cannot publish diagnostics");
  f.terminal(f.workers[1]); assert.equal(f.frames.length, 1);
});

test("preview client retains only the latest replacement render across a burst of edits", (t) => {
  const f = fixture(t);
  f.request(0);
  for (let i = 1; i <= 100; i++) f.request(i);
  assert.equal(f.workers.length, 1);
  assert.equal(f.workers[0].renders().length, 1);
  assert.equal(f.client.pending.scene.value, 100);
  const old = f.terminal(f.workers[0]);
  assert.equal(old.closes, 1); assert.equal(f.frames.length, 0);
  assert.equal(f.workers[0].renders().length, 2);
  assert.equal(f.workers[0].renders()[1].scene.value, 100);
  f.terminal(f.workers[0]);
  assert.equal(f.frames.length, 1); assert.equal(f.frames[0].revision, 101);
  assert.equal(f.client.pending, null); assert.equal(f.client.busy, false);
});

test("preview client bounds cancellation traffic as well as the render queue", (t) => {
  const f = fixture(t); f.request(0);
  for (let i = 1; i <= 1000; i++) f.request(i);
  const cancels = f.workers[0].messages.filter((message) => message.type === "cancel");
  assert(cancels.length <= 1, `One blocked render accumulated ${cancels.length} cancel messages`);
});

test("failed cancellation retires the worker and dispatches the latest edit", (t) => {
  const f = fixture(t); f.request(0);
  f.workers[0].postMessage = () => { throw new Error("Worker is unavailable"); };
  assert.doesNotThrow(() => f.request(1));
  assert(f.workers[0].terminated);
  assert.equal(f.workers.length, 2);
  assert.equal(f.workers[1].renders()[0].scene.value, 1);
  assert.equal(f.errors.at(-1).message, "Worker is unavailable");
  f.terminal(f.workers[1]);
  assert.equal(f.frames.length, 1);
  assert.equal(f.client.busy, false);
});

test("native preparation finishes without cancellation churn while newer edits coalesce", (t) => {
  const f = fixture(t); f.request(0);
  const worker = f.workers[0];
  worker.receive({ type: "phase", revision: 1, phase: "rendering" });
  for (let i = 1; i <= 40; i++) f.request(i);
  assert.equal(worker.messages.filter((message) => message.type === "cancel").length, 0);
  assert.equal(worker.renders().length, 1);
  assert.equal(f.client.pending.scene.value, 40);
  const stale = f.terminal(worker);
  assert.equal(stale.closes, 1);
  assert.equal(worker.renders()[1].scene.value, 40);
  f.terminal(worker);
  assert.equal(f.frames.length, 1);
});

test("slow animation frames keep displaying and coalesce intermediate ticks without cancellation", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t); f.request(0);
  for (let frame = 0; frame < 12; frame++) {
    const worker = f.workers[0];
    for (let tick = 0; tick < 20; tick++) { f.request(frame * 20 + tick + 1, true); t.mock.timers.tick(16); }
    const bitmap = f.terminal(worker);
    assert.equal(bitmap.closes, 0, "Completed same-generation animation must not be starved by newer ticks");
    assert.equal(f.frames.length, frame + 1);
    assert.equal(worker.renders().length, frame + 2);
  }
  assert.equal(f.workers.length, 1);
  assert.equal(f.workers[0].messages.filter((message) => message.type === "cancel").length, 0);
  assert.equal(f.client.pending, null);
});

test("an edit invalidates earlier animation frames, but subsequent animation retains that edit", (t) => {
  const f = fixture(t); f.request(0, true);
  f.request(1, true); f.request(2); f.request(3, true);
  const old = f.terminal(f.workers[0]);
  assert.equal(old.closes, 1); assert.equal(f.frames.length, 0);
  const next = f.workers[0].renders()[1];
  assert.equal(next.scene.value, 3); assert.equal(next.generation, 1);
  f.terminal(f.workers[0]); assert.equal(f.frames.length, 1);
});

test("cancel acknowledgements dispatch the latest pending edit without presenting a frame", (t) => {
  const f = fixture(t); f.request(0); f.request(1); f.request(2);
  f.terminal(f.workers[0], undefined, "cancelled");
  assert.equal(f.workers[0].renders().length, 2); assert.equal(f.client.busy, true);
  assert.equal(f.frames.length, 0); assert.equal(f.errors.length, 0);
  assert.equal(f.workers[0].renders()[1].scene.value, 2);
});

test("current errors surface, stale errors do not overwrite newer edit status", (t) => {
  const f = fixture(t); f.request(0); f.request(1);
  f.terminal(f.workers[0], undefined, "error");
  assert.equal(f.errors.length, 0);
  f.terminal(f.workers[0], undefined, "error");
  assert.equal(f.errors.length, 1); assert.equal(f.errors[0].revision, 2);
  assert.equal(f.client.busy, false);
});

test("only current progress phases are forwarded", (t) => {
  const f = fixture(t); f.request(0); f.request(1);
  const worker = f.workers[0];
  worker.receive({ type: "phase", revision: 1, phase: "compiling" });
  assert.equal(f.statuses.length, 2);
  worker.receive({ type: "phase", revision: 2, phase: "rendering" });
  assert.equal(f.statuses.at(-1).phase, "rendering"); assert.equal(f.client.busy, true);
});

test("blocked compilation restarts once at the deadline and renders only the newest edit", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t); f.request(0); f.request(1);
  t.mock.timers.tick(1000); f.request(2);
  t.mock.timers.tick(999); assert.equal(f.workers.length, 1);
  t.mock.timers.tick(1);
  assert.equal(f.workers.length, 2); assert(f.workers[0].terminated);
  assert.equal(f.workers[1].renders()[0].scene.value, 2);
  f.terminal(f.workers[1]); t.mock.timers.tick(10000);
  assert.equal(f.workers.length, 2); assert.equal(f.frames.length, 1);
});

test("worker crashes resume the pending newest request instead of leaving it stranded", (t) => {
  const f = fixture(t); f.request(0); f.request(1);
  f.workers[0].fail();
  assert.equal(f.errors.length, 1);
  assert.equal(f.workers.length, 2, "Crash left pending edit waiting for another keystroke");
  assert.equal(f.workers[1].renders()[0].scene.value, 1);
  f.terminal(f.workers[1]); assert.equal(f.frames.length, 1);
});

for (const message of ["Worker blocked by CSP", ""]) {
  test(`worker constructor failure clears pending work and permits retry (${message || "fallback message"})`, (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const f = fixture(t), createWorker = f.client.workerFactory;
    let attempts = 0;
    t.mock.method(f.client, "workerFactory", () => {
      if (++attempts === 1) throw new Error(message);
      return createWorker();
    });
    assert.doesNotThrow(() => assert.equal(f.request(0), 1));
    assert.deepEqual(f.errors, [{ revision: 1, message: message || "Background graph worker could not start" }]);
    assert.equal(f.client.pending, null); assert.equal(f.client.busy, false);
    assert.equal(f.client.worker, null); assert.equal(f.client.timer, null);
    assert.equal(f.frames.length, 0); assert.equal(f.workers.length, 0);
    t.mock.timers.tick(10000);
    assert.equal(attempts, 1, "A failed constructor must not trigger an automatic retry loop");
    assert.equal(f.request(1), 2);
    assert.equal(f.workers[0].renders().length, 1);
    assert.equal(f.workers[0].renders()[0].scene.value, 1);
    f.terminal(f.workers[0]);
    assert.equal(f.frames[0].revision, 2); assert.equal(f.errors.length, 1);
  });
}

for (const message of ["Scene could not be cloned", ""]) {
  test(`render postMessage failure retires the worker and permits retry (${message || "fallback message"})`, (t) => {
    const f = fixture(t), createWorker = f.client.workerFactory;
    t.mock.method(f.client, "workerFactory", () => {
      const worker = createWorker();
      if (f.workers.length === 1) t.mock.method(worker, "postMessage", () => { throw new Error(message); });
      return worker;
    });
    assert.doesNotThrow(() => assert.equal(f.request(0), 1));
    assert.deepEqual(f.errors, [{ revision: 1, message: message || "Graph could not be sent to the background worker" }]);
    assert(f.workers[0].terminated); assert.equal(f.client.worker, null);
    assert.equal(f.client.pending, null); assert.equal(f.client.busy, false);
    assert.equal(f.client.timer, null); assert.equal(f.client.cancelSent, false);
    assert.equal(f.frames.length, 0);
    assert.equal(f.request(1), 2);
    assert.equal(f.workers.length, 2); assert.equal(f.workers[1].renders().length, 1);
    f.terminal(f.workers[1]);
    assert.equal(f.frames[0].revision, 2); assert.equal(f.errors.length, 1);
    const late = f.terminal(f.workers[0], { revision: 1, generation: 1 });
    assert.equal(late.closes, 1); assert.equal(f.frames.length, 1);
  });
}

test("a queued render send failure clears the cancellation watchdog without losing the next edit", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t); f.request(0);
  const worker = f.workers[0], postMessage = worker.postMessage.bind(worker);
  t.mock.method(worker, "postMessage", (message) => {
    if (message.type === "render") throw new Error("Cannot send replacement scene");
    postMessage(message);
  });
  f.request(1);
  assert(f.client.timer); assert.equal(f.client.cancelSent, true);
  assert.doesNotThrow(() => f.terminal(worker, undefined, "cancelled"));
  assert.deepEqual(f.errors, [{ revision: 2, message: "Cannot send replacement scene" }]);
  assert(worker.terminated); assert.equal(f.client.timer, null);
  assert.equal(f.client.cancelSent, false); assert.equal(f.client.busy, false);
  assert.equal(f.client.pending, null); assert.equal(f.client.worker, null);
  t.mock.timers.tick(10000); assert.equal(f.workers.length, 1);
  f.request(2); f.terminal(f.workers[1]);
  assert.equal(f.frames[0].revision, 3); assert.equal(f.errors.length, 1);
});

test("frames delivered after disposal are closed and never reach UI callbacks", (t) => {
  const f = fixture(t); f.request(0);
  f.client.dispose();
  const bitmap = f.terminal(f.workers[0]);
  assert.equal(bitmap.closes, 1); assert.equal(f.frames.length, 0);
  assert.equal(f.workers.length, 1);
});

test("late messages from retired workers cannot release the new worker's in-flight slot", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t); f.request(0); f.request(1); t.mock.timers.tick(2000);
  f.request(2, true);
  const oldBitmap = f.terminal(f.workers[0]);
  assert.equal(oldBitmap.closes, 1);
  assert.equal(f.workers[1].renders().length, 1, "Retired worker dispatched another job while current worker remained busy");
  f.terminal(f.workers[1]);
  assert.equal(f.workers[1].renders().length, 2);
});

test("dispose clears watchdog and queued renders", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t); f.request(0); f.request(1); f.client.dispose();
  t.mock.timers.tick(10000);
  assert.equal(f.workers.length, 1); assert(f.workers[0].terminated);
  assert.equal(f.client.pending, null); assert.equal(f.client.busy, false);
});
