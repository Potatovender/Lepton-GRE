import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { PreviewClient } from "../src/compiler/preview-client.js";
import { DEFAULT_SCENE } from "../src/compiler/scene-runtime.js";
import { createSceneClock } from "../src/animation/scene-clock.js";
import { SnapshotRenderer } from "../src/compiler/snapshot-renderer.js?v=20260917-responsive-video";

const WORKER = new URL("../src/compiler/preview-worker.js", import.meta.url);
let fixtureSequence = 0;
const time = (id = "t", expression = "0", timeRate = "1", options = {}) => ({
  id, kind: "slider", time: true, expression, timeRate, timeMode: "unbounded", sliderMin: "0", sliderMax: "10", ...options
});
const expression = (id, value) => ({ id, kind: "variable", expression: value });

function graph(functions = [time()], extra = {}) {
  return {
    ...structuredClone(DEFAULT_SCENE), ...extra,
    functions: [...functions, expression("image", "x+t")],
    colors: [{ id: "paint", red: "100+x", green: "100+y", blue: "100+t" }],
    draws: [{ equationId: "image", components: [{ type: "color", id: "paint" }], hidden: false }],
    settings: { ...DEFAULT_SCENE.settings, showCoordinateGrid: false, ...extra.settings }
  };
}

function close(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

// The real worker, compiler, clock, client and snapshot composition execute here.
// Only canvas/GPU operations are faked: these tests inspect source, uniforms and
// point draw commands, not GPU pixels, hardware throughput, or browser input latency.
async function fixture(t) {
  let now = 1000;
  let delayMs = 0;
  let completionAllowed = true;
  let revision = 0;
  const messages = [], canvases = [], jobs = new Set();
  let receiver = null;
  const oldSelf = Object.getOwnPropertyDescriptor(globalThis, "self");
  const oldCanvas = Object.getOwnPropertyDescriptor(globalThis, "OffscreenCanvas");
  t.mock.method(performance, "now", () => now);

  function graphics() {
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
      MAX_RENDERBUFFER_SIZE: 5, shadersSubmitted: 0, uniforms: {}, frame: null, program: null,
      SCISSOR_TEST: 6, SCISSOR_BOX: 7, SYNC_GPU_COMMANDS_COMPLETE: 8, ALREADY_SIGNALED: 9,
      scissorEnabled: false, scissorBox: [0, 0, 200, 200],
      isEnabled() { return this.scissorEnabled; },
      enable() { this.scissorEnabled = true; }, disable() { this.scissorEnabled = false; },
      scissor(...box) { this.scissorBox = box; },
      fenceSync: () => ({}), clientWaitSync: () => 9, deleteSync() {}, flush() {},
      createShader: (type) => ({ type }),
      shaderSource(shader, source) { shader.source = source; },
      compileShader() { this.shadersSubmitted += 1; },
      getShaderParameter: () => true,
      getShaderInfoLog: () => "", deleteShader() {},
      createProgram: () => ({ shaders: [] }),
      attachShader(program, shader) { program.shaders.push(shader); }, linkProgram() {},
      getProgramParameter: (_program, parameter) => parameter === 100 ? completionAllowed : true,
      getProgramInfoLog: () => "", deleteProgram() {},
      createBuffer: () => ({}), deleteBuffer() {}, bindBuffer() {}, bufferData() {},
      getAttribLocation: () => 0, getUniformLocation: (_program, name) => name,
      getParameter(parameter) { return parameter === this.SCISSOR_BOX ? this.scissorBox : 8192; },
      getExtension: (name) => name === "KHR_parallel_shader_compile" ? { COMPLETION_STATUS_KHR: 100 } : null,
      viewport() {}, useProgram(program) { this.program = program; },
      enableVertexAttribArray() {}, vertexAttribPointer() {},
      uniform1f(name, value) { this.uniforms[name] = value; },
      uniform1i(name, value) { this.uniforms[name] = value; },
      uniform2f(name, ...values) { this.uniforms[name] = values; },
      uniform3f(name, ...values) { this.uniforms[name] = values; },
      uniform4f(name, ...values) { this.uniforms[name] = values; },
      clearColor() {}, clear() {},
      drawArrays() {
        this.frame = {
          uniforms: structuredClone(this.uniforms),
          source: this.program.shaders.find((shader) => shader.type === this.FRAGMENT_SHADER)?.source,
          sampledAt: now
        };
      },
      finish() { assert.fail("Preview must not force a synchronous GPU readback"); }
    };
    return gl;
  }

  class Canvas {
    constructor(width, height) {
      Object.assign(this, { width, height, gl: graphics() });
      const commands = [];
      this.ctx = {
        commands, graph: null, arcValue: null,
        clearRect() { commands.length = 0; },
        drawImage(canvas) { this.graph = structuredClone(canvas.gl.frame); now += delayMs; },
        save() {}, restore() {}, scale() {}, beginPath() {},
        moveTo() {}, lineTo() {}, stroke() {},
        arc(...args) { this.arcValue = args; },
        fill() { commands.push({ type: "point", arc: this.arcValue, color: this.fillStyle }); },
        fillRect() {}, measureText: (text) => ({ width: text.length * 6 }),
        fillText(text, x, y) { commands.push({ type: "text", text, x, y }); }
      };
      canvases.push(this);
    }
    getContext(type) { return type === "2d" ? this.ctx : this.gl; }
    transferToImageBitmap() {
      return { width: this.width, height: this.height, graph: this.ctx.graph,
        commands: structuredClone(this.ctx.commands), closes: 0, close() { this.closes += 1; } };
    }
  }

  globalThis.OffscreenCanvas = Canvas;
  globalThis.self = { postMessage(message) { messages.push(message); receiver?.({ data: message }); } };
  const url = new URL(WORKER);
  url.searchParams.set("animation-test", String(++fixtureSequence));
  await import(url.href);
  const handle = globalThis.self.onmessage;
  function send(data) {
    const job = handle({ data: structuredClone(data) });
    jobs.add(job);
    job.finally(() => jobs.delete(job));
    return job;
  }
  t.after(async () => {
    receiver = null;
    completionAllowed = true;
    await send({ type: "cancel" });
    await Promise.all([...jobs]);
    if (oldSelf) Object.defineProperty(globalThis, "self", oldSelf); else delete globalThis.self;
    if (oldCanvas) Object.defineProperty(globalThis, "OffscreenCanvas", oldCanvas); else delete globalThis.OffscreenCanvas;
  });
  const request = (scene, { generation = 1, selected = ["t"], directions = {}, ...rest } = {}) => ({
    type: "render", revision: ++revision, generation, scene, sceneKey: JSON.stringify(scene),
    animation: { selected, directions }, width: 200, height: 200,
    ...rest
  });
  async function render(scene, options) {
    const job = request(scene, options);
    await send(job);
    return messages.findLast((message) => message.revision === job.revision && ["frame", "error", "cancelled"].includes(message.type));
  }
  return {
    render, request, send, messages, canvases,
    frames: () => messages.filter((message) => message.type === "frame"),
    at: (elapsedMs) => { now = 1000 + elapsedMs; },
    now: () => now,
    delay: (ms) => { delayMs = ms; },
    allowCompletion: (allowed) => { completionAllowed = allowed; },
    workerFactory: () => {
      const worker = {
        sent: [],
        postMessage(message) { this.sent.push(structuredClone(message)); void send(message); },
        terminate() { receiver = null; void send({ type: "cancel" }); }
      };
      receiver = (event) => worker.onmessage?.(event);
      return worker;
    }
  };
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    if (predicate()) return;
    await sleep(1);
  }
  assert.fail(`Timed out waiting for ${label}`);
}

