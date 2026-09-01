// Plate rack editor rows — shared by onboarding's "Which plates do you own?" step and the rack sheet.

import React from 'react';
import { View } from 'react-native';
import type { useView } from '../store/useStore';
import { GradientBox, Hairline, Num, Tap, Txt } from './primitives';
import { useTheme } from './theme';

type Row = ReturnType<typeof useView>['rackRows'][number];

function QtyButton({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Tap label={label} onPress={onPress} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c('ctl3'), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctlHi2') }}>
      <Txt size={17} color="tx3">{glyph}</Txt>
    </Tap>
  );
}

export function RackRows({ rows, unit, gap = 8 }: { rows: Row[]; unit: string; gap?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ gap }}>
      {rows.map((r) => (
        <React.Fragment key={r.w}>
          {r.microHead ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginHorizontal: 2, marginBottom: 2 }}>
              <Txt size={11.5} weight={700} color="mut3" ls={0.58}>MICROPLATES</Txt>
              <Hairline color="bd4" style={{ flex: 1 }} />
            </View>
          ) : null}
          <View
            accessible
            accessibilityLabel={r.label + ' ' + unit + ' plates, ' + r.qty + ' owned, ' + r.note}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c('card'), borderWidth: 1, borderColor: c('bd'), borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}
          >
            <GradientBox
              w={r.width} h={44} radius={5} border={r.skin.bd} topLight="rgba(255,255,255,.28)"
              stops={[{ offset: 0, color: r.skin.stops[0] }, { offset: r.skin.mid, color: r.skin.stops[1] }, { offset: 1, color: r.skin.stops[2] }]}
            />
            <View style={{ flex: 1 }}>
              <Num size={16} weight={700}>{r.label} {unit}</Num>
              <Txt size={11.5} color="mut3" style={{ marginTop: 1 }}>{r.note}</Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <QtyButton glyph="–" label={'One fewer ' + r.label + ' ' + unit + ' plate'} onPress={r.dec} />
              <Num size={16} weight={700} align="center" style={{ width: 28 }}>{String(r.qty)}</Num>
              <QtyButton glyph="+" label={'One more ' + r.label + ' ' + unit + ' plate'} onPress={r.inc} />
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
