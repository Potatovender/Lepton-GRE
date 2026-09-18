import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { MAX_CACHED_PROGRAMS, prepareFrame, renderFrameAsync, renderFrame, disposeRenderer, RendererError } from "../src/index.js";

function fixture({ parallel = true, webgl2 = true, supported = true } = {}) {
  const state = { parallel, complete: true, compile: true, link: true, lost: false, strictAsync: false, fail: "",
    scissor: [0, 0, 320, 180], scissorEnabled: false, fenceReady: true };
  const calls = { polls: 0, statuses: 0, shaderStatuses: 0, logs: 0, contexts: 0, losses: 0, extensions: [],
    sources: [], programs: [], deletes: [], draws: [], clears: 0, finishes: 0, viewports: [], preventions: 0,
    scissors: [], waits: [], flushes: 0 };
  const live = { shaders: new Set(), programs: new Set(), buffers: new Set(), fences: new Set() };
  const listeners = new Map();
  let nextId = 0;
  const allocate = (kind) => {
    if (state.fail === kind) return null;
    const object = { id: ++nextId, kind };
    live[kind].add(object);
    return object;
  };
  const remove = (object) => {
    assert(live[object.kind].delete(object), `double deletion of ${object.kind} ${object.id}`);
    calls.deletes.push(object);
  };
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, MAX_RENDERBUFFER_SIZE: 5,
    ARRAY_BUFFER: 6, STATIC_DRAW: 7, FLOAT: 8, TRIANGLES: 9, COLOR_BUFFER_BIT: 10,
    SCISSOR_TEST: 11, SCISSOR_BOX: 12, SYNC_GPU_COMMANDS_COMPLETE: 13,
    ALREADY_SIGNALED: 14, CONDITION_SATISFIED: 15, TIMEOUT_EXPIRED: 16, WAIT_FAILED: 17,
    createShader(type) { const shader = allocate("shaders"); if (shader) shader.type = type; return shader; },
    shaderSource(shader, source) { shader.source = source; calls.sources.push(source); },
    compileShader(shader) { shader.valid = state.compile; },
    getShaderParameter(shader, parameter) {
      assert.equal(parameter, gl.COMPILE_STATUS);
      calls.shaderStatuses++;
      if (state.strictAsync && state.parallel) assert(state.complete && calls.polls > 0, "early shader status query");
      return shader.valid;
    },
    getShaderInfoLog() { calls.logs++; return "bad shader"; },
    deleteShader: remove,
    createProgram() {
      const program = allocate("programs");
      if (program) { program.shaders = []; program.uniforms = {}; calls.programs.push(program); }
      return program;
    },
    attachShader(program, shader) { program.shaders.push(shader); },
    linkProgram(program) { program.valid = state.link && program.shaders.every((shader) => shader.valid); },
    getProgramParameter(program, parameter) {
      assert(live.programs.has(program), "query on a deleted program");
      if (parameter === 0x91b1) { calls.polls++; return state.complete || state.lost; }
      assert.equal(parameter, gl.LINK_STATUS);
      if (state.strictAsync && state.parallel) assert(state.complete && calls.polls > 0, "early blocking link query");
      calls.statuses++;
      return program.valid;
    },
    getProgramInfoLog() { calls.logs++; return "bad link"; },
    deleteProgram: remove,
    createBuffer: () => allocate("buffers"), deleteBuffer: remove,
    bindBuffer(_target, buffer) { gl.buffer = buffer; },
    bufferData(_target, data) { if (state.fail === "upload") throw new Error("upload failed"); gl.buffer.data = [...data]; },
    getAttribLocation: () => 0,
    getUniformLocation(program, name) {
      if (state.fail === "uniforms") throw new Error("uniform lookup failed");
      return { program, name };
    },
    getParameter: (parameter) => parameter === gl.SCISSOR_BOX ? new Int32Array(state.scissor) : 4096,
    isEnabled(parameter) { assert.equal(parameter, gl.SCISSOR_TEST); return state.scissorEnabled; },
    enable(parameter) { assert.equal(parameter, gl.SCISSOR_TEST); state.scissorEnabled = true; },
    disable(parameter) { assert.equal(parameter, gl.SCISSOR_TEST); state.scissorEnabled = false; },
    scissor(...values) { state.scissor = values; calls.scissors.push(values); },
    viewport(...args) { calls.viewports.push(args); },
    useProgram(program) { assert(live.programs.has(program)); gl.program = program; },
    enableVertexAttribArray() {}, vertexAttribPointer() {},
    uniform1f(location, value) { location.program.uniforms[location.name] = value; },
    uniform1i(location, value) { location.program.uniforms[location.name] = value; },
    uniform2f(location, ...values) { location.program.uniforms[location.name] = values; },
    uniform3f(location, ...values) { location.program.uniforms[location.name] = values; },
    uniform4f(location, ...values) { location.program.uniforms[location.name] = values; },
    clearColor(...values) { gl.clearValue = values; },
    clear() { calls.clears++; },
    drawArrays(...args) {
      if (state.fail === "draw") throw new Error("draw failed");
      assert.equal(live.fences.size, 0, "Never submit another batch while its predecessor fence is pending");
      calls.draws.push({ program: gl.program, uniforms: structuredClone(gl.program.uniforms),
        vertices: gl.buffer.data, clear: gl.clearValue, args, scissor: state.scissorEnabled ? [...state.scissor] : null });
    },
    fenceSync(condition, flags) {
      assert.equal(condition, gl.SYNC_GPU_COMMANDS_COMPLETE); assert.equal(flags, 0);
      return allocate("fences");
    },
    clientWaitSync(fence, flags, timeout) {
      assert(live.fences.has(fence)); assert.equal(flags, 0); assert.equal(timeout, 0);
      calls.waits.push(fence); state.onWait?.();
      if (state.fail === "wait") return gl.WAIT_FAILED;
      return state.fenceReady ? (state.fenceStatus ?? gl.ALREADY_SIGNALED) : gl.TIMEOUT_EXPIRED;
    },
    deleteSync: remove,
    flush() { calls.flushes++; if (state.fail === "flush") throw new Error("flush failed"); },
    finish() { calls.finishes++; }, isContextLost: () => state.lost,
    getExtension(name) {
      calls.extensions.push(name);
      if (name === "KHR_parallel_shader_compile") return state.parallel ? { COMPLETION_STATUS_KHR: 0x91b1 } : null;
      if (name === "WEBGL_lose_context") return { loseContext() { calls.losses++; dispatch("webglcontextlost"); } };
      return null;
    }
  };
  // No document/window/requestAnimationFrame is required, matching an internal worker canvas.
  const canvas = { width: 320, height: 180,
    getContext(type) { calls.contexts++; return supported && (type !== "webgl2" || webgl2) ? gl : null; },
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); }
  };
  function dispatch(name) {
    state.lost = name === "webglcontextlost";
    for (const callback of listeners.get(name) ?? []) callback({ preventDefault() { calls.preventions++; } });
  }
  const options = { width: 100, height: 50, bounds: { xMin: -2, xMax: 2, yMin: -1, yMax: 1 },
    shaderKey: "a", fragmentSource: "precision highp float; void main(){gl_FragColor=vec4(1.0);}", floats: { u_time: 1 } };
  return { canvas, options, gl, state, calls, live, listeners, dispatch };
}

