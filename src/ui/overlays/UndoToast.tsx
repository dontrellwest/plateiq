// Undo toast: shares the bottom slot with the rest panel and stacks above it while a rest runs.

import React from 'react';
import { Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tap, Txt } from '../primitives';
import { useTheme } from '../theme';
import { useSlideUp } from '../motion';
import { TIMER_STACK } from './TimerPanel';

export function UndoToast({ label, aboveTimer, onUndo, onDismiss }: { label: string; aboveTimer: boolean; onUndo: () => void; onDismiss: () => void }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useSlideUp(220, reduceMotion);
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        { position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 10 + (aboveTimer ? TIMER_STACK : 0), flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 16, paddingVertical: 10, paddingLeft: 14, paddingRight: 12, zIndex: 5 },
        Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 17, shadowOffset: { width: 0, height: -8 } }, android: { elevation: 10 }, default: {} }),
        slide,
      ]}
    >
      <Txt size={12.5} weight={500} color="tx3" numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
      <Tap label="Undo the last change" onPress={onUndo} style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11, backgroundColor: c('accA16') }} pressedStyle={{ backgroundColor: c('accA28') }}>
        <Txt size={12.5} weight={700} color="accDeep">Undo</Txt>
      </Tap>
      <Tap label="Dismiss" onPress={onDismiss} style={{ width: 32, height: 32, borderRadius: 99, alignItems: 'center', justifyContent: 'center' }} pressedStyle={{}}>
        <Txt size={12} color="mut4">✕</Txt>
      </Tap>
      <View />
    </Animated.View>
  );
}
