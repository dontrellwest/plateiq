// Main / Calculator (README screen 3). Layout and type follow option 1b's markup; every value
// comes from the ported view model (useView), every control is a Tap with a name.

import React from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { ScrollView as ScrollViewT } from 'react-native';
import { PulseDot } from '../ui/PulseDot';
import { useView } from '../store/useStore';
import { Badge, Card, GradientBox, Hairline, IconButton, Num, Tap, Txt, anchorProps, stop } from '../ui/primitives';
import { ARCHIVO, SCREEN_PAD, useTheme } from '../ui/theme';
import { BarWell, LandmineWell } from '../ui/plates/Wells';
import type { Shaft } from '../ui/plates/Wells';
import { tourUI } from '../ui/tour/tourUI';

type View_ = ReturnType<typeof useView>;
type SetVM = View_['sets'][number];

const PAD = SCREEN_PAD;

// ---- small shared pieces --------------------------------------------------

function SegButton({ label, on, bg, bd, fg, onPress, size = 13, minH, anchor, radius = 14, py = 11 }: { label: string; on: boolean; bg: string; bd: string; fg: string; onPress: () => void; size?: number; minH?: number; anchor?: string; radius?: number; py?: number }) {
  const { c } = useTheme();
  return (
    <Tap
      label={label} role="radio" selected={on} onPress={onPress} {...anchorProps(anchor)}
      style={{ flex: 1, minHeight: minH, paddingVertical: py, paddingHorizontal: 4, borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundColor: c(bg), borderWidth: 1, borderColor: c(bd) }}
    >
      <Txt size={size} weight={600} color={fg} align="center">{label}</Txt>
    </Tap>
  );
}

function Stepper({ glyph, onPress, label, anchor }: { glyph: string; onPress: () => void; label: string; anchor?: string }) {
  const { c } = useTheme();
  return (
    <Tap label={label} onPress={onPress} {...anchorProps(anchor)} style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: c('ctl2'), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
      <Txt size={19} weight={600} color="tx3">{glyph}</Txt>
    </Tap>
  );
}

/** Pill stepper button used inside set cards (40 pt target, 28/26 visual). */
function PillButton({ glyph, onPress, label, w = 40, inner = 28 }: { glyph: string; onPress: () => void; label: string; w?: number; inner?: number }) {
  const { c } = useTheme();
  return (
    <Tap label={label} onPress={onPress} style={{ width: w, height: 40, alignItems: 'center', justifyContent: 'center' }} pressedStyle={{}}>
      {({ pressed }) => (
        <View style={{ width: inner, height: inner, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c('ctlHi') : 'transparent' }}>
          <Txt size={inner === 28 ? 15 : 14} color={pressed ? 'tx' : 'tx5'} lh={inner === 28 ? 15 : 14}>{glyph}</Txt>
        </View>
      )}
    </Tap>
  );
}

function AddSetButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Tap label="Add warm-up set" onPress={onPress} style={{ minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c('bd3') }} pressedStyle={{ borderColor: c('accA40') }}>
      <Txt size={13} weight={600} color="mut2">+ Add warm-up set</Txt>
    </Tap>
  );
}

function NumberField({ value, onChange, onCommit, size, weight, width, ls, label, dashed, align, flex }: { value: string; onChange: (v: string) => void; onCommit: () => void; size: number; weight: 700 | 800; width?: number; ls?: number; label: string; dashed: string; align?: 'center' | 'left'; flex?: number }) {
  const { c } = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocus(true)}
      onBlur={() => { setFocus(false); onCommit(); }}
      onSubmitEditing={onCommit}
      selectTextOnFocus
      keyboardType="decimal-pad"
      returnKeyType="done"
      style={[
        {
          fontFamily: ARCHIVO[weight], fontSize: size, color: c('tx'), letterSpacing: ls, padding: 0, margin: 0,
          width, flex, minWidth: 0, textAlign: align, fontVariant: ['tabular-nums'],
          borderBottomWidth: 1, borderStyle: focus ? 'solid' : 'dashed', borderBottomColor: focus ? c('acc') : c(dashed),
          lineHeight: Math.round(size * 1.15),
        },
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as object) : null,
      ]}
    />
  );
}

