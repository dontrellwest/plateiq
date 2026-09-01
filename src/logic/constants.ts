// Ported line-for-line from the prototype's logic script (PlateIQ Redesign.dc.html, option 1b).
// Numeric tables here are spec — the stress harness enforces them. Visual tables (SKIN, DIM,
// BAR_ART) keep the prototype's values but express CSS gradients as stop lists for react-native-svg.

import type { Units, Mode, AnchorType, CollarId, SchemeId, SetSpec } from './types';

export const PLATE_SETS: Record<Units, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5, 1.25, 0.75, 0.5, 0.25],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25],
};
export const MICRO: Record<number, 1> = { 1.25: 1, 0.75: 1, 0.5: 1, 0.25: 1 };
// usable sleeve length in mm, and plate thickness in mm — a sleeve physically runs out of room
export const SLEEVE_MM: Record<Mode, number> = { barbell: 400, landmine: 400, dumbbell: 150 };
export const THICK: Record<number, number> = {
  45: 25, 35: 23, 25: 20, 20: 19, 15: 17, 10: 15, 5: 12, 2.5: 9, 1.25: 6, 0.75: 5, 0.5: 5, 0.25: 4,
};
export const BAR_SETS: Record<Units, number[]> = { lb: [35, 45, 55], kg: [15, 20, 25] };

export interface BarProfile { id: string; name: string; note: string; w: number; sleeve: number }
// named bar profiles — weight and usable sleeve length differ per bar, and both change the maths
export const BAR_PROFILES: Record<Units, BarProfile[]> = {
  lb: [
    { id: 'std', name: 'Standard barbell', note: '20 kg / 45 lb power bar', w: 45, sleeve: 400 },
    { id: 'womens', name: "Women's bar", note: '25 mm shaft, shorter sleeves', w: 35, sleeve: 350 },
    { id: 'tech', name: 'Technique bar', note: 'Alloy or composite training bar', w: 33, sleeve: 340 },
    { id: 'dl', name: 'Deadlift bar', note: 'Longer sleeves, more whip', w: 45, sleeve: 430 },
    { id: 'ez', name: 'EZ curl bar', note: 'Short sleeves — fills fast', w: 25, sleeve: 190 },
    { id: 'trap', name: 'Trap / hex bar', note: 'Open or fixed handles', w: 60, sleeve: 330 },
    { id: 'ssb', name: 'Safety squat bar', note: 'Padded yoke, cambered', w: 65, sleeve: 340 },
    { id: 'swiss', name: 'Swiss / football bar', note: 'Neutral grip pressing', w: 35, sleeve: 330 },
    { id: 'axle', name: 'Axle bar', note: '2 in shaft, strongman', w: 35, sleeve: 330 },
  ],
  kg: [
    { id: 'std', name: 'Standard barbell', note: '20 kg IPF-spec power bar', w: 20, sleeve: 400 },
    { id: 'womens', name: "Women's bar", note: '25 mm shaft, shorter sleeves', w: 15, sleeve: 320 },
    { id: 'tech', name: 'Technique bar', note: 'Alloy or composite training bar', w: 15, sleeve: 340 },
    { id: 'dl', name: 'Deadlift bar', note: 'Longer sleeves, more whip', w: 20, sleeve: 430 },
    { id: 'ez', name: 'EZ curl bar', note: 'Short sleeves — fills fast', w: 10, sleeve: 190 },
    { id: 'trap', name: 'Trap / hex bar', note: 'Open or fixed handles', w: 27.5, sleeve: 330 },
    { id: 'ssb', name: 'Safety squat bar', note: 'Padded yoke, cambered', w: 30, sleeve: 340 },
    { id: 'swiss', name: 'Swiss / football bar', note: 'Neutral grip pressing', w: 16, sleeve: 330 },
    { id: 'axle', name: 'Axle bar', note: '50 mm shaft, strongman', w: 15, sleeve: 330 },
  ],
};

