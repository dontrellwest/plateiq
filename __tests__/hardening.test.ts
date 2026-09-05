// Regression tests for the 2026-09-05 hardening pass (see docs/HARDENING.md): every case here was
// a confirmed defect found by the code audit or the simulator gauntlet.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlateIQLogic, MemoryHost, INITIAL_STATE } from '../src/logic/PlateIQLogic';
import { BAR_PROFILES, ANCHOR_COEF } from '../src/logic/constants';
import type { AppState } from '../src/logic/types';
import {
  STORAGE_KEY, bootStore, logic as storeLogic, useStore, sanitizePersisted, isHydrationSettled, _resetHydrationForTests,
} from '../src/store/useStore';

function fresh(patch: Partial<AppState> = {}): PlateIQLogic {
  const l = new PlateIQLogic(new MemoryHost(), { startOnOnboarding: false, plateStyle: 'dimensional' });
  l.setState({ tour: false, onboard: false, ...patch });
  return l;
}
const state = (l: PlateIQLogic) => (l as unknown as { state: AppState }).state;

describe('typed weights', () => {
  test('a comma decimal separator is a decimal point, not deleted (22,5 kg is not 225 kg)', () => {
    const l = fresh({ units: 'kg', bar: 20, working: 60 });
    l.setState({ workDraft: '22,5' }); l.commitWorking();
    expect(state(l).working).toBe(22.5);
    l.setState({ workDraft: ' 47,5 ' }); l.commitWorking();
    expect(state(l).working).toBe(47.5);
    const d = fresh({ units: 'kg', mode: 'dumbbell', dbHandle: 2.5, dbTotal: 20 });
    d.setState({ barDraft: '12,5' }); d.commitBarWeight();
    expect(state(d).dbHandle).toBe(12.5);
  });

  test('Infinity and junk in the bar field fall back to the current bar', () => {
    const l = fresh({ bar: 45 });
    l.setState({ barDraft: 'Infinity' }); l.commitBarWeight();
    expect(state(l).bar).toBe(45);
    l.setState({ barDraft: 'abc' }); l.commitBarWeight();
    expect(state(l).bar).toBe(45);
    expect(state(l).barDraft).toBe('45');
  });

  test('a typed landmine target below the bare bar is floored at the bar seen through the anchor', () => {
    const l = fresh({ mode: 'landmine', anchorType: 'sleeve', lmTarget: 90 });
    l.setState({ workDraft: '10' }); l.commitWorking();
    const coef = ANCHOR_COEF.sleeve;
    const floor = Math.round(l.baseTotal() * coef / 0.5) * 0.5;
    expect(state(l).lmTarget).toBe(floor);
  });
});

describe('steppers', () => {
  test('minus never raises a typed target and floors one plate step above the bar, in either unit', () => {
    const lb = fresh({ bar: 45, working: 47 });
    lb.renderVals().decWorking(); expect(state(lb).working).toBe(47);
    lb.setState({ working: 50 }); lb.renderVals().decWorking(); expect(state(lb).working).toBe(50);
    lb.setState({ working: 55 }); lb.renderVals().decWorking(); expect(state(lb).working).toBe(50);
    lb.setState({ working: 55 }); lb.renderVals().incWorking(); expect(state(lb).working).toBe(60);
    const kg = fresh({ units: 'kg', bar: 20, working: 22.5 });
    kg.renderVals().decWorking(); expect(state(kg).working).toBe(22.5);
    kg.setState({ working: 25 }); kg.renderVals().decWorking(); expect(state(kg).working).toBe(22.5);
    const db = fresh({ mode: 'dumbbell', dbHandle: 5, dbTotal: 7 });
    db.renderVals().decWorking(); expect(state(db).dbTotal).toBe(7);
    db.setState({ dbTotal: 15 }); db.renderVals().decWorking(); expect(state(db).dbTotal).toBe(10);
  });

  test('a press lands on the rounding grid, so the field and the card agree (kg, roundTo 0.5 and 2.5)', () => {
    const l = fresh({ units: 'kg', bar: 20, working: 100, roundTo: 0.5 });
    l.renderVals().incWorking();
    expect(state(l).working).toBe(103);
    expect(l.plan().work.want).toBe(103);
    l.renderVals().decWorking();
    expect(state(l).working).toBe(100);
    const c = fresh({ units: 'kg', bar: 20, working: 100, roundTo: 2.5 });
    c.renderVals().incWorking(); expect(state(c).working).toBe(105);
    c.renderVals().decWorking(); expect(state(c).working).toBe(100);
    const lb = fresh({ units: 'lb', bar: 45, working: 225, roundTo: 0.25 });
    lb.renderVals().incWorking(); expect(state(lb).working).toBe(230);
  });

  test('a landmine press moves one plate step on the loaded side, not one rounding step', () => {
    const l = fresh({ mode: 'landmine', anchorType: 'sleeve', lmTarget: 135, roundTo: 0.25 });
    l.renderVals().incWorking();
    const coef = ANCHOR_COEF.sleeve;
    expect(state(l).lmTarget - 135).toBeGreaterThanOrEqual(Math.round(5 * coef / 0.5) * 0.5 - 0.5);
    let presses = 0;
    while (state(l).lmTarget > 100 && presses < 40) { l.renderVals().decWorking(); presses++; }
    expect(presses).toBeLessThan(15);
  });

  test('picking a bar by weight names its profile and floors the target one step above it', () => {
    const l = fresh({ bar: 45, barProfile: 'std', working: 50 });
    l.setBarWeight(35);
    const prof = BAR_PROFILES.lb.find((b) => b.id === state(l).barProfile);
    expect(prof && prof.w).toBe(35);
    l.setBarWeight(55);
    expect(state(l).barProfile).toBe('custom');
    expect(state(l).working).toBe(60);
    const kg = fresh({ units: 'kg', bar: 20, working: 20 });
    kg.setBarWeight(25);
    expect(state(kg).working).toBe(27.5);
  });
});

