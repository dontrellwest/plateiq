// Log sheet (README screen 5): "What you actually did" — weight/reps steppers seeded from the plan,
// "Went to plan" reset, Save.

import React from 'react';
import { View } from 'react-native';
import type { useView } from '../../store/useStore';
import { Num, Txt } from '../primitives';
import { useTheme } from '../theme';
import { Sheet, SheetButton, SquareStep } from './Sheet';

type V = ReturnType<typeof useView>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd'), borderRadius: 18, paddingVertical: 12, paddingHorizontal: 13 }}>
      <Txt size={11.5} weight={500} color="mut3">{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>{children}</View>
    </View>
  );
}

export function LogSheet({ v }: { v: V }) {
  const ls = v.logSheet;
  return (
    <Sheet
      title="What you actually did"
      a11yLabel="Edit logged set"
      onClose={ls.close}
      intro={ls.title + ' · ' + ls.planLine + '. Sets rarely go exactly to plan — record the real thing and the trend stays honest.'}
    >
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Field label="Weight lifted">
          <SquareStep glyph="–" label="Lower logged weight" onPress={ls.wDown} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Num size={26} weight={800} ls={-0.8}>{ls.w}</Num>
            <Txt size={11} weight={600} color="mut3">{v.unit}</Txt>
          </View>
          <SquareStep glyph="+" label="Raise logged weight" onPress={ls.wUp} />
        </Field>
        <Field label="Reps completed">
          <SquareStep glyph="–" label="One rep fewer" onPress={ls.rDown} />
          <Num size={26} weight={800} ls={-0.8}>{ls.r}</Num>
          <SquareStep glyph="+" label="One rep more" onPress={ls.rUp} />
        </Field>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SheetButton label="Reset to the planned numbers" text="Went to plan" onPress={ls.reset} />
        <SheetButton label="Save logged set" text="Save" onPress={ls.close} primary />
      </View>
    </Sheet>
  );
}
