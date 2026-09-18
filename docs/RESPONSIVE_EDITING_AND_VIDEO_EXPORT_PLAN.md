# Responsive Editing and Video Export

Implementation plan recorded on 2026-09-17, before the migration below. The shipped
architecture is documented in [ARCHITECTURE.md](ARCHITECTURE.md): it uses a generated
compiler bridge instead of removing compiler helpers from the editor. The video UI
currently offers bounded downloads; file streaming remains an encoder API option.

The first release uses a minimizable export dialog and full-resolution cooperative
GPU batches. Adaptive preview resolution, per-entry dependency caches, a frame
scrubber, MathQuill start fields, and automatic preview pausing remain follow-up
ideas in this plan, not shipped controls. The editor's synchronous compatibility
path remains for browsers without the required worker APIs. See the architecture
and video module README for the implemented behavior and limits.

## Goals

- Keep typing, selection, undo, scrolling, and field focus responsive while
  validation, shader preparation, or graph rendering is expensive.
- Preserve existing graph semantics, editor order, folders, comments, saves,
  diagnostics, and photo export bounds.
- Export deterministic videos without recording the live preview's frame rate.
- Remain browser-local. No server, account, or remote rendering requirement.
- Do not claim that workers eliminate shared-GPU contention or that arbitrary
  shaders can always be cancelled once submitted to the graphics driver.

## Baseline Findings

- MathQuill's edit handler calls whole-scene validation and rendering directly.
- `renderApp()` disposes of the old canvas/context and rebuilds the whole shell.
  This discards its GPU program cache even for interface-only changes.
- Scheduling with animation frames delays work but does not move it off the UI
  thread. Some edit paths bypass even that scheduling.
- The renderer caches one program per canvas. Its immediate shader/link status
  queries can wait for compilation to complete.
- Time values already travel through uniforms, but graph cache keys include
  full data objects, including properties unrelated to generated shaders.
- Animation mutates time entries in order, uses wall-clock deltas capped at
  0.1 seconds, and routes values through display-oriented slider formatting.
  Repeatedly invoking that path is not a reliable offline export clock.
- Photo export already uses GLSL and the settings bounds, then composites points
  and labels. It is tied to global editor state and needs a snapshot interface
  before it can safely support video jobs.

## 1. Responsive Editing

### Persistent interface and renderer

Mount the application shell and graph canvases once. Update editor panels and
graph controls independently. Changing tabs, opening menus, adding comments,
or expanding folders must not dispose of the renderer. Preserve field DOM and
MathQuill instances where possible rather than reconstructing an active field.
Register canvas listeners once and retain current coordinate/point overlays.

Split work into three categories:

| Change | Required work |
| --- | --- |
| Selection, comment, folder collapse, search | UI only |
| Time, viewport, supported scalar slider values | Uniform update and redraw |
| Formula, function signature, draw structure | Dependency validation and compilation |

Not every slider is automatically uniform-only: a value that changes statically
allocated list structure or generated code needs the corresponding invalidation.
Draw ordering affects compositing even when unrelated editor ordering does not.

### Pure compiler and dependency caches

Extract the existing compiler/evaluator into DOM-independent modules under
`src/compiler/`, keeping the current driver in `packages/renderer/`. Use the
same modules for preview, diagnostics, photo export, and video export. Do not
create a second parser, strip functions out of the monolith with string matching,
or change language semantics as part of extraction.

Define an immutable scene snapshot and explicit compilation context. Cache:

1. Parsed expressions, including binding-sensitive syntax information.
2. Symbol resolution, types, dependencies, and diagnostics.
3. Reusable GLSL function definitions and whole-program source.
4. A small memory-bounded cache of linked programs per WebGL context, allowing
   undo to reuse recently compiled programs where practical.

Keys must include relevant settings, signatures, resolved dependencies, scopes,
and compiler version. Invalidation follows transitive dependants and recursive
groups. Names becoming defined/undefined must invalidate unresolved references.
Never reuse evaluation results across different coordinates, time, local
parameters, or random seeds. Preserve random call identity and evaluation scope
when considering common-subexpression elimination.

### Work scheduling and isolation

