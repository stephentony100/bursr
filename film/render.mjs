// Renders the Bursr launch film from film/index.html: 60 fps, three sub-frames per frame
// (t − 1/240, t, t + 1/240) that ffmpeg blends into motion blur. Resumes where it stopped,
// and restarts the browser if a screenshot hangs. Needs playwright-core and Chrome, and
// the film folder served at http://127.0.0.1:8765 (python -m http.server 8765 in film/).
import { chromium } from "playwright-core";
import fs from "node:fs";
const dir = "C:/Users/NT/Desktop/bursar/film/out/sub";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FRAMES = 1200;
const SUBS = [-1 / 240, 0, 1 / 240];
fs.mkdirSync(dir, { recursive: true });
const name = (n) => `${dir}/${String(n).padStart(5, "0")}.jpg`;
let start = 0;
while (start < FRAMES * SUBS.length && fs.existsSync(name(start)) && fs.statSync(name(start)).size > 0) start++;
start -= start % SUBS.length; // redo the whole frame the last run was in

let browser, page;
async function open() {
  if (browser) await browser.close().catch(() => {});
  browser = await chromium.launch({ executablePath: CHROME });
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => window.ready);
}
await open();
const t0 = Date.now();
for (let n = start; n < FRAMES * SUBS.length; n++) {
  const f = Math.floor(n / SUBS.length);
  const t = Math.min(19.999, Math.max(0, f / 60 + SUBS[n % SUBS.length]));
  for (let attempt = 1; ; attempt++) {
    try {
      await page.evaluate((t) => window.seek(t), t);
      await page.screenshot({ path: name(n), type: "jpeg", quality: 92, timeout: 15000 });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`sub-frame ${n} failed (${e.name}); restarting the browser`);
      await open();
    }
  }
  if (n % 360 === 0) console.log(`frame ${f}/${FRAMES} after ${Math.round((Date.now() - t0) / 1000)}s`);
}
await browser.close();
console.log(`done from sub-frame ${start} in ${Math.round((Date.now() - t0) / 1000)}s`);
