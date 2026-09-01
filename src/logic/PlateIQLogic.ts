// Line-for-line port of the prototype's `Component` logic class. The plate-math (evaluate / plan /
// alts / ladder inheritance / landmine quantization / collars / inventory) is spec-exact and is
// enforced by __tests__/stress.test.ts with the prototype's own seeds. Reducers keep the same names
// and the same synchronous setState semantics (the harness stub merged patches with Object.assign).
//
// What changed vs. the prototype, and only this:
//  - `this.state` / `this.setState` are backed by a StateHost (zustand in the app, a plain object in tests).
//  - CSS `var(--token)` strings in renderVals became token keys (resolved by the theme hook); a few
//    hard-coded dark colours on done cards became tokens so light mode renders correctly.
//  - DOM handlers (e.target.value, e.stopPropagation) take plain values / no event.
//  - The tour's fingertip / scroll / progress bar go through a TourHost instead of DOM refs.
//  - The 1 s interval lives in the store binding and calls `tick()`.

import {
  PLATE_SETS, MICRO, SLEEVE_MM, THICK, BAR_SETS, BAR_PROFILES, COLLARS, DB_SETS, UNIT_STEP, LB_PER_KG,
  DIM, SKIN, SKIN_LIGHT, MONO, ANCHOR_COEF, ANCHOR_LABEL, ANCHOR_GEO, SCHEMES, BAR_ART, SESSIONS, VOL,
  EXERCISES, TRENDS, ACCENTS, mmss, pa,
} from './constants';
import type { Accent, BarProfile, Collar, Exercise, Scheme, Skin } from './constants';
import type {
  AppState, AnchorType, Load, LogEntry, Mode, PlannedSet, SetSpec, StateHost, StatePatch, StateUpdater,
  TourCard, TourHost, Units, Warmup,
} from './types';

export interface LogicProps { plateStyle?: 'dimensional' | 'mono'; startOnOnboarding?: boolean }

export interface PlateVisual { label: string; w: number; h: number; fs: number; skin: Skin }

export interface TourFrame { t: number; cap?: string; card?: TourCard; stop?: string; run?: () => void }

export type Palette = Record<string, string>;

export const INITIAL_STATE: AppState = {
  mode: 'barbell',
  bar: 45,
  working: 225,
  lmTarget: 135,
  dbHandle: 5,
  dbPair: false,
  dbTotal: 50,
  activeIdx: null,
  doneIdx: [],
  remaining: 0,
  expanded: true,
  sheet: false,
  homeGym: false,
  allDone: false,
  qty: { 45: 2, 35: 0, 25: 2, 20: 2, 15: 2, 10: 4, 5: 2, 2.5: 2, 1.25: 0, 0.75: 2, 0.5: 2, 0.25: 2 },
  anchorType: 'sleeve',
  scheme: 'single',
  barProfile: 'std',
  comp: false,
  collarId: 'none',
  minChanges: true,
  revSide: [],
  rmW: 225,
  rmR: 5,
  rmRpe: 8,
  barDraft: '45',
  workDraft: null, // string while the target field is being edited, else null (display follows state)
  screen: 'main',
  exercise: 'Bench press',
  units: 'lb',
  roundTo: 0.25,
  autoRest: true,
  // guided tour: 'auto' = undecided until mount, 'play' = running, false = off
  tour: 'auto',
  tourPaused: false,
  tourWait: null,
  tourCap: '',
  tourCard: null,
  tourKey: 0,
  tourNote: false,
  onboard: null,
  onboardStep: 0,
  sessionsLogged: 0,
  theme: 'dark',
  systemDark: true,
  accent: 'lime',
  search: '',
  paused: false,
  // a session is an ordered queue of lifts; `exercise` is whichever one you're standing at
  session: ['Bench press', 'Overhead press', 'DB row'],
  sessionDone: [],
  // what you actually lifted, keyed by ladder index, alongside what was planned
  log: {},
  undo: null,
  undoAt: 0,
  logIdx: null,
  trendEx: null,
  restTotal: 0,
  warmups: [
    { id: 'w0', label: 'Empty bar', pct: 0, reps: 15, rest: 60 },
  ],
  tourSeen: false,
  records: [],
  restEndsAt: null,
  tourSnap: null,
  reduceMotion: false,
};

/** The harness's headless host: a plain object, patches merged with Object.assign. */
export class MemoryHost implements StateHost {
  state: AppState;
  constructor(initial: AppState = INITIAL_STATE) { this.state = { ...initial }; }
  get() { return this.state; }
  set(patch: StatePatch) { Object.assign(this.state, patch); }
}

const raf = (cb: (now: number) => void): number => {
  const g = globalThis as unknown as { requestAnimationFrame?: (cb: (now: number) => void) => number };
  return g.requestAnimationFrame ? g.requestAnimationFrame(cb) : 0;
};
const caf = (id: number | undefined) => {
  const g = globalThis as unknown as { cancelAnimationFrame?: (id: number) => void };
  if (g.cancelAnimationFrame && id !== undefined) g.cancelAnimationFrame(id);
};

export class PlateIQLogic {
  props: LogicProps;
  host: StateHost;
  tourHost: TourHost | null = null;

  // tour runtime (public so the harness can step frames exactly as the rAF loop would)
  _tourSnap: StatePatch | null = null;
  _tourFrom: 'onboard' | 'settings' | null = null;
  _tourFrames: TourFrame[] = [];
  _tourTotal = 0;
  _tourT = 0;
  _tourIdx = 0;
  _tourLast = 0;
  _tourRaf: number | undefined;
  _tourTapTo: ReturnType<typeof setTimeout> | undefined;
  _tourBoot: ReturnType<typeof setTimeout> | undefined;

  constructor(host: StateHost, props?: LogicProps) {
    this.host = host;
    this.props = props || {};
  }

  get state(): AppState { return this.host.get(); }
  setState(p: StateUpdater) {
    const q = typeof p === 'function' ? p(this.state) : p;
    if (q) this.host.set(q);
  }

  // ---- lifecycle (called by the store binding instead of componentDidMount) ----
  /** One second passed. Expires the undo toast and counts the rest timer down. */
  _ticking = false;
  tick(now: number = Date.now()) {
    const s = this.state;
    if (s.undo && now - s.undoAt > 7000) this.setState({ undo: null });
    if (s.activeIdx === null || s.paused) return;
    // with a wall-clock end time (set by the store binding) the countdown survives backgrounding;
    // headless (harness) it decrements one second per tick exactly like the prototype
    this._ticking = true;
    this.setState((x) => ({
      remaining: x.restEndsAt ? Math.max(0, Math.round((x.restEndsAt - now) / 1000)) : Math.max(0, x.remaining - 1),
    }));
    this._ticking = false;
  }
  /** Re-anchor the countdown's end time to now + remaining (called whenever remaining is set by a user action). */
  syncClock(now: number = Date.now()) {
    const s = this.state;
    this.setState({ restEndsAt: s.activeIdx !== null && !s.paused ? now + s.remaining * 1000 : null });
  }
  /** Mount decision: play the tour on first launch, else settle `tour` to false. */
  mount(delayMs = 500) {
    const ob = this.state.onboard === null ? (!this.props || this.props.startOnOnboarding !== false) : this.state.onboard;
    if (this.state.tour === 'auto') {
      if (ob && !this.state.tourSeen) {
        // never start (and re-render) while the view is still laying out
        this._tourBoot = setTimeout(() => this.startTour('onboard'), delayMs);
      } else this.setState({ tour: false });
    }
  }
  unmount() {
    clearTimeout(this._tourBoot);
    caf(this._tourRaf);
    clearTimeout(this._tourTapTo);
  }

