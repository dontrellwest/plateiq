// Randomised property tests over the solver, the view model, persistence, undo and the tour.
// Unlike qa/harness.ts (fixed seeds, the prototype's invariants) every run draws a fresh seed and
// prints it; reproduce a failure with PLATEIQ_SEED=<seed>. PLATEIQ_FULL=1 raises the count.

import { PlateIQLogic, MemoryHost } from '../src/logic/PlateIQLogic';
import { BAR_PROFILES } from '../src/logic/constants';
import type { AnchorType, AppState, CollarId, Mode, RoundTo, SchemeId, Units, Warmup } from '../src/logic/types';
import { partialize, sanitizePersisted } from '../src/store/useStore';

const FULL = process.env.PLATEIQ_FULL === '1';
const N = FULL ? 40000 : Number(process.env.PLATEIQ_INVARIANTS || 1500);
const SEED = Number(process.env.PLATEIQ_SEED || (Math.floor(Math.random() * 0x7fffffff) || 1));

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (p: number) => rng() < p;

const MODES: Mode[] = ['barbell', 'dumbbell', 'landmine'];
const ANCHORS: AnchorType[] = ['rack', 'hinge', 'sleeve'];
const ROUNDS: RoundTo[] = [0.25, 0.5, 1.25, 2.5];
const SCHEMES: SchemeId[] = ['single', 'straight', 'backoff', 'reverse', 'drop', 'cluster', 'amrap'];
const COLLARS: CollarId[] = ['none', 'clip', 'comp'];

function randomState(): Partial<AppState> {
  const units: Units = chance(0.5) ? 'lb' : 'kg';
  const mode = pick(MODES);
  const profs = BAR_PROFILES[units];
  const prof = chance(0.8) ? pick(profs) : null;
  const bar = prof ? prof.w : Math.round((units === 'kg' ? 5 + rng() * 25 : 10 + rng() * 60) * 4) / 4;
  const step = units === 'kg' ? 2.5 : 5;
  const plateSet = units === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25] : [45, 35, 25, 10, 5, 2.5, 1.25, 0.75, 0.5, 0.25];
  const qty: Record<number, number> = {};
  plateSet.forEach((w) => { qty[w] = int(0, 3); });
  const warmups: Warmup[] = [];
  const nW = int(0, 6);
  const pcts = new Set<number>();
  while (pcts.size < nW) pcts.add(int(0, 19) * 5);
  Array.from(pcts).sort((a, b) => a - b).forEach((pct, i) => warmups.push({ id: 'w' + i, label: pct === 0 ? 'Empty bar' : pct + '%', pct, reps: int(1, 12), rest: pick([30, 45, 60, 90, 120, 180]) }));
  return {
    units, mode, bar, barProfile: prof ? prof.id : 'custom', barDraft: String(bar),
    working: Math.max(bar, Math.round((bar + rng() * (units === 'kg' ? 180 : 400)) / step) * step + (chance(0.2) ? pick([0.25, 0.5, 1.25, 2.5]) : 0)),
    dbHandle: pick(units === 'kg' ? [2.5, 5, 7.5] : [5, 10, 15]),
    dbTotal: 0, // set below: never less than the handle plus one step (unreachable through the UI)
    dbPair: chance(0.5),
    lmTarget: Math.round((10 + rng() * (units === 'kg' ? 80 : 200)) * 2) / 2,
    anchorType: pick(ANCHORS),
    roundTo: pick(ROUNDS),
    homeGym: chance(0.4), qty,
    comp: chance(0.3), collarId: pick(COLLARS), minChanges: chance(0.5),
    scheme: pick(SCHEMES), warmups,
    autoRest: chance(0.7),
  } as Partial<AppState>;
}
function randomStateFixed(): Partial<AppState> {
  const p = randomState();
  const step = p.units === 'kg' ? 2.5 : 5;
  p.dbTotal = Math.max(p.dbHandle! + step, Math.round((5 + rng() * (p.units === 'kg' ? 50 : 120)) * 4) / 4);
  return p;
}

function fresh(patch: Partial<AppState>): PlateIQLogic {
  const l = new PlateIQLogic(new MemoryHost(), { startOnOnboarding: false, plateStyle: 'dimensional' });
  l.setState({ tour: false, onboard: false, ...patch });
  return l;
}
const state = (l: PlateIQLogic) => (l as unknown as { state: AppState }).state;

