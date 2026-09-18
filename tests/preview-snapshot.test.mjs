// Run with node --experimental-test-module-mocks --test tests/preview-*.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENE, createSceneRuntime } from "../src/compiler/scene-runtime.js";

let sequence = 0;
async function fixture(t) {
  const calls = { renders: [], disposals: [], validations: 0, builds: 0, canvases: [], supported: true, renderHook: null };
  const runtime = createSceneRuntime();
  const validate = runtime.validateScene, build = runtime.buildFragmentShader;
  runtime.validateScene = (...args) => { calls.validations++; return validate(...args); };
  runtime.buildFragmentShader = (...args) => { calls.builds++; return build(...args); };
  t.mock.module(new URL("../src/compiler/scene-runtime.js?v=20260917-responsive-video", import.meta.url), {
    exports: { createSceneRuntime: () => runtime }
  });
  t.mock.module(new URL("../packages/renderer/src/index.js?v=20260917-responsive-video", import.meta.url), {
    exports: {
      renderFrameAsync: async (canvas, options, controls) => {
        calls.renders.push({ canvas, options, controls });
        await calls.renderHook?.({ canvas, options, controls });
        return { supported: calls.supported, compiled: true, compileMs: 2, source: options.fragmentSource };
      },
      disposeRenderer: (...args) => calls.disposals.push(args)
    }
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "OffscreenCanvas");
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width; this.height = height; this.ops = [];
      const record = (name) => (...args) => this.ops.push({ name, args });
      this.ctx = Object.fromEntries(["clearRect", "drawImage", "save", "restore", "scale", "beginPath", "moveTo", "lineTo", "stroke", "fillText", "arc", "fill", "fillRect"].map((name) => [name, record(name)]));
      this.ctx.measureText = (text) => ({ width: text.length * 6 });
      calls.canvases.push(this);
    }
    getContext(type) { assert.equal(type, "2d"); return this.ctx; }
  };
  t.after(() => previous ? Object.defineProperty(globalThis, "OffscreenCanvas", previous) : delete globalThis.OffscreenCanvas);
  const { SnapshotRenderer, drawGridOverlay } = await import(`../src/compiler/snapshot-renderer.js?preview-test=${++sequence}`);
  const renderer = new SnapshotRenderer();
  t.after(() => renderer.dispose());
  const scene = { ...structuredClone(DEFAULT_SCENE), functions: [
    { id: "t", kind: "slider", time: true, timeMode: "unbounded", expression: "1", sliderMin: "0", sliderMax: "10", timeRate: "1" },
    { id: "eq", kind: "variable", expression: "sin(t+x)" }
  ], draws: [{ equationId: "eq", components: [] }] };
  scene.settings.showCoordinateGrid = false;
  const render = async (next = scene, extra = {}) => {
    renderer.setScene(next);
    return renderer.render({ width: 160, height: 90, grid: false, points: false, ...extra });
  };
  return { calls, runtime, renderer, scene, render, drawGridOverlay };
}

test("snapshot retains its private canvases and reuses source and diagnostics for unchanged scenes", async (t) => {
  const f = await fixture(t), phases = [];
  const first = await f.render(f.scene, { onPhase: (phase) => phases.push(phase) });
  const second = await f.render(structuredClone(f.scene));
  assert.equal(f.calls.canvases.length, 2); assert.equal(first.canvas, second.canvas);
  assert.equal(f.calls.builds, 1); assert.equal(f.calls.validations, 1);
  assert.equal(second.buildCount, 1); assert.equal(second.sourceLength, f.calls.renders[0].options.fragmentSource.length);
  assert.deepEqual(phases, ["validating", "compiling", "rendering"]);
  assert.equal(f.calls.renders[0].canvas, f.calls.renders[1].canvas);
});

test("interactive snapshots request cooperative GPU batches without changing output dimensions", async (t) => {
  const f = await fixture(t);
  await f.render(f.scene, { interactive: true, width: 320, height: 180 });
  assert.equal(f.calls.renders[0].controls.maxBatchPixels, 65_536);
  assert.equal(f.calls.renders[0].options.width, 320);
  assert.equal(f.calls.renders[0].options.height, 180);
  await f.render();
  assert.equal(f.calls.renders[1].controls.maxBatchPixels, undefined);
});

test("snapshot uniforms update with time and seed without new GLSL source or context", async (t) => {
  const f = await fixture(t); await f.render();
  const next = structuredClone(f.scene); next.functions[0].expression = "7.5"; next.settings.randomSeed = 19;
  await f.render(next);
  assert.equal(f.calls.builds, 1); assert.equal(f.calls.renders[1].options.floats.u_time_0, 7.5);
  assert.equal(f.calls.renders[1].options.floats.u_random_seed, 19);
  assert.equal(f.calls.renders[0].options.shaderKey, f.calls.renders[1].options.shaderKey);
});

