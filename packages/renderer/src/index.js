const renderers = new WeakMap();
const contexts = new WeakMap();
const VERTEX_SOURCE = "attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }";
export const MAX_FRAGMENT_CHARACTERS = 1_500_000;
export const MAX_CACHED_PROGRAMS = 4;

export class RendererError extends Error {
  constructor(message, source = "") {
    super(message);
    this.name = "RendererError";
    this.source = source;
  }
}

function abortError(message = "Shader preparation was cancelled or superseded.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function releaseShaders(gl, resources) {
  for (const name of ["vertex", "fragment"]) {
    if (resources[name]) gl.deleteShader(resources[name]);
    resources[name] = null;
  }
}

function releaseResources(gl, resources) {
  if (!resources) return;
  releaseShaders(gl, resources);
  if (resources.program) gl.deleteProgram(resources.program);
  if (resources.buffer) gl.deleteBuffer(resources.buffer);
  resources.program = resources.buffer = null;
}

function cancelPending(renderer, error = abortError()) {
  const pending = renderer.pending;
  if (!pending) return;
  pending.error = error;
  releaseResources(renderer.gl, pending.resources);
  pending.wake?.();
  renderer.pending = null;
}

function clearPrograms(renderer, error) {
  renderer.revision++;
  cancelPending(renderer, error);
  cancelDrawing(renderer, error);
  for (const entry of renderer.programs.values()) releaseResources(renderer.gl, entry);
  renderer.programs.clear();
  renderer.active = null;
}

function contextError() {
  return new RendererError("The graphics context was lost. Wait for recovery or reload the graph.");
}

function assertContext(renderer) {
  if (renderer.disposed) throw abortError("The renderer was disposed.");
  if (!renderer.lost && renderer.gl.isContextLost?.()) {
    renderer.lost = true;
    clearPrograms(renderer, contextError());
  }
  if (renderer.lost) throw contextError();
}

function getRenderer(canvas) {
  let renderer = renderers.get(canvas);
  if (!renderer) {
    let context = contexts.get(canvas);
    if (!context) {
      const webGl2 = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      const gl = webGl2 ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
      if (!gl) return null;
      context = { gl, webGl2: Boolean(webGl2) };
      contexts.set(canvas, context);
    }
    renderer = { ...context, programs: new Map(), active: null, pending: null, drawing: null, revision: 0,
      lost: false, disposed: false, parallel: undefined };
    renderer.onLost = (event) => {
      event.preventDefault();
      renderer.lost = true;
      clearPrograms(renderer, contextError());
    };
    renderer.onRestored = () => {
      clearPrograms(renderer, contextError());
      renderer.lost = false;
      renderer.parallel = undefined;
      renderer.maximum = undefined;
      renderer.pixelsPerMs = undefined;
    };
    canvas.addEventListener?.("webglcontextlost", renderer.onLost);
    canvas.addEventListener?.("webglcontextrestored", renderer.onRestored);
    renderers.set(canvas, renderer);
  }
  assertContext(renderer);
  return renderer;
}

function compileShader(gl, type, source, checkStatus = true) {
  const shader = gl.createShader(type);
  if (!shader) throw new RendererError("The GPU could not allocate a shader.", source);
  try {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (checkStatus && !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new RendererError(gl.getShaderInfoLog(shader) || "Shader compilation failed.", source);
    }
    return shader;
  } catch (error) {
    gl.deleteShader(shader);
    throw error;
  }
}

function submitProgram(renderer, resources, source, checkStatus) {
  const gl = renderer.gl;
  const modern = /^\s*#version 300 es\b/.test(source);
  const vertexSource = modern ? `#version 300 es\n${VERTEX_SOURCE.replace("attribute", "in")}` : VERTEX_SOURCE;
  resources.vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource, checkStatus);
  resources.fragment = compileShader(gl, gl.FRAGMENT_SHADER, source, checkStatus);
  resources.program = gl.createProgram();
  if (!resources.program) throw new RendererError("The GPU could not allocate a program.", source);
  gl.attachShader(resources.program, resources.vertex);
  gl.attachShader(resources.program, resources.fragment);
  gl.linkProgram(resources.program);
}

