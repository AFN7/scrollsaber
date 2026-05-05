import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'assets/icon.svg');
const outDir = resolve(root, 'public/icon');

await mkdir(outDir, { recursive: true });

const sizes = [16, 32, 48, 128];

await Promise.all(
  sizes.map((size) =>
    sharp(src)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(resolve(outDir, `${size}.png`)),
  ),
);

console.log(`Generated ${sizes.length} icons in ${outDir}`);
