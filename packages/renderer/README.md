# Lepton Renderer

The reusable GPU rendering driver for Lepton. This package owns GLSL compilation,
program caching, uniform updates, fullscreen drawing, GPU limits, and resource
cleanup. It has no dependency on MathQuill, the grapher interface, or browser storage.
Its JavaScript ES module ships with TypeScript declarations.

The Lepton-language compiler and scene model live in the grapher and its
`src/compiler` worker modules. They produce GLSL for this driver. This package
does not parse Lepton text, draw coordinate labels, or manage point interaction.

## Use

```js
import { renderFrame, disposeRenderer } from "./packages/renderer/src/index.js";

renderFrame(canvas, {
  width: 640,
  height: 480,
  dpr: 1,
  bounds: { xMin: -10, xMax: 10, yMin: -7.5, yMax: 7.5 },
  shaderKey: "example-v1",
  floats: { u_time: 2 },
  fragmentSource: `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec4 u_bounds;
    uniform float u_time;
    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float x = mix(u_bounds.x, u_bounds.y, uv.x);
      float y = mix(u_bounds.z, u_bounds.w, uv.y);
      float value = 0.5 + 0.5 * sin(x + y + u_time);
      gl_FragColor = vec4(value, 0.25, 1.0 - value, 1.0);
    }
  `
});

// Call when permanently replacing a canvas.
disposeRenderer(canvas, { loseContext: true });
```

The driver accepts GLSL ES 1.00 and `#version 300 es` fragment shaders and chooses
the matching vertex shader. List/reduction evaluation uses ES 3.00 and requires
WebGL 2; ES 1.00 scalar graphs retain the WebGL 1 fallback. The driver provides
six vertices covering the canvas. Supply a semantic `shaderKey` that changes
whenever the generated GLSL changes (including compiler version and any baked-in
settings). Numeric time, bounds, background, dimensions, and presentation-only
changes should not change the key unless they change that GLSL. Sorted scalar
uniform names are automatically included in the cache key; their values are not.
A `fragmentSource` factory runs only on cache misses and must represent the same
source for the same key. The driver does not hash or generate source for you.

Available uniforms are `u_resolution` (physical pixels), `u_bounds` and
`u_clip_bounds` (`xMin, xMax, yMin, yMax`), `u_clip_enabled` (integer),
`u_background` (RGB 0..1), and the scalar entries in `floats`. The fragment shader
is responsible for applying clipping and compositing. Unused uniforms are fine.

The return value reports support, whether compilation happened, compile time,
and source. Invalid dimensions, context loss, or shader errors throw
`RendererError`; unavailable WebGL returns `supported: false` for a caller's
fallback. Set `synchronous: true` only for immediate image readback, never live
animation. Dimensions are bounded by the device's renderbuffer limit; the
default generated-source budget is 1,500,000 characters.

## Background Preparation and Drawing

```js
import { prepareFrame, renderFrameAsync } from "./packages/renderer/src/index.js";

const controller = new AbortController();
const revision = currentRevision;
const controls = {
  signal: controller.signal,
  isCurrent: () => revision === currentRevision,
  pollIntervalMs: 8 // optional; a timer task always yields, even at 0
};

try {
  await renderFrameAsync(canvas, options, controls);
} catch (error) {
  if (error.name !== "AbortError") reportError(error);
}

// Optional prewarming: validates options and prepares a cached program,
// without resizing/clearing the canvas or drawing anything.
await prepareFrame(canvas, options, controls);
```

Both functions return `Promise<RenderResult>` with the same fields as
`renderFrame`. `compileMs` includes elapsed preparation and polling time, not GPU
draw time. A cache hit returns `compiled: false` and `compileMs: 0`, even if a
previous `prepareFrame` call compiled the program without drawing it.

On a cache miss, preparation first yields a task, submits shader compilation and
linking, then polls `KHR_parallel_shader_compile.COMPLETION_STATUS_KHR` when the
extension is available. It does not query compile/link status, logs or uniform
locations before completion. Polling yields timer tasks rather than spinning or
using only microtasks; it works in workers without `requestAnimationFrame`.
Without the extension, link-status checking may still block after the yield.
Use a worker for isolation; the async API alone does not move work off-thread.
[Extension specification](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/).

