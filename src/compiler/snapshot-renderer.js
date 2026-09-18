import { createSceneRuntime } from "./scene-runtime.js?v=20260917-responsive-video";
import { sceneProgramKey, sceneDiagnosticKey } from "./scene-keys.js?v=20260917-responsive-video";
import { renderFrameAsync, disposeRenderer } from "../../packages/renderer/src/index.js?v=20260917-responsive-video";

/** One private scene evaluator and GPU context, independent of the editor DOM. */
export class SnapshotRenderer {
  constructor() {
    this.runtime = createSceneRuntime();
    this.canvas = new OffscreenCanvas(1, 1);
    this.output = new OffscreenCanvas(1, 1);
    this.sourceCache = new Map();
    this.diagnosticKey = null;
    this.diagnostics = null;
    this.buildCount = 0;
  }

  setScene(scene) {
    this.scene = scene;
    this.runtime.setScene(scene);
  }

  validate(clockValues = false) {
    const key = sceneDiagnosticKey(this.scene, clockValues);
    if (key !== this.diagnosticKey) {
      this.diagnostics = this.runtime.validateScene();
      this.diagnosticKey = key;
    }
    return this.diagnostics;
  }

  async render({ width, height, bounds, baseViewport, overlayScale = 1, points = true, grid = true, clockValues = false, interactive = false, signal, onPhase, onDiagnostics }) {
    signal?.throwIfAborted();
    onPhase?.("validating");
    const diagnostics = this.validate(clockValues);
    onDiagnostics?.(diagnostics);
    const clip = this.runtime.sceneViewport();
    const viewport = bounds ?? this.runtime.displayViewportForSize(baseViewport ?? clip, width, height);
    const issue = this.runtime.viewportDiagnostic();
    if (issue.status === "invalid") throw new Error(issue.message);
    if (!this.runtime.isValidViewport(viewport)) throw new Error("Rendering bounds must be finite increasing ranges");
    await new Promise((resolve) => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    const key = sceneProgramKey(this.scene);
    let program = this.sourceCache.get(key);
    if (!program) {
      onPhase?.("compiling");
      const source = this.runtime.buildFragmentShader();
      if (source.length > 1_500_000) throw new Error("Generated shader exceeds the source-size safety budget");
      // Display spelling and numeric formatting can change without changing GLSL.
      // Cache linked programs by emitted code, not by the editor's raw strings.
      const digest = globalThis.crypto?.subtle
        ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)) : null;
      program = { source, shaderKey: digest ? Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") : source };
      signal?.throwIfAborted();
      this.sourceCache.set(key, program);
      this.buildCount += 1;
      while (this.sourceCache.size > 3) this.sourceCache.delete(this.sourceCache.keys().next().value);
    }
    const { source, shaderKey } = program;
    const entries = this.runtime.timeVariableEntries();
    const floats = Object.fromEntries(this.runtime.timeUniformBindings().map(({ id, uniform }) => [uniform, this.runtime.evaluateScalarSetting(entries.find(({ entry }) => entry.id === id)?.entry.expression)]));
    floats.u_random_seed = Number(this.scene.settings.randomSeed) || 1;
    onPhase?.("rendering");
    const result = await renderFrameAsync(this.canvas, {
      width, height, dpr: 1, bounds: viewport,
      clipBounds: this.scene.settings.drawOnlyInsideBoundary && this.runtime.isValidViewport(clip) ? clip : null,
      background: this.runtime.resolveBackgroundColor().rgb.map((value) => value / 255),
      floats, shaderKey, fragmentSource: source
    }, { signal, ...(interactive ? { maxBatchPixels: 65_536 } : {}) });
    if (!result.supported) throw new Error("This browser cannot render graphs in the background with WebGL");
    signal?.throwIfAborted();
    if (this.output.width !== width) this.output.width = width;
    if (this.output.height !== height) this.output.height = height;
    const ctx = this.output.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.canvas, 0, 0);
    ctx.save();
    ctx.scale(overlayScale, overlayScale);
    if (grid) drawGridOverlay(ctx, width / overlayScale, height / overlayScale, viewport, this.scene.settings);
    if (points) this.runtime.drawPointsOverlay(ctx, width / overlayScale, height / overlayScale, viewport);
    ctx.restore();
    const sliders = this.runtime.dataEntries(this.scene.functions).filter((entry) => entry.kind === "slider").map((entry) => ({
      id: entry.id, value: this.runtime.evaluateScalarSetting(entry.expression),
      min: this.runtime.evaluateScalarSetting(entry.sliderMin), max: this.runtime.evaluateScalarSetting(entry.sliderMax)
    }));
    const pointValues = this.runtime.dataEntries(this.scene.points).map((point) => ({ id: point.id, ...this.runtime.pointLinkedValue(point) }));
    const drawCounts = (this.scene.draws ?? []).map((draw) => {
      try {
        const env = this.runtime.sceneFunctionEnv(true), target = this.runtime.drawTargetText(draw);
        if (!this.runtime.usesCollections(target, env)) return "";
        const plan = this.runtime.collectionPlan(target, env);
        if (plan.kind !== "list") return "";
        if (plan.dynamicLength) return `Variable draw count (up to ${Number(this.scene.settings.maxListSize ?? 10000).toLocaleString()})`;
        return `${plan.length({ x: 1, y: 1, env: this.runtime.buildRuntimeEnv(env), locals: {} }).toLocaleString()} draw values`;
      } catch { return "List size unavailable"; }
    });
    return { canvas: this.output, diagnostics, viewport, clip, sliders, pointValues, drawCounts, sourceLength: source.length,
      compileMs: result.compileMs, compiled: result.compiled, buildCount: this.buildCount,
      drawMs: result.drawMs, batchCount: result.batchCount, maxBatchMs: result.maxBatchMs };
  }

  dispose() {
    disposeRenderer(this.canvas, { loseContext: true });
    this.sourceCache.clear();
    this.canvas.width = this.output.width = 1;
    this.canvas.height = this.output.height = 1;
  }
}

