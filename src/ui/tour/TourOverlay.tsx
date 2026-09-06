// Guided tour overlay: a spotlight scrim with a rounded cutout over the control the current step is
// about, tap-anywhere pause layer, welcome/closing card, a caption pinned beside the lit control
// with a caret, the paused pill, the fingertip (1.5 s press + expanding ring), the step meter, and
// the Next / Skip buttons.

import React, { useEffect, useSyncExternalStore } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useView } from '../../store/useStore';
import { Num, Tap, Txt } from '../primitives';
import { useTheme } from '../theme';
import { bezier } from '../motion';
import { Spotlight } from './Spotlight';
import { clearSpot, getTourFocus, subscribeTourFocus, tourUI, tourView } from './tourUI';
import { announce } from '../overlays/TimerPanel';

type V = ReturnType<typeof useView>;

// caption placement
const CAP_MAX_W = 340;
const CAP_MARGIN = 16;
const CAP_GAP = 14;
const CAP_MIN_H = 92;
/** room kept clear at the bottom for the Next + Skip stack. */
const BOTTOM_RESERVE = 118;
const TOP_RESERVE = 8;
const CARET = 12;

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

/** "STEP 3 OF 7" over a chunky segmented bar — the 3 pt hairline was invisible. */
function StepMeter({ step, total, center }: { step: number; total: number; center?: boolean }) {
  const { c, t } = useTheme();
  if (!total || step < 1) return null;
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    cells.push(
      <View
        key={i}
        style={{
          flex: 1, height: 7, borderRadius: 4,
          backgroundColor: i < step ? t.acc : c('bdMid'),
          opacity: i < step - 1 ? 0.5 : 1,
        }}
      />,
    );
  }
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={'Step ' + step + ' of ' + total}
      accessibilityValue={{ min: 0, max: total, now: step }}
      style={{ marginBottom: 10, alignSelf: 'stretch', maxWidth: center ? 260 : undefined, alignItems: center ? 'center' : 'stretch' }}
    >
      <Txt size={10.5} weight={800} ls={0.8} color="accDeep" align={center ? 'center' : 'left'} style={{ marginBottom: 6 }}>
        {'STEP ' + step + ' OF ' + total}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 4, alignSelf: 'stretch' }}>{cells}</View>
    </View>
  );
}

export function TourOverlay({ v }: { v: V }) {
  const { c, t, dark, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focus = useSyncExternalStore(subscribeTourFocus, getTourFocus, getTourFocus);

  // the host clamps a partly-scrolled target into the visible band, and skips withTiming under
  // reduced motion — it needs the viewport and that flag, and it must not import the store
  useEffect(() => {
    tourView.w = width; tourView.h = height;
    tourView.top = insets.top; tourView.bottom = insets.bottom;
    tourView.reduceMotion = reduceMotion;
  }, [width, height, insets.top, insets.bottom, reduceMotion]);

  // a welcome / closing card owns the whole screen — nothing is lit behind it
  useEffect(() => { if (v.tourCardOn) clearSpot(); }, [v.tourCardOn]);
  useEffect(() => () => clearSpot(), []);

  // iOS VoiceOver ignores live regions — each caption and card is announced as it appears
  useEffect(() => { if (v.tourCardOn) announce(v.tourCardTitle + '. ' + v.tourCardSub); }, [v.tourCardOn, v.tourCardTitle, v.tourCardSub]);
  useEffect(() => {
    if (!v.tourCap) return;
    announce(v.tourSteps ? 'Step ' + v.tourStep + ' of ' + v.tourSteps + '. ' + v.tourCap : v.tourCap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.tourCap, v.tourKey]);

  // a spotlight scrim must darken in BOTH themes; the card scrim (v.tourScrim) is a light wash in
  // light mode, which is right behind full-screen copy and wrong behind a lit control
  const spotScrim = dark ? 'rgba(6,7,9,.74)' : 'rgba(16,18,22,.44)';

  // ---- caption placement -----------------------------------------------------------------
  const f = v.tourCardOn ? null : focus.frame;
  const capW = Math.min(width - 2 * CAP_MARGIN, CAP_MAX_W);
  let capLeft = CAP_MARGIN;
  let capTop: number | undefined = insets.top + 51;
  let capBottom: number | undefined;
  let capMaxH: number | undefined;
  let caretUp = false;
  let caretX = 0;
  if (f) {
    const cx = f.x + f.w / 2;
    capLeft = Math.max(CAP_MARGIN, Math.min(cx - capW / 2, width - CAP_MARGIN - capW));
    const roomBelow = (height - insets.bottom - BOTTOM_RESERVE) - (f.y + f.h + CAP_GAP);
    const roomAbove = (f.y - CAP_GAP) - (insets.top + TOP_RESERVE);
    const below = roomBelow >= CAP_MIN_H || roomBelow >= roomAbove;
    if (below) {
      capTop = f.y + f.h + CAP_GAP; capBottom = undefined;
      capMaxH = Math.max(CAP_MIN_H, roomBelow);
      caretUp = true; // the card is below the target, so its caret sits on its top edge
    } else {
      capTop = undefined; capBottom = height - f.y + CAP_GAP;
      capMaxH = Math.max(CAP_MIN_H, roomAbove);
      caretUp = false;
    }
    caretX = Math.max(18, Math.min(cx - capLeft - CARET / 2, capW - 18 - CARET));
  }

  return (
    <View accessibilityViewIsModal accessibilityLabel="Guided tour" pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30 }}>
      <Spotlight scrim={spotScrim} ring={t.acc} />
      <Tap label="Pause or resume the tour" onPress={v.tourTap} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30 }} pressedStyle={{}} />
      {v.tourCardOn ? (
        <SlideIn key={'card' + v.tourKey} ms={350} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 31, backgroundColor: v.tourScrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
          <StepMeter step={v.tourStep} total={v.tourSteps} center />
          <Num size={31} weight={800} ls={-0.8} lh={35} align="center" accessibilityRole="header">{v.tourCardTitle}</Num>
          <Txt size={14.5} lh={23} color="mut2" align="center" style={{ marginTop: 12, maxWidth: 300 }}>{v.tourCardSub}</Txt>
        </SlideIn>
      ) : null}
      {v.tourCapOn ? (
        <SlideIn
          key={'cap' + v.tourKey}
          ms={300}
          style={[
            { position: 'absolute', left: capLeft, width: capW, top: capTop, bottom: capBottom, maxHeight: capMaxH, zIndex: 31, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 18, paddingTop: 13, paddingHorizontal: 16, paddingBottom: 14 },
            Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } }, default: {} }),
          ]}
        >
          {f ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', left: caretX, width: CARET, height: CARET,
                top: caretUp ? -CARET / 2 : undefined,
                bottom: caretUp ? undefined : -CARET / 2,
                backgroundColor: c('card2'),
                borderColor: c('bd2'),
                borderTopWidth: caretUp ? 1 : 0,
                borderLeftWidth: caretUp ? 1 : 0,
                borderBottomWidth: caretUp ? 0 : 1,
                borderRightWidth: caretUp ? 0 : 1,
                transform: [{ rotate: '45deg' }],
              }}
            />
          ) : null}
          <StepMeter step={v.tourStep} total={v.tourSteps} />
          <Txt size={13.5} lh={20} color="tx3">{v.tourCap}</Txt>
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
