// Settings (README screen 9): theme, 8 accents, units, rounding step, plate rack, default landmine
// anchor, home-gym toggle, bar, fewest-plate-changes, competition mode + collars, auto-start rest,
// Watch the tour, training history, run setup again.

import React from 'react';
import { ScrollView, View } from 'react-native';
import type { useView } from '../store/useStore';
import { Card, Hairline, IconButton, Num, Tap, Txt } from '../ui/primitives';
import { SCREEN_PAD, useTheme } from '../ui/theme';

type V = ReturnType<typeof useView>;

export function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Tap label={label} role="switch" accessibilityState={{ checked: on }} onPress={onPress} style={{ width: 46, height: 28, borderRadius: 99, backgroundColor: c(on ? 'acc' : 'ctl3'), padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }} pressedStyle={{ opacity: 0.85 }}>
      <View style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 } }} />
    </Tap>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Txt size={12.5} weight={600} color="mut3" style={{ marginBottom: 9, marginLeft: 2 }}>{text}</Txt>;
}

function Group({ children }: { children: React.ReactNode }) {
  return <Card radius={20} pad={[4, 14]} style={{ marginBottom: 20 }}>{children}</Card>;
}

function Row({ title, sub, right, onPress, label, last, children }: { title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; label?: string; last?: boolean; children?: React.ReactNode }) {
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Txt size={14} weight={600} color="tx2">{title}</Txt>
          {sub ? <Txt size={11.5} color="mut3" style={{ marginTop: 2 }}>{sub}</Txt> : null}
          {children}
        </View>
        {right}
      </View>
    </>
  );
  const style = { paddingVertical: 13 };
  return (
    <>
      {onPress ? <Tap label={label || title} onPress={onPress} style={style} pressedStyle={{ opacity: 0.8 }}>{body}</Tap> : <View style={style}>{body}</View>}
      {last ? null : <Hairline />}
    </>
  );
}

function Chip({ text, on, bg, fg, onPress, label, px = 14 }: { text: string; on: boolean; bg: string; fg: string; onPress: () => void; label?: string; px?: number }) {
  const { c } = useTheme();
  return (
    <Tap label={label || text} role="radio" selected={on} onPress={onPress} minSize={40} style={{ paddingVertical: 7, paddingHorizontal: px, borderRadius: 10, backgroundColor: c(bg) }}>
      <Txt size={12.5} weight={700} color={fg}>{text}</Txt>
    </Tap>
  );
}

