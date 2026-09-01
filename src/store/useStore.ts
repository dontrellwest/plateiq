// The single store (README "State management"). zustand holds the AppState; the ported logic class
// owns every reducer and reads/writes the store through a synchronous StateHost, so the reducers
// behave exactly as they do under the harness's plain-object host.

import { AppState as RNAppState, Appearance, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useMemo } from 'react';
import { INITIAL_STATE, PlateIQLogic } from '../logic/PlateIQLogic';
import type { AppState, StatePatch } from '../logic/types';
import { haptics } from '../platform/haptics';

/** Keys that survive a relaunch: settings, rack, session queue, workout plan + logs, history, flow flags. */
export const PERSISTED_KEYS: Array<keyof AppState> = [
  // settings
  'units', 'roundTo', 'theme', 'accent', 'homeGym', 'qty', 'comp', 'collarId', 'minChanges', 'autoRest',
  'anchorType', 'barProfile', 'bar', 'barDraft', 'dbHandle', 'dbPair', 'mode',
  // workout plan + progress
  'working', 'dbTotal', 'lmTarget', 'warmups', 'scheme', 'doneIdx', 'log', 'allDone', 'rmW', 'rmR', 'rmRpe',
  // session queue
  'session', 'sessionDone', 'exercise',
  // history
  'records', 'sessionsLogged',
  // flow
  'onboard', 'onboardStep', 'tourSeen', 'tourSnap',
];

export const partialize = (s: AppState): StatePatch => {
  const out: Record<string, unknown> = {};
  PERSISTED_KEYS.forEach((k) => { out[k] = s[k]; });
  return out as StatePatch;
};

export const STORAGE_KEY = 'plateiq.v1';

export const useStore = create<AppState>()(
  persist(() => ({ ...INITIAL_STATE }), {
    name: STORAGE_KEY,
    version: 1,
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => partialize(s) as AppState,
    // zustand's shallow merge keeps every transient key at its initial value
    merge: (persisted, current) => ({ ...current, ...(persisted as StatePatch) }),
  }),
);

export const logic = new PlateIQLogic(
  { get: () => useStore.getState(), set: (patch) => useStore.setState(patch) },
  { startOnOnboarding: true, plateStyle: 'dimensional' },
);

// dev-only handle for driving the web preview from the console / automation
declare const __DEV__: boolean;
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof globalThis !== 'undefined') {
  (globalThis as unknown as { plateiq?: unknown }).plateiq = { useStore, logic };
}

/** View model for screens — recomputed only when the state object changes. */
export function useView() {
  const state = useStore();
  // renderVals reads through the host; the dependency on `state` is what triggers recomputation
  return useMemo(() => logic.renderVals(), [state]);
}

export function useTokens() {
  const theme = useStore((s) => s.theme);
  const systemDark = useStore((s) => s.systemDark);
  const accent = useStore((s) => s.accent);
  return useMemo(() => logic.palette(), [theme, systemDark, accent]);
}

let booted: (() => void) | null = null;

/**
 * Wire the store to the platform: 1 s tick, wall-clock rest timer, haptic at zero, system theme,
 * reduced motion, tour-snapshot recovery, and the first-launch tour decision. Returns a cleanup.
 */
export function bootStore(opts: { tourDelay?: number; now?: () => number } = {}): () => void {
  if (booted) return booted;
  const now = opts.now || (() => Date.now());

  const finishHydration = () => {
    const s = useStore.getState();
    // killed mid-tour: put the user's real workout back before anything renders
    if (s.tourSnap) {
      const { tourFrom: _from, ...snap } = s.tourSnap as StatePatch & { tourFrom?: string };
      useStore.setState({ ...snap, tourSnap: null, tour: 'auto', activeIdx: null });
    }
    // the bar field's draft always mirrors the implement in hand after a relaunch
    const s2 = useStore.getState();
    useStore.setState({ barDraft: String(s2.mode === 'dumbbell' ? s2.dbHandle : s2.bar), workDraft: null });
    logic.mount(opts.tourDelay ?? 500);
  };
  if (useStore.persist.hasHydrated()) finishHydration();
  const offHydrate = useStore.persist.onFinishHydration(finishHydration);

  const interval = setInterval(() => logic.tick(now()), 1000);

  // any user action that sets `remaining` (start, ±15/+30, unpause) re-anchors the wall clock;
  // the tick itself never does, or the clock would drift by a frame every second
  const unsub = useStore.subscribe((s, prev) => {
    const restChanged = s.remaining !== prev.remaining || s.paused !== prev.paused || s.activeIdx !== prev.activeIdx;
    if (restChanged && !logic._ticking) logic.syncClock(now());
    if (s.activeIdx !== null && s.remaining === 0 && prev.remaining > 0 && prev.activeIdx === s.activeIdx) haptics.timerDone();
  });

  const appSub = RNAppState.addEventListener('change', (st) => { if (st === 'active') logic.tick(now()); });

  const applyScheme = () => useStore.setState({ systemDark: Appearance.getColorScheme() !== 'light' });
  applyScheme();
  const schemeSub = Appearance.addChangeListener(applyScheme);

  AccessibilityInfo.isReduceMotionEnabled().then((v) => useStore.setState({ reduceMotion: !!v })).catch(() => undefined);
  const rmSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => useStore.setState({ reduceMotion: !!v }));

  booted = () => {
    clearInterval(interval);
    unsub();
    offHydrate();
    appSub.remove();
    schemeSub.remove();
    rmSub.remove();
    logic.unmount();
    booted = null;
  };
  return booted;
}