async function until(predicate) {
  const deadline = performance.now() + 2000;
  while (!predicate()) {
    if (performance.now() > deadline) assert.fail("Timed out waiting for mock driver activity");
    await delay(1);
  }
}

const controls = { pollIntervalMs: 0 };
const aborted = { name: "AbortError" };
function assertEmpty(live) {
  for (const resources of Object.values(live)) assert.equal(resources.size, 0);
}

test("parallel preparation yields tasks and never queries blocking status before completion", async () => {
  const { canvas, options, calls, state, live } = fixture();
  state.complete = false; state.strictAsync = true;
  let produced = 0;
  const promise = prepareFrame(canvas, { ...options, fragmentSource() { produced++; return options.fragmentSource; } }, controls);
  assert.equal(produced, 0, "work starts after a task yield");
  await until(() => calls.polls >= 3);
  assert.equal(calls.statuses, 0); assert.equal(calls.shaderStatuses, 0); assert.equal(calls.logs, 0);
  assert.equal(calls.clears, 0); assert.equal(calls.viewports.length, 0);
  assert.deepEqual([canvas.width, canvas.height], [320, 180]);
  assert.equal(produced, 1);
  state.complete = true;
  const prepared = await promise;
  assert.equal(prepared.compiled, true); assert(prepared.compileMs > 0);
  assert.equal(calls.statuses, 1); assert.equal(calls.shaderStatuses, 0);
  assert.equal(calls.draws.length, 0); assert.equal(calls.finishes, 0);
  assert.equal(live.shaders.size, 0); assert.equal(live.programs.size, 1);
  const rendered = renderFrame(canvas, options);
  assert.equal(rendered.compiled, false); assert.equal(calls.draws.length, 1);
  disposeRenderer(canvas); assertEmpty(live);
});

