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

export const haptics = {
  /** Rest timer reached zero. */
  timerDone() { quiet(mod?.notificationAsync?.(mod.NotificationFeedbackType?.Success || 'success')); },
  /** A set was logged. */
  logged() { quiet(mod?.impactAsync?.(mod.ImpactFeedbackStyle?.Medium || 'medium')); },
  /** Stepper / segment selection. */
  tick() { quiet(mod?.selectionAsync?.()); },
};
