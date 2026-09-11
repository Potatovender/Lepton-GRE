const cache = new WeakMap();
const contexts = new WeakMap();
const registered = new WeakSet();
const VERTEX_SOURCE = "attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }";
export const MAX_FRAGMENT_CHARACTERS = 1_500_000;

export class RendererError extends Error {
  constructor(message, source = "") {
    super(message);
    this.name = "RendererError";
    this.source = source;
  }
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new RendererError("The GPU could not allocate a shader.", source);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new RendererError(log || "Shader compilation failed.", source);
  }
  return shader;
}

function compileProgram(gl, source) {
  let vertex;
  let fragment;
  let program;
  try {
    const modern = /^\s*#version 300 es\b/.test(source);
    const vertexSource = modern ? `#version 300 es\n${VERTEX_SOURCE.replace("attribute", "in")}` : VERTEX_SOURCE;
    vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, source);
    program = gl.createProgram();
    if (!program) throw new RendererError("The GPU could not allocate a program.", source);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new RendererError(gl.getProgramInfoLog(program) || "Shader linking failed.", source);
    return program;
  } catch (error) {
    if (program) gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }
}

function validateBounds(bounds) {
  if (!bounds || ![bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax].every(Number.isFinite)
    || !(bounds.xMax > bounds.xMin) || !(bounds.yMax > bounds.yMin)
    || !Number.isFinite(bounds.xMax - bounds.xMin) || !Number.isFinite(bounds.yMax - bounds.yMin)) {
    throw new RendererError("Rendering bounds must be finite increasing ranges.");
  }
}

/** Render GLSL over a continuous viewport. Change shaderKey when program structure changes. */
export function renderFrame(canvas, options) {
  validateBounds(options.bounds);
  if (options.clipBounds) validateBounds(options.clipBounds);
  const webGl2 = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  const gl = webGl2 ?? canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) return { supported: false, compiled: false, compileMs: 0, source: "" };
  // Retain the context for disposal even when the first render fails.
  contexts.set(canvas, gl);
  if (gl.isContextLost?.()) throw new RendererError("The graphics context was lost. Wait for recovery or reload the graph.");
  if (!registered.has(canvas) && canvas.addEventListener) {
    canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); cache.delete(canvas); });
    canvas.addEventListener("webglcontextrestored", () => cache.delete(canvas));
    registered.add(canvas);
  }
  const dpr = options.dpr ?? 1;
  const width = Math.floor(options.width * dpr);
  const height = Math.floor(options.height * dpr);
  if (![width, height].every((value) => Number.isFinite(value) && value >= 1)) throw new RendererError("Render dimensions must be positive finite pixel sizes.");
  const maximum = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  if (width > maximum || height > maximum) throw new RendererError(`Image exceeds this GPU's ${maximum}-pixel render size limit.`);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  gl.viewport(0, 0, width, height);

  const floats = options.floats ?? {};
  const floatNames = Object.keys(floats).sort();
  const key = `${options.shaderKey}\n${floatNames.join(",")}`;
  let state = cache.get(canvas);
  let compileMs = 0;
  let compiled = false;
  if (!state || state.gl !== gl || state.key !== key) {
    const start = performance.now();
    const source = typeof options.fragmentSource === "function" ? options.fragmentSource() : options.fragmentSource;
    if (typeof source !== "string" || !source.trim()) throw new RendererError("Fragment source is empty.");
    if (source.length > (options.maxSourceLength ?? MAX_FRAGMENT_CHARACTERS)) throw new RendererError("Generated shader exceeds the source-size safety budget.", source);
    if (!webGl2 && /^\s*#version 300 es\b/.test(source)) throw new RendererError("This graph uses collection shaders and requires WebGL 2. Try a browser/device with WebGL 2 enabled.", source);
    const program = compileProgram(gl, source);
    const buffer = gl.createBuffer();
    if (!buffer) { gl.deleteProgram(program); throw new RendererError("The GPU could not allocate a vertex buffer.", source); }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    if (state) { gl.deleteProgram(state.program); gl.deleteBuffer(state.buffer); }
    const names = ["u_resolution", "u_bounds", "u_clip_bounds", "u_clip_enabled", "u_background", ...floatNames];
    state = { gl, key, program, buffer, source, position: gl.getAttribLocation(program, "a_position"),
      uniforms: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) };
    cache.set(canvas, state);
    compileMs = performance.now() - start;
    compiled = true;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.useProgram(state.program);
  if (state.position >= 0) {
    gl.enableVertexAttribArray(state.position);
    gl.vertexAttribPointer(state.position, 2, gl.FLOAT, false, 0, 0);
  }
  const uniforms = state.uniforms;
  const bounds = options.bounds;
  const clip = options.clipBounds ?? bounds;
  const background = options.background ?? [247 / 255, 250 / 255, 252 / 255];
  gl.uniform2f(uniforms.u_resolution, width, height);
  gl.uniform4f(uniforms.u_bounds, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax);
  gl.uniform4f(uniforms.u_clip_bounds, clip.xMin, clip.xMax, clip.yMin, clip.yMax);
  gl.uniform1i(uniforms.u_clip_enabled, options.clipBounds ? 1 : 0);
  gl.uniform3f(uniforms.u_background, ...background);
  for (const name of floatNames) gl.uniform1f(uniforms[name], Number.isFinite(floats[name]) ? floats[name] : 0);
  gl.clearColor(...background, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  if (options.synchronous) gl.finish();
  return { supported: true, compiled, compileMs, source: state.source };
}

/** Release GPU resources; optionally discard a canvas that will not be reused. */
export function disposeRenderer(canvas, { loseContext = false } = {}) {
  const state = cache.get(canvas);
  if (state) {
    state.gl.deleteProgram(state.program);
    state.gl.deleteBuffer(state.buffer);
    cache.delete(canvas);
  }
  if (loseContext) {
    const gl = contexts.get(canvas);
    contexts.delete(canvas);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