// ---- set card -------------------------------------------------------------

function SetCard({ s, v }: { s: SetVM; v: View_ }) {
  const { c, t } = useTheme();
  const shaft: Shaft = { straight: v.barStraight, h: v.shaftH, parts: v.shaftParts, boxW: v.shaftBoxW, boxH: v.shaftBoxH };
  return (
    <Tap
      label={s.aria} onPress={s.tap} {...anchorProps('set-' + s.idx)}
      style={{ overflow: 'hidden', backgroundColor: c(s.cardBg), borderWidth: 1, borderColor: c(s.cardBd), borderRadius: 20, paddingTop: 13, paddingHorizontal: 14, paddingBottom: 11, opacity: s.opacity }}
      pressedStyle={{ opacity: Math.max(0.6, s.opacity - 0.15) }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c(s.rail) }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 11, alignItems: 'center', flexShrink: 1 }}>
          <View style={{ width: 27, height: 27, borderRadius: 99, borderWidth: 1, borderColor: c(s.numBd), backgroundColor: c(s.numBg), alignItems: 'center', justifyContent: 'center' }}>
            <Num size={12.5} weight={700} color={s.numFg}>{s.n}</Num>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40 }}>
              <Num size={16.5} weight={700} color={s.titleFg} ls={-0.2}>{s.label}</Num>
              {s.editable ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: c('ctl'), borderRadius: 99, padding: 2 }}>
                  <PillButton glyph="–" label={'Lower ' + s.label + ' by 5 percent'} onPress={s.pctDown!} />
                  <PillButton glyph="+" label={'Raise ' + s.label + ' by 5 percent'} onPress={s.pctUp!} />
                </View>
              ) : null}
              {s.badge ? <Badge text={s.badge} bg={s.badgeBg} fg={s.badgeFg} /> : null}
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, justifyContent: 'flex-end' }}>
            <Num size={26} weight={800} color={s.weightFg} ls={-0.8} lh={28}>{s.main}</Num>
            <Txt size={11} weight={600} color="mut3">{v.unit}</Txt>
          </View>
          <Txt size={11} color="mut4" style={{ marginTop: 3 }}>{s.sub}</Txt>
        </View>
      </View>

      {s.readOnly ? (
        <Txt size={11.5} color="mut3" style={{ marginTop: 5, fontVariant: ['tabular-nums'] }}>{s.repsLabel} · {s.restLabel} rest</Txt>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c('ctl'), borderRadius: 99 }}>
            <PillButton glyph="–" label="One rep fewer" onPress={s.repsDown!} w={38} inner={26} />
            <Txt size={11.5} weight={600} color="tx4" align="center" style={{ minWidth: 42, fontVariant: ['tabular-nums'] }}>{s.reps} reps</Txt>
            <PillButton glyph="+" label="One rep more" onPress={s.repsUp!} w={38} inner={26} />
          </View>
          <Tap label={'Rest ' + s.restLabel + ', tap to change'} onPress={s.restTap!} style={{ flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 13, borderRadius: 99, backgroundColor: c('ctl') }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
            <Txt size={11.5} weight={600} color="tx4" style={{ fontVariant: ['tabular-nums'] }}>{s.restLabel}</Txt>
            <Txt size={11.5} weight={600} color="mut2" style={{ marginLeft: 4 }}>rest</Txt>
          </Tap>
          <Tap label={'Remove ' + s.label} onPress={s.remove!} style={{ height: 40, paddingHorizontal: 13, borderRadius: 99, backgroundColor: c('danA11'), alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }} pressedStyle={{ backgroundColor: c('danA22') }}>
            <Txt size={11.5} weight={600} color="dan">Remove</Txt>
          </Tap>
        </View>
      )}

      {s.hasLog ? <LoggedRow s={s} /> : null}

      <View style={{ marginTop: 9 }}>
        {v.isLandmine ? (
          <LandmineWell right={s.right} hero={false} anchor={v.isRackAnchor ? 'rack' : v.isHingeAnchor ? 'hinge' : 'sleeve'} rotate={v.rotate} pivotX={v.wPivotX} pivotY={v.wPivotY} height={v.wellH} aria={s.aria} />
        ) : (
          <BarWell left={s.left} right={s.right} shaft={shaft} hero={false} units={v.dbUnits} gap={v.dbGap} barLen={110} scale={v.setScale} height={v.wellH} aria={s.aria} />
        )}
        {s.empty ? <Txt size={11} weight={500} color="mut4" style={{ position: 'absolute', left: 12, top: 10 }}>Bar only</Txt> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 9 }}>
        <Txt size={12} color="mut3" numberOfLines={1} style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{s.chips}</Txt>
        <Txt size={11.5} weight={600} color={s.ctaFg}>{s.cta}</Txt>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 0, backgroundColor: t.transparent }} />
    </Tap>
  );
}