const failures: string[] = [];
let checkedSets = 0;
function check(cond: boolean, msg: () => string) {
  if (!cond && failures.length < 20) failures.push(msg());
}
/** Any string in the view model that leaked a broken number. */
function walkStrings(v: unknown, path: string, out: string[], depth = 0) {
  if (depth > 6 || out.length > 10) return;
  if (typeof v === 'string') {
    if (/\bNaN\b|undefined|Infinity|\[object/.test(v)) out.push(path + ' = ' + JSON.stringify(v));
  } else if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(path + ' = ' + v);
  } else if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, path + '[' + i + ']', out, depth + 1));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walkStrings((v as Record<string, unknown>)[k], path + '.' + k, out, depth + 1));
}

describe('randomised invariants (seed ' + SEED + ', ' + N.toLocaleString() + ' states)', () => {
  test('plan(): every set is finite, made of real plates, adds up, and hits its target when it says it does', () => {
    for (let i = 0; i < N; i++) {
      const patch = randomStateFixed();
      const l = fresh(patch);
      const p = l.plan();
      const flat = p.sets.concat([p.work], p.after);
      const base = l.baseTotal();
      const plateSet = l.plateSet();
      const k = patch.mode === 'landmine' ? 1 : 2;
      flat.forEach((s, j) => {
        checkedSets++;
        const tag = () => '#' + i + ' set ' + j + ' ' + JSON.stringify({ mode: patch.mode, units: patch.units, bar: patch.bar, want: s.want }) + ' -> ' + JSON.stringify({ total: s.total, main: s.main, side: s.side, miss: s.miss, overBase: s.overBase, full: s.full });
        check([s.total, s.main, s.want, s.miss].every(Number.isFinite), () => 'non-finite ' + tag());
        check(s.side.every((w) => plateSet.indexOf(w) >= 0), () => 'plate not in set ' + tag());
        const sum = s.side.reduce((a, b) => a + b, 0);
        check(Math.abs(s.total - (base + k * sum)) < 1e-6, () => 'total != base + plates ' + tag());
        if (patch.mode === 'landmine') {
          // A landmine target is effective weight; only the loaded side sits on a plate grid, so
          // main == want does not hold. What must hold is that the effective number shown is
          // exactly the loaded bar seen through the anchor, on the solver's effective step.
          const coef = { rack: 0.8, hinge: 0.75, sleeve: 0.7 }[patch.anchorType!];
          const effStep = patch.units === 'kg' ? 0.25 : 0.5;
          const proj = Math.round(s.total * coef / effStep) * effStep;
          check(Math.abs(s.main - proj) < 1e-6, () => 'effective main is not the loaded bar through the anchor (' + proj + ') ' + tag());
        } else if (s.miss === 0 && !s.overBase && !s.full) {
          check(Math.abs(s.main - s.want) < 1e-6, () => 'miss 0 but main != want ' + tag());
        }
        if (patch.homeGym && patch.mode === 'barbell') {
          const counts: Record<number, number> = {};
          s.side.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
          Object.keys(counts).forEach((w) => check(counts[Number(w)] <= (patch.qty![Number(w)] || 0), () => 'more ' + w + ' plates per side than owned pairs ' + tag()));
        }
      });
      if (patch.mode === 'barbell' && p.work.miss !== 0 && !p.work.overBase) {
        const a = l.alts(p.work.want);
        [a.below, a.above].forEach((alt) => {
          if (alt === null) return;
          const e = l.evaluate(alt, null);
          check(e.miss === 0, () => '#' + i + ' alternative ' + alt + ' is not itself loadable ' + JSON.stringify(patch));
        });
      }
    }
    // eslint-disable-next-line no-console
    console.log('invariants: seed ' + SEED + ', ' + N.toLocaleString() + ' states, ' + checkedSets.toLocaleString() + ' sets; ' + (failures.length ? failures.length + ' failures' : 'no failures'));
    expect(failures).toEqual([]);
  });

  test('renderVals(): no NaN, undefined or Infinity ever reaches a label', () => {
    const bad: string[] = [];
    for (let i = 0; i < Math.ceil(N / 4) && bad.length < 10; i++) {
      const patch = randomStateFixed();
      const l = fresh(patch);
      if (chance(0.3)) l.tapSet(0);
      if (chance(0.3)) l.renderVals().openReverse();
      const out: string[] = [];
      walkStrings(JSON.parse(JSON.stringify(l.renderVals())), 'v', out);
      out.forEach((o) => bad.push('#' + i + ' ' + o + ' ' + JSON.stringify(patch)));
    }
    expect(bad).toEqual([]);
  });

  test('persistence: a state survives serialise -> parse -> sanitize unchanged', () => {
    for (let i = 0; i < Math.ceil(N / 4); i++) {
      const l = fresh(randomStateFixed());
      const before = partialize(state(l));
      const after = sanitizePersisted(JSON.parse(JSON.stringify(before)));
      expect(after).toEqual(before);
    }
  });

  test('undo of a logged set restores exactly the pre-log rest state', () => {
    for (let i = 0; i < Math.ceil(N / 4); i++) {
      const l = fresh(randomStateFixed());
      const n = l.plan().sets.length + 1 + l.plan().after.length;
      const idx = int(0, n - 1);
      l.tapSet(idx);
      const s0 = state(l);
      const snap = { activeIdx: s0.activeIdx, doneIdx: s0.doneIdx, log: s0.log, allDone: s0.allDone, paused: s0.paused, remaining: s0.remaining, restTotal: s0.restTotal };
      l.finishRest();
      l.applyUndo();
      const s1 = state(l);
      expect({ activeIdx: s1.activeIdx, doneIdx: s1.doneIdx, log: s1.log, allDone: s1.allDone, paused: s1.paused, remaining: s1.remaining, restTotal: s1.restTotal }).toEqual(snap);
    }
  });

  test('the tour puts every persisted value back except tourSeen', () => {
    for (let i = 0; i < Math.ceil(N / 8); i++) {
      const l = fresh(randomStateFixed());
      l.tourHost = { press: () => false, scrollTo: () => undefined, setProgress: () => undefined };
      if (chance(0.5)) l.tapSet(0);
      const before = partialize(state(l)) as Record<string, unknown>;
      l.startTour('settings');
      l.endTour(chance(0.5));
      const after = partialize(state(l)) as Record<string, unknown>;
      ['tourSeen', 'tourSnap', 'restEndsAt', 'remaining'].forEach((k) => { delete before[k]; delete after[k]; });
      expect(after).toEqual(before);
    }
  });

  test('every stepper press keeps the field and the card on the same number', () => {
    const bad: string[] = [];
    for (let i = 0; i < Math.ceil(N / 4) && bad.length < 8; i++) {
      const patch = randomStateFixed();
      if (patch.mode === 'landmine') continue; // landmine targets are a projection, checked separately
      const l = fresh(patch);
      const v = l.renderVals();
      const read = () => (patch.mode === 'dumbbell' ? state(l).dbTotal : state(l).working);
      for (let k = 0; k < 6; k++) {
        const before = read();
        (chance(0.5) ? v.incWorking : v.decWorking)();
        const after = read();
        const want = l.plan().work.want;
        if (Math.abs(after - want) > 1e-6) bad.push('#' + i + ' field ' + after + ' vs card ' + want + ' ' + JSON.stringify({ mode: patch.mode, units: patch.units, roundTo: patch.roundTo, bar: patch.bar, before }));
        const floor = patch.mode === 'dumbbell' ? patch.dbHandle! : patch.bar!;
        if (after < floor - 1e-6) bad.push('#' + i + ' stepped below the implement: ' + after + ' < ' + floor);
      }
    }
    expect(bad).toEqual([]);
  });

  test('a typed target is read the same with either decimal separator and never lands below the implement', () => {
    for (let i = 0; i < Math.ceil(N / 4); i++) {
      const patch = randomStateFixed();
      const l = fresh(patch);
      const dot = fresh(patch);
      const v = Math.round((10 + rng() * 300) * 4) / 4;
      l.setState({ workDraft: String(v).replace('.', ',') });
      dot.setState({ workDraft: String(v) });
      l.commitWorking(); dot.commitWorking();
      const read = (x: PlateIQLogic) => (patch.mode === 'dumbbell' ? state(x).dbTotal : patch.mode === 'landmine' ? state(x).lmTarget : state(x).working);
      expect(read(l)).toBe(read(dot));
      expect(Number.isFinite(read(l))).toBe(true);
      if (patch.mode === 'barbell') expect(read(l)).toBeGreaterThanOrEqual(patch.bar!);
      if (patch.mode === 'dumbbell') expect(read(l)).toBeGreaterThanOrEqual(patch.dbHandle!);
    }
  });

  test('switching units and back keeps every weight finite and above its implement', () => {
    for (let i = 0; i < Math.ceil(N / 8); i++) {
      const l = fresh(randomStateFixed());
      const u = state(l).units;
      l.setUnits(u === 'kg' ? 'lb' : 'kg');
      l.setUnits(u);
      const s = state(l);
      expect([s.bar, s.working, s.dbHandle, s.dbTotal, s.lmTarget, s.rmW].every(Number.isFinite)).toBe(true);
      expect(s.working).toBeGreaterThanOrEqual(s.bar);
      expect(s.dbTotal).toBeGreaterThanOrEqual(s.dbHandle);
    }
  });
});
