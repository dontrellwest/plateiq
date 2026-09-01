// Store binding + README invariants:
//  - the zustand-backed logic survives the same phase-B fuzz as the headless host
//  - every input that changes what the ladder prescribes resets progress via progressReset()
//  - an unchanged bar-weight blur must NOT reset
//  - undo restores exactly the keys its action touched
//  - persistence keeps settings / rack / session queue / logs / tour-seen and nothing transient
//  - the rest timer follows the wall clock and the tour plays once

import * as fs from 'fs';
import * as path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_STATE, PlateIQLogic } from '../src/logic/PlateIQLogic';
import type { AppState } from '../src/logic/types';
import { PERSISTED_KEYS, STORAGE_KEY, bootStore, logic, partialize, useStore } from '../src/store/useStore';
import { checkState, phaseB, report, resetResults } from '../qa/harness';

(globalThis as unknown as { requestAnimationFrame: () => number }).requestAnimationFrame = () => 0;
(globalThis as unknown as { cancelAnimationFrame: () => void }).cancelAnimationFrame = () => {};

const resetStore = () => useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);

/** Put the ladder in a "some progress" state: set 0 rested + logged, set 1 resting. */
function progress() {
  logic.tapSet(0);
  logic.finishRest();
  logic.tapSet(1);
  const s = useStore.getState();
  expect(s.doneIdx).toEqual([0]);
  expect(s.activeIdx).toBe(1);
  expect(Object.keys(s.log)).toEqual(['0']);
}
const cleared = () => {
  const s = useStore.getState();
  return s.activeIdx === null && s.doneIdx.length === 0 && s.allDone === false && Object.keys(s.log).length === 0;
};

beforeEach(() => { resetStore(); });

describe('zustand-backed logic', () => {
  test('phase B fuzz passes against the real store (100 users)', () => {
    resetResults();
    const make = () => { resetStore(); useStore.setState({ tour: 'auto' }); return logic; };
    phaseB(100, make);
    expect(report()).toBe('');
  }, 600000);

  test('reducers read their own writes synchronously (setUnits keeps a named bar at spec weight)', () => {
    logic.pickBarProfile(logic.barProfiles().find((b) => b.id === 'womens')!);
    logic.setUnits('kg');
    expect(useStore.getState().bar).toBe(15);
    expect(useStore.getState().barDraft).toBe('15');
  });
});

describe('progressReset invariant', () => {
  const cases: Array<[string, () => void]> = [
    ['setMode', () => logic.setMode('dumbbell')],
    ['setUnits', () => logic.setUnits('kg')],
    ['pickBarProfile', () => logic.pickBarProfile(logic.barProfiles()[3])],
    ['setBarWeight', () => logic.setBarWeight(55)],
    ['commitBarWeight (changed)', () => { useStore.setState({ barDraft: '33' }); logic.commitBarWeight(); }],
    ['commitWorking (changed)', () => { useStore.setState({ workDraft: '235' }); logic.commitWorking(); }],
    ['incWorking stepper', () => logic.renderVals().incWorking()],
    ['decWorking stepper', () => logic.renderVals().decWorking()],
    ['scheme pick', () => logic.renderVals().schemeOptions[2].pick()],
    ['competition toggle', () => logic.renderVals().toggleComp()],
    ['collar pick', () => logic.renderVals().collarOptions[2].pick()],
    ['dumbbell pair', () => { logic.setMode('dumbbell'); progress(); logic.renderVals().dbOptions[1].pick(); }],
    ['home-gym toggle', () => logic.renderVals().toggleHome()],
    ['gym option', () => logic.renderVals().gymOptions[1].pick()],
    ['plate qty inc', () => logic.renderVals().rackRows[0].inc()],
    ['plate qty dec', () => logic.renderVals().rackRows[0].dec()],
    ['rounding step', () => logic.renderVals().roundOptions[3].pick()],
    ['anchor type', () => { logic.setMode('landmine'); progress(); logic.renderVals().anchorOptions[0].pick(); }],
    ['fewest-changes toggle', () => logic.renderVals().toggleMinChanges()],
    ['warm-up pct', () => logic.setPct('w0', 5)],
    ['addSet', () => logic.addSet()],
    ['removeSet', () => logic.removeSet('w0')],
    ['pickExercise', () => logic.pickExercise({ name: 'Back squat', mode: 'barbell', last: '315 × 3' })],
    ['dumbbell handle pick', () => { logic.setMode('dumbbell'); progress(); logic.renderVals().handleOptions[2].pick(); }],
    ['alternative chip', () => { useStore.setState({ homeGym: true, qty: { 45: 2 }, working: 140 }); progress(); expect(logic.renderVals().altChips.length).toBeGreaterThan(0); logic.renderVals().altChips[0].pick(); }],
    ['reverse reader apply', () => { logic.renderVals().revButtons[0].add(); logic.renderVals().revApply(); }],
    ['1RM table row', () => logic.renderVals().pctRows[0].pick()],
  ];
  cases.forEach(([name, act]) => {
    test(name + ' resets progress', () => {
      progress();
      act();
      expect(cleared()).toBe(true);
    });
  });

  test('an unchanged bar-weight blur does NOT reset', () => {
    progress();
    useStore.setState({ barDraft: '45' });
    logic.commitBarWeight();
    expect(useStore.getState().doneIdx).toEqual([0]);
    expect(useStore.getState().activeIdx).toBe(1);
    useStore.setState({ barDraft: '  45 ' });
    logic.commitBarWeight();
    expect(useStore.getState().doneIdx).toEqual([0]);
    useStore.setState({ barDraft: 'abc' }); // garbage falls back to the current bar → unchanged
    logic.commitBarWeight();
    expect(useStore.getState().doneIdx).toEqual([0]);
    expect(useStore.getState().barDraft).toBe('45');
  });

  test('an unchanged typed target does NOT reset', () => {
    progress();
    useStore.setState({ workDraft: '225' });
    logic.commitWorking();
    expect(useStore.getState().doneIdx).toEqual([0]);
  });

  test('reps, rest cadence, theme, accent, search, and selecting the same option do NOT reset', () => {
    progress();
    logic.setReps('w0', 1);
    logic.cycleRest('w0');
    const v = logic.renderVals();
    v.themeOptions[0].pick();
    v.accentSwatches[3].pick();
    v.onSearch('press');
    v.roundOptions[0].pick(); // already 0.25
    v.gymOptions[0].pick(); // already commercial
    expect(useStore.getState().doneIdx).toEqual([0]);
    expect(useStore.getState().activeIdx).toBe(1);
  });

  test('every progress wipe in the logic source goes through progressReset()', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'logic', 'PlateIQLogic.ts'), 'utf8');
    // the literal appears in INITIAL_STATE, progressReset itself, advanceSession (finishing, not
    // re-planning) and the completion modal Discard — never in an input handler
    const literal = src.match(/doneIdx: \[\]/g) || [];
    expect(literal.length).toBe(4);
    expect((src.match(/this\.progressReset\(\)/g) || []).length).toBeGreaterThan(25);
  });

  test('doneIdx stays deduplicated and finishRest is a no-op with nothing active', () => {
    logic.finishRest();
    expect(useStore.getState().doneIdx).toEqual([]);
    logic.tapSet(0); logic.tapSet(0); // start then tap again → logged
    logic.tapSet(0); logic.finishRest(); // rest it again → still one entry
    expect(useStore.getState().doneIdx).toEqual([0]);
  });
});