function LoggedRow({ s }: { s: SetVM }) {
  const { c } = useTheme();
  return (
    <Tap label={'Edit what you logged for ' + s.label + ': ' + s.logText} onPress={s.editLog} {...anchorProps('log-' + s.idx)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, marginTop: 8, paddingHorizontal: 11, borderRadius: 12, backgroundColor: c(s.logBg), borderWidth: 1, borderColor: c(s.logBd) }}>
      <Txt size={10} weight={800} ls={0.7} color={s.logFg}>LOGGED</Txt>
      <Num size={13.5} weight={700} color={s.logFg}>{s.logText}</Num>
      {s.logVaried ? <Txt size={11} color="mut3" numberOfLines={1} style={{ flexShrink: 1 }}>{s.logPlan}</Txt> : null}
      <Txt size={11.5} weight={600} color="mut2" style={{ marginLeft: 'auto' }}>Edit</Txt>
    </Tap>
  );
}

// ---- hero -----------------------------------------------------------------

function HeroCard({ v }: { v: View_ }) {
  const { c, t } = useTheme();
  const w = v.work;
  const shaft: Shaft = { straight: v.barStraight, h: v.shaftH, parts: v.shaftParts, boxW: v.shaftBoxW, boxH: v.shaftBoxH };
  return (
    <Tap
      label={'Top set. ' + w.aria + '. Tap when done to start the rest timer'} onPress={v.tapWork} {...anchorProps('set-' + v.workIndex)}
      style={[{ borderRadius: 22, borderWidth: 1, borderColor: c('accA28'), overflow: 'hidden' }, Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }, default: {} })]}
      pressedStyle={{ opacity: 0.9 }}
    >
      <GradientBox style={StyleSheet.absoluteFill} stops={[stop(0, t.accDim), stop(1, t.accCard2)]} />
      <View style={{ paddingTop: 15, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <PulseDot />
              <Txt size={12} weight={700} color="accDeep" ls={0.48}>TOP SET</Txt>
            </View>
            <Txt size={12.5} color="heroMut" style={{ marginTop: 5 }}>{w.reps} reps · {w.restLabel} rest</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, justifyContent: 'flex-end' }}>
              <Num size={40} weight={800} color="accDeep" ls={-1.5} lh={43}>{w.main}</Num>
              <Txt size={13} weight={600} color="heroMut">{v.unit}</Txt>
            </View>
            <Txt size={11.5} color="mut3" style={{ marginTop: 4 }}>{w.sub}</Txt>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          {v.isLandmine ? (
            <LandmineWell right={w.right} hero anchor={v.isRackAnchor ? 'rack' : v.isHingeAnchor ? 'hinge' : 'sleeve'} rotate={v.rotate} pivotX={v.pivotX} pivotY={v.pivotY} height={v.workWellH} aria={w.aria} />
          ) : (
            <BarWell left={w.left} right={w.right} shaft={shaft} hero units={v.dbUnits} gap={v.dbGap} barLen={120} height={v.workWellH} aria={w.aria} />
          )}
          {w.shortNote ? (
            <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c('warnSh'), borderWidth: 1, borderColor: c('warnA42'), borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 }}>
              <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: c('warn'), alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={10} weight={800} color="warnInk">!</Txt>
              </View>
              <Txt size={11.5} lh={15.5} color="warnTx" style={{ flex: 1 }}>{w.shortNote}</Txt>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 11 }}>
          <Txt size={12} color="heroMut" numberOfLines={1} style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{w.chips}</Txt>
          <Txt size={11.5} weight={600} color="accDeep">{w.cta}</Txt>
        </View>
        {w.hasLog ? <LoggedRow s={w} /> : null}
      </View>
    </Tap>
  );
}

