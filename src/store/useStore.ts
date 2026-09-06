// The single store (README "State management"). zustand holds the AppState; the ported logic class
// owns every reducer and reads/writes the store through a synchronous StateHost, so the reducers
// behave exactly as they do under the harness's plain-object host.

import { AppState as RNAppState, Appearance, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { useMemo } from 'react';
import { INITIAL_STATE, PlateIQLogic } from '../logic/PlateIQLogic';
import type { AppState, StatePatch } from '../logic/types';
import { haptics } from '../platform/haptics';
import * as restAlert from '../platform/restAlert';
import * as notify from '../platform/notify';

/** Keys that survive a relaunch: settings, rack, session queue, workout plan + logs, history, flow flags, and a running rest. */
export const PERSISTED_KEYS: Array<keyof AppState> = [
  // settings
  'units', 'roundTo', 'theme', 'accent', 'homeGym', 'qty', 'comp', 'collarId', 'minChanges', 'autoRest',
  'anchorType', 'barProfile', 'bar', 'dbHandle', 'dbPair', 'mode',
  'restSound', 'restNotify',
  // workout plan + progress
  'working', 'dbTotal', 'lmTarget', 'warmups', 'scheme', 'doneIdx', 'log', 'allDone', 'rmW', 'rmR', 'rmRpe',
  // the rest in progress: iOS may terminate a suspended app between sets; the wall-clock end time
  // lets the countdown pick up where it was (`remaining` is recomputed from it on relaunch)
  'activeIdx', 'restTotal', 'restEndsAt', 'paused',
  // session queue
  'session', 'sessionDone', 'exercise',
  // history
  'records', 'sessionsLogged',
  // flow
  'onboard', 'onboardStep', 'tourSeen', 'tourSnap',
];

/** A rest whose end time is this far in the past is not resumed after a relaunch. */
export const REST_RESUME_LIMIT_MS = 30 * 60 * 1000;

export const partialize = (s: AppState): StatePatch => {
  const out: Record<string, unknown> = {};
  PERSISTED_KEYS.forEach((k) => { out[k] = s[k]; });
  return out as StatePatch;
};

export const STORAGE_KEY = 'plateiq.v1';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const arrayOk: Partial<Record<keyof AppState, (item: unknown) => boolean>> = {
  doneIdx: (x) => isNum(x),
  session: (x) => typeof x === 'string',
  sessionDone: (x) => typeof x === 'string',
  records: (x) => isObj(x) && Array.isArray(x.sets) && x.sets.every((s) => isObj(s) && isNum(s.w) && isNum(s.r))
    && typeof x.exercise === 'string' && isNum(x.at) && typeof x.id === 'string'
    && ['barbell', 'dumbbell', 'landmine'].indexOf(x.mode as string) >= 0 && ['lb', 'kg'].indexOf(x.units as string) >= 0,
  warmups: (x) => isObj(x) && typeof x.id === 'string' && isNum(x.pct) && isNum(x.reps) && isNum(x.rest),
};
/** Values that must be one of a fixed set — a renamed id from another build must not stick. */
const enumOk: Partial<Record<keyof AppState, ReadonlyArray<unknown>>> = {
  units: ['lb', 'kg'],
  mode: ['barbell', 'dumbbell', 'landmine'],
  anchorType: ['rack', 'hinge', 'sleeve'],
  collarId: ['none', 'clip', 'comp'],
  scheme: ['single', 'straight', 'backoff', 'reverse', 'drop', 'cluster', 'amrap'],
  roundTo: [0.25, 0.5, 1.25, 2.5],
  theme: ['light', 'dark', 'system'],
};
/** Keys whose default is null, so `typeof` cannot describe what else they may hold. */
const nullableOk: Partial<Record<keyof AppState, (v: unknown) => boolean>> = {
  onboard: (v) => v === null || typeof v === 'boolean',
  tourSnap: (v) => v === null || isObj(v),
  restEndsAt: (v) => v === null || isNum(v),
  activeIdx: (v) => v === null || (isNum(v) && Number.isInteger(v) && v >= 0),
  undo: (v) => v === null,
};

/**
 * Only accept persisted values whose shape matches the default. Storage is written by this app,
 * but a truncated write, a hand-edited backup or a future build must never hand the solver a
 * string target or a null history — a bad key falls back to its default, the rest is kept.
 */
export function sanitizePersisted(persisted: unknown): StatePatch {
  const out: Record<string, unknown> = {};
  if (!isObj(persisted)) return out as StatePatch;
  const base = INITIAL_STATE as unknown as Record<string, unknown>;
  PERSISTED_KEYS.forEach((k) => {
    if (!(k in persisted)) return;
    const v = persisted[k], d = base[k];
    const allowed = enumOk[k];
    if (allowed) { if (allowed.indexOf(v) >= 0) out[k] = v; return; }
    let ok: boolean;
    if (Array.isArray(d)) {
      const each = arrayOk[k];
      // one bad row must not cost the user the whole list (a history of 40 sessions, say)
      if (Array.isArray(v)) { out[k] = each ? v.filter(each) : v; }
      return;
    } else if (d === null) {
      const nk = nullableOk[k];
      ok = nk ? nk(v) : v === null;
    } else if (typeof d === 'number') ok = isNum(v);
    else if (typeof d === 'boolean') ok = typeof v === 'boolean';
    else if (typeof d === 'string') ok = typeof v === 'string';
    else if (isObj(d)) ok = isObj(v);
    else ok = true;
    if (ok) out[k] = v;
  });
  return out as StatePatch;
}

let hydrationFailed = false;
/** Set by bootStore so a hydration error settles the app immediately, not on the 4 s fallback. */
let onHydrationError: (() => void) | null = null;
let lastWritten: Record<string, unknown> | null = null;

/**
 * AsyncStorage adapter with change detection: zustand's persist middleware calls setItem after
 * EVERY store write, including the 1 s rest tick and each typed character, so it only serialises
 * and writes when a persisted key actually changed.
 */
const storage: PersistStorage<AppState> = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name);
    if (raw === null || raw === undefined) return null;
    return JSON.parse(raw) as StorageValue<AppState>;
  },
  setItem: async (name, value) => {
    const next = (value && value.state ? value.state : {}) as unknown as Record<string, unknown>;
    if (lastWritten && PERSISTED_KEYS.every((k) => Object.is(lastWritten![k], next[k]))) return;
    lastWritten = { ...next };
    try {
      await AsyncStorage.setItem(name, JSON.stringify(value));
      // a write that recovers clears the warning; guarded so this cannot loop through persist
      if (useStore.getState().saveFailed) useStore.setState({ saveFailed: false });
    } catch (e) {
      lastWritten = null; // retry on the next change
      // A console warning reaches nobody on a real phone. Out of disk space, the user would
      // otherwise log a whole workout that is not being written anywhere and never be told.
      if (!useStore.getState().saveFailed) useStore.setState({ saveFailed: true });
      console.warn('PlateIQ: could not save', e);
    }
  },
  removeItem: (name) => AsyncStorage.removeItem(name),
};

