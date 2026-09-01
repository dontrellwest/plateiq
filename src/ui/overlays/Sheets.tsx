// The remaining sheets (README screen 10): bar picker, scheme picker, reverse reader, 1RM
// calculator, plate rack.

import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { useView } from '../../store/useStore';
import { GradientBox, Num, Tap, Txt } from '../primitives';
import { useTheme } from '../theme';
import { BarArt } from '../plates/BarArt';
import { RackRows } from '../RackRows';
import { Sheet, SheetButton, SquareStep } from './Sheet';
import { Toggle } from '../../screens/SettingsScreen';

type V = ReturnType<typeof useView>;

function Mark({ bg, bd, fg }: { bg: string; bd: string; fg: string }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: c(bg), borderWidth: 1.5, borderColor: c(bd), alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={12} weight={800} color={fg}>✓</Txt>
    </View>
  );
}

export function BarSheet({ v }: { v: V }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet title="Which bar?" a11yLabel="Choose a bar" onClose={v.closeSheet} scroll maxHeight={height * 0.82} modal={!v.tourOn}
      intro="Sleeve length matters as much as bar weight — an EZ bar runs out of room around three plates a side.">
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {v.barProfileOptions.map((b) => (
          <Tap key={b.id} label={b.name + ', ' + b.v + ' ' + v.unit + ', ' + b.note + ', ' + b.sleeveNote} role="radio" selected={b.on} onPress={b.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: c(b.bg), borderWidth: 1, borderColor: c(b.bd), borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, minHeight: 44 }} pressedStyle={{ opacity: 0.85 }}>
            <BarArt parts={b.artParts} vbW={b.artVbW} vbH={b.artVbH} w={b.artW} h={b.artH} flat />
            <View style={{ flex: 1 }}>
              <Txt size={14.5} weight={600}>{b.name}</Txt>
              <Txt size={11.5} color="mut3" style={{ marginTop: 2 }}>{b.note} · {b.sleeveNote}</Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <Num size={19} weight={700} color="tx2">{b.v}</Num>
              <Txt size={11} weight={600} color="mut4">{v.unit}</Txt>
            </View>
            <Mark bg={b.markBg} bd={b.markBd} fg={b.markFg} />
          </Tap>
        ))}
      </View>
      <Txt size={11.5} lh={17} color="mut4" style={{ marginTop: 14 }}>Typing a weight into the bar field keeps that number and marks the bar custom.</Txt>
    </Sheet>
  );
}

export function SchemeSheet({ v }: { v: V }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet title="After the top set" a11yLabel="Choose a set scheme" onClose={v.closeSheet} scroll maxHeight={height * 0.82} modal={!v.tourOn}
      intro="Warm-ups stay the same. This only decides what gets added below your top set — and every set is solved with the same plate maths.">
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {v.schemeOptions.map((s) => (
          <Tap key={s.id} label={s.name + ', ' + s.note + ', ' + s.shape} role="radio" selected={s.on} onPress={s.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: c(s.bg), borderWidth: 1, borderColor: c(s.bd), borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, minHeight: 44 }} pressedStyle={{ opacity: 0.85 }}>
            <View style={{ flex: 1 }}>
              <Txt size={14.5} weight={600}>{s.name}</Txt>
              <Txt size={11.5} color="mut3" style={{ marginTop: 2 }}>{s.note}</Txt>
            </View>
            <Txt size={11.5} color="mut4" style={{ fontVariant: ['tabular-nums'] }}>{s.shape}</Txt>
            <Mark bg={s.markBg} bd={s.markBd} fg={s.markFg} />
          </Tap>
        ))}
      </View>
    </Sheet>
  );
}

function MiniPlate({ p }: { p: V['revLeft'][number] }) {
  return (
    <GradientBox w={p.w} h={p.h} radius={3} border={p.skin.bd} stops={[{ offset: 0, color: p.skin.stops[0] }, { offset: p.skin.mid, color: p.skin.stops[1] }, { offset: 1, color: p.skin.stops[2] }]} style={{ alignItems: 'center', justifyContent: 'center', marginHorizontal: 0.5 }}>
      {p.label ? <Num size={p.fs} weight={800} color={p.skin.fg}>{p.label}</Num> : null}
    </GradientBox>
  );
}

