// Strips the alpha channel from simulator screenshots.
//
// `xcrun simctl io screenshot` always writes RGBA, and App Store Connect refuses any screenshot
// that carries an alpha channel — it is a hard upload failure, not a warning. macOS ships no tool
// that re-encodes a PNG without alpha (sips converts formats, not channel layouts), so this decodes
// the PNG, composites over black, and re-encodes as colour type 2.
//
// Run: node scripts/flatten-screenshots.js [dir]   (default: ./screenshots)
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let TAB = null;
function crc32(buf) {
  if (!TAB) {
    TAB = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TAB[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  const out = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return out;
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Undo the per-scanline filter and drop the alpha channel, compositing over black. */
function toRGB(raw, w, h, bpp) {
  const stride = w * bpp;
  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const out = Buffer.alloc(h * (w * 3 + 1));
  let ip = 0, op = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[ip++];
    raw.copy(cur, 0, ip, ip + stride);
    ip += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[i] = v & 0xff;
    }
    out[op++] = 0; // the output is written unfiltered
    for (let x = 0; x < w; x++) {
      const s = x * bpp;
      const alpha = bpp === 4 ? cur[s + 3] : 255;
      // over black, so a fully opaque source (which these are) round-trips exactly
      out[op++] = alpha === 255 ? cur[s] : Math.round((cur[s] * alpha) / 255);
      out[op++] = alpha === 255 ? cur[s + 1] : Math.round((cur[s + 1] * alpha) / 255);
      out[op++] = alpha === 255 ? cur[s + 2] : Math.round((cur[s + 2] * alpha) / 255);
    }
    cur.copy(prev);
  }
  return out;
}

function flatten(file) {
  const chunks = readChunks(fs.readFileSync(file));
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  const w = ihdr.data.readUInt32BE(0), h = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8], colorType = ihdr.data[9], interlace = ihdr.data[12];
  if (depth !== 8) throw new Error('expected 8-bit, got ' + depth);
  if (interlace !== 0) throw new Error('interlaced PNGs are not handled');
  if (colorType === 2) return { w, h, changed: false };
  if (colorType !== 6) throw new Error('expected RGBA or RGB, got colour type ' + colorType);

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const rgb = toRGB(zlib.inflateSync(idat), w, h, 4);

  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4);
  head[8] = 8; head[9] = 2; head[10] = 0; head[11] = 0; head[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    SIG, chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(rgb, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
  return { w, h, changed: true };
}

// App Store Connect, 6.9-inch iPhone display
const REQUIRED = { w: 1320, h: 2868 };

const dir = process.argv[2] || path.join(__dirname, '..', 'screenshots');
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
if (!files.length) { console.log('no PNGs in ' + dir); process.exit(0); }

let bad = 0;
for (const f of files) {
  const r = flatten(path.join(dir, f));
  const sizeOk = r.w === REQUIRED.w && r.h === REQUIRED.h;
  if (!sizeOk) bad++;
  console.log(
    (sizeOk ? 'ok  ' : 'SIZE') + '  ' + f.padEnd(34) +
    r.w + 'x' + r.h + '  ' + (r.changed ? 'alpha stripped' : 'already RGB')
  );
}
console.log('\n' + files.length + ' screenshot(s), 6.9-inch requirement ' + REQUIRED.w + 'x' + REQUIRED.h);
process.exit(bad ? 1 : 0);