- UI thread: edit state, input feedback, MathQuill, accessibility, small DOM
  updates, and job controls. Avoid full scene serialization on each keystroke
  where a changed-entry patch and transaction will suffice.
- Compiler worker: parsing, dependency/type analysis, expanded-node estimates,
  validation/evaluation, and GLSL generation. Send versioned patches/snapshots;
  return versioned diagnostics and compiled artifacts.
- Renderer worker where supported: persistent OffscreenCanvas and WebGL context,
  shader compilation, and rendering. Decide worker ownership before obtaining a
  context; an already initialized canvas cannot simply be transferred later.

Request a graph update on every edit, without an idle debounce. Keep one active
job and one newest replacement; cancel obsolete edit work and discard stale results.
Continuous animation may show completed frames of the current edit revision even
when a newer time is queued, avoiding starvation on slower GPUs.
Display a pending state rather than a misleading green result before validation.
Keep the last successful graph explicitly marked as showing an earlier revision.

Every request carries a revision/job ID. Retain only the newest pending edit and
discard stale replies. For lengthy CPU jobs, add cooperative cancellation checks;
terminate and recreate a blocked worker when necessary. Never apply a stale
diagnostic to a renamed, moved, or deleted row.

Poll `KHR_parallel_shader_compile` completion where supported. Keep the previous
program active until a replacement is ready, then swap atomically. Feature-detect
OffscreenCanvas/WebGL worker support and extension availability. Fallbacks keep
CPU compilation in a worker, debounce rendering, and offer paused/manual preview;
they must not promise the same isolation as worker rendering.

### GPU load and preview quality

Compilation caching does not reduce all per-pixel computation. Provide Auto,
Full, and Reduced preview resolution, plus Pause preview. Auto can temporarily
reduce preview pixel count during editing, with an explicit indicator. It must
not change expressions, recursion depth, list size, or exported quality.

Coalesce renders rather than queueing every input. Avoid synchronous readback and
`gl.finish()` during interaction. Slow individual draws still share the GPU with
the browser; safe job budgets, early complexity warnings, and context-loss
handling remain necessary. Do not silently fall back to a huge CPU pixel loop.

## 2. Export UI

### Graph menu

- Rename Export to **Export photo**; retain the existing photo workflow.
- Add **Export video** only when at least one actual time-variable entry exists,
  including entries inside closed folders. A slider merely named `t` does not count.
- A declared but invalid time variable still exposes the action so the export
  panel can explain the problem; it does not disappear as soon as an error occurs.

### Dedicated video export panel

Use a temporary Video export panel in the existing sidebar, with a Back control,
not another permanent data type or browser tab. Keep the graph visible. On mobile,
the panel occupies the lower editor area. Preserve the previous editor mode,
selection, scroll position, and unapplied text draft.

| Control | Proposed default and behaviour |
| --- | --- |
| File name | Current graph name |
| Duration | 10 seconds; positive finite seconds |
| Frame rate | 30 FPS; 24/30/60 and validated custom value |
| Time-variable starts | One MathQuill scalar input per time variable, initially its current value; reset-to-current action |
| Time mode and speed | Show graph's mode, range, and units/second beside each start value |
| Bounded starting direction | Increasing by default; optional decreasing, interpreted with the signed speed |
| Resolution | Default 1080-pixel long edge; 720/1080/2160/custom presets, always show actual width and height |
| Compression quality | Standard / High / Maximum, with advanced target bitrate |
| Format | MP4/H.264 when supported; WebM alternatives shown only after capability checks |
| Points and labels | Include visible points and their enabled labels by default, matching photo export |
| Coordinate grid | Off by default, optionally include current grid settings |
| Preview | Scrub or render a selected frame without changing the saved graph |
| Estimate | Estimate export time and approximate file size for these settings |
| Actions | Export video; while running, Cancel and an optional Back to editor |

The settings-defined rendering rectangle and corrected aspect ratio control
composition. Sidebar size, screen DPR, pan, and zoom must not change output bounds
or resolution. Do not force every graph to 16:9. Codec dimension alignment may
require padding; avoid silently cropping or distorting the graph.

For an unapplied Text draft, offer Apply and export / Export current graph /
Cancel. Never silently discard the draft or imply it is included when it is not.