export interface Collar { id: CollarId; name: string; note: string; w: number }
// collar weight is a PAIR total — only counted in competition mode
export const COLLARS: Record<Units, Collar[]> = {
  lb: [
    { id: 'none', name: 'None', note: 'Nothing on the sleeves', w: 0 },
    { id: 'clip', name: 'Spring clips', note: '≈0.5 lb each', w: 1 },
    { id: 'comp', name: 'Competition', note: '5.5 lb each — IPF spec', w: 11 },
  ],
  kg: [
    { id: 'none', name: 'None', note: 'Nothing on the sleeves', w: 0 },
    { id: 'clip', name: 'Spring clips', note: '≈0.25 kg each', w: 0.5 },
    { id: 'comp', name: 'Competition', note: '2.5 kg each — IPF spec', w: 5 },
  ],
};
export const DB_SETS: Record<Units, number[]> = { lb: [5, 10, 15], kg: [2.5, 5, 7.5] };
export const UNIT_STEP: Record<Units, number> = { lb: 5, kg: 2.5 };
export const LB_PER_KG = 2.2046226;

export interface PlateDim { h: number; w: number; fs: number }
export const DIM: Record<number, PlateDim> = {
  45: { h: 150, w: 30, fs: 13 },
  35: { h: 134, w: 28, fs: 13 },
  25: { h: 118, w: 26, fs: 13 },
  20: { h: 108, w: 25, fs: 12 },
  15: { h: 98, w: 24, fs: 12 },
  10: { h: 90, w: 23, fs: 12 },
  5: { h: 76, w: 21, fs: 12 },
  2.5: { h: 64, w: 19, fs: 12 },
  1.25: { h: 52, w: 18, fs: 11 },
  0.75: { h: 46, w: 17, fs: 11 },
  0.5: { h: 43, w: 16, fs: 11 },
  0.25: { h: 40, w: 15, fs: 11 },
};

// A plate face gradient: three stops top→bottom, the middle one at `mid`. The prototype expresses
// these as CSS linear-gradient(180deg, …); react-native-svg draws them from the stop list.
export interface Skin { stops: [string, string, string]; mid: number; bd: string; fg: string; hex?: string }

export const SKIN: Record<number, Skin> = {
  45: { stops: ['#6a86ef', '#3f57bd', '#2b3c8c'], mid: 0.48, bd: '#8098f5', fg: '#eef2ff', hex: '#3F57BD' },
  35: { stops: ['#e0b04e', '#bd8a24', '#8e6614'], mid: 0.48, bd: '#eec46e', fg: '#2a1f06', hex: '#BD8A24' },
  25: { stops: ['#4fbd85', '#2c9862', '#1d7049'], mid: 0.48, bd: '#6fd39c', fg: '#062015', hex: '#2C9862' },
  20: { stops: ['#e0705e', '#bd4a37', '#8e3325'], mid: 0.48, bd: '#ee8b79', fg: '#2a0d07', hex: '#BD4A37' },
  15: { stops: ['#9d7ce8', '#7354c4', '#553c96'], mid: 0.48, bd: '#b79bf0', fg: '#f2ecff', hex: '#7354C4' },
  10: { stops: ['#7c8794', '#525b66', '#3a4149'], mid: 0.48, bd: '#96a0ac', fg: '#f0f2f4', hex: '#525B66' },
  5: { stops: ['#a2acb8', '#79838f', '#5b636d'], mid: 0.48, bd: '#b8c1cb', fg: '#1b1f24', hex: '#79838F' },
  2.5: { stops: ['#c6cdd5', '#a3abb5', '#848c96'], mid: 0.48, bd: '#d8dee5', fg: '#1b1f24', hex: '#A3ABB5' },
  1.25: { stops: ['#e8c88c', '#c9a35c', '#9d7d40'], mid: 0.48, bd: '#f2d9a6', fg: '#241a08', hex: '#C9A35C' },
  0.75: { stops: ['#e0b9a0', '#bd8f70', '#916b50'], mid: 0.48, bd: '#eecfba', fg: '#241408', hex: '#BD8F70' },
  0.5: { stops: ['#d6d9de', '#b4b9c1', '#8f959e'], mid: 0.48, bd: '#e6e9ed', fg: '#1b1f24', hex: '#B4B9C1' },
  0.25: { stops: ['#e4e6ea', '#c6cad0', '#a2a7af'], mid: 0.48, bd: '#f0f2f4', fg: '#1b1f24', hex: '#C6CAD0' },
};