function ticks(min, max, pixels) {
  const range = max - min;
  const raw = range / Math.max(2, pixels / 80);
  const scale = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((value) => value * scale >= raw) * scale;
  if (!Number.isFinite(step) || step <= 0) return [];
  const start = Math.ceil(min / step), count = Math.min(200, Math.max(0, Math.floor(max / step) - start + 1));
  return Array.from({ length: count }, (_, index) => (start + index) * step);
}

export function drawGridOverlay(ctx, width, height, vp, settings) {
  if (settings.showCoordinateGrid === false) return;
  const sx = (x) => (x - vp.xMin) / (vp.xMax - vp.xMin) * width;
  const sy = (y) => height - (y - vp.yMin) / (vp.yMax - vp.yMin) * height;
  const xs = ticks(vp.xMin, vp.xMax, width), ys = ticks(vp.yMin, vp.yMax, height);
  const axisX = Math.max(12, Math.min(width - 12, sx(0))), axisY = Math.max(12, Math.min(height - 12, sy(0)));
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); };
  ctx.lineWidth = 1;
  if (settings.showGrid !== false) {
    ctx.strokeStyle = "rgba(75,90,115,.18)";
    for (const x of xs) line(sx(x), 0, sx(x), height);
    for (const y of ys) line(0, sy(y), width, sy(y));
  }
  ctx.strokeStyle = "rgba(45,55,72,.48)";
  if (settings.showYAxis !== false) line(axisX,0,axisX,height);
  if (settings.showXAxis !== false) line(0,axisY,width,axisY);
  ctx.font = "11px system-ui"; ctx.fillStyle = "rgba(45,55,72,.72)";
  if (settings.showXAxis !== false && settings.showXNumbers !== false) for (const x of xs) ctx.fillText(String(Number(x.toPrecision(6))),sx(x)+3,axisY-4);
  if (settings.showYAxis !== false && settings.showYNumbers !== false) for (const y of ys) ctx.fillText(String(Number(y.toPrecision(6))),axisX+4,sy(y)-3);
}
