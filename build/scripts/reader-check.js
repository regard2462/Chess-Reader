// The check of Chess Reader (node build/reader-shot.js): the page loads, a test library (the sample books of
// app/dev-samples) is handed over through the test hook as if the folder had been picked, the list shows the books,
// a book opens in the reader and a page is turned.
const fs = require('fs');
const path = require('path');

const SAMPLES = path.join(__dirname, '..', '..', 'app', 'dev-samples');

async function fillOpfs(page, dir, name) {
  await page.evaluate(async (n) => { const root = await navigator.storage.getDirectory(); try { await root.removeEntry(n, { recursive: true }); } catch {} await root.getDirectoryHandle(n, { create: true }); }, name);
  for (const f of fs.readdirSync(dir)) {
    const parts = []; const buf = fs.readFileSync(path.join(dir, f));
    for (let i = 0; i < buf.length; i += 4194304) parts.push(buf.subarray(i, i + 4194304).toString('base64'));
    await page.evaluate(async ({ n, f, parts }) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(n, { create: true });
      const fh = await dir.getFileHandle(f, { create: true });
      const w = await fh.createWritable();
      for (const b64 of parts) { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); await w.write(u8); }
      await w.close();
    }, { n: name, f, parts });
  }
}

module.exports = async ({ page, shot, sleep, baseUrl, errors }) => {
  await page.goto(baseUrl + '/index.html');
  await page.waitForSelector('.rl-bar', { timeout: 60000 });
  await shot('reader-01-empty');
  await fillOpfs(page, SAMPLES, 'samples');
  await page.evaluate(async () => { const root = await navigator.storage.getDirectory(); const h = await root.getDirectoryHandle('samples'); return window.__cozyshelvesWeb.useHandle(h, 'auto'); });
  await page.evaluate(() => document.querySelector('.panel-layer')?.remove());
  await page.waitForFunction(() => document.querySelectorAll('.rl-card').length >= 3, null, { timeout: 120000 });
  await sleep(3000);
  await shot('reader-02-list');
  const names = await page.$$eval('.rl-name', (els) => els.map((e) => e.textContent));
  console.log('books:', names.join(' | '));
  await page.click('.rl-card');
  await page.waitForSelector('.rd-root', { timeout: 60000 });
  await sleep(4000);
  await shot('reader-03-book');
  await page.keyboard.press('ArrowRight'); await sleep(1200);
  await page.keyboard.press('ArrowRight'); await sleep(1200);
  await shot('reader-04-turned');
  // the chess book: the board next to the page and the selection frame (the lasso)
  await page.keyboard.press('Escape'); await sleep(1500);
  await page.click('.rl-card:has-text("Sicilian")');
  await page.waitForSelector('.rd-root', { timeout: 60000 });
  await sleep(4000);
  if (await page.evaluate(() => document.querySelector('.rd-chess')?.classList.contains('hidden'))) { await page.keyboard.press('c'); await sleep(3000); }
  await shot('reader-05-chess');
  await page.keyboard.press('d'); await sleep(1500);
  await shot('reader-06-lasso');
  const bad = errors.filter((e) => !/favicon/.test(e));
  if (bad.length) throw new Error('errors in the console: ' + bad.join(' / '));
  console.log('reader-check passed');
};
