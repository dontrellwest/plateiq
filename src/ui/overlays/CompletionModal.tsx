// Completion modal (README screen 6): per-set actual-vs-planned summary, "Next · <lift>" callout,
// Discard / "Log & go to <lift>".

import React from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { useView } from '../../store/useStore';
import { Num, Txt } from '../primitives';
import { MOTION, useTheme } from '../theme';
import { useSlideUp } from '../motion';
import { SheetButton } from './Sheet';

type V = ReturnType<typeof useView>;

export function CompletionModal({ v }: { v: V }) {
  const { c, reduceMotion } = useTheme();
  const slide = useSlideUp(MOTION.ring, reduceMotion);
  return (
    <View accessibilityViewIsModal accessibilityLabel="Exercise complete" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(0,0,0,.62)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Animated.View style={[{ width: '100%', backgroundColor: c('card'), borderWidth: 1, borderColor: c('bd2'), borderRadius: 26, paddingTop: 26, paddingHorizontal: 22, paddingBottom: 20, alignItems: 'center' }, slide]}>
        <View style={{ width: 54, height: 54, borderRadius: 99, backgroundColor: c('accA14'), borderWidth: 1, borderColor: c('accA40'), alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Txt size={24} color="accDeep">✓</Txt>
        </View>
        <Num size={23} weight={700} ls={-0.3} align="center">{v.exercise} done</Num>
        <Txt size={13} lh={19.5} color="mut3" align="center" style={{ marginTop: 6 }}>Top set loaded at {v.finishedAt}</Txt>

        <ScrollView style={{ maxHeight: 196, alignSelf: 'stretch', marginTop: 16 }} contentContainerStyle={{ gap: 2 }}>
          {v.doneSummary.map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 7, paddingHorizontal: 2, borderBottomWidth: 1, borderColor: c('bd4') }}>
              <Txt size={12.5} color="mut2" numberOfLines={1} style={{ flex: 1 }}>{d.label}</Txt>
              {d.note ? <Txt size={11} color="mut4">{d.note}</Txt> : null}
              <Num size={14} weight={700} color={d.fg}>{d.val}</Num>
            </View>
          ))}
        </ScrollView>

        {v.hasNextUp ? (
          <View style={{ alignSelf: 'stretch', marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c('accA07'), borderWidth: 1, borderColor: c('accA28') }}>
            <Txt size={12.5} weight={600} color="accDeep">{v.nextUpLabel}</Txt>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
          <SheetButton label="Discard this exercise" text="Discard" onPress={v.resetAll} flex={0} minWidth={110} />
          <SheetButton label={v.finishLabel} text={v.finishLabel} onPress={v.saveSession} primary />
        </View>
      </Animated.View>
    </View>
  );
}