export const useStore = create<AppState>()(
  persist(() => ({ ...INITIAL_STATE }), {
    name: STORAGE_KEY,
    version: 1,
    storage,
    partialize: (s) => partialize(s) as AppState,
    // zustand's shallow merge keeps every transient key at its initial value
    merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    onRehydrateStorage: () => (_state, error) => {
      if (error) {
        // unreadable storage must not leave the app stuck behind a half-mounted tour overlay
        hydrationFailed = true;
        console.warn('PlateIQ: saved data could not be read — starting fresh', error);
        if (onHydrationError) onHydrationError();
      }
    },
  }),
);

export const logic = new PlateIQLogic(
  {
    get: () => useStore.getState(),
    // a patch that changes nothing (the tick at 0:00, an unchanged draft) must not wake every
    // subscriber and rewrite storage — zustand would still allocate a new state object for it
    set: (patch) => {
      const s = useStore.getState() as unknown as Record<string, unknown>;
      const p = patch as Record<string, unknown>;
      for (const k in p) if (!Object.is(s[k], p[k])) { useStore.setState(patch); return; }
    },
  },
  { startOnOnboarding: true, plateStyle: 'dimensional' },
);

// dev-only handle for driving the web preview / simulator from the console or automation
declare const __DEV__: boolean;
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof globalThis !== 'undefined') {
  (globalThis as unknown as { plateiq?: unknown }).plateiq = { useStore, logic };
}