Every new async request supersedes earlier async work **on that same canvas**,
including requests for the same key or a cached key. Await requests sequentially
for export; use revisioned, latest-request-wins scheduling for live preview.
Use separate canvases for independent preview and export jobs. A synchronous
cache-hit `renderFrame` can keep drawing the old program while a new one prepares;
a synchronous cache miss cancels the pending preparation before compiling.
Any new async request or synchronous draw cancels an outstanding cooperative
tiled draw before changing its GL state.

Cancellation, supersession, disposal, or a false `isCurrent()` rejects with an
`Error` named `AbortError`. Context loss and validation/GLSL errors instead reject
with `RendererError`. An unavailable WebGL context still returns
`supported: false`. `isCurrent` is checked before source submission, between polls,
before publication, and immediately before drawing, including on cache hits.
An `AbortSignal` wakes a pending timer immediately. Cancellation stops polling
and releases owned resources but cannot preempt work already in a GPU driver.

Preparation never clears, resizes, or replaces the displayed frame. Successful
`renderFrameAsync` draws only after the final stale check; failed preparation
leaves the last good program and image intact. Async drawing never calls
`gl.finish()`, even if options contain `synchronous: true`. Completion of its
promise normally means the draw has been submitted, not that GPU execution has
finished. The opt-in WebGL 2 cooperative path below also awaits completion fences.
The explicit synchronous capture contract remains in `renderFrame`.

### Cooperative GPU drawing

```js
const result = await renderFrameAsync(internalCanvas, options, {
  signal,
  isCurrent: () => revision === currentRevision,
  maxBatchPixels: 65536,
  yieldIntervalMs: 0,
  gpuTimeoutMs: 10000
});
// Transfer/publish only after the complete frame resolves successfully.
if (result.supported) publish(internalCanvas.transferToImageBitmap());
```

`maxBatchPixels` enables full-resolution scissor batches. It is absent by default,
so legacy and export callers retain their single-draw path unless explicitly
opting in. It must be a positive integer and is capped at 65,536 physical pixels.
The first batch on a fresh renderer is at most 16,384 pixels. WebGL 2 measures elapsed wall time from
batch submission to fence completion and adjusts subsequent batch sizes toward
4 ms, within the caller's ceiling. The measured throughput survives frames and
shader edits on that renderer/context; loss or disposal resets it. Slow samples
reduce the estimate immediately; growth is smoothed and limited to doubling.
This uses observations, not source length or estimated shader complexity.

Each batch keeps the same full-canvas viewport, geometry, bounds, uniforms and
`gl_FragCoord` values as a normal draw. Scissoring limits its clear and draw to a
disjoint part of the original coverage, including any caller-enabled scissor.
No pixel is dropped, rescaled, blended twice, or sampled at a lower resolution.
The previous scissor rectangle and enable state are restored on success, errors,
cancellation and supersession. Lost contexts cannot restore state; restoration
starts with the browser's reset GL state. Do not independently mutate the GL
context while awaiting a renderer request.

In WebGL 2, each batch inserts a completion fence, flushes, and polls
`clientWaitSync(fence, 0, 0)` after yielding tasks. The next batch is submitted only
after that fence signals, so the renderer does not queue a whole frame's worth
of expensive draws. A zero `yieldIntervalMs` uses MessageChannel tasks, avoiding
the nested-timer minimum delay; positive intervals deliberately wait using timers.
If MessageChannel is unavailable, the task fallback uses timers. See the
[WebGL completion API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/clientWaitSync).

`gpuTimeoutMs` is a positive, finite per-fence deadline, defaulting to 10 seconds.
Fence allocation failure, failed waits, timeout or context loss rejects with
`RendererError`. Cancellation/staleness rejects with `AbortError`. Every path
releases its fence, task channel and temporary scissor state; checks run before
each next submission and after each wait. None calls `gl.finish()`.
WebGL 1 has no completion fences: it flushes and yields between bounded draws,
but cannot enforce one outstanding GPU batch or learn GPU completion throughput.

Successful cooperative results additionally expose `batchCount`, `drawMs`, and
`maxBatchMs`. Timing is elapsed wall time including driver submission, scheduling
and fence waits, not a GPU timer-query measurement. `compileMs` remains shader
preparation time only. One expensive batch, a driver call, or compilation still
cannot be preempted. Tiling adds driver overhead and can reduce total throughput;
the 4 ms target is not a guarantee. Benchmark actual editing/presentation latency
and cheap-scene frame rate before enabling it in a release.

