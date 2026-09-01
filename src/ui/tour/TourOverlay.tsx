// Guided tour overlay: tap-anywhere pause layer, welcome/closing card on a scrim, captions that
// re-animate per keyframe, the paused pill, the fingertip (1.5 s press + expanding ring), the
// imperative progress bar, and the Next / Skip buttons.

import React, { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useView } from '../../store/useStore';
import { Num, Tap, Txt } from '../primitives';
import { useTheme } from '../theme';
import { bezier } from '../motion';
import { tourUI } from './tourUI';

type V = ReturnType<typeof useView>;

/** Re-mounting on `tourKey` replays the slide-up (the prototype keys these nodes on tourKey). */
function SlideIn({ children, ms, style, pointerEvents = 'none' }: { children: React.ReactNode; ms: number; style?: object; pointerEvents?: 'none' | 'box-none' }) {
  const { reduceMotion } = useTheme();
  const y = useSharedValue(reduceMotion ? 0 : 12);
  const o = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    y.value = withTiming(0, { duration: ms, easing: bezier() });
    o.value = withTiming(1, { duration: Math.min(ms, 200) });
  }, [ms, reduceMotion, y, o]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: o.value }));
  return <Animated.View pointerEvents={pointerEvents} style={[style, st]}>{children}</Animated.View>;
}

function Fingertip() {
  const { t, reduceMotion } = useTheme();
  const dotO = useSharedValue(0), dotS = useSharedValue(0.5), ringO = useSharedValue(0), ringS = useSharedValue(0.4);
  const play = () => {
    if (reduceMotion) {
      dotO.value = withSequence(withTiming(1, { duration: 0 }), withTiming(1, { duration: 900 }), withTiming(0, { duration: 0 }));
      dotS.value = 1; ringO.value = 0;
      return;
    }
    // tourPress: 0% o0 s.5 → 18% o1 s1 → 42% s.78 → 60% s1 → 100% o0 (1.5 s)
    dotO.value = withSequence(withTiming(1, { duration: 270 }), withTiming(1, { duration: 630 }), withTiming(0, { duration: 600 }));
    dotS.value = withSequence(withTiming(1, { duration: 270, easing: bezier() }), withTiming(0.78, { duration: 360, easing: bezier() }), withTiming(1, { duration: 270, easing: bezier() }), withTiming(1, { duration: 600 }));
    // tourRing: 0–30% o0 s.4 → 45% o.9 → 100% o0 s2.1
    ringO.value = withSequence(withTiming(0, { duration: 450 }), withTiming(0.9, { duration: 225 }), withTiming(0, { duration: 825, easing: Easing.out(Easing.ease) }));
    ringS.value = withSequence(withTiming(0.4, { duration: 450 }), withTiming(2.1, { duration: 1050, easing: Easing.out(Easing.ease) }));
  };
  useAnimatedReaction(() => tourUI.pressKey.value, (k, prev) => { if (prev !== null && k !== prev) runOnJS(play)(); }, [reduceMotion]);
  const host = useAnimatedStyle(() => ({ left: tourUI.dotX.value - 22, top: tourUI.dotY.value - 22 }));
  const dot = useAnimatedStyle(() => ({ opacity: dotO.value, transform: [{ scale: dotS.value }] }));
  const ring = useAnimatedStyle(() => ({ opacity: ringO.value, transform: [{ scale: ringS.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 44, height: 44, zIndex: 31 }, host]}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: t.acc }, ring]} />
      <Animated.View style={[{ position: 'absolute', left: 5, top: 5, width: 34, height: 34, borderRadius: 17, backgroundColor: t.acc, opacity: 0.9 }, Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, default: {} }), dot]} />
    </Animated.View>
  );
}

function ProgressBar() {
  const { c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useAnimatedStyle(() => ({ width: `${tourUI.progress.value * 100}%` as `${number}%` }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 7, left: 18, right: 18, height: 3, zIndex: 32, borderRadius: 99, backgroundColor: c('bdMid'), overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 99, backgroundColor: t.acc }, st]} />
    </View>
  );
}

export function TourOverlay({ v }: { v: V }) {
  const { c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <View accessibilityViewIsModal accessibilityLabel="Guided tour" pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30 }}>
      <Tap label="Pause or resume the tour" onPress={v.tourTap} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30 }} pressedStyle={{}} />
      {v.tourCardOn ? (
        <SlideIn key={'card' + v.tourKey} ms={350} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 31, backgroundColor: v.tourScrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
          <Num size={31} weight={800} ls={-0.8} lh={35} align="center" accessibilityRole="header">{v.tourCardTitle}</Num>
          <Txt size={14.5} lh={23} color="mut2" align="center" style={{ marginTop: 12, maxWidth: 300 }}>{v.tourCardSub}</Txt>
        </SlideIn>
      ) : null}
      {v.tourCapOn ? (
        <SlideIn key={'cap' + v.tourKey} ms={300} style={[{ position: 'absolute', left: 16, right: 16, top: insets.top + 51, zIndex: 31, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 18, paddingTop: 13, paddingHorizontal: 16, paddingBottom: 14 }, Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } }, default: {} })]}>
          <Txt size={10.5} weight={700} ls={0.7} color="accDeep" style={{ marginBottom: 4 }}>QUICK TOUR</Txt>
          <Txt size={13.5} lh={20} color="tx3" accessibilityLiveRegion="polite">{v.tourCap}</Txt>
        </SlideIn>
      ) : null}
      {v.tourPausedOn ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: height * 0.47, zIndex: 31, alignItems: 'center' }}>
          <View style={{ backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 99, paddingVertical: 9, paddingHorizontal: 16 }}>
            <Txt size={12.5} weight={600} color="tx3">Paused — tap anywhere to resume</Txt>
          </View>
        </View>
      ) : null}
      <Fingertip />
      <ProgressBar />
      <View style={{ position: 'absolute', bottom: insets.bottom + 12, left: 0, right: 0, zIndex: 32, alignItems: 'center', gap: 10 }} pointerEvents="box-none">
        {v.tourWaitOn ? (
          <SlideIn key={'next' + v.tourWaitLabel} ms={300} style={{}} pointerEvents="box-none">
            <Tap label="Continue the tour: " onPress={v.tourNext} accessibilityLabel={'Continue the tour: ' + v.tourWaitLabel} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.acc, borderRadius: 99, paddingVertical: 12, paddingHorizontal: 22 }, Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 17, shadowOffset: { width: 0, height: 12 } }, default: {} })]} pressedStyle={{ backgroundColor: t.accHi }}>
              <Txt size={14} weight={700} color="accInk">{v.tourWaitLabel}</Txt>
              <Txt size={14} weight={800} color="accInk">›</Txt>
            </Tap>
          </SlideIn>
        ) : null}
        <Tap label="Skip the tour" onPress={v.tourSkip} style={[{ backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 99, paddingVertical: 9, paddingHorizontal: 18 }, Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } }, default: {} })]} pressedStyle={{ backgroundColor: c('ctl2') }}>
          <Txt size={13} weight={600} color="mut">Skip tour</Txt>
        </Tap>
      </View>
    </View>
  );
}
