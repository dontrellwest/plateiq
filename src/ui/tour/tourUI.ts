// The DOM-free side of the guided tour (README screen 1). The logic class drives a keyframe
// timeline and calls this host to: show the fingertip over a registered anchor, light that anchor
// up through the spotlight cutout, scroll the feed to a fraction of its height, and move the
// progress value. All of it is Reanimated shared values updated imperatively, so the solver only
// re-runs at keyframes (state changes).
//
// `tourUI` must hold only shared values: the overlay's worklets capture the whole object, and
// Worklets copies every field into the UI runtime — a host element (the feed's ScrollView ref)
// cannot be copied and crashes the app on iOS. The feed ref therefore lives in `tourFeed`, and the
// JS-side copy of the lit frame (which the caption needs to lay itself out, in React) lives in
// `tourFocus`. Neither is ever referenced from a worklet.

import { Easing, makeMutable, withTiming } from 'react-native-reanimated';
import type { ScrollView } from 'react-native';
import type { TourHost } from '../../logic/types';
import type { AnchorFrame } from '../primitives';
import { hasAnchor, measureAnchor } from '../primitives';
import { EASE } from '../theme';

export const tourUI = {
  progress: makeMutable(0),
  dotX: makeMutable(-100),
  dotY: makeMutable(-100),
  /** increments on every press so the fingertip animation restarts */
  pressKey: makeMutable(0),
  // ---- spotlight cutout, in window coordinates (what measureInWindow returns) ----
  spotX: makeMutable(0),
  spotY: makeMutable(0),
  spotW: makeMutable(0),
  spotH: makeMutable(0),
  spotR: makeMutable(16),
  /** 0 = no lit edge (a plain full scrim), 1 = the ring and glow are drawn */
  spotOn: makeMutable(0),
};

/** Plain (non-worklet) side: the feed ScrollView and its content height, for `scrollTo`. */
export const tourFeed = { ref: null as ScrollView | null, height: 0 };

/**
 * Viewport facts the overlay publishes so the host can clamp a frame that is partly off screen.
 * Plain numbers, never read from a worklet.
 */
export const tourView = { w: 0, h: 0, top: 0, bottom: 0, reduceMotion: false };

// ---- the lit frame, for React (the caption's placement) ----------------------------------------

export type TourFocusState = { frame: AnchorFrame | null; radius: number; key: number };
let focusState: TourFocusState = { frame: null, radius: 16, key: 0 };
const focusSubs = new Set<() => void>();

export const getTourFocus = (): TourFocusState => focusState;
export function subscribeTourFocus(fn: () => void): () => void {
  focusSubs.add(fn);
  return () => { focusSubs.delete(fn); };
}
function publishFocus(frame: AnchorFrame | null, radius: number) {
  const p = focusState.frame;
  const same = (!p && !frame)
    || (!!p && !!frame && focusState.radius === radius
      && Math.abs(p.x - frame.x) < 1 && Math.abs(p.y - frame.y) < 1
      && Math.abs(p.w - frame.w) < 1 && Math.abs(p.h - frame.h) < 1);
  if (same) return;
  focusState = { frame, radius, key: focusState.key + 1 };
  focusSubs.forEach((fn) => { fn(); });
}

// ---- geometry ---------------------------------------------------------------------------------

/** Breathing room between the control and the lit edge. */
const SPOT_PAD = 8;
/** A cutout smaller than this in either axis means the target is effectively off screen. */
const MIN_SPOT = 24;
const SPOT_MS = { duration: 340, easing: Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]) };

/** Corner radius of each anchor's control, so the cutout matches what it is lighting. */
const ANCHOR_RADIUS: Record<string, number> = {
  'inc-working': 11,
  'target-card': 18,
  'warmup-list': 20,
  hero: 22,
  'rest-panel': 24,
  'rest-cta': 14,
  'log-sheet': 28,
  'nav-history': 12,
  'history-stats': 16,
  'mode-barbell': 14,
  'mode-dumbbell': 14,
  'mode-landmine': 14,
};
function radiusFor(anchor: string): number {
  const r = ANCHOR_RADIUS[anchor];
  if (r !== undefined) return r;
  if (anchor.indexOf('set-') === 0) return 21; // set card 20 / hero 22
  if (anchor.indexOf('log-') === 0) return 12;
  return 16;
}

/**
 * Write a shared value. Under the Jest Reanimated mock a "mutable" is the plain initial number, so
 * this is a silent no-op there; the try/catch keeps it a no-op if that mock ever turns strict.
 */
