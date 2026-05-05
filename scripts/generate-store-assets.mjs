import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const iconSvg = resolve(root, 'assets/icon.svg');
const outDir = resolve(root, 'store-assets');

await mkdir(outDir, { recursive: true });

// 1) Hi-res store icon (Chrome Web Store wants 128, but providing 512 for marketing too)
await sharp(iconSvg).resize(128, 128).png().toFile(resolve(outDir, 'icon-128.png'));
await sharp(iconSvg).resize(512, 512).png().toFile(resolve(outDir, 'icon-512.png'));

// Promo assets share a brand layout: dark background + glow + icon + word-mark + tagline.
function buildPromoSvg({ width, height, title, subtitle, iconPx, layout }) {
  const cx = width / 2;
  const cy = height / 2;
  const iconX = layout === 'left' ? Math.round(width * 0.12) : cx - iconPx / 2;
  const iconY = layout === 'left' ? cy - iconPx / 2 : Math.round(height * 0.18);
  const textX = layout === 'left' ? iconX + iconPx + 32 : cx;
  const textAnchor = layout === 'left' ? 'start' : 'middle';
  const titleY = layout === 'left' ? cy - 4 : iconY + iconPx + 56;
  const subtitleY = layout === 'left' ? cy + 36 : titleY + 38;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#1a0606" stop-opacity="1"/>
      <stop offset="55%" stop-color="#0a0a0a" stop-opacity="1"/>
      <stop offset="100%" stop-color="#050505" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="iconGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF3B3B" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#FF3B3B" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#FF3B3B" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bgGlow)"/>
  <circle cx="${iconX + iconPx / 2}" cy="${iconY + iconPx / 2}" r="${iconPx * 1.1}" fill="url(#iconGlow)"/>

  <!-- Icon placeholder (we composite the real PNG icon over this) -->
  <text
    x="${textX}"
    y="${titleY}"
    text-anchor="${textAnchor}"
    font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="${Math.round(height * 0.16)}"
    font-weight="700"
    fill="#FAFAFA"
    letter-spacing="-1"
  >${title}</text>
  <text
    x="${textX}"
    y="${subtitleY}"
    text-anchor="${textAnchor}"
    font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="${Math.round(height * 0.075)}"
    font-weight="500"
    fill="#A1A1A1"
  >${subtitle}</text>
</svg>`;
}

async function renderPromo({ name, width, height, title, subtitle, iconPx, layout }) {
  const svg = buildPromoSvg({ width, height, title, subtitle, iconPx, layout });
  const bg = await sharp(Buffer.from(svg)).png().toBuffer();
  const icon = await sharp(iconSvg).resize(iconPx, iconPx).png().toBuffer();

  const iconLeft = layout === 'left' ? Math.round(width * 0.12) : Math.round(width / 2 - iconPx / 2);
  const iconTop = layout === 'left' ? Math.round(height / 2 - iconPx / 2) : Math.round(height * 0.18);

  await sharp(bg)
    .composite([{ input: icon, left: iconLeft, top: iconTop }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, name));
}

// 2) Small promo tile — 440x280 (REQUIRED by Chrome Web Store)
await renderPromo({
  name: 'promo-tile-440x280.png',
  width: 440,
  height: 280,
  title: 'Scrollsaber',
  subtitle: 'Cut long LinkedIn posts. Keep the point.',
  iconPx: 96,
  layout: 'left',
});

// 3) Marquee promo — 1400x560 (optional but boosts visibility)
await renderPromo({
  name: 'promo-marquee-1400x560.png',
  width: 1400,
  height: 560,
  title: 'Scrollsaber',
  subtitle: 'Shorten LinkedIn posts with your own LLM key — Gemini, Groq, OpenRouter, more.',
  iconPx: 200,
  layout: 'left',
});

// 4) Large promo tile (legacy, occasionally requested) 920x680
await renderPromo({
  name: 'promo-large-920x680.png',
  width: 920,
  height: 680,
  title: 'Scrollsaber',
  subtitle: 'BYOK · LinkedIn shortener',
  iconPx: 220,
  layout: 'center',
});

console.log('Generated store assets:');
console.log('  ', outDir);