test("equivalent editor spelling reuses the GPU program key when generated GLSL is identical", async (t) => {
  const f = await fixture(t);
  f.scene.functions[1].expression = "sin(t+x)+0";
  await f.render();
  f.scene.functions[1].expression = "sin(t+x)+0.0";
  await f.render();
  assert.equal(f.calls.builds, 2, "Different raw source still receives fresh semantic compilation");
  assert.equal(f.calls.renders[0].options.fragmentSource, f.calls.renders[1].options.fragmentSource);
  assert.equal(f.calls.renders[0].options.shaderKey, f.calls.renders[1].options.shaderKey);
});

test("source cache stays bounded while structural edits compile new variants", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 12; i++) {
    const scene = structuredClone(f.scene); scene.functions[1].expression = `sin(t+x)+${i}`;
    const result = await f.render(scene);
    assert(f.renderer.sourceCache.size <= 3); assert.equal(result.buildCount, i + 1);
  }
  assert.equal(f.renderer.sourceCache.size, 3); assert.equal(f.calls.canvases.length, 2);
});

test("snapshot applies requested bounds, clip rectangle, background and overlay dimensions", async (t) => {
  const f = await fixture(t);
  f.scene.settings.drawOnlyInsideBoundary = true; f.scene.settings.backgroundColor = "ink";
  f.scene.colors = [{ id: "ink", red: "51", green: "102", blue: "153" }];
  const bounds = { xMin: -2, xMax: 2, yMin: -1, yMax: 1 };
  const result = await f.render(f.scene, { bounds, overlayScale: 2 });
  const { options } = f.calls.renders[0];
  assert.deepEqual(options.bounds, bounds); assert.equal(result.viewport, bounds);
  assert.deepEqual(options.clipBounds, { xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
  assert.deepEqual(options.background, [0.2, 0.4, 0.6]);
  assert.deepEqual([result.canvas.width, result.canvas.height], [160, 90]);
  assert.deepEqual(result.canvas.ops.find((op) => op.name === "scale").args, [2, 2]);
});

test("snapshot cancellation before and after the yield never submits stale GPU work", async (t) => {
  const f = await fixture(t); const first = new AbortController(); first.abort();
  await assert.rejects(f.render(f.scene, { signal: first.signal }), { name: "AbortError" });
  assert.equal(f.calls.validations, 0); assert.equal(f.calls.renders.length, 0);
  const second = new AbortController(); const job = f.render(f.scene, { signal: second.signal }); second.abort();
  await assert.rejects(job, { name: "AbortError" });
  assert.equal(f.calls.renders.length, 0); assert.equal(f.calls.builds, 0);
});

test("snapshot cancellation during GPU preparation prevents output compositing", async (t) => {
  const f = await fixture(t); const controller = new AbortController();
  f.calls.renderHook = ({ controls }) => { assert.equal(controls.signal, controller.signal); controller.abort(); };
  await assert.rejects(f.render(f.scene, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(f.renderer.output.ops.length, 0);
});

test("unsupported GPU, bad ranges and oversized shaders report errors without compositing", async (t) => {
  const f = await fixture(t); f.calls.supported = false;
  await assert.rejects(f.render(), /cannot render graphs/);
  assert.equal(f.renderer.output.ops.length, 0);
  const invalid = structuredClone(f.scene); invalid.settings.ensureSquareGrid = false; invalid.settings.xMin = 20;
  await assert.rejects(f.render(invalid), /range|minimum|maximum/i);
  const fresh = structuredClone(f.scene); fresh.functions[1].expression = "x+1";
  f.runtime.buildFragmentShader = () => "x".repeat(1_500_001);
  await assert.rejects(f.render(fresh), /source-size safety budget/);
  assert.equal(f.renderer.output.ops.length, 0);
});

test("snapshot disposal releases its renderer, cached sources, and oversized canvases", async (t) => {
  const f = await fixture(t); await f.render(); f.renderer.dispose();
  assert.equal(f.renderer.sourceCache.size, 0);
  assert.deepEqual([f.renderer.canvas.width, f.renderer.canvas.height, f.renderer.output.width, f.renderer.output.height], [1, 1, 1, 1]);
  assert.deepEqual(f.calls.disposals[0], [f.renderer.canvas, { loseContext: true }]);
});

test("invalid-to-valid time repair produces the same shader as a fresh snapshot", async (t) => {
  const f = await fixture(t); f.scene.functions[0].expression = "bad(";
  await f.render();
  const repaired = structuredClone(f.scene); repaired.functions[0].expression = "1";
  const result = await f.render(repaired);
  const runtime = createSceneRuntime(); runtime.setScene(repaired);
  assert.equal(result.diagnostics.hasErrors, false, result.diagnostics.summary);
  const actual = f.calls.renders.at(-1).options.fragmentSource, expected = runtime.buildFragmentShader();
  assert(actual === expected, `Repaired graph reused shader with its layers missing (${actual.length} vs ${expected.length} source characters)`);
});

test("grid visibility respects master, axes and numbering switches", async (t) => {
  const f = await fixture(t); const ctx = f.renderer.output.ctx;
  const vp = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  f.drawGridOverlay(ctx, 160, 90, vp, { showCoordinateGrid: false });
  assert.equal(f.renderer.output.ops.length, 0);
  f.drawGridOverlay(ctx, 160, 90, vp, { showGrid: false, showXAxis: false, showYAxis: false });
  assert.equal(f.renderer.output.ops.length, 0);
  f.drawGridOverlay(ctx, 160, 90, vp, { showGrid: false, showXAxis: true, showYAxis: false, showXNumbers: false });
  assert.equal(f.renderer.output.ops.filter((op) => op.name === "stroke").length, 1);
  assert.equal(f.renderer.output.ops.filter((op) => op.name === "fillText").length, 0);
});

test("verified clock frames reuse diagnostics and shaders while keeping slider readouts current", async (t) => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++) {
    const scene = structuredClone(f.scene); scene.functions[0].expression = String(i);
    const result = await f.render(scene, { clockValues: true });
    assert.equal(result.sliders.find((slider) => slider.id === "t").value, i);
    assert.equal(result.sliders[0].min, 0); assert.equal(result.sliders[0].max, 10);
  }
  assert.equal(f.calls.builds, 1); assert.equal(f.calls.validations, 1);
  t.diagnostic(`10 animation frames: ${f.calls.validations} whole-scene validations, ${f.calls.builds} shader builds`);
});

test("editing a time start without clock verification still updates diagnostics", async (t) => {
  const f = await fixture(t);
  await f.render(f.scene, { clockValues: true });
  const bad = structuredClone(f.scene); bad.functions[0].expression = "bad(";
  const result = await f.render(bad);
  assert.equal(f.calls.validations, 2); assert.equal(result.diagnostics.functions[0].status, "invalid");
});

test("slider readouts resolve min, max and values using current references", async (t) => {
  const f = await fixture(t);
  f.scene.functions.push({ id: "scale", kind: "variable", expression: "3" },
    { id: "level", kind: "slider", expression: "scale+2", sliderMin: "0-scale", sliderMax: "scale*4", time: false });
  const first = await f.render();
  assert.deepEqual(first.sliders.find((slider) => slider.id === "level"), { id: "level", value: 5, min: -3, max: 12 });
  const next = structuredClone(f.scene); next.functions.find((entry) => entry.id === "scale").expression = "4";
  const second = await f.render(next);
  assert.deepEqual(second.sliders.find((slider) => slider.id === "level"), { id: "level", value: 6, min: -4, max: 16 });
});

test("point readouts evaluate linked functions even when point overlays are disabled", async (t) => {
  const f = await fixture(t);
  f.scene.functions.push({ id: "readout", kind: "function", outputType: "expression", params: ["a", "b"], expression: "a+b+t" });
  f.scene.points = [{ id: "p", x: "t", y: "2*t", linkedFunctionId: "readout", hidden: true },
    { id: "free", x: "0", y: "0" }, { id: "bad", x: "0", y: "0", linkedFunctionId: "missing" }];
  const first = await f.render();
  assert.deepEqual(first.pointValues, [{ id: "p", value: 4, valid: true },
    { id: "free", value: NaN, valid: true }, { id: "bad", value: NaN, valid: false }]);
  const next = structuredClone(f.scene); next.functions[0].expression = "3";
  const second = await f.render(next, { clockValues: true });
  assert.deepEqual(second.pointValues[0], { id: "p", value: 12, valid: true });
});

test("draw count readouts retain layer order and distinguish scalar, fixed and dynamic lists", async (t) => {
  const f = await fixture(t);
  f.scene.functions.push({ id: "values", kind: "list", expression: "[x,y,t]" },
    { id: "growing", kind: "list", expression: "[i for(i=1,x)]" });
  f.scene.draws.push({ equationId: "values", components: [] }, { equationId: "growing", components: [] });
  const result = await f.render();
  assert.deepEqual(result.drawCounts, ["", "3 draw values", `Variable draw count (up to ${(10000).toLocaleString()})`]);
  const plan = f.runtime.collectionPlan;
  f.runtime.collectionPlan = (source, ...args) => {
    if (source === "values") throw new Error("Cannot compute list length");
    return plan(source, ...args);
  };
  const recovered = await f.render();
  assert.deepEqual(recovered.drawCounts, ["", "List size unavailable", result.drawCounts[2]]);
});

test("diagnostics are available before shader preparation finishes", async (t) => {
  const f = await fixture(t), notifications = [];
  f.calls.renderHook = () => { assert.equal(notifications.length, 1); };
  const result = await f.render(f.scene, { onDiagnostics: (value) => notifications.push(value) });
  assert.equal(notifications[0], result.diagnostics);
});
