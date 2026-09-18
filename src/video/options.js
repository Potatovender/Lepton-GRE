/** Resource limits are deliberately conservative; streaming avoids the download buffer. */
export const VIDEO_LIMITS = Object.freeze({
  memoryBytes: 64 * 1024 ** 2,
  maximumMemoryBytes: 128 * 1024 ** 2,
  streamBytes: 2 * 1024 ** 3,
  frameWorkingBytes: 256 * 1024 ** 2,
  encodedQueueBytes: 32 * 1024 ** 2,
  maximumFrames: 300_000,
  maximumDimension: 8192,
});

export class VideoExportError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "VideoExportError";
    this.code = code;
  }
}

function numberInRange(value, name, min, max, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max
      || (integer && !Number.isSafeInteger(value))) {
    throw new VideoExportError("INVALID_OPTIONS", `${name} must be ${integer ? "an integer" : "a number"} from ${min} to ${max}.`);
  }
  return value;
}

/** Copies known primitive fields so edits to the caller's options cannot change an active job. */
export function normalizeVideoOptions(input) {
  if (!input || typeof input !== "object") throw new VideoExportError("INVALID_OPTIONS", "Video settings are required.");
  const width = numberInRange(input.width, "Width", 2, VIDEO_LIMITS.maximumDimension, true);
  const height = numberInRange(input.height, "Height", 2, VIDEO_LIMITS.maximumDimension, true);
  const fps = numberInRange(input.fps, "Frame rate", 0.1, 120);
  const duration = numberInRange(input.duration, "Duration", 0.000001, 3600);
  const bitrate = numberInRange(input.bitrate, "Bitrate", 10_000, 100_000_000, true);
  const maxFramesInFlight = numberInRange(input.maxFramesInFlight ?? 2, "Frames in flight", 1, 4, true);
  const keyFrameInterval = numberInRange(input.keyFrameInterval ?? 2, "Key frame interval", 0.1, 10);
  if (input.format !== "mp4" && input.format !== "webm") {
    throw new VideoExportError("INVALID_OPTIONS", "Choose MP4 or WebM for silent video export.");
  }
  if (input.format === "mp4" && (width % 2 || height % 2)) {
    throw new VideoExportError("INVALID_DIMENSIONS", "MP4 export requires even width and height. Adjust the dimensions; the exporter does not crop or stretch the graph.");
  }
  const durationUs = Math.round(duration * 1e6);
  const product = duration * fps;
  const nearest = Math.round(product);
  let frameCount = Math.ceil(Math.abs(product - nearest) <= Number.EPSILON * Math.max(1, product) * 8 ? nearest : product);
  // WebCodecs timestamps have microsecond precision. Do not append a zero-duration endpoint.
  if (frameCount > 1 && Math.round((frameCount - 1) * 1e6 / fps) >= durationUs) frameCount--;
  if (frameCount < 1 || frameCount > VIDEO_LIMITS.maximumFrames) {
    throw new VideoExportError("FRAME_LIMIT", `Export must contain between 1 and ${VIDEO_LIMITS.maximumFrames} frames. Reduce duration or frame rate.`);
  }
  const containerScale = input.format === "webm" ? 1000 : 57600;
  const lastStartSeconds = Math.round((frameCount - 1) * 1e6 / fps) / 1e6;
  if (Math.round(durationUs / 1e6 * containerScale) <= Math.round(lastStartSeconds * containerScale)) {
    throw new VideoExportError("TIMESTAMP_PRECISION", "The final frame is shorter than this video format can represent. Slightly adjust the duration or choose a duration that ends on a full frame.");
  }
  const workingBytes = width * height * 4 * (maxFramesInFlight + 2);
  if (workingBytes > VIDEO_LIMITS.frameWorkingBytes) {
    throw new VideoExportError("FRAME_MEMORY_LIMIT", "The requested frame size exceeds the export working-memory budget. Reduce resolution or frames in flight.");
  }
  return Object.freeze({ width, height, fps, duration, durationUs, frameCount, bitrate,
    format: input.format, maxFramesInFlight, keyFrameInterval, workingBytes });
}

/** No accumulated time deltas: each frame is independently located on the requested time grid. */
export function frameTiming(options, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= options.frameCount) {
    throw new RangeError("Video frame index is out of range.");
  }
  const timestampUs = Math.round(index * 1e6 / options.fps);
  const endUs = index === options.frameCount - 1 ? options.durationUs
    : Math.min(options.durationUs, Math.round((index + 1) * 1e6 / options.fps));
  return Object.freeze({ index, timeSeconds: index / options.fps, timestampUs,
    durationUs: endUs - timestampUs, durationSeconds: (endUs - timestampUs) / 1e6 });
}

/** VBR estimates are advisory; output targets also enforce their budget on every actual write. */
export function estimateOutputBytes(options) {
  const media = options.bitrate * options.duration / 8;
  const overhead = 65_536 + options.frameCount * 64;
  return Object.freeze({ approximate: Math.ceil(media + overhead),
    conservative: Math.ceil(media * 1.5 + overhead),
    range: Object.freeze([Math.ceil(media * 0.5 + overhead), Math.ceil(media * 1.5 + overhead)]) });
}

export function validateOutputTarget(options, target = {}) {
  const streaming = target.writable !== undefined;
  const maxBytes = numberInRange(target.maxBytes ?? (streaming ? VIDEO_LIMITS.streamBytes : VIDEO_LIMITS.memoryBytes),
    "Output byte budget", 1024, streaming ? VIDEO_LIMITS.streamBytes : VIDEO_LIMITS.maximumMemoryBytes, true);
  const kind = target.kind ?? "blob";
  if (!streaming && kind !== "blob" && kind !== "arraybuffer") {
    throw new VideoExportError("INVALID_OPTIONS", "In-memory output must be a Blob or ArrayBuffer.");
  }
  if (streaming && (!target.writable || typeof target.writable.getWriter !== "function" || target.writable.locked)) {
    throw new VideoExportError("INVALID_TARGET", "The export destination must be an unlocked writable stream accepting positioned writes.");
  }
  if (estimateOutputBytes(options).conservative > maxBytes) {
    throw new VideoExportError("OUTPUT_BUDGET", streaming
      ? "The estimated video exceeds the file export budget. Reduce duration, bitrate, or resolution."
      : "The estimated video is too large for an in-memory download. Choose a writable file destination or reduce duration or bitrate.");
  }
  return Object.freeze({ kind: streaming ? "stream" : kind, maxBytes, writable: target.writable });
}