function frame(result) {
  assert.equal(result?.type, "frame", result?.message ?? "Expected a completed frame");
  return result;
}

function applyClock(scene, result) {
  const next = structuredClone(scene);
  for (const entry of next.functions) {
    if (entry.kind === "slider" && entry.time && result.clockState?.values.has(entry.id)) {
      entry.expression = String(result.clockState.values.get(entry.id));
    }
  }
  return next;
}

test("first preview frame preserves starts and does not mutate the editor's scene", async (t) => {
  const f = await fixture(t);
  const input = graph([time("t", "2.125", "0.5")]);
  const before = structuredClone(input);
  const result = frame(await f.render(input));
  assert.equal(result.clockState.values.get("t"), 2.125);
  assert.equal(result.bitmap.graph.uniforms.u_time_0, 2.125);
  assert.equal(result.sliders.find((slider) => slider.id === "t").value, 2.125);
  assert.deepEqual(input, before);
});

test("transient preview samples use elapsed time rather than a capped per-frame delta", async (t) => {
  const f = await fixture(t);
  const input = graph([time("t", "4", "0.25")]);
  frame(await f.render(input));
  for (const elapsed of [16, 50, 500, 3500, 9000]) {
    f.at(elapsed);
    const result = frame(await f.render(input, { transient: true }));
    close(result.clockState.values.get("t"), 4 + elapsed / 1000 * 0.25);
    assert.equal(result.buildCount, 1, "Time-only changes should reuse shader source");
  }
});

test("slow GPU completion does not slow the animation clock or require new editor values", async (t) => {
  const f = await fixture(t);
  const input = graph();
  f.delay(400);
  for (let index = 0; index < 6; index += 1) {
    const result = frame(await f.render(input, { transient: index > 0 }));
    close(result.clockState.values.get("t"), index * 0.4);
    close(result.bitmap.graph.uniforms.u_time_0, index * 0.4);
  }
  assert.equal(f.now(), 3400);
});

