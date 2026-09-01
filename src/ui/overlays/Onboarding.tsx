// Onboarding (README screen 2): Where do you lift → Units → [Plates owned, home only] → Bars & anchor.
// Skippable; every choice editable later.

import React from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useView } from '../../store/useStore';
import { Num, Tap, Txt } from '../primitives';
import { MOTION, useTheme } from '../theme';
import { useSlideUp } from '../motion';
import { RackRows } from '../RackRows';

type V = ReturnType<typeof useView>;

function Mark({ bg, bd, fg, size = 26 }: { bg: string; bd: string; fg: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: 99, backgroundColor: c(bg), borderWidth: 1.5, borderColor: c(bd), alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={size === 26 ? 13 : 11} weight={800} color={fg}>✓</Txt>
    </View>
  );
}

function OptionCard({ label, on, onPress, bg = 'card', bd = 'bdSoft', children, pad = 18, radius = 20 }: { label: string; on: boolean; onPress: () => void; bg?: string; bd?: string; children: React.ReactNode; pad?: number | [number, number]; radius?: number }) {
  const { c } = useTheme();
  const p = Array.isArray(pad) ? { paddingVertical: pad[0], paddingHorizontal: pad[1] } : { padding: pad };
  return (
    <Tap label={label} role="radio" selected={on} onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, backgroundColor: c(bg), borderWidth: 1, borderColor: c(bd), borderRadius: radius }, p]} pressedStyle={{ opacity: 0.85 }}>
      {children}
    </Tap>
  );
}

export function Onboarding({ v }: { v: V }) {
  const { c, t, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useSlideUp(MOTION.ring, reduceMotion);
  return (
    <Animated.View accessibilityViewIsModal style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: t.bg, paddingTop: insets.top + 27, paddingHorizontal: 22, paddingBottom: insets.bottom }, slide]}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLabel={'Step ' + (v.onboardStep + 1)}>
        {v.onboardDots.map((d, i) => <View key={i} style={{ height: 6, width: d.w, borderRadius: 99, backgroundColor: c(d.bg) }} />)}
      </View>

      <View style={{ marginTop: 34 }}>
        <Num size={30} weight={800} ls={-0.8} lh={35} accessibilityRole="header">{v.onboardTitle}</Num>
        <Txt size={14} lh={21.7} color="mut2" style={{ marginTop: 10 }}>{v.onboardBody}</Txt>
      </View>

      {v.tourNoteOn ? (
        <Tap label="No worries — you can rewatch the tour anytime from Settings. Dismiss" onPress={v.tourNoteDismiss} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c('accA07'), borderWidth: 1, borderColor: c('accA28'), borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 }} pressedStyle={{ opacity: 0.85 }}>
          <Txt size={12.5} lh={18} color="tx3" style={{ flex: 1 }}>No worries — you can rewatch the tour anytime from <Txt size={12.5} weight={600} color="tx">Settings</Txt>.</Txt>
          <Txt size={12} color="mut3">✕</Txt>
        </Tap>
      ) : null}

      <ScrollView style={{ flex: 1, marginTop: 26 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {v.onboardIsSetup ? (
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {v.gymOptions.map((g) => (
              <OptionCard key={g.title} label={g.title + '. ' + g.note} on={g.on} onPress={g.pick} bg={g.bg} bd={g.bd}>
                <View style={{ flex: 1 }}>
                  <Num size={19} weight={700}>{g.title}</Num>
                  <Txt size={12.5} color="mut2" style={{ marginTop: 3 }}>{g.note}</Txt>
                </View>
                <Mark bg={g.markBg} bd={g.markBd} fg={g.markFg} />
              </OptionCard>
            ))}
          </View>
        ) : null}

        {v.onboardIsUnits ? (
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {v.unitOptions.map((u) => (
              <OptionCard key={u.label} label={u.label === 'lb' ? 'Pounds' : 'Kilograms'} on={u.on} onPress={u.pick}>
                <Num size={22} weight={700}>{u.label}</Num>
                <Mark bg={u.markBg} bd={u.markBd} fg={u.markFg} />
              </OptionCard>
            ))}
          </View>
        ) : null}

        {v.onboardIsPlates ? <RackRows rows={v.rackRows} unit={v.unit} /> : null}

        {v.onboardIsBars ? (
          <View style={{ gap: 10 }}>
            <Txt size={12} weight={600} color="mut3" style={{ marginLeft: 2 }}>Barbell</Txt>
            {v.barOptions.map((b) => (
              <OptionCard key={b.v} label={b.v + ' ' + v.unit + ' bar'} on={b.on} onPress={b.pick} pad={[16, 18]}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <Num size={24} weight={700}>{b.v}</Num>
                  <Txt size={12} weight={600} color="mut3">{v.unit} bar</Txt>
                </View>
                <Mark bg={b.markBg} bd={b.markBd} fg={b.markFg} />
              </OptionCard>
            ))}
            <View style={{ gap: 8, marginTop: 10 }}>
              <Txt size={12} weight={600} color="mut3" style={{ marginLeft: 2 }}>Dumbbell handle</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {v.handleOptions.map((h) => (
                  <Tap key={h.v} label={h.v + ' ' + v.unit + ' handle'} role="radio" selected={h.on} onPress={h.pick} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: c('card'), borderWidth: 1, borderColor: c('bdSoft'), borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14 }} pressedStyle={{ opacity: 0.85 }}>
                    <Num size={19} weight={700}>{h.v}</Num>
                    <Mark bg={h.markBg} bd={h.markBd} fg={h.markFg} size={20} />
                  </Tap>
                ))}
              </View>
              <Tap label={v.handleUnsureLabel} role="radio" selected={v.handleUnsureOn} onPress={v.pickHandleUnsure} style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, backgroundColor: c(v.handleUnsureBg), borderWidth: 1, borderColor: c(v.handleUnsureBd) }} pressedStyle={{ opacity: 0.85 }}>
                <Txt size={13.5} weight={600} color={v.handleUnsureFg}>{v.handleUnsureLabel}</Txt>
              </Tap>
            </View>
            <View style={{ gap: 6, marginTop: 10 }} accessibilityRole="radiogroup">
              <Txt size={12} weight={600} color="mut3" style={{ marginLeft: 2 }}>Landmine anchor, if you have one</Txt>
              {v.anchorOptions.map((a) => (
                <Tap key={a.id} label={a.label} role="radio" selected={a.on} onPress={a.pick} style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, backgroundColor: c(a.bg), borderWidth: 1, borderColor: c(a.bd) }} pressedStyle={{ opacity: 0.85 }}>
                  <Txt size={13.5} weight={600} color={a.fg}>{a.label}</Txt>
                </Tap>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Tap label={v.onboardBackLabel === 'Skip' ? 'Skip setup' : 'Back'} onPress={v.onboardBack} style={{ paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, backgroundColor: c('card3'), justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctl2') }}>
          <Txt size={14} weight={600} color="mut">{v.onboardBackLabel}</Txt>
        </Tap>
        <Tap label={v.onboardCta} onPress={v.onboardNext} style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: t.acc, alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: t.accHi }}>
          <Txt size={15} weight={700} color="accInk">{v.onboardCta}</Txt>
        </Tap>
      </View>
    </Animated.View>
  );
}