A cancelled/failed tiled frame may leave **partial pixels on its private canvas**.
It is not an atomic framebuffer swap. Keep displaying the last completed bitmap,
and composite overlays/transfer a new bitmap only after the render resolves.
The last successfully drawn program stays protected in the cache while a new
frame is attempted. This API does not change displayed UI state itself.

### Internal worker canvas

The same API accepts `OffscreenCanvas` directly. It does not need to transfer the
visible DOM canvas or depend on browser UI globals:

The structural `RendererCanvas` TypeScript interface accepts either canvas type
without importing DOM-only names. Declarations also work with `lib: ["ES2022",
"WebWorker"]` in a dedicated worker project.

```js
// Inside a module worker; the main thread keeps a separate 2D display canvas.
const canvas = new OffscreenCanvas(1, 1);
const result = await renderFrameAsync(canvas, options, controls);
if (result.supported && controls.isCurrent()) {
  const bitmap = canvas.transferToImageBitmap();
  postMessage({ revision, bitmap }, [bitmap]);
}
```

The receiver must also check the revision before displaying a bitmap, and close
any discarded bitmap. Render again before transferring another bitmap: transfer
replaces the worker canvas's drawing buffer. Async options snapshot the provided
bounds, dimensions, background, and float values before yielding. Source factories
should close over an immutable compiler result, not changing editor state.

## Cache and Lifecycle

Each canvas/context retains up to `MAX_CACHED_PROGRAMS` (4) ready programs using
LRU eviction, plus at most one pending compilation. The last successfully drawn
program is protected from eviction while other programs are prepared. Reverting
to a retained semantic key reuses its program and uniform locations. Each cached
entry owns one small fullscreen vertex buffer; completed shader handles are
marked for deletion and are released by WebGL when their program is deleted.
The cache bounds resource counts and retained sources, not exact driver VRAM
usage, which WebGL does not expose. Raising `maxSourceLength` increases that cost.
Four slots retain a four-variant edit/backspace cycle without recompiling the
original. Additional distinct variants can still evict older entries under LRU.

`disposeRenderer(canvas)` cancels pending work, deletes all cached programs,
buffers, remaining shader handles and completion fences, closes task channels,
and unregisters context listeners. It is
idempotent and allows a later call to create a fresh renderer on the same context.
`disposeRenderer(canvas, { loseContext: true })` additionally requests context
release, including after a failed first compilation or an earlier ordinary
disposal. Disposal never acquires a context on an unused canvas.

Context loss prevents rendering, cancels pending requests, and invalidates the
entire cache. The loss listener prevents the default event so restoration is
allowed. On restoration, the next request compiles afresh and redetects extension
support and device limits. Lost GPU images cannot be retained; the caller must
request a fresh frame after restoration. A separate 2D display can retain its
previous bitmap while the worker recovers.

## Tests and Export

From the repository root:

```sh
npm run test:renderer
npx tsc --noEmit --strict --target ES2022 --module NodeNext --lib ES2022,DOM packages/renderer/test/types.dom.ts
npx tsc --noEmit --strict --target ES2022 --module NodeNext --lib ES2022,WebWorker packages/renderer/test/types.worker.ts
node packages/renderer/test/cooperative-browser.mjs
npm pack ./packages/renderer --pack-destination /tmp
```

Tests run with Node's built-in test runner and mock GPUs, with no installation
required. They cover sync command compatibility, deferred status queries, timer
yields, cancellation/staleness, cache reuse/eviction, allocation failures, and
context loss/restoration/disposal, adaptive scissor coverage, fence failures,
timeouts and cancellation during tiled drawing. The optional browser fixture
requires the repository's Playwright dependency; `LEPTON_BROWSER_EXECUTABLE`
selects a native Chrome executable, otherwise it uses Playwright's Chromium.
It compares every RGBA byte between normal and tiled WebGL 1/2 images with
coordinate-dependent shading, discard, clipping, fractional DPR and a preexisting
scissor, and reports completed-frame timings for a 1M-pixel flat graph. Grapher
browser checks additionally measure real editing latency. To transfer its complete history-aware folder:

```sh
git archive --format=tar HEAD packages/renderer > /tmp/lepton-renderer.tar
```

Keep changes here in the same commit as affected GRE adapter changes. A separate
repository can be split out once the language/compiler API is stable; keeping
this package here currently avoids incompatible editor/renderer releases.

Lepton's owner has not selected an open-source license. `UNLICENSED` records that
fact; packaging does not grant additional reuse rights.