test("unbounded preview values continue past 10,000 at full clock precision", async (t) => {
  const f = await fixture(t);
  const input = graph([time("t", "10000", "0.001")]);
  frame(await f.render(input));
  for (const ms of [1000 / 60, 200, 1000, 2000]) {
    f.at(ms);
    const result = frame(await f.render(input, { transient: true }));
    assert.equal(result.clockState.values.get("t"), 10000 + ms / 1000 * 0.001);
    assert.equal(result.bitmap.graph.uniforms.u_time_0, result.clockState.values.get("t"));
  }
});

test("negative bouncing clocks retain direction through ordinary field edits", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "0", "-2", { timeMode: "bounded", sliderMax: "4" })]);
  frame(await f.render(input));
  f.at(2000);
  const edge = frame(await f.render(input, { transient: true }));
  assert.equal(edge.clockState.values.get("t"), 4);
  assert.equal(edge.clockState.directions.get("t"), 1);
  input = applyClock(input, edge);
  input.colors[0].red = "120+x";
  frame(await f.render(input, { generation: 2, directions: Object.fromEntries(edge.clockState.directions) }));
  f.at(2500);
  const next = frame(await f.render(input, { generation: 2, transient: true }));
  assert.equal(next.clockState.values.get("t"), 3);
  assert.equal(next.buildCount, 2);
});

test("negative looped and zero-rate clocks keep their modes in the preview worker", async (t) => {
  const f = await fixture(t);
  const input = graph([
    time("t", "0", "-2", { timeMode: "bounded_looped", sliderMax: "4" }),
    time("still", "4", "0", { timeMode: "bounded_looped", sliderMax: "4" })
  ]);
  frame(await f.render(input, { selected: ["t", "still"] }));
  f.at(500);
  const result = frame(await f.render(input, { selected: ["t", "still"], transient: true }));
  assert.equal(result.clockState.values.get("t"), 3);
  assert.equal(result.clockState.values.get("still"), 4);
});

test("editing a rate or a referenced scalar while playing updates the new generation", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "1", "speed"), expression("speed", "2")]);
  frame(await f.render(input));
  f.at(1000);
  const first = frame(await f.render(input, { transient: true }));
  assert.equal(first.clockState.values.get("t"), 3);
  input = applyClock(input, first);
  input.functions.find((entry) => entry.id === "speed").expression = "-4";
  frame(await f.render(input, { generation: 2 }));
  f.at(1500);
  const second = frame(await f.render(input, { generation: 2, transient: true }));
  assert.equal(second.clockState.values.get("t"), 1);
});

test("live range edits inside the current value take effect without stopping playback", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "1", "2", { timeMode: "bounded", sliderMax: "10" })]);
  frame(await f.render(input));
  f.at(500);
  const previous = frame(await f.render(input, { transient: true }));
  input = applyClock(input, previous);
  input.functions[0].sliderMax = "3";
  frame(await f.render(input, { generation: 2, directions: Object.fromEntries(previous.clockState.directions) }));
  f.at(1500);
  const result = frame(await f.render(input, { generation: 2, transient: true }));
  assert.equal(result.clockState.values.get("t"), 2);
  assert.equal(result.clockState.directions.get("t"), -1);
  assert.equal(result.sliders[0].max, 3);
});

test("shrinking live bounds around an out-of-range playing value should recover", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "8", "1", { timeMode: "bounded", sliderMax: "10" })]);
  input = applyClock(input, frame(await f.render(input)));
  input.functions[0].sliderMax = "4";
  const recovered = frame(await f.render(input, { generation: 2 }));
  assert.ok(recovered.clockState.values.get("t") >= 0 && recovered.clockState.values.get("t") <= 4);
  f.at(500);
  frame(await f.render(input, { generation: 2, transient: true }));
});

test("cross-dependent live clocks and moving bounds agree with deterministic scene-clock", async (t) => {
  const f = await fixture(t);
  const input = graph([
    time("t", "0.5", "u/10", { timeMode: "bounded", sliderMin: "u-1", sliderMax: "u+2" }),
    time("u", "0", "0.5")
  ]);
  const reference = createSceneClock(input, { selected: ["t", "u"] });
  for (const elapsed of [0, 133, 500, 2200]) {
    f.at(elapsed);
    const result = frame(await f.render(input, { selected: ["t", "u"], transient: elapsed > 0 }));
    assert.deepEqual(result.clockState, reference.stateAt(elapsed / 1000));
  }
});

test("pause/resume and changing which clocks play do not animate deselected clocks", async (t) => {
  const f = await fixture(t);
  let input = graph([time(), time("u", "7", "-2")]);
  frame(await f.render(input));
  f.at(1000);
  const previous = frame(await f.render(input, { transient: true }));
  input = applyClock(input, previous);
  assert.equal(previous.clockState.values.get("u"), 7);
  assert.equal(frame(await f.render(input, { generation: 2, selected: [] })).clockState, undefined);
  f.at(10000);
  frame(await f.render(input, { generation: 3, selected: ["u"] }));
  f.at(11000);
  const result = frame(await f.render(input, { generation: 3, selected: ["u"], transient: true }));
  assert.equal(result.clockState.values.get("t"), 1);
  assert.equal(result.clockState.values.get("u"), 5);
});

