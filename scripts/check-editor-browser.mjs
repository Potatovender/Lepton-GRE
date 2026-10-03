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

  // Notices are optional siblings: none may take the flexible editor's height.
  for (const [width, height] of [[1440, 900], [1920, 1200], [390, 844], [320, 568]]) {
    const page = activePage = await browser.newPage({ viewport: { width, height } });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`${base}app.html`);
    await page.locator('[data-display-mode="text"]').click();
    const initial = await assertTextLayout(page, "initial");
    await page.locator('[data-scene-text]').fill("expression eq = x\ndraw(eq)");
    await page.locator('[data-action="apply-text"]').click();
    assert.equal(await page.locator('.text-apply-notice').textContent(), "Applied to graph.");
    const applied = await assertTextLayout(page, "applied");
    assert(initial.editor.height - applied.editor.height < 70, "Apply notice stole the editor height");
    await page.screenshot({ path: `${output}/text-applied-${width}-${height}.png` });
    await page.locator('[data-action="refresh-text"]').click();
    await assertTextLayout(page, "reloaded");
    await page.locator('[data-scene-text]').fill(`expression eq = x\nunknown ${"long_unrecognized_text".repeat(20)}`);
    await page.locator('[data-action="apply-text"]').click();
    assert.match(await page.locator('.text-apply-notice').textContent(), /not recognized/);
    await assertTextLayout(page, "long import warning");
    await page.locator('[data-scene-text]').fill("expression eq = x+2");
    await page.locator('[data-display-mode="standard"]').click();
    assert(await page.locator('.text-draft-warning').isVisible());
    await assertTextLayout(page, "unapplied draft warning");
    await page.close();
    console.log(`ok - Text editor keeps its space after Apply, Reload and warnings at ${width}x${height}`);
  }

  const page = activePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const sessionErrors = [];
  page.on("pageerror", (error) => sessionErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}app.html?scene=${encodeURIComponent("expression amplitude = 2\nexpression eq = ")}`);
  const knownReferenceField = page.locator('.mathquill-field[data-field="functions.1.expression"]');
  await knownReferenceField.locator(".mq-root-block").waitFor();
  await knownReferenceField.click();
  await page.keyboard.type("amplitude+1");
  await settle(page);
  const typedPresentation = await knownReferenceField.evaluate((field) => ({
    latex: field.mathquillInstance.latex(),
    operatorText: [...field.querySelectorAll(".mq-operator-name")].map((part) => part.textContent).join("")
  }));
  assert(typedPresentation.latex.includes("\\operatorname{amplitude}"), typedPresentation.latex);
  assert(typedPresentation.operatorText.includes("amplitude"), typedPresentation.operatorText);
  await page.locator('[data-display-mode="text"]').click();
  assert((await page.locator("[data-scene-text]").inputValue()).includes("expression eq = amplitude+1"), "Upright value changed the source text");
  console.log("ok - declared values become upright while preserving plain Lepton source");

  await page.locator('[data-display-mode="standard"]').click();
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
    `colourhsv ch = ${longValue}~${longValue}~${longValue}`,
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
      ["function increment(pi) = pi+1\nexpression eq = increment(2)\ncolour c = 10*x~0~0\ndraw(eq){colour=c}", 30],
      ["expression eq = mod(-1,5)\ncolour c = 10*x~0~0\ndraw(eq){colour=c}", 40]
    ]) {
      const pixels = window.__leptonDebug.renderSceneToPixels(source, 16, 16);
      const value = pixels.data[(8 * 16 + 8) * 4];
      if (Math.abs(value - expected) > 1) throw new Error(`GPU returned ${value}, expected ${expected}`);
    }
  });
  console.log("ok - grouped powers and local constant shadowing produce the correct GPU pixels");

  await page.evaluate(() => {
    for (const [hsv, expected] of [
      ["0~1~1", [255, 0, 0]], ["120~1~1", [0, 255, 0]],
      ["240~1~1", [0, 0, 255]], ["-60~2~3", [255, 0, 255]],
      ["720~1~1", [255, 0, 0]], ["30~0.5~0.8", [204, 153, 102]],
      ["20~-1~0.5", [128, 128, 128]], ["20~1~-1", [0, 0, 0]],
      ["120*x~1~1", [0, 255, 0]]
    ]) {
      const pixels = window.__leptonDebug.renderSceneToPixels(`expression eq = 1\ncolourhsv pigment = ${hsv}\ndraw(eq) {colour=pigment}`, 16, 16);
      const rgb = Array.from(pixels.data.slice((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 3));
      if (rgb.some((value, i) => Math.abs(value - expected[i]) > 1)) throw new Error(`HSV ${hsv}: ${rgb}, expected ${expected}`);
    }
    const bg = window.__leptonDebug.renderSceneToPixels("set background_color = pigment\ncolourhsv pigment = 240~1~1", 16, 16);
    if (bg.data[(8 * 16 + 8) * 4 + 2] !== 255) throw new Error("HSV background not rendered");
  });
  console.log("ok - HSV GPU pixels wrap hue, clamp S/V and map draw values correctly");

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}app.html?scene=expression%20eq%20%3D%20x`);
    const chooser = page.locator(".new-entry-menu");
    await chooser.locator("summary").click();
    assert.equal(await chooser.locator('[data-add="points"]').isVisible(), false, "Points leaked into quick menu");
    await chooser.locator('[data-more-data="true"]').click();
    await assertMenuFits(chooser.locator(".new-entry-popover"), width);
    await page.screenshot({ path: `${output}/more-data-${width}.png` });
    await chooser.locator('[data-add="colourhsv"]').click();
    const hue = page.locator('.mathquill-field[data-field="colors.0.hue"]');
    await hue.locator(".mq-root-block").waitFor();
    await hue.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Delete");
    await page.keyboard.type("120");
    await page.locator('[data-display-mode="text"]').click();
    let text = await page.locator("[data-scene-text]").inputValue();
    assert(text.includes("colourhsv c1 = 120~1~1"), text);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.locator('[data-action="apply-text"]').click();
      await page.locator('[data-display-mode="standard"]').click();
      await hue.locator(".mq-root-block").waitFor();
      const typeMenu = page.locator('[data-type-menu="colors.0"]');
      await typeMenu.locator("summary").click();
      await typeMenu.locator('[data-more-data="true"]').click();
      await assertMenuFits(typeMenu.locator(".entry-type-popover"), width);
      await typeMenu.locator('[data-change-entry-kind="colors.0.colourhsv"]').click();
      await page.locator('[data-display-mode="text"]').click();
      await page.locator('[data-action="refresh-text"]').click();
      assert.equal(await page.locator("[data-scene-text]").inputValue(), text, "Type reselect/Apply/Reload lost HSV source");
    }
    await page.locator('[data-display-mode="standard"]').click();
    await chooser.locator("summary").click();
    await chooser.locator('[data-more-data="true"]').click();
    await chooser.locator('[data-add="points"]').click();
    await page.locator('.mathquill-field[data-field="points.0.x"] .mq-root-block').waitFor();
    await chooser.locator("summary").click();
    await page.keyboard.press("Escape");
    assert.equal(await chooser.getAttribute("open"), null, "Escape did not close menu");
    await page.screenshot({ path: `${output}/hsv-data-${width}.png` });
    console.log(`ok - More data, real HSV typing, points and lossless type selection at ${width}px`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-display-mode="text"]').click();
  await page.locator("[data-scene-text]").fill(`set show_coordinate_grid = False
folder Colours = {
  // Gradient
  time unbounded pulse = 0 {speed=1}
  expression eq = x+sin(y)+pulse
  colourhsv pigment = 180+90*x~0.8~1
  colour legacy = 12~34~56
  boundary gate = 1
  transparency fade = 0
  function sampleValue(a,b) = a+b
  point p = [0,0] {colour=pigment, link=sampleValue, show_label=True}
  draw(eq) {colour=pigment, boundary=gate, transparency=fade}
}`);
  await page.locator('[data-action="apply-text"]').click();
  await page.locator('[data-action="refresh-text"]').click();
  const savedSource = await page.locator("[data-scene-text]").inputValue();
  await page.locator('[data-display-mode="standard"]').click();
  await page.locator(".graph-actions-trigger").hover();
  await page.locator('[data-action="open-save-dialog"]').click();
  await page.locator("[data-save-name]").fill("HSV persistence regression");
  await page.locator('[data-action="confirm-save-graph"]').click();
  await page.reload();
  await page.locator(".graph-actions-trigger").hover();
  await page.locator('[data-action="open-library"]').click();
  const image = page.locator(".saved-graph-thumb").first();
  const preview = await image.evaluate(async (img) => {
    await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d"); context.drawImage(img, 0, 0);
    const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colours = new Set();
    for (let i = 0; i < bytes.length; i += 4) colours.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
    return { width: canvas.width, height: canvas.height, colours: colours.size, size: img.src.length };
  });
  assert(preview.width === 160 && preview.height === 100 && preview.colours > 50 && preview.size < 24000, JSON.stringify(preview));
  await page.locator("[data-load-saved-graph]").first().click();
  const loadedFolder = page.locator('[data-toggle-folder]').first();
  assert.equal(await loadedFolder.getAttribute('aria-expanded'), 'false', "Loaded folder did not start closed");
  await loadedFolder.click();
  await page.waitForFunction((folder) => folder?.getAttribute("aria-expanded") === "true", await loadedFolder.elementHandle());
  const loadedHueRoot = page.locator('.mathquill-field[data-field$=".hue"] .mq-root-block');
  const loadedFieldNames = await page.locator(".mathquill-field[data-field]").evaluateAll((fields) => fields.map((field) => field.dataset.field));
  assert.equal(await loadedHueRoot.count(), 1, JSON.stringify({ loadedFieldNames, sessionErrors }));
  await page.locator('[data-display-mode="text"]').click();
  assert.equal(await page.locator("[data-scene-text]").inputValue(), savedSource, "Save/reload/load lost data");
  console.log("ok - mixed-type saved graph reloads without losing data and retains a compact nonblank preview");

  await page.addInitScript(() => {
    window.__testRenderRequests = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, ...args) {
      if (message?.type === "render") window.__testRenderRequests++;
      return post.call(this, message, ...args);
    };
  });
  await page.goto(`${base}app.html?scene=${encodeURIComponent(`expression root = x
folder Outer = {
  expression inside = y
  folder Inner = {
    expression nested = x+y
  }
}
expression tail = 1
draw(root)`)}`);
  const folderToggles = page.locator('[data-toggle-folder]');
  assert.equal(await folderToggles.count(), 1, "Closed outer folder exposed its nested folder");
  assert.equal(await folderToggles.first().getAttribute('aria-expanded'), 'false', "URL-loaded folder did not start closed");
  await page.waitForFunction(() => window.__leptonWorkerFrame && !document.querySelector('.status-light.pending'));
  await settle(page);
  const beforeFold = await page.evaluate(() => {
    window.__testCanvas = document.querySelector('.grid-canvas');
    window.__testOverlay = document.querySelector('.graph-overlay-canvas');
    return { requests: window.__testRenderRequests, pixels: window.__testCanvas.toDataURL() };
  });
  for (let toggle = 0; toggle < 4; toggle++) {
    await folderToggles.first().click();
    await settle(page);
    const afterFold = await page.evaluate(() => ({
      requests: window.__testRenderRequests,
      pending: document.querySelectorAll('.status-light.pending').length,
      sameCanvas: window.__testCanvas === document.querySelector('.grid-canvas'),
      sameOverlay: window.__testOverlay === document.querySelector('.graph-overlay-canvas'),
      pixels: document.querySelector('.grid-canvas').toDataURL()
    }));
    assert.equal(afterFold.requests, beforeFold.requests, 'Folding scheduled a graph recheck/render');
    assert.equal(afterFold.pending, 0, 'Folding replaced existing flags with pending flags');
    assert(afterFold.sameCanvas && afterFold.sameOverlay, 'Folding discarded the rendered graph');
    assert.equal(afterFold.pixels, beforeFold.pixels, 'Folding changed graph pixels');
  }
  await folderToggles.first().click();
  assert(!(await page.locator('.graph-actions-trigger').evaluate((button) => button.classList.contains('primary'))), "Opening a folder marked unchanged graph data as unsaved");
  assert.equal(await page.locator('[data-toggle-folder]').count(), 2, "Opening the outer folder did not expose its nested folder");
  assert.equal(await page.locator('[data-toggle-folder]').nth(1).getAttribute('aria-expanded'), 'false', "Nested loaded folder did not start closed");
  const inside = page.locator('.mathquill-field[data-field="functions.1.expression"]');
  await inside.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const focused = page.locator('.mathquill-field[data-field="functions.4.expression"]');
  await focused.locator('.mq-root-block').waitFor();
  await settle(page);
  await page.keyboard.type('7');
  await settle(page);
  assert.equal(await focused.getAttribute('data-value'), '7', "Enter did not focus the new line for continued typing");
  await page.waitForFunction((previous) => window.__testRenderRequests > previous, beforeFold.requests);
  const enterPlacement = await page.evaluate(() => {
    const ordered = window.__leptonDebug.scene().dataOrder;
    const functions = window.__leptonDebug.scene().functions;
    const source = ordered.findIndex((ref) => ref.kind === 'functions' && ref.uid === functions[1]._uid);
    const created = ordered.findIndex((ref) => ref.kind === 'functions' && ref.uid === functions[4]._uid);
    return { source, created, sourceParent: ordered[source]?.parentUid, createdParent: ordered[created]?.parentUid };
  });
  assert.equal(enterPlacement.created, enterPlacement.source + 1, JSON.stringify(enterPlacement));
  assert.equal(enterPlacement.createdParent, enterPlacement.sourceParent, "Enter-created line escaped the current folder");
  await page.locator('[data-display-mode="text"]').click();
  const folderSource = await page.locator('[data-scene-text]').inputValue();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('[data-action="apply-text"]').click();
    assert(await page.locator('[data-display-mode="text"]').getAttribute('aria-selected') === 'true', 'Apply changed display mode');
    assert(await page.evaluate(() => window.__leptonDebug.scene().folders.every(folder => folder.collapsed)), 'Apply left nested folders open');
    assert.equal(await page.locator('[data-scene-text]').inputValue(), folderSource, 'Closing folders changed source');
    await page.locator('[data-display-mode="standard"]').click();
    assert.equal(await page.locator('[data-toggle-folder]').count(), 1);
    await page.locator('[data-toggle-folder]').first().click();
    await page.locator('[data-toggle-folder]').nth(1).click();
    await page.locator('[data-display-mode="text"]').click();
  }
  assert.deepEqual(sessionErrors, [], "Long editor session raised browser errors");
  console.log("ok - loaded/applied folders start closed; folding preserves flags and pixels without rendering; real edits still render");
  console.log("ok - Enter inserts and focuses the next expression inside the current folder");

  const pastedFolders = `folder Zebra = { // keep this comment
  expression zed = x
  folder Inner = {
    expression hidden = y
  }
  expression alpha = 2
}
folder Apple = {
  colour ink = 20~30~40
}`;
  await page.goto(`${base}app.html`);
  const chooseSort = async (sort) => {
    await page.locator('.sort-menu > summary').click();
    await page.locator(`[data-set-entry-sort="data"][data-sort-value="${sort}"]`).click();
  };
  const assertClosedRows = async (label) => {
    assert.equal(await page.locator('.expression-row[data-entry-kind]').count(), 2, `${label}: folder contents are visible`);
    assert.equal(await page.locator('[data-toggle-folder]').count(), 2, `${label}: nested folder is visible`);
    assert.deepEqual(await page.locator('[data-toggle-folder]').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-expanded'))), ['false', 'false'], label);
    assert(await page.evaluate(() => window.__leptonDebug.scene().folders.every((folder) => folder.collapsed)), label);
  };
  const assertCleanView = async () => {
    assert.equal(await page.locator('[data-entry-search="data"]').inputValue(), '');
    assert.equal(await page.locator('[data-entry-type-filter="data"]').inputValue(), 'all');
    assert.equal(await page.locator('[data-entry-sort="data"]').textContent(), 'In order');
  };
  if (engine === chromium) await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  let appliedSource;
  for (const sort of ['custom', 'az', 'za', 'group', 'dependencies']) {
    await chooseSort(sort);
    await page.locator('[data-entry-type-filter="data"]').selectOption('values');
    await page.locator('[data-entry-search="data"]').fill('old filter');
    await page.locator('.graph-actions-trigger').hover();
    await page.locator('[data-action="new-graph"]').click();
    if (await page.locator('[data-action="confirm-new-graph"]').count()) await page.locator('[data-action="confirm-new-graph"]').click();
    await assertCleanView();
    for (const viaWarning of [false, true]) {
      await chooseSort(sort);
      await page.locator('[data-entry-type-filter="data"]').selectOption('values');
      await page.locator('[data-entry-search="data"]').fill('old filter');
      await page.locator('[data-display-mode="text"]').click();
      await page.locator('[data-scene-text]').click();
      await page.keyboard.press('ControlOrMeta+A');
      if (engine === chromium) {
        await page.evaluate((source) => navigator.clipboard.writeText(source), pastedFolders);
        await page.keyboard.press('ControlOrMeta+V');
      } else await page.keyboard.insertText(pastedFolders);
      assert.equal(await page.locator('[data-scene-text]').inputValue(), pastedFolders, 'Clipboard paste did not replace the blank project');
      if (viaWarning) {
        await page.locator('[data-display-mode="standard"]').click();
        await page.locator('[data-action="apply-text-and-standard"]').click();
      } else {
        await page.locator('[data-action="apply-text"]').click();
        assert.equal(await page.locator('[data-display-mode="text"]').getAttribute('aria-selected'), 'true');
        await page.locator('[data-display-mode="standard"]').click();
      }
      await assertCleanView();
      await assertClosedRows(`${sort}, warning=${viaWarning}`);
      await chooseSort(sort);
      await assertClosedRows(`Sorted after Apply: ${sort}`);
      if (sort !== 'dependencies') {
        await page.locator('[data-toggle-folder="0"]').click();
        assert.equal(await page.locator('[data-field="functions.0.expression"] .mq-root-block').count(), 1, `${sort}: parent did not open`);
        assert.equal(await page.locator('[data-field="functions.1.expression"]').count(), 0, `${sort}: nested folder opened itself`);
      }
      await page.locator('[data-display-mode="text"]').click();
      const source = await page.locator('[data-scene-text]').inputValue();
      appliedSource ??= source;
      assert.equal(source, appliedSource, 'Apply or view sorting changed source, comments or saved order');
      await page.locator('[data-display-mode="standard"]').click();
    }
  }
  await page.screenshot({ path: `${output}/pasted-folders-closed.png` });
  assert.deepEqual(sessionErrors, [], 'Folder clipboard workflow raised browser errors');
  console.log('ok - clipboard paste into New, both Apply actions, stale filters and every sort show only closed root folders without source loss');

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
      await page.goto(new URL('reference.html', dev.resolvedUrls.local[0]).href);
      for (const library of ['mathquill', 'mediabunny']) {
        const file = `src/libs/${library}/LICENSE`;
        const url = new URL(`${file}?v=licence-regression`, dev.resolvedUrls.local[0]);
        const response = await fetch(url);
        assert.equal(response.status, 200, file);
        assert.match(response.headers.get('content-type'), /^text\/plain/);
        assert.equal(await response.text(), await readFile(file, 'utf8'), `Licence bytes changed: ${file}`);
        const head = await fetch(url, { method: 'HEAD' });
        assert.equal(head.status, 200, file);
        assert.equal(await head.text(), '');
      }
      await settle(page);
      assert.equal(await page.locator('vite-error-overlay').count(), 0, 'Licence request opened a Vite error overlay');
      assert.deepEqual(sessionErrors, [], 'Development requests caused browser errors');
      console.log('ok - development licence GET/HEAD requests return original plain text without an error overlay');
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

async function assertTextLayout(page, label) {
  const layout = await page.locator('.text-mode-panel').evaluate((panel) => {
    const box = (element) => {
      const { x, y, width, height, bottom, right } = element.getBoundingClientRect();
      return { x, y, width, height, bottom, right };
    };
    const notice = panel.querySelector('.text-apply-notice');
    let noticeStart = null;
    if (notice?.firstChild) {
      const range = document.createRange();
      range.setStart(notice.firstChild, 0);
      range.setEnd(notice.firstChild, 1);
      noticeStart = range.getBoundingClientRect().top - notice.getBoundingClientRect().top;
    }
    // Font metrics change control heights across platforms; measure the free space.
    const style = getComputedStyle(panel);
    const rows = [...panel.children].filter((element) => element.getBoundingClientRect().height > 0);
    const reserved = rows.filter((element) => !element.classList.contains('scene-text-editor'))
      .reduce((height, element) => height + element.getBoundingClientRect().height, 0);
    const available = panel.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      - Math.max(0, rows.length - 1) * parseFloat(style.rowGap) - reserved;
    return { panel: box(panel), editor: box(panel.querySelector('.scene-text-editor')), available,
      noticeStart,
      rows: [...panel.children].map((element) => ({ name: element.className, ...box(element) })),
      buttons: [...panel.querySelectorAll('.text-mode-actions button')].map(box) };
  });
  assert(layout.noticeStart === null || layout.noticeStart >= 0, `${label}: start of notice is clipped`);
  for (const row of layout.rows.filter((row) => row.height)) {
    assert(row.y >= layout.panel.y && row.bottom <= layout.panel.bottom + 1, `${label}: ${row.name} escaped panel`);
    assert(row.right <= layout.panel.right + 1, `${label}: ${row.name} overflowed horizontally`);
    if (/notice|warning/.test(row.name)) assert(row.height <= 96, `${label}: oversized notice`);
  }
  for (const button of layout.buttons) assert(button.height <= 44, `${label}: oversized action button`);
  assert(layout.editor.height > 40, `${label}: editor collapsed`);
  assert(Math.abs(layout.editor.height - layout.available) < 2, `${label}: editor does not fill remaining space: ${JSON.stringify(layout)}`);
  return layout;
}

async function geometry(field) {
  return field.evaluate((element) => ({
    scroll: element.scrollLeft,
    width: element.clientWidth,
    caret: element.querySelector(".mq-cursor")?.getBoundingClientRect().left - element.getBoundingClientRect().left
  }));
}

async function assertMenuFits(menu, width) {
  await menu.waitFor({ state: "visible" });
  await settle(menu.page());
  const box = await menu.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 901, `Menu outside viewport: ${JSON.stringify(box)}`);
}
