// App icon and splash mark: a loaded barbell seen from the side, in the app's default lime on its
// own near-black ground — the same image the app draws on every screen. No text and no rounded
// corners: iOS masks the square itself, and a wordmark is unreadable at the size an icon appears.
//
// A plate seen face-on was the first attempt and reads as a vinyl record at any size.
//
// Written as a generator rather than a checked-in binary so the colour can follow the app's palette
// (ACCENTS[0].base) if it ever changes. Run: node scripts/make-icon.js
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const GROUND = [0x0b, 0x0c, 0x0e]; // app.json splash backgroundColor
const LIME = [0xbd, 0xeb, 0x4f]; // ACCENTS[0].base
const LIME_HI = [0xcb, 0xf4, 0x69]; // ACCENTS[0].hi — a top-down lift, like the plate art in-app
const STEEL = [0x84, 0x8a, 0x90]; // the bar itself
const STEEL_HI = [0xc3, 0xc8, 0xce];

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Signed distance to a rounded rectangle, so every edge antialiases from one expression.
 * Negative inside, positive outside; coverage is a one-pixel ramp across zero.
 */
function rrect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - r;
}
const covOf = (d) => clamp01(0.5 - d);

/**
 * Geometry as fractions of the canvas. One plate per side rather than two: at 60 px — the size an
 * icon is actually looked at — a second plate closes the gap and the pair reads as one slab.
 */
const BAR_H = 0.052, BAR_W = 0.86, BAR_R = 0.026;
const PLATE_W = 0.135, PLATE_H = 0.54, PLATE_R = 0.030, PLATE_X = 0.245;
const COLLAR_W = 0.045, COLLAR_H = 0.13, COLLAR_R = 0.016, COLLAR_X = 0.145;

/** Returns [coverage, isPlate] for one pixel: plates and collars sit over the bar. */
function shape(x, y, S) {
  const cx = S / 2, cy = S / 2;
  const px = x + 0.5, py = y + 0.5;
  const bar = covOf(rrect(px, py, cx, cy, BAR_W * S, BAR_H * S, BAR_R * S));
  let plate = 0, collar = 0;
  for (const sgn of [-1, 1]) {
    plate = Math.max(plate, covOf(rrect(px, py, cx + sgn * PLATE_X * S, cy, PLATE_W * S, PLATE_H * S, PLATE_R * S)));
    // the inside shoulder is part of the bar, not a plate — in lime it read as a change plate
    // loaded inboard of the 45s, which is the wrong way round
    collar = Math.max(collar, covOf(rrect(px, py, cx + sgn * COLLAR_X * S, cy, COLLAR_W * S, COLLAR_H * S, COLLAR_R * S)));
  }
  return [clamp01(bar + collar - bar * collar), plate];
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}
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

/** alpha=false writes RGB (colour type 2) — an App Store icon must carry no alpha channel. */
function render(S, alpha) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc(S * (S * ch + 1));
  let p = 0;
  for (let y = 0; y < S; y++) {
    raw[p++] = 0; // filter: none
    const t = y / S;
    // the same top-down lift the in-app plate art uses
    const lime = [mix(LIME_HI[0], LIME[0], t), mix(LIME_HI[1], LIME[1], t), mix(LIME_HI[2], LIME[2], t)];
    const steel = [mix(STEEL_HI[0], STEEL[0], t), mix(STEEL_HI[1], STEEL[1], t), mix(STEEL_HI[2], STEEL[2], t)];
    for (let x = 0; x < S; x++) {
      const [bar, plate] = shape(x, y, S);
      const a = clamp01(bar + plate - bar * plate); // union
      const ink = [
        mix(steel[0], lime[0], plate), mix(steel[1], lime[1], plate), mix(steel[2], lime[2], plate),
      ];
      if (alpha) {
        raw[p++] = Math.round(ink[0]); raw[p++] = Math.round(ink[1]); raw[p++] = Math.round(ink[2]);
        raw[p++] = Math.round(a * 255);
      } else {
        raw[p++] = Math.round(mix(GROUND[0], ink[0], a));
        raw[p++] = Math.round(mix(GROUND[1], ink[1], a));
        raw[p++] = Math.round(mix(GROUND[2], ink[2], a));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = (name, buf) => {
  const f = path.join(__dirname, '..', 'assets', name);
  fs.writeFileSync(f, buf);
  console.log(name.padEnd(24), buf.length.toLocaleString(), 'bytes');
};
out('icon.png', render(1024, false));         // App Store: no alpha, square, edge to edge
out('splash-icon.png', render(1024, true));   // splash: the mark alone on the dark background
out('favicon.png', render(64, false));