export const SKIN_LIGHT: Record<number, Skin> = {
  45: { stops: ['#7d95f2', '#4a61c4', '#374b9a'], mid: 0.52, bd: '#5f77d8', fg: '#fff' },
  35: { stops: ['#e8bd63', '#c4922a', '#9c701a'], mid: 0.52, bd: '#cfa03c', fg: '#2a1f06' },
  25: { stops: ['#5cc78f', '#309e67', '#237a50'], mid: 0.52, bd: '#3fae74', fg: '#062015' },
  20: { stops: ['#e88574', '#c8523d', '#9c3c2b'], mid: 0.52, bd: '#d46a54', fg: '#fff' },
  15: { stops: ['#a98cec', '#7c5fcd', '#5f479f'], mid: 0.52, bd: '#8f72da', fg: '#fff' },
  10: { stops: ['#9aa4b0', '#6d7783', '#565f69'], mid: 0.52, bd: '#8b95a1', fg: '#fff' },
  5: { stops: ['#bcc4ce', '#98a1ac', '#7d858f'], mid: 0.52, bd: '#a9b2bc', fg: '#1b1f24' },
  2.5: { stops: ['#dde2e8', '#bcc3cb', '#a2aab3'], mid: 0.52, bd: '#c9d0d8', fg: '#1b1f24' },
  1.25: { stops: ['#f0d6a2', '#d2ac67', '#a8854a'], mid: 0.52, bd: '#ddbc7d', fg: '#241a08' },
  0.75: { stops: ['#ecccb4', '#c69b7c', '#9c765a'], mid: 0.52, bd: '#d6ae92', fg: '#241408' },
  0.5: { stops: ['#e3e6ea', '#c2c7ce', '#a5abb3'], mid: 0.52, bd: '#d0d5db', fg: '#1b1f24' },
  0.25: { stops: ['#eef0f2', '#d2d6dc', '#b3b8c0'], mid: 0.52, bd: '#dfe2e6', fg: '#1b1f24' },
};

export const MONO: Skin = { stops: ['#818b98', '#4d555f', '#363c44'], mid: 0.48, bd: '#9aa4b0', fg: '#f0f2f4' };

// A plate seen edge-on is a cylinder, not a flat chip. One sheen pass across the face plus a real
// edge rim (instead of the old bright 1px outline) is what stops the stack reading as cardboard.
// The sheen is drawn by the Plate component; the rim colour is applied to every skin here, exactly
// as the prototype rewrote `bd` after prepending the SHEEN gradient.
export const SHEEN_STOPS: Array<{ offset: number; color: string; opacity: number }> = [
  { offset: 0, color: '#ffffff', opacity: 0.17 },
  { offset: 0.3, color: '#ffffff', opacity: 0.04 },
  { offset: 0.7, color: '#000000', opacity: 0.1 },
  { offset: 1, color: '#000000', opacity: 0.26 },
];
[SKIN, SKIN_LIGHT, { m: MONO } as Record<string, Skin>].forEach((table) => {
  Object.keys(table).forEach((k) => {
    (table as Record<string, Skin>)[k].bd = 'rgba(0,0,0,.34)';
  });
});

// effective-load coefficient per landmine anchoring method (pivot geometry differs)
export const ANCHOR_COEF: Record<AnchorType, number> = { rack: 0.8, hinge: 0.75, sleeve: 0.7 };
export const ANCHOR_LABEL: Record<AnchorType, string> = {
  rack: 'Wall/rack mount', hinge: 'Weighted hinge', sleeve: 'Floor sleeve/strap',
};
// pivot point of the bar within the illustration well, per anchoring hardware
export const ANCHOR_GEO: Record<AnchorType, { angle: number; px: number; py: number }> = {
  rack: { angle: -18, px: 78, py: 83 },
  hinge: { angle: -24, px: 62, py: 54 },
  sleeve: { angle: -30, px: 96, py: 37 },
};

