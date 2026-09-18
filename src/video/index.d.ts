export type VideoOptions = Readonly<{
  width: number;
  height: number;
  fps: number;
  duration: number;
  format: "mp4" | "webm";
  /** Bits per second, not bytes per second. */
  bitrate: number;
  maxFramesInFlight?: number;
  keyFrameInterval?: number;
}>;

export type NormalizedVideoOptions = Required<VideoOptions> & Readonly<{
  durationUs: number;
  frameCount: number;
  workingBytes: number;
}>;

export type VideoFrameTiming = Readonly<{
  index: number;
  timeSeconds: number;
  timestampUs: number;
  durationUs: number;
  durationSeconds: number;
}>;

export type RenderFrame = (timeSeconds: number, context: VideoFrameTiming & Readonly<{
  width: number;
  height: number;
  signal?: AbortSignal;
}>) => HTMLCanvasElement | OffscreenCanvas | VideoFrame | Promise<HTMLCanvasElement | OffscreenCanvas | VideoFrame>;

export type VideoProgress = Readonly<{
  phase: "preparing" | "rendering" | "finalizing" | "complete" | "cancelled" | "failed";
  completedFrames: number;
  totalFrames: number;
  fraction: number;
  elapsedSeconds: number;
  framesPerSecond: number | null;
  /** Rendering ETA; preparing/finalizing have unknown remaining time. */
  etaSeconds: number | null;
  bytesWritten: number;
  estimatedBytes: number;
}>;

export type PositionedVideoWrite = { type: "write"; position: number; data: Uint8Array };
export type VideoTarget = Readonly<{
  kind?: "blob" | "arraybuffer";
  maxBytes?: number;
  /** FileSystemWritableFileStream-compatible positioned writes, not append-only byte chunks. */
  writable?: WritableStream<PositionedVideoWrite>;
}>;

export type ExportVideoRequest = Readonly<{
  options: VideoOptions;
  renderFrame: RenderFrame;
  signal?: AbortSignal;
  onProgress?: (progress: VideoProgress) => void;
  target?: VideoTarget;
}>;

export type VideoExportResult = Readonly<{
  data: Blob | ArrayBuffer | null;
  mimeType: "video/mp4" | "video/webm";
  extension: "mp4" | "webm";
  codec: "avc" | "vp9" | "vp8";
  bytes: number;
  frameCount: number;
  duration: number;
  options: NormalizedVideoOptions;
  timings: Readonly<{ setupSeconds: number; frameSeconds: number; finalizationSeconds: number; totalSeconds: number }>;
}>;

export type VideoSizeEstimate = Readonly<{
  approximate: number;
  conservative: number;
  range: readonly [number, number];
}>;

export type VideoEstimate = Readonly<{
  approximate: true;
  seconds: number;
  secondsRange: readonly [number, number];
  outputBytes: VideoSizeEstimate;
  frameCount: number;
  sampleIndices: readonly number[];
  sampleSeconds: number;
  secondsPerFrame: number;
  codec: "avc" | "vp9" | "vp8";
  note: string;
}>;

export type VideoSupport = Readonly<{
  supported: true;
  format: "mp4" | "webm";
  codec: "avc" | "vp9" | "vp8";
  config: Readonly<VideoEncoderConfig>;
}> | Readonly<{
  supported: false;
  format: "mp4" | "webm";
  reason: string;
  details?: readonly string[];
}>;

export type VideoExporter = Readonly<{
  exportVideo(request: ExportVideoRequest): Promise<VideoExportResult>;
  estimateVideo(request: Omit<ExportVideoRequest, "target"> & { sampleCount?: number }): Promise<VideoEstimate>;
  checkSupport(options: VideoOptions, context?: { signal?: AbortSignal }): Promise<VideoSupport>;
}>;

/** Mediabunny's locally bundled namespace; dependency injection keeps this API build-system independent. */
export function createVideoExporter(mediabunny: object, platform?: {
  VideoEncoder?: typeof VideoEncoder;
  VideoFrame?: typeof VideoFrame;
  WritableStream?: typeof WritableStream;
  Blob?: typeof Blob;
  now?: () => number;
  yieldToHost?: () => Promise<void>;
}): VideoExporter;
export function probeVideoSupport(options: VideoOptions, platform?: {
  VideoEncoder?: typeof VideoEncoder;
  VideoFrame?: typeof VideoFrame;
  signal?: AbortSignal;
}): Promise<VideoSupport>;
export function normalizeVideoOptions(options: VideoOptions): NormalizedVideoOptions;
export function frameTiming(options: NormalizedVideoOptions, index: number): VideoFrameTiming;
export function estimateOutputBytes(options: VideoOptions & { frameCount: number }): VideoSizeEstimate;
export const VIDEO_LIMITS: Readonly<Record<"memoryBytes" | "maximumMemoryBytes" | "streamBytes" | "frameWorkingBytes" | "encodedQueueBytes" | "maximumFrames" | "maximumDimension", number>>;
export class VideoExportError extends Error { readonly code: string; constructor(code: string, message: string, options?: ErrorOptions); }
