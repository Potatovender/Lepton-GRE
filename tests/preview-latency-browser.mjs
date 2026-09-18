// Real keyboard editing against the unmodified cinematic-cloud sample.
// Defaults to Vite preview of dist; LEPTON_TEST_URL and LEPTON_BROWSER_EXECUTABLE override it.
// LEPTON_LATENCY_BUDGET_MS enforces a hardware-specific p95 target; CI always checks correctness.
// LEPTON_LATENCY_PROFILE=1 freezes dist; LEPTON_LATENCY_PROFILE_SOURCE=1 overlays source.
// LEPTON_HEADED=1 uses an actual Chrome window. Run one LEPTON_LATENCY_MODES case
// per process for isolated comparisons; LEPTON_LATENCY_GPU_PROBE=0 leaves GL untouched.
// LEPTON_LATENCY_GPU_TIMERS=0 keeps call timing but omits extra GPU queries/fences.
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { cpus, totalmem, platform, release } from "node:os";
import { chromium } from "playwright";
import { preview } from "vite";

const profiling = process.env.LEPTON_LATENCY_PROFILE === "1";
const tracing = process.env.LEPTON_LATENCY_TRACE === "1";
const gpuProbe = process.env.LEPTON_LATENCY_GPU_PROBE !== "0";
const gpuTimers = process.env.LEPTON_LATENCY_GPU_TIMERS !== "0";
const runId = `${Date.now()}-${process.pid}`;
const snapshot = new Map();
if (profiling && !process.env.LEPTON_TEST_URL) {
  const files = await readdir(new URL("../dist/", import.meta.url), { recursive: true, withFileTypes: true });
  const root = fileURLToPath(new URL("../dist/", import.meta.url));
  for (const file of files.filter((file) => file.isFile())) {
    const path = `${file.parentPath}/${file.name}`;
    const name = path.slice(root.length);
    let bytes = await readFile(path);
    if (process.env.LEPTON_LATENCY_PROFILE_SOURCE === "1") {
      try { bytes = await readFile(new URL(`../${name}`, import.meta.url)); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    snapshot.set(name, bytes);
  }
  const hash = createHash("sha256");
  for (const [path, bytes] of [...snapshot].sort(([a], [b]) => a.localeCompare(b))) hash.update(path).update(bytes);
  console.log(JSON.stringify({ frozenBuild: hash.digest("hex"), files: snapshot.size,
    renderer: createHash("sha256").update(snapshot.get("packages/renderer/src/index.js")).digest("hex") }));
}

// Injected only into the served worker response, never into application sources.
// GPU timers measure execution when supported; fences include queue/driver delay.
function workerProbe(timers = true) {
  let current = { mode: "normal", revision: 0 };
  const emit = (kind, values, context = current) => self.postMessage({ type: "__latencyProfile", kind,
    ...context, at: performance.timeOrigin + performance.now(), ...values });
  self.addEventListener("message", ({ data }) => {
    if (data.type === "render") current = { mode: data.__profileMode ?? "normal", revision: data.revision };
  });
  const getContext = OffscreenCanvas.prototype.getContext;
  const wrapped = new WeakSet();
  OffscreenCanvas.prototype.getContext = function (...args) {
    const gl = getContext.apply(this, args);
    if (!gl || !args[0].startsWith("webgl") || wrapped.has(gl)) return gl;
    wrapped.add(gl);
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const timer = timers && gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    emit("context", { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      timerQuery: Boolean(timer), parallelCompile: Boolean(gl.getExtension("KHR_parallel_shader_compile")) });
    const shaderSource = gl.shaderSource.bind(gl);
    gl.shaderSource = (shader, source) => {
      if (current.mode === "cheap-shader" && gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) {
        source = /^\s*#version 300 es/.test(source)
          ? "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.5,0.3,0.2,1.0);}"
          : "precision highp float;void main(){gl_FragColor=vec4(0.5,0.3,0.2,1.0);}";
      }
      return shaderSource(shader, source);
    };
    const deleteProgram = gl.deleteProgram.bind(gl);
    gl.deleteProgram = (program) => {
      if (current.mode !== "defer-deletes" || !parallel) return deleteProgram(program);
      const context = { ...current }, start = performance.now();
      const dispose = () => {
        if (!gl.isContextLost() && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
          setTimeout(dispose, 8);
          return;
        }
        deleteProgram(program);
        emit("delete-complete", { delayMs: performance.now() - start }, context);
      };
      dispose();
    };
    for (const name of ["compileShader", "linkProgram", "deleteShader", "deleteProgram"]) {
      const original = gl[name].bind(gl);
      gl[name] = (...args) => {
        const stack = new Error().stack;
        const path = stack.includes("cancelPending") ? "cancelPending"
          : stack.includes("releaseResources") ? "releaseResources"
          : stack.includes("releaseShaders") ? "releaseShaders" : "submit";
        const start = performance.now();
        const result = original(...args);
        emit(name, { cpuMs: performance.now() - start, path, stack });
        return result;
      };
    }
    const draw = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args) => {
      const context = { ...current };
      if (current.mode === "no-draw") { emit("draw-skipped", {}, context); return; }
      if (!timers) return draw(...args);
      const query = timer && gl.createQuery();
      if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      const start = performance.now();
      const result = draw(...args);
      if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
      const submitMs = performance.now() - start;
      const fence = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      emit("draw-submit", { cpuMs: submitMs, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight }, context);
      const poll = () => {
        const status = fence ? gl.clientWaitSync(fence, 0, 0) : gl.ALREADY_SIGNALED;
        if (status === gl.TIMEOUT_EXPIRED) { setTimeout(poll, 4); return; }
        const ready = !query || gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        if (!ready) { setTimeout(poll, 4); return; }
        const disjoint = timer && gl.getParameter(timer.GPU_DISJOINT_EXT);
        emit("draw-complete", { fenceMs: performance.now() - start,
          gpuMs: query && !disjoint ? gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6 : null,
          disjoint: Boolean(disjoint), failed: status === gl.WAIT_FAILED }, context);
        if (query) gl.deleteQuery(query);
        if (fence) gl.deleteSync(fence);
      };
      setTimeout(poll, 0);
      return result;
    };
    return gl;
  };
}

const source = await readFile(new URL("../sample code/cinematic clouds", import.meta.url), "utf8");
const server = process.env.LEPTON_TEST_URL ? null : await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = process.env.LEPTON_TEST_URL || server.resolvedUrls.local[0];
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined,
    headless: process.env.LEPTON_HEADED !== "1" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (profiling) {
    await page.route("**/*", async (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, "");
      let body = snapshot.get(path);
      if (body) {
        if (gpuProbe && path === "src/compiler/preview-worker.js") body = `(${workerProbe.toString()})(${gpuTimers});\n${body}`;
        const extension = path.split(".").at(-1);
        const mime = { js: "text/javascript", css: "text/css", html: "text/html", json: "application/json", svg: "image/svg+xml", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", png: "image/png", webp: "image/webp" }[extension] || "application/octet-stream";
        return route.fulfill({ body, contentType: mime });
      }
      if (gpuProbe && path.endsWith("src/compiler/preview-worker.js")) {
        const response = await route.fetch();
        return route.fulfill({ response, body: `(${workerProbe.toString()})(${gpuTimers});\n${await response.text()}` });
      }
      return route.continue();
    });
    const session = await browser.newBrowserCDPSession();
    const info = await session.send("SystemInfo.getInfo");
    console.log(JSON.stringify({ gpu: { devices: info.gpu.devices, features: info.gpu.featureStatus,
      skia: info.gpu.auxAttributes.skiaBackendType }, modelName: info.modelName }));
    await session.detach();
  }
  await page.addInitScript(() => {
    const stats = window.__previewStress = { active: false, phase: "", mode: "normal", keys: [], longTasks: [], events: [], worker: [], gpu: [] };
    document.addEventListener("keydown", (event) => {
      if (!stats.active || !event.isTrusted || !event.target.closest(".mathquill-field")) return;
      const row = { phase: stats.phase, key: event.key, timestamp: event.timeStamp,
        inputDelay: performance.now() - event.timeStamp, proxy: null };
      stats.keys.push(row);
      requestAnimationFrame(() => requestAnimationFrame(() => { row.proxy = performance.now() - event.timeStamp; }));
    }, true);
    new MutationObserver((mutations) => {
      if (!stats.active || !mutations.some((mutation) => (mutation.target.parentElement ?? mutation.target).closest?.(".mq-root-block"))) return;
      const key = stats.keys.at(-1);
      if (key && key.domReady === undefined) key.domReady = performance.now() - key.timestamp;
    }).observe(document, { subtree: true, childList: true, characterData: true });
    new PerformanceObserver((list) => {
      for (const item of list.getEntries()) if (stats.active) stats.longTasks.push({ phase: stats.phase, start: item.startTime, duration: item.duration });
    }).observe({ type: "longtask", buffered: false });
    new PerformanceObserver((list) => {
      for (const item of list.getEntries()) {
        if (item.name !== "keydown") continue;
        // Event Timing can arrive after a case ends; associate by event timestamp.
        const key = stats.keys.findLast((row) => Math.abs(row.timestamp - item.startTime) < 0.5);
        if (!key) continue;
        key.eventDuration = item.duration;
        stats.events.push({ phase: key.phase, duration: item.duration,
          inputDelay: item.processingStart - item.startTime, processing: item.processingEnd - item.processingStart });
      }
    }).observe({ type: "event", durationThreshold: 16, buffered: false });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      terminate() {
        const start = performance.now();
        const result = super.terminate();
        stats.worker.push({ phase: stats.phase, at: start, type: "terminate", cpuMs: performance.now() - start });
        return result;
      }
      constructor(...args) {
        super(...args);
        this.addEventListener("message", (event) => {
          const { data } = event;
          if (data.type === "__latencyProfile") {
            stats.gpu.push({ phase: stats.phase, ...data });
            event.stopImmediatePropagation();
            return;
          }
          stats.worker.push({ phase: stats.phase, at: performance.now(), type: data.type,
            revision: data.revision, workerPhase: data.phase, compileMs: data.compileMs, compiled: data.compiled, buildCount: data.buildCount,
            drawMs: data.drawMs, batchCount: data.batchCount, maxBatchMs: data.maxBatchMs });
        });
      }
      postMessage(data, ...rest) {
        stats.worker.push({ phase: stats.phase, at: performance.now(), type: `send-${data.type}`, revision: data.revision });
        if (data.type === "render") {
          if (stats.mode === "editor-only") {
            queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "cancelled", revision: data.revision, generation: data.generation } })));
            return;
          }
          data = { ...data, __profileMode: stats.mode };
          if (stats.mode.startsWith("scale-")) {
            const scale = Number(stats.mode.slice(6));
            data.width = Math.max(1, Math.round(data.width * scale));
            data.height = Math.max(1, Math.round(data.height * scale));
          }
        }
        return super.postMessage(data, ...rest);
      }
    };
  });
  await page.goto(new URL("app.html", base).href);
  await page.waitForFunction(() => window.__leptonDebug);
  await page.waitForFunction(() => window.__leptonWorkerFrame || window.__leptonRuntimeError, null, { timeout: 60000 });
  const blankRevision = await page.evaluate(() => window.__leptonWorkerFrame?.revision ?? 0);
  await page.evaluate((source) => window.__leptonDebug.loadScene(source), source);
  await page.waitForFunction((revision) => window.__leptonWorkerFrame?.revision > revision || window.__leptonRuntimeError, blankRevision, { timeout: 60000 });
  const initial = await page.evaluate(() => ({ frame: window.__leptonWorkerFrame, error: window.__leptonRuntimeError,
    scene: window.__leptonDebug.scene(), canvas: { width: document.querySelector(".grid-canvas").width, height: document.querySelector(".grid-canvas").height } }));
  assert(!initial.error, initial.error);
  console.log(JSON.stringify({ initialFrame: initial.frame }));
  if (profiling && Number(process.env.LEPTON_LATENCY_WARMUP_FRAMES) > 0) {
    await page.evaluate(() => { window.__previewStress.phase = "warm-playback"; });
    await page.locator('[data-action="toggle-global-time"]').click();
    await page.waitForFunction((count) => window.__previewStress.worker.filter((item) => item.type === "frame" && item.phase === "warm-playback").length >= count,
      Number(process.env.LEPTON_LATENCY_WARMUP_FRAMES), { timeout: 60000 });
    await page.locator('[data-action="toggle-global-time"]').click();
    await page.waitForTimeout(500);
    console.log(JSON.stringify({ warmPlayback: await page.evaluate(() => {
      const frames = window.__previewStress.worker.filter((item) => item.type === "frame" && item.phase === "warm-playback");
      const summarize = (values) => {
        values = values.filter(Number.isFinite).sort((a, b) => a - b);
        return { p50: values[Math.ceil(values.length * 0.5) - 1] ?? 0,
          p95: values[Math.ceil(values.length * 0.95) - 1] ?? 0, max: values.at(-1) ?? 0 };
      };
      return { count: frames.length, compileMs: summarize(frames.map((item) => item.compileMs)),
        drawMs: summarize(frames.map((item) => item.drawMs)),
        maxBatchMs: summarize(frames.map((item) => item.maxBatchMs)),
        batchCount: summarize(frames.map((item) => item.batchCount)),
        frameIntervalMs: summarize(frames.slice(1).map((item, index) => item.at - frames[index].at)) };
    }) }));
  }
  const folder = initial.scene.folders.findIndex((entry) => entry.id === "Foreground billows");
  const index = initial.scene.functions.findIndex((entry) => entry.id === "cloudMain");
  assert(folder >= 0 && index >= 0, "Missing the actual cloud fixture's edit target");
  const toggle = page.locator(`[data-toggle-folder="${folder}"]`);
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  const field = page.locator(`.mathquill-field[data-field="functions.${index}.expression"]`);
  await field.locator(".mq-root-block").waitFor();
  const original = await page.evaluate((index) => window.__leptonDebug.scene().functions[index].expression, index);
  const cases = [];
  const modes = (process.env.LEPTON_LATENCY_MODES || "normal").split(",");
  if (profiling && !gpuProbe) assert(modes.every((mode) => ["normal", "editor-only"].includes(mode) || mode.startsWith("scale-")),
    "Shader controls require LEPTON_LATENCY_GPU_PROBE=1");
  const scenarios = profiling ? modes.map((mode, index) => [`profile-${index}-${mode}`, false, mode]) : [["editing-recompile", false, "normal"], ["editing-during-playback", true, "normal"]];
  for (const [phase, playback, mode] of scenarios) {
    let traceSession;
    if (tracing) {
      traceSession = await browser.newBrowserCDPSession();
      await traceSession.send("Tracing.start", { categories: "devtools.timeline,blink.user_timing,latencyInfo,cc,gpu,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.inputs", transferMode: "ReturnAsStream" });
    }
    await page.evaluate((mode) => { window.__previewStress.mode = mode; }, mode);
    if (playback) {
      const beforePlay = await page.evaluate(() => window.__leptonWorkerFrame.revision);
      await page.locator('[data-action="toggle-global-time"]').click();
      await page.waitForFunction((revision) => window.__leptonWorkerFrame?.revision > revision, beforePlay, { timeout: 60000 });
    }
    await field.click(); await page.keyboard.press("End");
    await page.evaluate((phase) => { window.__previewStress.phase = phase; window.__previewStress.active = true; }, phase);
    const start = Date.now();
    for (let i = 1; i <= 8; i++) {
      const suffix = `+0.00${i}`;
      await page.keyboard.type(suffix, { delay: 35 });
      for (let j = 0; j < suffix.length; j++) {
        await page.keyboard.press("Backspace");
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
    }
    // Let final key probes and worker replies drain before disabling instrumentation.
    await page.waitForFunction(() => window.__previewStress.keys.every((key) => key.proxy !== null), null, { timeout: 10000 });
    const editingMs = Date.now() - start;
    const ended = await page.evaluate(() => {
      window.__previewStress.active = false;
      return { at: performance.now(), focused: document.activeElement?.closest(".mathquill-field")?.dataset.field };
    });
    if (playback) await page.locator('[data-action="toggle-global-time"]').click();
    const settleStart = Date.now();
    // Verify the last edit is eventually displayed, not merely accepted by the editor.
    if (mode !== "editor-only") await page.waitForFunction(() => {
      const lastRequest = window.__previewStress.worker.findLast((event) => event.type === "send-render");
      return lastRequest && window.__leptonWorkerFrame?.revision >= lastRequest.revision;
    }, null, { timeout: 60000 });
    const settleMs = Date.now() - settleStart;
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
    if (traceSession) {
      const complete = new Promise((resolve) => traceSession.once("Tracing.tracingComplete", resolve));
      await traceSession.send("Tracing.end");
      const { stream } = await complete;
      let trace = "";
      for (;;) {
        const chunk = await traceSession.send("IO.read", { handle: stream });
        trace += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString() : chunk.data;
        if (chunk.eof) break;
      }
      await traceSession.send("IO.close", { handle: stream });
      await traceSession.detach();
      const path = `/tmp/lepton-latency-${runId}-${phase}.trace.json`;
      await writeFile(path, trace);
      const events = JSON.parse(trace).traceEvents;
      const groups = new Map();
      const thread = new Map(events.filter((event) => event.name === "thread_name").map((event) => [`${event.pid}:${event.tid}`, event.args.name]));
      for (const event of events) {
        if (event.ph !== "X" || !/Paint|Layout|Raster|DrawFrame|Swap|Compile|Link|Composite|ExecuteDeferredRequest|HandlePostMessage|CommandBuffer::Flush$/.test(event.name)) continue;
        const key = `${thread.get(`${event.pid}:${event.tid}`) ?? event.tid}:${event.name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event.dur / 1000);
      }
      console.log(JSON.stringify({ trace: path, timings: [...groups].map(([name, values]) => ({ name, count: values.length,
        totalMs: values.reduce((a, b) => a + b, 0), maxMs: Math.max(...values) })).sort((a, b) => b.totalMs - a.totalMs).slice(0, 24) }));
    }
    const summary = await page.evaluate(({ phase, index, endedAt }) => {
      const stats = window.__previewStress;
      stats.active = false;
      const keys = stats.keys.filter((item) => item.phase === phase);
      const tasks = stats.longTasks.filter((item) => item.phase === phase);
      const events = stats.events.filter((item) => item.phase === phase);
      const worker = stats.worker.filter((item) => item.phase === phase && item.at <= endedAt);
      const gpu = stats.gpu.filter((item) => item.phase === phase);
      const distribution = (values) => {
        values.sort((a, b) => a - b);
        const percentile = (p) => values.length ? values[Math.ceil(values.length * p) - 1] : 0;
        return { p50: percentile(0.5), p95: percentile(0.95), max: values.at(-1) ?? 0 };
      };
      return { phase, keys: keys.length, inputDelayMs: distribution(keys.map((key) => key.inputDelay)),
        domMutationMs: distribution(keys.map((key) => key.domReady).filter((value) => value !== undefined)),
        twoRafMs: distribution(keys.map((key) => key.proxy)),
        eventTiming: { count: events.length, durationMs: distribution(keys.map((key) => key.eventDuration ?? 0)), processingMs: distribution(events.map((item) => item.processing)) },
        longTasks: { count: tasks.length, durationMs: distribution(tasks.map((item) => item.duration)) },
        requests: worker.filter((item) => item.type === "send-render").length,
        frames: worker.filter((item) => item.type === "frame").length,
        compilingPhases: worker.filter((item) => item.workerPhase === "compiling").length,
        compileMs: distribution(stats.worker.filter((item) => item.phase === phase && item.type === "frame").map((item) => item.compileMs ?? 0)),
        drawMs: distribution(stats.worker.filter((item) => item.phase === phase && item.type === "frame" && item.drawMs !== undefined).map((item) => item.drawMs)),
        batchCount: distribution(stats.worker.filter((item) => item.phase === phase && item.type === "frame" && item.batchCount !== undefined).map((item) => item.batchCount)),
        maxBatchMs: distribution(stats.worker.filter((item) => item.phase === phase && item.type === "frame" && item.maxBatchMs !== undefined).map((item) => item.maxBatchMs)),
        gpu: { drawCount: gpu.filter((item) => item.kind === "draw-submit").length,
          fenceMs: distribution(gpu.filter((item) => item.kind === "draw-complete").map((item) => item.fenceMs)),
          gpuMs: distribution(gpu.filter((item) => item.kind === "draw-complete" && item.gpuMs !== null).map((item) => item.gpuMs)),
          submitMs: distribution(gpu.filter((item) => item.kind === "draw-submit").map((item) => item.cpuMs)),
          compileSubmitMs: distribution(gpu.filter((item) => ["compileShader", "linkProgram"].includes(item.kind)).map((item) => item.cpuMs)) },
        expression: window.__leptonDebug.scene().functions[index].expression,
        error: window.__leptonRuntimeError };
    }, { phase, index, endedAt: ended.at });
    summary.focused = ended.focused;
    summary.mode = mode;
    summary.wallSeconds = editingMs / 1000;
    cases.push(summary);
    summary.settleMs = settleMs;
    summary.targetMs = Number(process.env.LEPTON_LATENCY_BUDGET_MS || 50);
    summary.withinTarget = Math.max(summary.twoRafMs.p95, summary.eventTiming.durationMs.p95) < summary.targetMs;
    console.log(JSON.stringify(summary));
  }
  if (profiling) {
    const records = await page.evaluate(() => window.__previewStress);
    const path = `/tmp/lepton-latency-${runId}-${modes.join("-")}.json`;
    await writeFile(path, JSON.stringify(records));
    const calls = new Map();
    for (const item of records.gpu.filter((item) => /^(compileShader|linkProgram|deleteShader|deleteProgram)$/.test(item.kind))) {
      const key = `${item.phase || "initial"}:${item.kind}:${item.path}`;
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(item.cpuMs);
    }
    console.log(JSON.stringify({ profileRecords: path, glCalls: [...calls].map(([name, values]) => ({ name, count: values.length,
      totalMs: values.reduce((a, b) => a + b, 0), maxMs: Math.max(...values) })),
      workerTermination: records.worker.filter((item) => item.type === "terminate") }));
  }
  console.log(JSON.stringify({ hardware: { cpu: cpus()[0].model, threads: cpus().length, ramGB: totalmem() / 2 ** 30, os: `${platform()} ${release()}` },
    browser: await browser.version(), headed: process.env.LEPTON_HEADED === "1", gpuProbe: profiling && gpuProbe, gpuTimers: profiling && gpuProbe && gpuTimers,
    viewport: { width: 1440, height: 900, dpr: 1 }, canvas: initial.canvas,
    fixture: "sample code/cinematic clouds", sourceBytes: source.length, definitions: initial.scene.functions.length,
    note: "twoRafMs measures scheduling, not GPU presentation. Event Timing durations include presentation and are quantized; unreported (<16 ms) events count as zero." }));
  assert.deepEqual(errors, []);
  for (const result of cases) {
    assert.equal(result.keys, 96, `${result.phase}: missing trusted key events`);
    assert.equal(result.expression, original, `${result.phase}: editing lost or misplaced text`);
    assert.equal(result.focused, `functions.${index}.expression`, `${result.phase}: active field lost focus`);
    assert(result.requests > 0 && (profiling || result.compilingPhases > 0), `${result.phase}: stress run did not exercise actual background compilation`);
    assert(!result.error, result.error);
    if (process.env.LEPTON_LATENCY_BUDGET_MS) assert(result.withinTarget, `${result.phase}: p95 two-rAF ${result.twoRafMs.p95.toFixed(1)} ms / Event Timing ${result.eventTiming.durationMs.p95} ms exceeds target`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server ? server.httpServer.close(resolve) : resolve());
}
