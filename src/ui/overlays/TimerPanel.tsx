// Rest timer panel (README screen 4): ring countdown, next-set line, Done CTA, STRIP/ADD diff chips,
// −15s / +30s / Skip. The ring is a stroke-dashoffset tween on r=23 (dasharray 144.5), clamped.
// VoiceOver has no polite live region, so the panel announces at start, every 30 s, at 10 s and at 0.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useView } from '../../store/useStore';
import { Hairline, Num, Tap, Txt, anchorProps } from '../primitives';
import { MOTION, useTheme } from '../theme';
import { bezier, useSlideUp } from '../motion';
import { PulseDot } from '../PulseDot';

type Timer = ReturnType<typeof useView>['timer'];
const ACircle = Animated.createAnimatedComponent(Circle);
export const RING_LEN = 144.5;

export function announce(text: string) {
  try { AccessibilityInfo.announceForAccessibility(text); } catch { /* headless */ }
}

function Ring({ dash, mmss }: { dash: number; mmss: string }) {
  const { t, reduceMotion } = useTheme();
  const off = useSharedValue(dash);
  useEffect(() => {
    const v = Math.max(0, Math.min(RING_LEN, dash));
    off.value = reduceMotion ? v : withTiming(v, { duration: MOTION.ring, easing: bezier() });
  }, [dash, reduceMotion, off]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  return (
    <View style={{ width: 52, height: 52 }}>
      <Svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={26} cy={26} r={23} fill="none" stroke={t.bd2} strokeWidth={4} />
        <ACircle cx={26} cy={26} r={23} fill="none" stroke={t.acc} strokeWidth={4} strokeLinecap="round" strokeDasharray={String(RING_LEN)} animatedProps={props} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Num size={14} weight={700} color="tx">{mmss}</Num>
      </View>
    </View>
  );
}

function DiffChip({ text, tone }: { text: string; tone: 'strip' | 'add' }) {
  const { c } = useTheme();
  const strip = tone === 'strip';
  return (
    <View style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, backgroundColor: c(strip ? 'dan2A14' : 'accA14'), borderWidth: 1, borderColor: c(strip ? 'dan2A40' : 'accA42') }}>
      <Num size={13} weight={700} color={strip ? 'dan3' : 'accHi'}>{text}</Num>
    </View>
  );
}

function RestButton({ label, text, onPress, flex = 1, fg = 'tx4' }: { label: string; text: string; onPress: () => void; flex?: number; fg?: string }) {
  const { c } = useTheme();
  return (
    <Tap label={label} onPress={onPress} style={{ flex, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: c('ctl') }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
      <Txt size={12.5} weight={600} color={fg} style={{ fontVariant: ['tabular-nums'] }}>{text}</Txt>
    </Tap>
  );
}

export function TimerPanel({ timer, onToggleExpand }: { timer: Timer; onToggleExpand: () => void }) {
  const { c, t, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useSlideUp(MOTION.sheet, reduceMotion);
  const remaining = timer.remaining ?? 0;
  const total = timer.total ?? 1;
  const lastSpoken = useRef<number | null>(null);

  // spoken cadence: start, every 30 s, 10 s, zero — never every tick
  useEffect(() => {
    if (!timer.show) return;
    if (timer.paused) { lastSpoken.current = null; return; }
    const first = lastSpoken.current === null;
    const hit = remaining === 0 || remaining === 10 || (remaining > 0 && remaining % 30 === 0);
    if (first) announce('Rest started, ' + timer.mmss + '. ' + (timer.nextLabel || ''));
    else if (hit && lastSpoken.current !== remaining) announce(remaining === 0 ? 'Rest over. ' + (timer.nextLabel || '') : timer.mmss + ' remaining');
    if (first || hit) lastSpoken.current = remaining;
  }, [remaining, timer.show, timer.paused, timer.mmss, timer.nextLabel]);

  if (!timer.show) return null;
  const dash = RING_LEN * Math.min(1, Math.max(0, 1 - remaining / total));
  return (
    <Animated.View
      accessibilityViewIsModal={false}
      style={[
        { position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 10, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 24, paddingVertical: 14, paddingHorizontal: 15 },
        Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: -10 } }, android: { elevation: 12 }, default: {} }),
        slide,
      ]}
    >
      <Tap label={timer.aria || 'Rest timer'} onPress={onToggleExpand} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }} pressedStyle={{}}>
        <Ring dash={dash} mmss={timer.mmss || '0:00'} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <PulseDot />
            <Txt size={12} weight={700} color="accDeep" ls={0.36}>{timer.statusLabel}</Txt>
          </View>
          <Txt size={13.5} weight={500} color="tx3" style={{ marginTop: 4 }}>{timer.nextLabel}</Txt>
        </View>
        <Tap label={timer.cta || 'Done'} onPress={timer.onCta!} {...anchorProps('rest-cta')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 14, backgroundColor: t.acc }} pressedStyle={{ backgroundColor: t.accHi }}>
          <Txt size={13} weight={700} color="accInk">{timer.cta}</Txt>
        </Tap>
      </Tap>

      <Hairline color="bd4" style={{ marginTop: 13, marginBottom: 12 }} />

      <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
        {timer.hasRemove ? (
          <>
            <Txt size={11} weight={700} color="dan2" ls={0.55}>STRIP FOR NEXT</Txt>
            {timer.remove!.map((p, i) => <DiffChip key={'r' + i} text={p} tone="strip" />)}
          </>
        ) : null}
        {timer.hasAdd ? (
          <>
            <Txt size={11} weight={700} color="accDeep" ls={0.55} style={{ marginLeft: 4 }}>ADD FOR NEXT</Txt>
            {timer.add!.map((p, i) => <DiffChip key={'a' + i} text={p} tone="add" />)}
          </>
        ) : null}
        {timer.noChange ? <Txt size={12.5} color="mut2">No plate change for the next set</Txt> : null}
        {timer.lastSet ? <Txt size={12.5} color="mut2" style={{ flexShrink: 1 }}>Strip the bar when you’re ready — nothing else to load.</Txt> : null}
        {timer.hasChips ? <Txt size={12} color="mut3" style={{ marginLeft: 'auto' }}>each side</Txt> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <RestButton label="Take fifteen seconds off the rest" text="−15s" onPress={timer.minus!} />
        <RestButton label="Add thirty seconds to the rest" text="+30s" onPress={timer.plus!} />
        <RestButton label="Skip the rest and log this set" text="Skip rest" onPress={timer.skip!} flex={1.2} fg="mut" />
      </View>
    </Animated.View>
  );
}

/** Height of the panel above the home indicator — the toast stacks above it (renderVals.undoBottom). */
export const TIMER_STACK = 232 - 44;
