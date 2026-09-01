// Differential check: run the prototype's ORIGINAL logic script (extracted from the design handoff
// HTML, exactly as qa/stress-test.html does) side by side with the TypeScript port and require
// identical solver output for the same seeded scenarios. Skipped when the handoff folder is absent.

import * as fs from 'fs';
import * as path from 'path';
import { PlateIQLogic, MemoryHost } from '../src/logic/PlateIQLogic';
import type { AppState } from '../src/logic/types';

const HANDOFF = path.resolve(__dirname, '..', '..', 'design_handoff_plateiq', 'PlateIQ Redesign.dc.html');
const N = Number(process.env.PLATEIQ_DIFF || (process.env.PLATEIQ_FULL === '1' ? 200000 : 30000));

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Proto = {
  state: Record<string, unknown>;
  setState(p: unknown): void;
  barProfiles(): Array<{ id: string; w: number }>;
  plan(): { sets: unknown[]; work: unknown; after: unknown[] };
  evaluate(want: number, keep: number[] | null, bare?: boolean): Record<string, unknown>;
  alts(want: number): { below: number | null; above: number | null };
  renderVals(): Record<string, unknown>;
};

function loadPrototype(): (new (props: unknown) => Proto) | null {
  if (!fs.existsSync(HANDOFF)) return null;
  const txt = fs.readFileSync(HANDOFF, 'utf8');
  const m = txt.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  const body = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  class DCLogic {
    props: unknown; state: Record<string, unknown> = {};
    constructor(props: unknown) { this.props = props || {}; }
    setState(p: unknown) {
      const q = typeof p === 'function' ? (p as (s: unknown) => unknown)(this.state) : p;
      if (q) Object.assign(this.state, q as object);
    }
    forceUpdate() { /* headless */ }
  }
  const React = { createElement: () => null };
  const g = globalThis as Record<string, unknown>;
  if (!g.window) g.window = { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
  if (!g.requestAnimationFrame) g.requestAnimationFrame = () => 0;
  if (!g.cancelAnimationFrame) g.cancelAnimationFrame = () => {};
  const make = new Function('DCLogic', 'React', '"use strict";' + body + ';return Component;');
  return make(DCLogic, React);
}

const PLATE_SETS = { lb: [45, 35, 25, 10, 5, 2.5, 1.25, 0.75, 0.5, 0.25], kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25] };

// Same randomizer as the harness, producing one patch applied to both implementations.
function scenario(rnd: () => number, profilesFor: (u: 'lb' | 'kg') => Array<{ id: string; w: number }>): Partial<AppState> {
  const units = rnd() < 0.5 ? 'lb' : 'kg';
  const mode = (['barbell', 'dumbbell', 'landmine'] as const)[Math.floor(rnd() * 3)];
  const s: Record<string, unknown> = { units, mode };
  s.anchorType = (['rack', 'hinge', 'sleeve'] as const)[Math.floor(rnd() * 3)];
  s.roundTo = ([0.25, 0.5, 1.25, 2.5] as const)[Math.floor(rnd() * 4)];
  s.minChanges = rnd() < 0.8;
  s.comp = rnd() < 0.2;
  s.collarId = (['none', 'clip', 'comp'] as const)[Math.floor(rnd() * 3)];
  s.homeGym = rnd() < 0.4;
  s.dbPair = rnd() < 0.5;
  const qty: Record<number, number> = {};
  PLATE_SETS[units].forEach((w) => { qty[w] = rnd() < 0.15 ? 0 : Math.floor(rnd() * 9); });
  if (rnd() < 0.05) PLATE_SETS[units].forEach((w) => { qty[w] = 0; });
  s.qty = qty;
  let bar: number;
  if (rnd() < 0.7) {
    const list = profilesFor(units);
    const p = list[Math.floor(rnd() * list.length)];
    s.barProfile = p.id; bar = p.w;
  } else {
    s.barProfile = 'custom';
    bar = Math.round((10 + rnd() * 90) * 4) / 4;
  }
  s.bar = bar;
  const dbHandle = Math.round((2 + rnd() * 13) * 4) / 4;
  s.dbHandle = dbHandle;
  const grid = (v: number, step: number) => Math.round(v / step) * step;
  const rt = s.roundTo as number;
  const arb = rnd() < 0.25;
  const wTarget = bar + rnd() * (units === 'kg' ? 280 : 600);
  s.working = arb ? Math.round(wTarget * 100) / 100 : Math.max(bar, grid(wTarget, rt * 2));
  const dTarget = dbHandle + rnd() * (units === 'kg' ? 60 : 140);
  s.dbTotal = arb ? Math.round(dTarget * 100) / 100 : Math.max(dbHandle, grid(dTarget, rt * 2));
  const lTarget = 5 + rnd() * (units === 'kg' ? 180 : 400);
  s.lmTarget = arb ? Math.round(lTarget * 100) / 100 : Math.max(1, grid(lTarget, rt));
  s.scheme = (['single', 'straight', 'backoff', 'reverse', 'drop', 'cluster', 'amrap'] as const)[Math.floor(rnd() * 7)];
  const n = Math.floor(rnd() * 7);
  const warm: Array<{ id: string; label: string; pct: number; reps: number; rest: number }> = [];
  for (let i = 0; i < n; i++) {
    warm.push({ id: 'w' + i, label: '', pct: Math.round(rnd() * 19) * 5, reps: 1 + Math.floor(rnd() * 30), rest: 15 + Math.floor(rnd() * 285) });
  }
  warm.sort((a, b) => a.pct - b.pct);
  warm.forEach((w) => { w.label = w.pct === 0 ? 'Empty bar' : w.pct + '%'; });
  s.warmups = warm;
  s.activeIdx = null; s.doneIdx = []; s.allDone = false; s.log = {}; s.undo = null;
  return s as Partial<AppState>;
}

