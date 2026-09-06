// Generates assets/rest-done.wav — the chime that plays when a rest ends.
//
// The file is synthesised from arithmetic rather than sourced, so the project owns it outright and
// there is no attribution or non-commercial clause to worry about at App Store review.
//
// Run once (the .wav is committed, this is not a build step):
//   node scripts/make-chime.js
// Audition it with:
//   afplay assets/rest-done.wav

const fs = require('fs');
const path = require('path');

const RATE = 44100;
const SECONDS = 0.75;
const N = Math.round(RATE * SECONDS);

// A5 then E6 — a rising perfect fifth. Reads as a cue, not an alarm.
const NOTES = [
  { f: 880.00, start: 0.00, dur: 0.55, gain: 1.00 },
  { f: 1318.51, start: 0.16, dur: 0.55, gain: 0.85 },
];

const buf = new Float64Array(N);
for (const n of NOTES) {
  const s0 = Math.round(n.start * RATE);
  const len = Math.round(n.dur * RATE);
  for (let i = 0; i < len && s0 + i < N; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004); // 4 ms ramp so there is no click
    const decay = Math.exp(-t / 0.16); // bell-like exponential tail
    const env = n.gain * attack * decay;
    const w = Math.sin(2 * Math.PI * n.f * t) + 0.22 * Math.sin(4 * Math.PI * n.f * t);
    buf[s0 + i] += env * w;
  }
}

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const scale = (0.89 * 32767) / (peak || 1);

const data = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * scale))), i * 2);
}

const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
head.writeUInt16LE(1, 22); head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28);
head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(data.length, 40);

const out = path.join(__dirname, '..', 'assets', 'rest-done.wav');
fs.writeFileSync(out, Buffer.concat([head, data]));
// eslint-disable-next-line no-console
console.log('wrote', out, (44 + data.length) + ' bytes');
