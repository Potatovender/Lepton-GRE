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
    const result = { frames: [], errors: [], repairedMatchesFresh: false, piecewise: [], arithmetic: [] };
    const arithmetic = new SnapshotRenderer();
    try {
      for (const [expression, reference] of [
        ['-(-x)', 'x'], ['x-(-y)', 'x+y'], ['x--y', 'x+y'],
        ['-(-(-x))', '-x'], ['sin(-(-x))-(-cos(y))', 'sin(x)+cos(y)'],
        ['add(p)', '5'], ['add(p*2)', '10'], ['pack(p).x', '2'],
        ['pack(pack(p).x,4).y', '4'], ['pack(p.x,pack(2,3).y).x', '2'],
        ['pack(pack(p)[0],pack(q)[1])[1]', '5'], ['add(fixed)', '5'],
        ['sum(i=1~2){add(pack(p.x,i))}', '7']
      ]) {
        const scene = structuredClone(base);
        scene.functions = [
          { id: 'pack', kind: 'function', params: ['a', 'b'], outputType: 'point', expression: '[a,b]' },
          { id: 'add', kind: 'function', params: ['a', 'b'], expression: 'a+b' },
          { id: 'eq', kind: 'variable', expression }
        ];
        scene.points = [{ id: 'p', x: '2', y: '3' }, { id: 'q', x: '4', y: '5' },
          { id: 'fixed', x: 'x+2', y: 'y+3' }];
        scene.colors = [{ id: 'ink', red: '120+10*x', green: '80+12*x', blue: '60' }];
        const snapshots = [];
        for (const source of [expression, reference]) {
          scene.functions[2].expression = source;
          arithmetic.setScene(structuredClone(scene));
          const frame = await arithmetic.render({ ...size, bounds: { xMin: -2, xMax: 3, yMin: -1, yMax: 1 } });
          ctx.clearRect(0, 0, 96, 64); ctx.drawImage(frame.canvas, 0, 0);
          snapshots.push({ issues: frame.diagnostics.renderIssues ?? [], errors: frame.diagnostics.hasErrors,
            pixels: [[19, 10], [57, 32], [86, 50]].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]) });
        }
        result.arithmetic.push({ expression, snapshots });
      }
    } finally { arithmetic.dispose(); }
    const conditional = new SnapshotRenderer();
    try {
      for (const expression of ["inner(x)", "outer(x)", "outer(x)+0", "withFallback(x)", "gate", "{x<2:{x>0:1}}", "[outer(x)][0]"]) {
        const scene = structuredClone(base);
        scene.settings.backgroundColor = "dark";
        scene.functions = [
          { id: "inner", kind: "function", params: ["aa"], expression: "{aa>0:1}" },
          { id: "outer", kind: "function", params: ["aa"], expression: "{aa<2:inner(aa)}" },
          { id: "withFallback", kind: "function", params: ["aa"], expression: "{aa>0:1,0}" },
          { id: "gate", kind: "variable", expression: "{x>0:1}" },
          { id: "eq", kind: "variable", expression }
        ];
        scene.colors = [{ id: "ink", red: "255*x", green: "0", blue: "0" },
          { id: "dark", red: "0", green: "0", blue: "0" }];
        conditional.setScene(scene);
        const rendered = await conditional.render({ ...size, bounds: { xMin: -2, xMax: 3, yMin: -1, yMax: 1 } });
        ctx.clearRect(0, 0, 96, 64); ctx.drawImage(rendered.canvas, 0, 0);
        result.piecewise.push({ expression, errors: rendered.diagnostics.hasErrors,
          issues: rendered.diagnostics.renderIssues ?? [],
          pixels: [19, 57, 86].map(x => [...ctx.getImageData(x, 32, 1, 1).data].slice(0, 3)) });
      }
    } finally { conditional.dispose(); }
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
  for (const { expression, snapshots } of reports.arithmetic) {
    for (const snapshot of snapshots) {
      assert.equal(snapshot.errors, false, expression);
      assert.deepEqual(snapshot.issues, [], expression);
    }
    assert.deepEqual(snapshots[0].pixels, snapshots[1].pixels, `${expression}: GPU pixels differ from equivalent arithmetic`);
  }
  console.log('ok - unary signs, named points, nested selectors and reductions match reference GPU pixels');
  for (const conditional of reports.piecewise) {
    const upperClipped = /outer|x<2/.test(conditional.expression);
    assert.equal(conditional.errors, false, conditional.expression);
    assert.deepEqual(conditional.issues, [], conditional.expression);
    assert.deepEqual(conditional.pixels, [[0, 0, 0], [255, 0, 0], upperClipped ? [0, 0, 0] : [255, 0, 0]], conditional.expression);
  }
  console.log("ok - piecewise function calls, nesting, arithmetic, fallback, variables and lists render correct GPU pixels");
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