  // ---- plate math -------------------------------------------------
  plateSet(): number[] { return PLATE_SETS[this.state.units] || PLATE_SETS.lb; }
  step(): number { return UNIT_STEP[this.state.units] || 5; }
  accents(): Accent[] { return ACCENTS; }
  accent(): Accent {
    const list = this.accents();
    return list.find((a) => a.id === this.state.accent) || list[0];
  }
  rgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(v, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  isDark(): boolean {
    const t = this.state.theme;
    return t === 'system' ? !!this.state.systemDark : t === 'dark';
  }
  palette(): Palette {
    const dark = this.isDark();
    const a = this.accent();
    const t = (alpha: number) => this.rgba(a.base, alpha);
    const shared: Palette = {
      acc: a.base, accHi: a.hi, accInk: a.ink,
      accA07: t(dark ? 0.07 : 0.11), accA14: t(dark ? 0.14 : 0.2),
      accA28: t(dark ? 0.28 : 0.34), accA35: t(dark ? 0.35 : 0.42),
      accA40: t(dark ? 0.4 : 0.5), accA42: t(dark ? 0.42 : 0.52),
      accA06: t(dark ? 0.06 : 0.1), accA10: t(dark ? 0.1 : 0.14),
      accA16: t(dark ? 0.16 : 0.22), accA18: t(dark ? 0.18 : 0.24),
      accA22: t(dark ? 0.22 : 0.28), accA45: t(dark ? 0.45 : 0.55),
      accA50: t(dark ? 0.5 : 0.6),
      // accent as TEXT: the vivid fill is unreadable on a light ground, so light mode uses the deep tone
      accDeep: dark ? a.base : a.deep,
      accDeepA12: this.rgba(dark ? a.base : a.deep, 0.12),
      accDeepA40: this.rgba(dark ? a.base : a.deep, 0.4),
      accDeepA45: this.rgba(dark ? a.base : a.deep, 0.45),
      transparent: 'transparent',
    };
    if (dark) {
      return {
        ...shared,
        bg: '#0b0c0e', card: '#14171a', card2: '#191d21', card3: '#171a1d',
        ctl: '#1b1f23', ctl2: '#1e2226', ctl3: '#22272b', ctlHi: '#262b30', ctlHi2: '#2c3238',
        tx: '#f4f5f3', tx2: '#e6e8e4', tx3: '#d6dae0', tx4: '#c3c8ce', tx5: '#aeb4ba',
        mut: '#9aa0a6', mut2: '#8a9098', mut3: '#7c8085', mut4: '#6e7377', mut5: '#5c6167',
        bd: 'rgba(255,255,255,.055)', bd2: 'rgba(255,255,255,.09)', bd3: 'rgba(255,255,255,.14)',
        bd4: 'rgba(255,255,255,.07)', bd5: 'rgba(255,255,255,.18)', bd6: 'rgba(255,255,255,.22)',
        accDim: this.rgba(a.base, 0.1),
        warn: '#c57c20', warnTx: '#e8bd7d', warnTx2: '#f0cf9a', warnInk: '#131313',
        warnA13: 'rgba(197,124,32,.13)', warnA22: 'rgba(197,124,32,.22)',
        warnA34: 'rgba(197,124,32,.34)', warnA40: 'rgba(197,124,32,.4)', warnA42: 'rgba(197,124,32,.42)',
        warnSh: 'rgba(28,19,6,.9)',
        dan: '#e0736a', danHi: '#f2938b', dan2: '#d4645c', dan3: '#e88b83',
        danA11: 'rgba(224,115,106,.11)', danA22: 'rgba(224,115,106,.22)',
        dan2A14: 'rgba(212,100,92,.14)', dan2A40: 'rgba(212,100,92,.4)',
        well1: 'rgba(255,255,255,.04)', well2: 'rgba(0,0,0,.26)', well3: 'rgba(0,0,0,.32)',
        well2b: 'rgba(0,0,0,.32)', well3b: 'rgba(0,0,0,.4)',
        accCard2: '#161a17', heroMut: '#8a9080',
        shUp: 'rgba(0,0,0,.95)', scrim: 'rgba(0,0,0,.55)',
        bdSoft: 'rgba(255,255,255,.06)', bdMid: 'rgba(255,255,255,.16)',
        warnA07: 'rgba(197,124,32,.07)', warnA20: 'rgba(197,124,32,.2)',
        // done-card tones (the prototype hard-coded these for dark only)
        cardDone: '#101215', bdDone: 'rgba(255,255,255,.04)', numBdIdle: 'rgba(255,255,255,.1)',
        tourScrim: 'rgba(9,10,12,.82)',
      };
    }
    // light: cards lift off a warm-grey ground instead of being outlined
    return {
      ...shared,
      accInk: a.ink, accHi: a.hi,
      bg: '#f1f0ec', card: '#ffffff', card2: '#ffffff', card3: '#f7f6f2',
      ctl: '#eceae4', ctl2: '#e8e5de', ctl3: '#e3e0d8', ctlHi: '#dbd8d0', ctlHi2: '#d3cfc6',
      tx: '#15171a', tx2: '#22262b', tx3: '#333940', tx4: '#41464c', tx5: '#5d646c',
      mut: '#61686f', mut2: '#697077', mut3: '#6e757c', mut4: '#767d85', mut5: '#7e858d',
      bd: 'rgba(0,0,0,.07)', bd2: 'rgba(0,0,0,.1)', bd3: 'rgba(0,0,0,.16)',
      bd4: 'rgba(0,0,0,.07)', bd5: 'rgba(0,0,0,.18)', bd6: 'rgba(0,0,0,.22)',
      accDim: this.rgba(a.base, 0.16),
      warn: '#a8620d', warnTx: '#7a4708', warnTx2: '#8a5209', warnInk: '#fff',
      warnA13: 'rgba(197,124,32,.12)', warnA22: 'rgba(197,124,32,.2)',
      warnA34: 'rgba(197,124,32,.3)', warnA40: 'rgba(197,124,32,.36)', warnA42: 'rgba(197,124,32,.38)',
      warnSh: 'rgba(0,0,0,.12)',
      dan: '#c0392b', danHi: '#9d2b1f', dan2: '#c0392b', dan3: '#a32e22',
      danA11: 'rgba(192,57,43,.1)', danA22: 'rgba(192,57,43,.18)',
      dan2A14: 'rgba(192,57,43,.12)', dan2A40: 'rgba(192,57,43,.34)',
      well1: 'rgba(0,0,0,.02)', well2: 'rgba(0,0,0,.05)', well3: 'rgba(0,0,0,.07)',
      well2b: 'rgba(0,0,0,.06)', well3b: 'rgba(0,0,0,.09)',
      accCard2: '#ffffff', heroMut: '#5f666e',
      shUp: 'rgba(0,0,0,.18)', scrim: 'rgba(0,0,0,.32)',
      bdSoft: 'rgba(0,0,0,.06)', bdMid: 'rgba(0,0,0,.14)',
      warnA07: 'rgba(197,124,32,.09)', warnA20: 'rgba(197,124,32,.18)',
      cardDone: '#f4f3ef', bdDone: 'rgba(0,0,0,.04)', numBdIdle: 'rgba(0,0,0,.1)',
      tourScrim: 'rgba(241,240,236,.9)',
    };
  }
  roundTarget(n: number): number {
    const inc = this.state.roundTo || this.step();
    const s = this.state.mode === 'landmine' ? inc : inc * 2;
    return Math.round(n / s) * s;
  }
  roundInc(n: number): number { const s = this.state.roundTo || 2.5; return Math.round(n / s) * s; }
  available(): Array<{ w: number; pairs: number }> {
    const cap = this.state.mode === 'dumbbell' ? (this.state.units === 'kg' ? 5 : 10) : 999;
    // a matched pair of dumbbells needs 4 of each plate to add one to every sleeve
    const per = this.state.mode === 'dumbbell' && this.state.dbPair ? 4 : 2;
    return this.plateSet().filter((p) => p <= cap).map((p) => ({
      w: p,
      pairs: this.state.homeGym ? Math.floor((this.state.qty[p] || 0) / per) : 99,
    }));
  }

  barProfiles(): BarProfile[] { return BAR_PROFILES[this.state.units] || BAR_PROFILES.lb; }
  barProfile(): BarProfile | null {
    return this.barProfiles().find((b) => b.id === this.state.barProfile) || null;
  }
  collars(): Collar[] { return COLLARS[this.state.units] || COLLARS.lb; }
  collar(): Collar { return this.collars().find((c) => c.id === this.state.collarId) || this.collars()[0]; }
  // collars only enter the maths in competition mode; a landmine only has one sleeve loaded
  collarWeight(): number {
    if (!this.state.comp) return 0;
    const w = this.collar().w;
    return this.state.mode === 'landmine' ? w / 2 : w;
  }
  baseTotal(): number {
    const bar = this.state.mode === 'dumbbell' ? this.state.dbHandle : this.state.bar;
    return Math.round((bar + this.collarWeight()) * 100) / 100;
  }
  // usable sleeve depends on the bar in hand — an EZ bar fills up long before a deadlift bar
  sleeveCap(): number {
    if (this.state.mode === 'dumbbell') return SLEEVE_MM.dumbbell;
    const p = this.barProfile();
    return p ? p.sleeve : SLEEVE_MM.barbell;
  }
  changeCount(a: number[], b: number[]): number { const d = this.diff(a, b); return d.add.length + d.rem.length; }

  // `keep` seeds the sleeve with plates already on it, so a set can be reached by adding only
  loadSleeve(rem: number, avail: Array<{ w: number; pairs: number }>, keep: number[] | null | undefined) {
    const cap = this.sleeveCap();
    const out: number[] = [];
    const used: Record<number, number> = {};
    let mm = 0, full = false, r = rem;
    if (keep) {
      for (const w of keep) {
        const a = avail.find((x) => x.w === w);
        if (!a || (used[w] || 0) >= a.pairs) continue;
        if (r < w - 0.001 || mm + THICK[w] > cap) continue;
        out.push(w); r -= w; mm += THICK[w]; used[w] = (used[w] || 0) + 1;
      }
    }
    for (const a of avail) {
      let n = used[a.w] || 0;
      while (r >= a.w - 0.001 && n < a.pairs) {
        if (mm + THICK[a.w] > cap) { full = true; break; }
        out.push(a.w); r -= a.w; n++; mm += THICK[a.w];
      }
    }
    out.sort((x, y) => y - x);
    return { list: out, left: Math.round(r * 100) / 100, full };
  }

  // The user's rounding step applies to the TOTAL and roundTarget has already enforced it.
  // Re-quantizing the per-side remainder to that same step rounded halves UP and loaded the bar
  // past the target (120 kg on a 45 kg bar wants 37.5/side, which is exactly loadable, but a 1 kg
  // step turned it into 38/side = 121 kg). Only clean float noise here.
  perSide(total: number, base: number, keep: number[] | null | undefined) {
    const rem = Math.round(((total - base) / 2) * 100) / 100;
    if (rem <= 0) return { list: [] as number[], left: 0, full: false };
    return this.loadSleeve(rem, this.available(), keep);
  }

  // landmine: all extra weight loads onto the single far sleeve, not split across two sides
  availableSingle(): Array<{ w: number; pairs: number }> {
    return this.plateSet().map((p) => ({
      w: p,
      pairs: this.state.homeGym ? (this.state.qty[p] || 0) : 99,
    }));
  }
  oneSide(total: number, base: number, keep: number[] | null | undefined) {
    const rem = Math.round((total - base) * 100) / 100;
    if (rem <= 0) return { list: [] as number[], left: 0, full: false };
    return this.loadSleeve(rem, this.availableSingle(), keep);
  }

  skinFor(w: number): Skin {
    const style = this.props.plateStyle || 'dimensional';
    if (style === 'mono') return MONO;
    return SKIN[w];
  }

  plates(list: number[], opts?: { scale?: number; light?: boolean }): PlateVisual[] {
    const o = opts || {};
    const scale = o.scale || 1;
    const skinSet = o.light ? SKIN_LIGHT : null;
    return list.map((w) => {
      const d = DIM[w];
      const s = skinSet ? skinSet[w] : this.skinFor(w);
      const pw = Math.round(d.w * scale), ph = Math.round(d.h * scale);
      // sub-pound plates drop the leading zero so the numeral survives at set-card scale
      const txt = w < 1 ? String(w).replace(/^0/, '') : String(w);
      const fs = Math.min(Math.max(Math.round(d.fs * scale), 8), pw - 1);
      const fits = fs >= 7 && ph >= txt.length * fs * 0.72 + 4;
      return { label: fits ? txt : '', w: pw, h: ph, fs, skin: s };
    });
  }

  // one target in, one fully-resolved load out — shared by the ladder, the alternatives and the pickers
  evaluate(want: number, keep: number[] | null | undefined, bare?: boolean): Load {
    const m = this.state.mode;
    const u = this.state.units;
    const base = this.baseTotal();
    const coef = ANCHOR_COEF[this.state.anchorType] || 0.766;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // effective landmine load is a coefficient product — show it at a resolution a human can set
    const effStep = u === 'kg' ? 0.25 : 0.5;
    const toEff = (n: number) => Math.round(n * coef / effStep) * effStep;
    const single = m === 'landmine';
    // the bare bar is the floor — you cannot load less than it, even if the target is lower
    const floor = single ? toEff(base) : base;
    if (bare) want = floor;
    const aim = Math.max(floor, want);
    // The loaded-side target can never sit below the bar's own weight — rounding an effective ask
    // through the coefficient can land under it, which then reads as a phantom overshoot.
    const wantLoaded = bare ? base
      : (single ? Math.max(base, this.roundTarget(aim / coef)) : aim);
    const solve = (k: number[] | null | undefined) => (single ? this.oneSide(wantLoaded, base, k) : this.perSide(wantLoaded, base, k));
    const greedy = solve(null);
    let side = greedy;
    // Keeping plates on the bar is worth it only when it costs nothing in accuracy AND nothing in
    // plate count. Without the count guard the ladder accretes microplates forever: inheriting is
    // always "fewer changes" than consolidating, so a 40% set seeded with five small plates would
    // carry them to the top set instead of ever swapping up to a 45.
    if (this.state.minChanges && keep && keep.length) {
      const kept = solve(keep);
      const sameAccuracy = kept.left <= greedy.left + 0.001;
      const noBulkier = kept.list.length <= greedy.list.length;
      const lessHandling = this.changeCount(keep, kept.list) < this.changeCount(keep, greedy.list);
      if (sameAccuracy && noBulkier && lessHandling) side = kept;
    }
    const sum = side.list.reduce((a, b) => a + b, 0);
    const loaded = r2(base + (single ? sum : sum * 2));
    const shown = single ? toEff(loaded) : loaded;
    // landmine effective load is a coefficient product, so treat a sub-half-unit miss as exact
    const tol = single ? 0.5 : 0.011;
    return {
      total: loaded, main: shown, side: side.list,
      sub: single
        ? loaded + ' ' + u + ' loaded'
        : (side.list.length ? r2((loaded - base) / 2) + ' ' + u + ' per side' : 'bar only'),
      want: r2(want),
      short: r2(wantLoaded - loaded),
      // A landmine ask passes through the anchor coefficient twice (ask → loaded → effective), so
      // most effective weights simply are not reachable: 135 lb at the floor lands on 175 loaded,
      // which reads back as 134. That gap is quantization, not a loading failure — measure the miss
      // against the achievable effective target so `miss` only ever means "could not load this".
      miss: Math.abs(shown - (single ? toEff(wantLoaded) : want)) > tol
        ? r2(shown - (single ? toEff(wantLoaded) : want)) : 0,
      overBase: want + 0.011 < floor,
      full: side.full,
    };
  }

  // Nearest weights either side of an unreachable target that DO load exactly. A quote is only
  // honest if it is a fixed point of the solver: re-targeting it must load cleanly and land on
  // itself, or the chip would move the number and leave the warning up (landmine quantization
  // round-trips through the anchor coefficient and can drift otherwise).
  alts(want: number): { below: number | null; above: number | null } {
    const inc = this.state.roundTo || this.step();
    const s = this.state.mode === 'landmine' ? inc : inc * 2;
    const stable = (v: number) => {
      if (!(v > 0)) return false;
      const e = this.evaluate(v, null);
      return e.miss === 0 && !e.overBase && !e.full && Math.abs(e.main - v) < 0.001;
    };
    let below: number | null = null, above: number | null = null;
    for (let k = 1; k <= 60 && (below === null || above === null); k++) {
      if (below === null) {
        const c = Math.round((want - k * s) * 100) / 100;
        if (c > 0) {
          const e = this.evaluate(c, null);
          if (e.miss === 0 && !e.overBase && e.main < want - 0.001 && stable(e.main)) below = e.main;
        }
      }
      if (above === null) {
        const c = Math.round((want + k * s) * 100) / 100;
        const e = this.evaluate(c, null);
        if (e.miss === 0 && !e.full && e.main > want + 0.001 && stable(e.main)) above = e.main;
      }
    }
    return { below, above };
  }

  plan(): { sets: PlannedSet[]; work: PlannedSet; after: PlannedSet[]; scheme: Scheme; base: number; barOnly: number } {
    const m = this.state.mode;
    const base = this.baseTotal();
    const target = m === 'dumbbell' ? this.state.dbTotal
      : m === 'landmine' ? this.state.lmTarget
        : this.state.working;
    const work: SetSpec = { key: 'work', label: 'Working set', pct: 100, reps: 5, rest: 180 };
    const scheme = SCHEMES.find((s) => s.id === this.state.scheme) || SCHEMES[0];
    const after: SetSpec[] = scheme.rows(work.reps).map((r, i) => ({ ...r, id: 'a' + i, key: 'after' + i }));
    const queue: SetSpec[] = (this.state.warmups as SetSpec[]).concat([work]).concat(after);
    // solved in ladder order so each set can inherit the plates already on the bar
    let prev: number[] | null = null;
    const built: PlannedSet[] = queue.map((st) => {
      const want = st.pct === 0 ? base : this.roundTarget(target * st.pct / 100);
      const e = this.evaluate(want, prev, st.pct === 0);
      prev = e.side;
      return { ...st, ...e };
    });
    const wl = this.state.warmups.length;
    return {
      sets: built.slice(0, wl),
      work: built[wl],
      after: built.slice(wl + 1),
      scheme,
      base,
      barOnly: m === 'dumbbell' ? this.state.dbHandle : this.state.bar,
    };
  }

  chipText(list: number[], single: boolean): string {
    if (!list.length) return 'bar only';
    return list.join(' · ') + (single ? ' on far sleeve' : ' each side');
  }

  diff(a: number[], b: number[]): { add: number[]; rem: number[] } {
    const count = (l: number[]) => l.reduce<Record<number, number>>((m, w) => ({ ...m, [w]: (m[w] || 0) + 1 }), {});
    const ca = count(a), cb = count(b), add: number[] = [], rem: number[] = [];
    this.plateSet().forEach((w) => {
      const d = (cb[w] || 0) - (ca[w] || 0);
      for (let i = 0; i < d; i++) add.push(w);
      for (let i = 0; i < -d; i++) rem.push(w);
    });
    return { add, rem };
  }

  // every input that changes what the ladder prescribes also invalidates progress logged against it
  progressReset(): Pick<AppState, 'activeIdx' | 'doneIdx' | 'allDone' | 'log'> {
    return { activeIdx: null, doneIdx: [], allDone: false, log: {} };
  }

  // ---- undo -------------------------------------------------------
  // Snapshot only the keys an action touches, so undo restores exactly that action and
  // nothing that happened around it.
  undoPatch(s: AppState, label: string, keys: Array<keyof AppState>): Pick<AppState, 'undo' | 'undoAt'> {
    const patch: StatePatch = {};
    keys.forEach((k) => { (patch as Record<string, unknown>)[k] = s[k]; });
    return { undo: { label, patch }, undoAt: Date.now() };
  }
  applyUndo() { this.setState((s) => (s.undo ? { ...s.undo.patch, undo: null } : null)); }

  // ---- logging ----------------------------------------------------
  flatSets(): PlannedSet[] { const p = this.plan(); return p.sets.concat([p.work], p.after); }
  // seed an entry with the plan, and keep the plan alongside it so the card can show a variance
  logEntry(s: AppState, i: number | null | undefined): Record<number, LogEntry> {
    if (i === null || i === undefined || s.log[i]) return s.log;
    const f = this.flatSets()[i];
    if (!f) return s.log;
    return { ...s.log, [i]: { w: f.main, r: f.reps || 0, planW: f.main, planR: f.reps || 0 } };
  }
  editLog(i: number, patch: Partial<LogEntry>) {
    this.setState((s) => ({ log: { ...s.log, [i]: { ...(s.log[i] || {}), ...patch } as LogEntry } }));
  }

  // ---- session ----------------------------------------------------
  goExercise(name: string) {
    const x = EXERCISES.find((e) => e.name === name);
    if (x) this.pickExercise(x);
  }
  addToSession(name: string) {
    this.setState((s) => (s.session.indexOf(name) >= 0 ? null : {
      session: s.session.concat([name]),
      ...this.undoPatch(s, name + ' added to session', ['session']),
    }));
  }
  dropFromSession(name: string) {
    this.setState((s) => ({
      session: s.session.filter((n) => n !== name),
      sessionDone: s.sessionDone.filter((n) => n !== name),
      ...this.undoPatch(s, name + ' removed from session', ['session', 'sessionDone']),
    }));
  }
  advanceSession() {
    const s = this.state;
    const done = s.sessionDone.indexOf(s.exercise) >= 0 ? s.sessionDone : s.sessionDone.concat([s.exercise]);
    const next = s.session.find((n) => done.indexOf(n) < 0);
    this.setState({
      sessionDone: done, allDone: false, doneIdx: [], activeIdx: null, log: {}, paused: false,
      ...this.undoPatch(s, 'Finished ' + s.exercise, ['sessionDone', 'allDone', 'doneIdx', 'activeIdx', 'log', 'exercise', 'mode', 'working', 'dbTotal', 'lmTarget', 'barDraft']),
    });
    if (next) this.goExercise(next);
  }
  bumpRest(d: number) {
    this.setState((s) => {
      const remaining = Math.max(0, s.remaining + d);
      return { remaining, restTotal: Math.max(s.restTotal || 0, remaining), paused: false };
    });
  }

  // ---- handlers ---------------------------------------------------
  tapSet(i: number) {
    this.setState((s) => {
      if (s.activeIdx === i) return {
        activeIdx: null,
        doneIdx: s.doneIdx.indexOf(i) < 0 ? s.doneIdx.concat([i]) : s.doneIdx,
        log: this.logEntry(s, i),
        ...this.undoPatch(s, 'Set ' + (i + 1) + ' logged', ['activeIdx', 'doneIdx', 'log', 'allDone', 'remaining', 'restTotal']),
      };
      const all = this.plan();
      const flat = all.sets.concat([all.work], all.after);
      const rest = flat[i] ? flat[i].rest : 180;
      // starting a rest supersedes the last toast — they share the same bottom slot
      // going back into a set reopens the session — the completion card must not linger behind it
      return { activeIdx: i, remaining: rest, restTotal: rest, expanded: true, paused: !s.autoRest, allDone: false, undo: null };
    });
  }
  // ---- guided tour: the app drives itself through one demo set ----
  // A rAF timeline applies keyframes by calling the same reducers the UI uses.
  // The progress bar is driven imperatively via the TourHost so the solver only re-runs at keyframes.
  // show the fingertip over the anchor, then fire fn ~0.45s later at the press
  tourTap(sel: string, fn?: () => void) {
    const shown = this.tourHost ? this.tourHost.press(sel) : false;
    if (!shown) { if (fn) fn(); return; }
    clearTimeout(this._tourTapTo);
    this._tourTapTo = setTimeout(() => { if (this.state.tour === 'play' && fn) fn(); }, 450);
  }
  tourScript(): TourFrame[] {
    const go = (p: StatePatch) => this.setState(p);
    const scroll = (frac: number) => { if (this.tourHost) this.tourHost.scrollTo(frac); };
    const tap = (sel: string, fn?: () => void) => this.tourTap(sel, fn);
    return [
      { t: 0, card: { title: 'Welcome to PlateIQ', sub: 'It works out your plates, warm‑ups, and rest — so you can just lift. Take a quick look around — you set the pace.' }, stop: 'Pick a target weight' },
      { t: 0.8, cap: 'Pick a lift and a target — PlateIQ works out exactly what goes on the bar.', run: () => scroll(0) },
      { t: 2.4, run: () => tap('inc-working', () => go({ working: 235 })) },
      { t: 4.2, run: () => tap('inc-working', () => go({ working: 245 })) },
      { t: 5.8, stop: 'The warm‑up ladder' },
      { t: 6.4, cap: 'Your warm‑up ladder builds itself, with the plates for every step.', run: () => scroll(0.42) },
      { t: 9.6, stop: 'The rest timer' },
      { t: 10.2, run: () => scroll(0.26) },
      { t: 10.8, cap: 'Tap a set when it’s done — PlateIQ times your rest and shows what to strip or add.', run: () => tap('set-1', () => this.tapSet(1)) },
      { t: 15.0, stop: 'Logging your sets' },
      { t: 15.6, cap: 'Done logs the set for you — and it’s two taps to record what actually happened.', run: () => tap('rest-cta', () => this.finishRest()) },
      { t: 17.8, run: () => tap('log-1', () => go({ logIdx: 1, sheet: 'log' })) },
      { t: 20.8, stop: 'Dumbbells & landmines' },
      { t: 21.4, cap: 'Dumbbells and landmines too — same brain, different rig.', run: () => { go({ sheet: false, logIdx: null, undo: null }); scroll(0); } },
      { t: 22.2, run: () => tap('mode-landmine', () => go({ mode: 'landmine' })) },
      { t: 25.4, stop: 'History & 1RM trends' },
      { t: 26.0, cap: 'Every session feeds your history and your estimated‑1RM trend.', run: () => { go({ mode: 'barbell' }); tap('nav-history', () => { go({ screen: 'history' }); scroll(0); }); } },
      { t: 29.8, card: { title: 'That’s the tour!', sub: 'Now let’s set things up for your gym — it takes about 20 seconds.' }, stop: 'Start setup' },
      { t: 30.4 },
    ];
  }
  startTour(from: 'onboard' | 'settings') {
    const S = this.state;
    this._tourSnap = {
      mode: S.mode, working: S.working, activeIdx: S.activeIdx, doneIdx: S.doneIdx.slice(),
      allDone: S.allDone, log: { ...S.log }, remaining: S.remaining, restTotal: S.restTotal,
      screen: S.screen, sheet: S.sheet, logIdx: S.logIdx, undo: S.undo, undoAt: S.undoAt,
      paused: S.paused, expanded: S.expanded,
    };
    this._tourFrom = from;
    this._tourFrames = this.tourScript();
    this._tourTotal = this._tourFrames[this._tourFrames.length - 1].t;
    this._tourT = 0;
    this._tourIdx = 1; // frame 0 is applied in the setState below
    this._tourLast = 0;
    this.setState({
      tour: 'play', tourPaused: false, tourWait: this._tourFrames[0].stop || null, tourKey: 0, tourNote: false,
      tourCap: '', tourCard: this._tourFrames[0].card || null,
      screen: 'main', mode: 'barbell', working: 225, sheet: false, logIdx: null,
      undo: null, paused: false, expanded: true, ...this.progressReset(),
      tourSnap: { ...this._tourSnap, tourFrom: from } as StatePatch,
    });
    caf(this._tourRaf);
    if (this.tourHost) this.tourHost.setProgress(0);
    const step = (now: number) => {
      if (this.state.tour !== 'play') return;
      if (!this._tourLast) this._tourLast = now;
      const dt = (now - this._tourLast) / 1000;
      this._tourLast = now;
      if (!this.state.tourPaused && !this.state.tourWait) {
        this._tourT += dt;
        const f = this._tourFrames;
        while (this._tourIdx < f.length && this._tourT >= f[this._tourIdx].t) {
          const k = f[this._tourIdx];
          if (k.cap !== undefined || k.card !== undefined) {
            this.setState({ tourCap: k.cap || '', tourCard: k.card || null, tourKey: this._tourIdx });
          }
          if (k.run) { try { k.run(); } catch (e) { /* keyframes never break the timeline */ } }
          this._tourIdx++;
          if (k.stop) { this._tourT = k.t; this.setState({ tourWait: k.stop }); break; }
        }
        if (this.tourHost) this.tourHost.setProgress(Math.min(1, this._tourT / this._tourTotal));
        if (this._tourT >= this._tourTotal) return this.endTour(true);
      }
      this._tourRaf = raf(step);
    };
    this._tourRaf = raf(step);
  }
  endTour(finished: boolean) {
    caf(this._tourRaf);
    clearTimeout(this._tourTapTo);
    this._tourLast = 0;
    const next: StatePatch = { ...(this._tourSnap || {}), tour: false, tourPaused: false, tourWait: null, tourCard: null, tourCap: '', tourSeen: true, tourSnap: null };
    // skipping only skips the animation — setup steps always follow when launched from onboarding
    if (this._tourFrom === 'onboard') { next.onboard = true; next.onboardStep = 0; next.tourNote = !finished; }
    this._tourSnap = null;
    this.setState(next);
  }
  finishRest() {
    this.setState((s) => {
      if (s.activeIdx === null) return null;
      const pl = this.plan();
      const lastIndex = pl.sets.length + pl.after.length;
      const i = s.activeIdx;
      return {
        activeIdx: null,
        doneIdx: s.doneIdx.indexOf(i) < 0 ? s.doneIdx.concat([i]) : s.doneIdx,
        log: this.logEntry(s, i),
        allDone: i === lastIndex,
        paused: false,
        ...this.undoPatch(s, 'Set ' + (i + 1) + ' logged', ['activeIdx', 'doneIdx', 'log', 'allDone', 'remaining', 'restTotal']),
      };
    });
  }
  setPct(id: string, d: number) {
    this.setState((s) => ({
      warmups: s.warmups.map((w) => {
        if (w.id !== id) return w;
        const pct = Math.max(0, Math.min(95, w.pct + d));
        return { ...w, pct, label: pct === 0 ? 'Empty bar' : pct + '%' };
      }).sort((a, b) => a.pct - b.pct),
      ...this.progressReset(),
    }));
  }
  nextRung(warmups: Warmup[]): number | null {
    if (warmups.length >= 6) return null;
    const used = warmups.map((w) => w.pct);
    const ladder = [40, 55, 70, 85, 95];
    const open = ladder.filter((p) => used.indexOf(p) < 0);
    if (open.length) return open[0];
    // ladder exhausted — bisect the biggest gap up to 95 rather than stacking duplicates
    const sorted = used.slice().filter((p) => p >= 40).sort((a, b) => a - b).concat([100]);
    let best: number | null = null, gap = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const g = sorted[i + 1] - sorted[i];
      if (g > gap) { gap = g; best = Math.round((sorted[i] + sorted[i + 1]) / 2 / 5) * 5; }
    }
    return gap >= 10 ? Math.min(95, best as number) : null;
  }
  addSet() {
    this.setState((s) => {
      const pct = this.nextRung(s.warmups);
      if (pct === null) return {};
      const reps = pct >= 85 ? 2 : pct >= 70 ? 3 : pct >= 55 ? 5 : 8;
      const rest = pct >= 85 ? 120 : pct >= 55 ? 90 : 60;
      const list = s.warmups.concat([{ id: 'w' + Date.now(), label: pct + '%', pct, reps, rest }])
        .sort((a, b) => a.pct - b.pct);
      return { warmups: list, ...this.progressReset() };
    });
  }
  setReps(id: string, d: number) {
    this.setState((s) => ({
      warmups: s.warmups.map((w) => (w.id === id ? { ...w, reps: Math.max(1, Math.min(30, w.reps + d)) } : w)),
    }));
  }
  cycleRest(id: string) {
    const steps = [30, 45, 60, 90, 120, 180];
    this.setState((s) => ({
      warmups: s.warmups.map((w) => (w.id === id
        ? { ...w, rest: steps[(steps.indexOf(w.rest) + 1) % steps.length] || 60 }
        : w)),
    }));
  }
  removeSet(id: string) {
    this.setState((s) => ({
      warmups: s.warmups.filter((w) => w.id !== id),
      ...this.progressReset(),
      ...this.undoPatch(s, 'Warm-up set removed', ['warmups', 'activeIdx', 'doneIdx', 'allDone', 'log']),
    }));
  }
  commitWorking() {
    this.setState((s) => {
      const m = s.mode, dbl = m === 'dumbbell';
      const cur = dbl ? s.dbTotal : m === 'landmine' ? s.lmTarget : s.working;
      const n = parseFloat(String(s.workDraft).replace(/[^0-9.]/g, ''));
      if (!isFinite(n) || n <= 0) return { workDraft: null };
      // floor: the implement itself (bar / handle); landmine targets are effective, no floor beyond 1
      const floor = dbl ? s.dbHandle : m === 'landmine' ? 1 : s.bar;
      const v = Math.max(floor, Math.round(n * 100) / 100);
      if (v === cur) return { workDraft: null };
      return dbl
        ? { dbTotal: v, workDraft: null, ...this.progressReset() }
        : m === 'landmine'
          ? { lmTarget: v, workDraft: null, ...this.progressReset() }
          : { working: v, workDraft: null, ...this.progressReset() };
    });
  }
  commitBarWeight() {
    const dbl = this.state.mode === 'dumbbell';
    this.setState((s) => {
      const n = parseFloat(String(s.barDraft).replace(/[^0-9.]/g, ''));
      const fallback = dbl ? s.dbHandle : s.bar;
      // exact to 2dp — a 12.5 lb handle or a 33 lb technique bar is a real thing, never snap it
      const v = Math.max(0.25, Math.round((isNaN(n) || n <= 0 ? fallback : n) * 100) / 100);
      const gap = this.step();
      // a typed weight no longer matches a named bar — say so rather than lying about the sleeve length
      const match = (BAR_PROFILES[s.units] || BAR_PROFILES.lb).find((b) => b.w === v);
      // a blur that didn't change the number must not wipe set progress
      if (v === fallback) return { barDraft: String(v) };
      return dbl
        ? { dbHandle: v, barDraft: String(v), dbTotal: Math.max(v + gap, s.dbTotal), ...this.progressReset() }
        : { bar: v, barDraft: String(v), barProfile: match ? match.id : 'custom', working: Math.max(v + gap, s.working), ...this.progressReset() };
    });
  }
  setBarWeight(v: number) {
    const dbl = this.state.mode === 'dumbbell';
    this.setState((s) => (dbl
      ? { dbHandle: v, barDraft: String(v), dbTotal: Math.max(v + 5, s.dbTotal), ...this.progressReset() }
      : { bar: v, barDraft: String(v), working: Math.max(v + 5, s.working), ...this.progressReset() }));
  }
  setMode(id: Mode) {
    this.setState((s) => ({
      mode: id,
      workDraft: null,
      barDraft: String(id === 'dumbbell' ? s.dbHandle : s.bar),
      ...this.progressReset(),
    }));
  }
  setUnits(u: Units) {
    if (this.state.units === u) return;
    const f = u === 'kg' ? 1 / LB_PER_KG : LB_PER_KG;
    const big = UNIT_STEP[u], small = u === 'kg' ? 1.25 : 2.5;
    const cv = (v: number, s: number) => Math.max(s, Math.round((v * f) / s) * s);
    this.setState((st) => ({
      units: u,
      bar: cv(st.bar, big),
      working: cv(st.working, big),
      lmTarget: cv(st.lmTarget, big),
      dbHandle: cv(st.dbHandle, small),
      dbTotal: cv(st.dbTotal, big),
      barDraft: String(cv(st.mode === 'dumbbell' ? st.dbHandle : st.bar, st.mode === 'dumbbell' ? small : big)),
      collarId: st.collarId,
      rmW: cv(st.rmW, big),
      revSide: [],
      ...this.progressReset(),
    }));
    // a named bar keeps its identity across units — its weight is spec, not a conversion
    const prof = (BAR_PROFILES[u] || BAR_PROFILES.lb).find((b) => b.id === this.state.barProfile);
    if (prof) this.setState({ bar: prof.w, barDraft: String(prof.w) });
  }
  pickBarProfile(p: BarProfile) {
    this.setState((s) => ({
      barProfile: p.id, bar: p.w, barDraft: s.mode === 'dumbbell' ? s.barDraft : String(p.w),
      working: Math.max(p.w + this.step(), s.working),
      sheet: false, ...this.progressReset(),
    }));
  }
  // each exercise carries its own last top set — switching lifts has to bring that number with it,
  // or the session hands you the previous lift's load on a different movement
  lastTarget(x: { last?: string }): number | null {
    const n = parseFloat(String(x.last).split('×')[0]);
    if (!isFinite(n)) return null;
    return this.state.units === 'kg' ? this.roundInc(n / LB_PER_KG) : n;
  }
  lastLabel(x: { last?: string }): string {
    if (this.state.units !== 'kg') return x.last || '';
    const parts = String(x.last).split('×');
    const w = parseFloat(parts[0]);
    return isFinite(w) ? (Math.round((w / LB_PER_KG) * 2) / 2) + ' ×' + (parts[1] || '') : String(x.last);
  }
  pickExercise(x: { name: string; mode: Mode; last?: string }) {
    const t = this.lastTarget(x);
    this.setState((s) => ({
      exercise: x.name, mode: x.mode, screen: 'main',
      workDraft: null,
      barDraft: String(x.mode === 'dumbbell' ? s.dbHandle : s.bar),
      working: x.mode === 'barbell' && t ? Math.max(s.bar + this.step(), this.roundTarget(t)) : s.working,
      dbTotal: x.mode === 'dumbbell' && t ? Math.max(s.dbHandle + this.step(), this.roundInc(t)) : s.dbTotal,
      lmTarget: x.mode === 'landmine' && t ? t : s.lmTarget,
      ...this.progressReset(),
    }));
  }

