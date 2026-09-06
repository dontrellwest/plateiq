// Thin wrapper so the store never depends on a native module being present (tests, web).
type HapticsModule = {
  notificationAsync?: (type: string) => Promise<void>;
  impactAsync?: (style: string) => Promise<void>;
  selectionAsync?: () => Promise<void>;
  NotificationFeedbackType?: Record<string, string>;
  ImpactFeedbackStyle?: Record<string, string>;
};

let mod: HapticsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-haptics') as HapticsModule;
} catch {
  mod = null;
}

const quiet = (p?: Promise<void>) => { if (p) p.catch(() => undefined); };

let restTimers: Array<ReturnType<typeof setTimeout>> = [];
const impact = (style: string) => quiet(mod?.impactAsync?.(style));
const heavy = () => impact(mod?.ImpactFeedbackStyle?.Heavy || 'heavy');
const rigid = () => impact(mod?.ImpactFeedbackStyle?.Rigid || 'rigid');

// One `Success` da-dum is easy to miss through clothing. This adds two three-pulse bursts after
// it, the ring-then-ring-again cadence of an incoming call, which is the shape people notice in a
// pocket. It lasts 1.4 s and then stops for good, so it can never nag.
// Spacing stays at or above 110 ms because the Taptic Engine coalesces anything tighter.
const REST_END_BURSTS: Array<[number, () => void]> = [
  [550, heavy], [670, heavy], [790, rigid],
  [1150, heavy], [1270, heavy], [1390, rigid],
];

export const haptics = {
  /** Rest timer reached zero. */
  timerDone() {
    haptics.cancelTimerDone();
    quiet(mod?.notificationAsync?.(mod?.NotificationFeedbackType?.Success || 'success'));
    REST_END_BURSTS.forEach(([ms, run]) => { restTimers.push(setTimeout(run, ms)); });
  },
  /** Stop the pattern early (the app is shutting down, or a new rest started). */
  cancelTimerDone() { restTimers.forEach(clearTimeout); restTimers = []; },
  /** A set was logged. */
  logged() { impact(mod?.ImpactFeedbackStyle?.Medium || 'medium'); },
  /** Stepper / segment selection. */
  tick() { quiet(mod?.selectionAsync?.()); },
};
