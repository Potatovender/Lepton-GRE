let activeExport = null;

export function exportPhoto(scene, name) {
  if (activeExport) return activeExport;
  const job = new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./photo-worker.js?v=20260917-responsive-video", import.meta.url), { type: "module" });
    const finish = (error) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(new Error("Photo export took too long. Try simplifying the graph.")), 120_000);
    worker.onerror = (event) => finish(new Error(event.message || "Photo export worker failed"));
    worker.onmessage = ({ data }) => {
      if (data.message) { finish(new Error(data.message)); return; }
      const url = URL.createObjectURL(data.blob);
      const link = document.createElement("a"); link.href = url; link.download = `${name}.png`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      finish();
    };
    try { worker.postMessage({ scene }); }
    catch (error) { finish(error); }
  });
  activeExport = job.finally(() => { activeExport = null; });
  return activeExport;
}