  // ---- production: session records (replaces the prototype's demo history constants) ----
  /** "last top set" for an exercise: latest logged record, else the seed string. */
  lastFor(x: Exercise): Exercise {
    const recs = this.state.records.filter((r) => r.exercise === x.name);
    if (!recs.length) return x;
    const r = recs.reduce((a, b) => (b.at > a.at ? b : a));
    const best = r.sets.reduce<{ w: number; r: number } | null>((m, s) => (!m || s.w > m.w ? { w: s.w, r: s.r } : m), null);
    if (!best) return x;
    // records keep their own unit; the seed strings are lb, and lastTarget converts lb→kg itself
    const lb = r.units === 'kg' ? Math.round(best.w * LB_PER_KG * 2) / 2 : best.w;
    return { ...x, last: lb + ' × ' + best.r };
  }
  /** Write the finished exercise to history. Called from the completion modal's Log CTA only. */
  recordSession() {
    const s = this.state;
    const flat = this.flatSets();
    const sets = Object.keys(s.log).map(Number).sort((a, b) => a - b)
      .filter((i) => s.doneIdx.indexOf(i) >= 0)
      .map((i) => ({ label: flat[i] ? flat[i].label : 'Set ' + (i + 1), ...s.log[i] }));
    if (!sets.length) return;
    const rec = {
      id: 'r' + Date.now() + Math.floor(Math.random() * 1e6),
      at: Date.now(), exercise: s.exercise, mode: s.mode, units: s.units, sets,
    };
    this.setState({ records: s.records.concat([rec]), sessionsLogged: s.sessionsLogged + 1 });
  }

