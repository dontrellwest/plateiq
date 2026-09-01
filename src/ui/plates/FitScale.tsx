// Plate rows are fixed-size children in a fixed-width well. A heavy load or a wide specialty bar
// overflows, so measure what the row actually occupies and scale it down just enough to fit —
// never crop (README "Interactions & motion").

import React, { useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

export function FitScale({ base = 1, children, style, breathing = 12 }: { base?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; breathing?: number }) {
  const [avail, setAvail] = useState(0);
  const [need, setNeed] = useState(0);
  const usable = avail - breathing;
  const scale = need > 0 && avail > 0 && need * base > usable ? Math.min(base, usable / need) : base;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setAvail(e.nativeEvent.layout.width)}
      style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <View
        onLayout={(e: LayoutChangeEvent) => setNeed(e.nativeEvent.layout.width)}
        style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', transform: [{ scale }] }}
      >
        {children}
      </View>
    </View>
  );
}
