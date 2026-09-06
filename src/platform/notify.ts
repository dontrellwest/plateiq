// The lock-screen alert for the end of a rest. iOS suspends JavaScript when the app is in the
// background, so nothing in-app can fire while the phone is in a pocket: a notification scheduled
// for the rest's wall-clock end time is the only thing that reaches the user there.

type PermStatus = { granted: boolean; canAskAgain: boolean; status: string };
type NotifModule = {
  setNotificationHandler?: (h: unknown) => void;
  getPermissionsAsync?: () => Promise<PermStatus>;
  requestPermissionsAsync?: (req?: unknown) => Promise<PermStatus>;
  scheduleNotificationAsync?: (req: unknown) => Promise<string>;
  cancelScheduledNotificationAsync?: (id: string) => Promise<void>;
  cancelAllScheduledNotificationsAsync?: () => Promise<void>;
  SchedulableTriggerInputTypes?: Record<string, string>;
};

let mod: NotifModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-notifications') as NotifModule;
} catch {
  mod = null;
}

/** One stable id: rescheduling is idempotent, and it survives a force-quit. */
export const REST_NOTIFICATION_ID = 'plateiq.rest-end';
export const available = () => !!mod?.scheduleNotificationAsync;

/** In the foreground the chime and the buzz already fired — never double-alert. */
export function installHandler(isForeground: () => boolean) {
  mod?.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldShowBanner: !isForeground(),
      shouldShowList: true,
      shouldPlaySound: !isForeground(),
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asked once, at the moment the user turns the Settings row on, never on launch. An app that asks
 * before the user has done anything gets denied, and iOS only lets you ask again while
 * `canAskAgain` is true.
 */
export async function ensurePermission(): Promise<boolean> {
  if (!mod?.getPermissionsAsync || !mod.requestPermissionsAsync) return false;
  try {
    const cur = await mod.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false; // denied before: iOS will not show the sheet again
    const next = await mod.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return !!next.granted;
  } catch { return false; }
}

export async function scheduleRestEnd(endsAt: number, now: number) {
  if (!mod?.scheduleNotificationAsync) return;
  await cancelRestEnd();
  if (endsAt - now < 1000) return; // iOS refuses a trigger under about a second
  try {
    await mod.scheduleNotificationAsync({
      identifier: REST_NOTIFICATION_ID,
      content: {
        title: 'Rest over',
        body: 'Next set is ready.',
        sound: 'default',
        interruptionLevel: 'timeSensitive', // breaks through Focus in a real build
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes?.DATE || 'date',
        date: new Date(endsAt),
      },
    });
  } catch { /* permission revoked mid-session, or a date already past */ }
}

export async function cancelRestEnd() {
  try { await mod?.cancelScheduledNotificationAsync?.(REST_NOTIFICATION_ID); } catch { /* not scheduled */ }
}

/** Launch cleanup: iOS keeps scheduled notifications across a force-quit. */
export async function cancelAll() {
  try { await mod?.cancelAllScheduledNotificationsAsync?.(); } catch { /* ignore */ }
}
