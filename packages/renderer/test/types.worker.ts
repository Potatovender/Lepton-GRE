import { prepareFrame, renderFrameAsync, renderFrame, disposeRenderer,
  type RenderOptions, type RenderResult, type PreparationControls, type RenderControls, type RendererCanvas } from "../src/index.js";

const canvas = new OffscreenCanvas(1, 1) satisfies RendererCanvas;
const options: RenderOptions = {
  width: 128, height: 128, bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
  shaderKey: "example", fragmentSource: "void main(){gl_FragColor=vec4(1.0);}", floats: { u_time: 0 }
};
const controls: PreparationControls = { signal: new AbortController().signal, isCurrent: () => true, pollIntervalMs: 0 };
const prepared: RenderResult = await prepareFrame(canvas, options, controls);
const rendered: RenderResult = await renderFrameAsync(canvas, options, controls);
const interactive: RenderControls = { ...controls, maxBatchPixels: 16384, yieldIntervalMs: 0, gpuTimeoutMs: 10000 };
await renderFrameAsync(canvas, options, interactive);
if (prepared.supported && rendered.supported) canvas.transferToImageBitmap().close();
const capture: RenderResult = renderFrame(canvas, { ...options, synchronous: true });
void capture;
disposeRenderer(canvas, { loseContext: true });
