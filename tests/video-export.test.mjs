import test from "node:test";
import assert from "node:assert/strict";
import { createVideoExporter, normalizeVideoOptions, frameTiming, estimateOutputBytes, probeVideoSupport } from "../src/video/index.js";
import { validateOutputTarget } from "../src/video/options.js";
import { createOutputStorage } from "../src/video/output.js";

const base = { width: 96, height: 64, fps: 30, duration: 0.25, format: "mp4", bitrate: 100_000 };
const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function fakePlatform(settings = {}) {
  const stats = { frames: [], packets: [], outputOptions: [], activeFrames: 0, peakFrames: 0,
    maxBatch: 0, encoderClosed: 0, cancelled: 0, writes: 0 };
  class Frame {
    constructor(image, init = {}) {
      this.displayWidth = image.width ?? image.displayWidth;
      this.displayHeight = image.height ?? image.displayHeight;
      Object.assign(this, init);
      stats.activeFrames++;
      stats.peakFrames = Math.max(stats.peakFrames, stats.activeFrames);
    }
    close() { if (!this.closed) { this.closed = true; stats.activeFrames--; } }
  }
  class Encoder {
    static async isConfigSupported(config) { return { supported: settings.supported !== false, config }; }
    state = "unconfigured";
    queue = [];
    constructor(callbacks) { this.callbacks = callbacks; }
    configure(config) { this.state = "configured"; this.config = config; }
    encode(frame, encodeOptions) {
      stats.frames.push({ timestamp: frame.timestamp, duration: frame.duration, ...encodeOptions });
      this.queue.push({ timestamp: frame.timestamp, duration: frame.duration, ...encodeOptions });
      stats.maxBatch = Math.max(stats.maxBatch, this.queue.length);
    }
    async flush() {
      if (settings.hangEncoder) return new Promise(() => {});
      await sleep();
      if (this.state === "closed") throw new Error("Closed encoder");
      if (settings.encoderError) { this.callbacks.error(new Error("GPU encoder lost")); return; }
      for (const frame of this.queue.splice(0)) {
        if (settings.dropFrame && frame.timestamp > 0) continue;
        this.callbacks.output({ timestamp: frame.timestamp, duration: null, type: frame.keyFrame ? "key" : "delta",
          byteLength: 4, copyTo(target) { target.set([4, 3, 2, 1]); } },
        { decoderConfig: { codec: this.config.codec, codedWidth: base.width, codedHeight: base.height } });
      }
    }
    close() { if (this.state !== "closed") { this.state = "closed"; stats.encoderClosed++; } }
  }
  class EncodedPacket { constructor(data, type, timestamp, duration) { Object.assign(this, { data, type, timestamp, duration }); } }
  class StreamTarget { constructor(stream) { this.stream = stream; } }
  class Mp4OutputFormat { constructor(options) { this.options = options; } }
  class WebMOutputFormat {}
  class EncodedVideoPacketSource {
    async add(packet) {
      await sleep(settings.writeDelay);
      if (settings.muxError) throw new Error("Muxer failed");
      stats.packets.push(packet);
      await this.output.writer.write({ type: "write", position: 4 + stats.writes++ * 4, data: packet.data });
    }
    close() {}
  }
  class Output {
    state = "pending";
    constructor(options) { this.options = options; stats.outputOptions.push(options); }
    addVideoTrack(source, metadata) { source.output = this; this.metadata = metadata; stats.metadata = metadata; }
    async start() {
      this.writer = this.options.target.stream.getWriter();
      this.state = "started";
      await this.writer.write({ type: "write", position: 0, data: new Uint8Array([0, 0, 0, 0]) });
    }
    async finalize() {
      await this.writer.write({ type: "write", position: 0, data: new Uint8Array([1, 2, 3, 4]) });
      await this.writer.close();
      this.writer.releaseLock();
      this.state = "finalized";
    }
    async cancel() {
      stats.cancelled++;
      if (this.writer && this.state !== "finalized") { try { await this.writer.close(); } finally { this.writer.releaseLock(); } }
      this.state = "cancelled";
    }
  }
  const bundle = { Output, EncodedVideoPacketSource, EncodedPacket, StreamTarget, Mp4OutputFormat, WebMOutputFormat };
  return { stats, Frame, bundle, exporter: createVideoExporter(bundle, { VideoEncoder: Encoder, VideoFrame: Frame }) };
}

