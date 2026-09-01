// Bottom sheet frame: scrim + card sliding up 280 ms, 28 pt top radius, grab handle, ✕ close.

import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Num, Tap, Txt } from '../primitives';
import { MOTION, useTheme } from '../theme';
import { useSlideUp } from '../motion';

export function Scrim({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  return <Tap label="Close sheet" onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c('scrim') }} pressedStyle={{}} />;
}

export interface SheetProps {
  title: string;
  a11yLabel: string;
  onClose: () => void;
  /** intro copy under the title */
  intro?: string;
  children: React.ReactNode;
  /** scroll the body (tall sheets) */
  scroll?: boolean;
  maxHeight?: number;
  /** false while the guided tour plays — the tour overlay is the modal layer then */
  modal?: boolean;
}

export function Sheet({ title, a11yLabel, onClose, intro, children, scroll, maxHeight, modal = true }: SheetProps) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useSlideUp(MOTION.sheet, reduceMotion);
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Num size={21} weight={700} ls={-0.3}>{title}</Num>
        <Tap label="Close" onPress={onClose} style={{ width: 40, height: 40, borderRadius: 99, backgroundColor: c('ctl2'), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
          <Txt size={15} color="mut">✕</Txt>
        </Tap>
      </View>
      {intro ? <Txt size={12.5} lh={19} color="mut3" style={{ marginBottom: 16 }}>{intro}</Txt> : null}
      {children}
    </>
  );
  return (
    <Animated.View
      accessibilityViewIsModal={modal}
      accessibilityLabel={a11yLabel}
      style={[
        { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c('card'), borderTopWidth: 1, borderColor: c('bd2'), borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 6, maxHeight },
        Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: -20 } }, android: { elevation: 16 }, default: {} }),
        slide,
      ]}
    >
      <View style={{ width: 38, height: 4, borderRadius: 99, backgroundColor: c('bd5'), alignSelf: 'center', marginBottom: 16 }} />
      {scroll ? (
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 18 }} showsVerticalScrollIndicator={false}>{body}</ScrollView>
      ) : (
        <View style={{ paddingHorizontal: 18 }}>{body}</View>
      )}
    </Animated.View>
  );
}

/** Square 40 pt −/+ button used by sheet steppers. */
export function SquareStep({ glyph, label, onPress, size = 40, radius = 12, bg = 'ctl2' }: { glyph: string; label: string; onPress: () => void; size?: number; radius?: number; bg?: string }) {
  const { c } = useTheme();
  return (
    <Tap label={label} onPress={onPress} style={{ width: size, height: size, borderRadius: radius, backgroundColor: c(bg), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
      <Txt size={18} weight={600} color="tx3">{glyph}</Txt>
    </Tap>
  );
}

/** Primary / secondary 48 pt sheet buttons. */
export function SheetButton({ label, text, onPress, primary, flex = 1, minWidth }: { label: string; text: string; onPress: () => void; primary?: boolean; flex?: number; minWidth?: number }) {
  const { c, t } = useTheme();
  return (
    <Tap label={label} onPress={onPress} style={{ flex, minWidth, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: primary ? t.acc : c('ctl2'), paddingHorizontal: 12 }} pressedStyle={{ backgroundColor: primary ? t.accHi : c('ctlHi') }}>
      <Txt size={13.5} weight={primary ? 700 : 600} color={primary ? 'accInk' : 'tx3'} align="center">{text}</Txt>
    </Tap>
  );
}
