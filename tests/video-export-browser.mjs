import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";

// This exercises the standalone pipeline, not the graph editor. No graph/local storage is touched.
const bundle = process.env.LEPTON_MEDIABUNNY_BUNDLE || resolve("src/libs/mediabunny/mediabunny.mjs");
const bundleSource = await readFile(bundle);
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    if (path === "/") { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><title>Video export tests</title>"); return; }
    response.setHeader("Content-Type", "text/javascript");
    if (path === "/mediabunny.mjs") { response.end(bundleSource); return; }
    if (!/^\/src\/video\/[a-z-]+\.js$/.test(path)) { response.writeHead(404).end(); return; }
    response.end(await readFile(resolve(`.${path}`)));
  } catch (error) { response.writeHead(500).end(error.message); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  const engine = process.env.LEPTON_TEST_BROWSER === "webkit" ? webkit : chromium;
  browser = await engine.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const results = await page.evaluate(async () => {
    const mb = await import("/mediabunny.mjs");
    const { createVideoExporter } = await import("/src/video/index.js");
    const exporter = createVideoExporter(mb);
    const reports = [];
    for (const format of ["mp4", "webm"]) {
      const options = { width: 96, height: 64, duration: 0.235, fps: 30, bitrate: 300_000, format };
      const support = await exporter.checkSupport(options);
      if (!support.supported) { reports.push({ format, unsupported: support.reason }); continue; }
      const canvas = new OffscreenCanvas(96, 64);
      const context = canvas.getContext("2d");
      const callbackTimes = [];
      const phases = [];
      const renderFrame = (time) => {
        callbackTimes.push(time);
        context.fillStyle = time < 0.1 ? "rgb(230,20,30)" : "rgb(20,210,40)";
        context.fillRect(0, 0, 96, 64);
        return canvas;
      };
      const result = await exporter.exportVideo({ options, renderFrame, onProgress: ({ phase }) => phases.push(phase) });
      const buffer = await result.data.arrayBuffer();
      const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BufferSource(buffer) });
      const track = await input.getPrimaryVideoTrack();
      const packets = [];
      for await (const packet of new mb.EncodedPacketSink(track).packets()) packets.push({ timestamp: packet.timestamp, duration: packet.duration });
      const sink = new mb.VideoSampleSink(track);
      const pixels = [];
      for (const time of [0, 0.15]) {
        const sample = await sink.getSample(time);
        if (!sample) throw new Error(`No decoded sample at ${time}`);
        sample.draw(context, 0, 0);
        pixels.push([...context.getImageData(48, 32, 1, 1).data]);
        sample.close();
      }
      const packetEnd = await input.computeDuration();
      const video = document.createElement("video");
      const videoUrl = URL.createObjectURL(result.data);
      video.src = videoUrl;
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error("Exported video does not load in the browser player")); });
      const duration = video.duration;
      video.currentTime = 0.234;
      await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = () => reject(new Error("Cannot seek to shortened last frame")); });
      context.drawImage(video, 0, 0);
      const finalPixel = [...context.getImageData(48, 32, 1, 1).data];
      video.removeAttribute("src"); video.load(); URL.revokeObjectURL(videoUrl);
      input.dispose();
      const chunks = [];
      let streamClosed = 0, streamAborted = 0;
      const writable = new WritableStream({
        write(chunk) { chunks.push({ position: chunk.position, data: chunk.data.slice() }); },
        close() { streamClosed++; }, abort() { streamAborted++; },
      });
      const streamed = await exporter.exportVideo({ options, renderFrame, target: { writable } });
      const streamBytes = new Uint8Array(streamed.bytes);
      for (const { position, data } of chunks) streamBytes.set(data, position);
      const streamInput = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BufferSource(streamBytes) });
      const streamDuration = await streamInput.getDurationFromMetadata();
      streamInput.dispose();
      const controller = new AbortController();
      let cancelled = false, aborted = 0, closed = 0;
      try {
        await exporter.exportVideo({ options: { ...options, duration: 10 }, signal: controller.signal,
          target: { writable: new WritableStream({ abort() { aborted++; }, close() { closed++; } }) },
          renderFrame: (time) => { if (time > 0.05) controller.abort(); return renderFrame(time); } });
      } catch (error) { if (error.name !== "AbortError") throw error; cancelled = true; }
      const estimate = await exporter.estimateVideo({ options, renderFrame, sampleCount: 4 });
      reports.push({ format, codec: result.codec, frames: result.frameCount, duration, packetEnd, finalPixel, packets, pixels,
        bytes: buffer.byteLength, phases, callbackTimes: callbackTimes.slice(0, 8), streamDuration,
        streamClosed, streamAborted, cancelled, aborted, closed, estimate: estimate.seconds });
    }
    return reports;
  });
  assert(results.some((result) => !result.unsupported), "This test browser supports no video encoder");
  for (const result of results) {
    if (result.unsupported) { console.log(`skip - ${result.format}: ${result.unsupported}`); continue; }
    assert.equal(result.frames, 8);
    assert.equal(result.packets.length, 8);
    assert(Math.abs(result.duration - 0.235) < 0.0011, `Wrong ${result.format} duration: ${result.duration}`);
    assert(Math.abs(result.streamDuration - 0.235) < 0.0011);
    // WebM SimpleBlocks omit individual durations; the file's Segment duration carries the final hold.
    if (result.format === "mp4") assert(result.packets.at(-1).duration < 0.003, "MP4 lost the shortened final frame");
    assert.deepEqual(result.callbackTimes, Array.from({ length: 8 }, (_, i) => i / 30));
    assert(result.pixels[0][0] > 200 && result.pixels[0][1] < 50, "First frame pixels are wrong");
    assert(result.pixels[1][1] > 180 && result.pixels[1][0] < 50, "Later frame pixels are wrong");
    assert(result.finalPixel[1] > 180 && result.finalPixel[0] < 50, "Shortened last frame is not visible in the browser player");
    assert.equal(result.phases.at(-1), "complete");
    assert.equal(result.streamClosed, 1);
    assert.equal(result.streamAborted, 0);
    assert(result.cancelled);
    assert.equal(result.aborted, 1);
    assert.equal(result.closed, 0);
    assert(result.estimate > 0);
    console.log(`ok - native ${result.format}/${result.codec}: ${result.bytes} bytes, ${result.frames} decoded packets, ${result.duration}s, pixel fidelity, streaming, cancellation, estimate`);
  }
  const workerResult = await page.evaluate(async () => {
    const origin = location.origin;
    const code = `import * as mb from '${origin}/mediabunny.mjs';
      import {createVideoExporter} from '${origin}/src/video/index.js';
      onmessage = async () => { try {
        const exporter = createVideoExporter(mb);
        const options = {width:96,height:64,fps:24,duration:0.1,format:'webm',bitrate:300000};
        const support = await exporter.checkSupport(options);
        if (!support.supported) { postMessage({unsupported:support.reason}); return; }
        const canvas = new OffscreenCanvas(96,64);
        const ctx = canvas.getContext('2d'); ctx.fillStyle='red'; ctx.fillRect(0,0,96,64);
        const result = await exporter.exportVideo({options,renderFrame:()=>canvas});
        postMessage({frames:result.frameCount,bytes:result.bytes});
      } catch(error) {postMessage({error:error.message});} };`;
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    const worker = new Worker(url, { type: "module" });
    try {
      return await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => resolve(data);
        worker.onerror = (error) => reject(new Error(error.message));
        worker.postMessage(null);
      });
    } finally { worker.terminate(); URL.revokeObjectURL(url); }
  });
  assert(!workerResult.error, workerResult.error);
  if (!workerResult.unsupported) {
    assert.equal(workerResult.frames, 3);
    assert(workerResult.bytes > 0);
    console.log("ok - native worker encoding with OffscreenCanvas");
  } else console.log(`skip - worker encoder: ${workerResult.unsupported}`);
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