test("frame intervals sum to exact duration, including fractional last frame and fractional FPS", () => {
  for (const [fps, duration] of [[30, 10], [30, 0.235], [29.97, 7.013], [30000 / 1001, 10], [60, 0.07], [24, 0.001]]) {
    const options = normalizeVideoOptions({ ...base, fps, duration });
    let end = 0;
    for (let i = 0; i < options.frameCount; i++) {
      const frame = frameTiming(options, i);
      assert.equal(frame.timestampUs, end);
      assert(frame.durationUs > 0);
      assert.equal(frame.timeSeconds, i / fps);
      end += frame.durationUs;
    }
    assert.equal(end, Math.round(duration * 1e6));
  }
  assert.equal(normalizeVideoOptions({ ...base, duration: 0.07, fps: 100 }).frameCount, 7);
  assert.throws(() => frameTiming(normalizeVideoOptions(base), -1), RangeError);
  assert.throws(() => normalizeVideoOptions({ ...base, duration: 0.000001 }), { code: "TIMESTAMP_PRECISION" });
  assert.throws(() => normalizeVideoOptions({ ...base, format: "webm", duration: 1.000001 }), { code: "TIMESTAMP_PRECISION" });
});

test("options reject invalid settings, unsafe resource sizes, and odd MP4 sizes without mutating input", () => {
  for (const bad of [{ fps: 0 }, { fps: NaN }, { duration: Infinity }, { duration: 0 }, { width: 0 },
    { width: 97 }, { width: 8000, height: 8000 }, { format: "gif" }, { bitrate: -1 }, { maxFramesInFlight: 5 }]) {
    assert.throws(() => normalizeVideoOptions({ ...base, ...bad }));
  }
  const input = { ...base };
  const options = normalizeVideoOptions(input);
  input.fps = 10;
  assert.equal(options.fps, 30);
  assert(Object.isFrozen(options));
  assert.equal(normalizeVideoOptions({ ...base, format: "webm", width: 97 }).width, 97);
});

test("memory estimates enforce conservative download budgets before expensive rendering", () => {
  const options = normalizeVideoOptions({ ...base, bitrate: 16_000_000, duration: 60 });
  const size = estimateOutputBytes(options);
  assert(size.approximate > 120_000_000);
  assert(size.conservative > size.approximate);
  assert.throws(() => validateOutputTarget(options), { code: "OUTPUT_BUDGET" });
  assert.equal(validateOutputTarget(options, { writable: new WritableStream() }).kind, "stream");
});

test("capability checks handle missing WebCodecs and retry candidates at actual requested dimensions", async () => {
  assert.equal((await probeVideoSupport(base, { VideoEncoder: {}, VideoFrame: undefined })).supported, false);
  const configs = [];
  const support = await probeVideoSupport(base, { VideoFrame: class {}, VideoEncoder: {
    async isConfigSupported(config) { configs.push(config); return { supported: configs.length === 3, config }; },
  } });
  assert(support.supported);
  assert.equal(configs.length, 3);
  assert(configs.every((config) => config.width === base.width && config.framerate === base.fps && config.bitrate === base.bitrate));
});

test("positioned memory writes preserve rewritten headers, sparse ranges, and precise file length", async () => {
  for (const kind of ["blob", "arraybuffer"]) {
    const storage = createOutputStorage({ kind, maxBytes: 200_000 }, "video/mp4");
    const writer = storage.stream.getWriter();
    await writer.write({ type: "write", position: 65_535, data: new Uint8Array([7, 8, 9]) });
    await writer.write({ type: "write", position: 0, data: new Uint8Array([1, 2]) });
    await writer.write({ type: "write", position: 1, data: new Uint8Array([3]) });
    await writer.close();
    const output = await storage.complete();
    const bytes = new Uint8Array(kind === "blob" ? await output.arrayBuffer() : output);
    assert.equal(bytes.length, 65_538);
    assert.deepEqual([...bytes.slice(0, 3)], [1, 3, 0]);
    assert.deepEqual([...bytes.slice(-3)], [7, 8, 9]);
  }
});

test("output writer refuses actual byte-budget overflow, regardless of bitrate estimate", async () => {
  const storage = createOutputStorage({ kind: "blob", maxBytes: 12 }, "video/mp4");
  const writer = storage.stream.getWriter();
  await assert.rejects(writer.write({ type: "write", position: 9, data: new Uint8Array(4) }), { code: "OUTPUT_BUDGET" });
  await storage.abort(new Error("Too large"));
});

test("export uses exact callback times, preserves final interval, bounds queues, closes frames, and finalizes before returning", async () => {
  const { exporter, stats } = fakePlatform({ writeDelay: 3 });
  const times = [];
  const progress = [];
  const options = { ...base, duration: 0.235 };
  const result = await exporter.exportVideo({ options,
    renderFrame: (time) => { times.push(time); options.duration = 100; return { width: 96, height: 64 }; },
    onProgress: (state) => progress.push(state) });
  assert.equal(result.frameCount, 8);
  assert.equal(result.duration, 0.235);
  assert.deepEqual(times, Array.from({ length: 8 }, (_, i) => i / 30));
  assert.equal(stats.frames.at(-1).duration, 1667);
  assert.equal(stats.packets.at(-1).duration, 0.001667);
  assert.equal(stats.metadata.frameRate, undefined, "Muxer must not quantize the partial final frame");
  assert.equal(stats.outputOptions[0].format.options.fastStart, false);
  assert(stats.maxBatch <= 2);
  assert.equal(stats.activeFrames, 0);
  assert(stats.peakFrames <= 1);
  assert.equal(stats.encoderClosed, 1);
  assert.equal(stats.cancelled, 0);
  assert.equal(progress.at(-1).phase, "complete");
  assert.equal(progress.at(-1).completedFrames, 8);
  assert.deepEqual([...new Uint8Array(await result.data.arrayBuffer()).slice(0, 4)], [1, 2, 3, 4]);
});

