import { estimateOutputBytes, frameTiming, normalizeVideoOptions, validateOutputTarget,
  VIDEO_LIMITS, VideoExportError } from "./options.js";
import { requireVideoSupport, probeVideoSupport } from "./capabilities.js";
import { createOutputStorage } from "./output.js";

function abortError() { return new DOMException("Video export was cancelled.", "AbortError"); }
function closeFrame(value, Frame) { if (value instanceof Frame) value.close(); }

/**
 * Inject a locally bundled Mediabunny module (tested against 1.58.0). No DOM, CDN, graph state,
 * frame recording, or implicit renderer is used here. Platform injection supports isolated tests.
 */
export function createVideoExporter(mediabunny, platform = {}) {
  const { Output, StreamTarget, Mp4OutputFormat, WebMOutputFormat, EncodedVideoPacketSource, EncodedPacket } = mediabunny;
  for (const dependency of [Output, StreamTarget, Mp4OutputFormat, WebMOutputFormat, EncodedVideoPacketSource, EncodedPacket]) {
    if (typeof dependency !== "function") throw new TypeError("A complete Mediabunny module is required.");
  }
  const Encoder = platform.VideoEncoder ?? globalThis.VideoEncoder;
  const Frame = platform.VideoFrame ?? globalThis.VideoFrame;
  const now = platform.now ?? (() => performance.now());
  const yieldToHost = platform.yieldToHost ?? (() => new Promise((resolve) => setTimeout(resolve, 0)));
  const checkSupport = (options, { signal } = {}) => probeVideoSupport(options, { VideoEncoder: Encoder, VideoFrame: Frame, signal });

  async function exportVideo({ options: input, renderFrame, signal, onProgress, target: targetInput } = {}) {
    // Capture settings synchronously, before the first asynchronous operation.
    const options = normalizeVideoOptions(input);
    if (typeof renderFrame !== "function") throw new TypeError("renderFrame(timeSeconds) is required.");
    const target = validateOutputTarget(options, targetInput);
    const started = now();
    const mimeType = options.format === "mp4" ? "video/mp4" : "video/webm";
    let output, storage, encoder, source, failure, encodingStarted, renderingFinished;
    let completed = 0;
    let queuedBytes = 0;
    let pendingPackets = Promise.resolve();
    const pendingTimings = new Map();
    let rejectFailure;
    const failurePromise = new Promise((_, reject) => { rejectFailure = reject; });
    failurePromise.catch(() => {});
    const fail = (error) => {
      if (!failure) {
        failure = error instanceof Error ? error : new Error(String(error));
        rejectFailure(failure);
        if (encoder?.state !== "closed") encoder?.close();
      }
    };
    const abort = () => fail(abortError());
    signal?.addEventListener("abort", abort, { once: true });
    const guard = async (work) => {
      if (signal?.aborted) abort();
      if (failure) throw failure;
      return Promise.race([work, failurePromise]);
    };
    const progress = (phase) => {
      const elapsedSeconds = Math.max(0, (now() - started) / 1000);
      const throughput = completed && encodingStarted !== undefined ? completed / Math.max(0.001, (now() - encodingStarted) / 1000) : null;
      onProgress?.(Object.freeze({ phase, completedFrames: completed, totalFrames: options.frameCount,
        fraction: phase === "complete" ? 1 : completed / options.frameCount,
        elapsedSeconds, framesPerSecond: throughput,
        etaSeconds: phase === "complete" ? 0 : phase === "rendering" && throughput ? (options.frameCount - completed) / throughput : null,
        bytesWritten: storage?.size ?? 0, estimatedBytes: estimateOutputBytes(options).approximate }));
    };
    const drain = async () => {
      await guard(encoder.flush());
      await guard(pendingPackets);
      if (pendingTimings.size) {
        throw new VideoExportError("MISSING_FRAMES", "The video encoder dropped frames; no incomplete video will be returned.");
      }
      progress("rendering");
      await guard(yieldToHost());
    };

    try {
      if (signal?.aborted) abort();
      if (failure) throw failure;
      progress("preparing");
      const support = await guard(requireVideoSupport(options, { VideoEncoder: Encoder, VideoFrame: Frame, signal }));
      storage = createOutputStorage(target, mimeType, platform);
      source = new EncodedVideoPacketSource(support.codec);
      // No frameRate metadata: Mediabunny would snap a shortened last frame to a full frame.
      // Avoid fastStart:'in-memory', which buffers another complete copy of every packet.
      output = new Output({
        format: options.format === "mp4" ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat(),
        target: new StreamTarget(storage.stream, { chunked: true, chunkSize: 1024 * 1024 }),
      });
      output.addVideoTrack(source, { maximumPacketCount: options.frameCount, bitrate: options.bitrate });
      encoder = new Encoder({
        error: (error) => fail(new VideoExportError("ENCODER_FAILED", `The video encoder failed: ${error.message}`, { cause: error })),
        output: (chunk, metadata) => {
          if (failure) return;
          try {
            const timing = pendingTimings.get(chunk.timestamp);
            if (!timing) throw new VideoExportError("INVALID_TIMESTAMP", "The encoder returned an unexpected or duplicate frame timestamp.");
            pendingTimings.delete(chunk.timestamp);
            if (queuedBytes + chunk.byteLength > VIDEO_LIMITS.encodedQueueBytes) {
              throw new VideoExportError("ENCODED_QUEUE_LIMIT", "An encoded frame exceeded the queue budget. Lower the resolution or bitrate.");
            }
            queuedBytes += chunk.byteLength;
            const bytes = new Uint8Array(chunk.byteLength);
            chunk.copyTo(bytes);
            // Some encoders omit duration, so keep our original exact frame interval.
            // WebM uses millisecond timestamps. Quantize adjacent endpoints together, not duration
            // independently, so its declared container end matches the rounded requested end.
            const timestamp = options.format === "webm" ? Math.round(timing.timestampUs / 1000) / 1000 : timing.timestampUs / 1e6;
            const duration = options.format === "webm"
              ? (Math.round((timing.timestampUs + timing.durationUs) / 1000) - Math.round(timing.timestampUs / 1000)) / 1000
              : timing.durationSeconds;
            const packet = new EncodedPacket(bytes, chunk.type, timestamp, duration);
            pendingPackets = pendingPackets.then(async () => {
              if (failure) return;
              try {
                await source.add(packet, metadata);
                completed++;
              } finally { queuedBytes -= bytes.byteLength; }
            });
            pendingPackets.catch(fail);
          } catch (error) { fail(error); }
        },
      });
      encoder.configure(support.config);
      await guard(output.start());
      encodingStarted = now();
      progress("rendering");
      let lastKeyTime = -Infinity;
      for (let index = 0; index < options.frameCount; index++) {
        if (failure) throw failure;
        const timing = frameTiming(options, index);
        let image, frame;
        try {
          const rendered = Promise.resolve().then(() => renderFrame(timing.timeSeconds,
            Object.freeze({ ...timing, signal, width: options.width, height: options.height })));
          // A cancelled renderer may resolve later. Close transferred frames even after we stop awaiting it.
          rendered.then((value) => { if (failure) closeFrame(value, Frame); }, () => {});
          image = await guard(rendered);
          const width = image instanceof Frame ? image.displayWidth : image?.width;
          const height = image instanceof Frame ? image.displayHeight : image?.height;
          if (width !== options.width || height !== options.height) {
            throw new VideoExportError("FRAME_DIMENSIONS", `renderFrame returned ${width} x ${height}; expected ${options.width} x ${options.height}.`);
          }
          frame = new Frame(image, { timestamp: timing.timestampUs, duration: timing.durationUs, alpha: "discard" });
          pendingTimings.set(timing.timestampUs, timing);
          const keyFrame = timing.timeSeconds - lastKeyTime >= options.keyFrameInterval;
          if (keyFrame) lastKeyTime = timing.timeSeconds;
          encoder.encode(frame, { keyFrame });
        } finally {
          frame?.close();
          if (image) closeFrame(image, Frame);
        }
        // Flush small batches to bound BOTH native encoder input and asynchronous muxer output.
        if ((index + 1) % options.maxFramesInFlight === 0 || index === options.frameCount - 1) await drain();
      }
      renderingFinished = now();
      source.close();
      encoder.close();
      progress("finalizing");
      await guard(output.finalize());
      if (completed !== options.frameCount) throw new VideoExportError("MISSING_FRAMES", "The export has missing frames.");
      const data = await guard(storage.complete());
      progress("complete");
      return Object.freeze({ data, mimeType, extension: options.format, codec: support.codec,
        bytes: storage.size, frameCount: completed, duration: options.durationUs / 1e6, options,
        timings: Object.freeze({ setupSeconds: (encodingStarted - started) / 1000,
          frameSeconds: (renderingFinished - encodingStarted) / 1000,
          finalizationSeconds: (now() - renderingFinished) / 1000, totalSeconds: (now() - started) / 1000 }) });
    } catch (error) {
      fail(error);
      // Abort the actual file writer, not just the muxer's wrapper, to avoid committing partial files.
      await Promise.allSettled([storage?.abort(failure), output?.cancel()]);
      try { progress(failure.name === "AbortError" ? "cancelled" : "failed"); } catch { /* Preserve the original error. */ }
      throw failure;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (encoder && encoder.state !== "closed") encoder.close();
      pendingTimings.clear();
    }
  }

  /** Samples the real render+encode+finalize path, but discards the resulting small video. */
  async function estimateVideo({ options: input, renderFrame, signal, onProgress, sampleCount = 6 } = {}) {
    const options = normalizeVideoOptions(input);
    if (typeof renderFrame !== "function") throw new TypeError("renderFrame(timeSeconds) is required.");
    if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 16) throw new RangeError("Estimate sample count must be between 2 and 16.");
    const count = Math.min(sampleCount, options.frameCount);
    const indices = Array.from({ length: count }, (_, i) => count === 1 ? 0 : Math.round(i * (options.frameCount - 1) / (count - 1)));
    const renderTimes = [];
    const result = await exportVideo({
      options: { ...options, duration: count / options.fps }, signal, onProgress,
      target: { kind: "blob", maxBytes: VIDEO_LIMITS.maximumMemoryBytes },
      renderFrame: async (_time, context) => {
        const timing = frameTiming(options, indices[context.index]);
        const start = now();
        try { return await renderFrame(timing.timeSeconds, Object.freeze({ ...context, ...timing })); }
        finally { renderTimes.push((now() - start) / 1000); }
      },
    });
    // Treat the first sample's excess cost as one-off shader/setup work rather than multiplying it by N.
    const sorted = renderTimes.slice(1).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : renderTimes[0];
    const warmup = Math.max(0, renderTimes[0] - median);
    const secondsPerFrame = Math.max(0.000001, (result.timings.frameSeconds - warmup) / count);
    const fixedSeconds = warmup + result.timings.setupSeconds + result.timings.finalizationSeconds;
    const seconds = fixedSeconds + secondsPerFrame * options.frameCount;
    return Object.freeze({ approximate: true, seconds, secondsRange: Object.freeze([Math.max(fixedSeconds, seconds * 0.65), seconds * 1.75]),
      outputBytes: estimateOutputBytes(options), frameCount: options.frameCount,
      sampleIndices: Object.freeze(indices), sampleSeconds: result.timings.totalSeconds,
      secondsPerFrame, codec: result.codec,
      note: "Estimate includes sample rendering, encoding, and finalization. GPU contention, thermal throttling, and time-dependent graph complexity can change the result." });
  }

  return Object.freeze({ exportVideo, estimateVideo, checkSupport });
}
