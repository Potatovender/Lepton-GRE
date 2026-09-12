import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer, preview } from "vite";

const server = process.env.LEPTON_TEST_URL ? null : process.env.LEPTON_TEST_DEV
  ? await createServer({ server: { host: "127.0.0.1", port: 0 } })
  : await preview({ preview: { host: "127.0.0.1", port: 0 } });
if (process.env.LEPTON_TEST_DEV) await server?.listen();
const base = process.env.LEPTON_TEST_URL ?? server.resolvedUrls.local[0];
const engine = process.env.LEPTON_TEST_BROWSER === "webkit" ? webkit : chromium;
let browser;
try {
  browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) console.error(message.text()); });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}app.html`);
  await page.locator('[data-display-mode="text"]').waitFor();
  const results = await page.evaluate(() => {
    const cases = [
      ["expression eq = sum(i=1~3){i^2}", 14],
      ["expression eq = prod(i=1~5){i}", 120],
      ["expression eq = sum(i=1~2){prod(j=1~3){i+j}}", 84],
      ["list values = [20,40,60]\nexpression eq = values[1]", 40],
      ["list values = [c^2 for(c=1,7)]\nexpression eq = values[6]", 49],
      ["list values = [10,20,30]\nexpression eq = sum(i=1~3){values}[2]", 90],
      ["list eq = [10,20,30]", 30],
      ["list eq = [c*10 for(c=1,4)]", 40],
      ["list values = [2,4]\nfunction scale(a) = a*10\nexpression eq = scale(values)", 40],
      ["expression eq = sum(i=3~1){i}+prod(j=3~1){j}", 1],
      ["expression eq = sum(i=0.5~2.9){i}*10", 45],
      ["list eq = sum(i=1~3){[i*10,i*20]}", 120],
      ["expression eq = sum(i=1~100){1}", 100],
      ["expression eq = 10*sum(i=1~floor(x+5)){i}", 150],
      ["list eq = [c*10 for(c=1,floor(x+5))]", 50],
      ["time unbounded t = 3 {speed=1}\nexpression eq = sum(i=1~t){i}*10", 60],
      ["expression eq = 10*sum(i=1~3){{i>1:i,0}}", 50],
      ["list eq = [{c<=3:c*10,20} for(c=1,4)]", 20],
      ["function pair(a,b) -> point = [a,b]\nfunction shifted(a,b) -> point = pair(a,b)+1\nexpression eq = 10*sum(i=1~2){shifted(i,3).x}", 50],
      ["expression eq = (sum(i=1~3){i})^2", 36],
      ["list values = [20,40,60]/2\nexpression eq = values[1]", 20],
      ["expression eq = sum(i=1~10000){.01}", 100],
      ["set max_list_size = 3\nlist eq = [10,20,30,40]", 247],
      ["set max_list_size = 3\nlist eq = [10,20,30]", 30],
      ["list eq = [c for(c=1,10000)]/100", 100],
      ["list values = [1e-7,0.0000002]\nexpression eq = values[0]*100000000", 10],
      ["expression outer = x\nfunction evaluate(x) = sum(i=1~2){outer}+x\nexpression eq = evaluate(10)", 11.25],
      ["function pair(a) -> point = [sum(i=1~a){i},prod(i=1~a){i}]\nexpression eq = pair(3).x+pair(3)[1]", 12],
      ["list values = [2,4]\nfunction scale(a) = a*10", 40, 'scale(values)'],
      ["expression eq = sum(i=1~sqrt(x-0.8)){1}", 247],
      ["expression eq = 100+sum(i=1~3){random-random()}", 100]
    ];
    return cases.map(([code, expected, target = 'eq']) => {
      try {
        const pixels = window.__leptonDebug.renderSceneToPixels(`${code}\ncolour c = x~0~0\ndraw(${target}) {colour=c}`, 16, 16);
        return { code, expected, actual: pixels.data[(8*16+8)*4] };
      } catch (error) { return { code, expected, error: error.message, shaderLog: window.__leptonShaderLog, source: window.__leptonFailedShaderSource?.slice(-2500) }; }
    });
  });
  for (const result of results) {
    assert(!result.error && Math.abs(result.actual - result.expected) <= 1, JSON.stringify(result));
    console.log(`ok - GPU ${result.code.replaceAll("\n", "; ")} = ${result.actual}`);
  }
  await page.locator('[data-display-mode="text"]').click();
  await page.locator('[data-scene-text]').fill(`list values = [c^2 for(c=1,5)]
