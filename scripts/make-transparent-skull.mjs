import fs from 'node:fs/promises';
import path from 'node:path';
import { Jimp, ResizeStrategy } from 'jimp';

/**
 * Usage:
 *   node scripts/make-transparent-skull.mjs <inputPng> <outputPng>
 *
 * Removes background by flood-filling from edges and setting alpha=0.
 * Upscales with bicubic first, then feathers the alpha matte for smoother edges.
 */
function floodFillBackground(img, toleranceSq) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  const idxAt = (x, y) => (w * y + x) * 4;
  const getRgb = (x, y) => {
    const idx = idxAt(x, y);
    return { r: data[idx + 0], g: data[idx + 1], b: data[idx + 2] };
  };

  const distSq = (c1, c2) => {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return dr * dr + dg * dg + db * db;
  };

  const corners = [getRgb(0, 0), getRgb(w - 1, 0), getRgb(0, h - 1), getRgb(w - 1, h - 1)];
  const bg = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / corners.length),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / corners.length),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / corners.length),
  };

  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const key = y * w + x;
    if (visited[key]) return;
    const c = getRgb(x, y);
    if (distSq(c, bg) > toleranceSq) return;
    visited[key] = 1;
    qx[qt] = x;
    qy[qt] = y;
    qt++;
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (qh < qt) {
    const x = qx[qh];
    const y = qy[qh];
    qh++;
    data[idxAt(x, y) + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }
}

/** Box-blur alpha channel only to anti-alias jagged cutout edges. */
function featherAlpha(img, radius = 2) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;
  const alphas = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    alphas[i] = data[i * 4 + 3];
  }

  const blurred = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          sum += alphas[ny * w + nx];
          count++;
        }
      }
      blurred[y * w + x] = sum / count;
    }
  }

  for (let i = 0; i < w * h; i++) {
    data[i * 4 + 3] = Math.round(blurred[i]);
  }
}

/** Remove tiny disconnected alpha islands (feathering artifacts), keep real content. */
function removeSmallIslands(img, minSize = 80, alphaThreshold = 40) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;
  const n = w * h;
  const mask = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] > alphaThreshold) mask[i] = 1;
  }

  const labels = new Int32Array(n);
  const sizes = new Map();
  let nextLabel = 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const key = y * w + x;
      if (!mask[key] || labels[key] !== 0) continue;

      const label = nextLabel++;
      let size = 0;
      const stack = [key];
      labels[key] = label;

      while (stack.length) {
        const k = stack.pop();
        size++;
        const cx = k % w;
        const cy = (k / w) | 0;
        if (cx > 0) {
          const nk = k - 1;
          if (mask[nk] && labels[nk] === 0) {
            labels[nk] = label;
            stack.push(nk);
          }
        }
        if (cx < w - 1) {
          const nk = k + 1;
          if (mask[nk] && labels[nk] === 0) {
            labels[nk] = label;
            stack.push(nk);
          }
        }
        if (cy > 0) {
          const nk = k - w;
          if (mask[nk] && labels[nk] === 0) {
            labels[nk] = label;
            stack.push(nk);
          }
        }
        if (cy < h - 1) {
          const nk = k + w;
          if (mask[nk] && labels[nk] === 0) {
            labels[nk] = label;
            stack.push(nk);
          }
        }
      }

      sizes.set(label, size);
    }
  }

  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (label === 0) continue;
    if ((sizes.get(label) ?? 0) >= minSize) continue;
    const idx = i * 4;
    data[idx + 0] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 0;
  }
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    throw new Error('Missing args: <inputPng> <outputPng>');
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const source = await Jimp.read(inputPath);
  const upscale = 8;

  // Upscale first (bicubic) so the cutout + downscale in-app yields smoother curves.
  source.resize({
    w: source.bitmap.width * upscale,
    h: source.bitmap.height * upscale,
    mode: ResizeStrategy.BICUBIC,
  });

  floodFillBackground(source, 55 * 55);
  featherAlpha(source, 2);
  removeSmallIslands(source);

  await source.write(outputPath);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outputPath} (${source.bitmap.width}x${source.bitmap.height})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