  // ---- view model -------------------------------------------------
  // Colour fields are theme token keys (see palette()) or literal colours; the UI resolves them.
  renderVals() {
    const st = this.state;
    const dark = this.isDark();
    const p = this.plan();
    const m = st.mode;
    const dbl = m === 'dumbbell';

    const modes = ([
      { id: 'barbell', label: 'Barbell' },
      { id: 'dumbbell', label: 'Dumbbell' },
      { id: 'landmine', label: 'Landmine' },
    ] as Array<{ id: Mode; label: string }>).map((x) => ({
      id: x.id,
      label: x.label,
      bg: st.mode === x.id ? 'acc' : 'card3',
      bd: st.mode === x.id ? 'acc' : 'bdSoft',
      fg: st.mode === x.id ? 'accInk' : 'mut',
      on: st.mode === x.id,
      pick: () => this.setMode(x.id),
    }));

    const cur = dbl ? st.dbHandle : st.bar;
    const profiles = this.barProfiles();
    const curProfile = this.barProfile();
    const profileId = curProfile ? curProfile.id : 'custom';
    // only barbell mode draws a bar — landmine and dumbbell have their own rigs
    const shapedBar = m === 'barbell' && !!BAR_ART[profileId];
    const heroArt = BAR_ART[profileId] || BAR_ART.ez;
    const straightArt = (t: number) => ({ h: 40, parts: [pa('M0 20H120', t)] });
    const barProfileOptions = profiles.map((b) => {
      const art = BAR_ART[b.id] || straightArt(b.id === 'axle' ? 19 : b.id === 'dl' ? 10 : 13);
      return {
        id: b.id,
        name: b.name, note: b.note, v: String(b.w),
        artParts: art.parts, artH: Math.round(art.h * 0.45), artVbH: art.h,
        artW: Math.round((art.w || 120) * 0.45), artVbW: art.w || 120,
        sleeveNote: b.sleeve + ' mm usable sleeve',
        on: st.barProfile === b.id,
        bg: st.barProfile === b.id ? 'accA07' : 'card2',
        bd: st.barProfile === b.id ? 'accA45' : 'bd',
        markBg: st.barProfile === b.id ? 'acc' : 'transparent',
        markBd: st.barProfile === b.id ? 'acc' : 'bdMid',
        markFg: st.barProfile === b.id ? 'accInk' : 'transparent',
        pick: () => this.pickBarProfile(b),
      };
    });
    const barVals = dbl ? (DB_SETS[st.units] || DB_SETS.lb) : (BAR_SETS[st.units] || BAR_SETS.lb);
    const barOptions = barVals.map((v) => ({
      v: String(v),
      on: cur === v,
      bg: cur === v ? 'accA16' : 'ctl2',
      fg: cur === v ? 'accDeep' : 'mut2',
      markBg: cur === v ? 'acc' : 'transparent',
      markBd: cur === v ? 'acc' : 'bdMid',
      markFg: cur === v ? 'accInk' : 'transparent',
      pick: () => this.setBarWeight(v),
    }));

    const step = this.step();
    // Landmine targets live in effective weight, but only the loaded side is on a grid. Step on the
    // loaded grid and convert back, so every press lands on a weight the bar can actually produce
    // (and never stalls on a value that snaps back to where it started).
    const lmStep = (curV: number, d: number) => {
      const coef = ANCHOR_COEF[st.anchorType] || 0.766;
      const effStep = st.units === 'kg' ? 0.25 : 0.5;
      const inc = st.roundTo || this.step();
      const toEff = (n: number) => Math.round(n * coef / effStep) * effStep;
      const loaded = Math.round((curV / coef) / inc) * inc;
      let next = toEff(loaded + (d > 0 ? inc : -inc));
      if ((d > 0 && next <= curV) || (d < 0 && next >= curV)) next = toEff(loaded + (d > 0 ? inc * 2 : -inc * 2));
      return next;
    };
    const bump = (d: number) => this.setState((s) => (dbl
      ? { dbTotal: Math.max(s.dbHandle + 5, s.dbTotal + d), ...this.progressReset() }
      : m === 'landmine'
        ? { lmTarget: Math.max(Math.round(s.bar * (ANCHOR_COEF[s.anchorType] || 0.766)), lmStep(s.lmTarget, d)), ...this.progressReset() }
        : { working: Math.max(s.bar + 5, s.working + d), ...this.progressReset() }));

    const scale = dbl ? (st.dbPair ? 0.5 : 0.62) : 1;
    const pScale = m === 'landmine' ? 0.44 : scale;
    const dress = (s: PlannedSet, i: number, removable: boolean) => {
      const active = st.activeIdx === i;
      const done = st.doneIdx.indexOf(i) >= 0;
      const lg = st.log[i];
      const off = !!lg && (lg.w !== lg.planW || lg.r !== lg.planR);
      const bad = s.miss !== 0 && !done;
      const baseName = dbl ? 'handle' : 'bar';
      const reason = s.overBase
        ? 'The ' + p.barOnly + ' ' + st.units + ' ' + baseName + ' on its own is already over'
        : s.full
          ? 'The sleeves fill up before'
          : m === 'landmine'
            ? 'Anchor geometry can’t land exactly on'
            : dbl && !st.homeGym
              ? 'No plate small enough to hit'
              : st.homeGym ? 'Your plates can’t make' : 'No plate combination hits';
      const id = s.id as string;
      return {
        idx: i,
        n: String(i + 1),
        remove: removable ? () => this.removeSet(id) : null,
        label: s.label,
        reps: s.reps,
        repsLabel: s.reps ? s.reps + ' reps' : 'max reps',
        restLabel: s.rest >= 60 ? mmss(s.rest) : s.rest + 's',
        main: s.main % 1 === 0 ? String(s.main) : String(Math.round(s.main * 100) / 100),
        sub: s.sub,
        chips: this.chipText(s.side, m === 'landmine'),
        empty: s.side.length === 0,
        notEmpty: s.side.length > 0,
        shortNote: s.miss !== 0
          ? reason + ' ' + s.want + ' ' + st.units + ' — this is ' + s.main + ' ' + st.units + ', the nearest you can actually load.'
          : '',
        want: s.want,
        pctDown: removable ? () => this.setPct(id, -5) : null,
        pctUp: removable ? () => this.setPct(id, 5) : null,
        repsDown: removable ? () => this.setReps(id, -1) : null,
        repsUp: removable ? () => this.setReps(id, 1) : null,
        restTap: removable ? () => this.cycleRest(id) : null,
        editable: !!removable,
        readOnly: !removable,
        groupHead: false,
        active, done, bad,
        left: this.plates(s.side.slice().reverse(), { scale: pScale }),
        right: this.plates(s.side, { scale: pScale }),
        cardBg: bad ? 'warnA07' : active ? 'accA06' : done ? 'cardDone' : 'card',
        cardBd: bad ? 'warnA42' : active ? 'accA45' : done ? 'bdDone' : 'bd',
        rail: bad ? 'warn' : active ? 'acc' : 'transparent',
        opacity: done ? 0.5 : 1,
        numBg: active ? 'accA16' : 'transparent',
        numBd: active ? 'accA50' : 'numBdIdle',
        numFg: active ? 'accDeep' : 'mut3',
        titleFg: active ? 'tx' : done ? 'mut' : 'tx2',
        weightFg: active ? 'tx' : done ? 'mut' : 'tx2',
        badge: bad ? 'ADJUSTED' : active ? 'RESTING' : done ? 'DONE' : '',
        badgeBg: bad ? 'warnA20' : active ? 'accA18' : 'bd4',
        badgeFg: bad ? 'warnTx' : active ? 'accDeep' : 'mut2',
        ctaFg: active ? 'accDeep' : 'mut4',
        cta: active ? 'Resting — tap to log next' : done ? '✓ logged' : 'Tap when done ›',
        tap: () => this.tapSet(i),
        // logged actual vs planned — only surfaced once the set is behind you
        hasLog: !!lg && done,
        logText: lg ? lg.w + ' ' + st.units + ' × ' + (lg.r || 0) : '',
        logVaried: off,
        logPlan: lg ? 'planned ' + lg.planW + ' × ' + lg.planR : '',
        logFg: off ? 'warnTx' : 'accDeep',
        logBg: off ? 'warnA13' : 'accA07',
        logBd: off ? 'warnA40' : 'accA28',
        editLog: () => this.setState({ logIdx: i, sheet: 'log' }),
        aria: s.label + ', ' + s.main + ' ' + st.units + ', ' + this.chipText(s.side, m === 'landmine')
          + (done ? ', logged' : active ? ', resting' : ', not started'),
      };
    };

    const sets = p.sets.map((s, i) => dress(s, i, true));
    const workIndex = sets.length;
    const wd = dress(p.work, workIndex, false);
    const wScale = m === 'landmine' ? 0.56 : scale * 0.88;
    wd.left = this.plates(p.work.side.slice().reverse(), { scale: wScale });
    wd.right = this.plates(p.work.side, { scale: wScale });
    const afterSets = p.after.map((s, i) => dress(s, workIndex + 1 + i, false));
    if (afterSets.length) afterSets[0].groupHead = true;
    const ladderCards = sets.concat(afterSets);
    const flat = p.sets.concat([p.work], p.after);

    // timer
    const ai = st.activeIdx;
    const onboarding = st.onboard === null
      ? (!this.props || this.props.startOnOnboarding !== false)
      : st.onboard;
    // while the tour is running (or pending its mount decision) it owns the screen
    const touring = st.tour === 'auto' ? onboarding : st.tour === 'play';
    const obShow = onboarding && !touring;
    // a commercial gym has effectively unlimited plates, so the inventory step is skipped
    const oSteps = st.homeGym ? ['setup', 'units', 'plates', 'bars'] : ['setup', 'units', 'bars'];
    const oIdx = Math.min(st.onboardStep, oSteps.length - 1);
    const oKey = oSteps[oIdx] as 'setup' | 'units' | 'plates' | 'bars';
    const oLast = oIdx >= oSteps.length - 1;
    const dbVals = DB_SETS[st.units] || DB_SETS.lb;
    const dbGuess = st.homeGym ? (st.units === 'kg' ? 2.5 : 5) : (st.units === 'kg' ? 5 : 10);
    const pickHandle = (v: number) => this.setState((s) => ({
      dbHandle: v,
      barDraft: s.mode === 'dumbbell' ? String(v) : s.barDraft,
      dbTotal: Math.max(v + this.step(), s.dbTotal),
      ...this.progressReset(),
    }));
    type Timer = {
      show: boolean; paused?: boolean; running?: boolean; cta?: string; onCta?: () => void; statusLabel?: string;
      mmss?: string; dash?: string; nextLabel?: string; add?: string[]; remove?: string[]; hasAdd?: boolean;
      hasRemove?: boolean; noChange?: boolean; lastSet?: boolean; hasChips?: boolean; minus?: () => void;
      plus?: () => void; skip?: () => void; aria?: string; remaining?: number; total?: number;
    };
    let timer: Timer = { show: false };
    if (ai !== null && st.screen === 'main' && !obShow) {
      const cs = flat[ai] || p.work;
      const ns = flat[ai + 1] || null;
      const d = ns ? this.diff(cs.side, ns.side) : { add: [] as number[], rem: [] as number[] };
      const total = Math.max(1, st.restTotal || cs.rest || 1);
      timer = {
        show: true,
        paused: st.paused,
        running: !st.paused,
        cta: st.paused ? 'Start rest' : 'Done',
        onCta: st.paused ? () => this.setState({ paused: false }) : () => this.finishRest(),
        statusLabel: st.paused ? 'SET LOGGED' : 'RESTING',
        mmss: mmss(st.remaining),
        dash: (144.5 * Math.min(1, Math.max(0, 1 - st.remaining / total))).toFixed(1),
        remaining: st.remaining,
        total,
        nextLabel: ns
          ? 'Next · ' + ns.label + ' at ' + ns.main + ' ' + st.units
          : 'Last set — nice work',
        add: d.add.map(String),
        remove: d.rem.map(String),
        hasAdd: d.add.length > 0,
        hasRemove: d.rem.length > 0,
        noChange: !!ns && d.add.length === 0 && d.rem.length === 0,
        // on the final set there is no next load to diff against, so the row has nothing to list —
        // it needs its own copy rather than an empty band under a divider
        lastSet: !ns,
        hasChips: d.add.length > 0 || d.rem.length > 0,
        // rest is a guess, not a rule — let it be nudged without leaving the panel
        minus: () => this.bumpRest(-15),
        plus: () => this.bumpRest(30),
        skip: () => this.finishRest(),
        aria: 'Rest timer, ' + mmss(st.remaining) + ' remaining',
      };
    }
    // logging the set you just did: the panel offers reps first, since that's what varies
    const li = st.logIdx;
    const lgEntry = li !== null && li !== undefined ? st.log[li] : null;
    const lgPlan = li !== null && li !== undefined ? flat[li] : null;
    const wStep = (st.roundTo || 2.5) * (m === 'landmine' ? 1 : 2);
    const logSheet = {
      show: st.sheet === 'log' && !!lgEntry,
      title: lgPlan ? lgPlan.label : 'Set',
      w: lgEntry ? String(lgEntry.w) : '',
      r: lgEntry ? String(lgEntry.r) : '',
      planLine: lgEntry ? 'Planned ' + lgEntry.planW + ' ' + st.units + ' × ' + lgEntry.planR + ' reps' : '',
      matched: !!lgEntry && lgEntry.w === lgEntry.planW && lgEntry.r === lgEntry.planR,
      wDown: () => { if (lgEntry && li !== null) this.editLog(li, { w: Math.max(0, Math.round((lgEntry.w - wStep) * 100) / 100) }); },
      wUp: () => { if (lgEntry && li !== null) this.editLog(li, { w: Math.min(2000, Math.round((lgEntry.w + wStep) * 100) / 100) }); },
      rDown: () => { if (lgEntry && li !== null) this.editLog(li, { r: Math.max(0, lgEntry.r - 1) }); },
      rUp: () => { if (lgEntry && li !== null) this.editLog(li, { r: Math.min(50, lgEntry.r + 1) }); },
      reset: () => { if (lgEntry && li !== null) this.editLog(li, { w: lgEntry.planW, r: lgEntry.planR }); },
      close: () => this.setState({ sheet: false, logIdx: null }),
    };

    const ownedTotal = Object.keys(st.qty).reduce((a, k) => a + (st.qty[Number(k)] || 0), 0);
    const emptyRack = st.homeGym && ownedTotal === 0;
    const missSet = [p.work].concat(p.sets, p.after).find((s) => s.miss !== 0);
    const warn = emptyRack
      ? 'Your rack is empty — add the plates you own so PlateIQ can do the maths.'
      : missSet
        ? (missSet.overBase
          ? 'The ' + (dbl ? st.dbHandle + ' ' + st.units + ' handle' : st.bar + ' ' + st.units + ' bar') + ' alone is over your ' + missSet.want + ' ' + st.units + ' target — showing ' + missSet.main + ' ' + st.units + '.'
          : missSet.full
            ? 'The sleeves are full at ' + missSet.main + ' ' + st.units + ' — ' + missSet.want + ' ' + st.units + ' won’t physically fit.'
            : m === 'landmine'
              ? missSet.want + ' ' + st.units + ' effective isn’t reachable at this anchor — nearest is ' + missSet.main + ' ' + st.units + '.'
              : st.homeGym
                ? 'Your rack can’t hit ' + missSet.want + ' ' + st.units + ' — loaded ' + missSet.main + ' ' + st.units + ' instead.'
                : 'No plate combination hits ' + missSet.want + ' ' + st.units + ' — loaded ' + missSet.main + ' ' + st.units + ' instead.')
        : '';

    const setTarget = (v: number) => this.setState(() => (dbl
      ? { dbTotal: v, ...this.progressReset() }
      : m === 'landmine'
        ? { lmTarget: v, ...this.progressReset() }
        : { working: v, ...this.progressReset() }));
    // alternatives are offered for the TOP set only — a warm-up miss is not the number you'd retarget
    const av = !emptyRack && p.work.miss !== 0 && !p.work.overBase
      ? this.alts(p.work.want) : { below: null, above: null };
    const altChips: Array<{ label: string; pick: () => void }> = [];
    if (av.below !== null) { const b = av.below; altChips.push({ label: '↓ ' + b + ' ' + st.units, pick: () => setTarget(b) }); }
    if (av.above !== null) { const a = av.above; altChips.push({ label: '↑ ' + a + ' ' + st.units, pick: () => setTarget(a) }); }

    // reverse input — read a bar someone else left loaded
    const revSum = st.revSide.reduce((a, b) => a + b, 0);
    const revTotal = Math.round((p.base + (m === 'landmine' ? revSum : revSum * 2)) * 100) / 100;

    // e1RM: Epley, with RPE converted to reps-in-reserve so a submaximal set still estimates
    const rpeLabel = String(st.rmRpe);
    const effReps = Math.round((st.rmR + Math.max(0, 10 - st.rmRpe)) * 10) / 10;
    const e1rm = Math.round(st.rmW * (1 + effReps / 30));
    const pctRows = [95, 90, 85, 80, 75, 70, 65].map((pc) => {
      const wantV = this.roundTarget(e1rm * pc / 100);
      const e = this.evaluate(wantV, null);
      return {
        pct: pc + '%',
        weight: String(e.main),
        note: e.miss === 0 ? e.sub : 'nearest loadable',
        exactFg: e.miss === 0 ? 'mut3' : 'warnTx',
        pick: () => { setTarget(e.main); this.setState({ sheet: false }); },
      };
    });

    // how much plate handling the ladder actually costs, end to end
    const ladder = flat.map((s) => s.side);
    let totalChanges = 0;
    for (let i = 1; i < ladder.length; i++) totalChanges += this.changeCount(ladder[i - 1], ladder[i]);

    const set = this.plateSet();
    const firstMicro = set.find((w) => MICRO[w]);
    const rackRows = set.map((w) => {
      const d = DIM[w], s = this.skinFor(w);
      return {
        w,
        label: String(w), width: Math.round(d.w * 1.1), skin: s,
        microHead: w === firstMicro,
        qty: st.qty[w] || 0,
        note: (st.qty[w] || 0) >= 2
          ? (Math.floor((st.qty[w] || 0) / 2) === 1 ? '1 pair' : Math.floor((st.qty[w] || 0) / 2) + ' pairs')
          : 'none owned',
        inc: () => this.setState((x) => ({ qty: { ...x.qty, [w]: (x.qty[w] || 0) + 1 }, ...this.progressReset() })),
        dec: () => this.setState((x) => ({ qty: { ...x.qty, [w]: Math.max(0, (x.qty[w] || 0) - 1) }, ...this.progressReset() })),
      };
    });

    const geo = ANCHOR_GEO[st.anchorType] || ANCHOR_GEO.sleeve;
    const hist = this.history();
    const volMax = Math.max.apply(null, hist.vol.length ? hist.vol : [1]);
    const volBars = hist.vol.map((v, i) => ({
      h: Math.round((v / Math.max(1, volMax)) * 100),
      bg: i === hist.vol.length - 1 ? 'acc' : 'accA22',
    }));
    const sessions = hist.sessions.map((s) => ({
      ...s,
      prBg: s.pr ? 'accA16' : 'transparent',
      prFg: s.pr ? 'accDeep' : 'transparent',
    }));
    // ---- session queue
    const sessionChips = st.session.map((name, i) => {
      const isCur = name === st.exercise;
      const isDone = st.sessionDone.indexOf(name) >= 0;
      return {
        name, mark: isDone ? '✓' : String(i + 1),
        isCur, isDone,
        bg: isCur ? 'acc' : isDone ? 'card3' : 'card',
        bd: isCur ? 'acc' : isDone ? 'bdSoft' : 'bd',
        fg: isCur ? 'accInk' : isDone ? 'mut4' : 'tx4',
        markFg: isCur ? 'accInk' : isDone ? 'accDeep' : 'mut4',
        opacity: isDone && !isCur ? 0.6 : 1,
        pick: () => this.goExercise(name),
        aria: name + (isCur ? ', current lift' : isDone ? ', done' : ', queued'),
      };
    });
    const sessionLeft = st.session.filter((n) => st.sessionDone.indexOf(n) < 0);
    const nextUp = sessionLeft.find((n) => n !== st.exercise) || null;
    const sessionPos = Math.min(st.session.length, st.sessionDone.length + 1);

    // ---- progress trends
    const trendNames = Object.keys(hist.trends);
    const trendName = hist.trends[st.trendEx as string] ? (st.trendEx as string)
      : (hist.trends[st.exercise] ? st.exercise : (trendNames[0] || st.exercise));
    const tpRaw = hist.trends[trendName] || [];
    const trendReady = tpRaw.length >= 2;
    const tp = trendReady ? tpRaw : [0, 0];
    const tLo = Math.min.apply(null, tp), tHi = Math.max.apply(null, tp);
    const tPad = Math.max(3, (tHi - tLo) * 0.22);
    const lo = tLo - tPad, hi = tHi + tPad;
    const TW = 300, TH = 78;
    const tx = (i: number) => Math.round((i / (tp.length - 1)) * TW * 10) / 10;
    const ty = (v: number) => Math.round((TH - ((v - lo) / (hi - lo)) * TH) * 10) / 10;
    const trendPath = tp.map((v, i) => (i ? 'L' : 'M') + tx(i) + ' ' + ty(v)).join(' ');
    const trendArea = trendPath + ' L' + TW + ' ' + TH + ' L0 ' + TH + ' Z';
    const tNow = tp[tp.length - 1], tThen = tp[0];
    const tDelta = Math.round(tNow - tThen);
    const trendOptions = trendNames.filter((n) => st.session.indexOf(n) >= 0 || n === trendName || n === st.exercise)
      .map((n) => ({
        name: n,
        on: n === trendName,
        bg: n === trendName ? 'accA16' : 'ctl2',
        fg: n === trendName ? 'accDeep' : 'mut2',
        pick: () => this.setState({ trendEx: n }),
      }));

    const q = (st.search || '').trim().toLowerCase();
    const exercises = EXERCISES.map((x0) => this.lastFor(x0)).filter((x) => !q
      || x.name.toLowerCase().indexOf(q) >= 0
      || x.mode.toLowerCase().indexOf(q) >= 0
      || String(x.tag).toLowerCase().indexOf(q) >= 0).map((x) => ({
        ...x,
        modeLabel: x.mode.charAt(0).toUpperCase() + x.mode.slice(1),
        lastLabel: this.lastLabel(x),
        active: x.name === st.exercise,
        inSession: st.session.indexOf(x.name) >= 0,
        queueMark: st.session.indexOf(x.name) >= 0 ? '✓' : '+',
        queueBg: st.session.indexOf(x.name) >= 0 ? 'accA16' : 'ctl2',
        queueFg: st.session.indexOf(x.name) >= 0 ? 'accDeep' : 'mut2',
        queueAria: st.session.indexOf(x.name) >= 0 ? 'Remove ' + x.name + ' from session' : 'Add ' + x.name + ' to session',
        queue: () => {
          if (this.state.session.indexOf(x.name) >= 0) this.dropFromSession(x.name);
          else this.addToSession(x.name);
        },
        cardBg: x.name === st.exercise ? 'accA07' : 'card',
        cardBd: x.name === st.exercise ? 'accA42' : 'bd',
        pick: () => this.pickExercise(x),
      }));

    const workDraftStr = String(st.workDraft !== null ? st.workDraft : (dbl ? st.dbTotal : m === 'landmine' ? st.lmTarget : st.working));
    const workFs = workDraftStr.length >= 6 ? 24 : workDraftStr.length === 5 ? 27 : 34;

    return {
      modes, barOptions, bar: cur,
      working: dbl ? st.dbTotal : m === 'landmine' ? st.lmTarget : st.working,
      unit: st.units,
      barLabel: dbl ? 'Handle' : 'Bar',
      targetLabel: dbl ? 'Per dumbbell' : m === 'landmine' ? 'Effective weight' : 'Working weight',
      rotate: m === 'landmine' ? geo.angle : 0,
      pivotX: geo.px,
      pivotY: geo.py,
      wPivotX: 148,
      wPivotY: 27,
      setScale: dbl && st.dbPair ? 0.46 : 0.6,
      isDumbbell: dbl,
      dbUnits: dbl && st.dbPair ? [1, 2] : [1],
      dbGap: dbl && st.dbPair ? 26 : 0,
      barLen: dbl ? 56 : 120,
      barLenSm: dbl ? 50 : 110,
      dbOptions: ([
        { id: false, label: 'One dumbbell' },
        { id: true, label: 'Matched pair' },
      ] as Array<{ id: boolean; label: string }>).map((o) => ({
        label: o.label,
        on: st.dbPair === o.id,
        bg: st.dbPair === o.id ? 'accA16' : 'card3',
        bd: st.dbPair === o.id ? 'accA50' : 'bdSoft',
        fg: st.dbPair === o.id ? 'accDeep' : 'mut',
        pick: () => this.setState({ dbPair: o.id, ...this.progressReset() }),
      })),
      gymOptions: ([
        { id: false, title: 'Commercial gym', note: 'Plenty of plates — skip counting' },
        { id: true, title: 'Home rack', note: 'Only suggest what I own' },
      ] as Array<{ id: boolean; title: string; note: string }>).map((o) => ({
        title: o.title, note: o.note,
        on: st.homeGym === o.id,
        bg: st.homeGym === o.id ? 'accA07' : 'card',
        bd: st.homeGym === o.id ? 'accA45' : 'bdSoft',
        markBg: st.homeGym === o.id ? 'acc' : 'transparent',
        markBd: st.homeGym === o.id ? 'acc' : 'bdMid',
        markFg: st.homeGym === o.id ? 'accInk' : 'transparent',
        pick: () => this.setState((s) => (s.homeGym === o.id ? null : { homeGym: o.id, ...this.progressReset() })),
      })),
      wellH: m === 'landmine' ? 138 : 112,
      workWellH: m === 'landmine' ? 206 : 168,
      isRackAnchor: m === 'landmine' && st.anchorType === 'rack',
      isHingeAnchor: m === 'landmine' && st.anchorType === 'hinge',
      isSleeveAnchor: m === 'landmine' && st.anchorType === 'sleeve',
      isNotLandmine: m !== 'landmine',
      sets: ladderCards, work: wd, workIndex, timer, warn,
      // set scheme — one entry point under the top set, one sheet, no extra chrome on the main screen
      afterSets, hasAfter: afterSets.length > 0,
      schemeName: p.scheme.name,
      schemeLine: p.scheme.id === 'single' ? 'Then · nothing after the top set' : 'Then · ' + p.scheme.name,
      openSchemeSheet: () => this.setState({ sheet: 'scheme' }),
      sheetScheme: st.sheet === 'scheme',
      schemeOptions: SCHEMES.map((s) => {
        const rows = s.rows(5);
        return {
          id: s.id,
          name: s.name, note: s.note,
          shape: rows.length ? rows.map((r) => r.pct + '%').join(' → ') : 'top set only',
          on: st.scheme === s.id,
          bg: st.scheme === s.id ? 'accA07' : 'card2',
          bd: st.scheme === s.id ? 'accA45' : 'bd',
          markBg: st.scheme === s.id ? 'acc' : 'transparent',
          markBd: st.scheme === s.id ? 'acc' : 'bdMid',
          markFg: st.scheme === s.id ? 'accInk' : 'transparent',
          pick: () => this.setState({ scheme: s.id, sheet: false, ...this.progressReset() }),
        };
      }),
      tapWork: () => this.tapSet(workIndex),
      addSet: () => this.addSet(),
      incWorking: () => bump(step),
      decWorking: () => bump(-step),
      workDraft: workDraftStr,
      workFs,
      workW: Math.max(30, Math.round(workDraftStr.length * workFs * 0.62) + 8),
      onWorkInput: (v: string) => this.setState({ workDraft: v }),
      commitWork: () => this.commitWorking(),
      isLandmine: m === 'landmine',
      anchorOptions: (Object.keys(ANCHOR_COEF) as AnchorType[]).map((k) => ({
        id: k,
        label: ANCHOR_LABEL[k],
        on: st.anchorType === k,
        bg: st.anchorType === k ? 'accA16' : 'card3',
        bd: st.anchorType === k ? 'accA50' : 'bdSoft',
        fg: st.anchorType === k ? 'accDeep' : 'mut',
        pick: () => this.setState((s) => (s.anchorType === k ? null : { anchorType: k, ...this.progressReset() })),
      })),
      barDraft: st.barDraft,
      barFs: String(st.barDraft).length >= 5 ? 20 : String(st.barDraft).length === 4 ? 23 : 27,
      onBarInput: (v: string) => this.setState({ barDraft: v }),
      commitBar: () => this.commitBarWeight(),

      exercise: st.exercise,
      exerciseLine: st.exercise + ' · ' + (m === 'landmine' ? 'landmine' : m),
      isMain: st.screen === 'main',
      isHistory: st.screen === 'history',
      isSettings: st.screen === 'settings',
      isLibrary: st.screen === 'library',
      goMain: () => this.setState({ screen: 'main' }),
      goHistory: () => this.setState({ screen: 'history' }),
      goSettings: () => this.setState({ screen: 'settings' }),
      goLibrary: () => this.setState({ screen: 'library' }),
      volBars, sessions, exercises,
      volPeakLabel: hist.volPeakLabel, volMovedLabel: hist.movedLabel, prCount: String(hist.prCount),
      historyEmpty: hist.empty, historySample: hist.sample,

      // ---- session queue
      sessionChips, hasSession: st.session.length > 1,
      sessionPosLabel: 'Session · ' + sessionPos + ' of ' + st.session.length,
      nextUp, hasNextUp: !!nextUp,
      nextUpLabel: nextUp ? 'Next · ' + nextUp : '',
      advanceSession: () => this.advanceSession(),
      finishLabel: nextUp ? 'Log & go to ' + nextUp : 'Log session',

      // ---- trends
      trendName, trendPath, trendArea, trendOptions, trendReady,
      trendW: TW, trendH: TH,
      trendDotX: tx(tp.length - 1), trendDotY: ty(tNow),
      trendNow: String(tNow),
      trendDelta: (tDelta >= 0 ? '+' : '') + tDelta + ' ' + st.units,
      trendDeltaFg: tDelta >= 0 ? 'accDeep' : 'dan',
      trendDeltaBg: tDelta >= 0 ? 'accA07' : 'danA11',
      trendFirst: '8w ago',
      trendLast: 'now',

      // ---- logging
      logSheet, sheetLog: logSheet.show,

      // ---- undo
      // the toast and the rest panel share the bottom slot — stack the toast above the panel
      // whenever one is running, rather than patching each call site that can raise a toast
      undoBottom: timer.show ? 232 : 44,
      undoShow: !!st.undo,
      undoLabel: st.undo ? st.undo.label : '',
      undoTap: () => this.applyUndo(),
      undoDismiss: () => this.setState({ undo: null }),
      startOnboard: () => this.setState({ onboard: true, onboardStep: 0 }),
      onboard: obShow,
      tourOn: touring,
      tourCapOn: !!st.tourCap && !st.tourCard,
      tourCap: st.tourCap,
      tourCardOn: !!st.tourCard,
      tourCardTitle: st.tourCard ? st.tourCard.title : '',
      tourCardSub: st.tourCard ? st.tourCard.sub : '',
      tourKey: st.tourKey,
      tourPausedOn: st.tourPaused && !st.tourWait,
      tourWaitOn: !!st.tourWait,
      tourWaitLabel: st.tourWait || '',
      tourNext: () => this.setState({ tourWait: null, tourPaused: false, paused: false }),
      tourScrim: dark ? 'rgba(9,10,12,.82)' : 'rgba(241,240,236,.9)',
      tourTap: () => this.setState((s) => { if (s.tourWait) return null; const pz = !s.tourPaused; return { tourPaused: pz, paused: pz }; }),
      tourSkip: () => this.endTour(false),
      tourFromSettings: () => this.startTour('settings'),
      tourNoteOn: st.tourNote,
      tourNoteDismiss: () => this.setState({ tourNote: false }),
      onboardStep: st.onboardStep,
      onboardIsSetup: oKey === 'setup',
      onboardIsUnits: oKey === 'units',
      onboardIsPlates: oKey === 'plates',
      onboardIsBars: oKey === 'bars',
      onboardTitle: {
        setup: 'Where do you lift?',
        units: 'What units do you lift in?',
        plates: 'Which plates do you own?',
        bars: 'What do you load from?',
      }[oKey],
      onboardBody: {
        setup: 'This decides whether PlateIQ limits itself to plates you actually own.',
        units: 'Everything in the app — targets, warm-ups, plate maths — follows this.',
        plates: 'Count individual plates, not pairs. PlateIQ only suggests loads you can actually build.',
        bars: 'Change any of it per exercise later, and add a landmine anchor if you use one.',
      }[oKey],
      onboardCta: oLast ? 'Start lifting' : 'Continue',
      onboardBackLabel: oIdx <= 0 ? 'Skip' : 'Back',
      onboardNext: () => (oLast
        ? this.setState({ onboard: false, onboardStep: 0, tourNote: false })
        : this.setState({ onboardStep: oIdx + 1 })),
      onboardBack: () => (oIdx <= 0
        ? this.setState({ onboard: false, onboardStep: 0, tourNote: false })
        : this.setState({ onboardStep: oIdx - 1 })),
      onboardDots: oSteps.map((k, i) => ({ bg: i === oIdx ? 'acc' : 'bdMid', w: i === oIdx ? 20 : 6 })),
      handleOptions: dbVals.map((v) => ({
        v: String(v),
        on: st.dbHandle === v,
        markBg: st.dbHandle === v ? 'acc' : 'transparent',
        markBd: st.dbHandle === v ? 'acc' : 'bdMid',
        markFg: st.dbHandle === v ? 'accInk' : 'transparent',
        pick: () => pickHandle(v),
      })),
      handleUnsureLabel: 'Not sure — use the ' + dbGuess + ' ' + st.units + ' standard',
      handleUnsureOn: st.dbHandle === dbGuess,
      handleUnsureBg: st.dbHandle === dbGuess ? 'accA10' : 'card3',
      handleUnsureBd: st.dbHandle === dbGuess ? 'accA40' : 'bdSoft',
      handleUnsureFg: st.dbHandle === dbGuess ? 'accDeep' : 'mut2',
      pickHandleUnsure: () => pickHandle(dbGuess),
      units: st.units,
      unitOptions: (['lb', 'kg'] as Units[]).map((u) => ({
        label: u,
        on: st.units === u,
        bg: st.units === u ? 'acc' : 'ctl2',
        fg: st.units === u ? 'accInk' : 'mut2',
        markBg: st.units === u ? 'acc' : 'transparent',
        markBd: st.units === u ? 'acc' : 'bdMid',
        markFg: st.units === u ? 'accInk' : 'transparent',
        pick: () => this.setUnits(u),
      })),
      roundOptions: ([0.25, 0.5, 1.25, 2.5] as const).map((r) => ({
        label: String(r),
        on: st.roundTo === r,
        bg: st.roundTo === r ? 'acc' : 'ctl2',
        fg: st.roundTo === r ? 'accInk' : 'mut2',
        pick: () => this.setState((s) => (s.roundTo === r ? null : { roundTo: r, ...this.progressReset() })),
      })),
      anchorDefault: ANCHOR_LABEL[st.anchorType],
      autoRest: st.autoRest,
      toggleAuto: () => this.setState((s) => ({ autoRest: !s.autoRest })),
      openRack: () => this.setState({ sheet: 'rack' }),
      closeSheet: () => this.setState({ sheet: false }),
      openSettings: () => this.setState({ screen: 'settings' }),
      openHistory: () => this.setState({ screen: 'history' }),
      toggleExpand: () => this.setState((s) => ({ expanded: !s.expanded })),
      finishRest: () => this.finishRest(),
      resetAll: () => this.setState((s) => ({
        allDone: false, doneIdx: [], activeIdx: null, log: {},
        ...this.undoPatch(s, 'Discarded ' + s.exercise, ['allDone', 'doneIdx', 'activeIdx', 'log']),
      })),
      toggleHome: () => this.setState((s) => ({ homeGym: !s.homeGym, ...this.progressReset() })),
      isDark: dark,
      themeVars: this.palette(),
      themeOptions: ([
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
        { id: 'system', label: 'System' },
      ] as Array<{ id: AppState['theme']; label: string }>).map((o) => ({
        label: o.label,
        on: st.theme === o.id,
        bg: st.theme === o.id ? 'acc' : 'ctl2',
        fg: st.theme === o.id ? 'accInk' : 'tx4',
        pick: () => this.setState({ theme: o.id }),
      })),
      accentSwatches: this.accents().map((a) => ({
        id: a.id,
        name: a.name,
        dot: a.base,
        on: st.accent === a.id,
        ring: st.accent === a.id ? a.base : 'transparent',
        check: st.accent === a.id ? a.ink : 'transparent',
        pick: () => this.setState({ accent: a.id }),
      })),
      accentName: this.accent().name,
      search: st.search,
      onSearch: (v: string) => this.setState({ search: v }),
      clearSearch: () => this.setState({ search: '' }),
      hasSearch: !!q,
      clearBg: q ? 'ctl3' : 'transparent',
      clearFg: q ? 'mut' : 'transparent',
      noResults: exercises.length === 0,
      canAddSet: this.nextRung(st.warmups) !== null,
      canAddSetTail: this.nextRung(st.warmups) !== null && afterSets.length === 0,
      afterHeading: p.scheme.name.toUpperCase(),
      sessionsLabel: hist.count + ' sessions logged',
      sessionsStat: String(hist.count),
      finishedAt: p.work.main + ' ' + st.units,
      saveSession: () => {
        this.recordSession();
        this.advanceSession();
      },
      // what the completion card summarises: every set you actually logged, in order
      doneSummary: Object.keys(st.log)
        .map(Number).sort((a, b) => a - b)
        .filter((i) => st.doneIdx.indexOf(i) >= 0)
        .map((i) => {
          const e = st.log[i];
          const varied = e.w !== e.planW || e.r !== e.planR;
          return {
            label: (flat[i] ? flat[i].label : 'Set ' + (i + 1)),
            val: e.w + ' × ' + e.r,
            note: varied ? 'planned ' + e.planW + ' × ' + e.planR : '',
            fg: varied ? 'warnTx' : 'tx3',
          };
        }),
      emptyRack,
      openRackFromWarn: () => this.setState({ sheet: 'rack' }),
      sheetRack: st.sheet === 'rack', sheetBar: st.sheet === 'bar', sheetRm: st.sheet === '1rm',
      sheet: !!st.sheet, allDone: st.allDone,

      // ---- specialty bars
      barProfileOptions,
      barShaped: shapedBar, barStraight: !shapedBar,
      shaftParts: heroArt.parts, shaftBoxH: heroArt.h, shaftBoxHSm: Math.round(heroArt.h * 0.92),
      shaftBoxW: heroArt.w || 120, shaftBoxWSm: Math.round((heroArt.w || 120) * 0.92),
      // gradient runs across the shaft's own thickness, not the whole box, so a flat sleeve still shades
      shaftGradTop: heroArt.h / 2 - 8, shaftGradBot: heroArt.h / 2 + 8,
      shaftH: profileId === 'axle' ? 19 : profileId === 'dl' ? 10 : 13,
      barProfileName: dbl ? 'Dumbbell handle' : (curProfile ? curProfile.name : 'Custom bar'),
      barProfileNote: dbl
        ? 'Loadable handle'
        : (curProfile ? curProfile.sleeve + ' mm sleeve' : 'Sleeve assumed ' + this.sleeveCap() + ' mm'),
      openBarSheet: () => this.setState({ sheet: 'bar' }),
      notDumbbell: !dbl,

      // ---- nearest loadable alternatives
      altChips, hasAlts: altChips.length > 0,

      // ---- reverse input: read a bar that is already loaded
      openReverse: () => this.setState({ sheet: 'reverse', revSide: [] }),
      sheetReverse: st.sheet === 'reverse',
      revButtons: this.plateSet().map((w) => {
        const s = this.skinFor(w);
        return {
          w,
          label: String(w), skin: s,
          add: () => this.setState((x) => ({ revSide: x.revSide.concat([w]).sort((a, b) => b - a) })),
        };
      }),
      revChips: st.revSide.map((w, i) => ({
        label: String(w),
        drop: () => this.setState((x) => ({ revSide: x.revSide.filter((_, j) => j !== i) })),
      })),
      revEmpty: st.revSide.length === 0,
      revAny: st.revSide.length > 0,
      revLeft: this.plates(st.revSide.slice().reverse(), { scale: 0.6 }),
      revRight: this.plates(st.revSide, { scale: 0.6 }),
      revTotal,
      revSideLabel: m === 'landmine'
        ? revSum + ' ' + st.units + ' on the far sleeve'
        : revSum + ' ' + st.units + ' per side · ' + p.base + ' ' + st.units + ' base',
      revClear: () => this.setState({ revSide: [] }),
      revApply: () => { setTarget(revTotal); this.setState({ sheet: false }); },
      revApplyLabel: 'Use ' + revTotal + ' ' + st.units + ' as target',

      // ---- derive the working weight from a one-rep max
      openRm: () => this.setState({ sheet: '1rm' }),
      rmW: String(st.rmW), rmR: String(st.rmR), rmRpe: rpeLabel,
      rmWDown: () => this.setState((x) => ({ rmW: Math.max(step, x.rmW - step) })),
      rmWUp: () => this.setState((x) => ({ rmW: x.rmW + step })),
      rmRDown: () => this.setState((x) => ({ rmR: Math.max(1, x.rmR - 1) })),
      rmRUp: () => this.setState((x) => ({ rmR: Math.min(15, x.rmR + 1) })),
      rmRpeDown: () => this.setState((x) => ({ rmRpe: Math.max(6, Math.round((x.rmRpe - 0.5) * 2) / 2) })),
      rmRpeUp: () => this.setState((x) => ({ rmRpe: Math.min(10, Math.round((x.rmRpe + 0.5) * 2) / 2) })),
      e1rm: String(e1rm),
      e1rmNote: st.rmR + ' × ' + st.rmW + ' ' + st.units + ' at RPE ' + rpeLabel
        + ' ≈ ' + effReps + ' reps to failure',
      pctRows,

      // ---- competition mode
      comp: st.comp, notComp: !st.comp,
      toggleComp: () => this.setState((s) => ({ comp: !s.comp, ...this.progressReset() })),
      collarOptions: this.collars().map((c) => ({
        id: c.id,
        name: c.name, note: c.note,
        on: st.collarId === c.id,
        bg: st.collarId === c.id ? 'accA16' : 'ctl2',
        bd: st.collarId === c.id ? 'accA50' : 'bdSoft',
        fg: st.collarId === c.id ? 'accDeep' : 'mut2',
        pick: () => this.setState({ collarId: c.id, ...this.progressReset() }),
      })),
      collarLine: st.comp && this.collar().w > 0
        ? 'Bar ' + p.barOnly + ' + collars ' + this.collarWeight() + ' = ' + p.base + ' ' + st.units + ' base'
        : '',
      hasCollars: st.comp && this.collar().w > 0,

      // ---- fewest plate changes
      minChanges: st.minChanges,
      toggleMinChanges: () => this.setState((s) => ({ minChanges: !s.minChanges, ...this.progressReset() })),
      handlingLabel: totalChanges === 0
        ? 'No plates to move between sets'
        : totalChanges + ' ' + (totalChanges === 1 ? 'plate' : 'plates') + ' to add or strip across the whole ladder',
      homeGym: st.homeGym, notHomeGym: !st.homeGym,
      homeCardBg: st.homeGym ? 'accA07' : 'card2',
      homeCardBd: st.homeGym ? 'accA40' : 'bd',
      rackRows,
    };
  }

