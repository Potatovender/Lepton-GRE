/** One in-flight job and one newest replacement; never an unbounded edit queue. */
export class PreviewClient {
  constructor({ onFrame, onStatus, onError, onDiagnostics, workerFactory = () => new Worker(new URL("./preview-worker.js?v=20260917-responsive-video", import.meta.url), { type: "module" }) }) {
    Object.assign(this, { onFrame, onStatus, onError, onDiagnostics, workerFactory });
    this.revision = 0;
    this.pending = null;
    this.busy = false;
    this.worker = null;
    this.timer = null;
    this.generation = 0;
    this.cancelSent = false;
    this.activePhase = null;
    this.activeRevision = 0;
  }

  request(request) {
    if (!request.transient) this.generation++;
    this.pending = { ...request, revision: ++this.revision, generation: this.generation, type: "render" };
    this.onStatus?.({ revision: this.revision, phase: "queued", transient: Boolean(request.transient) });
    if (this.busy && !request.transient) {
      // Native shader work is not reliably preemptible. Finishing it preserves
      // the program cache and avoids a queue of cancelled driver compilations.
      if (!this.cancelSent && this.activePhase !== "rendering") {
        try { this.worker.postMessage({ type: "cancel" }); this.cancelSent = true; }
        catch (error) {
          this.restart();
          this.onError?.({ revision: this.revision, message: error.message || "Background graph worker could not be cancelled" });
          this.dispatch();
          return this.revision;
        }
      }
      // A synchronous compiler cannot observe cancellation until it yields.
      if (!this.timer) this.timer = setTimeout(() => { this.restart(); this.dispatch(); }, 2000);
    } else if (!this.busy) this.dispatch();
    return this.revision;
  }

  dispatch() {
    if (!this.pending || this.busy) return;
    if (!this.worker) {
      let worker;
      try { worker = this.worker = this.workerFactory(); }
      catch (error) {
        this.pending = null;
        this.onError?.({ revision: this.revision, message: error.message || "Background graph worker could not start" });
        return;
      }
      worker.onmessage = ({ data }) => {
        if (worker !== this.worker) { data.bitmap?.close(); return; }
        this.receive(data);
      };
      worker.onerror = (event) => {
        if (worker !== this.worker) return;
        const message = event.message || "Background graph worker failed";
        this.restart();
        this.onError?.({ revision: this.revision, message });
        this.dispatch();
      };
    }
    const request = this.pending;
    this.pending = null;
    this.busy = true;
    this.activeRevision = request.revision;
    this.activePhase = "queued";
    try { this.worker.postMessage(request); }
    catch (error) {
      this.restart();
      this.onError?.({ revision: request.revision, message: error.message || "Graph could not be sent to the background worker" });
    }
  }

  receive(data) {
    if (data.type === "diagnostics") {
      if (data.generation === this.generation) this.onDiagnostics?.(data);
      return;
    }
    if (data.type === "phase") {
      if (data.revision === this.activeRevision) this.activePhase = data.phase;
      if (data.revision === this.revision) this.onStatus?.(data);
      return;
    }
    this.busy = false;
    this.activePhase = null;
    this.cancelSent = false;
    clearTimeout(this.timer); this.timer = null;
    if (data.generation !== this.generation) data.bitmap?.close();
    else if (data.type === "frame") this.onFrame?.(data);
    else if (data.type === "error") this.onError?.(data);
    this.dispatch();
  }

  restart() {
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
    this.activePhase = null;
    this.cancelSent = false;
    clearTimeout(this.timer); this.timer = null;
  }

  dispose() {
    this.revision += 1;
    this.generation += 1;
    this.pending = null;
    this.restart();
  }
}
