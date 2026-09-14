import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { preview } from "vite";
import { FUNCTION_REFERENCE } from "../src/reference-data.js";
import { SITE_FILES } from "./site-files.mjs";

const server = process.env.LEPTON_TEST_URL ? null : await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = process.env.LEPTON_TEST_URL ?? server.resolvedUrls.local[0];
const output = "output/playwright/reference";
await mkdir(output, { recursive: true });
let browser;
try {
  const engine = process.env.LEPTON_TEST_BROWSER === "webkit" ? webkit : chromium;
  browser = await engine.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}app.html`);
  await page.waitForFunction(() => Boolean(window.__leptonDebug));
  await page.evaluate((examples) => {
    for (const { name, example, expected } of examples) {
      const source = `expression eq = ${example}\ncolour c = 128+3*x~0~0\ndraw(eq){colour=c}\nset show_coordinate_grid = False`;
      const pixels = window.__leptonDebug.renderSceneToPixels(source, 16, 16);
      const actual = pixels.data[(8 * 16 + 8) * 4];
      if (Math.abs(actual - (128 + 3 * expected)) > 1.5) throw new Error(`${name}: GPU ${actual}, expected ${128 + 3 * expected}`);
    }
    for (const [expr, expected] of [["atan2(1,0)", 90], ["atan2(0,-1)", 180], ["atan2(0,0)", 0], ["atan2(-1,-1)+180", 45]]) {
      const source = `set angle_mode = degrees\nfunction angle(a,b) = atan2(a,b)\nexpression eq = ${expr.replaceAll("atan2", "angle")}\ncolour c = x~0~0\ndraw(eq){colour=c}\nset show_coordinate_grid = False`;
      const pixels = window.__leptonDebug.renderSceneToPixels(source, 16, 16);
      if (Math.abs(pixels.data[(8 * 16 + 8) * 4] - expected) > 1) throw new Error(`Degree-mode ${expr} failed`);
    }
    const pixels = window.__leptonDebug.renderSceneToPixels("list amounts = [0,0.5,1]\nexpression eq = sum(i=0~2){mix(10,20,amounts[i])}\ncolour c = x~0~0\ndraw(eq){colour=c}\nset show_coordinate_grid = False", 16, 16);
    if (Math.abs(pixels.data[(8 * 16 + 8) * 4] - 45) > 1) throw new Error("List interpolation/reduction GPU mismatch");
  }, FUNCTION_REFERENCE);
  console.log(`ok - ${FUNCTION_REFERENCE.length} documented examples, atan2 quadrants/degrees and collection interpolation have correct GPU pixels`);

  for (const input of ["atan2(1,-1)", "log2(8)", "log10(100)", "hypot(3,4)", "smoothstep(0,1,0.5)", "step(0.5,1)", "mix(10,20,0.25)", "lerp(10,20,0.25)"]) {
    await page.goto(`${base}app.html?scene=${encodeURIComponent("expression eq = ")}`);
    const field = page.locator('.mathquill-field[data-field="functions.0.expression"]');
    await field.locator(".mq-root-block").waitFor();
    await field.click();
    await page.keyboard.type(input);
    await page.waitForTimeout(60);
    await page.locator('[data-display-mode="text"]').click();
    let text = await page.locator("[data-scene-text]").inputValue();
    assert(text.includes(`expression eq = ${input}`), `${input} typed as ${text}`);
    await page.locator('[data-display-mode="standard"]').click();
    assert(await field.locator(".mq-root-block").count() === 1);
    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.type("+1");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.locator('[data-display-mode="text"]').click();
    text = await page.locator("[data-scene-text]").inputValue();
    assert(text.includes(`expression eq = ${input}`), `${input} was changed after editing`);
  }
  console.log("ok - every new function supports actual typing, structured reload, continued edits and backspace");

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(`${base}app.html?scene=${encodeURIComponent("expression eq = 1")}`);
    const field = page.locator('.mathquill-field[data-field="functions.0.expression"]');
    await field.locator(".mq-root-block").waitFor();
    await field.click();
    await page.keyboard.press("End");
    await page.keyboard.type("+");
    await page.locator('[data-action="toggle-keyboard"]').click();
    const body = page.locator(".keyboard-body");
    const originalViewport = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    const extra = page.locator(".keyboard-extra summary");
    await extra.scrollIntoViewIfNeeded();
    await extra.click();
    await body.evaluate((el) => { el.scrollTop = 0; });
    await body.hover();
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(150);
    const scroll = await body.evaluate((el) => ({ top: el.scrollTop, height: el.clientHeight, total: el.scrollHeight }));
    assert(scroll.total > scroll.height && scroll.top > 0, `Keyboard did not scroll at ${width}: ${JSON.stringify(scroll)}`);
    assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), originalViewport, "Keyboard wheel zoomed the graph");
    await page.screenshot({ path: `${output}/keyboard-${width}.png` });
    const key = page.locator('.keyboard-key[data-key="log10"]');
    await key.click();
    await page.keyboard.type("100)");
    await page.locator('[data-action="close-keyboard"]').click();
    await page.locator('[data-display-mode="text"]').click();
    const keyboardText = await page.locator("[data-scene-text]").inputValue();
    assert(keyboardText.includes("1+log10(100)"), `Keyboard lost target or digit function: ${keyboardText}`);
  }
  console.log("ok - keyboard scrolls at desktop/mobile sizes, retains its target and does not zoom the graph");

  if (engine === chromium) {
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true });
    const touchPage = await touchContext.newPage();
    await touchPage.goto(`${base}app.html`);
    await touchPage.locator('[data-action="toggle-keyboard"]').tap();
    const body = touchPage.locator(".keyboard-body");
    await touchPage.locator(".keyboard-extra summary").scrollIntoViewIfNeeded();
    await touchPage.locator(".keyboard-extra summary").tap();
    await body.evaluate((el) => { el.scrollTop = 0; });
    const box = await body.boundingBox();
    const session = await touchContext.newCDPSession(touchPage);
    const start = { x: box.x + box.width / 2, y: box.y + box.height - 20 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let i = 1; i <= 12; i += 1) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y - i * 15 }] });
      await touchPage.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert(await body.evaluate((el) => el.scrollTop > 30), "Touch swipe did not scroll the keyboard");
    await touchContext.close();
    console.log("ok - a touch swipe scrolls the calculator on a phone-sized viewport");
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector("[data-sample]")?.href.includes("sample="));
  await page.screenshot({ path: `${output}/home-1440.png` });
  await page.setViewportSize({ width: 390, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Homepage overflows viewport");
  await page.screenshot({ path: `${output}/home-390.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  const samples = await page.locator("[data-sample]").evaluateAll((links) => links.map((link) => ({ id: link.dataset.sample, url: link.href })));
  for (const sample of samples) {
    await page.goto(sample.url);
    await page.waitForFunction(() => window.__leptonDebug?.scene().draws.length > 0);
    const scene = await page.evaluate(() => window.__leptonDebug.scene());
    assert(scene.functions.length > 0, `${sample.id}: sample was blank`);
    const image = await page.evaluate(async () => {
      const canvas = document.querySelector(".grid-canvas");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const copy = document.createElement("canvas");
      copy.width = 80; copy.height = 50;
      const context = copy.getContext("2d");
      context.drawImage(canvas, 0, 0, 80, 50);
      const data = context.getImageData(0, 0, 80, 50).data;
      const colours = new Set();
      for (let index = 0; index < data.length; index += 4) colours.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
      return colours.size;
    });
    // The Mandelbrot preview is intentionally almost monochrome at this scale.
    assert(image > 2, `${sample.id}: sample canvas was blank or uniform (${image} colours)`);
    assert(!(await page.locator(".render-overlay").allTextContents()).join(" ").includes("Some layers skipped"), `${sample.id}: scene has rendering errors`);
    const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
    assert(favicon.includes("lepton-favicon.png"), `${sample.id}: missing logo`);
    assert.equal(await page.title(), "Lepton Grapher");
  }
  for (const file of SITE_FILES) {
    assert.equal((await page.request.get(new URL(file, base).href)).status(), 200, `Public file missing: ${file}`);
  }
  console.log(`ok - all ${samples.length} gallery graphs load nonblank with Lepton favicons; all ${SITE_FILES.length} public files are reachable`);
  await page.goto(base);
  const link = page.getByRole("link", { name: "What functions are there?" });
  await link.click();
  await page.waitForURL("**/reference.html*");
  assert.equal(await page.title(), "Lepton Reference");
  assert.equal(await page.locator(".function-entry").count(), FUNCTION_REFERENCE.length);
  const response = await page.request.get(page.url());
  assert((await response.text()).includes('id="fn-atan2"'), "Published HTML lacks the no-JS function catalogue");
  const search = page.locator("[data-function-search]");
  await search.fill("distance");
  assert(await page.locator("#fn-hypot").isVisible());
  await search.fill("no-such-function-abcdef");
  assert(await page.locator("[data-no-functions]").isVisible());
  await page.locator("[data-clear-search]").click();
  assert.equal(await page.locator(".function-entry:visible").count(), FUNCTION_REFERENCE.length);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Reference overflows viewport");
    await page.screenshot({ path: `${output}/reference-${width}.png` });
  }
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  assert.equal((await page.request.get(new URL(favicon, page.url()).href)).status(), 200);
  await page.goto(`${base}app.html`);
  await page.locator('[data-action="tutorial"]').click();
  const reference = page.locator('.tutorial-actions a[href*="reference.html"]');
  assert(await reference.isVisible());
  assert.equal(await reference.getAttribute("target"), "_blank", "Reference should not replace an unsaved graph");
  assert.equal(await page.title(), "Lepton Grapher");
  assert.deepEqual(errors, []);
  console.log("ok - homepage/tutorial links, complete searchable reference, responsive layout, favicon and Grapher branding");
} finally {
  await browser?.close();
  await server?.close();
}
