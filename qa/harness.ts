// Port of design_handoff_plateiq/qa/stress-test.html — the executable spec.
// Same invariants, same deterministic seeds (mulberry32 20260802 for the solver phase and
// 99188271 for the UI phase), same RNG consumption order, so a run here is comparable with the
// prototype's green run. __tests__/stress.test.ts drives it against the headless MemoryHost;
// __tests__/store.test.ts drives the same phase B against the zustand-backed store.

import { PlateIQLogic, MemoryHost } from '../src/logic/PlateIQLogic';
import type { AppState, AnchorType, Load, Mode, SchemeId, Units, RoundTo, CollarId } from '../src/logic/types';

// headless stubs for the tour's rAF timeline (frames are stepped manually below)
(globalThis as unknown as { requestAnimationFrame: () => number }).requestAnimationFrame = () => 0;
(globalThis as unknown as { cancelAnimationFrame: () => void }).cancelAnimationFrame = () => {};

// deterministic RNG so any failure is reproducible from its seed
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FULL = process.env.PLATEIQ_FULL === '1';
export const A_TOTAL = FULL ? 1000000 : Number(process.env.PLATEIQ_SCENARIOS || 20000);
export const B_USERS = FULL ? 5000 : Number(process.env.PLATEIQ_USERS || 200);
export const B_ACTIONS = 50;

export const RESULTS = { sets: 0, actions: 0, failures: [] as string[], categories: {} as Record<string, number> };
const EXAMPLES: Record<string, string[]> = {};
export function resetResults() {
  RESULTS.sets = 0; RESULTS.actions = 0; RESULTS.failures = []; RESULTS.categories = {};
  Object.keys(EXAMPLES).forEach((k) => delete EXAMPLES[k]);
}
export type Fresh = () => PlateIQLogic;
function fail(cat: string, detail: string) {
  RESULTS.categories[cat] = (RESULTS.categories[cat] || 0) + 1;
  (EXAMPLES[cat] = EXAMPLES[cat] || []).length < 3 && EXAMPLES[cat].push(detail);
  if (RESULTS.failures.length < 25) RESULTS.failures.push(cat + ' :: ' + detail);
}

const PLATE_SETS: Record<Units, number[]> = { lb: [45, 35, 25, 10, 5, 2.5, 1.25, 0.75, 0.5, 0.25], kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25] };
const THICK: Record<number, number> = { 45: 25, 35: 23, 25: 20, 20: 19, 15: 17, 10: 15, 5: 12, 2.5: 9, 1.25: 6, 0.75: 5, 0.5: 5, 0.25: 4 };
const COEF: Record<AnchorType, number> = { rack: 0.80, hinge: 0.75, sleeve: 0.70 };
const EXERCISES = ['Bench press', 'Back squat', 'Deadlift', 'Overhead press', 'Landmine press', 'Landmine row', 'Meadows row', 'DB bench press', 'DB row'];
const BAR_PROFILES_BY_UNIT = { lb: 9, kg: 9 };

export function fresh(): PlateIQLogic {
  const c = new PlateIQLogic(new MemoryHost(), { startOnOnboarding: false, plateStyle: 'dimensional' });
  c.setState({ onboard: false });
  return c;
}