export function ReverseSheet({ v }: { v: V }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet title="What’s on the bar?" a11yLabel="Read a loaded bar" onClose={v.closeSheet} scroll maxHeight={height * 0.88} modal={!v.tourOn}
      intro="Tap the plates on one sleeve. PlateIQ does the doubling and adds the bar.">
      <View style={{ backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd'), borderRadius: 20, paddingVertical: 16, paddingHorizontal: 14, marginBottom: 14 }}>
        <View accessible accessibilityRole="image" accessibilityLabel={v.revSideLabel + ', ' + v.revTotal + ' ' + v.unit + ' total'} style={{ height: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c('well2'), borderRadius: 14, overflow: 'hidden' }}>
          {v.revLeft.map((p, i) => <MiniPlate key={'l' + i} p={p} />)}
          <GradientBox w={v.barLen} h={9} radius={2} stops={[{ offset: 0, color: '#8d959e' }, { offset: 1, color: '#5a6169' }]} />
          {v.revRight.map((p, i) => <MiniPlate key={'r' + i} p={p} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
          <Txt size={12} color="mut3" style={{ flexShrink: 1 }}>{v.revSideLabel}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Num size={38} weight={800} ls={-1.4} lh={40}>{String(v.revTotal)}</Num>
            <Txt size={12.5} weight={600} color="mut3">{v.unit}</Txt>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {v.revButtons.map((b) => (
          <Tap key={b.w} label={'Add a ' + b.label + ' ' + v.unit + ' plate'} onPress={b.add} style={{ minWidth: 52, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: b.skin.bd, backgroundColor: b.skin.stops[1], alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ opacity: 0.85 }}>
            <GradientBox style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} stops={[{ offset: 0, color: b.skin.stops[0] }, { offset: b.skin.mid, color: b.skin.stops[1] }, { offset: 1, color: b.skin.stops[2] }]} />
            <Num size={14} weight={800} color={b.skin.fg}>{b.label}</Num>
          </Tap>
        ))}
      </View>

      {v.revAny ? (
        <View style={{ marginTop: 14 }}>
          <Txt size={11} weight={700} color="mut3" ls={0.55} style={{ marginBottom: 7 }}>ON THE SLEEVE — TAP TO REMOVE</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {v.revChips.map((ch, i) => (
              <Tap key={i} label={'Remove the ' + ch.label + ' ' + v.unit + ' plate'} onPress={ch.drop} minSize={40} style={{ minHeight: 40, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, backgroundColor: c('ctl2') }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
                <Num size={13} weight={700} color="tx4">{ch.label}</Num>
                <Txt size={12} weight={600} color="mut4">✕</Txt>
              </Tap>
            ))}
          </View>
        </View>
      ) : (
        <Txt size={12} lh={18} color="mut4" style={{ marginTop: 14 }}>Nothing on the sleeve yet — that’s a bare {v.revTotal} {v.unit}.</Txt>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
        <Tap label="Clear the sleeve" onPress={v.revClear} style={{ width: 96, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: c('ctl2') }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
          <Txt size={14} weight={600} color="tx4">Clear</Txt>
        </Tap>
        <SheetButton label={v.revApplyLabel} text={v.revApplyLabel} onPress={v.revApply} primary />
      </View>
    </Sheet>
  );
}

function RmRow({ label, value, down, up, downLabel, upLabel }: { label: string; value: string; down: () => void; up: () => void; downLabel: string; upLabel: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd'), borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }}>
      <Txt size={13.5} weight={600} color="tx3">{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SquareStep glyph="–" label={downLabel} onPress={down} size={44} radius={13} bg="ctl3" />
        <Num size={19} weight={700} align="center" style={{ minWidth: 64 }} accessibilityLabel={label + ' ' + value}>{value}</Num>
        <SquareStep glyph="+" label={upLabel} onPress={up} size={44} radius={13} bg="ctl3" />
      </View>
    </View>
  );
}

export function RmSheet({ v }: { v: V }) {
  const { c, t } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet title="Set from 1RM" a11yLabel="Set the target from a one rep max" onClose={v.closeSheet} scroll maxHeight={height * 0.88} modal={!v.tourOn}
      intro="Enter any recent set. RPE tells PlateIQ how much you had left, so a submaximal set still estimates well.">
      <View style={{ gap: 8 }}>
        <RmRow label="Weight" value={v.rmW} down={v.rmWDown} up={v.rmWUp} downLabel="Lower weight" upLabel="Raise weight" />
        <RmRow label="Reps" value={v.rmR} down={v.rmRDown} up={v.rmRUp} downLabel="One rep fewer" upLabel="One rep more" />
        <RmRow label="RPE" value={v.rmRpe} down={v.rmRpeDown} up={v.rmRpeUp} downLabel="Lower RPE" upLabel="Raise RPE" />
      </View>
      <View style={{ marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: c('accA28'), overflow: 'hidden' }}>
        <GradientBox style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} stops={[{ offset: 0, color: t.accDim.startsWith('rgba') ? t.acc : t.accDim, opacity: t.accDim.startsWith('rgba') ? 0.1 : 1 }, { offset: 1, color: t.accCard2 }]} />
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Txt size={12} weight={700} color="accDeep" ls={0.48}>ESTIMATED 1RM</Txt>
            <Txt size={12} lh={17} color="heroMut" style={{ marginTop: 5 }}>{v.e1rmNote}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Num size={38} weight={800} ls={-1.4} lh={40} color="accDeep">{v.e1rm}</Num>
            <Txt size={12.5} weight={600} color="heroMut">{v.unit}</Txt>
          </View>
        </View>
      </View>
      <Txt size={11} weight={700} color="mut3" ls={0.55} style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 2 }}>PICK A WORKING PERCENTAGE</Txt>
      <View style={{ gap: 7 }}>
        {v.pctRows.map((r) => (
          <Tap key={r.pct} label={r.pct + ' of your estimated max, ' + r.weight + ' ' + v.unit + ', ' + r.note} onPress={r.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, backgroundColor: c('card2'), borderWidth: 1, borderColor: c('bd'), borderRadius: 15, paddingVertical: 9, paddingHorizontal: 14 }} pressedStyle={{ borderColor: c('accA45') }}>
            <Num size={15} weight={700} color="tx3" style={{ width: 46 }}>{r.pct}</Num>
            <Txt size={11.5} color={r.exactFg} style={{ flex: 1 }}>{r.note}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <Num size={20} weight={700}>{r.weight}</Num>
              <Txt size={11} weight={600} color="mut4">{v.unit}</Txt>
            </View>
          </Tap>
        ))}
      </View>
    </Sheet>
  );
}

export function RackSheet({ v }: { v: V }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Sheet title="Plate rack" a11yLabel="Plate rack" onClose={v.closeSheet} scroll maxHeight={height * 0.86} modal={!v.tourOn}
      intro="Count individual plates, not pairs — a barbell needs two of a size to load evenly. Only reachable loads will be suggested.">
      <Tap label={'Home gym mode, ' + (v.homeGym ? 'on' : 'off') + '. Limit loads to the plates I own'} role="switch" accessibilityState={{ checked: v.homeGym }} onPress={v.toggleHome} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c(v.homeCardBg), borderWidth: 1, borderColor: c(v.homeCardBd), borderRadius: 18, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8 }} pressedStyle={{ opacity: 0.85 }}>
        <View pointerEvents="none"><Toggle on={v.homeGym} label="Home gym mode" onPress={v.toggleHome} /></View>
        <View>
          <Txt size={14} weight={600}>Home gym mode</Txt>
          <Txt size={12} color="mut3" style={{ marginTop: 2 }}>Limit loads to the plates I own</Txt>
        </View>
      </Tap>
      <View style={{ marginTop: 8 }}>
        <RackRows rows={v.rackRows} unit={v.unit} editable={v.homeGym} bg="card2" />
      </View>
      <SheetButton label="Done" text="Done" onPress={v.closeSheet} primary />
    </Sheet>
  );
}