export function SettingsScreen({ v }: { v: V }) {
  const { c } = useTheme();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 6, paddingHorizontal: SCREEN_PAD, paddingBottom: 46 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18 }}>
        <IconButton label="Back" glyph="‹" glyphSize={20} fg="tx4" onPress={v.goMain} />
        <Num size={23} weight={800} ls={-0.5} lh={25} accessibilityRole="header">Settings</Num>
      </View>

      <SectionTitle text="Appearance" />
      <Group>
        <Row title="Theme" sub="System follows your phone">
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }} accessibilityRole="radiogroup">
            {v.themeOptions.map((o) => (
              <Tap key={o.label} label={o.label + ' theme'} role="radio" selected={o.on} onPress={o.pick} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: c(o.bg) }}>
                <Txt size={12.5} weight={600} color={o.fg}>{o.label}</Txt>
              </Tap>
            ))}
          </View>
        </Row>
        <View style={{ paddingVertical: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt size={14} weight={600} color="tx2">Accent</Txt>
            <Txt size={11.5} color="mut3">{v.accentName}</Txt>
          </View>
          <Txt size={11.5} color="mut3" style={{ marginTop: 2 }}>Used on the set you are about to load</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 11 }} accessibilityRole="radiogroup">
            {v.accentSwatches.map((a) => (
              <View key={a.id} style={{ width: '25%', alignItems: 'center', marginBottom: 8 }}>
                <Tap label={a.name + ' accent'} role="radio" selected={a.on} onPress={a.pick} style={{ width: 44, height: 44, borderRadius: 99, borderWidth: 2, borderColor: a.ring, alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ opacity: 0.85 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 99, backgroundColor: a.dot, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt size={14} weight={800} color={a.check} lh={16}>✓</Txt>
                  </View>
                </Tap>
              </View>
            ))}
          </View>
        </View>
      </Group>

      <SectionTitle text="Units & rounding" />
      <Group>
        <Row title="Units" sub="Applies to every screen" right={
          <View style={{ flexDirection: 'row', gap: 5 }} accessibilityRole="radiogroup">
            {v.unitOptions.map((u) => <Chip key={u.label} text={u.label} on={u.on} bg={u.bg} fg={u.fg} onPress={u.pick} label={u.label === 'lb' ? 'Pounds' : 'Kilograms'} />)}
          </View>
        } />
        <Row title="Round everything to" sub="Smallest step for targets and loading — set low to use microplates" last right={
          <View style={{ flexDirection: 'row', gap: 5 }} accessibilityRole="radiogroup">
            {v.roundOptions.map((r) => <Chip key={r.label} text={r.label} on={r.on} bg={r.bg} fg={r.fg} onPress={r.pick} label={'Round to ' + r.label} px={11} />)}
          </View>
        } />
      </Group>

      <SectionTitle text="Equipment" />
      <Group>
        <Row title="Plate rack" sub="What you own, per plate" onPress={v.openRack} label="Plate rack, edit" right={<Txt size={13} color="mut4">Edit ›</Txt>} />
        <Row title="Default landmine anchor" sub="Sets the effective-load maths">
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }} accessibilityRole="radiogroup">
            {v.anchorOptions.map((a) => (
              <Tap key={a.id} label={a.label} role="radio" selected={a.on} onPress={a.pick} style={{ flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 11, backgroundColor: c(a.bg), borderWidth: 1, borderColor: c(a.bd) }}>
                <Txt size={11.5} weight={600} color={a.fg} align="center">{a.label}</Txt>
              </Tap>
            ))}
          </View>
        </Row>
        <Row title="Home gym mode" sub='Your "Where do you lift?" answer — only suggest loads your plates can build' last right={<Toggle on={v.homeGym} label="Home gym mode" onPress={v.toggleHome} />} />
      </Group>

      <SectionTitle text="Loading" />
      <Group>
        <Row title="Bar" sub="Weight and sleeve length both feed the maths" onPress={v.openBarSheet} label={'Bar: ' + v.barProfileName + ', choose'} right={<Txt size={13} color="mut4">{v.barProfileName} ›</Txt>} />
        <Row title="Fewest plate changes" sub="Build each set on top of the last where it costs no accuracy" right={<Toggle on={v.minChanges} label="Fewest plate changes" onPress={v.toggleMinChanges} />}>
          <Txt size={11.5} weight={600} color="accDeep" style={{ marginTop: 5 }}>{v.handlingLabel}</Txt>
        </Row>
        <Row title="Competition mode" sub="Counts collar weight in every total" last={!v.comp} right={<Toggle on={v.comp} label="Competition mode" onPress={v.toggleComp} />} />
        {v.comp ? (
          <View style={{ paddingBottom: 14, gap: 6 }} accessibilityRole="radiogroup">
            {v.collarOptions.map((o) => (
              <Tap key={o.id} label={o.name + ' collars, ' + o.note} role="radio" selected={o.on} onPress={o.pick} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c(o.bg), borderWidth: 1, borderColor: c(o.bd) }}>
                <Txt size={12.5} weight={600} color={o.fg}>{o.name}</Txt>
                <Txt size={11.5} color="mut4">{o.note}</Txt>
              </Tap>
            ))}
          </View>
        ) : null}
      </Group>

      <SectionTitle text="Session" />
      <Group>
        <Row title="Auto-start rest timer" sub="Starts the moment you tap a set" right={<Toggle on={v.autoRest} label="Auto-start rest timer" onPress={v.toggleAuto} />} />
        <Row title="Watch the tour" sub="The guided walkthrough, again" onPress={v.tourFromSettings} label="Watch the tour" right={<Txt size={13} color="mut4">Play ›</Txt>} />
        <Row title="Training history" sub={v.sessionsLabel} onPress={v.goHistory} label="Training history" last right={<Txt size={13} color="mut4">Open ›</Txt>} />
      </Group>

      <Tap label="Run first-time setup again" onPress={v.startOnboard} style={{ paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c('bd3'), alignItems: 'center' }} pressedStyle={{ borderColor: c('accA40') }}>
        <Txt size={13} weight={600} color="mut2">Run first-time setup again</Txt>
      </Tap>
      <Txt size={11} color="mut5" align="center" style={{ marginTop: 16 }}>PlateIQ 1.4 · built for people who hate arithmetic mid-set</Txt>
    </ScrollView>
  );
}