// ---------- scenario randomizer (identical rnd() order to the prototype) ----------
export function randomize(c: PlateIQLogic, rnd: () => number) {
  const units: Units = rnd() < 0.5 ? 'lb' : 'kg';
  const mode = (['barbell', 'dumbbell', 'landmine'] as Mode[])[Math.floor(rnd() * 3)];
  void BAR_PROFILES_BY_UNIT;
  const s: Partial<AppState> = {};
  s.units = units;
  s.mode = mode;
  s.anchorType = (['rack', 'hinge', 'sleeve'] as AnchorType[])[Math.floor(rnd() * 3)];
  s.roundTo = ([0.25, 0.5, 1.25, 2.5] as RoundTo[])[Math.floor(rnd() * 4)];
  s.minChanges = rnd() < 0.8;
  s.comp = rnd() < 0.2;
  s.collarId = (['none', 'clip', 'comp'] as CollarId[])[Math.floor(rnd() * 3)];
  s.homeGym = rnd() < 0.4;
  s.dbPair = rnd() < 0.5;
  const qty: Record<number, number> = {};
  PLATE_SETS[units].forEach((w) => { qty[w] = rnd() < 0.15 ? 0 : Math.floor(rnd() * 9); });
  if (rnd() < 0.05) PLATE_SETS[units].forEach((w) => { qty[w] = 0; });
  s.qty = qty;
  // the prototype mutated c.state.units before asking for barProfiles(); apply units first
  c.setState({ units });
  // bar: named profile ~70%, custom typed weight otherwise
  if (rnd() < 0.7) {
    const list = c.barProfiles();
    const p = list[Math.floor(rnd() * list.length)];
    s.barProfile = p.id; s.bar = p.w;
  } else {
    s.barProfile = 'custom';
    s.bar = Math.round((10 + rnd() * 90) * 4) / 4;
  }
  s.dbHandle = Math.round((2 + rnd() * 13) * 4) / 4;
  // targets: mostly on the UI grid, sometimes arbitrary 2dp (typed / imported values)
  const grid = (v: number, step: number) => Math.round(v / step) * step;
  const arb = rnd() < 0.25;
  const wTarget = s.bar + rnd() * (units === 'kg' ? 280 : 600);
  s.working = arb ? Math.round(wTarget * 100) / 100 : Math.max(s.bar, grid(wTarget, s.roundTo * 2));
  const dTarget = s.dbHandle + rnd() * (units === 'kg' ? 60 : 140);
  s.dbTotal = arb ? Math.round(dTarget * 100) / 100 : Math.max(s.dbHandle, grid(dTarget, s.roundTo * 2));
  const lTarget = 5 + rnd() * (units === 'kg' ? 180 : 400);
  s.lmTarget = arb ? Math.round(lTarget * 100) / 100 : Math.max(1, grid(lTarget, s.roundTo));
  s.scheme = (['single', 'straight', 'backoff', 'reverse', 'drop', 'cluster', 'amrap'] as SchemeId[])[Math.floor(rnd() * 7)];
  const n = Math.floor(rnd() * 7);
  const warm: AppState['warmups'] = [];
  for (let i = 0; i < n; i++) {
    warm.push({ id: 'w' + i, label: '', pct: Math.round(rnd() * 19) * 5, reps: 1 + Math.floor(rnd() * 30), rest: 15 + Math.floor(rnd() * 285) });
  }
  warm.sort((a, b) => a.pct - b.pct);
  warm.forEach((w) => { w.label = w.pct === 0 ? 'Empty bar' : w.pct + '%'; });
  s.warmups = warm;
  s.activeIdx = null; s.doneIdx = []; s.allDone = false; s.log = {}; s.undo = null;
  c.setState(s);
}

function describe_(c: PlateIQLogic) {
  const s = c.state;
  return JSON.stringify({ u: s.units, m: s.mode, bar: s.bar, prof: s.barProfile, w: s.working, db: [s.dbHandle, s.dbTotal, s.dbPair], lm: [s.lmTarget, s.anchorType], rt: s.roundTo, mc: s.minChanges, comp: [s.comp, s.collarId], hg: s.homeGym, qty: s.homeGym ? s.qty : 'inf', warm: s.warmups.map((w) => w.pct), sch: s.scheme });
}