test("async drawing preserves synchronous uniform, geometry and pixel-size commands without finish", async () => {
  const sync = fixture(); const async = fixture();
  const extra = { dpr: 2, clipBounds: { xMin: -1, xMax: 1, yMin: -0.5, yMax: 0.5 },
    background: [0.3, 0.4, 0.5], floats: { u_time: NaN, u_other: 5 }, synchronous: true };
  renderFrame(sync.canvas, { ...sync.options, ...extra });
  const rendered = await renderFrameAsync(async.canvas, { ...async.options, ...extra }, controls);
  assert.equal(rendered.compiled, true);
  assert.deepEqual({ ...sync.calls.draws[0], program: null }, { ...async.calls.draws[0], program: null });
  assert.deepEqual(sync.calls.viewports, async.calls.viewports);
  assert.equal(sync.calls.finishes, 1); assert.equal(async.calls.finishes, 0);
  assert.deepEqual([async.canvas.width, async.canvas.height], [200, 100]);
  disposeRenderer(sync.canvas); disposeRenderer(async.canvas);
});

test("async option snapshots are not changed by the caller during compilation", async () => {
  const { canvas, options, calls, state } = fixture();
  state.complete = false;
  options.clipBounds = { ...options.bounds }; options.background = [0, 0.5, 1];
  const promise = renderFrameAsync(canvas, options, controls);
  await until(() => calls.polls > 0);
  options.width = 900; options.bounds.xMin = -900; options.clipBounds.xMin = -800;
  options.background[0] = 1; options.floats.u_time = 100;
  state.complete = true;
  await promise;
  assert.equal(canvas.width, 100);
  assert.deepEqual(calls.draws[0].uniforms.u_bounds, [-2, 2, -1, 1]);
  assert.deepEqual(calls.draws[0].uniforms.u_clip_bounds, [-2, 2, -1, 1]);
  assert.deepEqual(calls.draws[0].uniforms.u_background, [0, 0.5, 1]);
  assert.equal(calls.draws[0].uniforms.u_time, 1);
  disposeRenderer(canvas);
});

test("unsupported extension falls back after yielding; no DOM or animation frame API is needed", async () => {
  const { canvas, options, calls, state } = fixture({ parallel: false, webgl2: false });
  state.strictAsync = true;
  const promise = renderFrameAsync(canvas, options, controls);
  assert.equal(calls.statuses, 0);
  await promise;
  assert.equal(calls.polls, 0); assert.equal(calls.statuses, 1); assert.equal(calls.draws.length, 1);
  assert.equal(calls.finishes, 0);
  disposeRenderer(canvas);
});

test("pre-aborted or stale jobs allocate no context or GPU resources", async () => {
  const { canvas, options, calls } = fixture();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(renderFrameAsync(canvas, options, { signal: controller.signal }), aborted);
  await assert.rejects(prepareFrame(canvas, options, { isCurrent: () => false }), aborted);
  assert.equal(calls.contexts, 0); assert.equal(calls.programs.length, 0);
});

test("abort during polling releases pending work immediately and preserves last successful image", async () => {
  const { canvas, options, calls, state, live } = fixture();
  renderFrame(canvas, options);
  const good = calls.programs[0];
  state.complete = false;
  const controller = new AbortController();
  const promise = renderFrameAsync(canvas, { ...options, shaderKey: "b", width: 999 }, { signal: controller.signal, pollIntervalMs: 500 });
  const rejection = assert.rejects(promise, aborted);
  await until(() => calls.programs.length === 2);
  controller.abort();
  assert.equal(live.programs.size, 1); assert(live.programs.has(good)); assert.equal(live.shaders.size, 0);
  await rejection;
  assert.equal(calls.clears, 1); assert.equal(calls.draws.length, 1); assert.equal(canvas.width, 100);
  assert.equal(renderFrame(canvas, options).compiled, false);
  disposeRenderer(canvas); assertEmpty(live);
});

test("stale checks cancel during polling and do not publish or draw the superseded frame", async () => {
  const { canvas, options, calls, state, live } = fixture();
  state.complete = false;
  let current = true;
  const promise = renderFrameAsync(canvas, options, { ...controls, isCurrent: () => current });
  const rejection = assert.rejects(promise, aborted);
  await until(() => calls.polls > 0); current = false;
  await rejection;
  assert.equal(calls.statuses, 0); assert.equal(calls.draws.length, 0); assertEmpty(live);
  state.complete = true;
  assert.equal((await renderFrameAsync(canvas, options, controls)).compiled, true);
  disposeRenderer(canvas);
});

test("every newer async request supersedes previous pending work, including the same key", async () => {
  for (const key of ["a", "b"]) {
    const { canvas, options, calls, state, live } = fixture();
    state.complete = false;
    const first = renderFrameAsync(canvas, options, controls);
    const rejection = assert.rejects(first, aborted);
    await until(() => calls.polls > 0);
    state.complete = true;
    const second = await renderFrameAsync(canvas, { ...options, shaderKey: key, floats: { u_time: 9 } }, controls);
    await rejection;
    assert.equal(second.compiled, true); assert.equal(calls.draws.length, 1);
    assert.equal(calls.draws[0].uniforms.u_time, 9); assert.equal(live.programs.size, 1);
    disposeRenderer(canvas); assertEmpty(live);
  }
});

