import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { preview } from "vite";

// Default: staged dist on an ephemeral preview port with Playwright Chromium.
// Override LEPTON_TEST_URL / LEPTON_BROWSER_EXECUTABLE for a local development check.
// Slow CI GPUs can raise the per-job watchdog without weakening pixel/timing assertions.
const jobTimeout = Number(process.env.LEPTON_VIDEO_TEST_TIMEOUT_MS ?? 120_000);
assert(Number.isSafeInteger(jobTimeout) && jobTimeout > 0, "LEPTON_VIDEO_TEST_TIMEOUT_MS must be a positive integer");
const server = process.env.LEPTON_TEST_URL ? null : await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = process.env.LEPTON_TEST_URL || server.resolvedUrls.local[0];
const output = "output/playwright/video-ui";
const executablePath = process.env.LEPTON_BROWSER_EXECUTABLE || undefined;
await mkdir(output, { recursive: true });
const fixture = `set x_min = -4
set x_max = 4
set y_min = -2
set y_max = 2
set ensure_square_grid = True
set aspect_ratio = 2:1
set show_coordinate_grid = True
set show_grid = True
set show_x_axis = True
set show_y_axis = True
set show_x_numbers = True
set show_y_numbers = True
set random_seed = 12345
folder Clocks = {
  time bounded bounce = 0.25 {range=0~1, speed=2}
  time bounded_looped cycle = 0.2 {range=0~1, speed=1}
  time unbounded travel = 1 {speed=1.5}
}
slider stationary = 7 {range=0~10}
expression surface = x
function measure(a,b) = a+b
colour timeColour = 30+160*bounce+4*x~30+160*cycle+6*y~30+30*travel
colour markerColour = 255~0~0
point focus = [-1,0] {draggable=True, visible=True, colour=markerColour, link=measure, show_label=True}
draw(surface,colour=timeColour)`;

const failures = [];
const reports = [];
let browser, page;
let sequence = 0;
let dialogs = [];
let dialogAnswers = [];
let pageErrors = [];
let workerUrls = [];

