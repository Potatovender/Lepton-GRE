import { SnapshotRenderer } from "../compiler/snapshot-renderer.js?v=20260917-responsive-video";
import { createSceneClock } from "../animation/scene-clock.js?v=20260917-responsive-video";
import { createVideoExporter } from "./exporter.js";
import * as mediabunny from "../libs/mediabunny/mediabunny.mjs";

const exporter = createVideoExporter(mediabunny);
let snapshot, renderer, active;
self.onmessage = async ({ data }) => {
  if (data.type === "cancel") { active?.abort(); return; }
  if (active) return;
  const controller = active = new AbortController();
  try {
    if (data.type === "initialize") {
      snapshot = structuredClone(data.scene);
      renderer?.dispose();
      renderer = new SnapshotRenderer();
      renderer.setScene(snapshot);
      const diagnostics = renderer.validate();
      const bounds = renderer.runtime.sceneViewport();
      const issue = renderer.runtime.viewportDiagnostic();
      if (issue.status === "invalid" || !renderer.runtime.isValidViewport(bounds)) throw new Error(issue.message);
      const times = renderer.runtime.timeVariableEntries().map(({ entry }) => ({ id: entry.id, start: entry.expression, mode: entry.timeMode, rate: entry.timeRate }));
      if (!times.length) throw new Error("This graph has no time variables to export. Add a time variable first.");
      self.postMessage({ type: "ready", bounds, times, diagnostics });
      return;
    }
    if (!snapshot) throw new Error("Open a graph before exporting");
    const scene = structuredClone(snapshot);
    renderer.setScene(scene);
    const bounds = renderer.runtime.sceneViewport();
    const clock = createSceneClock(scene, { starts: data.starts });
    const renderFrame = async (seconds) => {
      const values = await clock.valuesAtAsync(seconds, { signal: controller.signal });
      for (const entry of scene.functions) if (values.has(entry.id)) entry.expression = String(values.get(entry.id));
      const diagnostics = renderer.validate(true);
      if (diagnostics.hasErrors) throw new Error(`Cannot export incomplete graph: ${diagnostics.summary}`);
      const result = await renderer.render({ width: data.options.width, height: data.options.height,
        bounds, grid: data.grid, clockValues: true, interactive: true, signal: controller.signal });
      return result.canvas;
    };
    const method = data.type === "estimate" ? "estimateVideo" : "exportVideo";
    const result = await exporter[method]({ options: data.options, renderFrame, signal: controller.signal,
      onProgress: (progress) => self.postMessage({ type: "progress", progress }) });
    self.postMessage({ type: data.type === "estimate" ? "estimate" : "complete", result });
  } catch (error) {
    self.postMessage({ type: controller.signal.aborted ? "cancelled" : "error", message: error.message });
  } finally { active = null; }
};