test("a newer cached request cannot be overwritten by an older cache-hit continuation", async () => {
  const { canvas, options, calls } = fixture();
  renderFrame(canvas, options);
  const first = renderFrameAsync(canvas, { ...options, floats: { u_time: 2 } });
  const rejection = assert.rejects(first, aborted);
  const second = renderFrameAsync(canvas, { ...options, floats: { u_time: 3 } });
  await second; await rejection;
  assert.equal(calls.draws.length, 2); assert.equal(calls.draws.at(-1).uniforms.u_time, 3);
  disposeRenderer(canvas);
});

test("cancellation and stale checks also guard cached render continuations", async () => {
  for (const mode of ["signal", "stale", "dispose"]) {
    const { canvas, options, calls } = fixture();
    renderFrame(canvas, options);
    const controller = new AbortController(); let current = true;
    const promise = renderFrameAsync(canvas, options, { signal: controller.signal, isCurrent: () => current });
    if (mode === "signal") controller.abort();
    if (mode === "stale") current = false;
    if (mode === "dispose") disposeRenderer(canvas);
    await assert.rejects(promise, aborted);
    assert.equal(calls.draws.length, 1);
    disposeRenderer(canvas);
  }
});

test("sync redraw of the last image can continue while a different shader prepares", async () => {
  const { canvas, options, calls, state } = fixture();
  renderFrame(canvas, options); state.complete = false;
  const promise = renderFrameAsync(canvas, { ...options, shaderKey: "b" }, controls);
  await until(() => calls.polls > 0);
  assert.equal(renderFrame(canvas, { ...options, floats: { u_time: 5 } }).compiled, false);
  state.complete = true; await promise;
  assert.equal(calls.draws.length, 3);
  assert.equal(calls.draws[1].program, calls.programs[0]); assert.equal(calls.draws[2].program, calls.programs[1]);
  disposeRenderer(canvas);
});

test("sync compilation cancels an outstanding preparation instead of caching duplicates", async () => {
  const { canvas, options, calls, state, live } = fixture();
  state.complete = false;
  const promise = prepareFrame(canvas, options, controls);
  const rejection = assert.rejects(promise, aborted);
  await until(() => calls.polls > 0);
  renderFrame(canvas, options); await rejection;
  assert.equal(live.programs.size, 1); assert.equal(calls.draws.length, 1);
  disposeRenderer(canvas); assertEmpty(live);
});

test("LRU retains four ready programs, reuses undo keys, and isolates canvases", () => {
  const a = fixture(); const b = fixture();
  for (const shaderKey of ["a", "b", "c", "d", "a", "e"]) renderFrame(a.canvas, { ...a.options, shaderKey });
  assert.equal(MAX_CACHED_PROGRAMS, 4); assert.equal(a.live.programs.size, 4);
  assert.equal(a.calls.programs.length, 5);
  assert(a.calls.deletes.includes(a.calls.programs[1]), "least recently used b is evicted");
  assert.equal(renderFrame(a.canvas, { ...a.options, shaderKey: "c" }).compiled, false);
  assert.equal(renderFrame(a.canvas, { ...a.options, shaderKey: "b" }).compiled, true);
  assert.equal(renderFrame(b.canvas, b.options).compiled, true);
  assert.equal(a.calls.contexts, 1, "context is retained across frames");
  disposeRenderer(a.canvas); assertEmpty(a.live); assert.equal(b.live.programs.size, 1);
  disposeRenderer(b.canvas); assertEmpty(b.live);
});

