import React, { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { MOTION, useTheme } from './theme';

/** The accent pulse dot: 1.6 s opacity loop, still under reduced motion. */
export function PulseDot() {
  const { t, reduceMotion } = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) { o.value = 1; return; }
    const half = MOTION.pulse / 2;
    o.value = withRepeat(withSequence(withTiming(0.3, { duration: half, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) })), -1, false);
  }, [reduceMotion, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 99, backgroundColor: t.acc }, st]} />;
}