// ---- screen ---------------------------------------------------------------


export function MainScreen() {
  const v = useView();
  const { c, t } = useTheme();
  const cards = v.sets;
  return (
    <ScrollView
      ref={(r: ScrollViewT | null) => { tourUI.feed.ref = r; }}
      onContentSizeChange={(_w: number, h: number) => { tourUI.feed.height = h; }}
      style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 220 }} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
    >
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingHorizontal: PAD, paddingBottom: 14 }}>
        <Tap label={'Exercise: ' + v.exercise + '. Open the exercise library'} onPress={v.goLibrary} pressedStyle={{ opacity: 0.7 }}>
          <Num size={23} weight={800} ls={-0.5} lh={25}>PlateIQ</Num>
          <Txt size={12.5} color="mut3" style={{ marginTop: 2 }}>{v.exerciseLine} <Txt size={12.5} color="mut5">▾</Txt></Txt>
        </Tap>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton label="History" glyph="⏱" onPress={v.openHistory} anchor="nav-history" />
          <IconButton label="Settings" glyph="⚙" glyphSize={16} onPress={v.openSettings} />
        </View>
      </View>

      {/* session queue */}
      {v.hasSession ? (
        <View style={{ paddingHorizontal: PAD, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
            <Txt size={11} weight={600} color="mut3" ls={0.33}>{v.sessionPosLabel}</Txt>
            <Tap label="Edit session queue" onPress={v.goLibrary} minSize={40}><Txt size={11.5} weight={600} color="mut2">Edit ›</Txt></Tap>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
            {v.sessionChips.map((ch) => (
              <Tap key={ch.name} label={ch.aria} onPress={ch.pick} role="button" selected={ch.isCur} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 13, borderRadius: 13, backgroundColor: c(ch.bg), borderWidth: 1, borderColor: c(ch.bd), opacity: ch.opacity }}>
                <Num size={10.5} weight={800} color={ch.markFg}>{ch.mark}</Num>
                <Txt size={12.5} weight={600} color={ch.fg}>{ch.name}</Txt>
              </Tap>
            ))}
            <Tap label="Open the exercise library" onPress={v.goLibrary} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: c('bd3') }}>
              <Txt size={15} color="mut2" lh={16}>+</Txt>
              <Txt size={13} weight={600} color="mut2">Exercise</Txt>
            </Tap>
          </ScrollView>
        </View>
      ) : null}

      {/* mode */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: PAD, paddingBottom: 16 }} accessibilityRole="radiogroup">
        {v.modes.map((m) => <SegButton key={m.id} label={m.label} on={m.on} bg={m.bg} bd={m.bd} fg={m.fg} onPress={m.pick} anchor={'mode-' + m.id} py={10.5} />)}
      </View>

      {v.isDumbbell ? (
        <View style={{ paddingHorizontal: PAD, paddingBottom: 14 }}>
          <Txt size={11} weight={600} color="mut3" style={{ marginBottom: 7 }}>Loading — one dumbbell or a matched pair</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
            {v.dbOptions.map((o) => <SegButton key={o.label} label={o.label} on={o.on} bg={o.bg} bd={o.bd} fg={o.fg} onPress={o.pick} size={12.5} minH={40} radius={12} py={11} />)}
          </View>
        </View>
      ) : null}
      {v.isLandmine ? (
        <View style={{ paddingHorizontal: PAD, paddingBottom: 14 }}>
          <Txt size={11} weight={600} color="mut3" style={{ marginBottom: 7 }}>Anchor setup — how your landmine is grounded</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup">
            {v.anchorOptions.map((o) => <SegButton key={o.id} label={o.label} on={o.on} bg={o.bg} bd={o.bd} fg={o.fg} onPress={o.pick} size={11.5} minH={40} radius={12} py={9} />)}
          </View>
        </View>
      ) : null}

      {/* bar + target */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: PAD, paddingBottom: 14 }}>
        <Card style={{ width: 138 }} pad={[12, 13]}>
          <Txt size={11.5} weight={500} color="mut3">{v.barLabel}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 5 }}>
            <NumberField label={v.barLabel + ' weight'} value={v.barDraft} onChange={v.onBarInput} onCommit={v.commitBar} size={v.barFs} weight={700} flex={1} dashed="bd6" />
            <Txt size={11} weight={600} color="mut3">{v.unit}</Txt>
          </View>
          {v.notDumbbell ? (
            <Tap label={'Bar: ' + v.barProfileName + ', ' + v.barProfileNote + '. Choose a bar'} onPress={v.openBarSheet} style={{ marginTop: 9, minHeight: 40, borderRadius: 11, backgroundColor: c('ctl2'), paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }} pressedStyle={{ backgroundColor: c('ctlHi') }}>
              <View style={{ flexShrink: 1 }}>
                <Txt size={11.5} weight={600} color="tx4" numberOfLines={1}>{v.barProfileName}</Txt>
                <Txt size={10} color="mut4" numberOfLines={1} style={{ marginTop: 1 }}>{v.barProfileNote}</Txt>
              </View>
              <Txt size={13} color="mut4">›</Txt>
            </Tap>
          ) : (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 9 }} accessibilityRole="radiogroup">
              {v.barOptions.map((b) => (
                <Tap key={b.v} label={b.v + ' ' + v.unit + ' handle'} role="radio" selected={b.on} onPress={b.pick} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c(b.bg) }}>
                  <Txt size={12} weight={600} color={b.fg}>{b.v}</Txt>
                </Tap>
              ))}
            </View>
          )}
        </Card>
        <Card style={{ flex: 1 }} pad={[12, 13]}>
          <Txt size={11.5} weight={500} color="mut3">{v.targetLabel}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <Stepper glyph="–" label={'Lower ' + v.targetLabel.toLowerCase()} onPress={v.decWorking} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flex: 1, justifyContent: 'center', marginHorizontal: 4 }}>
              <NumberField label={v.targetLabel} value={v.workDraft} onChange={v.onWorkInput} onCommit={v.commitWork} size={v.workFs} weight={800} width={v.workW} ls={-1} dashed="bd5" align="center" />
              <Txt size={12} weight={600} color="mut3">{v.unit}</Txt>
            </View>
            <Stepper glyph="+" label={'Raise ' + v.targetLabel.toLowerCase()} onPress={v.incWorking} anchor="inc-working" />
          </View>
        </Card>
      </View>

      {/* reverse reader + 1RM */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: PAD, paddingBottom: 14 }}>
        {[['What’s on the bar?', v.openReverse, 'Read a loaded bar'], ['Set from 1RM', v.openRm, 'Set the target from a one rep max']].map(([label, fn, a]) => (
          <Tap key={label as string} label={a as string} onPress={fn as () => void} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c('card3'), borderWidth: 1, borderColor: c('bdSoft') }} pressedStyle={{ backgroundColor: c('ctl2') }}>
            <Txt size={12.5} weight={600} color="tx4" align="center">{label as string}</Txt>
          </Tap>
        ))}
      </View>

      {v.hasCollars ? (
        <View style={{ marginHorizontal: PAD, marginBottom: 14, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 14, backgroundColor: c('accA07'), borderWidth: 1, borderColor: c('accA22') }}>
          <Txt size={11.5} weight={600} color="accDeep" style={{ fontVariant: ['tabular-nums'] }}>Competition · {v.collarLine}</Txt>
        </View>
      ) : null}

      {v.warn ? (
        <View accessibilityRole="alert" style={{ marginHorizontal: PAD, marginBottom: 14, backgroundColor: c('warnA13'), borderWidth: 1, borderColor: c('warnA40'), borderRadius: 16, paddingVertical: 11, paddingHorizontal: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 20, height: 20, borderRadius: 7, backgroundColor: c('warn'), alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Txt size={12} weight={800} color="warnInk">!</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={12.5} lh={18} color="warnTx">{v.warn}</Txt>
            {v.emptyRack ? (
              <Tap label="Add my plates" onPress={v.openRackFromWarn} style={{ alignSelf: 'flex-start', minHeight: 34, marginTop: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: c('warnA22'), justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('warnA34') }}>
                <Txt size={12} weight={700} color="warnTx2">Add my plates ›</Txt>
              </Tap>
            ) : null}
            {v.hasAlts ? (
              <View style={{ marginTop: 9 }}>
                <Txt size={11} weight={700} color="warnTx" ls={0.55} style={{ marginBottom: 6 }}>LOADS EXACTLY</Txt>
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  {v.altChips.map((a) => (
                    <Tap key={a.label} label={'Load exactly ' + a.label.slice(2)} onPress={a.pick} style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 11, backgroundColor: c('warnA22'), borderWidth: 1, borderColor: c('warnA40'), justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('warnA34') }}>
                      <Num size={13.5} weight={700} color="warnTx2">{a.label}</Num>
                    </Tap>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* hero + scheme */}
      <View style={{ paddingHorizontal: PAD, paddingBottom: 18 }}>
        <HeroCard v={v} />
        <Tap label={v.schemeLine + '. Change the set scheme'} onPress={v.openSchemeSheet} style={{ minHeight: 44, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 4 }} pressedStyle={{ opacity: 0.8 }}>
          <Txt size={12.5} weight={500} color="mut3" numberOfLines={1} style={{ flexShrink: 1 }}>{v.schemeLine}</Txt>
          <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 99, backgroundColor: c('ctl2'), borderWidth: 1, borderColor: c('bd2'), justifyContent: 'center' }}>
            <Txt size={12} weight={600} color="tx4">Change ›</Txt>
          </View>
        </Tap>
      </View>

      {/* warm-up */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingBottom: 10 }}>
        <Txt size={13.5} weight={600} color="tx3">Warm-up</Txt>
        <Tap label="Plate rack" onPress={v.openRack} minSize={40} style={{ minHeight: 40, justifyContent: 'center', marginVertical: -10, marginRight: -6, paddingHorizontal: 6 }}>
          <Txt size={12.5} weight={500} color="mut2">Plate rack ›</Txt>
        </Tap>
      </View>
      <View style={{ paddingHorizontal: PAD, gap: 10 }}>
        {cards.map((s) => (
          <React.Fragment key={s.idx}>
            {s.groupHead ? (
              <>
                {v.canAddSet ? <AddSetButton onPress={v.addSet} /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginHorizontal: 2 }}>
                  <Txt size={11.5} weight={700} color="mut3" ls={0.58}>{v.afterHeading}</Txt>
                  <Hairline color="bd4" style={{ flex: 1 }} />
                </View>
              </>
            ) : null}
            <SetCard s={s} v={v} />
          </React.Fragment>
        ))}
        {v.canAddSetTail ? <AddSetButton onPress={v.addSet} /> : null}
      </View>
      <View style={{ height: 0, backgroundColor: t.transparent }} />
    </ScrollView>
  );
}