test("points, labels, point colors and graph uniforms use the same sampled time", async (t) => {
  const f = await fixture(t);
  const input = graph([
    time(), { id: "readout", kind: "function", outputType: "expression", params: ["a", "b"], expression: "a+b+t" }
  ]);
  input.points = [{ id: "p", x: "t", y: "2*t", colorId: "paint", showLabel: true, linkedFunctionId: "readout" }];
  f.delay(600);
  frame(await f.render(input));
  f.at(2000);
  const result = frame(await f.render(input, { transient: true }));
  assert.equal(result.bitmap.graph.uniforms.u_time_0, 2);
  const point = result.bitmap.commands.find((command) => command.type === "point");
  assert.deepEqual(point.arc.slice(0, 3), [120, 60, 6]);
  assert.equal(point.color, "rgb(102,104,102)");
  const label = result.bitmap.commands.find((command) => command.type === "text");
  assert.match(label.text, /p = \(2, 4\)/);
  assert.match(label.text, /readout = 8/);
  assert.match(result.bitmap.graph.source, /u_time_0/);
});

test("color field edits and point edits are present in the next generated frame", async (t) => {
  const f = await fixture(t);
  let input = graph();
  input.points = [{ id: "p", x: "t", y: "t", colorId: "paint" }];
  frame(await f.render(input));
  f.at(1000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  input.colors[0].red = "200+x";
  input.points[0].x = "2*t";
  const result = frame(await f.render(input, { generation: 2 }));
  const point = result.bitmap.commands.find((command) => command.type === "point");
  assert.equal(point.color, "rgb(202,101,101)");
  assert.equal(point.arc[0], 120);
  assert.match(result.bitmap.graph.source, /200\.0/);
  assert.equal(result.buildCount, 2);
});

test("directly drawing a time slider must not freeze its initial value in the cached shader", async (t) => {
  const f = await fixture(t);
  const input = graph([time("t", "2", "1")]);
  input.draws[0].equationId = "t";
  const initial = frame(await f.render(input));
  f.at(2000);
  const result = frame(await f.render(input, { transient: true }));
  assert.equal(result.clockState.values.get("t"), 4);
  assert.equal(result.bitmap.graph.uniforms.u_time_0, 4);
  assert.equal(result.buildCount, initial.buildCount);
  const z = result.bitmap.graph.source.match(/float z = ([^;]+);/);
  assert.ok(z, "Expected the direct draw layer to exist");
  assert.match(z[1], /u_time_0/, "Draw value must read the time uniform, not an inlined start");
});

test("non-time edits during a slow render should not reset time to the last displayed frame", async (t) => {
  const f = await fixture(t);
  let input = graph();
  f.delay(1000);
  input = applyClock(input, frame(await f.render(input)));
  f.at(2000);
  const displayed = frame(await f.render(input, { transient: true }));
  assert.equal(displayed.clockState.values.get("t"), 2);
  assert.equal(f.now(), 4000, "Frame sampled at 2 seconds completes at 3 seconds");
  input = applyClock(input, displayed);
  input.colors[0].red = "120+x";
  const edited = frame(await f.render(input, { generation: 2 }));
  assert.equal(edited.clockState.values.get("t"), 3, "A color edit should preserve the elapsed animation time, not reuse the older displayed sample");
});

test("queued animation ticks do not cancel slow frames and stale edited frames stay hidden", async (t) => {
  const f = await fixture(t);
  const accepted = [], errors = [];
  let worker;
  const client = new PreviewClient({
    onFrame: (result) => accepted.push(result), onError: (error) => errors.push(error),
    workerFactory: () => (worker = f.workerFactory())
  });
  t.after(() => client.dispose());
  const input = graph();
  f.allowCompletion(false);
  client.request(f.request(input));
  await waitFor(() => f.canvases.some((canvas) => canvas.gl.shadersSubmitted), "shader submission");
  for (let tick = 1; tick <= 10; tick += 1) {
    f.at(tick * 100);
    client.request({ ...f.request(input), transient: true });
  }
  assert.equal(worker.sent.filter((message) => message.type === "cancel").length, 0);
  assert.equal(worker.sent.filter((message) => message.type === "render").length, 1);
  f.allowCompletion(true);
  await waitFor(() => accepted.length === 2, "initial and coalesced animation frame");
  assert.equal(errors.length, 0);
  assert.equal(accepted[0].clockState.values.get("t"), 0);
  assert.equal(accepted[1].clockState.values.get("t"), 1);
  assert.equal(accepted[1].buildCount, 1);
  const changed = applyClock(input, accepted.at(-1));
  changed.colors[0].red = "200+x";
  f.allowCompletion(false);
  client.request({ ...f.request(changed), transient: false });
  await waitFor(() => f.canvases[0].gl.shadersSubmitted >= 4, "edited shader submission");
  changed.colors[0].red = "230+x";
  client.request({ ...f.request(changed), transient: false });
  client.request({ ...f.request(changed), transient: true });
  f.allowCompletion(true);
  await waitFor(() => accepted.length === 3, "newest edit frame");
  assert.equal(errors.length, 0);
  assert.match(accepted.at(-1).bitmap.graph.source, /230\.0/);
  assert.equal(accepted.at(-1).generation, client.generation);
});

test("repeated non-time edits keep the dynamic clock lattice and full precision despite rounded feedback", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "10000", "u/10000"), time("u", "1", "t/10000")]);
  const reference = createSceneClock(input, { selected: ["t", "u"] });
  let previous = frame(await f.render(input, { selected: ["t", "u"] }));
  f.delay(83);
  for (const [index, elapsed] of [137, 529, 833, 1711].entries()) {
    input = applyClock(input, previous);
    for (const entry of input.functions.filter((entry) => entry.time)) {
      entry.expression = Number(entry.expression).toFixed(3);
    }
    input.colors[0].red = `${150 + index}+x`;
    input.points = [{ id: "p", x: `${index}+t`, y: "u", colorId: "paint" }];
    f.at(elapsed);
    previous = frame(await f.render(input, { generation: index + 2, selected: ["t", "u"], directions: Object.fromEntries(previous.clockState.directions) }));
    assert.deepEqual(previous.clockState, reference.stateAt(elapsed / 1000));
    assert.equal(previous.bitmap.graph.uniforms.u_time_0, previous.clockState.values.get("t"));
  }
});

