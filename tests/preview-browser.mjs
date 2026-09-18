// Defaults to the staged build. Override LEPTON_TEST_URL to test another deployment.
// LEPTON_BROWSER_EXECUTABLE is optional; otherwise use Playwright's Chromium.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";

const server = process.env.LEPTON_TEST_URL ? null : await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = process.env.LEPTON_TEST_URL || server.resolvedUrls.local[0];
let browser;
const errors = [];
try {
  browser = await chromium.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("reference.html", base).href);
  const reports = await page.evaluate(async (siteBase) => {
    const { PreviewClient } = await import(new URL("src/compiler/preview-client.js", siteBase).href);
    const { SnapshotRenderer } = await import(new URL("src/compiler/snapshot-renderer.js", siteBase).href);
    const { DEFAULT_SCENE } = await import(new URL("src/compiler/scene-runtime.js", siteBase).href);
    const base = { ...structuredClone(DEFAULT_SCENE), functions: [
      { id: "t", kind: "slider", time: true, timeMode: "unbounded", expression: "0" },
      { id: "eq", kind: "variable", expression: "t" }
    ], colors: [{ id: "ink", red: "255*x", green: "40", blue: "70" }],
      draws: [{ equationId: "eq", components: [{ type: "color", id: "ink" }] }] };
    base.settings.showCoordinateGrid = false;
    const size = { width: 96, height: 64, points: false, grid: false };
    const readCanvas = new OffscreenCanvas(96, 64), ctx = readCanvas.getContext("2d");
    const pixel = (canvas) => { ctx.clearRect(0, 0, 96, 64); ctx.drawImage(canvas, 0, 0); return [...ctx.getImageData(48, 32, 1, 1).data]; };
    const equal = (a, b) => a.every((value, index) => value === b[index]);
    const result = { frames: [], errors: [], repairedMatchesFresh: false };
    const renderer = new SnapshotRenderer();
    try {
      renderer.setScene(structuredClone(base));
      const first = await renderer.render(size); result.initialPixel = pixel(first.canvas);
      const next = structuredClone(base); next.functions[0].expression = "1";
      renderer.setScene(next); const second = await renderer.render(size); result.nextPixel = pixel(second.canvas);
      result.buildCount = second.buildCount; result.sourceCacheSize = renderer.sourceCache.size;
      const controller = new AbortController(); controller.abort();
      try { await renderer.render({ ...size, signal: controller.signal }); } catch (error) { result.cancelled = error.name === "AbortError"; }
    } finally { renderer.dispose(); }

    const broken = new SnapshotRenderer(), fresh = new SnapshotRenderer();
    try {
      const invalid = structuredClone(base); invalid.functions[0].expression = "bad(";
      broken.setScene(invalid); await broken.render(size);
      const repaired = structuredClone(base); repaired.functions[0].expression = "1";
      broken.setScene(structuredClone(repaired)); const recovered = await broken.render(size); result.repairedPixel = pixel(recovered.canvas);
      fresh.setScene(structuredClone(repaired)); const reference = await fresh.render(size); result.freshPixel = pixel(reference.canvas);
      result.repairedMatchesFresh = equal(result.repairedPixel, result.freshPixel);
    } finally { broken.dispose(); fresh.dispose(); }

    const client = new PreviewClient({
      onFrame(frame) { result.frames.push({ revision: frame.revision, generation: frame.generation, pixel: pixel(frame.bitmap), buildCount: frame.buildCount }); frame.bitmap.close(); },
      onError(error) { result.errors.push(error.message); }
    });
    const waitUntil = async (predicate) => {
      const end = performance.now() + 15000;
      while (!predicate()) { if (performance.now() > end) throw new Error(`Worker timeout: ${JSON.stringify(result.errors)}`); await new Promise((resolve) => setTimeout(resolve, 10)); }
    };
    try {
      for (let i = 0; i < 40; i++) {
        const scene = structuredClone(base); scene.functions[0].expression = String(i / 39);
        client.request({ scene, sceneKey: `edit-${i}`, ...size });
      }
      await waitUntil(() => result.frames.some((frame) => frame.revision === 40));
      result.latestEditPixel = result.frames.at(-1).pixel;
      result.editFrameCount = result.frames.length;
      for (let i = 0; i < 50; i++) {
        const scene = structuredClone(base); scene.functions[0].expression = String((i % 10) / 9);
        client.request({ scene, sceneKey: `animation-${i}`, transient: true, ...size });
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      await waitUntil(() => !client.busy && !client.pending);
      result.animationFrames = result.frames.length - result.editFrameCount;
    } finally { client.dispose(); }
    return result;
  }, base);
  assert(reports.initialPixel[0] < 3 && reports.initialPixel[1] > 30, "Initial GPU pixels incorrect");
  assert(reports.nextPixel[0] > 250, "Uniform update did not render new time value");
  assert.equal(reports.buildCount, 1); assert.equal(reports.sourceCacheSize, 1); assert(reports.cancelled);
  assert.deepEqual(reports.errors, []);
  assert(reports.latestEditPixel[0] > 250); assert(reports.animationFrames > 1, "Animation starved under sustained transient requests");
  console.log(`ok - native Chrome: worker bitmaps, latest edit, ${reports.animationFrames} transient frames, source reuse, cancellation, GPU pixels`);
  console.log(JSON.stringify({ repairedMatchesFresh: reports.repairedMatchesFresh, repairedPixel: reports.repairedPixel, freshPixel: reports.freshPixel }));

  const source = "set show_coordinate_grid = False\nexpression eq = 1\ncolour ink = 200~40~70\ndraw(eq,colour=ink)";
  await page.goto(new URL(`app.html?scene=${encodeURIComponent(source)}`, base).href);
  await page.waitForFunction(() => window.__leptonWorkerFrame || window.__leptonRuntimeError, null, { timeout: 20000 });
  const ui = await page.evaluate(() => {
    const canvas = document.querySelector(".grid-canvas");
    return { error: window.__leptonRuntimeError, frame: window.__leptonWorkerFrame,
      pixel: canvas ? [...canvas.getContext("2d").getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data] : null,
      fields: document.querySelectorAll(".mathquill-field .mq-root-block").length };
  });
  assert(!ui.error, ui.error); assert(ui.frame); assert(ui.fields > 0);
  assert(Math.abs(ui.pixel[0] - 200) <= 1 && Math.abs(ui.pixel[1] - 40) <= 1, "Integrated display canvas did not receive worker pixels");
  assert.deepEqual(errors, []);
  console.log("ok - grapher loads editable MathQuill fields and displays worker-rendered pixels");
  assert(reports.repairedMatchesFresh, "BUG: corrected time expression remains visually blank until renderer cache is discarded");
} finally {
  await browser?.close();
  await new Promise((resolve) => server ? server.httpServer.close(resolve) : resolve());
}
