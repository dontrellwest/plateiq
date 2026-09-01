// Shared motion helpers. Every animation here is disabled under reduced motion (README "Accessibility").

import { useEffect } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE } from './theme';

export const bezier = () => Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/** The prototype's `slideUp`: translateY 12 → 0 on mount (280 ms sheets/timer, 220 ms toast). */
export function useSlideUp(duration: number, reduceMotion: boolean) {
  const y = useSharedValue(reduceMotion ? 0 : 12);
  const o = useSharedValue(reduceMotion ? 1 : 0.001);
  useEffect(() => {
    if (reduceMotion) { y.value = 0; o.value = 1; return; }
    y.value = withTiming(0, { duration, easing: bezier() });
    o.value = withTiming(1, { duration: Math.min(duration, 180) });
  }, [duration, reduceMotion, y, o]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: o.value }));
}