// ---------- per-set invariants ----------
function checkSet(c: PlateIQLogic, e: Load, tag: string) {
  const s = c.state;
  const single = s.mode === 'landmine';
  const base = c.baseTotal();
  (['total', 'main', 'want', 'short'] as const).forEach((k) => {
    if (!Number.isFinite(e[k])) fail('NaN:' + k, tag + ' ' + k + '=' + e[k] + ' ' + describe_(c));
  });
  if (e.side.length > 60) fail('side-length', tag + ' ' + e.side.length + ' plates ' + describe_(c));
  const set = PLATE_SETS[s.units];
  e.side.forEach((w) => { if (set.indexOf(w) < 0) fail('alien-plate', tag + ' plate ' + w + ' ' + describe_(c)); });
  // exact accounting
  const sum = e.side.reduce((a, b) => a + b, 0);
  const total = Math.round((base + (single ? sum : sum * 2)) * 100) / 100;
  if (Math.abs(total - e.total) > 0.005) fail('accounting', tag + ' listed ' + e.total + ' recomputed ' + total + ' ' + describe_(c));
  // physical sleeve room
  const mm = e.side.reduce((a, b) => a + THICK[b], 0);
  if (mm > c.sleeveCap() + 0.001) fail('sleeve-overflow', tag + ' ' + mm + 'mm > ' + c.sleeveCap() + 'mm ' + describe_(c));
  // inventory honesty
  if (s.homeGym) {
    const per = s.mode === 'dumbbell' && s.dbPair ? 4 : (single ? 1 : 2);
    const used: Record<number, number> = {};
    e.side.forEach((w) => { used[w] = (used[w] || 0) + 1; });
    Object.keys(used).forEach((k) => {
      const w = Number(k);
      if (used[w] * per > (s.qty[w] || 0)) fail('rack-overdraw', tag + ' uses ' + used[w] + '×' + w + ' per=' + per + ' owned=' + (s.qty[w] || 0) + ' ' + describe_(c));
    });
  }
  // landmine shown value must be the coefficient product of the loaded total
  if (single) {
    const coef = COEF[s.anchorType];
    const effStep = s.units === 'kg' ? 0.25 : 0.5;
    const shown = Math.round(e.total * coef / effStep) * effStep;
    if (Math.abs(shown - e.main) > 0.001) fail('landmine-eff', tag + ' main ' + e.main + ' expected ' + shown + ' ' + describe_(c));
  }
  // miss flag consistency with its own tolerance rules
  const floor = single ? Math.round(base * COEF[s.anchorType] / (s.units === 'kg' ? 0.25 : 0.5)) * (s.units === 'kg' ? 0.25 : 0.5) : base;
  if (e.overBase !== (e.want + 0.011 < floor)) fail('overbase-flag', tag + ' want ' + e.want + ' floor ' + floor + ' flag ' + e.overBase + ' ' + describe_(c));
  return e;
}

// ---------- phase A: solver scenarios ----------
export function phaseA(total: number = A_TOTAL, make: Fresh = fresh) {
  const rndA = mulberry32(20260802);
  const inst = make();
  for (let aDone = 0; aDone < total; aDone++) {
    randomize(inst, rndA);
    let p: ReturnType<PlateIQLogic['plan']>;
    try { p = inst.plan(); } catch (err) { fail('plan-throw', (err as Error).message + ' ' + describe_(inst)); continue; }
    const flat = p.sets.concat([p.work], p.after);
    let prev: number[] | null = null;
    for (let i = 0; i < flat.length; i++) {
      const e = checkSet(inst, flat[i], 'set' + i);
      RESULTS.sets++;
      // inheritance may never cost accuracy or bulk vs a clean greedy solve (sampled — 2× cost)
      if (inst.state.minChanges && prev && rndA() < 0.08) {
        try {
          const g = inst.evaluate(e.want, null, flat[i].pct === 0);
          const eGap = Math.abs(e.want - e.main), gGap = Math.abs(e.want - g.main);
          // Landmine contract: the ask is quantized onto the loaded roundTo grid THROUGH the
          // anchor coefficient, then read back on the effective grid. Any load hitting the
          // achievable target exactly may sit up to coef*(roundTo/2) + effStep/2 from the raw
          // ask. Only drift beyond that bound is a defect.
          const effStep = inst.state.units === 'kg' ? 0.25 : 0.5;
          const slack = inst.state.mode === 'landmine'
            ? COEF[inst.state.anchorType] * (inst.state.roundTo / 2) + effStep / 2
            : 0;
          if (eGap > gGap + slack + 0.011) fail('inherit-worse', 'set' + i + ' inherited gap ' + eGap + ' vs greedy ' + gGap + ' slack ' + slack + ' ' + describe_(inst));
          if (e.side.length > g.side.length) fail('inherit-bulkier', 'set' + i + ' ' + e.side.length + ' vs ' + g.side.length + ' plates ' + describe_(inst));
        } catch (err) { fail('greedy-throw', (err as Error).message + ' ' + describe_(inst)); }
      }
      prev = e.side;
    }
    // alternatives, exactly when the app would offer them
    if (p.work.miss !== 0 && !p.work.overBase && rndA() < 0.3) {
      try {
        const av = inst.alts(p.work.want);
        if (av.below !== null) {
          if (!(av.below < p.work.want)) fail('alt-below-order', av.below + ' !< ' + p.work.want + ' ' + describe_(inst));
          const eb = inst.evaluate(av.below, null); // a quote must be a fixed point of the solver
          if (eb.miss !== 0 || Math.abs(eb.main - av.below) > 0.001) fail('alt-below-unloadable', av.below + ' -> ' + eb.main + '/' + eb.miss + ' ' + describe_(inst));
        }
        if (av.above !== null) {
          if (!(av.above > p.work.want)) fail('alt-above-order', av.above + ' !> ' + p.work.want + ' ' + describe_(inst));
          const ea = inst.evaluate(av.above, null);
          if (ea.miss !== 0 || Math.abs(ea.main - av.above) > 0.001) fail('alt-above-unloadable', av.above + ' -> ' + ea.main + '/' + ea.miss + ' ' + describe_(inst));
        }
      } catch (err) { fail('alts-throw', (err as Error).message + ' ' + describe_(inst)); }
    }
  }
}

