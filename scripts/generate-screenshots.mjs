import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
// Where the raw Snipping Tool / OS screenshots live. Override with
// `SCROLLSABER_RAW_SCREENSHOTS=/path/to/dir node scripts/generate-screenshots.mjs`
// when running outside this checkout.
const srcDir = process.env.SCROLLSABER_RAW_SCREENSHOTS ?? resolve(root, 'screenshots-raw');
const outDir = resolve(root, 'store-assets/screenshots');

await mkdir(outDir, { recursive: true });

const W = 1280;
const H = 800;

function backgroundSvg(title, subtitle) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1a0606"/>
      <stop offset="55%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#040404"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${W / 2}" y="64" text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="32" font-weight="700" fill="#FAFAFA" letter-spacing="-0.5">${title}</text>
  <text x="${W / 2}" y="100" text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="18" font-weight="500" fill="#A1A1A1">${subtitle}</text>
</svg>`;
}

/**
 * Compose a single screenshot: branded background + heading + the actual
 * captured screenshot, scaled to fit and centered.
 */
async function compose({ name, src, title, subtitle, scaleW = 0, scaleH = 0 }) {
  const bg = await sharp(Buffer.from(backgroundSvg(title, subtitle))).png().toBuffer();
  const meta = await sharp(src).metadata();
  const usableW = W - 120;
  const usableH = H - 180; // 140 top for title + 40 bottom margin
  const sx = scaleW || meta.width;
  const sy = scaleH || meta.height;
  const ratio = Math.min(usableW / sx, usableH / sy);
  const w = Math.round(sx * ratio);
  const h = Math.round(sy * ratio);
  const left = Math.round((W - w) / 2);
  const top = 140 + Math.round((usableH - h) / 2);
  const shot = await sharp(src).resize(w, h, { fit: 'contain' }).png().toBuffer();
  await sharp(bg)
    .composite([{ input: shot, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, name));
  console.log(`  ${name}  (${w}x${h} centered at ${left},${top})`);
}

await compose({
  name: '01-shorten-modal.png',
  src: resolve(srcDir, 'ss7.png'),
  title: 'Cut long LinkedIn posts. Keep the point.',
  subtitle: 'Pick a length on the slider — apply with one click.',
});

await compose({
  name: '02-reader-tldr.png',
  src: resolve(srcDir, 'ss5.png'),
  title: 'Skim before committing to read',
  subtitle: 'TL;DR bar above every long feed post.',
});

await compose({
  name: '03-settings-providers.png',
  src: resolve(srcDir, 'ss2.png'),
  title: 'Bring your own LLM key',
  subtitle: 'Gemini, Groq, OpenRouter, DeepSeek, Cerebras, Together, Fireworks, custom.',
});

await compose({
  name: '04-popup-stats.png',
  src: resolve(srcDir, 'ss1.png'),
  title: 'Track your impact',
  subtitle: 'Posts shortened, reader minutes saved, daily credit cap.',
});

console.log('\nGenerated 1280x800 screenshots at', outDir);
