// Screen switch + overlays. The prototype swaps screens on `state.screen`; there is no navigator.

import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useView } from './store/useStore';
import { useTheme } from './ui/theme';
import { MainScreen } from './screens/MainScreen';
import { IconButton, Num, Txt } from './ui/primitives';

function Placeholder({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ paddingTop: 6, paddingHorizontal: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18 }}>
        <IconButton label="Back" glyph="‹" glyphSize={20} fg="tx4" onPress={onBack} />
        <Num size={23} weight={800} ls={-0.5}>{title}</Num>
      </View>
      <Txt size={13} color="mut3">Coming in a later step.</Txt>
    </View>
  );
}

export function Root() {
  const v = useView();
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {v.isMain ? <MainScreen /> : null}
      {v.isHistory ? <Placeholder title="History" onBack={v.goMain} /> : null}
      {v.isLibrary ? <Placeholder title="Exercises" onBack={v.goMain} /> : null}
      {v.isSettings ? <Placeholder title="Settings" onBack={v.goMain} /> : null}
    </View>
  );
}
