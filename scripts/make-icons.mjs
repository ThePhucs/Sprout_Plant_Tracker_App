// Draws the app icon (white sprout on green) as PNGs, no image library needed.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x2f, 0x7d, 0x4f], FG = [255, 255, 255];

function inEllipse(x, y, cx, cy, rx, ry, deg) {
  const a = (deg * Math.PI) / 180, dx = x - cx, dy = y - cy;
  const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
}
// Shape in 0..1 coordinates (y points down).
const inSprout = (x, y) =>
  (Math.abs(x - 0.5) <= 0.03 && y >= 0.44 && y <= 0.76) ||
  inEllipse(x, y, 0.5, 0.76, 0.03, 0.03, 0) ||
  inEllipse(x, y, 0.36, 0.43, 0.16, 0.075, 35) ||
  inEllipse(x, y, 0.64, 0.36, 0.18, 0.085, -35);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const S = 4; // 4x4 supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++)
          if (inSprout((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size)) hit++;
      const t = hit / (S * S), o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] + (FG[i] - BG[i]) * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-512', 512], ['icon-192', 192], ['apple-touch-icon', 180]])
  writeFileSync(`public/icons/${name}.png`, png(size));
console.log('icons written to public/icons');