expression eq = sum(i=1~3){prod(j=1~2){i+j}}
draw(values)`);
  await page.locator('[data-action="apply-text"]').click();
  await page.locator('[data-display-mode="standard"]').click();
  const list = page.locator('.mathquill-field[data-field="lists.0.expression"]');
  const expression = page.locator('.mathquill-field[data-field="functions.0.expression"]');
  await list.locator('.mq-root-block').waitFor();
  assert.equal(await expression.locator('.mq-large-operator').count(), 2);
  // Edit after the existing aggregate without replacing the MathQuill field.
  await expression.click();
  await page.keyboard.press('End');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.type('+3');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('4');
  await page.locator('[data-display-mode="text"]').click();
  const text = await page.locator('[data-scene-text]').inputValue();
  assert(text.includes('sum(i=1~3){prod(j=1~2){i+j}}+4'), text);
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-action="apply-text"]').click();
    await page.locator('[data-display-mode="standard"]').click();
    assert.equal(await expression.locator('.mq-large-operator').count(), 2);
    await page.locator('[data-display-mode="text"]').click();
    await page.locator('[data-action="refresh-text"]').click();
    assert.equal(await page.locator('[data-scene-text]').inputValue(), text);
  }
  await page.locator('[data-display-mode="standard"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-compile-status]')?.textContent.includes('Compiling'));
  await mkdir('output/playwright/collections', { recursive: true });
  await page.screenshot({ path: `output/playwright/collections/${process.env.LEPTON_TEST_BROWSER ?? 'chromium'}.png` });
  console.log('ok - editable limits, list contents, append/backspace and repeated Text/Standard cycles');
  for (const operator of ['sum', 'prod']) {
    await page.goto(`${base}app.html?scene=expression%20eq%20%3D%20`);
    const typed = page.locator('.mathquill-field[data-field="functions.0.expression"]');
    await typed.locator('.mq-root-block').waitFor();
    await typed.click();
    await page.keyboard.type(operator);
    await page.keyboard.type('i=1');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.type('3');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type('(i)');
    await page.locator('[data-display-mode="text"]').click();
    assert((await page.locator('[data-scene-text]').inputValue()).includes(`${operator}(i=1~3){i}`));
    console.log(`ok - ${operator}: real typing and limit/body navigation`);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}app.html?scene=expression%20eq%20%3D%20x`);
    const chooser = page.locator('.new-entry-menu');
    await chooser.locator('summary').click();
    await chooser.locator('[data-more-data="true"]').click();
    const menu = await chooser.locator('.new-entry-popover').boundingBox();
    assert(menu.x >= 0 && menu.x + menu.width <= width + 1, JSON.stringify(menu));
    await chooser.locator('[data-add="lists"]').click();
    const field = page.locator('.mathquill-field[data-field="lists.0.expression"]');
    await field.locator('.mq-root-block').waitFor();
    await field.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('[c for(c=1,5)]');
    await page.locator('[data-display-mode="text"]').click();
    const source = await page.locator('[data-scene-text]').inputValue();
    assert(/list list\d+ = \[c for\(c=1,5\)\]/.test(source), source);
    await page.locator('[data-action="apply-text"]').click();
    await page.locator('[data-display-mode="standard"]').click();
    await field.locator('.mq-root-block').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-compile-status]')?.textContent.includes('Compiling'));
    await page.screenshot({ path: `output/playwright/collections/list-${width}-${process.env.LEPTON_TEST_BROWSER ?? 'chromium'}.png` });
    await page.locator('[data-action="toggle-settings-panel"]').click();
    const maximum = page.locator('[data-field="settings.maxListSize"]');
    assert.equal(await maximum.inputValue(), '10000');
    await maximum.fill('200');
    await maximum.press('Tab');
    await page.locator('[data-display-mode="text"]').click();
    assert((await page.locator('[data-scene-text]').inputValue()).includes('set max_list_size = 200'));
    console.log(`ok - More data list creation, comprehension typing, settings and layout at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-scene-text]').fill(`folder Collections = {
  // List source stays with its folder
  list values = [c*20 for(c=1,4)] // preserve this comment
  expression total = sum(i=1~3){i}
  colour pigment = x~100+y*4~210
  draw(values) {colour=pigment}
}`);
  await page.locator('[data-action="apply-text"]').click();
  await page.locator('[data-action="refresh-text"]').click();
  const savedSource = await page.locator('[data-scene-text]').inputValue();
  await page.locator('[data-display-mode="standard"]').click();
  assert.equal(await page.locator('.draw-list-count').textContent(), '4 draw values');
  await page.locator('.graph-actions-trigger').hover();
  await page.locator('[data-action="open-save-dialog"]').click();
  await page.locator('[data-save-name]').fill('Collection persistence regression');
  await page.locator('[data-action="confirm-save-graph"]').click();
  await page.reload();
  await page.locator('.graph-actions-trigger').hover();
  await page.locator('[data-action="open-library"]').click();
  await page.locator('.saved-graph-thumb').first().evaluate(async (img) => { await img.decode(); if (!img.naturalWidth) throw new Error('Missing collection preview'); });
  await page.locator('[data-load-saved-graph]').first().click();
  assert.equal(await page.locator('[data-toggle-folder]').first().getAttribute('aria-expanded'), 'false');
  await page.locator('[data-toggle-folder]').first().click();
  await page.locator('.mathquill-field[data-field^="lists."][data-field$=".expression"] .mq-root-block').waitFor();
  await page.locator('[data-display-mode="text"]').click();
  assert.equal(await page.locator('[data-scene-text]').inputValue(), savedSource);
  assert.deepEqual(errors, []);
  console.log('ok - collection save/load retains comments, folders and a decodable preview; no uncaught page errors');
} finally {
  await browser?.close();
  await server?.close();
}
