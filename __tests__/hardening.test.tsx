// Regression tests for the 2026-09-05 hardening pass (see docs/HARDENING.md): every case here was
// a confirmed defect found by the code audit or the simulator gauntlet.

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { render, screen, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Root } from '../src/Root';

const initialMetrics = { frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
import { PlateIQLogic, MemoryHost, INITIAL_STATE } from '../src/logic/PlateIQLogic';
import { BAR_PROFILES, ANCHOR_COEF } from '../src/logic/constants';
import type { AppState } from '../src/logic/types';
import { haptics } from '../src/platform/haptics';
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

  test.each([['sleeve', 31.5], ['hinge', 34], ['rack', 36]] as const)(
    'a typed landmine target below the bare bar is floored at the 45 lb bar through the %s anchor',
    (anchorType, floor) => {
      const l = fresh({ mode: 'landmine', anchorType, lmTarget: 90 });
      // the bare bar through the anchor, on the solver's own 0.5 lb effective grid
      expect(Math.round(45 * ANCHOR_COEF[anchorType] / 0.5) * 0.5).toBe(floor);
      l.setState({ workDraft: '10' }); l.commitWorking();
      expect(state(l).lmTarget).toBe(floor);
    },
  );
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

  test('a press lands on the rounding grid, so the field and the card agree', () => {
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
    // dumbbells round to 2x roundTo as well (roundTarget treats them like a barbell)
    const d = fresh({ units: 'kg', mode: 'dumbbell', dbHandle: 5, dbTotal: 20, roundTo: 0.5 });
    d.renderVals().incWorking();
    expect(state(d).dbTotal).toBe(23);
    expect(d.plan().work.want).toBe(23);
    d.renderVals().decWorking(); expect(state(d).dbTotal).toBe(20);
  });

  test('one press moves one plate step, never two grid steps, from an off-grid target', () => {
    const l = fresh({ units: 'kg', bar: 20, working: 70.25, roundTo: 2.5 });
    l.renderVals().incWorking();
    expect(state(l).working).toBe(75);
    const b = fresh({ units: 'kg', bar: 20, working: 156, roundTo: 2.5 });
    b.renderVals().incWorking();
    expect(state(b).working).toBe(160);
  });

  test('the lowest target the steppers reach is on the grid, so the field matches the card there too', () => {
    const kg = fresh({ units: 'kg', bar: 20, working: 100, roundTo: 2.5 });
    for (let i = 0; i < 40; i++) kg.renderVals().decWorking();
    expect(state(kg).working).toBe(25);
    expect(kg.plan().work.want).toBe(25);
    // a 33 lb technique bar with a 5 lb grid: 38 is off the grid, 40 is the floor
    const lb = fresh({ units: 'lb', bar: 33, working: 45, roundTo: 2.5 });
    lb.renderVals().decWorking(); expect(state(lb).working).toBe(40);
    lb.renderVals().decWorking(); expect(state(lb).working).toBe(40);
    expect(lb.plan().work.want).toBe(40);
  });

  test('a landmine press moves one plate step on the loaded side, not one rounding step', () => {
    const l = fresh({ mode: 'landmine', anchorType: 'sleeve', lmTarget: 135, roundTo: 0.25 });
    l.renderVals().incWorking();
    // 135 effective is 195 lb loaded on the 5 lb grid; one more plate step is 200 loaded = 140 effective
    expect(state(l).lmTarget).toBe(140);
    let presses = 0;
    while (state(l).lmTarget > 100 && presses < 40) { l.renderVals().decWorking(); presses++; }
    // about 3.5 effective lb per press, not the 0.5 the rounding step would give
    expect(presses).toBe(12);
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

describe('undo', () => {
  test('a pending undo is dropped when the ladder is rebuilt around another implement or unit', () => {
    const l = fresh();
    l.tapSet(0); l.finishRest();
    expect(state(l).undo).not.toBeNull();
    l.setMode('dumbbell');
    expect(state(l).undo).toBeNull();
    const u = fresh();
    u.tapSet(0); u.finishRest();
    u.setUnits('kg');
    expect(state(u).undo).toBeNull();
    const a = fresh();
    a.tapSet(0); a.finishRest();
    a.addSet();
    expect(state(a).undo).toBeNull();
  });

  test('finishing an exercise keeps its undo, so the session advance can be taken back', () => {
    const l = fresh({ session: ['Bench press', 'Overhead press'], exercise: 'Bench press' });
    l.advanceSession();
    expect(state(l).exercise).toBe('Overhead press');
    expect(state(l).undo).not.toBeNull();
    l.applyUndo();
    expect(state(l).exercise).toBe('Bench press');
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
    expect(sanitizePersisted({ records: [{ id: 'x', at: 1, exercise: 'Squat' }] })).toEqual({ records: [] });
  });
});

describe('reverse reader', () => {
  test('a loaded landmine bar becomes the effective target it represents', () => {
    const l = fresh({ mode: 'landmine', anchorType: 'sleeve', lmTarget: 60 });
    l.renderVals().openReverse();
    const v = l.renderVals();
    v.revButtons.find((b) => b.w === 45)!.add();
    const v2 = l.renderVals();
    expect(v2.revTotal).toBe(90); // 45 lb bar + one 45 on the far sleeve
    expect(v2.revApplyLabel).toBe('Use 63 lb effective as target'); // 90 x 0.7
    v2.revApply();
    expect(state(l).lmTarget).toBe(63);
    // the number applied is on the same grid the card plans with
    expect(l.plan().work.want).toBe(63);
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
  test.each([
    ['default ladder', {}],
    ['back-off sets after the top set', { scheme: 'backoff' as const }],
    ['no warm-ups', { warmups: [] }],
    ['drop sets, no warm-ups', { scheme: 'drop' as const, warmups: [] }],
  ])('logging the last set from its card finishes the exercise like Done does (%s)', (_name, patch) => {
    const l = fresh(patch as Partial<AppState>);
    const p = l.plan();
    const last = p.sets.length + p.after.length;
    l.tapSet(last);
    expect(state(l).activeIdx).toBe(last);
    l.tapSet(last);
    expect(state(l).activeIdx).toBeNull();
    expect(state(l).allDone).toBe(true);
    // and an earlier set must NOT claim the exercise is finished
    if (last > 0) {
      const m = fresh(patch as Partial<AppState>);
      m.tapSet(0); m.tapSet(0);
      expect(state(m).allDone).toBe(false);
    }
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

  test('a tap on an anchor that is not on screen still runs after the one already armed', () => {
    const l = fresh();
    let onScreen = true;
    l.tourHost = { press: () => onScreen, scrollTo: () => undefined, setProgress: () => undefined };
    l.setState({ tour: 'play' });
    const calls: string[] = [];
    l.tourTap('shown', () => calls.push('first'));
    onScreen = false;
    l.tourTap('missing', () => calls.push('second'));
    expect(calls).toEqual(['first', 'second']);
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
  beforeEach(async () => {
    _resetHydrationForTests();
    useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);
    await drain();
    await AsyncStorage.removeItem(STORAGE_KEY);
  });

  /** Let the persist middleware's in-flight writes land before touching storage ourselves. */
  const drain = () => new Promise((r) => setTimeout(r, 20));
  /** Write a saved state and make sure it is still there — a late persist write can overwrite it. */
  async function seedStorage(saved: Record<string, unknown>) {
    const raw = JSON.stringify({ state: saved, version: 1 });
    for (let i = 0; i < 10; i++) {
      await AsyncStorage.setItem(STORAGE_KEY, raw);
      await drain();
      if (await AsyncStorage.getItem(STORAGE_KEY) === raw) return;
    }
    throw new Error('storage kept being overwritten');
  }

  const rec = { id: 'r1', at: 1_700_000_000_000, exercise: 'Bench press', mode: 'barbell', units: 'lb', sets: [{ label: 'Set 1', w: 225, r: 5, planW: 225, planR: 5 }] };

  test('persisted values of the wrong shape fall back to defaults instead of reaching the solver', () => {
    const out = sanitizePersisted({ working: '225', records: 'x', session: null, warmups: [{ id: 1 }], bar: 55, doneIdx: [1, 'x'], onboard: true, tourSnap: null });
    expect(out).toEqual({ bar: 55, doneIdx: [1], warmups: [], onboard: true, tourSnap: null });
    expect(sanitizePersisted(null)).toEqual({});
    expect(sanitizePersisted('{}')).toEqual({});
  });

  test('a value outside a fixed set of choices is rejected, not carried in', () => {
    expect(sanitizePersisted({ units: 'stone', mode: 'kettlebell', scheme: 'wave', roundTo: 3, theme: 'neon', anchorType: 'bolt', collarId: 'tape' })).toEqual({});
    expect(sanitizePersisted({ units: 'kg', mode: 'landmine', scheme: 'drop', roundTo: 2.5, theme: 'light' }))
      .toEqual({ units: 'kg', mode: 'landmine', scheme: 'drop', roundTo: 2.5, theme: 'light' });
  });

  test('nullable keys accept only their own kinds of value', () => {
    expect(sanitizePersisted({ restEndsAt: {}, activeIdx: true, onboard: 5, tourSnap: 7 })).toEqual({});
    expect(sanitizePersisted({ restEndsAt: 123, activeIdx: 2, onboard: false, tourSnap: { working: 1 } }))
      .toEqual({ restEndsAt: 123, activeIdx: 2, onboard: false, tourSnap: { working: 1 } });
  });

  test('one unreadable history record is dropped, the rest of the history is kept', () => {
    const out = sanitizePersisted({ records: [rec, { id: 'x', at: 1, exercise: 'Squat' }, { ...rec, id: 'r2' }] });
    expect((out.records || []).map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  test('the haptic fires when the rest reaches zero, but not when the phone was locked past the end', () => {
    const spy = jest.spyOn(haptics, 'timerDone').mockImplementation(() => undefined);
    let t = 1_700_000_000_000;
    const stop = bootStore({ tourDelay: 0, now: () => t });
    try {
      storeLogic.tapSet(0);
      useStore.setState({ remaining: 1, restEndsAt: t + 1000 });
      t += 1000; storeLogic.tick(t);
      expect(useStore.getState().remaining).toBe(0);
      expect(spy).toHaveBeenCalledTimes(1);
      // now the same countdown ends while the app is suspended: the buzz would arrive minutes late
      spy.mockClear();
      storeLogic.tapSet(1);
      useStore.setState({ remaining: 5, restEndsAt: t + 5000 });
      t += 600_000; storeLogic.tick(t);
      expect(useStore.getState().remaining).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    } finally { stop(); spy.mockRestore(); }
  });

  test('storage is written when something changes and left alone when nothing does', async () => {
    const stop = bootStore({ tourDelay: 0 });
    // wrap rather than jest.spyOn: the async-storage mock's own jest.fn does not survive a restore,
    // and a broken setItem would silently break every test after this one
    const original = AsyncStorage.setItem;
    let writes = 0;
    (AsyncStorage as unknown as Record<string, unknown>).setItem = (...args: unknown[]) => {
      writes++;
      return (original as unknown as (...a: unknown[]) => Promise<void>)(...args);
    };
    try {
      useStore.setState({ working: 235 });
      await drain();
      const afterChange = writes;
      expect(afterChange).toBeGreaterThan(0);
      // the rest tick writes `remaining`, which is not persisted: no new write
      for (let i = 0; i < 5; i++) useStore.setState({ remaining: 100 - i });
      await drain();
      expect(writes).toBe(afterChange);
    } finally {
      (AsyncStorage as unknown as Record<string, unknown>).setItem = original;
      stop();
    }
  });

  test('an undetermined system appearance is treated as light, not dark', () => {
    const spy = jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(null);
    const stop = bootStore({ tourDelay: 0 });
    try { expect(useStore.getState().systemDark).toBe(false); } finally { stop(); spy.mockRestore(); }
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
    await drain();
    await AsyncStorage.setItem(STORAGE_KEY, '{"state":{"units":"kg"');
    await useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0 });
    try {
      // settled at once (nothing to wait for) and the app is on its defaults, not stuck
      expect(isHydrationSettled()).toBe(true);
      expect(useStore.getState().units).toBe('lb');
    } finally { stop(); }
  });

  test('an unreadable read that lands AFTER boot settles the app at once, not on the timeout', async () => {
    await drain();
    await AsyncStorage.setItem(STORAGE_KEY, '{"state":{"units":"kg"');
    const pending = useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0 });
    try {
      await pending;
      expect(isHydrationSettled()).toBe(true);
    } finally { stop(); }
  });

  test('a rest that was paused before it started comes back paused with its full time', async () => {
    const t0 = 1_800_000_000_000;
    await seedStorage({ tourSeen: true, onboard: false, activeIdx: 2, restTotal: 90, restEndsAt: null, paused: true });
    await useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0, now: () => t0 });
    try {
      expect(useStore.getState().activeIdx).toBe(2);
      expect(useStore.getState().paused).toBe(true);
      expect(useStore.getState().remaining).toBe(90);
    } finally { stop(); }
  });

  test('a rest in progress survives a relaunch through its wall-clock end time', async () => {
    const t0 = 1_800_000_000_000;
    await seedStorage({ tourSeen: true, onboard: false, activeIdx: 1, restTotal: 180, restEndsAt: t0 + 61_400, paused: false });
    await useStore.persist.rehydrate();
    const stop = bootStore({ tourDelay: 0, now: () => t0 });
    try {
      expect(useStore.getState().activeIdx).toBe(1);
      expect(useStore.getState().remaining).toBe(61);
      // the saved end time is the truth: booting must not re-anchor it to the rounded remainder
      expect(useStore.getState().restEndsAt).toBe(t0 + 61_400);
    } finally { stop(); }
  });

  test('a rest that ended more than 30 minutes ago is dropped on relaunch', async () => {
    const t0 = 1_800_000_000_000;
    await seedStorage({ tourSeen: true, onboard: false, activeIdx: 1, restTotal: 180, restEndsAt: t0 - 3_600_000, paused: false });
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

  /** Flatten an rgba() token over an opaque background, the way the screen composites it. */
  const over = (rgba: string, bg: string) => {
    const m = rgba.match(/rgba?\(([^)]+)\)/);
    if (!m) return rgba;
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim());
    const back = bg.replace('#', '');
    const mix = (i: number, v: number) => Math.round(v * Number(a) + parseInt(back.slice(i, i + 2), 16) * (1 - Number(a)));
    return '#' + [mix(0, Number(r)), mix(2, Number(g)), mix(4, Number(b))].map((v) => v.toString(16).padStart(2, '0')).join('');
  };

  test.each(['dark', 'light'] as const)('%s theme: muted text reads at 4.5:1 or better on every surface it sits on', (theme) => {
    const l = fresh({ theme, systemDark: theme === 'dark' });
    const t = l.palette() as unknown as Record<string, string>;
    for (const fg of ['mut', 'mut2', 'mut3', 'mut4', 'mut5']) {
      for (const bg of ['bg', 'card', 'card2', 'card3', 'ctl2']) {
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test.each(['dark', 'light'] as const)('%s theme: tinted panels stay readable for every accent', (theme) => {
    const accents = fresh({}).accents();
    for (const a of accents) {
      const l = fresh({ theme, systemDark: theme === 'dark', accent: a.id });
      const t = l.palette() as unknown as Record<string, string>;
      // the rest panel's "ADD FOR NEXT" plate chips (accent text on an accent tint of the card)
      expect(ratio(t.accDeep, over(t.accA14, t.card2))).toBeGreaterThanOrEqual(4.5);
      // the ADJUSTED badge and the target-unreachable banner
      expect(ratio(t.warnTx, over(t.warnA22, t.card))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.warnTx2, over(t.warnA13, t.card))).toBeGreaterThanOrEqual(4.5);
      // "STRIP FOR NEXT" chips
      expect(ratio(t.dan3, over(t.dan2A14, t.card2))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('number fields', () => {
  test('each weight field carries its own keyboard Done bar', async () => {
    // The decimal pad has no return key, so the accessory bar is the only Done button — and one
    // nativeID can only serve one input, so a shared bar would reach just one of the two fields.
    useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);
    await render(<SafeAreaProvider initialMetrics={initialMetrics}><Root /></SafeAreaProvider>);
    expect(screen.getByLabelText('Bar weight')).toBeTruthy();
    expect(screen.getByLabelText('Working weight')).toBeTruthy();
    expect(screen.getByLabelText('Done editing Bar weight')).toBeTruthy();
    expect(screen.getByLabelText('Done editing Working weight')).toBeTruthy();
    await cleanup();
  });
});

describe('shipping configuration', () => {
  const app = require('../app.json').expo as { ios: { infoPlist: Record<string, unknown>; supportsTablet: boolean }; plugins: unknown[] };

  test('saved data is included in iPhone backups, so it survives a new phone', () => {
    // @react-native-async-storage/async-storage excludes its directory from backup BY DEFAULT
    // (ios/RNCAsyncStorage.mm: `if (isExcludedFromBackup == nil) isExcludedFromBackup = @YES`).
    // Without this key every workout, setting and plate rack is lost when restoring a new device.
    expect(app.ios.infoPlist.RCTAsyncStorageExcludeFromBackup).toBe(false);
  });

  test('the App Store export-compliance answer is declared', () => {
    expect(app.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });
});

describe('rest-end alert', () => {
  const audio = require('expo-audio');
  const notifs = require('expo-notifications');
  const restAlert = require('../src/platform/restAlert');
  const { _resetSoundForTests } = require('../src/platform/sound');

  beforeEach(async () => {
    jest.clearAllMocks();
    restAlert._resetForTests();
    _resetSoundForTests();
    _resetHydrationForTests();
    useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);
    await new Promise((r) => setTimeout(r, 20));
    await AsyncStorage.removeItem(STORAGE_KEY);
  });
  afterEach(() => { haptics.cancelTimerDone(); });

  test('the buzz is a pattern, not one pulse, and it stops on its own', () => {
    jest.useFakeTimers();
    try {
      const mod = require('expo-haptics');
      const notify = jest.spyOn(mod, 'notificationAsync').mockResolvedValue(undefined);
      const impact = jest.spyOn(mod, 'impactAsync').mockResolvedValue(undefined);
      haptics.timerDone();
      expect(notify).toHaveBeenCalledTimes(1);
      expect(impact).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(impact).toHaveBeenCalledTimes(6);
      jest.advanceTimersByTime(10000);
      expect(impact).toHaveBeenCalledTimes(6); // it never nags
      notify.mockRestore(); impact.mockRestore();
    } finally { jest.useRealTimers(); }
  });

  test('the chime plays over the user music and through the silent switch', () => {
    restAlert.fire(true);
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({
      playsInSilentMode: true,        // audible with the ring switch on silent
      interruptionMode: 'mixWithOthers', // never stops what they are listening to
      shouldPlayInBackground: false,
    }));
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(1);
  });

  test('the chime is silent when the user has turned it off', () => {
    restAlert.fire(false);
    expect(audio.__player.play).not.toHaveBeenCalled();
  });

  test('no lock-screen alert is scheduled until the user asks for one', async () => {
    const stop = bootStore({ tourDelay: 0 });
    try {
      storeLogic.tapSet(0);
      await new Promise((r) => setTimeout(r, 300));
      expect(notifs.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(notifs.requestPermissionsAsync).not.toHaveBeenCalled();
    } finally { stop(); }
  });

  test('switching the alert on asks once, then schedules it for the moment the rest ends', async () => {
    const t0 = 1_700_000_000_000;
    const stop = bootStore({ tourDelay: 0, now: () => t0 });
    try {
      storeLogic.renderVals().toggleRestNotify();
      await new Promise((r) => setTimeout(r, 50));
      expect(notifs.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(useStore.getState().restNotify).toBe(true);
      storeLogic.tapSet(0);
      await new Promise((r) => setTimeout(r, 400));
      const req = notifs.scheduleNotificationAsync.mock.calls.at(-1)[0];
      expect(req.identifier).toBe('plateiq.rest-end');
      expect(req.trigger.date.getTime()).toBe(useStore.getState().restEndsAt);
      expect(req.content.title).toBeTruthy();
    } finally { stop(); }
  });

  test('declining the permission turns the switch back off instead of lying', async () => {
    notifs.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: 'undetermined' });
    notifs.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    const stop = bootStore({ tourDelay: 0 });
    try {
      storeLogic.renderVals().toggleRestNotify();
      await new Promise((r) => setTimeout(r, 60));
      expect(useStore.getState().restNotify).toBe(false);
    } finally { stop(); }
  });

  test('finishing, skipping or pausing a rest takes the pending alert away', async () => {
    const stop = bootStore({ tourDelay: 0 });
    try {
      useStore.setState({ restNotify: true });
      await new Promise((r) => setTimeout(r, 60));
      storeLogic.tapSet(0);
      await new Promise((r) => setTimeout(r, 300));
      notifs.cancelScheduledNotificationAsync.mockClear();
      storeLogic.finishRest();
      await new Promise((r) => setTimeout(r, 300));
      expect(notifs.cancelScheduledNotificationAsync).toHaveBeenCalledWith('plateiq.rest-end');
    } finally { stop(); }
  });

  test('the guided tour never puts a demo rest on the lock screen', async () => {
    const stop = bootStore({ tourDelay: 0 });
    try {
      useStore.setState({ restNotify: true });
      await new Promise((r) => setTimeout(r, 60));
      notifs.scheduleNotificationAsync.mockClear();
      useStore.setState({ tour: 'play' });
      storeLogic.tapSet(1);
      await new Promise((r) => setTimeout(r, 400));
      expect(notifs.scheduleNotificationAsync).not.toHaveBeenCalled();
    } finally { useStore.setState({ tour: false }); stop(); }
  });
});

describe('guided tour spotlight', () => {
  const { tourHost, getTourFocus, clampSpot, tourView, _resetTourFocusForTests } = require('../src/ui/tour/tourUI');

  beforeEach(() => {
    _resetTourFocusForTests();
    tourView.w = 402; tourView.h = 874; tourView.top = 59; tourView.bottom = 34; tourView.reduceMotion = false;
  });

  test('the tour says which step it is on, and the count matches the chapters', () => {
    const l = fresh();
    l.tourHost = { press: () => false, scrollTo: () => undefined, setProgress: () => undefined };
    expect(l.renderVals().tourSteps).toBe(0); // nothing before the first tour
    l.startTour('settings');
    const total = l.renderVals().tourSteps;
    expect(total).toBe(7);
    expect(l.renderVals().tourStep).toBe(1); // the welcome card is step 1
    // walking the frames advances the counter exactly once per chapter
    const seen: number[] = [];
    const frames = (l as unknown as { _tourFrames: Array<{ stop?: string; run?: () => void }> })._tourFrames;
    const idx = () => (l as unknown as { _tourIdx: number })._tourIdx;
    while (idx() < frames.length) {
      const f = frames[idx()];
      if (f.run) f.run();
      (l as unknown as { _tourIdx: number })._tourIdx++;
      if (f.stop) seen.push(l.renderVals().tourStep);
    }
    expect(seen).toEqual([2, 3, 4, 5, 6, 7]);
    l.endTour(true);
  });

  test('a target that never mounts leaves the screen plainly dark rather than lighting nothing', () => {
    jest.useFakeTimers();
    try {
      tourHost.focus('not-a-real-anchor');
      jest.advanceTimersByTime(600);
      expect(getTourFocus().frame).toBeNull();
    } finally { jest.useRealTimers(); }
  });

  test('a target taller than the screen is trimmed to the part you can actually see', () => {
    const tall = clampSpot({ x: 18, y: -200, w: 366, h: 1400 }, tourView);
    expect(tall).not.toBeNull();
    expect(tall.y).toBe(tourView.top + 4); // never under the status bar
    expect(tall.y + tall.h).toBe(tourView.h - tourView.bottom - 4); // never under the home indicator
    expect(tall.x).toBeGreaterThanOrEqual(4);
    // and a target scrolled fully off screen lights nothing at all
    expect(clampSpot({ x: 18, y: 2000, w: 366, h: 60 }, tourView)).toBeNull();
  });

  test('the whole tour is shorter than it was, and still stops on every chapter', () => {
    const l = fresh();
    const frames = l.tourScript();
    expect(frames.length).toBe(19);
    expect(frames[frames.length - 1].t).toBeLessThan(21); // was 30.4 s
    expect(frames.filter((f) => f.stop).length).toBe(7);
    for (let i = 1; i < frames.length; i++) expect(frames[i].t).toBeGreaterThan(frames[i - 1].t);
  });
});