test("a four-variant edit and backspace cycle retains the original linked program", () => {
  const f = fixture();
  for (const [index, shaderKey] of ["original", "temporary-invalid", "plus-zero", "decimal", "plus-zero", "temporary-invalid", "original"].entries()) {
    const rendered = renderFrame(f.canvas, { ...f.options, shaderKey });
    assert.equal(rendered.compiled, index < 4);
    assert(f.live.programs.size <= MAX_CACHED_PROGRAMS);
  }
  assert.equal(f.calls.programs.length, 4);
  assert.equal(f.calls.draws.at(-1).program, f.calls.programs[0]);
  disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("preparations never evict the last drawn program and pending resources stay bounded", async () => {
  const { canvas, options, calls, state, live } = fixture();
  renderFrame(canvas, options);
  const active = calls.programs[0];
  for (const shaderKey of ["b", "c", "d", "e"]) {
    await prepareFrame(canvas, { ...options, shaderKey }, controls);
    assert(live.programs.has(active)); assert.equal(calls.draws.length, 1);
    assert(live.programs.size <= MAX_CACHED_PROGRAMS);
  }
  state.complete = false;
  const promise = prepareFrame(canvas, { ...options, shaderKey: "pending" }, controls);
  const rejection = assert.rejects(promise, aborted);
  await until(() => live.programs.size === MAX_CACHED_PROGRAMS + 1);
  assert.equal(live.shaders.size, 2); assert.equal(live.buffers.size, MAX_CACHED_PROGRAMS);
  disposeRenderer(canvas); await rejection; assertEmpty(live);
});

test("semantic keys cache sources independently of uniform values, viewport and uniform insertion order", async () => {
  const { canvas, options, calls } = fixture();
  let generated = 0;
  const source = () => { generated++; return options.fragmentSource; };
  await prepareFrame(canvas, { ...options, fragmentSource: source, floats: { u_a: 1, u_b: 2 } }, controls);
  const hit = await renderFrameAsync(canvas, { ...options, width: 120, bounds: { ...options.bounds, xMax: 10 },
    fragmentSource: source, floats: { u_b: 3, u_a: 4 } }, controls);
  assert.equal(hit.compiled, false); assert.equal(hit.compileMs, 0); assert.equal(generated, 1);
  await prepareFrame(canvas, { ...options, fragmentSource: source, floats: { u_c: 1 } }, controls);
  assert.equal(generated, 2); assert.equal(calls.programs.length, 2);
  await assert.rejects(prepareFrame(canvas, { ...options, floats: { u_c: 2 }, maxSourceLength: 1 }), /safety budget/);
  disposeRenderer(canvas);
});

test("compile, link and allocation failures preserve the previous cache and image without leaks", async () => {
  for (const failure of ["compile", "link", "shaders", "programs", "buffers", "upload", "uniforms"]) {
    const { canvas, options, calls, state, live } = fixture();
    renderFrame(canvas, options);
    if (failure === "compile" || failure === "link") state[failure] = false;
    else state.fail = failure;
    state.strictAsync = true;
    await assert.rejects(renderFrameAsync(canvas, { ...options, shaderKey: failure, width: 1000 }, controls));
    assert.equal(live.programs.size, 1); assert.equal(live.buffers.size, 1); assert.equal(live.shaders.size, 0);
    assert.equal(calls.draws.length, 1); assert.equal(calls.clears, 1); assert.equal(canvas.width, 100);
    assert.equal(renderFrame(canvas, options).compiled, false);
    disposeRenderer(canvas); assertEmpty(live);
  }
});

test("sync allocation and post-link failures also release all candidate resources", () => {
  for (const failure of ["shaders", "programs", "buffers", "upload", "uniforms"]) {
    const { canvas, options, state, live } = fixture(); state.fail = failure;
    assert.throws(() => renderFrame(canvas, options)); assertEmpty(live);
    disposeRenderer(canvas);
  }
});

test("async error diagnostics include generated source and are deferred until completion", async () => {
  const { canvas, options, calls, state, live } = fixture();
  state.compile = false; state.complete = false; state.strictAsync = true;
  const promise = prepareFrame(canvas, options, controls);
  const rejection = assert.rejects(promise, (error) => error instanceof RendererError && error.source === options.fragmentSource && /bad shader/.test(error.message));
  await until(() => calls.polls > 0);
  assert.equal(calls.logs, 0); assert.equal(calls.shaderStatuses, 0);
  state.complete = true; await rejection;
  assert.equal(calls.logs, 1); assertEmpty(live); disposeRenderer(canvas);
});

test("context loss cancels pending work, clears every cached program and permits clean restoration", async () => {
  const { canvas, options, calls, state, live, dispatch, listeners } = fixture();
  renderFrame(canvas, options);
  await prepareFrame(canvas, { ...options, shaderKey: "b" }, controls);
  state.complete = false;
  const promise = renderFrameAsync(canvas, { ...options, shaderKey: "c" }, controls);
  const rejection = assert.rejects(promise, /context was lost/);
  const polls = calls.polls; await until(() => calls.polls > polls);
  dispatch("webglcontextlost"); await rejection;
  assert.equal(calls.preventions, 1); assertEmpty(live);
  assert.throws(() => renderFrame(canvas, options), /context was lost/);
  state.parallel = false; state.complete = true; dispatch("webglcontextrestored");
  assert.equal((await renderFrameAsync(canvas, options, controls)).compiled, true);
  assert.equal(calls.extensions.filter((name) => name === "KHR_parallel_shader_compile").length, 2);
  assert.equal(listeners.get("webglcontextlost").size, 1);
  disposeRenderer(canvas); assertEmpty(live);
  assert.equal(listeners.get("webglcontextlost").size, 0); assert.equal(listeners.get("webglcontextrestored").size, 0);
});

test("context loss during a completion query is checked before querying link status", async () => {
  const { canvas, options, gl, state, calls, live } = fixture();
  gl.getProgramParameter = () => { calls.polls++; state.lost = true; return true; };
  await assert.rejects(prepareFrame(canvas, options, controls), /context was lost/);
  assert.equal(calls.polls, 1); assert.equal(calls.draws.length, 0); assertEmpty(live);
  disposeRenderer(canvas);
});

test("disposal wakes long poll waits, removes listeners, and releases the context only once", async () => {
  const { canvas, options, calls, state, live, listeners } = fixture();
  state.complete = false;
  const promise = renderFrameAsync(canvas, options, { pollIntervalMs: 10000 });
  const rejection = assert.rejects(promise, aborted);
  await until(() => calls.programs.length > 0);
  disposeRenderer(canvas); await rejection; assertEmpty(live);
  assert.equal(listeners.get("webglcontextlost").size, 0);
  disposeRenderer(canvas, { loseContext: true }); disposeRenderer(canvas, { loseContext: true });
  assert.equal(calls.losses, 1); assert.equal(calls.contexts, 1);
});

test("disposed and immediately reused canvases cannot receive stale preparation results", async () => {
  const { canvas, options, calls, state, live } = fixture();
  state.complete = false;
  const old = renderFrameAsync(canvas, options, controls);
  const rejection = assert.rejects(old, aborted);
  await until(() => calls.polls > 0);
  disposeRenderer(canvas); state.complete = true;
  await renderFrameAsync(canvas, options, controls); await rejection;
  assert.equal(calls.draws.length, 1); assert.equal(calls.contexts, 1);
  disposeRenderer(canvas); assertEmpty(live);
});

test("unsupported contexts, invalid dimensions and WebGL versions retain existing diagnostics", async () => {
  const unsupported = fixture({ supported: false });
  assert.deepEqual(await renderFrameAsync(unsupported.canvas, unsupported.options), { supported: false, compiled: false, compileMs: 0, source: "" });
  const { canvas, options, calls, live } = fixture({ webgl2: false });
  for (const extra of [{ width: 9000 }, { height: NaN }, { maxSourceLength: 1 },
    { fragmentSource: "" }, { fragmentSource: "#version 300 es\nvoid main(){}" },
    { bounds: { xMin: 1, xMax: 0, yMin: -1, yMax: 1 } }]) {
    await assert.rejects(prepareFrame(canvas, { ...options, ...extra }, controls), RendererError);
  }
  assert.equal(calls.programs.length, 0); assertEmpty(live); disposeRenderer(canvas);
});

test("GLSL 300 receives a matching vertex shader on the async path", async () => {
  const { canvas, options, calls } = fixture();
  await renderFrameAsync(canvas, { ...options, fragmentSource: "#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(1.0);}" }, controls);
  assert(calls.sources.every((source) => source.startsWith("#version 300 es")));
  assert(calls.sources[0].includes("in vec2")); disposeRenderer(canvas);
});

const tiled = { pollIntervalMs: 0, maxBatchPixels: 1024 };

test("cooperative drawing is opt-in; default async drawing performs no scissor, flush or fence operations", async () => {
  const f = fixture();
  const result = await renderFrameAsync(f.canvas, f.options, controls);
  assert.equal(f.calls.draws.length, 1); assert.equal(f.calls.scissors.length, 0);
  assert.equal(f.calls.flushes, 0); assert.equal(f.calls.waits.length, 0);
  assert.equal(result.batchCount, undefined);
  disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("tiles cover every physical pixel exactly once without changing uniforms, clipping or fullscreen geometry", async () => {
  const f = fixture(), sync = fixture();
  const extra = { width: 67, height: 41, dpr: 2, floats: { u_time: 3 },
    clipBounds: { xMin: -1, xMax: 1, yMin: -0.5, yMax: 0.5 }, background: [0.2, 0.4, 0.6], synchronous: true };
  renderFrame(sync.canvas, { ...sync.options, ...extra });
  const result = await renderFrameAsync(f.canvas, { ...f.options, ...extra }, tiled);
  const coverage = new Uint8Array(134 * 82);
  for (const draw of f.calls.draws) {
    const [x, y, w, h] = draw.scissor;
    assert(w * h <= tiled.maxBatchPixels);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) coverage[j * 134 + i]++;
    assert.deepEqual({ ...draw, program: null, scissor: null }, { ...sync.calls.draws[0], program: null });
  }
  assert(coverage.every((count) => count === 1));
  assert.equal(result.batchCount, f.calls.draws.length); assert(result.batchCount > 1);
  assert.equal(f.calls.clears, result.batchCount); assert.equal(f.calls.flushes, result.batchCount);
  assert.equal(f.calls.finishes, 0); assert.equal(f.live.fences.size, 0);
  assert.deepEqual(f.state.scissor, [0, 0, 320, 180]); assert.equal(f.state.scissorEnabled, false);
  assert(result.drawMs >= result.maxBatchMs && result.maxBatchMs >= 0);
  disposeRenderer(f.canvas); disposeRenderer(sync.canvas); assertEmpty(f.live); assertEmpty(sync.live);
});

test("an existing scissor restricts pixel coverage and is restored, including empty intersections", async () => {
  for (const box of [[-2, 4, 20, 13], [120, 70, 10, 10], [1, 1, 0, 0]]) {
    const f = fixture(); f.state.scissor = box; f.state.scissorEnabled = true;
    const result = await renderFrameAsync(f.canvas, f.options, tiled);
    let pixels = 0;
    for (const { scissor: [x, y, w, h] } of f.calls.draws) {
      assert(x >= Math.max(0, box[0]) && x + w <= Math.min(100, box[0] + box[2]));
      assert(y >= Math.max(0, box[1]) && y + h <= Math.min(50, box[1] + box[3]));
      pixels += w * h;
    }
    assert.equal(pixels, box[0] === -2 ? 18 * 13 : 0);
    assert.equal(result.batchCount, f.calls.draws.length);
    assert.deepEqual(f.state.scissor, box); assert.equal(f.state.scissorEnabled, true);
    disposeRenderer(f.canvas); assertEmpty(f.live);
  }
});

test("pending GPU fences yield tasks, bound submissions and observe cancellation before another batch", async () => {
  const f = fixture(); await prepareFrame(f.canvas, f.options, controls);
  const controller = new AbortController(); f.state.fenceReady = false;
  const pending = renderFrameAsync(f.canvas, f.options, { ...tiled, signal: controller.signal });
  const rejection = assert.rejects(pending, aborted);
  await until(() => f.calls.waits.length >= 3);
  assert.equal(f.calls.draws.length, 1); assert.equal(f.calls.flushes, 1); assert.equal(f.live.fences.size, 1);
  controller.abort(); await rejection;
  assert.equal(f.calls.draws.length, 1); assert.equal(f.live.fences.size, 0);
  assert.equal(f.state.scissorEnabled, false); assert.deepEqual(f.state.scissor, [0, 0, 320, 180]);
  disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("both fence-completion statuses advance batches without blocking waits or finish", async () => {
  for (const status of [14, 15]) {
    const f = fixture(); f.state.fenceStatus = status;
    await renderFrameAsync(f.canvas, f.options, tiled);
    assert(f.calls.draws.length > 1); assert.equal(f.calls.draws.length, f.calls.waits.length);
    assert.equal(f.calls.finishes, 0); disposeRenderer(f.canvas); assertEmpty(f.live);
  }
});

test("fence allocation, wait, flush, timeout and draw errors restore scissor and leave the last good program cached", async () => {
  for (const failure of ["fences", "wait", "flush", "timeout", "draw"]) {
    const f = fixture(); renderFrame(f.canvas, f.options);
    f.state.scissor = [3, 4, 21, 19]; f.state.scissorEnabled = true;
    f.state.fail = failure; f.state.fenceReady = failure !== "timeout";
    await assert.rejects(renderFrameAsync(f.canvas, { ...f.options, shaderKey: "new" }, { ...tiled, gpuTimeoutMs: 10 }), /fence|flush|draw/);
    assert.deepEqual(f.state.scissor, [3, 4, 21, 19]); assert.equal(f.state.scissorEnabled, true);
    assert.equal(f.live.fences.size, 0);
    f.state.fail = "";
    assert.equal(renderFrame(f.canvas, f.options).compiled, false);
    disposeRenderer(f.canvas); assertEmpty(f.live);
  }
});

test("stale callbacks stop tiled rendering after the currently submitted batch", async () => {
  const f = fixture(); let current = true;
  f.state.onWait = () => { current = false; };
  await assert.rejects(renderFrameAsync(f.canvas, f.options, { ...tiled, isCurrent: () => current }), aborted);
  assert.equal(f.calls.draws.length, 1); assert.equal(f.live.fences.size, 0);
  assert.equal(f.state.scissorEnabled, false); disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("superseding a tiled draw restores state before the replacement and stale cleanup cannot clobber it", async () => {
  const f = fixture(); f.state.fenceReady = false;
  const old = renderFrameAsync(f.canvas, f.options, tiled), rejection = assert.rejects(old, aborted);
  await until(() => f.calls.waits.length > 0);
  f.state.fenceReady = true;
  await renderFrameAsync(f.canvas, { ...f.options, floats: { u_time: 9 } }, tiled);
  await rejection;
  assert(f.calls.draws.slice(1).every((draw) => draw.uniforms.u_time === 9));
  assert.equal(f.state.scissorEnabled, false); assert.deepEqual(f.state.scissor, [0, 0, 320, 180]);
  disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("a synchronous cached draw safely supersedes an outstanding tiled frame", async () => {
  const f = fixture(); renderFrame(f.canvas, f.options); f.state.fenceReady = false;
  const old = renderFrameAsync(f.canvas, f.options, tiled), rejection = assert.rejects(old, aborted);
  await until(() => f.calls.waits.length > 0);
  renderFrame(f.canvas, f.options); await rejection;
  assert.equal(f.calls.draws.at(-1).scissor, null); assert.equal(f.live.fences.size, 0);
  disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("context loss or disposal wakes fence polling and prevents stale drawing into a reused canvas", async () => {
  for (const action of ["loss", "dispose"]) {
    const f = fixture(); f.state.fenceReady = false;
    const old = renderFrameAsync(f.canvas, f.options, { ...tiled, yieldIntervalMs: 10000 });
    const rejection = assert.rejects(old, action === "loss" ? /context was lost/ : aborted);
    await until(() => f.live.fences.size > 0);
    if (action === "loss") f.dispatch("webglcontextlost"); else disposeRenderer(f.canvas);
    assertEmpty(f.live);
    if (action === "loss") f.dispatch("webglcontextrestored");
    f.state.fenceReady = true;
    await renderFrameAsync(f.canvas, f.options, tiled); await rejection;
    assert.equal(f.calls.draws[1].scissor[0], 0);
    disposeRenderer(f.canvas); assertEmpty(f.live);
  }
});

test("context loss inside a fence query rejects as a context failure and releases sync handles", async () => {
  const f = fixture(); f.state.onWait = () => { f.state.lost = true; };
  await assert.rejects(renderFrameAsync(f.canvas, f.options, tiled), /context was lost/);
  assert.equal(f.calls.draws.length, 1); assertEmpty(f.live); disposeRenderer(f.canvas);
});

test("WebGL 1 fallback flushes and yields every scissor batch without fence APIs or finish", async () => {
  const f = fixture({ webgl2: false });
  delete f.gl.fenceSync; delete f.gl.clientWaitSync; delete f.gl.deleteSync;
  const controller = new AbortController();
  const flush = f.gl.flush;
  f.gl.flush = () => { flush(); setTimeout(() => controller.abort(), 0); };
  await assert.rejects(renderFrameAsync(f.canvas, f.options, { ...tiled, yieldIntervalMs: 2, signal: controller.signal }), aborted);
  assert.equal(f.calls.draws.length, 1); assert.equal(f.calls.waits.length, 0); assert.equal(f.calls.finishes, 0);
  f.gl.flush = flush;
  await renderFrameAsync(f.canvas, f.options, tiled);
  assert(f.calls.draws.length > 2); assert.equal(f.state.scissorEnabled, false);
  disposeRenderer(f.canvas); assertEmpty(f.live);
});

test("batch controls reject invalid budgets or deadlines before touching the canvas", async () => {
  const f = fixture();
  for (const extra of [{ maxBatchPixels: 0 }, { maxBatchPixels: NaN }, { maxBatchPixels: 0.5 },
    { maxBatchPixels: -1 }, { gpuTimeoutMs: 0 }, { gpuTimeoutMs: Infinity }, { yieldIntervalMs: -1 }]) {
    await assert.rejects(renderFrameAsync(f.canvas, f.options, { ...tiled, ...extra }), RendererError);
  }
  assert.equal(f.calls.contexts, 0); assert.equal(f.calls.draws.length, 0);
});

test("measured completion time adapts batch sizes across shader edits while respecting the ceiling", async (t) => {
  const f = fixture(); let now = 0, gpuMs = 16;
  t.mock.method(performance, "now", () => now);
  f.state.onWait = () => { now += gpuMs; };
  const options = { ...f.options, width: 512, height: 256 };
  const slow = await renderFrameAsync(f.canvas, options, { ...tiled, maxBatchPixels: 1000000 });
  const pixels = (draw) => draw.scissor[2] * draw.scissor[3];
  assert.equal(pixels(f.calls.draws[0]), 16384, "First frame starts with a bounded probe");
  assert(pixels(f.calls.draws[1]) < pixels(f.calls.draws[0]));
  assert.equal(slow.maxBatchMs, 16);
  const split = f.calls.draws.length; gpuMs = 0.5;
  await renderFrameAsync(f.canvas, { ...options, shaderKey: "cheap" }, { ...tiled, maxBatchPixels: 1000000 });
  assert(pixels(f.calls.draws[split]) <= 256, "Measured throughput survives a shader change");
  assert(f.calls.draws.slice(split + 1).some((draw) => pixels(draw) > 256), "Cheap shader grows batch budget");
  assert(f.calls.draws.every((draw) => pixels(draw) <= 65536));
  disposeRenderer(f.canvas); assertEmpty(f.live);
});
