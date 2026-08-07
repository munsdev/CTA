import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { readdirSync } from 'fs';
import path from 'path';
const { chromium } = pw;

const dir = path.dirname(new URL(import.meta.url).pathname);
const outDir = path.join(dir, '..', 'backdrops');
const files = readdirSync(dir).filter(f => f.endsWith('.svg'));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1440 } });

for (const f of files) {
  const svgPath = path.join(dir, f);
  await page.goto('file://' + svgPath);
  await page.waitForSelector('svg', { timeout: 5000 });
  await page.evaluate(() => {
    const svg = document.documentElement;
    svg.style.width = '1600px';
    svg.style.height = '1440px';
  });
  const out = path.join(outDir, f.replace('.svg', '.png'));
  await page.screenshot({ path: out });
  console.log('wrote', out);
}
await browser.close();