function checkLink(renderer, resources, source) {
  const gl = renderer.gl;
  if (gl.getProgramParameter(resources.program, gl.LINK_STATUS)) return;
  // Only ask for shader diagnostics after linking completes; these queries can stall.
  for (const shader of [resources.vertex, resources.fragment]) {
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new RendererError(gl.getShaderInfoLog(shader) || "Shader compilation failed.", source);
    }
  }
  throw new RendererError(gl.getProgramInfoLog(resources.program) || "Shader linking failed.", source);
}

function createEntry(renderer, resources, key, source, floatNames) {
  const gl = renderer.gl;
  resources.buffer = gl.createBuffer();
  if (!resources.buffer) throw new RendererError("The GPU could not allocate a vertex buffer.", source);
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const names = ["u_resolution", "u_bounds", "u_clip_bounds", "u_clip_enabled", "u_background", ...floatNames];
  return { key, program: resources.program, buffer: resources.buffer, source, floatNames,
    position: gl.getAttribLocation(resources.program, "a_position"),
    uniforms: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(resources.program, name)])) };
}

function touchEntry(renderer, entry) {
  renderer.programs.delete(entry.key);
  renderer.programs.set(entry.key, entry);
}

function cacheEntry(renderer, entry) {
  touchEntry(renderer, entry);
  // Keep the last drawn program usable while preparing other revisions.
  while (renderer.programs.size > MAX_CACHED_PROGRAMS) {
    const victim = [...renderer.programs.values()].find((item) => item !== renderer.active && item !== entry);
    renderer.programs.delete(victim.key);
    releaseResources(renderer.gl, victim);
  }
}

function validateBounds(bounds) {
  if (!bounds || ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(Number.isFinite)
    || !(bounds.xMax > bounds.xMin) || !(bounds.yMax > bounds.yMin)
    || !Number.isFinite(bounds.xMax - bounds.xMin) || !Number.isFinite(bounds.yMax - bounds.yMin)) {
    throw new RendererError("Rendering bounds must be finite increasing ranges.");
  }
}

function validateOptions(options) {
  validateBounds(options.bounds);
  if (options.clipBounds) validateBounds(options.clipBounds);
}

function dimensions(renderer, options) {
  const dpr = options.dpr ?? 1;
  const width = Math.floor(options.width * dpr);
  const height = Math.floor(options.height * dpr);
  if (![width, height].every((value) => Number.isFinite(value) && value >= 1)) throw new RendererError("Render dimensions must be positive finite pixel sizes.");
  const maximum = renderer.maximum ??= renderer.gl.getParameter(renderer.gl.MAX_RENDERBUFFER_SIZE);
  if (width > maximum || height > maximum) throw new RendererError(`Image exceeds this GPU's ${maximum}-pixel render size limit.`);
  return { width, height };
}

function programKey(options) {
  const floatNames = Object.keys(options.floats ?? {}).sort();
  return { key: JSON.stringify([options.shaderKey, floatNames]), floatNames };
}