// ---------- phase B: UI state-machine fuzz ----------
export function checkState(c: PlateIQLogic, tag: string) {
  const s = c.state;
  (['bar', 'working', 'dbHandle', 'dbTotal', 'lmTarget', 'remaining', 'restTotal', 'rmW'] as const).forEach((k) => {
    if (!Number.isFinite(s[k])) fail('state-NaN:' + k, tag + ' = ' + s[k]);
  });
  if (s.remaining < 0) fail('neg-remaining', tag);
  if (typeof s.barDraft !== 'string') fail('barDraft-type', tag + ' ' + typeof s.barDraft);
  if (s.activeIdx !== null && (!Number.isInteger(s.activeIdx) || s.activeIdx < 0)) fail('activeIdx', tag + ' ' + s.activeIdx);
  const seen: Record<number, 1> = {};
  s.doneIdx.forEach((i) => {
    if (!Number.isInteger(i) || i < 0) fail('doneIdx-entry', tag + ' ' + i);
    if (seen[i]) fail('doneIdx-dupe', tag + ' ' + i); seen[i] = 1;
  });
  for (let i = 1; i < s.warmups.length; i++) if (s.warmups[i - 1].pct > s.warmups[i].pct) fail('warmups-unsorted', tag);
  s.warmups.forEach((w) => {
    if (w.pct < 0 || w.pct > 95) fail('warmup-pct', tag + ' ' + w.pct);
    if (w.reps < 1 || w.reps > 30) fail('warmup-reps', tag + ' ' + w.reps);
  });
  Object.keys(s.log).forEach((k) => {
    const e = s.log[Number(k)];
    (['w', 'r', 'planW', 'planR'] as const).forEach((f) => { if (!Number.isFinite(e[f]) || e[f] < 0) fail('log-entry', tag + ' ' + f + '=' + e[f]); });
  });
  if (!Array.isArray(s.session)) fail('session-type', tag);
  // tour invariants
  if ([false, 'play', 'auto'].indexOf(s.tour) < 0) fail('tour-state', tag + ' ' + s.tour);
  if (s.tour !== 'play' && (s.tourWait || s.tourCard || s.tourCap || s.tourPaused)) fail('tour-residue', tag + ' wait=' + s.tourWait + ' card=' + !!s.tourCard + ' cap=' + !!s.tourCap + ' paused=' + s.tourPaused);
  // note: onboard may stay true while an onboarding-launched tour plays; renderVals hides the overlay via obShow
  if (s.tour === 'play') { const v0 = c.renderVals(); if (v0.onboard) fail('onboard-visible-during-tour', tag); if (!v0.tourOn) fail('tourOn-false-while-play', tag); }
  if (s.tourNote && s.tour === 'play') fail('tourNote-during-tour', tag);
  if (typeof s.tourCap !== 'string') fail('tourCap-type', tag);
  s.sessionDone.forEach((n) => { if (typeof n !== 'string') fail('sessionDone-entry', tag); });
  let v: ReturnType<PlateIQLogic['renderVals']>;
  try { v = c.renderVals(); } catch (err) { fail('render-throw', tag + ' ' + (err as Error).message); return; }
  (['pivotX', 'pivotY', 'rotate', 'wellH', 'workWellH', 'trendDotX', 'trendDotY'] as const).forEach((k) => {
    if (!Number.isFinite(v[k])) fail('render-NaN:' + k, tag + ' = ' + v[k]);
  });
  if (v.timer && v.timer.show) {
    const d = parseFloat(v.timer.dash as string);
    if (!(d >= -0.001 && d <= 144.51)) fail('timer-dash', tag + ' dash=' + v.timer.dash);
  }
  v.sets.forEach((x, i) => {
    if (!Number.isFinite(parseFloat(x.main))) fail('card-main', tag + ' set' + i + ' ' + x.main);
    if (x.right.some((pp) => !Number.isFinite(pp.w) || !Number.isFinite(pp.h))) fail('card-plates', tag + ' set' + i);
  });
  if (!Number.isFinite(parseFloat(v.work.main))) fail('work-main', tag + ' ' + v.work.main);
}