test("explicit value edits including a reset to the original start take effect while playing", async (t) => {
  const f = await fixture(t);
  let input = graph();
  frame(await f.render(input));
  f.at(2000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  input.functions[0].expression = "0";
  assert.equal(frame(await f.render(input, { generation: 2 })).clockState.values.get("t"), 0);
  f.at(3000);
  const advanced = frame(await f.render(input, { generation: 2, transient: true }));
  assert.equal(advanced.clockState.values.get("t"), 1);
  input = applyClock(input, advanced);
  input.functions[0].expression = "sqrt(25)";
  assert.equal(frame(await f.render(input, { generation: 3 })).clockState.values.get("t"), 5);
  f.at(3500);
  assert.equal(frame(await f.render(input, { generation: 3, transient: true })).clockState.values.get("t"), 5.5);
});

test("rate edits rebase at elapsed wall time, not the last completed frame's older sample", async (t) => {
  const f = await fixture(t);
  let input = graph();
  frame(await f.render(input));
  f.at(2000);
  f.delay(1000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  assert.equal(input.functions[0].expression, "2");
  input.functions[0].timeRate = "2";
  f.delay(0);
  assert.equal(frame(await f.render(input, { generation: 2 })).clockState.values.get("t"), 3);
  f.at(4000);
  assert.equal(frame(await f.render(input, { generation: 2, transient: true })).clockState.values.get("t"), 5);
});

test("transitive user-function, collection and point edits invalidate rates but local parameter shadows do not", async (t) => {
  const f = await fixture(t);
  let input = graph([
    time("t", "0", "rate(items[0])+p.x"), expression("speed", "7"),
    { id: "rate", kind: "function", params: ["speed"], expression: "speed*2" }
  ]);
  input.lists = [{ id: "items", expression: "[1,5]" }];
  input.points = [{ id: "p", x: "1", y: "0", hidden: true }];
  frame(await f.render(input));
  f.at(1000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  assert.equal(input.functions[0].expression, "3");
  input.functions.find((entry) => entry.id === "speed").expression = "99";
  frame(await f.render(input, { generation: 2 }));
  f.at(1500);
  input = applyClock(input, frame(await f.render(input, { generation: 2, transient: true })));
  assert.equal(input.functions[0].expression, "4.5");
  input.lists[0].expression = "[3,5]";
  frame(await f.render(input, { generation: 3 }));
  f.at(2000);
  input = applyClock(input, frame(await f.render(input, { generation: 3, transient: true })));
  assert.equal(input.functions[0].expression, "8");
  input.points[0].x = "2";
  frame(await f.render(input, { generation: 4 }));
  f.at(2500);
  input = applyClock(input, frame(await f.render(input, { generation: 4, transient: true })));
  assert.equal(input.functions[0].expression, "12");
  input.functions.find((entry) => entry.id === "rate").expression = "speed*3";
  frame(await f.render(input, { generation: 5 }));
  f.at(3000);
  assert.equal(frame(await f.render(input, { generation: 5, transient: true })).clockState.values.get("t"), 17.5);
});

test("shrinking a bouncing range clamps the elapsed value and then moves inward with a negative speed", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "8", "-1", { timeMode: "bounded" })]);
  frame(await f.render(input));
  f.at(1000);
  f.delay(1000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  input.functions[0].sliderMin = "8";
  f.delay(0);
  const rebased = frame(await f.render(input, { generation: 2 }));
  assert.equal(rebased.clockState.values.get("t"), 8);
  f.at(2500);
  const next = frame(await f.render(input, { generation: 2, transient: true }));
  assert.equal(next.clockState.values.get("t"), 8.5);
  assert.equal(next.clockState.directions.get("t"), -1);
});