type View = ReturnType<PlateIQLogic['renderVals']>;
// one view model per state object: Root and MainScreen both call useView(), and renderVals runs
// the plate solver for every set, so the second call for the same state must be free
const viewCache = new WeakMap<AppState, View>();

/** View model for screens — computed once per state object. */
export function useView(): View {
  const state = useStore();
  let v = viewCache.get(state);
  if (!v) { v = logic.renderVals(); viewCache.set(state, v); }
  return v;
}

export function useTokens() {
  const theme = useStore((s) => s.theme);
  const systemDark = useStore((s) => s.systemDark);
  const accent = useStore((s) => s.accent);
  return useMemo(() => logic.palette(), [theme, systemDark, accent]);
}

// ---- hydration ------------------------------------------------------------------------------

let settled = false;
const settledListeners: Array<() => void> = [];
/** True once the saved state has been applied (or could not be read and defaults are in use). */
export function isHydrationSettled() { return settled; }
/** Subscribe to the moment the store is ready to render; returns an unsubscribe. */
export function onHydrationSettled(cb: () => void): () => void {
  if (settled) { cb(); return () => undefined; }
  settledListeners.push(cb);
  return () => { const i = settledListeners.indexOf(cb); if (i >= 0) settledListeners.splice(i, 1); };
}
/** Test hook: forget that hydration settled (a fresh boot in the same process). */
export function _resetHydrationForTests() { settled = false; hydrationFailed = false; lastWritten = null; settledListeners.splice(0); }

let booted: (() => void) | null = null;

/**
 * Wire the store to the platform: 1 s tick, wall-clock rest timer, haptic at zero, system theme,
 * reduced motion, tour-snapshot recovery, a rest carried over a relaunch, and the first-launch
 * tour decision. Returns a cleanup.
 */