export interface Scheme { id: SchemeId; name: string; note: string; rows: (r: number) => SetSpec[] }
// what happens AFTER the top set — every scheme is expressed as rows relative to the working weight
export const SCHEMES: Scheme[] = [
  { id: 'single', name: 'Single top set', note: 'One work set and you are done', rows: () => [] },
  {
    id: 'straight', name: 'Straight sets', note: 'Three sets at the same weight',
    rows: (r) => [
      { label: 'Set 2', pct: 100, reps: r, rest: 180 },
      { label: 'Set 3', pct: 100, reps: r, rest: 180 },
    ],
  },
  {
    id: 'backoff', name: 'Back-off sets', note: 'Two lighter sets at 85% for volume',
    rows: (r) => [
      { label: 'Back-off 1', pct: 85, reps: r + 3, rest: 150 },
      { label: 'Back-off 2', pct: 85, reps: r + 3, rest: 150 },
    ],
  },
  {
    id: 'reverse', name: 'Reverse pyramid', note: 'Down 10% a set, reps up',
    rows: (r) => [
      { label: 'Down to 90%', pct: 90, reps: r + 2, rest: 150 },
      { label: 'Down to 80%', pct: 80, reps: r + 4, rest: 150 },
    ],
  },
  {
    id: 'drop', name: 'Drop set', note: 'Strip and go again — rest is stripping time',
    rows: () => [
      { label: 'Drop 1', pct: 80, reps: 0, rest: 15 },
      { label: 'Drop 2', pct: 65, reps: 0, rest: 15 },
    ],
  },
  {
    id: 'cluster', name: 'Cluster set', note: 'Top weight split into mini-sets, 20s apart',
    rows: (r) => [
      { label: 'Cluster 2', pct: 100, reps: Math.max(1, Math.round(r / 2)), rest: 20 },
      { label: 'Cluster 3', pct: 100, reps: Math.max(1, Math.round(r / 2)), rest: 20 },
    ],
  },
  {
    id: 'amrap', name: 'AMRAP finisher', note: 'One all-out set at 60%',
    rows: () => [{ label: 'AMRAP', pct: 60, reps: 0, rest: 180 }],
  },
];

// Bar silhouettes. One stroked path per limb of the bar. A single continuous stroke with round
// joins reads as one smooth piece of steel. `dark` picks the darker steel gradient (padding, handles).
export interface BarArtPart { d: string; w: number; dark: boolean; flat: string }
export const pa = (d: string, w: number, dark?: boolean): BarArtPart => ({
  d, w, dark: !!dark,
  flat: dark ? '#6f767e' : '#949ba3', // picker rows are 54px wide — a gradient there just muddies
});
export const STEEL_STOPS = ['#cbd1d8', '#848b93', '#464c54'] as const;
export const STEEL_D_STOPS = ['#98a0a8', '#5f666e', '#343a41'] as const;

export const SLEEVE_T = 13; // loaded sleeve — thickest part of every bar

export interface BarArt { w?: number; h: number; parts: BarArtPart[] }
// Each profile owns its own box height so wide-framed bars (trap, Swiss) read at the same
// visual weight as the plates beside them instead of shrinking into a 40px strip.
export const BAR_ART: Record<string, BarArt> = {
  ez: {
    h: 48, parts: [
      pa('M0 24H28', SLEEVE_T), pa('M92 24H120', SLEEVE_T),
      pa('M26 24C34 24 34 15 42 15C50 15 51 33 60 33C69 33 70 15 78 15C86 15 86 24 94 24', 9),
      pa('M29 17V31', 4, true), pa('M91 17V31', 4, true),
    ],
  },
  trap: {
    w: 148, h: 78, parts: [
      pa('M0 39H26', SLEEVE_T), pa('M122 39H148', SLEEVE_T),
      pa('M24 39L48 6H100L124 39L100 72H48Z', 7),
      pa('M58 18V60', 9, true), pa('M90 18V60', 9, true),
    ],
  },
  ssb: {
    h: 60, parts: [
      pa('M0 18H30', SLEEVE_T), pa('M90 18H120', SLEEVE_T),
      pa('M29 18L43 34H77L91 18', 9),
      pa('M45 34H75', 22, true),
      pa('M52 45V57', 11, true), pa('M68 45V57', 11, true),
    ],
  },
  swiss: {
    h: 72, parts: [
      pa('M0 36H31', SLEEVE_T), pa('M89 36H120', SLEEVE_T),
      pa('M30 11H90V61H30Z', 7),
      pa('M50 13V59', 6, true), pa('M70 13V59', 6, true),
    ],
  },
};

