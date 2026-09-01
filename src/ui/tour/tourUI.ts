// The DOM-free side of the guided tour (README screen 1). The logic class drives a keyframe
// timeline and calls this host to: show the fingertip over a registered anchor, scroll the feed to
// a fraction of its height, and move the progress bar. Progress and the fingertip are Reanimated
// shared values updated imperatively, so the solver only re-runs at keyframes (state changes).

import { makeMutable } from 'react-native-reanimated';
import type { ScrollView } from 'react-native';
import type { TourHost } from '../../logic/types';
import { hasAnchor, measureAnchor } from '../primitives';

export const tourUI = {
  progress: makeMutable(0),
  dotX: makeMutable(-100),
  dotY: makeMutable(-100),
  /** increments on every press so the fingertip animation restarts */
  pressKey: makeMutable(0),
  feed: { ref: null as ScrollView | null, height: 0 },
};

export const tourHost: TourHost = {
  press(anchor) {
    if (!hasAnchor(anchor)) return false;
    measureAnchor(anchor).then((f) => {
      if (!f) return;
      tourUI.dotX.value = f.x + f.w / 2;
      tourUI.dotY.value = f.y + f.h / 2;
      tourUI.pressKey.value = tourUI.pressKey.value + 1;
    });
    return true;
  },
  scrollTo(fraction) {
    const sv = tourUI.feed.ref;
    if (sv && sv.scrollTo) sv.scrollTo({ y: tourUI.feed.height * fraction, animated: true });
  },
  setProgress(fraction) {
    tourUI.progress.value = Math.max(0, Math.min(1, fraction));
  },
};
