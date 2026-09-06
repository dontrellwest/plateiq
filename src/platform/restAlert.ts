// One place that decides what the end of a rest does: the buzz, the chime, and whether a
// lock-screen alert is armed. The store talks to this, not to the three platform wrappers.

import { AppState } from 'react-native';
import { haptics } from './haptics';
import { playRestSound, prepareRestSound, releaseRestSound } from './sound';
import * as notify from './notify';

let armedFor: number | null = null;
let armTimer: ReturnType<typeof setTimeout> | null = null;

/** The rest hit zero with the app in the foreground. */
export function fire(withSound: boolean) {
  haptics.timerDone();
  if (withSound) playRestSound();
  void disarm(); // the user is looking at the phone; no lock-screen banner on top of that
  // the cancel above races the delivery by up to a second — sweep anything that got through
  void notify.dismissDelivered();
}

/**
 * A rest is running. Warm the audio path, and if the user allowed it, put the lock-screen alert in
 * place for the moment it ends.
 *
 * The 220 ms timeout coalesces a re-entrant burst: the store's first subscriber calls syncClock,
 * which itself calls setState, so a later subscriber can otherwise observe an intermediate
 * restEndsAt and schedule the wrong instant. The `armedFor` guard is what stops the one-second tick
 * from rescheduling the same alert every second for the whole rest.
 */
export function arm(endsAt: number, now: number, opts: { sound: boolean; notify: boolean }) {
  if (opts.sound) prepareRestSound();
  if (!opts.notify) { void disarm(); return; }
  if (armedFor === endsAt) return;
  armedFor = endsAt;
  if (armTimer) clearTimeout(armTimer);
  armTimer = setTimeout(() => { armTimer = null; void notify.scheduleRestEnd(endsAt, now); }, 220);
}

export async function disarm() {
  armedFor = null;
  if (armTimer) { clearTimeout(armTimer); armTimer = null; }
  await notify.cancelRestEnd();
}

export function installHandler() {
  notify.installHandler(() => AppState.currentState === 'active');
}

/** iOS keeps scheduled notifications across a force-quit; start from a clean slate. */
export async function bootCleanup() {
  armedFor = null;
  await notify.cancelAll();
  await notify.dismissDelivered();
}

export function teardown() {
  haptics.cancelTimerDone();
  if (armTimer) { clearTimeout(armTimer); armTimer = null; }
  armedFor = null;
  releaseRestSound();
}

export function _resetForTests() {
  armedFor = null;
  if (armTimer) clearTimeout(armTimer);
  armTimer = null;
}
