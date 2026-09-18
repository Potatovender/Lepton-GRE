import { prepareFrame, renderFrameAsync, renderFrame, disposeRenderer,
  type RenderOptions, type RendererCanvas } from "../src/index.js";

const canvas = document.createElement("canvas") satisfies RendererCanvas;
const options: RenderOptions = {
  width: 128, height: 128, bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
  shaderKey: "example", fragmentSource: "void main(){gl_FragColor=vec4(1.0);}"
};
await prepareFrame(canvas, options);
await renderFrameAsync(canvas, options);
await renderFrameAsync(canvas, options, { maxBatchPixels: 65536, yieldIntervalMs: 0, gpuTimeoutMs: 10000 });
renderFrame(canvas, { ...options, synchronous: true });
disposeRenderer(canvas);
