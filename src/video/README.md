# Browser-local video export

The reusable `index.js` API owns **encoding and muxing only**. Its caller owns the immutable graph
snapshot, time-variable evaluation, compilation, rendering rectangle, point/label
overlays, GPU limits, fonts, and disposal of the snapshot renderer. It is safe to
import in a module worker. It does not touch the DOM or graph/editor state.
The app integration lives in `panel.js` and `scene-worker.js`: it supplies the frozen
scene and shared clock, and presents settings, progress, cancellation and downloads.
Minimizing the panel lets the editor continue; reopening Export video restores the
existing job instead of launching a second one. The current UI uses bounded Blob
downloads, not the streaming API described below.

## Integration

```js
import * as mediabunny from "./libs/mediabunny/mediabunny.mjs";
import { createVideoExporter } from "./video/index.js";

const video = createVideoExporter(mediabunny);
const options = {
  width: 1920, height: 1080, fps: 30, duration: 10,
  format: "mp4", bitrate: 8_000_000,
};
const result = await video.exportVideo({
  options,
  renderFrame: (seconds, { signal }) => snapshotRenderer.render(seconds, signal),
  signal: controller.signal,
  onProgress: (progress) => postMessage({ type: "progress", progress }),
});
// result.data is a Blob by default. The caller offers the download and revokes its URL.
```

`checkSupport(options)` checks the exact codec, dimensions, bitrate, and frame rate.
Unsupported formats return a reason; exporting them throws `UNSUPPORTED_CODEC`.
Actual encoder failure remains possible after a successful capability probe.
There is no MediaRecorder or CPU image-rendering fallback.

`estimateVideo({ options, renderFrame, signal, onProgress, sampleCount: 6 })`
renders samples spread across the requested interval, encodes and finalizes a
small temporary video, and discards it. It returns a time range and approximate
file-size range. Use a dedicated/reset snapshot renderer for estimation: its
sampled times jump forward and a subsequent export starts again at zero. The
render callback must evaluate the supplied absolute time, never wall-clock time.

The options are copied and frozen before asynchronous work begins. A canvas
returned by `renderFrame` remains owned by the caller and may be reused on the
next call. A returned `VideoFrame` transfers ownership: the exporter retimestamps
and closes it, including frames that resolve after cancellation. The renderer
must honor the supplied AbortSignal where possible; this package cannot preempt
GPU instructions or synchronous work inside the callback.

## Output and safety

- Default: `target: { kind: "blob" }`, with a conservative 64 MiB encoded-output
  budget. `kind: "arraybuffer"` is also supported. `maxBytes` can be explicitly
  raised to at most 128 MiB for in-memory jobs. Estimates are checked before
  rendering and actual output writes are checked before allocation.
- Streaming: `target: { writable }`, where writable accepts
  `{type: "write", position, data}` (the File System Access API contract). Pass
  an unlocked, newly created writable stream. The caller owns it until successful
  capability preflight; after acquisition the exporter closes it on success or
  aborts it on failure/cancel. Streaming defaults to a 2 GiB safety cap, and
  `maxBytes` can lower that limit. **Do not concatenate chunks**: headers are
  rewritten at specific byte positions. Transferable streams can cross workers
  where supported; otherwise the parent must bridge positioned writes with
  acknowledgement/backpressure or use the bounded Blob path.
- Only the exporter commits the actual destination, after the muxer has finalized.
  Mediabunny's cancellation closes its wrapper but does not commit a partial file.
  A failed/cancelled file may need deletion by the caller depending on the storage
  provider; File System Access writable transactions preserve the prior file.
- Two frames per encode/flush batch by default, configurable from one to four.
  Both the native encoder queue and the async muxer queue are drained between
  batches. Frames are closed promptly and unexpected/missing encoded frames fail
  the job. A 32 MiB compressed queue and conservative 256 MiB frame-working budget
  are enforced in addition to the output budget. Native codec/GPU overhead is
  device-dependent and cannot be strictly bounded by JavaScript alone.
- At most 300,000 frames, 120 FPS, 1 hour, 8192 pixels per dimension, and 100 Mbps.
  The working-memory budget and actual codec/GPU limits can be stricter. MP4
  dimensions must be even; no implicit crop, stretch, or scene-detail reduction.
- Output is silent video with alpha discarded after the caller's composition.
  No alpha-channel video, audio, GIF, or server upload is implemented.

Frame `i` renders at `i / fps`. WebCodecs timestamps use rounded microseconds with
adjacent endpoints, and the final frame is shortened to the requested duration.
The muxer is not given `frameRate` metadata, which would re-quantize that shortened
frame. MP4 is seekable ordinary MP4 (`fastStart: false`), not a fragmented stream;
WebM is seekable. MP4's track timebase has 57,600 ticks/second in Mediabunny 1.58.0;
WebM timestamps use milliseconds, so container timing is quantized accordingly.
A final interval below the container's timing precision is rejected rather than
encoded as a zero-duration frame. WebM intervals use adjacent rounded endpoints
to avoid independent timestamp/duration rounding changing the file's end time.
WebM stores the final hold in Segment duration, not individual SimpleBlock
duration. The browser tests verify actual player duration and final-frame pixels.

Progress phases: `preparing`, `rendering`, `finalizing`, `complete`, `cancelled`,
`failed`. `completedFrames` counts packets accepted by the muxer, not just render
submissions. ETA covers remaining rendering/encoding; finalization reports an
unknown ETA. Cancellation throws an `AbortError`. Progress callbacks should not
throw. Export finalization or cancellation may wait for a storage operation already
in flight; the browser may suspend background tabs.

## Files and tests

- `options.js`: immutable settings, frame timing, resource limits, size estimates.
- `capabilities.js`: exact-setting WebCodecs probes and codec selection.
- `output.js`: budgeted random-access memory/file output and cleanup.
- `exporter.js`: render/encode/mux coordination, cancellation, ETA, benchmarking.
- `index.js` / `index.d.ts`: public API and TypeScript contract.

```sh
node --test tests/video-export.test.mjs
node tests/video-export-browser.mjs
```

The browser check uses installed Playwright Chromium by default. Environment
overrides: `LEPTON_TEST_BROWSER=webkit`, `LEPTON_BROWSER_EXECUTABLE=/path/to/chrome`,
and `LEPTON_MEDIABUNNY_BUNDLE=/path/to/mediabunny.mjs`. It runs an isolated local
fixture and encodes, demuxes, decodes, seeks, streams, cancels, and benchmarks actual
MP4/WebM exports, including a worker/OffscreenCanvas export. It never opens or
changes a saved graph. The dependency is pinned to the unmodified Mediabunny
1.58.0 ES bundle; `src/libs/mediabunny/vendor.json` records source and hashes, and
the upstream MPL-2.0 license is included alongside the bundle.
