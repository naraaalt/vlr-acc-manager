// One-off generator: writes build/icon.ico (multi-size) + build/icon.png
// from the Sapphire gem geometry used in src/components/Icons.jsx.
// Run: node scripts/make-icon.mjs   (zero deps — hand-rolled PNG/ICO encoders)
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'build');
mkdirSync(outDir, { recursive: true });

const BRAND = [62, 139, 255];   // #3E8BFF sapphire bright
const DEEP = [15, 82, 186];     // #0F52BA sapphire deep
const EDGE = [8, 17, 27];       // near-bg outline

// Canvas size used for rendering; ICO will embed scaled copies.
const S = 256;

// Render the gem: hexagon outline + inner facets, with 2x supersampling.
function renderGem(size) {
  const ss = 2; // supersample factor
  const W = size * ss;
  const buf = Buffer.alloc(W * W * 4, 0);

  const cx = W / 2, cy = W / 2, R = W * 0.40;
  const r = W * 0.24;

  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    hex.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  const inner = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 90);
    inner.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }

  const inPoly = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  const outline = W * 0.022; // stroke width

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const inHex = inPoly(px, py, hex);
      const inInner = inPoly(px, py, inner);
      // distance to hexagon edge ≈: on hex but not deep inside inner → stroke zone
      let color = null, alpha = 0;

      if (inHex) {
        // find min distance to hex edges for anti-aliased stroke
        let d = Infinity;
        for (let i = 0, j = hex.length - 1; i < hex.length; j = i++) {
          const [x1, y1] = hex[j], [x2, y2] = hex[i];
          const dx = x2 - x1, dy = y2 - y1;
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
          const ex = x1 + t * dx, ey = y1 + t * dy;
          d = Math.min(d, Math.hypot(px - ex, py - ey));
        }
        // Gem facet layout (mirrors GemShape in Icons.jsx):
        //   inner hexagon = deep sapphire, except its top-right wedge bright
        //   outer ring = bright sapphire body
        const upperFacet = py < cy + (r - (cy - inner[0][1])) * 0.9;
        if (inInner) {
          color = upperFacet ? DEEP : BRAND;
          alpha = 255;
        } else {
          color = d <= outline ? BRAND : (upperFacet ? DEEP : BRAND);
          alpha = 255; // solid app icon — no translucency
        }
      }
      if (color) {
        const o = (y * W + x) * 4;
        buf[o] = color[0]; buf[o + 1] = color[1]; buf[o + 2] = color[2]; buf[o + 3] = alpha;
      }
    }
  }

  // downsample ss→1 with box blur (cheap AA)
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r0 = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const o = ((y * ss + dy) * W + (x * ss + dx)) * 4;
          const w = buf[o + 3];
          r0 += buf[o] * w; g += buf[o + 1] * w; b += buf[o + 2] * w; a += w; n++;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r0 / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// PNG writer (uncompressed deflate blocks + CRC32)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function toPNG(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ICO writer: embeds PNG-compressed entries (Vista+ supports PNG entries)
function toICO(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  const dirEntry = Buffer.alloc(16);
  const dirSize = 16 * count;
  let offset = 6 + dirSize;
  const entries = [];
  const images = [];
  for (const { size, png } of pngs) {
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 0);
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 1);
    dirEntry.writeUInt8(0, 2); dirEntry.writeUInt8(0, 3);
    dirEntry.writeUInt16LE(1, 4); dirEntry.writeUInt16LE(32, 6);
    dirEntry.writeUInt32LE(png.length, 8);
    dirEntry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(Buffer.from(dirEntry));
    images.push(png);
  }
  return Buffer.concat([header, ...entries, ...images]);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((size) => ({ size, png: toPNG(renderGem(size), size) }));

// icon.ico (multi-size)
writeFileSync(path.join(outDir, 'icon.ico'), toICO(pngs));
// icon.png (256px, for electron-builder + BrowserWindow icon fallback)
const p256 = pngs.find((p) => p.size === 256);
writeFileSync(path.join(outDir, 'icon.png'), p256.png);
// 512px marketing png
const big = toPNG(renderGem(512), 512);
writeFileSync(path.join(outDir, 'icon@512.png'), big);

console.log('icons written:', sizes.join(', '), '+ icon.png + icon@512.png →', outDir);