describe('history', () => {
  test('a record with no sets is skipped instead of crashing the History screen', () => {
    const l = fresh({ screen: 'history', records: [
      { id: 'a', at: Date.now() - 86400000, exercise: 'Bench press', mode: 'barbell', units: 'lb', sets: [] },
      { id: 'b', at: Date.now(), exercise: 'Bench press', mode: 'barbell', units: 'lb', sets: [{ label: 'Set 1', w: 225, r: 5, planW: 225, planR: 5 }] },
    ] as AppState['records'] });
    expect(() => l.renderVals()).not.toThrow();
    // and storage validation drops a record that has no sets array at all
    expect(sanitizePersisted({ records: [{ id: 'x', at: 1, exercise: 'Squat' }] })).toEqual({});
  });
});

describe('reverse reader', () => {
  test('a loaded landmine bar becomes the effective target it represents', () => {
    const l = fresh({ mode: 'landmine', anchorType: 'sleeve', lmTarget: 60 });
    l.renderVals().openReverse();
    const v = l.renderVals();
    v.revButtons.find((b) => b.w === 45)!.add();
    const v2 = l.renderVals();
    const loaded = v2.revTotal;
    const coef = ANCHOR_COEF.sleeve;
    const eff = Math.round(loaded * coef / 0.5) * 0.5;
    expect(v2.revApplyLabel).toContain('effective');
    v2.revApply();
    expect(state(l).lmTarget).toBe(eff);
    // the ladder now prescribes at most the plates that were on the bar, never almost double
    const work = l.plan().work;
    expect(work.side.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(45 + 0.001);
  });

  test('barbell reads are unchanged: bar plus both sides', () => {
    const l = fresh({ bar: 45, working: 135 });
    l.renderVals().openReverse();
    l.renderVals().revButtons.find((b) => b.w === 45)!.add();
    expect(l.renderVals().revTotal).toBe(135);
    l.renderVals().revApply();
    expect(state(l).working).toBe(135);
  });
});

describe('logging', () => {
  test('logging the last set from its card finishes the exercise like Done does', () => {
    const l = fresh();
    const last = l.plan().sets.length + l.plan().after.length;
    l.tapSet(last);
    expect(state(l).activeIdx).toBe(last);
    l.tapSet(last);
    expect(state(l).activeIdx).toBeNull();
    expect(state(l).allDone).toBe(true);
  });

  test('undo of Done with auto-start off restores the paused panel, not a running one', () => {
    const l = fresh({ autoRest: false });
    l.tapSet(0);
    expect(state(l).paused).toBe(true);
    l.finishRest();
    expect(state(l).activeIdx).toBeNull();
    l.applyUndo();
    expect(state(l).activeIdx).toBe(0);
    expect(state(l).paused).toBe(true);
  });
});

describe('guided tour', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  test('Skip during the boot delay cancels the tour', () => {
    const l = new PlateIQLogic(new MemoryHost(), { startOnOnboarding: true, plateStyle: 'dimensional' });
    l.mount(500);
    expect(state(l).tour).toBe('auto');
    l.endTour(false);
    jest.advanceTimersByTime(700);
    expect(state(l).tour).toBe(false);
    expect(state(l).tourSeen).toBe(true);
  });

  test('a second fingertip tap runs the pending action first instead of dropping it', () => {
    const l = fresh();
    l.tourHost = { press: () => true, scrollTo: () => undefined, setProgress: () => undefined };
    l.setState({ tour: 'play' });
    const calls: string[] = [];
    l.tourTap('a', () => calls.push('a'));
    l.tourTap('b', () => calls.push('b'));
    expect(calls).toEqual(['a']);
    jest.advanceTimersByTime(500);
    expect(calls).toEqual(['a', 'b']);
  });

  test('the demo runs on the default ladder in the user\'s units and puts everything back', () => {
    const l = fresh({ units: 'kg', bar: 20, working: 60, mode: 'dumbbell', dbHandle: 5, barDraft: '5', warmups: [], scheme: 'straight' });
    l.tourHost = { press: () => false, scrollTo: () => undefined, setProgress: () => undefined };
    l.startTour('settings');
    const s = state(l);
    expect(s.mode).toBe('barbell');
    expect(s.working).toBe(100);
    expect(s.barDraft).toBe('20');
    expect(s.warmups.length).toBe(INITIAL_STATE.warmups.length);
    expect(s.scheme).toBe('single');
    // the two "raise the target" frames step in kg, not in hard-coded pounds
    const frames = l.tourScript();
    frames[2].run!();
    expect(state(l).working).toBe(105);
    l.endTour(true);
    const r = state(l);
    expect(r.mode).toBe('dumbbell');
    expect(r.working).toBe(60);
    expect(r.barDraft).toBe('5');
    expect(r.warmups).toEqual([]);
    expect(r.scheme).toBe('straight');
  });
});

