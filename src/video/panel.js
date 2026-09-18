import { normalizeVideoOptions, estimateOutputBytes, VIDEO_LIMITS } from "./options.js";
import { probeVideoSupport } from "./capabilities.js";

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const seconds = (value) => value < 60 ? `${Math.ceil(value)} seconds` : `${Math.ceil(value / 60)} minutes`;
const mb = (bytes) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;
let activePanel = null;

/** Owns an immutable scene snapshot; closing the panel cancels and frees its worker. */
export function openVideoPanel({ scene, name = "Lepton", onClose }) {
  if (activePanel) { activePanel.show(); return activePanel; }
  const dialog = document.createElement("dialog");
  dialog.className = "video-export-dialog";
  dialog.setAttribute("aria-labelledby", "video-export-title");
  dialog.innerHTML = `<form method="dialog">
    <header><h2 id="video-export-title">Export video</h2><div><button type="button" data-minimize aria-label="Minimize video export" title="Continue editing">&minus;</button> <button type="button" data-close aria-label="Close video export">&times;</button></div></header>
    <p data-message role="status">Preparing graph...</p>
    <fieldset disabled>
      <legend>Timeline</legend>
      <div data-time-starts></div>
      <div class="video-export-row">
        <label>Duration (seconds)<input name="duration" type="number" min="0.01" max="3600" step="0.1" value="10" required></label>
        <label>Frames per second<select name="fps"><option>24</option><option selected>30</option><option>60</option><option value="custom">Custom</option></select></label>
        <label data-custom-fps hidden>Custom frame rate<input name="customFps" type="number" min="0.1" max="120" step="0.1" value="30"></label>
      </div>
      <legend>Picture</legend>
      <div class="video-export-row">
        <label>Resolution<select name="resolution"><option value="720">720 px long edge</option><option value="1080" selected>1080 px long edge</option><option value="2160">2160 px long edge</option><option value="custom">Custom long edge</option></select></label>
        <label data-custom hidden>Long edge (pixels)<input name="edge" type="number" min="2" max="8192" step="2" value="1080"></label>
      </div>
      <div class="video-export-row">
        <label>Compression<select name="quality"><option value="compact">Compact</option><option value="balanced" selected>Balanced</option><option value="high">High quality</option></select></label>
        <label>Format<select name="format"><option value="mp4">MP4</option><option value="webm">WebM</option></select></label>
      </div>
      <label class="video-grid-option"><input name="grid" type="checkbox"> Include coordinate grid</label>
      <p data-size></p>
      <p data-estimate>Run an estimate to measure this graph on your device.</p>
      <footer><button type="button" data-estimate-button>Estimate</button><button type="button" class="primary" data-export>Export video</button></footer>
    </fieldset>
    <div class="video-export-progress" hidden><progress max="1" value="0"></progress><p data-progress role="status"></p><button type="button" data-cancel>Cancel</button></div>
  </form>`;
  document.body.append(dialog);
  const restore = document.createElement("button");
  restore.type = "button"; restore.className = "video-export-restore"; restore.textContent = "Video export"; restore.hidden = true;
  document.body.append(restore);
  let menuPopover, menuVisibility;
  const show = () => {
    if (dialog.open) return;
    if (document.activeElement?.closest(".graph-actions-menu")) document.activeElement.blur();
    // Modal inertness can leave :hover on the opener until the pointer moves.
    menuPopover = document.querySelector(".graph-actions-popover");
    menuVisibility = menuPopover?.style.visibility;
    if (menuPopover) menuPopover.style.visibility = "hidden";
    restore.hidden = true;
    dialog.showModal();
  };
  const dismiss = (focusTarget) => {
    dialog.close();
    // Do not let native dialog focus restoration reopen the Graph menu.
    focusTarget?.focus({ preventScroll: true });
    if (menuPopover) menuPopover.style.visibility = menuVisibility;
    menuPopover = null;
  };
  const editorFocusTarget = () => document.querySelector('[data-display-mode][aria-selected="true"]');
  restore.onclick = show;
  const form = dialog.querySelector("form"), fieldset = dialog.querySelector("fieldset");
  const message = dialog.querySelector("[data-message]");
  let worker;
  try { worker = new Worker(new URL("./scene-worker.js?v=20260917-responsive-video", import.meta.url), { type: "module" }); }
  catch (error) {
    message.textContent = `Video export is unavailable: ${error.message}`;
    restore.remove();
    dialog.querySelector("[data-minimize]").remove();
    const close = () => { dismiss(editorFocusTarget()); dialog.remove(); onClose?.(); };
    dialog.querySelector("[data-close]").onclick = close;
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    show();
    return { close };
  }
  let bounds, busy = false, closed = false, supported = false, checkRevision = 0, cancelTimer, probeKey;
  const value = (key) => form.elements.namedItem(key).value;
  const options = () => {
    if (!bounds) throw new Error("Graph is still preparing");
    const edge = Number(value("resolution") === "custom" ? value("edge") : value("resolution"));
    const ratio = (bounds.xMax - bounds.xMin) / (bounds.yMax - bounds.yMin);
    const even = (number) => Math.max(2, Math.round(number / 2) * 2);
    const width = even(ratio >= 1 ? edge : edge * ratio), height = even(ratio >= 1 ? edge / ratio : edge);
    const fps = Number(value("fps") === "custom" ? value("customFps") : value("fps"));
    const bpp = { compact: 0.065, balanced: 0.12, high: 0.22 }[value("quality")];
    return normalizeVideoOptions({ width, height, fps, duration: Number(value("duration")),
      bitrate: Math.max(100_000, Math.round(width * height * fps * bpp)), format: value("format") });
  };
  const setBusy = (next) => {
    busy = next; fieldset.disabled = next;
    dialog.querySelector(".video-export-progress").hidden = !next;
    dialog.querySelector("[data-export]").disabled = !supported;
    dialog.querySelector("[data-estimate-button]").disabled = !supported;
  };
  const close = () => {
    if (closed) return;
    if (busy && !window.confirm("Cancel this video export?")) return;
    closed = true; clearTimeout(cancelTimer); worker.terminate(); dismiss(editorFocusTarget()); dialog.remove(); restore.remove(); activePanel = null; onClose?.();
  };
  const refresh = async () => {
    if (!bounds || busy) return;
    let revision;
    dialog.querySelector("[data-custom]").hidden = value("resolution") !== "custom";
    dialog.querySelector("[data-custom-fps]").hidden = value("fps") !== "custom";
    dialog.querySelector("[data-estimate]").textContent = "Run an estimate to measure these settings on your device.";
    try {
      const config = options(), bytes = estimateOutputBytes(config);
      const nextProbeKey = JSON.stringify(config);
      // Start values and duplicate blur/change events do not alter codec support.
      // Keeping the existing result also lets the first action click reach its button.
      if (probeKey === nextProbeKey) return;
      probeKey = nextProbeKey;
      revision = ++checkRevision;
      supported = false; setBusy(false);
      const size = dialog.querySelector("[data-size]");
      size.textContent = `${config.width} x ${config.height} · ${config.frameCount} frames · about ${mb(bytes.range[0])}-${mb(bytes.range[1])}. Silent video. Settings bounds and aspect ratio are preserved.`;
      if (bytes.conservative > VIDEO_LIMITS.memoryBytes) throw new Error("This download may exceed 64 MB. Reduce duration, resolution, or quality.");
      const support = await probeVideoSupport(config);
      if (closed || busy || revision !== checkRevision) return;
      supported = support.supported;
      message.textContent = support.supported ? "" : support.reason;
      setBusy(false);
    } catch (error) {
      if (revision === undefined || revision === checkRevision) {
        ++checkRevision; probeKey = null; supported = false;
        message.textContent = error.message; setBusy(false);
      }
    }
  };
  const start = (type) => {
    if (busy || !supported) return;
    try {
      const config = options();
      const starts = Object.fromEntries([...dialog.querySelectorAll("[data-time-id]")].map((input) => [input.dataset.timeId, input.value]));
      message.textContent = ""; setBusy(true);
      dialog.querySelector("progress").value = 0;
      dialog.querySelector("[data-progress]").textContent = "Preparing frames...";
      worker.postMessage({ type, options: config, starts, grid: form.elements.namedItem("grid").checked });
    } catch (error) { message.textContent = error.message; setBusy(false); }
  };
  worker.onmessage = async ({ data }) => {
    if (closed) return;
    if (data.type === "ready") {
      bounds = data.bounds;
      dialog.querySelector("[data-time-starts]").innerHTML = data.times.map((time) => `<label class="video-time-start">${escape(time.id)} start <input data-time-id="${escape(time.id)}" value="${escape(time.start)}" aria-label="${escape(time.id)} starting value"><small>${escape(time.mode.replaceAll("_", " "))} · ${escape(time.rate)} units/second</small></label>`).join("");
      await refresh();
      if (!supported && value("format") === "mp4") { form.elements.namedItem("format").value = "webm"; await refresh(); }
    } else if (data.type === "progress") {
      const progress = data.progress;
      restore.textContent = `Video export ${Math.round(progress.fraction * 100)}%`;
      dialog.querySelector("progress").value = progress.fraction;
      dialog.querySelector("[data-progress]").textContent = `${progress.phase}: ${progress.completedFrames}/${progress.totalFrames} frames${progress.etaSeconds == null ? "" : ` · about ${seconds(progress.etaSeconds)} remaining`}`;
    } else if (data.type === "estimate") {
      const estimate = data.result;
      clearTimeout(cancelTimer);
      setBusy(false);
      restore.textContent = "Video export";
      dialog.querySelector("[data-estimate]").textContent = `Estimated export: ${seconds(estimate.secondsRange[0])}-${seconds(estimate.secondsRange[1])}. Other GPU work can change this estimate.`;
    } else if (data.type === "complete") {
      clearTimeout(cancelTimer);
      const url = URL.createObjectURL(data.result.data);
      const link = document.createElement("a"); link.href = url; link.download = `${name}.${data.result.extension}`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
      message.textContent = `Exported ${data.result.frameCount} frames (${mb(data.result.bytes)}).`; setBusy(false);
      restore.textContent = "Video exported";
    } else {
      clearTimeout(cancelTimer); message.textContent = data.type === "cancelled" ? "Export cancelled." : data.message; restore.textContent = "Video export"; setBusy(false);
    }
  };
  worker.onerror = (event) => {
    clearTimeout(cancelTimer); worker.terminate(); supported = false; setBusy(false); fieldset.disabled = true;
    message.textContent = `${event.message || "Video worker could not start"}. Close and reopen this panel to try again.`;
    restore.textContent = "Video export failed";
  };
  dialog.querySelector("[data-close]").onclick = close;
  dialog.querySelector("[data-minimize]").onclick = () => { restore.hidden = false; dismiss(restore); };
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.querySelector("[data-cancel]").onclick = () => {
    worker.postMessage({ type: "cancel" });
    dialog.querySelector("[data-progress]").textContent = "Cancelling...";
    cancelTimer = setTimeout(() => { worker.terminate(); busy = false; message.textContent = "Export cancelled. Close and reopen this panel to export again."; fieldset.disabled = true; dialog.querySelector(".video-export-progress").hidden = true; }, 1500);
  };
  dialog.querySelector("[data-export]").onclick = () => start("export");
  dialog.querySelector("[data-estimate-button]").onclick = () => start("estimate");
  form.addEventListener("input", refresh); form.addEventListener("change", refresh);
  form.addEventListener("submit", (event) => event.preventDefault());
  show(); worker.postMessage({ type: "initialize", scene: structuredClone(scene) });
  activePanel = { close, show };
  return activePanel;
}