test("live loop range edits wrap in both directions while export remains strict", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "8", "-1", { timeMode: "bounded_looped" })]);
  frame(await f.render(input));
  input.functions[0].sliderMax = "3";
  assert.throws(() => createSceneClock(input), (error) => error.code === "START_OUT_OF_RANGE");
  const wrapped = frame(await f.render(input, { generation: 2 }));
  assert.equal(wrapped.clockState.values.get("t"), 2);
  input = applyClock(input, wrapped);
  input.functions[0].sliderMin = "3";
  input.functions[0].sliderMax = "7";
  assert.throws(() => createSceneClock(input), (error) => error.code === "START_OUT_OF_RANGE");
  const below = frame(await f.render(input, { generation: 3 }));
  assert.equal(below.clockState.values.get("t"), 6);
  f.at(500);
  assert.equal(frame(await f.render(input, { generation: 3, transient: true })).clockState.values.get("t"), 5.5);
});

test("zero-width live ranges hold until widened without losing negative bounce direction", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "8", "-1", { timeMode: "bounded" })]);
  frame(await f.render(input));
  input.functions[0].sliderMin = "3";
  input.functions[0].sliderMax = "3";
  input = applyClock(input, frame(await f.render(input, { generation: 2 })));
  assert.equal(input.functions[0].expression, "3");
  f.at(10000);
  const held = frame(await f.render(input, { generation: 2, transient: true }));
  assert.equal(held.clockState.values.get("t"), 3);
  input.functions[0].sliderMax = "6";
  frame(await f.render(input, { generation: 3 }));
  f.at(11000);
  const resumed = frame(await f.render(input, { generation: 3, transient: true }));
  assert.equal(resumed.clockState.values.get("t"), 4);
  assert.equal(resumed.clockState.directions.get("t"), -1);
});

test("mode changes and selected-clock changes rebase without losing other clocks' elapsed time", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "0", "2"), time("u", "10", "-1")]);
  frame(await f.render(input));
  f.at(1000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  f.at(1500);
  input.functions[0].timeMode = "bounded_looped";
  input.functions[0].sliderMax = "2";
  const selected = frame(await f.render(input, { generation: 2, selected: ["t", "u"] }));
  assert.equal(selected.clockState.values.get("t"), 1);
  assert.equal(selected.clockState.values.get("u"), 10);
  input = applyClock(input, selected);
  f.at(2000);
  const deselected = frame(await f.render(input, { generation: 3, selected: ["u"] }));
  assert.equal(deselected.clockState.values.get("t"), 0);
  assert.equal(deselected.clockState.values.get("u"), 9.5);
  input = applyClock(input, deselected);
  f.at(3000);
  const later = frame(await f.render(input, { generation: 3, selected: ["u"], transient: true }));
  assert.equal(later.clockState.values.get("t"), 0);
  assert.equal(later.clockState.values.get("u"), 8.5);
});

test("invalid range edits preserve error metadata and can be repaired during playback", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "0", "1", { timeMode: "bounded" })]);
  const first = frame(await f.render(input));
  input = applyClock(input, first);
  f.at(1000);
  input.functions[0].sliderMin = "20";
  const result = await f.render(input, { generation: 2 });
  assert.equal(result.type, "error");
  assert.equal(result.generation, 2);
  assert.match(result.message, /minimum <= maximum/);
  assert.equal(result.diagnostics.hasErrors, true);
  assert.equal(result.diagnostics.functions[0].status, "invalid");
  assert.equal(result.diagnostics.functions[0].message, result.message);
  input.functions[0].sliderMin = "0";
  f.at(2000);
  const repaired = frame(await f.render(input, { generation: 3 }));
  assert.equal(repaired.clockState.values.get("t"), 2);
  assert.equal(repaired.diagnostics.functions[0].status, "valid");
  assert.ok(f.messages.some((message) => message.type === "phase" && message.revision === repaired.revision));
});

test("live normalization never permits coordinate-dependent or nonfinite bounds", async (t) => {
  const f = await fixture(t);
  const input = graph([time("t", "8", "1", { timeMode: "bounded" })]);
  frame(await f.render(input));
  for (const [index, invalid] of ["x+3", "1/0"].entries()) {
    input.functions[0].sliderMax = invalid;
    const result = await f.render(input, { generation: index + 2 });
    assert.equal(result.type, "error");
    assert.match(result.message, /coordinates|finite scalar/);
    assert.equal(result.diagnostics.functions[0].status, "invalid");
  }
});