describe('undo', () => {
  test('restores exactly the keys the action touched, including seeded targets on session advance', () => {
    useStore.setState({ working: 245 });
    logic.tapSet(1); logic.finishRest();
    logic.advanceSession(); // → Overhead press, seeded from its last top set
    const s1 = useStore.getState();
    expect(s1.exercise).toBe('Overhead press');
    expect(s1.working).toBe(135);
    expect(s1.sessionDone).toEqual(['Bench press']);
    logic.applyUndo();
    const s2 = useStore.getState();
    expect(s2.exercise).toBe('Bench press');
    expect(s2.working).toBe(245);
    expect(s2.sessionDone).toEqual([]);
    expect(s2.doneIdx).toEqual([1]);
    expect(s2.undo).toBeNull();
  });

  test('starting a rest clears the toast; the toast expires after 7 s', () => {
    logic.tapSet(0); logic.finishRest();
    expect(useStore.getState().undo).not.toBeNull();
    logic.tapSet(1);
    expect(useStore.getState().undo).toBeNull();
    logic.finishRest();
    expect(useStore.getState().undo).not.toBeNull();
    logic.tick(Date.now() + 7001);
    expect(useStore.getState().undo).toBeNull();
  });
});

describe('persistence', () => {
  test('partialize keeps settings, rack, queue, plan, logs and flow flags — nothing transient', () => {
    const keys = Object.keys(partialize(INITIAL_STATE)).sort();
    expect(keys).toEqual([...PERSISTED_KEYS].sort());
    const transient: Array<keyof AppState> = ['activeIdx', 'remaining', 'restTotal', 'restEndsAt', 'sheet', 'screen', 'search',
      'workDraft', 'undo', 'undoAt', 'logIdx', 'trendEx', 'tour', 'tourPaused', 'tourWait', 'tourCap', 'tourCard', 'tourKey',
      'tourNote', 'systemDark', 'paused', 'expanded', 'revSide', 'reduceMotion'];
    transient.forEach((k) => expect(keys).not.toContain(k));
    (['units', 'qty', 'session', 'records', 'tourSeen', 'warmups', 'log', 'doneIdx'] as const).forEach((k) => expect(keys).toContain(k));
  });

  test('a saved state rehydrates over the defaults', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: { units: 'kg', qty: { 25: 4 }, session: ['Deadlift'], exercise: 'Deadlift', tourSeen: true, records: [], sessionsLogged: 2 },
      version: 1,
    }));
    await useStore.persist.rehydrate();
    const s = useStore.getState();
    expect(s.units).toBe('kg');
    expect(s.qty[25]).toBe(4);
    expect(s.session).toEqual(['Deadlift']);
    expect(s.tourSeen).toBe(true);
    expect(s.sheet).toBe(false); // transient keys keep their defaults
    expect(s.working).toBe(225);
  });
});

