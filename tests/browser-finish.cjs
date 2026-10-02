const { chromium } = require(process.argv[2]);
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-proxy-server'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5173/?seed=1024', { waitUntil: 'networkidle' });
    if (!process.argv.includes('--layouts')) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#lab summary').click();
    await page.getByRole('button', { name: 'Run 120-second test', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('#qa-state').textContent || '{}').benchmarkResult, undefined, { timeout: 135000 });
    const qa = await page.locator('#qa-state').textContent(); const state = JSON.parse(qa);
    fs.writeFileSync('evidence/browser-finish-performance.json', JSON.stringify({ browser: await browser.version(), viewport: '1920x1080 at DPR 1.5', errors, ...state.benchmarkResult }, null, 2));
    assert.equal(state.benchmarkResult.completed, true); assert.equal(state.benchmarkResult.stallsOver100ms, 0); assert.equal(errors.length, 0);
    console.log(JSON.stringify(state.benchmarkResult));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'evidence/browser-finish-desktop.png' });
    } else {
      await page.keyboard.press('Enter'); await page.waitForTimeout(4500);
      for (const [key, side] of [['a',0],['l',1]]) {
        const before = JSON.parse(await page.locator('#qa-state').textContent());
        if (before.paused) { await page.keyboard.press('Escape'); await page.waitForTimeout(1000); }
        await page.keyboard.down(key); await page.waitForTimeout(650);
        const state = JSON.parse(await page.locator('#qa-state').textContent());
        assert.equal(state.physicalHeld[side], true); assert.equal(state.physicalHeld[1-side], false);
        assert.equal(state.offense.held[side], true); assert.equal(state.offense.held[1-side], false);
        await page.keyboard.up(key); await page.waitForTimeout(650);
      }
      await page.screenshot({ path: 'evidence/browser-finish-desktop.png' });
    }
    // Use the normal settings path to exercise the inexpensive rendering fallback.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#reduced').check();
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'evidence/browser-finish-reduced.png' });
    if (!JSON.parse(await page.locator('#qa-state').textContent()).paused) await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
    assert.equal(JSON.parse(await page.locator('#qa-state').textContent()).paused, false);
    await page.screenshot({ path: 'evidence/browser-finish-mobile.png' });
    assert.equal(errors.length, 0);
    fs.writeFileSync('evidence/browser-finish-layouts.json', JSON.stringify({ browser: await browser.version(), errors, reducedAndNarrow: true, pairedInputs: process.argv.includes('--layouts') }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