  // ---- history, derived from persisted records (sample data only while the tour plays) ----
  history(): {
    count: number; vol: number[]; volPeakLabel: string; movedLabel: string; prCount: number;
    sessions: Array<{ when: string; ex: string; mode: string; top: string; meta: string; pr: boolean }>;
    trends: Record<string, number[]>; empty: boolean; sample: boolean;
  } {
    const st = this.state;
    const u = st.units;
    const kFmt = (n: number) => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n)));
    if (st.tour === 'play') {
      // sample data so the tour's history chapter has something to show
      const tr: Record<string, number[]> = {};
      Object.keys(TRENDS).forEach((k) => { tr[k] = u === 'kg' ? TRENDS[k].map((v) => Math.round(v / LB_PER_KG)) : TRENDS[k]; });
      const vol = VOL.map((v) => v * 1000);
      return {
        count: 18, vol, volPeakLabel: 'peak ' + kFmt(Math.max(...vol)) + ' ' + u,
        movedLabel: kFmt(vol.reduce((a, b) => a + b, 0) / 10) + ' ' + u, prCount: 3,
        sessions: SESSIONS, trends: tr, empty: false, sample: true,
      };
    }
    const recs = st.records.slice().sort((a, b) => a.at - b.at);
    const conv = (w: number, from: Units) => (from === u ? w : u === 'kg' ? w / LB_PER_KG : w * LB_PER_KG);
    const WEEK = 7 * 86400000;
    const now = Date.now();
    const weekIdx = (at: number, n: number) => n - 1 - Math.floor((now - at) / WEEK); // n-1 = this week
    // weekly volume, last 10 weeks, in the current unit
    const vol = new Array(10).fill(0) as number[];
    recs.forEach((r) => {
      const i = weekIdx(r.at, 10);
      if (i < 0 || i > 9) return;
      vol[i] += r.sets.reduce((a, s) => a + conv(s.w, r.units) * s.r, 0);
    });
    // estimated 1RM per exercise — best Epley set per session, then per week (carry forward gaps)
    const e1 = (w: number, r: number) => w * (1 + r / 30);
    const bestOf = (r: typeof recs[number]) => r.sets.reduce((m, s) => Math.max(m, e1(conv(s.w, r.units), s.r)), 0);
    const trends: Record<string, number[]> = {};
    const byEx: Record<string, typeof recs> = {};
    recs.forEach((r) => { (byEx[r.exercise] = byEx[r.exercise] || []).push(r); });
    Object.keys(byEx).forEach((ex) => {
      const list = byEx[ex];
      if (list.length < 2) return;
      const weeks: Array<number | null> = new Array(8).fill(null);
      let before: number | null = null;
      list.forEach((r) => {
        const i = weekIdx(r.at, 8);
        const v = bestOf(r);
        if (i < 0) before = Math.max(before || 0, v);
        else if (i <= 7) weeks[i] = Math.max(weeks[i] || 0, v);
      });
      let last: number | null = before;
      const out: number[] = [];
      weeks.forEach((v) => { if (v !== null) last = v; if (last !== null) out.push(Math.round(last)); });
      if (out.length >= 2) trends[ex] = out;
    });
    // PRs: a session whose e1RM beat every earlier session of that lift
    const bestSoFar: Record<string, number> = {};
    const prIds = new Set<string>();
    recs.forEach((r) => {
      const v = bestOf(r);
      if (v > (bestSoFar[r.exercise] || 0) + 0.001) { if (bestSoFar[r.exercise]) prIds.add(r.id); bestSoFar[r.exercise] = v; }
    });
    const recent10 = recs.filter((r) => now - r.at < 10 * WEEK);
    const prCount = recent10.filter((r) => prIds.has(r.id)).length;
    const moved = vol.reduce((a, b) => a + b, 0);
    const fmtWhen = (at: number) => {
      const d = new Date(at), t = new Date(now);
      const days = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      return day + ' ' + d.getDate() + ' ' + mon + (d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '');
    };
    const sessions = recs.slice().reverse().slice(0, 8).map((r) => {
      const top = r.sets.reduce((m, s) => (s.w > m.w ? s : m), r.sets[0]);
      const v = r.sets.reduce((a, s) => a + s.w * s.r, 0);
      return {
        when: fmtWhen(r.at), ex: r.exercise,
        mode: r.mode.charAt(0).toUpperCase() + r.mode.slice(1),
        top: top.w + ' × ' + top.r,
        // recent rows display in the unit they were recorded in (records don't convert)
        meta: r.sets.length + (r.sets.length === 1 ? ' set · ' : ' sets · ') + Math.round(v).toLocaleString() + ' ' + r.units,
        pr: prIds.has(r.id),
      };
    });
    return {
      count: recs.length, vol, volPeakLabel: 'peak ' + kFmt(Math.max(0, ...vol)) + ' ' + u,
      movedLabel: kFmt(moved) + ' ' + u, prCount, sessions, trends, empty: recs.length === 0, sample: false,
    };
  }
}