// ---- demo constants (prototype boundary): production derives history from persisted logs.
// These are used only as sample data while the guided tour plays.
export interface DemoSession { when: string; ex: string; mode: string; top: string; meta: string; pr: boolean }
export const SESSIONS: DemoSession[] = [
  { when: 'Yesterday', ex: 'Bench press', mode: 'Barbell', top: '225 × 5', meta: '5 sets · 4,150 lb', pr: true },
  { when: 'Sat 25 Jul', ex: 'Landmine press', mode: 'Landmine', top: '130 × 8', meta: '4 sets · 2,880 lb', pr: false },
  { when: 'Thu 23 Jul', ex: 'Back squat', mode: 'Barbell', top: '315 × 3', meta: '6 sets · 6,720 lb', pr: false },
  { when: 'Tue 21 Jul', ex: 'DB row', mode: 'Dumbbell', top: '70 × 10', meta: '4 sets · 2,800 lb', pr: false },
  { when: 'Sun 19 Jul', ex: 'Bench press', mode: 'Barbell', top: '220 × 5', meta: '5 sets · 4,020 lb', pr: false },
];
export const VOL = [62, 71, 58, 80, 74, 88, 69, 92, 84, 96];

export interface Exercise { name: string; mode: Mode; last?: string; tag?: string }
export const EXERCISES: Exercise[] = [
  { name: 'Bench press', mode: 'barbell', last: '225 × 5', tag: 'Push' },
  { name: 'Back squat', mode: 'barbell', last: '315 × 3', tag: 'Legs' },
  { name: 'Deadlift', mode: 'barbell', last: '365 × 3', tag: 'Pull' },
  { name: 'Overhead press', mode: 'barbell', last: '135 × 5', tag: 'Push' },
  { name: 'Landmine press', mode: 'landmine', last: '130 × 8', tag: 'Push' },
  { name: 'Landmine row', mode: 'landmine', last: '115 × 10', tag: 'Pull' },
  { name: 'Meadows row', mode: 'landmine', last: '95 × 12', tag: 'Pull' },
  { name: 'DB bench press', mode: 'dumbbell', last: '70 × 8', tag: 'Push' },
  { name: 'DB row', mode: 'dumbbell', last: '70 × 10', tag: 'Pull' },
];

// eight weeks of estimated 1RM per lift — the number that actually tracks progress,
// since top-set weight alone hides a set that went 5 reps instead of 3.
export const TRENDS: Record<string, number[]> = {
  'Bench press': [242, 248, 245, 254, 258, 256, 264, 271],
  'Back squat': [330, 338, 341, 337, 352, 358, 361, 372],
  'Deadlift': [402, 408, 415, 411, 424, 430, 428, 441],
  'Overhead press': [148, 151, 149, 156, 158, 161, 160, 166],
  'Landmine press': [142, 145, 149, 147, 152, 156, 155, 161],
  'Landmine row': [126, 130, 129, 134, 138, 137, 142, 147],
  'Meadows row': [104, 107, 110, 108, 113, 116, 118, 121],
  'DB bench press': [78, 80, 79, 83, 84, 86, 85, 89],
  'DB row': [76, 78, 81, 80, 83, 85, 84, 88],
};

export interface Accent { id: string; name: string; base: string; hi: string; ink: string; deep: string }
export const ACCENTS: Accent[] = [
  { id: 'lime', name: 'Lime', base: '#bdeb4f', hi: '#cbf469', ink: '#161a12', deep: '#4f7a12' },
  { id: 'mint', name: 'Mint', base: '#4fe0a8', hi: '#6ff0bd', ink: '#04241a', deep: '#0d7050' },
  { id: 'sky', name: 'Sky', base: '#57c7f7', hi: '#7ad6ff', ink: '#04212e', deep: '#0a6890' },
  { id: 'iris', name: 'Iris', base: '#9c8cff', hi: '#b4a7ff', ink: '#120a33', deep: '#4a37c4' },
  { id: 'rose', name: 'Rose', base: '#ff7aa8', hi: '#ff9bbf', ink: '#33061a', deep: '#b02455' },
  { id: 'coral', name: 'Coral', base: '#ff8560', hi: '#ffa183', ink: '#331005', deep: '#b03d17' },
  { id: 'amber', name: 'Amber', base: '#ffc148', hi: '#ffd275', ink: '#2e1f00', deep: '#8a5a00' },
  { id: 'steel', name: 'Steel', base: '#cfd7e0', hi: '#e2e8ee', ink: '#161a1f', deep: '#4d5966' },
];

export const round5 = (n: number) => Math.round(n / 5) * 5;
export const round2_5 = (n: number) => Math.round(n / 2.5) * 2.5;
export const mmss = (s: number) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