## 3. Deterministic Animation Clock

Use a shared, tested time-evaluation module for both playback and export.
For frame `n`, evaluate at `n / fps` seconds, not at the elapsed rendering time.
Use `ceil(duration * fps)` frames; shorten the last frame's encoded duration if
needed so container duration matches the requested duration without an extra
duplicate endpoint frame. Validate timestamp precision and encoder timebase.

- All time variables advance during export independently of live Play/Stop state.
- Starting values are finite coordinate-independent expressions. Resolve references
  against the frozen graph and start overrides; reject circular starting definitions.
- Unbounded values advance without range limits.
- Bounded looped values wrap within their range.
- Bounded values reflect at their endpoints, honoring starting direction and speed.
- Out-of-range bounded starts require correction before export, not silent clamping.
- Fixed rates/ranges use direct closed-form evaluation, avoiding accumulated drift.
- If rates/ranges depend on changing time variables, use a deterministic fixed-step
  simulation from the start snapshot, with all next values evaluated from the same
  previous state. It must be independent of output FPS and declaration order.
  Prototype and test this path before enabling it; do not freeze changing rates or
  silently substitute a different motion model. Surface any unresolved semantics
  for approval before implementation.
- Store computation values at full JS precision; round only displayed values.
- Keep the random seed fixed throughout the export; temporal changes must come
  from the graph's explicit time dependence, not rerandomizing each frame.

Multiple clocks do not automatically form a seamless loop. Duration and endpoint
behaviour are explicit; the UI must not promise a seamless loop for every graph.

## 4. Render and Encode Pipeline

Freeze the applied graph, start values, seed, viewport, and export settings when
the job starts. Later edits affect the preview, not the active export. Show that
the job uses a snapshot. Snapshot preparation and serialization must also be
profiled rather than becoming a new main-thread pause.

Use an export worker with a private offscreen canvas/context. Compile once per
snapshot and reuse uniforms per frame. Compose point coordinates/linked values
and optional grid labels at that frame's time, without needing DOM elements.
Wait for required fonts before measuring exported labels.

Use WebCodecs for encoding and a maintained muxing library, initially evaluate
Mediabunny, for container output. Confirm dependency license, local bundling, and
supported paths before adoption. Do not rely on a runtime CDN or implement MP4
container structures by hand.

Feature-detect encoder existence and call `isConfigSupported()` with the actual
codec/profile, dimensions, bitrate, and frame rate. Recheck when settings change.
Browser name alone does not guarantee hardware encoding or codec availability.

Bound frames in flight (initially 2-4), apply encoder backpressure, close each
VideoFrame, and flush/finalize the container before offering the completed file.
Stream compressed output to a user-approved writable file where supported; use
temporary browser storage or a size-bounded Blob download elsewhere. Detect quota
and allocation failures, and clean up partial files/buffers on cancellation.

If no suitable video encoder is available, explain that clearly. A PNG sequence
is a future fallback, not a disguised live recording. Real-time MediaRecorder
capture must not substitute for deterministic export on slow graphs.

Initial scope: silent video with the graph's background, not transparent video,
audio tracks, GIF, a timeline editor, or a server renderer. Per-layer transparency
continues to composite normally. Alpha-channel export requires a separate tested
format path; ordinary MP4 should not be labelled transparent.

Pause live preview animation by default while exporting to reduce GPU competition;
leave editing available and allow low-priority preview updates between export
frames. Restore prior playback state on completion/cancel if the same graph is
still open. Warn before closing the page or starting a new graph during export.
Do not promise continued execution after a tab/browser is suspended or closed.

## 5. Estimates, Progress, and Quality

Perform a cancellable preflight: validate the snapshot, test codec support, compile,
then sample a small number of frames spread across the requested interval at the
chosen resolution. Include texture/overlay composition and encoding, not merely
JavaScript command-submission time. Finalize the sample encoder to measure its
actual pipeline cost, then discard its output and reset the export clock.

Estimate remaining work from measured completed-frame throughput, with separate
compile and finalization costs. Present a range, not a promise. Dynamic loops,
time-dependent complexity, thermal throttling, and device contention can change
it; update the estimate during export. Cached estimates must be invalidated when
the snapshot or relevant export settings change.