const pick = (o: unknown) => {
  const x = o as Record<string, unknown>;
  return { total: x.total, main: x.main, side: x.side, sub: x.sub, want: x.want, short: x.short, miss: x.miss, overBase: x.overBase, full: x.full, label: x.label, pct: x.pct, reps: x.reps, rest: x.rest };
};

const Proto = loadPrototype();
const maybe = Proto ? describe : describe.skip;

maybe('port vs. prototype (differential, ' + N.toLocaleString() + ' scenarios)', () => {
  test('plan(), evaluate() and alts() agree exactly', () => {
    const P = Proto as new (props: unknown) => Proto;
    const a = new P({ startOnOnboarding: false, plateStyle: 'dimensional' });
    a.state = Object.assign({}, a.state);
    a.state.onboard = false;
    const b = new PlateIQLogic(new MemoryHost(), { startOnOnboarding: false, plateStyle: 'dimensional' });
    b.setState({ onboard: false });
    const rnd = mulberry32(20260802);
    const mismatches: string[] = [];
    let alts = 0;
    for (let i = 0; i < N && mismatches.length < 10; i++) {
      const s = scenario(rnd, (u) => { a.state.units = u; return a.barProfiles(); });
      a.setState(s); b.setState(s);
      const pa = a.plan(), pb = b.plan();
      const fa = [...pa.sets, pa.work, ...pa.after].map(pick);
      const fb = [...pb.sets, pb.work, ...pb.after].map(pick);
      const ja = JSON.stringify(fa), jb = JSON.stringify(fb);
      if (ja !== jb) mismatches.push('#' + i + ' plan\n  proto ' + ja + '\n  port  ' + jb + '\n  ' + JSON.stringify(s));
      const w = (pa.work as { miss: number; overBase: boolean; want: number });
      if (w.miss !== 0 && !w.overBase) {
        alts++;
        const xa = JSON.stringify(a.alts(w.want)), xb = JSON.stringify(b.alts(w.want));
        if (xa !== xb) mismatches.push('#' + i + ' alts proto ' + xa + ' port ' + xb + ' ' + JSON.stringify(s));
      }
      // renderVals-level numbers the harness inspects
      const va = a.renderVals(), vb = b.renderVals();
      (['pivotX', 'pivotY', 'rotate', 'wellH', 'workWellH', 'warn', 'schemeLine', 'handlingLabel', 'finishedAt'] as const).forEach((k) => {
        if (JSON.stringify(va[k]) !== JSON.stringify((vb as Record<string, unknown>)[k])) mismatches.push('#' + i + ' renderVals.' + k + ' proto ' + JSON.stringify(va[k]) + ' port ' + JSON.stringify((vb as Record<string, unknown>)[k]));
      });
    }
    // eslint-disable-next-line no-console
    console.log('differential: ' + N.toLocaleString() + ' scenarios, ' + alts.toLocaleString() + ' with alternatives; ' + (mismatches.length ? mismatches.length + ' mismatches' : 'identical'));
    expect(mismatches).toEqual([]);
  }, 3600 * 1000);
});