const GARBAGE_DRAFTS = ['', 'abc', '0', '-5', '1e3', '47.3', '.5', '999999', '12,5', '  20 '];
function randomAction(c: PlateIQLogic, rnd: () => number): string {
  const v = c.renderVals();
  const flatLen = v.sets.length + 1;
  const roll = rnd();
  if (roll < 0.18) { c.tapSet(Math.floor(rnd() * (flatLen + 2))); return 'tapSet'; }
  if (roll < 0.26) { c.finishRest(); return 'finishRest'; }
  if (roll < 0.30) { c.bumpRest(rnd() < 0.5 ? -15 : 30); return 'bumpRest'; }
  if (roll < 0.34) { c.addSet(); return 'addSet'; }
  if (roll < 0.38) {
    const w = c.state.warmups;
    c.removeSet(w.length && rnd() < 0.9 ? w[Math.floor(rnd() * w.length)].id : 'bogus');
    return 'removeSet';
  }
  if (roll < 0.42) {
    const w = c.state.warmups;
    if (w.length) c.setPct(w[Math.floor(rnd() * w.length)].id, rnd() < 0.5 ? -5 : 5);
    return 'setPct';
  }
  if (roll < 0.45) {
    const w = c.state.warmups;
    if (w.length) c.setReps(w[Math.floor(rnd() * w.length)].id, rnd() < 0.5 ? -1 : 1);
    return 'setReps';
  }
  if (roll < 0.48) { c.setMode((['barbell', 'dumbbell', 'landmine'] as Mode[])[Math.floor(rnd() * 3)]); return 'setMode'; }
  if (roll < 0.52) { c.setUnits(rnd() < 0.5 ? 'lb' : 'kg'); return 'setUnits'; }
  if (roll < 0.56) {
    const list = EXERCISES.slice();
    c.pickExercise({ name: list[Math.floor(rnd() * list.length)], mode: (['barbell', 'dumbbell', 'landmine'] as Mode[])[Math.floor(rnd() * 3)], last: rnd() < 0.8 ? Math.round(rnd() * 400) + ' × ' + (1 + Math.floor(rnd() * 10)) : undefined });
    return 'pickExercise';
  }
  if (roll < 0.60) { const list = c.barProfiles(); c.pickBarProfile(list[Math.floor(rnd() * list.length)]); return 'pickBarProfile'; }
  if (roll < 0.63) { c.setState({ barDraft: GARBAGE_DRAFTS[Math.floor(rnd() * GARBAGE_DRAFTS.length)] }); c.commitBarWeight(); return 'commitBarWeight'; }
  if (roll < 0.66) { c.addToSession(EXERCISES[Math.floor(rnd() * EXERCISES.length)]); return 'addToSession'; }
  if (roll < 0.69) { c.dropFromSession(rnd() < 0.8 ? EXERCISES[Math.floor(rnd() * EXERCISES.length)] : 'Nope'); return 'dropFromSession'; }
  if (roll < 0.73) { c.advanceSession(); return 'advanceSession'; }
  if (roll < 0.77) { c.applyUndo(); return 'applyUndo'; }
  if (roll < 0.81) {
    const keys = Object.keys(c.state.log);
    if (keys.length) c.editLog(Number(keys[Math.floor(rnd() * keys.length)]), rnd() < 0.5 ? { r: Math.floor(rnd() * 20) } : { w: Math.round(rnd() * 500 * 4) / 4 });
    return 'editLog';
  }
  if (roll < 0.84) { c.setState({ comp: !c.state.comp, activeIdx: null, doneIdx: [], allDone: false, log: {} }); return 'toggleComp'; }
  if (roll < 0.87) { c.setState({ collarId: (['none', 'clip', 'comp'] as CollarId[])[Math.floor(rnd() * 3)] }); return 'collar'; }
  if (roll < 0.90) { c.setState({ scheme: (['single', 'straight', 'backoff', 'reverse', 'drop', 'cluster', 'amrap'] as SchemeId[])[Math.floor(rnd() * 7)], activeIdx: null, doneIdx: [], allDone: false, log: {} }); return 'scheme'; }
  if (roll < 0.93) { c.setState({ roundTo: ([0.25, 0.5, 1.25, 2.5] as RoundTo[])[Math.floor(rnd() * 4)] }); return 'roundTo'; }
  if (roll < 0.95) { c.setState({ anchorType: (['rack', 'hinge', 'sleeve'] as AnchorType[])[Math.floor(rnd() * 3)] }); return 'anchor'; }
  if (roll < 0.985) return tourAction(c, rnd);
  const q = Object.assign({}, c.state.qty);
  const set = PLATE_SETS[c.state.units];
  const w = set[Math.floor(rnd() * set.length)];
  q[w] = Math.max(0, (q[w] || 0) + (rnd() < 0.5 ? -1 : 1));
  c.setState({ qty: q, homeGym: rnd() < 0.7 });
  return 'qty';
}