function validateSource(renderer, source, options) {
  if (typeof source !== "string" || !source.trim()) throw new RendererError("Fragment source is empty.");
  if (source.length > (options.maxSourceLength ?? MAX_FRAGMENT_CHARACTERS)) throw new RendererError("Generated shader exceeds the source-size safety budget.", source);
  if (!renderer.webGl2 && /^\s*#version 300 es\b/.test(source)) throw new RendererError("This graph uses collection shaders and requires WebGL 2. Try a browser/device with WebGL 2 enabled.", source);
  return source;
}

function getSource(renderer, options) {
  return validateSource(renderer, typeof options.fragmentSource === "function" ? options.fragmentSource() : options.fragmentSource, options);
}

function cachedEntry(renderer, key, options) {
  const entry = renderer.programs.get(key);
  if (entry) {
    validateSource(renderer, entry.source, options);
    touchEntry(renderer, entry);
  }
  return entry;
}

function result(entry, compiled = false, compileMs = 0) {
  return { supported: Boolean(entry), compiled, compileMs, source: entry?.source ?? "" };
}

function bindFrame(canvas, renderer, entry, options) {
  assertContext(renderer);
  const gl = renderer.gl;
  const { width, height } = dimensions(renderer, options);
  // Do not resize/clear until a replacement is ready: resizing destroys the old image.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);
  gl.useProgram(entry.program);
  if (entry.position >= 0) {
    gl.enableVertexAttribArray(entry.position);
    gl.vertexAttribPointer(entry.position, 2, gl.FLOAT, false, 0, 0);
  }
  const uniforms = entry.uniforms;
  const bounds = options.bounds;
  const clip = options.clipBounds ?? bounds;
  const background = options.background ?? [247 / 255, 250 / 255, 252 / 255];
  const floats = options.floats ?? {};
  gl.uniform2f(uniforms.u_resolution, width, height);
  gl.uniform4f(uniforms.u_bounds, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax);
  gl.uniform4f(uniforms.u_clip_bounds, clip.xMin, clip.xMax, clip.yMin, clip.yMax);
  gl.uniform1i(uniforms.u_clip_enabled, options.clipBounds ? 1 : 0);
  gl.uniform3f(uniforms.u_background, ...background);
  for (const name of entry.floatNames) gl.uniform1f(uniforms[name], Number.isFinite(floats[name]) ? floats[name] : 0);
  gl.clearColor(...background, 1);
  return { width, height };
}

function drawFrame(canvas, renderer, entry, options) {
  bindFrame(canvas, renderer, entry, options);
  const gl = renderer.gl;
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (options.synchronous) gl.finish();
  renderer.active = entry;
  touchEntry(renderer, entry);
}

function drawingControls(controls) {
  if (controls.maxBatchPixels === undefined) return null;
  if (!Number.isInteger(controls.maxBatchPixels) || controls.maxBatchPixels < 1) {
    throw new RendererError("maxBatchPixels must be a positive integer.");
  }
  const delay = controls.yieldIntervalMs ?? 0, timeout = controls.gpuTimeoutMs ?? 10000;
  if (!Number.isFinite(delay) || delay < 0 || !Number.isFinite(timeout) || timeout <= 0) {
    throw new RendererError("GPU yield interval must be nonnegative and fence timeout must be positive and finite.");
  }
  return { budget: Math.min(65536, controls.maxBatchPixels), delay, timeout };
}

function releaseDrawing(renderer, drawing) {
  // Supersession cleans up synchronously, before a newer request changes GL state.
  if (renderer.drawing !== drawing) return;
  renderer.drawing = null;
  drawing.wake?.();
  drawing.channel?.port1.close();
  drawing.channel?.port2.close();
  const gl = renderer.gl;
  if (drawing.fence) gl.deleteSync(drawing.fence);
  drawing.fence = null;
  if (!renderer.lost && !gl.isContextLost?.()) {
    gl.scissor(...drawing.scissor);
    if (drawing.enabled) gl.enable(gl.SCISSOR_TEST);
    else gl.disable(gl.SCISSOR_TEST);
  }
}

function cancelDrawing(renderer, error = abortError()) {
  const drawing = renderer.drawing;
  if (!drawing) return;
  drawing.error = error;
  releaseDrawing(renderer, drawing);
}

function yieldDrawing(drawing, delay) {
  if (delay > 0 || typeof MessageChannel === "undefined") return yieldPreparation(drawing, delay);
  // Unlike nested setTimeout(0), posted-message tasks do not incur a 4 ms clamp.
  if (!drawing.channel) {
    drawing.channel = new MessageChannel();
    drawing.channel.port1.onmessage = () => drawing.wake?.();
  }
  return new Promise((resolve) => {
    drawing.wake = () => { drawing.wake = null; resolve(); };
    drawing.channel.port2.postMessage(null);
  });
}

function batchBudget(renderer, maximum) {
  const estimate = renderer.pixelsPerMs === undefined ? 16384 : Math.floor(renderer.pixelsPerMs * 4);
  return Math.min(maximum, Math.max(Math.min(256, maximum), estimate));
}

async function drawBatches(canvas, prepared, controls, batches) {
  const { renderer, entry, options, revision } = prepared, gl = renderer.gl;
  const drawing = { enabled: gl.isEnabled(gl.SCISSOR_TEST), scissor: [...gl.getParameter(gl.SCISSOR_BOX)],
    fence: null, wake: null, error: null };
  renderer.drawing = drawing;
  const cancel = () => { if (renderer.drawing === drawing) cancelDrawing(renderer); };
  controls.signal?.addEventListener("abort", cancel, { once: true });
  const check = () => {
    if (drawing.error) throw drawing.error;
    checkRequest(renderer, revision, controls);
  };
  try {
    check();
    const { width, height } = bindFrame(canvas, renderer, entry, options);
    // Keep full-canvas uniforms/geometry. Only fragment coverage changes per batch.
    const [sx, sy, sw, sh] = drawing.enabled ? drawing.scissor : [0, 0, width, height];
    const left = Math.max(0, sx), bottom = Math.max(0, sy);
    const right = Math.min(width, sx + sw), top = Math.min(height, sy + sh);
    const started = performance.now();
    let batchCount = 0, maxBatchMs = 0;
    gl.enable(gl.SCISSOR_TEST);
    for (let y = bottom; y < top;) {
      const tileHeight = Math.min(top - y, Math.floor(Math.sqrt(batchBudget(renderer, batches.budget))));
      for (let x = left; x < right;) {
        check();
        const budget = batchBudget(renderer, batches.budget);
        const tileWidth = Math.min(right - x, Math.floor(budget / tileHeight));
        gl.scissor(x, y, tileWidth, tileHeight);
        const submitted = performance.now();
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        check();
        if (renderer.webGl2) {
          drawing.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          if (!drawing.fence) throw new RendererError("The GPU could not allocate a frame-completion fence.");
        }
        gl.flush();
        const deadline = performance.now() + batches.timeout;
        // A task yield is required for WebGL fences to become observable as signaled.
        // Keep only one tile outstanding instead of filling the GPU queue with tiles.
        while (true) {
          await yieldDrawing(drawing, Math.min(batches.delay, Math.max(0, deadline - performance.now())));
          check();
          if (!drawing.fence) break; // WebGL 1 has no completion fences.
          const status = gl.clientWaitSync(drawing.fence, 0, 0);
          check();
          if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
            gl.deleteSync(drawing.fence);
            drawing.fence = null;
            break;
          }
          if (status !== gl.TIMEOUT_EXPIRED) throw new RendererError("GPU frame-completion fence failed.");
          if (performance.now() >= deadline) throw new RendererError("GPU frame-completion fence timed out.");
        }
        const elapsed = performance.now() - submitted;
        batchCount++;
        maxBatchMs = Math.max(maxBatchMs, elapsed);
        if (renderer.webGl2) {
          // Fence wall time includes scheduling, not just GPU execution. React to
          // expensive edits immediately; grow cautiously when a new shader is cheap.
          const rate = tileWidth * tileHeight / Math.max(0.25, elapsed);
          const prior = renderer.pixelsPerMs ?? budget / 4;
          renderer.pixelsPerMs = rate < prior ? rate : Math.min(prior * 2, prior * 0.75 + rate * 0.25);
        }
        x += tileWidth;
      }
      y += tileHeight;
    }
    check();
    renderer.active = entry;
    touchEntry(renderer, entry);
    return { batchCount, drawMs: performance.now() - started, maxBatchMs };
  } finally {
    controls.signal?.removeEventListener("abort", cancel);
    releaseDrawing(renderer, drawing);
  }
}