test("returned VideoFrames transfer ownership and close on dimension errors", async () => {
  const { exporter, Frame, stats } = fakePlatform();
  await assert.rejects(exporter.exportVideo({ options: base, renderFrame: () => new Frame({ width: 100, height: 64 }) }), { code: "FRAME_DIMENSIONS" });
  assert.equal(stats.activeFrames, 0);
  assert.equal(stats.cancelled, 1);
});

test("cancellation stops a hanging encoder and aborts, rather than commits, a partial file", async () => {
  const { exporter, stats } = fakePlatform({ hangEncoder: true });
  const controller = new AbortController();
  let closed = 0, aborted = 0;
  const writable = new WritableStream({ close() { closed++; }, abort() { aborted++; } });
  const job = exporter.exportVideo({ options: base, signal: controller.signal,
    target: { writable }, renderFrame: () => ({ width: 96, height: 64 }) });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(job, { name: "AbortError" });
  assert.equal(closed, 0);
  assert.equal(aborted, 1);
  assert.equal(writable.locked, false);
  assert.equal(stats.encoderClosed, 1);
});

test("cancellation closes late render frames and supports retry", async () => {
  const { exporter, Frame, stats } = fakePlatform();
  const controller = new AbortController();
  let finish;
  const job = exporter.exportVideo({ options: base, signal: controller.signal,
    renderFrame: () => new Promise((resolve) => { finish = resolve; }) });
  while (!finish) await sleep();
  controller.abort();
  await assert.rejects(job, { name: "AbortError" });
  finish(new Frame({ width: 96, height: 64 }));
  await sleep();
  assert.equal(stats.activeFrames, 0);
  const result = await exporter.exportVideo({ options: base, renderFrame: () => ({ width: 96, height: 64 }) });
  assert.equal(result.frameCount, 8);
});

test("codec, encoder, dropped frames, renderer, muxer, and file errors never return successful partial output", async () => {
  for (const [settings, expected] of [[{ supported: false }, "UNSUPPORTED_CODEC"], [{ encoderError: true }, "ENCODER_FAILED"],
    [{ dropFrame: true }, "MISSING_FRAMES"], [{ muxError: true }, undefined]]) {
    const { exporter, stats } = fakePlatform(settings);
    await assert.rejects(exporter.exportVideo({ options: base, renderFrame: () => ({ width: 96, height: 64 }) }), expected ? { code: expected } : /Muxer failed/);
    assert.equal(stats.activeFrames, 0);
  }
  const { exporter } = fakePlatform();
  await assert.rejects(exporter.exportVideo({ options: base, renderFrame: () => { throw new Error("Context lost"); } }), /Context lost/);
  let aborts = 0;
  const writable = new WritableStream({ write() { throw new DOMException("Disk full", "QuotaExceededError"); }, abort() { aborts++; } });
  await assert.rejects(exporter.exportVideo({ options: base, target: { writable }, renderFrame: () => ({ width: 96, height: 64 }) }), { name: "QuotaExceededError" });
  assert.equal(writable.locked, false);
  assert.equal(aborts, 0, "An already errored stream does not invoke its abort sink twice");
});

test("successful positioned stream output closes exactly once and returns no large download buffer", async () => {
  const { exporter } = fakePlatform();
  let closes = 0;
  const writes = [];
  const writable = new WritableStream({ write(chunk) { writes.push(chunk); }, close() { closes++; } });
  const result = await exporter.exportVideo({ options: base, target: { writable }, renderFrame: () => ({ width: 96, height: 64 }) });
  assert.equal(result.data, null);
  assert.equal(closes, 1);
  assert.equal(writable.locked, false);
  assert.equal(writes.at(-1).position, 0);
});

test("estimation samples spread through the graph and includes completed encoding and finalization", async () => {
  const { exporter, stats } = fakePlatform({ writeDelay: 2 });
  const times = [];
  const result = await exporter.estimateVideo({ options: { ...base, duration: 10 }, sampleCount: 6,
    renderFrame: (time) => { times.push(time); return { width: 96, height: 64 }; } });
  assert.equal(stats.packets.length, 6);
  assert.equal(times[0], 0);
  assert.equal(times.at(-1), 299 / 30);
  assert(result.secondsRange[0] < result.seconds && result.secondsRange[1] > result.seconds);
  assert(result.sampleSeconds > 0);
  assert.equal(result.frameCount, 300);
  assert.equal(stats.activeFrames, 0);
});