// ---------- tour actions: start / step frames / pause / next / skip / finish ----------
function tourAction(c: PlateIQLogic, rnd: () => number): string {
  const s = c.state;
  if (s.tour !== 'play') {
    const from = rnd() < 0.5 ? 'onboard' : 'settings';
    c.startTour(from);
    if (c.state.tour !== 'play') fail('tour-start', 'startTour(' + from + ') left tour=' + c.state.tour);
    if (!c._tourFrames || c._tourFrames.length < 2) fail('tour-frames', 'no frames');
    return 'startTour:' + from;
  }
  const r = rnd();
  if (r < 0.35) {
    // advance one or more frames exactly as the rAF loop would (run + cap/card + stop)
    const n = 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n && c._tourIdx < c._tourFrames.length && c.state.tour === 'play'; k++) {
      if (c.state.tourWait) break;
      const f = c._tourFrames[c._tourIdx];
      if (f.cap !== undefined || f.card !== undefined) c.setState({ tourCap: f.cap || '', tourCard: f.card || null, tourKey: c._tourIdx });
      if (f.run) { try { f.run(); } catch (err) { fail('tour-frame-throw', 'frame ' + c._tourIdx + ' ' + (err as Error).message); } }
      // tourTap defers its fn 450ms; headless there is no dot, so tourTap fires fn synchronously
      c._tourIdx++;
      if (f.stop) { c._tourT = f.t; c.setState({ tourWait: f.stop }); break; }
    }
    if (c._tourIdx >= c._tourFrames.length && !c.state.tourWait) c.endTour(true);
    return 'tourStep';
  }
  if (r < 0.5) { const v = c.renderVals(); v.tourNext(); return 'tourNext'; }
  if (r < 0.65) { const v = c.renderVals(); v.tourTap(); return 'tourTap'; }
  if (r < 0.8) { c.endTour(false); if (c.state.tour !== false) fail('tour-skip', 'tour=' + c.state.tour); return 'tourSkip'; }
  if (r < 0.9) { c.endTour(true); if (c.state.tour !== false) fail('tour-finish', 'tour=' + c.state.tour); return 'tourFinish'; }
  // user reaches for something outside the tour while it plays — reducers must stay safe
  c.tapSet(Math.floor(rnd() * 5)); return 'tapSet-during-tour';
}

export function phaseB(users: number = B_USERS, make: Fresh = fresh, actionsPerUser: number = B_ACTIONS) {
  const rndB = mulberry32(99188271);
  let user: PlateIQLogic | null = null, actionsLeft = 0;
  const total = users * actionsPerUser;
  for (let bDone = 0; bDone < total; bDone++) {
    if (!user || actionsLeft <= 0) {
      user = make();
      randomize(user, rndB);
      actionsLeft = actionsPerUser;
    }
    let name = '?';
    try { name = randomAction(user, rndB); }
    catch (err) { fail('action-throw:' + name, (err as Error).message + ' ' + describe_(user)); user = null; }
    if (user) checkState(user, name);
    RESULTS.actions++;
    actionsLeft--;
  }
}

export function report() {
  const cats = Object.keys(RESULTS.categories);
  const lines = cats.map((c) => c + ': ' + RESULTS.categories[c] + '\n    e.g. ' + (EXAMPLES[c] || []).join('\n    e.g. '));
  return lines.join('\n');
}

export { mulberry32 };
