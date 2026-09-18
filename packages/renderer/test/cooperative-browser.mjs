// Run explicitly with Playwright installed; uses no server or saved browser state.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined });
try {
  const page = await browser.newPage();
  const report = await page.evaluate(async (source) => {
    const { renderFrame, renderFrameAsync, disposeRenderer } = await import(`data:text/javascript;base64,${btoa(source)}`);
    const reports = [];
    const scalar = `precision highp float;
      uniform vec2 u_resolution; uniform vec4 u_bounds; uniform vec4 u_clip_bounds;
      uniform int u_clip_enabled; uniform vec3 u_background; uniform float u_time;
      void main(){
        vec2 p = mix(u_bounds.xz, u_bounds.yw, gl_FragCoord.xy/u_resolution);
        if(u_clip_enabled==1 && (p.x<u_clip_bounds.x || p.x>u_clip_bounds.y || p.y<u_clip_bounds.z || p.y>u_clip_bounds.w)){
          COLOR=vec4(u_background,1.0); return;
        }
        if(mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),7.0)<1.0) discard;
        float v=sin(3.0*p.x)+cos(4.0*p.y)+0.1*u_time;
        COLOR=vec4(0.5+0.4*sin(v),0.5+0.4*cos(v),0.5+0.2*v,1.0);
      }`;
    const read = (canvas, gl) => {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    function make(webgl2) {
      const canvas = new OffscreenCanvas(1, 1);
      const wrapper = {
        get width() { return canvas.width; }, set width(value) { canvas.width = value; },
        get height() { return canvas.height; }, set height(value) { canvas.height = value; },
        getContext(kind, options) { return kind === "webgl2" && !webgl2 ? null : canvas.getContext(kind, options); },
        addEventListener: canvas.addEventListener.bind(canvas), removeEventListener: canvas.removeEventListener.bind(canvas)
      };
      return { canvas, wrapper };
    }
    for (const webgl2 of [true, false]) {
      for (const restricted of [false, true]) {
        const a = make(webgl2), b = make(webgl2);
        const fragmentSource = webgl2 ? `#version 300 es\n${scalar.replace("void main", "out vec4 color; void main").replaceAll("COLOR", "color").replace("0.5+0.2*v", "0.5+0.1*v+0.03*fwidth(v)")}` : scalar.replaceAll("COLOR", "gl_FragColor");
        const options = { width: 257, height: 193, dpr: 1.5, bounds: { xMin: -3, xMax: 4, yMin: -2, yMax: 2 },
          clipBounds: { xMin: -2, xMax: 3, yMin: -1, yMax: 1 }, background: [0.2, 0.1, 0.3],
          floats: { u_time: 1.2 }, shaderKey: "parity", fragmentSource };
        try {
          renderFrame(a.wrapper, options); renderFrame(b.wrapper, options);
          const ga = a.canvas.getContext(webgl2 ? "webgl2" : "webgl"), gb = b.canvas.getContext(webgl2 ? "webgl2" : "webgl");
          if (restricted) for (const gl of [ga, gb]) { gl.enable(gl.SCISSOR_TEST); gl.scissor(13, 17, 231, 169); }
          const next = { ...options, floats: { u_time: 2.7 } };
          renderFrame(a.wrapper, next);
          const result = await renderFrameAsync(b.wrapper, next, { maxBatchPixels: 1024, pollIntervalMs: 0 });
          const expected = read(a.canvas, ga), actual = read(b.canvas, gb);
          let differentBytes = 0;
          for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) differentBytes++;
          reports.push({ webgl2, restricted, differentBytes, bytes: actual.length, batches: result.batchCount,
            scissor: [...gb.getParameter(gb.SCISSOR_BOX)], enabled: gb.isEnabled(gb.SCISSOR_TEST) });
        } finally { disposeRenderer(a.wrapper, { loseContext: true }); disposeRenderer(b.wrapper, { loseContext: true }); }
      }
    }

    // Compare completed-frame wall time, not a fast submission against a completed tiled frame.
    const { canvas, wrapper } = make(true), channel = new MessageChannel();
    let wake;
    channel.port1.onmessage = () => wake?.();
    const task = () => new Promise((resolve) => { wake = resolve; channel.port2.postMessage(null); });
    const bench = [];
    try {
      const options = { width: 1000, height: 1000, bounds: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
        shaderKey: "flat", fragmentSource: "#version 300 es\nprecision highp float;uniform float u_time;out vec4 c;void main(){c=vec4(u_time,0.4,0.7,1.0);}", floats: { u_time: 0.5 } };
      await renderFrameAsync(wrapper, options, { pollIntervalMs: 0 });
      const gl = canvas.getContext("webgl2");
      for (const cooperative of [false, true]) {
        const times = [], batches = [], maximums = [];
        for (let i = 0; i < 12; i++) {
          const start = performance.now();
          const result = await renderFrameAsync(wrapper, { ...options, floats: { u_time: i / 12 } }, cooperative ? { maxBatchPixels: 65536 } : {});
          if (!cooperative) {
            const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
            try {
              while (true) {
                await task();
                const status = gl.clientWaitSync(fence, 0, 0);
                if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) break;
                if (status === gl.WAIT_FAILED || performance.now() - start > 10000) throw new Error("Benchmark fence failed");
              }
            } finally { gl.deleteSync(fence); }
          }
          if (i >= 2) { times.push(performance.now() - start); batches.push(result.batchCount ?? 1); maximums.push(result.maxBatchMs ?? 0); }
        }
        times.sort((a, b) => a - b);
        bench.push({ cooperative, medianMs: times[5], p95Ms: times[9], batches, maxBatchMs: Math.max(...maximums) });
      }
    } finally { channel.port1.close(); channel.port2.close(); disposeRenderer(wrapper, { loseContext: true }); }
    return { reports, bench };
  }, source);
  console.log(JSON.stringify({ browser: await browser.version(), ...report }, null, 2));
  for (const row of report.reports) {
    assert.equal(row.differentBytes, 0, `Pixel mismatch: ${JSON.stringify(row)}`);
    assert.equal(row.enabled, row.restricted);
    if (row.restricted) assert.deepEqual(row.scissor, [13, 17, 231, 169]);
  }
} finally { await browser.close(); }
