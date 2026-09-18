import { SnapshotRenderer } from "./snapshot-renderer.js?v=20260917-responsive-video";

self.onmessage = async ({ data }) => {
  const renderer = new SnapshotRenderer();
  try {
    renderer.setScene(data.scene);
    const diagnostics = renderer.validate();
    if (diagnostics.hasErrors) throw new Error(`Cannot export incomplete graph: ${diagnostics.summary}`);
    const bounds = renderer.runtime.sceneViewport();
    if (!renderer.runtime.isValidViewport(bounds)) throw new Error("Photo export needs valid settings bounds");
    const ratio = (bounds.xMax - bounds.xMin) / (bounds.yMax - bounds.yMin);
    const edge = 1600;
    const width = Math.max(1, Math.round(ratio >= 1 ? edge : edge * ratio));
    const height = Math.max(1, Math.round(ratio >= 1 ? edge / ratio : edge));
    const result = await renderer.render({ width, height, bounds, grid: false, interactive: true });
    const blob = await result.canvas.convertToBlob({ type: "image/png" });
    self.postMessage({ blob });
  } catch (error) { self.postMessage({ message: error.message }); }
  finally { renderer.dispose(); }
};
