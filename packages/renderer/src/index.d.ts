export interface Bounds { xMin: number; xMax: number; yMin: number; yMax: number; }
/** Structural canvas API shared by HTMLCanvasElement and OffscreenCanvas, including worker-only TS projects. */
export interface RendererCanvas {
  width: number;
  height: number;
  /** Return type is broad to accept both DOM and OffscreenCanvas getContext overloads. */
  getContext(contextId: "webgl" | "webgl2", options?: WebGLContextAttributes): unknown;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}
export interface RenderOptions {
  width: number;
  height: number;
  dpr?: number;
  bounds: Bounds;
  clipBounds?: Bounds | null;
  background?: [number, number, number];
  floats?: Record<string, number>;
  /** Caller-owned semantic key: change whenever generated GLSL changes, not for uniform values. */
  shaderKey: string;
  /** Called only on cache misses. Generate expensive source in a compiler worker beforehand. */
  fragmentSource: string | (() => string);
  maxSourceLength?: number;
  /** Explicit readback barrier for renderFrame only. Async rendering always ignores this flag. */
  synchronous?: boolean;
}
export interface RenderResult {
  supported: boolean;
  /** False for a cached program, including one previously prepared without drawing. */
  compiled: boolean;
  /** Elapsed preparation time including polling/yields, not GPU draw/completion time. Zero on cache hits. */
  compileMs: number;
  source: string;
  /** Cooperative path only: number of scissor batches submitted. */
  batchCount?: number;
  /** Cooperative path only: elapsed draw/fence/yield wall time, not pure GPU timing. */
  drawMs?: number;
  /** Cooperative path only: slowest batch's draw/fence/yield wall time. */
  maxBatchMs?: number;
}
export interface PreparationControls {
  /** Cancellation rejects with an Error whose name is AbortError. */
  signal?: AbortSignal;
  /** Called before submission, between polls and before cache publication/drawing. False means stale. */
  isCurrent?: () => boolean;
  /** Milliseconds between completion polls; defaults to 8. Zero still yields a timer task. */
  pollIntervalMs?: number;
}
export interface RenderControls extends PreparationControls {
  /**
   * Opt-in cooperative full-resolution scissor draws. Absent means one draw (legacy/export default).
   * Positive integer physical pixels per batch, capped at 65536. A fresh renderer starts at <=16384 pixels;
   * WebGL 2 adapts within the ceiling toward 4 ms measured fence wall time, retaining context history.
   * No resampling or quality reduction.
   */
  maxBatchPixels?: number;
  /** Milliseconds yielded between batches/fence polls; default 0 uses MessageChannel tasks without timer clamping. */
  yieldIntervalMs?: number;
  /** WebGL 2 fence deadline per batch in milliseconds; defaults to 10000. Must be positive and finite. */
  gpuTimeoutMs?: number;
}
export const MAX_FRAGMENT_CHARACTERS: number;
/** Up to four ready programs plus one pending compilation per canvas/context. */
export const MAX_CACHED_PROGRAMS: number;
export class RendererError extends Error { source: string; constructor(message: string, source?: string); }
/** Synchronous compilation/drawing for legacy consumers and captures. Never finishes unless explicitly requested. */
export function renderFrame(canvas: RendererCanvas, options: RenderOptions): RenderResult;
/**
 * Prepare/cache without resizing or drawing. New async requests supersede earlier ones on this canvas.
 * Polls KHR_parallel_shader_compile when available; otherwise link-status checking may still block.
 * Rejects AbortError on cancellation/supersession/disposal and RendererError on GPU/validation failures.
 * An unavailable WebGL context returns supported: false. Use an OffscreenCanvas worker for isolation.
 */
export function prepareFrame(canvas: RendererCanvas, options: RenderOptions, controls?: PreparationControls): Promise<RenderResult>;
/**
 * Prepare then draw only if current. Never calls gl.finish(). By default only waits for submission.
 * With maxBatchPixels, WebGL 2 fences each batch before submitting the next; WebGL 1 flushes/yields only.
 * Tiled drawing can leave a partial private canvas on failure/cancellation: publish only on success.
 * The original scissor box/enable state is restored on success/error (except on context loss).
 * Supports internal worker OffscreenCanvas followed by transferToImageBitmap(); no DOM canvas transfer required.
 */
export function renderFrameAsync(canvas: RendererCanvas, options: RenderOptions, controls?: RenderControls): Promise<RenderResult>;
/** Cancel pending preparation/drawing, delete cached GPU resources/fences, and unregister context listeners. */
export function disposeRenderer(canvas: RendererCanvas, options?: { loseContext?: boolean }): void;
