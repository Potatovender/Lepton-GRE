import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer, preview } from "vite";
import { SITE_FILES } from "./site-files.mjs";

// Run against the staged release by default, or a deployed build via the URL.
const server = process.env.LEPTON_TEST_URL ? null : await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = process.env.LEPTON_TEST_URL ?? server.resolvedUrls.local[0];
const output = "output/playwright/editor-regression";
await mkdir(output, { recursive: true });
let browser;
let activePage;
try {
  const engine = process.env.LEPTON_TEST_BROWSER === "webkit" ? webkit : chromium;
  browser = await engine.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined });
  for (const [width, sidebar] of [[1440, 380], [1440, 760], [1440, 1100], [390, 380]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript((value) => localStorage.setItem("lepton-sidebar-width", String(value)), sidebar);
    const page = activePage = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    const formula = Array.from({ length: 90 }, (_, index) => `${index + 1}x`).join("+");
    await page.goto(`${base}app.html?scene=${encodeURIComponent(`expression eq = ${formula}`)}`);
    const field = page.locator('.mathquill-field[data-field="functions.0.expression"]');
    await field.locator(".mq-root-block").waitFor();
    await field.click();
    await page.keyboard.press("End");
    await settle(page);

    // Move left through the *visible* expression. Neither arrows nor subsequent
    // typing should reset the viewport toward the hidden native textarea.
    let before = await geometry(field);
    for (let index = 0; index < 180 && before.caret > before.width * 0.55; index += 1) {
      const previousScroll = before.scroll;
      await page.keyboard.press("ArrowLeft");
      await settle(page);
      before = await geometry(field);
      assert(Math.abs(before.scroll - previousScroll) < 2, "ArrowLeft scrolled despite visible caret");
    }
    assert(before.caret > 30 && before.caret < before.width * 0.6, "Could not place caret in the middle");
    await page.keyboard.type("23");
    await settle(page);
    const after = await geometry(field);
    assert(Math.abs(after.scroll - before.scroll) < 2, `Typing jumped: ${JSON.stringify({ before, after })}`);
    assert(after.caret > before.caret && after.caret < before.width - 20, "Lost surrounding equation context");
    await page.keyboard.press("Backspace");
    await settle(page);
    assert(Math.abs((await geometry(field)).scroll - before.scroll) < 2, "Backspace jumped");

    await page.keyboard.press("Home");
    await settle(page);
    const start = await geometry(field);
    assert(start.caret >= 0 && start.caret < 30, "Home did not reveal start");
    await page.keyboard.press("End");
    await settle(page);
    const end = await geometry(field);
    assert(end.caret > 0 && end.caret < end.width, "End did not reveal caret");
    await page.keyboard.type("+1");
    await settle(page);
    const extended = await geometry(field);
    assert(extended.caret > 0 && extended.caret < extended.width, "Typing at edge hid caret");
    assert(extended.scroll > end.scroll && extended.scroll - end.scroll < 60, "Edge scrolling overshot");

    // Select across both edges with real pointer input, not a synthetic selection.
    const box = await field.boundingBox();
    await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 15, box.y + box.height / 2, { steps: 25 });
    const leftStart = (await geometry(field)).scroll;
    for (let index = 0; index < 20; index += 1) {
      await page.mouse.move(box.x + 2, box.y + box.height / 2 + index % 2);
    }
    const leftEnd = (await geometry(field)).scroll;
    assert(leftEnd < leftStart && leftStart - leftEnd < 250, "Left drag did not scroll smoothly");
    assert(await field.locator(".mq-selection").count() > 0, "Leftward selection disappeared");
    await page.mouse.up();
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    await page.mouse.move(box.x + 25, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 25 });
    const rightStart = (await geometry(field)).scroll;
    for (let index = 0; index < 20; index += 1) {
      await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2 + index % 2);
    }
    const rightEnd = (await geometry(field)).scroll;
    assert(rightEnd > rightStart && rightEnd - rightStart < 250, "Right drag overshot or stalled");
    await page.mouse.up();
    assert.deepEqual(errors, [], "Browser errors");
    await page.screenshot({ path: `${output}/editor-${width}-${sidebar}.png` });
    console.log(`ok - caret context, edges and bidirectional selection at viewport ${width}, sidebar ${sidebar}`);
    await context.close();
  }

  const page = activePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}app.html`);
  for (let index = 0; index < 3; index += 1) {
    await page.locator('[data-display-mode="text"]').click();
    await page.locator("[data-scene-text]").fill("expression eq = (2^3)^2+frac{x}{sqrt(y^2+1)}\ndraw(eq)");
    await page.locator('[data-action="apply-text"]').click();
    assert(await page.locator("[data-scene-text]").isVisible(), "Apply changed mode");
    await page.locator('[data-display-mode="standard"]').click();
    const field = page.locator('.mathquill-field[data-field="functions.0.expression"]');
    assert.equal(await field.locator(".mq-fraction").count(), 1);
    assert.equal(await field.locator(".mq-sqrt-prefix").count(), 1);
    await page.locator('[data-display-mode="text"]').click();
    await page.locator('[data-action="refresh-text"]').click();
    assert((await page.locator("[data-scene-text]").inputValue()).includes("(2^3)^2"), "Grouped power lost on refresh");
  }
  console.log("ok - repeated Apply/Reload mounts fractions, roots and grouped exponents");

  const longValue = Array.from({ length: 40 }, (_, index) => index + 1).join("+");
  await page.locator('[data-display-mode="text"]').click();
  await page.locator("[data-scene-text]").fill([
    `expression eq = ${longValue}`,
    `function fn(q) = ${longValue}+q`,
    `colour c = ${longValue}~${longValue}~${longValue}`,
    `boundary b = ${longValue}`,
    `transparency tr = ${longValue}`,
    `point p = [${longValue},${longValue}]`
  ].join("\n"));
  await page.locator('[data-action="apply-text"]').click();
  await page.locator('[data-display-mode="standard"]').click();
  const fieldNames = await page.locator(".mathquill-field").evaluateAll((fields) => fields.map((field) => field.dataset.field));
  assert(fieldNames.length >= 9, "Not all data types mounted");
  for (const name of fieldNames) {
    const field = page.locator(`.mathquill-field[data-field="${name}"]`);
    await field.click();
    await page.keyboard.press("End");
    await settle(page);
    const box = await field.boundingBox();
    await field.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await settle(page);
    const before = await geometry(field);
    await page.keyboard.type("2");
    await settle(page);
    const after = await geometry(field);
    assert(Math.abs(after.scroll - before.scroll) < 2, `${name}: typing scrolled despite room`);
  }
  console.log("ok - middle editing across expressions, functions, colour channels, boundaries, transparency and point coordinates");

  await page.evaluate(() => {
    for (const [source, expected] of [
      ["expression eq = (2^3)^2\ncolour c = x~0~0\ndraw(eq){colour=c}", 64],
      ["function increment(pi) = pi+1\nexpression eq = increment(2)\ncolour c = 10*x~0~0\ndraw(eq){colour=c}", 30]
    ]) {
      const pixels = window.__leptonDebug.renderSceneToPixels(source, 16, 16);
      const value = pixels.data[(8 * 16 + 8) * 4];
      if (Math.abs(value - expected) > 1) throw new Error(`GPU returned ${value}, expected ${expected}`);
    }
  });
  console.log("ok - grouped powers and local constant shadowing produce the correct GPU pixels");

  if (!process.env.LEPTON_TEST_URL) {
    const dev = await createServer({ server: { host: "127.0.0.1", port: 0 } });
    try {
      await dev.listen();
      for (const file of SITE_FILES.filter((file) => file.startsWith("sample code/"))) {
        const response = await fetch(new URL(file, dev.resolvedUrls.local[0]));
        assert(response.ok, `Sample request failed: ${file}`);
        assert.equal(await response.text(), await readFile(file, "utf8"), `Development server modified ${file}`);
      }
      console.log("ok - development server serves all nine sample sources byte-for-byte without injected comments");
    } finally {
      await dev.close();
    }
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${output}/failure.png` });
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server ? server.httpServer.close(resolve) : resolve());
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function geometry(field) {
  return field.evaluate((element) => ({
    scroll: element.scrollLeft,
    width: element.clientWidth,
    caret: element.querySelector(".mq-cursor")?.getBoundingClientRect().left - element.getBoundingClientRect().left
  }));
}
