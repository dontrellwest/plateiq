// History (README screen 7): sessions / volume / PR stat cards, weekly-volume bars, the estimated-1RM
// trend card (8-week sparkline, delta chip, per-exercise switcher), recent-session rows. Everything
// derives from persisted session records; the demo constants appear only while the tour plays.

import React from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { useView } from '../store/useStore';
import { Badge, Card, IconButton, Num, Tap, Txt } from '../ui/primitives';
import { SCREEN_PAD, useTheme } from '../ui/theme';

type V = ReturnType<typeof useView>;

function Header({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18 }}>
      <IconButton label="Back" glyph="‹" glyphSize={20} fg="tx4" onPress={onBack} />
      <View>
        <Num size={23} weight={800} ls={-0.5} lh={25} accessibilityRole="header">{title}</Num>
        {sub ? <Txt size={12.5} color="mut3" style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
    </View>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card style={{ flex: 1 }} pad={[12, 13]} bg={accent ? 'accA07' : 'card'} bd={accent ? 'accA35' : 'bd'}>
      <Num size={24} weight={800} ls={-0.6} color={accent ? 'accDeep' : 'tx'}>{value}</Num>
      <Txt size={11.5} color={accent ? 'heroMut' : 'mut3'} style={{ marginTop: 2 }}>{label}</Txt>
    </Card>
  );
}

function Sparkline({ v }: { v: V }) {
  const { t } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={'Estimated one rep max trend for ' + v.trendName + ', ' + v.trendDelta + ' over eight weeks'} style={{ marginTop: 14, height: 86 }}>
      {/* the prototype lets the svg overflow so the end dot is never clipped; pad the viewBox instead */}
      <Svg width="100%" height={86} viewBox={'-6 -5 ' + (v.trendW + 12) + ' ' + (v.trendH + 10)} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="pqTrendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={t.acc} stopOpacity={0.24} />
            <Stop offset={1} stopColor={t.acc} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={v.trendArea} fill="url(#pqTrendFill)" />
        <Path d={v.trendPath} fill="none" stroke={t.acc} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <Circle cx={v.trendDotX} cy={v.trendDotY} r={4} fill={t.acc} stroke={t.card} strokeWidth={2.5} />
      </Svg>
    </View>
  );
}

export function HistoryScreen({ v }: { v: V }) {
  const { c } = useTheme();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 6, paddingHorizontal: SCREEN_PAD, paddingBottom: 46 }}>
      <Header title="History" sub={v.sessionsLabel + ' · last 10 weeks'} onBack={v.goMain} />

      {v.historySample ? (
        <View style={{ marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c('accA07'), borderWidth: 1, borderColor: c('accA22') }}>
          <Txt size={11.5} weight={600} color="accDeep">Sample data while the tour plays</Txt>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Stat value={v.sessionsStat} label="sessions" />
        <Stat value={v.volMovedLabel.split(' ')[0]} label={v.unit + ' moved'} />
        <Stat value={v.prCount} label="new PRs" accent />
      </View>

      {v.historyEmpty ? (
        <Card radius={20} pad={[18, 16]} style={{ marginBottom: 20 }}>
          <Txt size={13.5} weight={600} color="tx3">No sessions logged yet</Txt>
          <Txt size={12.5} lh={18} color="mut3" style={{ marginTop: 6 }}>Finish an exercise and tap Log to start your history. Volume, PRs and estimated-1RM trends build from what you actually lift.</Txt>
        </Card>
      ) : null}

      <Card radius={20} pad={[15, 16]} style={{ marginBottom: 20, paddingBottom: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Txt size={13.5} weight={600} color="tx3">Weekly volume</Txt>
          <Txt size={11.5} color="mut3">{v.volPeakLabel}</Txt>
        </View>
        <View accessible accessibilityRole="image" accessibilityLabel={'Weekly volume over ten weeks, ' + v.volPeakLabel} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 98, marginTop: 14 }}>
          {v.volBars.map((b, i) => (
            <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <View style={{ width: '100%', height: Math.max(2, b.h) + '%' as `${number}%`, borderRadius: 5, backgroundColor: c(b.bg) }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
          <Txt size={10.5} color="mut4">10 wks ago</Txt><Txt size={10.5} color="mut4">this week</Txt>
        </View>
      </Card>

      <Card radius={20} pad={[15, 16]} style={{ marginBottom: 20, paddingBottom: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Txt size={13.5} weight={600} color="tx3">Estimated 1RM</Txt>
            <Txt size={11.5} color="mut3" numberOfLines={1} style={{ marginTop: 2 }}>{v.trendName} · last 8 weeks</Txt>
          </View>
          {v.trendReady ? (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <Num size={26} weight={800} ls={-0.8}>{v.trendNow}</Num>
                <Txt size={11.5} weight={600} color="mut3">{v.unit}</Txt>
              </View>
              <View style={{ marginTop: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c(v.trendDeltaBg) }}>
                <Txt size={11} weight={700} color={v.trendDeltaFg} style={{ fontVariant: ['tabular-nums'] }}>{v.trendDelta}</Txt>
              </View>
            </View>
          ) : null}
        </View>
        {v.trendReady ? (
          <>
            <Sparkline v={v} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }}>
              <Txt size={10.5} color="mut4">{v.trendFirst}</Txt><Txt size={10.5} color="mut4">{v.trendLast}</Txt>
            </View>
          </>
        ) : (
          <Txt size={12.5} lh={18} color="mut3" style={{ marginTop: 12 }}>Not enough data yet — log {v.trendName} twice and the trend appears here.</Txt>
        )}
        {v.trendOptions.length ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 13 }} accessibilityRole="radiogroup">
            {v.trendOptions.map((o) => (
              <Tap key={o.name} label={'Show trend for ' + o.name} role="radio" selected={o.on} onPress={o.pick} minSize={40} style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: c(o.bg) }}>
                <Txt size={11.5} weight={600} color={o.fg}>{o.name}</Txt>
              </Tap>
            ))}
          </View>
        ) : null}
      </Card>

      {v.sessions.length ? <Txt size={13.5} weight={600} color="tx3" style={{ marginBottom: 10 }}>Recent sessions</Txt> : null}
      <View style={{ gap: 9 }}>
        {v.sessions.map((x, i) => (
          <Card key={i} pad={[13, 14]} accessible accessibilityLabel={x.ex + ', ' + x.when + ', ' + x.mode + ', top set ' + x.top + ', ' + x.meta + (x.pr ? ', personal record' : '')}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Num size={16} weight={700} color="tx2" ls={-0.2}>{x.ex}</Num>
                  {x.pr ? <Badge text="PR" bg={x.prBg} fg={x.prFg} /> : null}
                </View>
                <Txt size={12} color="mut3" style={{ marginTop: 4 }}>{x.when} · {x.mode}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Num size={17} weight={700} ls={-0.3}>{x.top}</Num>
                <Txt size={11} color="mut4" style={{ marginTop: 3 }}>{x.meta}</Txt>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