async function waitUntil(predicate, message, timeout = 15_000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try { last = await predicate(); if (last) return last; } catch (error) { last = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${message}; last result: ${last}`);
}

async function load(source = fixture) {
  dialogAnswers = [];
  await page.goto(new URL(`app.html?scene=${encodeURIComponent(source)}&v=video-ui-regression`, base).href);
  await page.waitForFunction(() => typeof window.__leptonDebug?.scene === "function");
  await page.locator(".graph-actions-trigger").waitFor();
  await page.locator('[data-display-mode="standard"]').waitFor();
  await page.waitForFunction(() => !document.querySelector(".mathquill-field:not([data-mq-initialized])") || document.querySelector(".mq-root-block"));
}

async function state() {
  return page.evaluate(() => {
    const scene = window.__leptonDebug.scene();
    // syncFields materializes existing defaults on the visible rows; this is not a data edit.
    scene.functions = scene.functions.map((entry) => entry.type === "comment" ? entry : ({
      params: [], outputType: "expression", sliderMin: "0", sliderMax: "10", time: false,
      timeMode: "bounded", timeRate: "1", ...entry,
    }));
    const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
    return {
    scene: JSON.stringify(stable(scene)),
    mode: document.querySelector('[data-display-mode][aria-selected="true"]')?.dataset.displayMode,
    text: document.querySelector("[data-scene-text]")?.value ?? null,
    listScroll: document.querySelector(".entry-list")?.scrollTop ?? null,
    textScroll: document.querySelector("[data-scene-text]")?.scrollTop ?? null,
    storage: JSON.stringify(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    unsaved: document.querySelector(".graph-actions-trigger")?.classList.contains("primary"),
  }; });
}

async function settleFields(panel) {
  await panel.locator("h2").click();
  await waitUntil(() => panel.locator("[data-export]").isEnabled(), "Export settings are not supported after committing the last field");
}

async function openPanel(draftChoice) {
  await page.locator(".graph-actions-trigger").hover();
  await page.locator('[data-action="export-video"]').click();
  if (draftChoice) {
    const guard = page.getByRole("dialog", { name: "Unapplied text edits", exact: true });
    await guard.waitFor();
    await guard.locator(`[data-choice="${draftChoice}"]`).click();
    if (draftChoice === "cancel") return null;
  }
  const panel = page.locator(".video-export-dialog");
  await panel.waitFor();
  await waitUntil(async () => await panel.locator("[data-time-id]").count() === 3,
    "Snapshot worker did not return all time entries");
  await waitUntil(() => panel.locator("[data-export]").isEnabled(), "Export codec/configuration did not become available");
  return panel;
}

async function configure(panel, { duration = "0.435", edge = "320", starts = true } = {}) {
  await panel.locator('[name="duration"]').fill(duration);
  await panel.locator('[name="resolution"]').selectOption("custom");
  await panel.locator('[name="edge"]').fill(edge);
  if (starts) {
    await panel.locator('[data-time-id="bounce"]').fill("0.8");
    await panel.locator('[data-time-id="cycle"]').fill("0.8");
    await panel.locator('[data-time-id="travel"]').fill("sqrt(4)");
  }
  await settleFields(panel);
}

async function downloadVideo(panel, name) {
  const downloaded = page.waitForEvent("download", { timeout: jobTimeout });
  downloaded.catch(() => {});
  await panel.locator("[data-export]").click();
  let download;
  try { download = await downloaded; } catch (error) {
    const status = await panel.evaluate((element) => element.textContent).catch(() => "The panel was removed");
    throw new Error(`${error.message}\nExport status: ${status}`);
  }
  assert.equal(await download.failure(), null);
  const path = `${output}/${name}.${download.suggestedFilename().split(".").at(-1)}`;
  await download.saveAs(path);
  await waitUntil(() => panel.locator("[data-export]").isEnabled(), "Export did not return to editable settings");
  return { path, base64: (await readFile(path)).toString("base64") };
}

async function decode(base64, withReference = false, sampleTimes = [0, 0.4]) {
  return page.evaluate(async ({ base64, withReference, sampleTimes }) => {
    const mb = await import("./src/libs/mediabunny/mediabunny.mjs");
    const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BufferSource(data) });
    const track = await input.getPrimaryVideoTrack();
    const packets = [];
    for await (const packet of new mb.EncodedPacketSink(track).packets()) packets.push({ timestamp: packet.timestamp, duration: packet.duration });
    const width = await track.getDisplayWidth(), height = await track.getDisplayHeight();
    const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext("2d", { willReadFrequently: true });
    const samples = [];
    const sink = new mb.VideoSampleSink(track);
    for (const time of sampleTimes) {
      const packet = packets.reduce((nearest, candidate) => Math.abs(candidate.timestamp - time) < Math.abs(nearest.timestamp - time) ? candidate : nearest);
      if (Math.abs(packet.timestamp - time) > 0.0011) throw new Error(`No encoded frame at the expected ${time}s`);
      // Seek inside the frame: decimal frame boundaries can fall just before a
      // quantized container timestamp and otherwise select the preceding frame.
      const sample = await sink.getSample(packet.timestamp + packet.duration / 2);
      if (!sample) throw new Error(`No video sample at ${time}`);
      const timestamp = sample.timestamp;
      if (Math.abs(timestamp - packet.timestamp) > 0.0011) {
        sample.close();
        throw new Error(`Decoded ${timestamp}s instead of requested frame ${packet.timestamp}s`);
      }
      sample.draw(ctx, 0, 0); sample.close();
      const image = ctx.getImageData(0, 0, width, height).data;
      const pixel = (x, y) => [...image.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];
      let labelLight = 0, labelDark = 0;
      for (let y = 58; y < 76; y++) for (let x = 12; x < 310; x++) {
        const [r, g, b] = pixel(x, y);
        if (r > 200 && g > 200 && b > 200) labelLight++;
        if (r < 90 && g < 90 && b < 110) labelDark++;
      }
      const report = { time, timestamp, background: pixel(240, 120), point: pixel(120, 80), labelLight, labelDark };
      if (withReference) {
        const { SnapshotRenderer } = await import("./src/compiler/snapshot-renderer.js");
        const renderer = new SnapshotRenderer();
        try {
          const scene = window.__leptonDebug.scene();
          const values = { bounce: time === 0 ? 0.8 : 0.4, cycle: time === 0 ? 0.8 : 0.2, travel: 2 + 1.5 * time };
          for (const entry of scene.functions) if (entry.id in values) entry.expression = String(values[entry.id]);
          renderer.setScene(scene);
          const rendered = await renderer.render({ width, height, bounds: renderer.runtime.sceneViewport(), points: true, grid: false });
          report.reference = [...rendered.canvas.getContext("2d").getImageData(240, 120, 1, 1).data];
          report.shaderLength = rendered.sourceLength;
          report.hasErrors = rendered.diagnostics.hasErrors;
        } finally { renderer.dispose(); }
      }
      samples.push(report);
    }
    const duration = await input.getDurationFromMetadata();
    input.dispose();
    return { width, height, duration, packets, samples, bytes: data.length };
  }, { base64, withReference, sampleTimes });
}

async function check(name, callback) {
  const errorsBefore = pageErrors.length;
  try {
    await callback();
    assert.deepEqual(pageErrors.slice(errorsBefore), [], "Uncaught browser error");
    reports.push({ name, passed: true });
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push({ name, message: error.stack });
    console.error(`FAIL - ${name}\n${error.stack}`);
    try { await page.screenshot({ path: `${output}/failure-${++sequence}.png`, fullPage: true }); } catch { /* The browser may already be gone. */ }
    try {
      if (await page.locator(".video-export-dialog").count()) {
        if (await page.locator(".video-export-restore").isVisible()) await page.locator(".video-export-restore").click();
        dialogAnswers.push(true);
        await page.locator(".video-export-dialog [data-close]").click({ timeout: 2000 });
      }
    } catch { /* The next case navigates to a fresh scene. */ }
  }
}

try {
  browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  // Other agents may edit the dev tree while this runs. Disable dev-only hot reload so it
  // cannot destroy an active export. The application and worker modules are served unchanged.
  await context.route("**/@vite/client", (route) => route.fulfill({ contentType: "text/javascript",
    body: "export const injectQuery = (url) => url; export const createHotContext = () => ({accept(){},dispose(){}});" }));
  page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("worker", (worker) => workerUrls.push(worker.url()));
  page.on("dialog", async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    const answer = dialogAnswers.shift();
    if (answer === false || (dialog.type() === "prompt" && answer === undefined)) await dialog.dismiss();
    else await dialog.accept(typeof answer === "string" ? answer : undefined);
  });

  await check("video menu is conditional on actual time entries, including closed folders", async () => {
    await load("slider t = 1 {range=0~10}\nexpression surface = x\n// time comment = 1\ndraw(surface)");
    assert.equal(await page.locator('[data-action="export-video"]').count(), 0);
    assert.equal(await page.locator('[data-action="export-graph"]').textContent(), "Export photo");
    await load();
    assert.equal(await page.locator('[data-action="export-video"]').count(), 1);
    assert.equal(await page.locator('[data-entry-kind="functions"] [data-field$="expression"]').count() >= 1, true);
    const snapshot = await page.evaluate(() => window.__leptonDebug.scene());
    assert.equal(snapshot.folders[0].collapsed, true);
    const panel = await openPanel();
    assert.deepEqual(await panel.locator("[data-time-id]").evaluateAll((inputs) => inputs.map((input) => [input.dataset.timeId, input.value])),
      [["bounce", "0.25"], ["cycle", "0.2"], ["travel", "1"]]);
    const modes = await panel.locator(".video-time-start small").allTextContents();
    assert(modes[0].includes("bounded") && modes[0].includes("2 units/second"));
    assert(modes[1].includes("bounded looped") && modes[2].includes("unbounded"));
    assert(workerUrls.some((url) => url.includes("/src/video/scene-worker.js")));
    await panel.locator("[data-close]").click();
  });

  await check("duration, frame-rate, quality presets and custom size preserve settings aspect", async () => {
    await load();
    const before = await state();
    const panel = await openPanel();
    await panel.locator('[name="duration"]').fill("1.25");
    for (const [preset, size] of [["720", "720 x 360"], ["1080", "1080 x 540"], ["2160", "2160 x 1080"]]) {
      await panel.locator('[name="resolution"]').selectOption(preset);
      await waitUntil(async () => (await panel.locator("[data-size]").textContent()).startsWith(size), `Wrong ${preset} resolution`);
    }
    await panel.locator('[name="fps"]').selectOption("24");
    assert((await panel.locator("[data-size]").textContent()).includes("30 frames"));
    for (const quality of ["compact", "balanced", "high"]) await panel.locator('[name="quality"]').selectOption(quality);
    await panel.locator('[name="resolution"]').selectOption("custom");
    await panel.locator('[name="edge"]').fill("320");
    assert((await panel.locator("[data-size]").textContent()).startsWith("320 x 160"));
    await panel.locator('[name="duration"]').fill("0");
    await waitUntil(() => panel.locator("[data-export]").isDisabled(), "Zero duration enabled export");
    assert.match(await panel.locator("[data-message]").textContent(), /duration/i);
    await panel.locator("[data-close]").click();
    assert.deepEqual(await state(), before, "Panel controls changed the graph, folders, editor state, or saves");
  });

  await check("graph menu visibly distinguishes photo and video export", async () => {
    await load();
    await page.locator(".graph-actions-trigger").hover();
    const sizes = await page.locator('[data-action="export-graph"], [data-action="export-video"]').evaluateAll((buttons) =>
      buttons.map((button) => ({ label: button.textContent.trim(), width: button.clientWidth, contentWidth: button.scrollWidth })));
    assert.equal(sizes.length, 2);
    assert(sizes.every((item) => item.contentWidth <= item.width + 1),
      `Export menu labels are clipped, making photo and video look the same: ${JSON.stringify(sizes)}`);
  });

  await check("minimize and close release the Graph menu so Text remains clickable", async () => {
    await load();
    let panel = await openPanel();
    const menu = page.locator(".graph-actions-menu");
    assert.equal(await menu.evaluate((element) => element.matches(":focus-within")), false,
      "Entering the modal leaves focus in the Graph menu");
    assert.equal(await menu.locator(".graph-actions-popover").evaluate((element) => getComputedStyle(element).visibility), "hidden",
      "The modal leaves the menu visible through its retained hover state");
    const worker = page.workers().find((entry) => entry.url().includes("/src/video/scene-worker.js"));
    assert(worker);
    await panel.locator("[data-minimize]").click();
    assert(await page.locator(".video-export-restore").evaluate((element) => element === document.activeElement),
      "Minimize restored focus to the previous menu action instead of the export progress button");
    assert.equal(await menu.evaluate((element) => element.matches(":focus-within")), false);
    // No force click, scripted focus, or click-outside workaround: this must be reachable normally.
    await page.locator('[data-display-mode="text"]').click();
    assert.equal((await state()).mode, "text");
    panel = await openPanel();
    assert.equal(await panel.count(), 1, "Reopening a minimized export creates another dialog");
    assert.deepEqual(page.workers().filter((entry) => entry.url().includes("/src/video/scene-worker.js")), [worker],
      "Reopening a minimized export creates another worker");
    await panel.locator("[data-close]").click();
    assert(await page.locator('[data-display-mode="text"]').evaluate((element) => element === document.activeElement),
      "Closing export did not return focus to the active editor view");
    await page.locator('[data-display-mode="standard"]').click();
    await page.locator('[data-display-mode="text"]').click();
    assert.equal((await state()).mode, "text");
    // Removing the temporary menu visibility override must not disable future exports.
    panel = await openPanel();
    await panel.locator("h2").hover();
    await page.keyboard.press("Escape");
    assert.equal(await panel.count(), 0);
    await page.locator('[data-display-mode="standard"]').click();
  });

  await check("invalid custom resolution is rejected instead of silently collapsing the export", async () => {
    await load();
    const panel = await openPanel();
    await configure(panel);
    await panel.locator('[name="edge"]').fill("0");
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert(await panel.locator("[data-export]").isDisabled(), "Custom long edge 0 is accepted and silently converted to 2 x 2; invalid input should disable export");
    await panel.locator("[data-close]").click();
  });

  await check("estimate can cancel, recover, and retry without changing source state", async () => {
    await load();
    const before = await state();
    const panel = await openPanel();
    await configure(panel, { duration: "5", edge: "720" });
    // Activate consecutive real click handlers in one task so a fast machine cannot finish before Cancel.
    await panel.evaluate((element) => { element.querySelector("[data-estimate-button]").click(); element.querySelector("[data-cancel]").click(); });
    await waitUntil(async () => /cancelled/i.test(await panel.locator("[data-message]").textContent()), "Estimate cancellation did not finish");
    assert(await panel.locator("[data-estimate-button]").isEnabled(), "Cancelled estimate cannot retry in the same panel");
    await configure(panel);
    await panel.locator("[data-estimate-button]").click();
    await waitUntil(async () => /Estimated export:/.test(await panel.locator("[data-estimate]").textContent()), "Retry did not produce an estimate", jobTimeout);
    assert(await panel.locator("[data-export]").isEnabled());
    await panel.locator("[data-close]").click();
    assert.deepEqual(await state(), before);
  });

  await check("first action click immediately after typing is not swallowed by field blur", async () => {
    await load();
    const panel = await openPanel();
    await configure(panel);
    await panel.locator('[data-time-id="travel"]').fill("sqrt(9)");
    await waitUntil(() => panel.locator("[data-estimate-button]").isEnabled(), "Capability check did not complete");
    await panel.locator("[data-estimate-button]").click();
    await waitUntil(async () => await panel.locator('[name="duration"]').isDisabled()
      || /Estimated export:/.test(await panel.locator("[data-estimate]").textContent()),
    "First Estimate click after editing a start was swallowed; blur/change disables the button before click");
    await waitUntil(async () => /Estimated export:/.test(await panel.locator("[data-estimate]").textContent()),
      "The accepted Estimate action did not finish", jobTimeout);
    await panel.locator("[data-close]").click();
  });

  await check("changing options invalidates a previously measured estimate", async () => {
    await load();
    const panel = await openPanel();
    await configure(panel);
    await panel.locator("[data-estimate-button]").click();
    await waitUntil(async () => /Estimated export:/.test(await panel.locator("[data-estimate]").textContent()), "Estimate did not finish", jobTimeout);
    const previous = await panel.locator("[data-estimate]").textContent();
    await panel.locator('[name="duration"]').fill("20");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.notEqual(await panel.locator("[data-estimate]").textContent(), previous, "An estimate for 0.435 seconds is still presented unchanged after selecting 20 seconds");
    await panel.locator("[data-close]").click();
  });

  await check("invalid bounded starting value fails clearly and corrected values can export", async () => {
    await load();
    const before = await state();
    const panel = await openPanel();
    await configure(panel);
    await panel.locator('[data-time-id="bounce"]').fill("2");
    await settleFields(panel);
    await panel.locator("[data-export]").click();
    await waitUntil(async () => /start|range|between/i.test(await panel.locator("[data-message]").textContent()), "Out-of-range start was not diagnosed");
    await panel.locator('[data-time-id="bounce"]').fill("0.8");
    await settleFields(panel);
    await downloadVideo(panel, "corrected-start");
    await panel.locator("[data-close]").click();
    assert.deepEqual(await state(), before);
  });

  await check("actual worker export applies all starts, bounce/wrap/speed, GPU colours, points and labels", async () => {
    await load();
    const before = await state();
    const panel = await openPanel();
    await configure(panel);
    const exported = await downloadVideo(panel, "three-clocks-points");
    const decoded = await decode(exported.base64, true);
    assert.equal(decoded.width, 320); assert.equal(decoded.height, 160);
    assert.equal(decoded.packets.length, 14);
    assert(Math.abs(decoded.duration - 0.435) < 0.0011);
    for (const sample of decoded.samples) {
      assert.equal(sample.hasErrors, false);
      assert(sample.shaderLength > 200, "Reference was not a generated GLSL scene");
      const expected = sample.time === 0 ? [166, 152, 90] : [102, 56, 108];
      for (let channel = 0; channel < 3; channel++) {
        assert(Math.abs(sample.background[channel] - expected[channel]) <= 12,
          `Clock ${["bounce", "cycle", "travel"][channel]} at ${sample.time}s: expected channel ${expected[channel]}, got ${sample.background[channel]}`);
        assert(Math.abs(sample.background[channel] - sample.reference[channel]) <= 12, "Video differs from the direct snapshot GPU render");
      }
      assert(sample.point[0] > 210 && sample.point[1] < 60 && sample.point[2] < 60, "Visible point is missing from exported video");
      assert(sample.labelLight > 120 && sample.labelDark > 20, "Point coordinate/linked-value label is missing");
    }
    await writeFile(`${output}/decoded.json`, JSON.stringify(decoded, null, 2));
    await panel.locator("[data-close]").click();
    assert.deepEqual(await state(), before, "Video export changed clock starts, scene order, folders, or saved graph state");
  });

  await check("custom fractional FPS and WebM export retain the requested timing", async () => {
    await load();
    const before = await state();
    const panel = await openPanel();
    await configure(panel);
    await panel.locator('[name="fps"]').selectOption("custom");
    await panel.locator('[name="customFps"]').fill("12.5");
    await panel.locator('[name="format"]').selectOption("webm");
    await settleFields(panel);
    assert((await panel.locator("[data-size]").textContent()).includes("6 frames"));
    await panel.locator("[data-estimate-button]").click();
    await waitUntil(async () => /Estimated export:/.test(await panel.locator("[data-estimate]").textContent()), "Fractional-FPS WebM estimate did not finish", jobTimeout);
    assert.doesNotMatch(await panel.locator("[data-estimate]").textContent(), /NaN|Infinity/);
    await waitUntil(() => panel.locator("[data-export]").isEnabled(), "Estimate did not re-enable export");
    const exported = await downloadVideo(panel, "fractional-fps");
    const decoded = await decode(exported.base64);
    assert.equal(decoded.packets.length, 6);
    assert(Math.abs(decoded.duration - 0.435) < 0.0011);
    decoded.packets.forEach((packet, index) => assert(Math.abs(packet.timestamp - index / 12.5) < 0.0011));
    await panel.locator("[data-close]").click();
    assert.deepEqual(await state(), before);
  });

  await check("minimized export keeps its snapshot and clocks while the live graph is edited", async () => {
    await load();
    const panel = await openPanel();
    await configure(panel, { duration: "20" });
    const downloadPromise = page.waitForEvent("download", { timeout: jobTimeout });
    downloadPromise.catch(() => {});
    await panel.locator("[data-export]").click();
    assert(await panel.locator('[name="duration"]').isDisabled(), "Running job leaves its form editable");
    await panel.locator("[data-minimize]").click();
    assert.equal(await panel.isVisible(), false);
    const restore = page.locator(".video-export-restore");
    assert(await restore.isVisible(), "Minimized job has no restore button");
    await page.locator('[data-display-mode="text"]').click();
    const edited = fixture
      .replace("set x_min = -4", "set x_min = -8")
      .replace("set x_max = 4", "set x_max = 8")
      .replace("time bounded bounce = 0.25", "time bounded bounce = 0.9")
      .replace("time bounded_looped cycle = 0.2", "time bounded_looped cycle = 0.1")
      .replace("time unbounded travel = 1 {speed=1.5}", "time unbounded travel = 99 {speed=100}")
      .replace(/^colour timeColour = .*$/m, "colour timeColour = 0~0~255")
      .replace(/^point focus = .*\n/m, "");
    await page.locator("[data-scene-text]").fill(edited);
    await page.locator('[data-action="apply-text"]').click();
    await waitUntil(() => page.evaluate(() => window.__leptonDebug.scene().functions
      .some((entry) => entry.id === "travel" && entry.expression === "99")), "Graph changes were not applied during export");
    const progressAtEdit = await panel.locator("progress").evaluate((element) => element.value);
    assert(progressAtEdit < 0.9, `Export was already ${progressAtEdit * 100}% complete; the late-frame isolation check would be inconclusive`);
    const editedState = await state();
    await restore.click();
    assert(await panel.isVisible());
    assert.equal(await restore.isVisible(), false);
    // A fast encoder may finish during the click's actionability wait. Its controls
    // should unlock on completion; the cancellation case restores a longer active job.
    if (!(await panel.locator("[data-message]").textContent()).startsWith("Exported")) {
      assert(await panel.locator('[name="duration"]').isDisabled(), "Restoring an active job enables its form");
    }
    assert.equal(await panel.locator('[data-time-id="travel"]').inputValue(), "sqrt(4)");
    assert.equal(await panel.locator('[name="duration"]').inputValue(), "20");
    await panel.locator("[data-minimize]").click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    const path = `${output}/minimized-snapshot.${download.suggestedFilename().split(".").at(-1)}`;
    await download.saveAs(path);
    await waitUntil(async () => (await restore.textContent()) === "Video exported", "Minimized job did not report completion");
    await restore.click();
    await waitUntil(() => panel.locator('[name="duration"]').isEnabled(), "Completed job did not unlock its form");
    // This timestamp is beyond the progress observed after applying the editor changes.
    const decoded = await decode((await readFile(path)).toString("base64"), false, [0, 19.4]);
    assert.equal(decoded.width, 320); assert.equal(decoded.height, 160);
    assert.equal(decoded.packets.length, 600);
    decoded.packets.forEach((packet, index) => assert(Math.abs(packet.timestamp - index / 30) < 0.0011,
      `Frame ${index} has an incorrect timestamp: ${packet.timestamp}`));
    for (const sample of decoded.samples) {
      const expected = sample.time === 0 ? [166, 152, 90] : [102, 56, 255];
      expected.forEach((value, channel) => assert(Math.abs(sample.background[channel] - value) <= 12,
        `Editor changes leaked into exported ${["bounded", "looped", "unbounded"][channel]} clock/colour at ${sample.time}s: ${JSON.stringify(sample)}`));
      assert(sample.point[0] > 210 && sample.point[1] < 60 && sample.point[2] < 60, "Deleting a live point removed it from the export snapshot");
      assert(sample.labelLight > 120 && sample.labelDark > 20, "Live editing removed the exported point label");
    }
    await writeFile(`${output}/minimized-decoded.json`, JSON.stringify({ progressAtEdit, decoded }, null, 2));
    await panel.locator("[data-close]").click();
    assert.equal(await restore.count(), 0);
    assert.deepEqual(await state(), editedState, "Export completion overwrote the user's newer editor state");
  });

  await check("closing an active job confirms cancellation and terminates only the export worker", async () => {
    await load();
    await page.locator('[data-display-mode="text"]').click();
    const before = await state();
    const panel = await openPanel();
    await configure(panel, { duration: "30", edge: "720" });
    const worker = page.workers().find((entry) => entry.url().includes("/src/video/scene-worker.js"));
    assert(worker, "Export worker is missing");
    let workerClosed = false, downloads = 0;
    worker.on("close", () => { workerClosed = true; });
    const onDownload = () => { downloads++; };
    page.on("download", onDownload);
    try {
      const dialogCount = dialogs.length;
      await panel.locator("[data-export]").click();
      await panel.locator("[data-minimize]").click();
      await page.locator(".video-export-restore").click();
      assert(await panel.locator('[name="duration"]').isDisabled(), "Restoring an active job enables its form");
      dialogAnswers.push(false);
      await panel.locator("[data-close]").click();
      assert.equal(dialogs.length, dialogCount + 1);
      assert.match(dialogs.at(-1).message, /cancel.*video export/i);
      assert(await panel.isVisible(), "Dismissing cancellation closes the active panel");
      assert(await panel.locator('[name="duration"]').isDisabled());
      assert.equal(workerClosed, false, "Dismissing cancellation terminates the worker");
      dialogAnswers.push(true);
      await panel.locator("[data-close]").click();
      await waitUntil(() => workerClosed, "Confirmed cancellation did not terminate the worker");
      assert.equal(dialogs.length, dialogCount + 2);
      assert.equal(await panel.count(), 0);
      assert.equal(await page.locator(".video-export-restore").count(), 0);
      assert.equal(downloads, 0, "Cancelled job produced a download");
      assert.deepEqual(await state(), before);
      await page.locator("[data-scene-text]").fill(`${fixture}\n// Editor still works after terminating export\n`);
      assert((await page.locator("[data-scene-text]").inputValue()).includes("Editor still works"));
    } finally { page.off("download", onDownload); }
  });

  await check("photo menu exports a nonblank settings-bounds PNG through the snapshot worker", async () => {
    await load();
    const before = await state();
    const downloadPromise = page.waitForEvent("download", { timeout: jobTimeout });
    downloadPromise.catch(() => {});
    await page.locator(".graph-actions-trigger").hover();
    await page.locator('[data-action="export-graph"]').click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    assert(download.suggestedFilename().endsWith(".png"));
    const path = `${output}/snapshot-photo.png`;
    await download.saveAs(path);
    const png = await page.evaluate(async (base64) => {
      const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([data], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
      return { width: canvas.width, height: canvas.height, background: pixel(1200, 600), point: pixel(600, 400) };
    }, (await readFile(path)).toString("base64"));
    assert.equal(png.width, 1600); assert.equal(png.height, 800);
    [78, 56, 60].forEach((expected, index) => assert(Math.abs(png.background[index] - expected) <= 2,
      `Photo bounds/current-clock colour mismatch: ${JSON.stringify(png)}`));
    assert(png.point[0] > 245 && png.point[1] < 10 && png.point[2] < 10, "Photo does not include the visible point");
    assert(workerUrls.some((url) => url.includes("/src/compiler/photo-worker.js")));
    assert.deepEqual(await state(), before);
  });

  await check("unapplied draft guard supports cancel/current/apply without losing text", async () => {
    await load();
    await page.locator('[data-display-mode="text"]').click();
    const text = page.locator("[data-scene-text]");
    const original = await text.inputValue();
    const draft = original.replace(/time unbounded travel = [^\n{]+/, "time unbounded travel = 3 ") + "\n// preserve export draft\n";
    assert.notEqual(draft, original);
    await text.fill(draft);
    const before = await state();
    await openPanel("cancel");
    assert.equal(await page.locator(".video-export-dialog").count(), 0);
    assert.deepEqual(await state(), before);
    let panel = await openPanel("current");
    assert.equal(await panel.locator('[data-time-id="travel"]').inputValue(), "1");
    await panel.locator("[data-close]").click();
    assert.deepEqual(await state(), before);
    await text.focus(); await page.keyboard.press("ControlOrMeta+z");
    assert.equal(await text.inputValue(), original, "Opening/closing export changed the text draft undo history");
    await page.keyboard.press("ControlOrMeta+Shift+z");
    assert.equal(await text.inputValue(), draft, "Export changed the text draft redo history");
    panel = await openPanel("apply");
    assert.equal(await panel.locator('[data-time-id="travel"]').inputValue(), "3");
    await panel.locator("[data-close]").click();
    assert.equal((await state()).mode, "text");
    assert((await text.inputValue()).includes("preserve export draft"));
  });

  await check("escape/close and narrow screens leave controls reachable and preserve the editor", async () => {
    await load();
    const before = await state();
    await page.setViewportSize({ width: 390, height: 740 });
    const panel = await openPanel();
    await configure(panel);
    const box = await panel.boundingBox();
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 741, "Video panel escapes the mobile viewport");
    await panel.locator("[data-export]").scrollIntoViewIfNeeded();
    assert(await panel.locator("[data-export]").isVisible());
    await page.screenshot({ path: `${output}/mobile.png` });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".video-export-dialog").count(), 0);
    await page.setViewportSize({ width: 1400, height: 900 });
    const after = await state();
    assert.equal(after.scene, before.scene); assert.equal(after.storage, before.storage); assert.equal(after.mode, before.mode);
  });

  await writeFile(`${output}/report.json`, JSON.stringify({ base, reports, failures, pageErrors, workerUrls }, null, 2));
  assert.deepEqual(pageErrors, [], "Uncaught browser errors occurred during the integration run");
  if (failures.length) throw new Error(`${failures.length} app video regression(s) failed. See ${output}/report.json`);
  console.log(`All ${reports.length} app video integration checks passed.`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server ? server.httpServer.close(resolve) : resolve());
}
