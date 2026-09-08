export interface Bounds { xMin: number; xMax: number; yMin: number; yMax: number; }
export interface RenderOptions {
  width: number;
  height: number;
  dpr?: number;
  bounds: Bounds;
  clipBounds?: Bounds | null;
  background?: [number, number, number];
  floats?: Record<string, number>;
  shaderKey: string;
  fragmentSource: string | (() => string);
  maxSourceLength?: number;
  synchronous?: boolean;
}
export interface RenderResult { supported: boolean; compiled: boolean; compileMs: number; source: string; }
export const MAX_FRAGMENT_CHARACTERS: number;
export class RendererError extends Error { source: string; constructor(message: string, source?: string); }
export function renderFrame(canvas: HTMLCanvasElement | OffscreenCanvas, options: RenderOptions): RenderResult;
export function disposeRenderer(canvas: HTMLCanvasElement | OffscreenCanvas, options?: { loseContext?: boolean }): void;