describe('boot', () => {
  afterEach(async () => { bootStore()(); await AsyncStorage.clear(); });

  test('first launch plays the tour from onboarding after layout; later launches only show setup', async () => {
    jest.useFakeTimers();
    resetStore();
    useStore.setState({ onboard: null, tour: 'auto', tourSeen: false });
    bootStore({ tourDelay: 500 });
    jest.advanceTimersByTime(600);
    expect(useStore.getState().tour).toBe('play');
    expect(logic.renderVals().onboard).toBe(false); // overlay hidden while playing
    logic.endTour(true);
    const s = useStore.getState();
    expect(s.tour).toBe(false);
    expect(s.tourSeen).toBe(true);
    expect(s.onboard).toBe(true);
    expect(s.tourNote).toBe(false);
    expect(logic.renderVals().onboard).toBe(true);
    bootStore()();
    // second launch: tour seen → no tour, straight to setup
    useStore.setState({ tour: 'auto', onboard: true });
    bootStore({ tourDelay: 500 });
    jest.advanceTimersByTime(600);
    expect(useStore.getState().tour).toBe(false);
    expect(logic.renderVals().onboard).toBe(true);
    jest.useRealTimers();
  });

  test('skip ends the animation only and shows the rewatch note', () => {
    logic.startTour('onboard');
    logic.endTour(false);
    const s = useStore.getState();
    expect(s.onboard).toBe(true);
    expect(s.tourNote).toBe(true);
    expect(s.tourSeen).toBe(true);
  });

  test('a kill mid-tour restores the real workout from the persisted snapshot', () => {
    useStore.setState({ working: 305, mode: 'landmine', doneIdx: [0], log: { 0: { w: 45, r: 15, planW: 45, planR: 15 } } });
    logic.startTour('settings');
    const persisted = partialize(useStore.getState());
    expect(persisted.tourSnap).toBeTruthy();
    expect(persisted.working).toBe(225); // demo state was written
    // simulate relaunch: transient keys reset, persisted keys restored
    useStore.setState({ ...INITIAL_STATE, ...persisted, tour: 'auto' } as AppState, true);
    bootStore({ tourDelay: 0 });
    const s = useStore.getState();
    expect(s.working).toBe(305);
    expect(s.mode).toBe('landmine');
    expect(s.doneIdx).toEqual([0]);
    expect(s.tourSnap).toBeNull();
  });

  test('rest timer follows the wall clock and fires the haptic once at zero', () => {
    let t = 1000000;
    bootStore({ now: () => t });
    logic.tapSet(0); // 60 s rest
    expect(useStore.getState().restEndsAt).toBe(t + 60000);
    t += 20000; logic.tick(t);
    expect(useStore.getState().remaining).toBe(40);
    logic.bumpRest(30); // re-anchors
    expect(useStore.getState().restEndsAt).toBe(t + 70000);
    t += 100000; logic.tick(t); // backgrounded past the end
    expect(useStore.getState().remaining).toBe(0);
    logic.finishRest();
    expect(useStore.getState().restEndsAt).toBeNull();
  });

  test('auto-start off: the panel opens paused and the clock is anchored on Start', () => {
    let t = 5000000;
    bootStore({ now: () => t });
    useStore.setState({ autoRest: false });
    logic.tapSet(0);
    expect(useStore.getState().paused).toBe(true);
    expect(useStore.getState().restEndsAt).toBeNull();
    t += 30000; logic.tick(t);
    expect(useStore.getState().remaining).toBe(60); // paused: no countdown
    logic.renderVals().timer.onCta!(); // Start rest
    expect(useStore.getState().restEndsAt).toBe(t + 60000);
  });
});

describe('headless host parity', () => {
  test('the memory host and the store host agree after the same action sequence', () => {
    const mem = new PlateIQLogic({ get: () => memState, set: (p) => Object.assign(memState, p) }, { startOnOnboarding: false });
    const memState: AppState = { ...INITIAL_STATE, onboard: false, tour: false };
    const seq = (l: PlateIQLogic) => {
      l.setMode('dumbbell'); l.setUnits('kg'); l.addSet(); l.tapSet(1); l.bumpRest(30); l.finishRest();
      l.pickExercise({ name: 'Deadlift', mode: 'barbell', last: '365 × 3' }); l.addToSession('Back squat');
    };
    seq(mem); seq(logic);
    const strip = (s: AppState) => { const { undoAt: _u, warmups, restEndsAt: _r, ...rest } = s; return { ...rest, warmups: warmups.map((w) => ({ ...w, id: 'x' })) }; };
    expect(strip(useStore.getState())).toEqual(strip(memState));
    checkState(logic, 'parity');
    expect(report()).toBe('');
  });
});
