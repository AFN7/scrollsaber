import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const iconSvg = resolve(root, 'assets/icon.svg');
const outDir = resolve(root, 'store-assets');

await mkdir(outDir, { recursive: true });

await sharp(iconSvg).resize(128, 128).png().toFile(resolve(outDir, 'icon-128.png'));
await sharp(iconSvg).resize(512, 512).png().toFile(resolve(outDir, 'icon-512.png'));

/**
 * Defensive promo renderer. We can't measure SVG text width with Sharp, so
 * each layout is sized so that the longest expected line (with a 0.6 char-
 * width factor for Inter-ish fonts) stays inside the canvas with margin.
 *
 * `mode` "stacked" → icon on top, title + subtitle centered below (used when
 *   width is roughly square or narrow).
 * `mode` "split"   → icon on left, title + subtitle stacked on right (used
 *   for wide marquee canvases).
 */
function buildSvg({ width, height, title, subtitle, iconPx, mode, titlePx, subPx }) {
  let titleX, titleY, subX, subY, anchor, iconLeft, iconTop;

  if (mode === 'stacked') {
    iconLeft = Math.round((width - iconPx) / 2);
    // Block height = icon + 32 gap + title + 18 gap + sub
    const block = iconPx + 32 + titlePx + 18 + subPx;
    iconTop = Math.round((height - block) / 2);
    titleX = width / 2;
    titleY = iconTop + iconPx + 32 + Math.round(titlePx * 0.82); // baseline approx
    subX = width / 2;
    subY = titleY + 18 + Math.round(subPx * 0.95);
    anchor = 'middle';
  } else {
    // split
    iconLeft = Math.round(width * 0.10);
    iconTop = Math.round((height - iconPx) / 2);
    const textX = iconLeft + iconPx + Math.round(width * 0.05);
    titleX = textX;
    subX = textX;
    // Two-line block centered vertically next to the icon
    const block = titlePx + 16 + subPx;
    const blockTop = Math.round((height - block) / 2);
    titleY = blockTop + Math.round(titlePx * 0.82);
    subY = titleY + 16 + Math.round(subPx * 0.95);
    anchor = 'start';
  }

  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#1a0606"/>
      <stop offset="55%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#040404"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF3B3B" stop-opacity="0.40"/>
      <stop offset="55%" stop-color="#FF3B3B" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#FF3B3B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="${iconLeft + iconPx / 2}" cy="${iconTop + iconPx / 2}" r="${iconPx * 0.95}" fill="url(#halo)"/>
  <text x="${titleX}" y="${titleY}" text-anchor="${anchor}"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="${titlePx}" font-weight="700" fill="#FAFAFA" letter-spacing="-1">${title}</text>
  <text x="${subX}" y="${subY}" text-anchor="${anchor}"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        font-size="${subPx}" font-weight="500" fill="#A1A1A1">${subtitle}</text>
</svg>`,
    iconLeft,
    iconTop,
  };
}

async function render({ name, width, height, title, subtitle, iconPx, mode, titlePx, subPx }) {
  const { svg, iconLeft, iconTop } = buildSvg({
    width,
    height,
    title,
    subtitle,
    iconPx,
    mode,
    titlePx,
    subPx,
  });
  const bg = await sharp(Buffer.from(svg)).png().toBuffer();
  const icon = await sharp(iconSvg).resize(iconPx, iconPx).png().toBuffer();
  await sharp(bg)
    .composite([{ input: icon, left: iconLeft, top: iconTop }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, name));
}

// Small promo tile — 440x280. Stacked layout fits comfortably; very short
// tagline so we don't need to measure text width.
await render({
  name: 'promo-tile-440x280.png',
  width: 440,
  height: 280,
  iconPx: 72,
  title: 'Scrollsaber',
  subtitle: 'Shorten LinkedIn posts',
  titlePx: 36,
  subPx: 16,
  mode: 'stacked',
});

// Marquee 1400x560. Plenty of horizontal room, split layout looks bolder.
await render({
  name: 'promo-marquee-1400x560.png',
  width: 1400,
  height: 560,
  iconPx: 240,
  title: 'Scrollsaber',
  subtitle: 'Cut long LinkedIn posts with your own LLM key',
  titlePx: 92,
  subPx: 30,
  mode: 'split',
});

// Large 920x680. Stacked feels balanced for near-square canvas.
await render({
  name: 'promo-large-920x680.png',
  width: 920,
  height: 680,
  iconPx: 200,
  title: 'Scrollsaber',
  subtitle: 'BYOK · LinkedIn shortener',
  titlePx: 72,
  subPx: 26,
  mode: 'stacked',
});

console.log('Generated store assets at', outDir);