function put(sv: { value: number }, next: number, animate: boolean) {
  try { sv.value = animate ? withTiming(next, SPOT_MS) : next; } catch { /* mocked shared value */ }
}

/** Trim a measured frame into the visible band. Exported so the geometry can be tested directly. */
export function clampSpot(raw: AnchorFrame, view: typeof tourView): AnchorFrame | null {
  const W = view.w || raw.x + raw.w + SPOT_PAD;
  const H = view.h || raw.y + raw.h + SPOT_PAD;
  const left = Math.max(4, raw.x - SPOT_PAD);
  const right = Math.min(W - 4, raw.x + raw.w + SPOT_PAD);
  const top = Math.max(view.top + 4, raw.y - SPOT_PAD);
  const bottom = Math.min(H - view.bottom - 4, raw.y + raw.h + SPOT_PAD);
  const w = right - left;
  const h = bottom - top;
  if (w < MIN_SPOT || h < MIN_SPOT) return null;
  return { x: left, y: top, w, h };
}

function applyFrame(raw: AnchorFrame, radius: number, publish: boolean) {
  const box = clampSpot(raw, tourView);
  if (!box) { clearSpot(); return; }
  // the first target after a full scrim snaps into place and fades its ring in; later ones glide
  const animate = focusState.frame !== null && !tourView.reduceMotion;
  const r = Math.max(0, Math.min(radius + SPOT_PAD, box.w / 2, box.h / 2));
  put(tourUI.spotX, box.x, animate);
  put(tourUI.spotY, box.y, animate);
  put(tourUI.spotW, box.w, animate);
  put(tourUI.spotH, box.h, animate);
  put(tourUI.spotR, r, animate);
  put(tourUI.spotOn, 1, !tourView.reduceMotion);
  if (publish) publishFocus(box, r);
}

/** Darken the whole screen: no hole, no ring (the welcome / closing cards, or a lost anchor). */
export function clearSpot() {
  const animate = !tourView.reduceMotion;
  put(tourUI.spotOn, 0, animate);
  put(tourUI.spotW, 0, animate);
  put(tourUI.spotH, 0, animate);
  publishFocus(null, 16);
}

// ---- the host ---------------------------------------------------------------------------------

let focusToken = 0;
let timers: Array<ReturnType<typeof setTimeout>> = [];
const cancelTimers = () => { timers.forEach(clearTimeout); timers = []; };

/** Test hook: drop pending re-measures and reset the published frame. */
export function _resetTourFocusForTests() {
  cancelTimers();
  focusToken++;
  focusState = { frame: null, radius: 16, key: 0 };
}

export const tourHost: TourHost = {
  press(anchor) {
    if (!hasAnchor(anchor)) return false;
    const place = (bump: boolean) => {
      measureAnchor(anchor).then((f) => {
        if (!f) return;
        try {
          tourUI.dotX.value = f.x + f.w / 2;
          tourUI.dotY.value = f.y + f.h / 2;
          if (bump) tourUI.pressKey.value = tourUI.pressKey.value + 1;
        } catch { /* mocked shared value */ }
      });
    };
    place(true);
    // an animated scrollTo in the same keyframe is still settling — nudge the dot once it lands,
    // without bumping pressKey (that would restart the 1.5 s press animation)
    timers.push(setTimeout(() => place(false), 140));
    return true;
  },
  scrollTo(fraction) {
    const sv = tourFeed.ref;
    if (sv && sv.scrollTo) sv.scrollTo({ y: tourFeed.height * fraction, animated: true });
  },
  setProgress(fraction) {
    try { tourUI.progress.value = Math.max(0, Math.min(1, fraction)); } catch { /* mocked */ }
  },
  focus(anchor, radius) {
    cancelTimers();
    const token = ++focusToken;
    if (!anchor) { clearSpot(); return; }
    let got = false;
    // re-measure while an animated scroll settles, and give anchors that mount with this keyframe
    // (the rest panel, the log sheet, the History screen) time to register before giving up
    const take = (settle: boolean, last: boolean) => {
      if (token !== focusToken) return;
      if (!hasAnchor(anchor)) { if (last && !got) clearSpot(); return; }
      measureAnchor(anchor).then((f) => {
        if (token !== focusToken) return;
        if (!f) { if (last && !got) clearSpot(); return; }
        const firstHit = !got;
        got = true;
        applyFrame(f, radius === undefined ? radiusFor(anchor) : radius, settle || firstHit);
      });
    };
    take(true, false);
    timers.push(setTimeout(() => take(false, false), 90));
    timers.push(setTimeout(() => take(false, false), 240));
    timers.push(setTimeout(() => take(true, true), 460));
  },
};
