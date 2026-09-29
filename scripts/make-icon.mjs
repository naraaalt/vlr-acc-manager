// One-off generator: writes build/icon.ico (multi-size) + build/icon.png from the
// Sapphire gem geometry in src/components/Icons.jsx (zero deps — hand-rolled
// PNG/ICO encoders). Run: node scripts/make-icon.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'build');
mkdirSync(outDir, { recursive: true });

const BRAND = [62, 139, 255];   // #3E8BFF sapphire bright
const DEEP = [15, 82, 186];     // #0F52BA sapphire deep

// Render the gem: hexagon outline + inner facets, with 2x supersampling.
function renderGem(size) {
  const ss = 2;
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
      // distance to nearest hexagon edge, for the anti-aliased stroke below
      let color = null, alpha = 0;

      if (inHex) {
        let d = Infinity;
        for (let i = 0, j = hex.length - 1; i < hex.length; j = i++) {
          const [x1, y1] = hex[j], [x2, y2] = hex[i];
          const dx = x2 - x1, dy = y2 - y1;
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
          const ex = x1 + t * dx, ey = y1 + t * dy;
          d = Math.min(d, Math.hypot(px - ex, py - ey));
        }
        // Facet layout (mirrors GemShape in Icons.jsx): inner hexagon = deep
        // sapphire except its top-right wedge; outer ring = bright sapphire body.
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

// PNG writer (deflate + CRC32)
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

// BMP (DIB) entry: BITMAPINFOHEADER + 32-bit BGRA rows (bottom-up) + the 1bpp AND mask.
function toBMP(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);               // biSize
  header.writeInt32LE(size, 4);              // biWidth
  header.writeInt32LE(size * 2, 8);          // biHeight: XOR bitmap + AND mask
  header.writeUInt16LE(1, 12);               // biPlanes
  header.writeUInt16LE(32, 14);              // biBitCount
  header.writeUInt32LE(0, 16);               // biCompression: BI_RGB
  header.writeUInt32LE(size * size * 4, 20); // biSizeImage

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = ((size - 1 - y) * size + x) * 4; // rows are stored bottom-up
      const dst = (y * size + x) * 4;
      xor[dst] = rgba[src + 2];      // B
      xor[dst + 1] = rgba[src + 1];  // G
      xor[dst + 2] = rgba[src];      // R
      xor[dst + 3] = rgba[src + 3];  // A
    }
  }

  // AND mask: 1bpp, each row padded to 4 bytes. All zero — the alpha channel carries transparency.
  const and = Buffer.alloc(Math.ceil(size / 32) * 4 * size, 0);
  return Buffer.concat([header, xor, and]);
}

// ICO writer. PNG compression is ONLY valid for the 256px entry: Windows renders the smaller PNG
// entries as the default icon, so the taskbar and Start menu showed Electron's mark while Task
// Manager showed the gem — Task Manager reads a size that decodes, the shell reads one that does not.
// Every size below 256 is therefore written as a BMP entry.
function toICO(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
  const dirSize = 16 * count;
  let offset = 6 + dirSize;
  const entries = [];
  const blobs = [];
  for (const { size, data } of images) {
    const dirEntry = Buffer.alloc(16);
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 0);
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 1);
    dirEntry.writeUInt8(0, 2); dirEntry.writeUInt8(0, 3);
    dirEntry.writeUInt16LE(1, 4); dirEntry.writeUInt16LE(32, 6);
    dirEntry.writeUInt32LE(data.length, 8);
    dirEntry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(dirEntry);
    blobs.push(data);
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((size) => {
  const rgba = renderGem(size);
  return { size, data: size >= 256 ? toPNG(rgba, size) : toBMP(rgba, size) };
});

writeFileSync(path.join(outDir, 'icon.ico'), toICO(images));
// icon.png (256px, for electron-builder + BrowserWindow icon fallback)
writeFileSync(path.join(outDir, 'icon.png'), toPNG(renderGem(256), 256));
// 512px marketing png
writeFileSync(path.join(outDir, 'icon@512.png'), toPNG(renderGem(512), 512));

console.log('icons written:', sizes.join(', '), '+ icon.png + icon@512.png →', outDir);