/** Synchronous legacy/capture path. Numeric uniforms do not change the semantic key. */
export function renderFrame(canvas, options) {
  validateOptions(options);
  const renderer = getRenderer(canvas);
  if (!renderer) return result(null);
  dimensions(renderer, options);
  cancelDrawing(renderer);
  const { key, floatNames } = programKey(options);
  let entry = cachedEntry(renderer, key, options);
  let compileMs = 0;
  let compiled = false;
  if (!entry) {
    renderer.revision++;
    cancelPending(renderer);
    const start = performance.now();
    const source = getSource(renderer, options);
    const resources = {};
    try {
      submitProgram(renderer, resources, source, true);
      checkLink(renderer, resources, source);
      entry = createEntry(renderer, resources, key, source, floatNames);
      cacheEntry(renderer, entry);
      resources.program = resources.buffer = null;
    } finally {
      releaseResources(renderer.gl, resources);
    }
    compileMs = performance.now() - start;
    compiled = true;
  }
  drawFrame(canvas, renderer, entry, options);
  return result(entry, compiled, compileMs);
}

function checkControls(controls) {
  if (controls.signal?.aborted || controls.isCurrent?.() === false) throw abortError();
}

function checkRequest(renderer, revision, controls) {
  checkControls(controls);
  assertContext(renderer);
  if (renderer.revision !== revision) throw abortError();
}

