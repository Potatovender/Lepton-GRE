import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

const server = process.env.LEPTON_TEST_URL ? null : await preview({ preview: { host: "127.0.0.1", port: 0 } });
const base = process.env.LEPTON_TEST_URL ?? server.resolvedUrls.local[0];
const output = "output/playwright/status-flags";
await mkdir(output, { recursive: true });
let browser, page;
try {
  const engine = process.env.LEPTON_TEST_BROWSER === "webkit" ? webkit : chromium;
  browser = await engine.launch({ executablePath: process.env.LEPTON_BROWSER_EXECUTABLE || undefined });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const source = `set max_recursion = 13
expression broken = sin(
expression good = 1
expression twopi = 2
expression recur = recur+recur+1
slider slide = 5 {range=10~0}
function fn(a) = missing+a
colour ink = 255~missing+~0
boundary edge = missing
transparency fade = missing
point p = [missing,0]
list values = [missing,1]
draw(broken)
folder Problems = {
  expression child = missing
}`;
  await page.goto(`${base}app.html?scene=${encodeURIComponent(source)}`);
  await page.locator('.mathquill-field .mq-root-block').first().waitFor();
  const sceneBefore = await page.evaluate(() => JSON.stringify(window.__leptonDebug.scene()));
  const tooltip = page.locator("#lepton-help-tooltip");
  const flags = page.locator('.expression-row > .entry-row-grip > [data-status-message]');
  await flags.and(page.locator('.invalid')).first().waitFor();
  assert.equal(await flags.count(), 13, "Missing row flags (closed folder contents should stay hidden)");
  for (const state of ["invalid", "warning", "info", "valid"]) {
    assert(await flags.and(page.locator(`.${state}`)).count() > 0, `No ${state} fixture`);
  }
  for (const flag of await flags.all()) {
    const message = await flag.getAttribute("data-status-message");
    await flag.click();
    assert.equal(await flag.getAttribute("aria-expanded"), "true");
    assert.equal(await tooltip.textContent(), message);
    assert(await tooltip.isVisible(), "Click did not immediately show the diagnostic");
    await page.mouse.move(1100, 50);
    assert(await tooltip.isVisible(), "Click-opened diagnostic disappeared on mouseleave");
    await page.keyboard.press("Escape");
    assert(!(await tooltip.isVisible()), "Escape did not dismiss diagnostic");
  }
  assert.equal(await page.evaluate(() => JSON.stringify(window.__leptonDebug.scene())), sceneBefore, "Flag clicks changed graph data or ordering");
  assert.equal(await page.locator('.expression-row-drag-image').count(), 0, "Flag click began a row drag");

  const first = flags.first();
  await first.focus();
  await page.keyboard.press("Enter");
  assert(await tooltip.isVisible(), "Keyboard Enter did not show details");
  await page.keyboard.press("Space");
  assert(!(await tooltip.isVisible()), "Second activation did not dismiss details");
  await first.click();
  await page.mouse.click(1100, 50);
  assert(!(await tooltip.isVisible()), "Outside click did not dismiss details");
  await first.hover();
  await tooltip.waitFor({ state: "visible" });
  await first.click();
  await page.mouse.move(1100, 50);
  assert(await tooltip.isVisible(), "Clicking a hovered flag should pin, not close, the message");
  await page.keyboard.press("Escape");

  // Live validation previously changed the colour but left its click message stale.
  const field = page.locator('[data-field="colors.0.green"]');
  const channel = page.locator('[data-color-channel="0.green"] [data-status-message]');
  await field.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("2");
  await page.waitForFunction(() => document.querySelector('[data-color-channel="0.green"] .entry-status')?.classList.contains("valid"));
  await channel.click();
  assert.equal(await tooltip.textContent(), "status: valid");
  await field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("+");
  await page.waitForFunction(() => document.querySelector('[data-color-channel="0.green"] .entry-status')?.classList.contains("invalid"));
  await channel.click();
  assert.match(await tooltip.textContent(), /operator/i);

  // Clicking diagnostics must not consume the surrounding grip's drag behavior.
  await page.keyboard.press("Escape");
  const goodRow = page.locator('[data-entry-kind="functions"][data-entry-index="1"]');
  const grip = goodRow.locator('.entry-row-grip');
  await grip.scrollIntoViewIfNeeded();
  const start = await grip.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + 5);
  await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y + 10, { steps: 3 });
  assert.equal(await page.locator('.expression-row-drag-image').count(), 1, "Surrounding grip no longer starts a drag");
  await page.mouse.move(1100, 50);
  await page.mouse.up();

  await page.goto(`${base}app.html?scene=${encodeURIComponent("set aspect_ratio = nope\nexpression eq = 1")}`);
  await page.locator('[data-action="toggle-settings-panel"]').first().click();
  const settingsFlag = page.locator('.settings-section-title [data-status-message]');
  await settingsFlag.and(page.locator('.invalid')).waitFor();
  await settingsFlag.click();
  assert(await tooltip.isVisible(), "Settings flag did not open");
  assert.match(await tooltip.textContent(), /ratio/i);
  await page.screenshot({ path: `${output}/desktop.png` });

  await page.setViewportSize({ width: 390, height: 740 });
  await settingsFlag.click();
  const box = await tooltip.boundingBox();
  assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 741, "Diagnostic escaped mobile viewport");
  await page.screenshot({ path: `${output}/mobile.png` });
  assert.deepEqual(errors, [], "Browser errors");
  console.log("ok - row/channel/settings status clicks, keyboard, hover, dismissal, live diagnostics, drag handles and mobile placement");
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${output}/failure.png` });
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server ? server.httpServer.close(resolve) : resolve());
}