test("editing a failed dynamic rate recovers from the last valid clock state", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "0", "sqrt(1-u)"), time("u", "0", "1")]);
  frame(await f.render(input, { selected: ["t", "u"] }));
  f.at(500);
  const valid = frame(await f.render(input, { selected: ["t", "u"], transient: true }));
  input = applyClock(input, valid);
  f.at(2000);
  const failed = await f.render(input, { selected: ["t", "u"], transient: true });
  assert.equal(failed.type, "error");
  assert.equal(failed.diagnostics.functions[0].status, "invalid");
  input.functions[0].timeRate = "1";
  const repaired = frame(await f.render(input, { generation: 2, selected: ["t", "u"] }));
  assert.deepEqual(repaired.clockState.values, valid.clockState.values);
  f.at(2500);
  const next = frame(await f.render(input, { generation: 2, selected: ["t", "u"], transient: true }));
  close(next.clockState.values.get("t"), valid.clockState.values.get("t") + 0.5);
  close(next.clockState.values.get("u"), 1);
});

test("diagnostics are published with scene metadata before a slow shader completes", async (t) => {
  const f = await fixture(t);
  const input = graph();
  input.functions.push(expression("broken", "missingName+1"));
  f.allowCompletion(false);
  const request = f.request(input, { generation: 7 });
  const job = f.send(request);
  await waitFor(() => f.canvases.some((canvas) => canvas.gl.shadersSubmitted), "pending shader");
  const diagnostics = f.messages.find((message) => message.type === "diagnostics" && message.revision === request.revision);
  assert.ok(diagnostics, "Flags must not wait for a frame to finish");
  assert.equal(diagnostics.generation, 7);
  assert.equal(diagnostics.sceneKey, request.sceneKey);
  assert.equal(diagnostics.diagnostics.functions.at(-1).status, "invalid");
  assert.equal(f.frames().length, 0);
  f.allowCompletion(true);
  await job;
  const result = frame(f.frames().at(-1));
  assert.deepEqual(result.diagnostics, diagnostics.diagnostics);
  assert.equal(result.clockState.values.get("t"), 0);
});

test("cancelling an edited shader does not roll back its clock rebase or lose elapsed time", async (t) => {
  const f = await fixture(t);
  let input = graph();
  frame(await f.render(input));
  f.at(1000);
  input = applyClock(input, frame(await f.render(input, { transient: true })));
  f.at(1500);
  input.functions[0].timeRate = "2";
  input.colors[0].red = "150+x";
  f.allowCompletion(false);
  const pending = f.request(input, { generation: 2 });
  const job = f.send(pending);
  await waitFor(() => f.canvases[0].gl.shadersSubmitted >= 4, "edited shader waiting for GPU");
  f.at(2000);
  await f.send({ type: "cancel" });
  await job;
  const cancelled = f.messages.findLast((message) => message.revision === pending.revision);
  assert.equal(cancelled.type, "cancelled");
  assert.equal(cancelled.generation, 2);
  input.colors[0].red = "180+x";
  f.allowCompletion(true);
  const next = frame(await f.render(input, { generation: 3 }));
  assert.equal(next.clockState.values.get("t"), 2.5);
  assert.match(next.bitmap.graph.source, /180\.0/);
  assert.equal(f.frames().length, 3, "Cancelled shader must not produce a frame");
});

test("renaming a time variable by stable ID preserves its advanced value and bounce direction", async (t) => {
  const f = await fixture(t);
  let input = graph([time("t", "3", "1", { _uid: "clock-uid", timeMode: "bounded", sliderMax: "4" })]);
  frame(await f.render(input));
  f.at(1500);
  const previous = frame(await f.render(input, { transient: true }));
  assert.equal(previous.clockState.directions.get("t"), -1);
  input = applyClock(input, previous);
  input.functions[0].id = "renamed";
  input.functions[1].expression = "x+renamed";
  input.colors[0].blue = "100+renamed";
  f.at(2000);
  const renamed = frame(await f.render(input, { generation: 2, selected: ["renamed"], directions: { renamed: -1 } }));
  assert.equal(renamed.clockState.values.get("renamed"), 3);
  assert.equal(renamed.clockState.directions.get("renamed"), -1);
  f.at(2500);
  assert.equal(frame(await f.render(input, { generation: 2, selected: ["renamed"], transient: true })).clockState.values.get("renamed"), 2.5);
});