describe('store binding', () => {
  beforeEach(async () => { _resetHydrationForTests(); await AsyncStorage.clear(); });

  test('persisted values of the wrong shape fall back to defaults instead of reaching the solver', () => {
    const out = sanitizePersisted({ working: '225', units: 'stone', records: 'x', session: null, warmups: [{ id: 1 }], bar: 55, doneIdx: [1, 'x'], onboard: true, tourSnap: null });
    expect(out).toEqual({ units: 'stone', bar: 55, onboard: true, tourSnap: null });
    expect(sanitizePersisted(null)).toEqual({});
    expect(sanitizePersisted('{}')).toEqual({});
  });

  test('a write that changes nothing does not wake subscribers', () => {
    let n = 0;
    const off = useStore.subscribe(() => { n++; });
    storeLogic.setState({ remaining: useStore.getState().remaining });
    expect(n).toBe(0);
    storeLogic.setState({ remaining: useStore.getState().remaining + 1 });
    expect(n).toBe(1);
    off();
  });

  test('unreadable storage still lets the app settle and mount', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{"state":{"units":"kg"');
    await useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0 });
    try {
      // settled at once (nothing to wait for) and the app is on its defaults, not stuck
      expect(isHydrationSettled()).toBe(true);
      expect(useStore.getState().units).toBe('lb');
    } finally { stop(); }
  });

  test('a rest in progress survives a relaunch through its wall-clock end time', async () => {
    const t0 = 1_800_000_000_000;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { tourSeen: true, onboard: false, activeIdx: 1, restTotal: 180, restEndsAt: t0 + 61_000, paused: false }, version: 1 }));
    await useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0, now: () => t0 });
    try {
      expect(useStore.getState().activeIdx).toBe(1);
      expect(useStore.getState().remaining).toBe(61);
      expect(useStore.getState().restEndsAt).toBe(t0 + 61_000);
    } finally { stop(); }
  });

  test('a rest that ended more than 30 minutes ago is dropped on relaunch', async () => {
    const t0 = 1_800_000_000_000;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { tourSeen: true, onboard: false, activeIdx: 1, restTotal: 180, restEndsAt: t0 - 3_600_000, paused: false }, version: 1 }));
    await useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0, now: () => t0 });
    try {
      expect(useStore.getState().activeIdx).toBeNull();
      expect(useStore.getState().remaining).toBe(0);
    } finally { stop(); }
  });
});

describe('theme contrast', () => {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  test.each(['dark', 'light'] as const)('%s theme: muted text reads at 4.5:1 or better on every surface it sits on', (theme) => {
    const l = fresh({ theme, systemDark: theme === 'dark' });
    const t = l.palette() as unknown as Record<string, string>;
    for (const fg of ['mut', 'mut2', 'mut3', 'mut4', 'mut5']) {
      for (const bg of ['bg', 'card', 'card2', 'ctl2']) {
        expect({ fg, bg, ratio: Math.round(ratio(t[fg], t[bg]) * 100) / 100 }).toEqual(expect.objectContaining({ ratio: expect.any(Number) }));
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