function yieldPreparation(pending, delay) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pending.wake = null; resolve(); }, delay);
    pending.wake = () => { clearTimeout(timer); pending.wake = null; resolve(); };
  });
}

async function prepare(canvas, input, controls) {
  checkControls(controls);
  const options = { ...input, bounds: { ...input.bounds }, clipBounds: input.clipBounds ? { ...input.clipBounds } : null,
    floats: { ...input.floats }, background: input.background ? [...input.background] : undefined };
  validateOptions(options);
  const renderer = getRenderer(canvas);
  if (!renderer) return { result: result(null) };
  const revision = ++renderer.revision;
  cancelPending(renderer);
  cancelDrawing(renderer);
  dimensions(renderer, options);
  const { key, floatNames } = programKey(options);
  const cached = cachedEntry(renderer, key, options);
  if (cached) return { result: result(cached), renderer, entry: cached, options, revision };

  const pending = { resources: {}, error: null, wake: null };
  renderer.pending = pending;
  const cancel = () => {
    if (renderer.pending === pending) cancelPending(renderer);
  };
  controls.signal?.addEventListener("abort", cancel, { once: true });
  const check = () => {
    if (pending.error) throw pending.error;
    checkRequest(renderer, revision, controls);
  };
  const delay = Number.isFinite(controls.pollIntervalMs) ? Math.max(0, controls.pollIntervalMs) : 8;
  const start = performance.now();
  try {
    // Yield a task, not just a microtask, so newer edits/cancellation can be processed.
    await yieldPreparation(pending, 0);
    check();
    const source = getSource(renderer, options);
    check();
    if (renderer.parallel === undefined) renderer.parallel = renderer.gl.getExtension("KHR_parallel_shader_compile");
    submitProgram(renderer, pending.resources, source, false);
    await yieldPreparation(pending, delay);
    check();
    while (renderer.parallel && !renderer.gl.getProgramParameter(pending.resources.program, renderer.parallel.COMPLETION_STATUS_KHR)) {
      await yieldPreparation(pending, delay);
      check();
    }
    // Without the extension this may block. Use an OffscreenCanvas worker for isolation.
    check();
    checkLink(renderer, pending.resources, source);
    check();
    const entry = createEntry(renderer, pending.resources, key, source, floatNames);
    check();
    releaseShaders(renderer.gl, pending.resources);
    cacheEntry(renderer, entry);
    pending.resources.program = pending.resources.buffer = null;
    return { result: result(entry, true, performance.now() - start), renderer, entry, options, revision };
  } finally {
    controls.signal?.removeEventListener("abort", cancel);
    pending.wake?.();
    releaseResources(renderer.gl, pending.resources);
    if (renderer.pending === pending) renderer.pending = null;
  }
}

/** Prepare/cache a shader without resizing, clearing, binding it for drawing, or drawing. */
export async function prepareFrame(canvas, options, controls = {}) {
  const prepared = await prepare(canvas, options, controls);
  if (prepared.renderer) checkRequest(prepared.renderer, prepared.revision, controls);
  return prepared.result;
}

/** Prepare then draw only if current; never calls gl.finish(), even for synchronous: true. */
export async function renderFrameAsync(canvas, options, controls = {}) {
  const batches = drawingControls(controls);
  const prepared = await prepare(canvas, options, controls);
  if (prepared.renderer) {
    checkRequest(prepared.renderer, prepared.revision, controls);
    if (batches) Object.assign(prepared.result, await drawBatches(canvas, prepared, controls, batches));
    else drawFrame(canvas, prepared.renderer, prepared.entry, { ...prepared.options, synchronous: false });
  }
  return prepared.result;
}

/** Cancel pending work and release all programs/buffers/listeners; reusable unless context is lost. */
export function disposeRenderer(canvas, { loseContext = false } = {}) {
  const renderer = renderers.get(canvas);
  if (renderer) {
    renderer.disposed = true;
    clearPrograms(renderer, abortError("The renderer was disposed."));
    canvas.removeEventListener?.("webglcontextlost", renderer.onLost);
    canvas.removeEventListener?.("webglcontextrestored", renderer.onRestored);
    renderers.delete(canvas);
  }
  if (loseContext) {
    const context = contexts.get(canvas);
    contexts.delete(canvas);
    context?.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
