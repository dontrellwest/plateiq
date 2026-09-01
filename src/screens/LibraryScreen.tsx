// Exercise library (README screen 8): search, exercise rows (mode · tag, last top set, +/✓ queue button).

import React from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import type { useView } from '../store/useStore';
import { IconButton, Num, Tap, Txt } from '../ui/primitives';
import { SCREEN_PAD, useTheme } from '../ui/theme';

type V = ReturnType<typeof useView>;

export function LibraryScreen({ v }: { v: V }) {
  const { c } = useTheme();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 6, paddingHorizontal: SCREEN_PAD, paddingBottom: 46 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
        <IconButton label="Back" glyph="‹" glyphSize={20} fg="tx4" onPress={v.goMain} />
        <View>
          <Num size={23} weight={800} ls={-0.5} lh={25} accessibilityRole="header">Exercises</Num>
          <Txt size={12.5} color="mut3" style={{ marginTop: 2 }}>Pick one to load it on the bar</Txt>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c('card'), borderWidth: 1, borderColor: c('bd'), borderRadius: 14, paddingHorizontal: 13, height: 46, marginBottom: 14 }}>
        <Txt size={14} color="mut5">⌕</Txt>
        <TextInput
          accessibilityLabel="Search exercises"
          value={v.search}
          onChangeText={v.onSearch}
          placeholder="Search exercises"
          placeholderTextColor={c('mut4')}
          autoCorrect={false}
          returnKeyType="search"
          style={[{ flex: 1, minWidth: 0, color: c('tx2'), fontSize: 13.5, padding: 0 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as object) : null]}
        />
        <Tap label="Clear search" onPress={v.clearSearch} disabled={!v.hasSearch} accessibilityElementsHidden={!v.hasSearch} style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: c(v.clearBg), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{}}>
          <Txt size={12} color={v.clearFg}>✕</Txt>
        </Tap>
      </View>
      {v.noResults ? <Txt size={13} color="mut3" align="center" style={{ paddingVertical: 26, paddingHorizontal: 6 }}>No exercise matches that. Try press, squat or dumbbell.</Txt> : null}

      <View style={{ gap: 9 }}>
        {v.exercises.map((x) => (
          <Tap key={x.name} label={x.name + ', ' + x.modeLabel + ' · ' + x.tag + ', last top set ' + x.lastLabel + (x.active ? ', current' : '')} onPress={x.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c(x.cardBg), borderWidth: 1, borderColor: c(x.cardBd), borderRadius: 18, paddingVertical: 13, paddingHorizontal: 14 }} pressedStyle={{ borderColor: c('bd3') }}>
            <View style={{ flex: 1 }}>
              <Num size={16} weight={700} color="tx2" ls={-0.2}>{x.name}</Num>
              <Txt size={12} color="mut3" style={{ marginTop: 3 }}>{x.modeLabel} · {x.tag}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Num size={14.5} weight={700} color="mut">{x.lastLabel}</Num>
              <Txt size={10.5} color="mut4" style={{ marginTop: 2 }}>last top set</Txt>
            </View>
            <Tap label={x.queueAria} onPress={x.queue} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c(x.queueBg), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
              <Txt size={16} weight={700} color={x.queueFg}>{x.queueMark}</Txt>
            </Tap>
          </Tap>
        ))}
      </View>
    </ScrollView>
  );
}