export function bootStore(opts: { tourDelay?: number; now?: () => number } = {}): () => void {
  if (booted) return booted;
  const now = opts.now || (() => Date.now());
  let settling = true;

  restAlert.installHandler();

  /** Arm or disarm the lock-screen alert from whatever the rest currently is. */
  const syncRestAlert = () => {
    const s = useStore.getState();
    // the guided tour drives a real tapSet: its demo rest must never reach the lock screen
    if (s.tour === 'play') { void restAlert.disarm(); return; }
    const live = s.activeIdx !== null && !s.paused && s.restEndsAt !== null && s.restEndsAt > now();
    if (live) restAlert.arm(s.restEndsAt as number, now(), { sound: s.restSound, notify: s.restNotify });
    else void restAlert.disarm();
  };

  const finishHydration = () => {
    if (settled) return;
    const s = useStore.getState();
    // killed mid-tour: put the user's real workout back before anything renders
    if (s.tourSnap) {
      const { tourFrom: _from, ...snap } = s.tourSnap as StatePatch & { tourFrom?: string };
      useStore.setState({ ...snap, tourSnap: null, tour: 'auto', activeIdx: null, restEndsAt: null, paused: false });
    }
    // a rest that was running when the app died: resume from its wall-clock end time, or drop it
    const s1 = useStore.getState();
    if (s1.activeIdx !== null) {
      if (s1.restEndsAt !== null && now() - s1.restEndsAt > REST_RESUME_LIMIT_MS) {
        useStore.setState({ activeIdx: null, remaining: 0, restEndsAt: null, paused: false });
      } else if (s1.restEndsAt !== null) {
        useStore.setState({ remaining: Math.max(0, Math.round((s1.restEndsAt - now()) / 1000)) });
      } else {
        // paused before it started counting (auto-start off): the full rest is still ahead
        useStore.setState({ remaining: s1.restTotal, paused: true });
      }
    }
    // the bar field's draft always mirrors the implement in hand after a relaunch
    const s2 = useStore.getState();
    useStore.setState({ barDraft: String(s2.mode === 'dumbbell' ? s2.dbHandle : s2.bar), workDraft: null });
    settling = false;
    settled = true;
    // iOS keeps scheduled notifications across a force-quit; clear them, then re-arm from the rest
    // that was just restored, if there was one.
    void restAlert.bootCleanup().then(syncRestAlert);
    logic.mount(opts.tourDelay ?? 500);
    settledListeners.splice(0).forEach((cb) => cb());
  };
  onHydrationError = finishHydration;
  if (useStore.persist.hasHydrated() || hydrationFailed) finishHydration();
  const offHydrate = useStore.persist.onFinishHydration(finishHydration);
  // hydration that neither completes nor reports an error (storage hangs) must not block the app
  const fallback = setTimeout(() => { if (!settled) { console.warn('PlateIQ: storage did not answer — starting with defaults'); finishHydration(); } }, 4000);

  const interval = setInterval(() => logic.tick(now()), 1000);

  // any user action that sets `remaining` (start, ±15/+30, unpause) re-anchors the wall clock;
  // the tick itself never does, or the clock would drift by a frame every second. While the saved
  // state is being applied nothing is a user action — the persisted end time must survive it.
  const unsub = useStore.subscribe((s, prev) => {
    const restChanged = s.remaining !== prev.remaining || s.paused !== prev.paused || s.activeIdx !== prev.activeIdx;
    if (restChanged && !logic._ticking && !settling) logic.syncClock(now());
    if (s.activeIdx !== null && s.remaining === 0 && prev.remaining > 0 && prev.activeIdx === s.activeIdx) {
      // the rest ended while the phone was locked: a buzz now would read as "rest just ended"
      const late = s.restEndsAt !== null && now() - s.restEndsAt > 2500;
      if (!late) restAlert.fire(s.restSound);
    }
  });

  // Watches the rest itself, and the moment the user switches the lock-screen alert on.
  const unsubAlert = useStore.subscribe((s, prev) => {
    if (settling) return;
    if (s.restNotify && !prev.restNotify) {
      // the switch just went on: ask once, here, never on launch
      void notify.ensurePermission().then((r) => {
        if (r === 'granted') { useStore.setState({ notifyBlocked: false }); syncRestAlert(); return; }
        // the switch flips itself back — and now says why, when iOS will not ask again
        useStore.setState({ restNotify: false, notifyBlocked: r === 'blocked' });
      });
      return;
    }
    const changed = s.activeIdx !== prev.activeIdx || s.restEndsAt !== prev.restEndsAt
      || s.paused !== prev.paused || s.restNotify !== prev.restNotify || s.tour !== prev.tour;
    if (changed) syncRestAlert();
  });

  // Permission can be revoked in iOS Settings between launches. Without this the switch keeps
  // reading ON, keeps scheduling an alert that will never appear, and says nothing.
  const recheckNotify = () => {
    if (!useStore.getState().restNotify) return;
    void notify.currentPermission().then((r) => {
      if (r === 'granted' || r === 'unavailable') return;
      useStore.setState({ restNotify: false, notifyBlocked: r === 'blocked' });
    });
  };
  recheckNotify();

  const appSub = RNAppState.addEventListener('change', (st) => {
    if (st === 'active') { logic.tick(now()); recheckNotify(); }
  });

  const applyScheme = () => useStore.setState({ systemDark: Appearance.getColorScheme() === 'dark' });
  applyScheme();
  const schemeSub = Appearance.addChangeListener(applyScheme);

  AccessibilityInfo.isReduceMotionEnabled().then((v) => useStore.setState({ reduceMotion: !!v })).catch(() => undefined);
  AccessibilityInfo.isScreenReaderEnabled().then((v) => useStore.setState({ screenReader: !!v })).catch(() => undefined);
  const srSub = AccessibilityInfo.addEventListener('screenReaderChanged', (v) => useStore.setState({ screenReader: !!v }));
  const rmSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => useStore.setState({ reduceMotion: !!v }));

  booted = () => {
    onHydrationError = null;
    clearInterval(interval);
    clearTimeout(fallback);
    unsub();
    unsubAlert();
    restAlert.teardown();
    offHydrate();
    appSub.remove();
    schemeSub.remove();
    rmSub.remove();
    srSub.remove();
    logic.unmount();
    booted = null;
    settled = false; // a later boot (tests, hot reload) settles again
  };
  return booted;
}