test("an initially invalid clock publishes current red diagnostics without submitting a shader", async (t) => {
  const f = await fixture(t);
  const input = graph([time("t", "0", "x+1")]);
  const request = f.request(input, { generation: 9 });
  await f.send(request);
  const events = f.messages.filter((message) => message.revision === request.revision);
  assert.deepEqual(events.map((message) => message.type), ["diagnostics", "error"]);
  const [published, error] = events;
  assert.equal(published.generation, 9);
  assert.equal(published.sceneKey, request.sceneKey);
  assert.equal(error.generation, 9);
  assert.match(error.message, /coordinates/);
  assert.deepEqual(error.diagnostics, published.diagnostics);
  assert.equal(error.diagnostics.hasErrors, true);
  assert.equal(error.diagnostics.summary, error.message);
  assert.equal(error.diagnostics.functions.length, input.functions.length);
  assert.deepEqual(error.diagnostics.functions[0], { status: "invalid", message: error.message });
  assert.equal(error.diagnostics.functions[1].status, "valid");
  assert.equal(f.frames().length, 0);
  assert.equal(f.canvases[0].gl.shadersSubmitted, 0);
});

test("a clock failure after reordering validates current indices and other newly edited objects", async (t) => {
  const f = await fixture(t);
  const input = graph();
  const initial = frame(await f.render(input));
  const previousDiagnostics = structuredClone(initial.diagnostics);
  input.functions = [expression("newValue", "3"), input.functions[1], time("t", "0", "1/0")];
  input.colors.push({ id: "brokenPaint", red: "notDeclared", green: "0", blue: "0" });
  const request = f.request(input, { generation: 2 });
  await f.send(request);
  const events = f.messages.filter((message) => message.revision === request.revision);
  assert.deepEqual(events.map((message) => message.type), ["diagnostics", "error"]);
  const [published, error] = events;
  assert.equal(published.generation, 2);
  assert.equal(published.sceneKey, request.sceneKey);
  assert.deepEqual(error.diagnostics, published.diagnostics);
  assert.deepEqual(error.diagnostics.functions.map((issue) => issue.status), ["valid", "valid", "invalid"]);
  assert.equal(error.diagnostics.functions[2].message, error.message);
  assert.match(error.message, /finite scalar/);
  assert.equal(error.diagnostics.colors.length, 2);
  assert.equal(error.diagnostics.colors[1].status, "invalid");
  assert.deepEqual(initial.diagnostics, previousDiagnostics, "Previous scene diagnostics must not be mutated");
  assert.equal(f.frames().length, 1);

  input.functions[2].timeRate = "2";
  input.colors[1].red = "100";
  const repaired = frame(await f.render(input, { generation: 3 }));
  assert.equal(repaired.diagnostics.hasErrors, false);
  assert.deepEqual(repaired.diagnostics.functions.map((issue) => issue.status), ["valid", "valid", "valid"]);
});

test("clock error validation keeps renderer scene and cache coherent without caching the clock-only red flag", async (t) => {
  let renderer;
  const validate = SnapshotRenderer.prototype.validate;
  t.mock.method(SnapshotRenderer.prototype, "validate", function (...args) {
    renderer = this;
    return validate.apply(this, args);
  });
  const f = await fixture(t);
  frame(await f.render(graph()));
  const input = graph([expression("first", "1"), time("t", "0", "2")]);
  const request = f.request(input, { generation: 2, directions: { t: 0 } });
  await f.send(request);
  const error = f.messages.at(-1);
  assert.equal(error.type, "error");
  assert.deepEqual(renderer.scene, input);
  assert.deepEqual(renderer.runtime.getScene(), input);
  assert.equal(renderer.diagnosticKey, JSON.stringify(input));
  assert.equal(error.diagnostics.functions[1].status, "invalid");
  // Invalid playback direction is not a scene error. A later paused render
  // must not inherit the clock's red override in the scene validation cache.
  assert.notEqual(renderer.diagnostics.functions[1].status, "invalid");
  const paused = frame(await f.render(input, { generation: 3, selected: [] }));
  assert.deepEqual(paused.diagnostics, renderer.diagnostics);
  assert.notEqual(paused.diagnostics.functions[1].status, "invalid");
});

test("cancelling during clock evaluation does not validate, publish flags or replace the renderer scene", async (t) => {
  let renderer;
  const validate = SnapshotRenderer.prototype.validate;
  const validation = t.mock.method(SnapshotRenderer.prototype, "validate", function (...args) {
    renderer = this;
    return validate.apply(this, args);
  });
  const f = await fixture(t);
  const input = graph();
  frame(await f.render(input));
  const previousScene = structuredClone(renderer.scene);
  const previousDiagnostics = structuredClone(renderer.diagnostics);
  const count = validation.mock.callCount();
  const changed = graph([expression("first", "2"), time("t", "0", "2")]);
  const request = f.request(changed, { generation: 2 });
  const job = f.send(request);
  await f.send({ type: "cancel" });
  await job;
  const events = f.messages.filter((message) => message.revision === request.revision);
  assert.deepEqual(events.map((message) => message.type), ["cancelled"]);
  assert.equal(validation.mock.callCount(), count);
  assert.deepEqual(renderer.scene, previousScene);
  assert.deepEqual(renderer.diagnostics, previousDiagnostics);
});