Display Preparing / Compiling / Rendering N of M / Finalizing / Ready, elapsed
time, estimated time remaining, and estimated output size. Distinguish requested
video duration from expected export time. Cancellation stops new work immediately
but may await a GPU/encoder operation already in flight.

Compression-size estimate in decimal MB is `bitrate_Mbps * seconds / 8`, plus
container overhead. Label variable-bitrate results approximate. For example,
1080p at 8 Mbps is about 10 MB for 10 seconds and 60 MB for one minute.

Quality controls must be separate:

- Resolution changes pixel count and GPU workload.
- Compression quality changes bitrate and compression artifacts.
- Optional supersampling improves antialiasing but raises render cost; defer it
  until basic export is stable, then report the internal render resolution.
- Never lower graph recursion depth, list size, or formula detail as an undisclosed
  consequence of selecting a quality preset.

Enforce actual GPU/codec dimension limits and estimated storage budgets before
launching. Warn on long or large jobs; do not allocate all raw frames in memory.
One 1080p RGBA frame is approximately 8.3 MB; 300 such frames are about 2.49 GB
before compression. GPU render targets and encoder buffers add overhead.

## 6. Delivery Stages and Tests

1. **Baseline and persistent renderer:** measure input latency, validation time,
   shader generation/compile time, actual frame completion, and cache hits/misses.
   Preserve the canvas through UI-only changes; test lossless editor behaviour.
2. **Compiler isolation and incremental caches:** move expensive work into workers,
   use revisioned results, and introduce dependency-aware caches without changing
   evaluation semantics. Re-run all CPU/GLSL and sample round-trip regressions.
3. **Background renderer and scheduling:** feature detection, old-image retention,
   async shader completion, preview budgeting, and cancellation/context recovery.
4. **Shared clock and snapshot rendering:** exact-time frame generation, point and
   label overlays, independently testable bounds, and stable random behaviour.
5. **Video panel and encoding:** menu labels/visibility, per-clock starts, duration,
   quality, codec support, preflight estimates, progress, export, and cancellation.
6. **Release verification:** browsers, mobile, long jobs, memory/storage pressure,
   documentation/tutorial updates, versioned links, CI, and live-site verification.

Acceptance checks:

- Sustained typing, selection, undo, and scrolling during a cloud/recursion compile:
  target p95 input-to-paint below 50 ms on the designated test machine. Record
  hardware, graph, resolution, and unavoidable shared-GPU outliers.
- Comments, folders, search, tab changes, and colour-only UI controls do not rebuild
  unaffected GPU programs. Pure time changes do not regenerate GLSL.
- Stale worker results never replace newer graph state or diagnostic flags.
- Broken edits retain the previous image with a clear stale/error indication;
  valid independent layers retain existing error-isolation behaviour.
- Edit-cancel-retry, context loss, cache eviction, worker restart, and disposal do
  not leak contexts, programs, frame buffers, or retained graph snapshots.
- Export a 10-second 30 FPS graph whose preview is slow: 300 frames, correct
  timestamps, correct duration, and no timing derived from render throughput.
- Check multiple starts, speeds, negative/zero rates, bounce/wrap endpoints,
  large unbounded values, dependent clocks, and frame-rate independence.
- Source frames are deterministic within a backend; decoded lossy video is checked
  with a tolerance, not a byte-identical image assertion.
- Bounds/aspect remain stable across sidebar resizing, DPR, pan/zoom, and mobile.
- Points, labels, transparency, colours, and fixed-seed random behaviour match
  direct snapshot renders at the same timestamp.
- Peak buffered frame count stays bounded as duration increases; encoded output
  storage is streamed or budgeted separately.
- Unsupported codecs, quota exhaustion, encoder failure, and background suspension
  produce useful feedback and preserve graph data.
- Opening/cancelling export does not alter saved starts, editor drafts, undo history,
  source text, folder order, or playback state unexpectedly.

## References

- [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [WebCodecs queue/resource management](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Using_the_WebCodecs_API)
- [Codec capability checks](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)
- [Mediabunny](https://mediabunny.dev/)
