// The plate diagrams: a barbell / dumbbell well and a landmine well, each in a hero and a set-card
// size. Geometry and colours follow the prototype's option 1b markup piece by piece.

import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { PlateVisual } from '../../logic/PlateIQLogic';
import type { BarArtPart } from '../../logic/constants';
import { GradientBox, RadialFill, stop } from '../primitives';
import { useTheme } from '../theme';
import { Plate } from './Plate';
import { BarArt } from './BarArt';
import { FitScale } from './FitScale';

const g = (...cs: string[]) => cs.map((c, i) => stop(i / (cs.length - 1), c));
const g3 = (a: string, b: string, mid: number, c: string) => [stop(0, a), stop(mid, b), stop(1, c)];

export interface Shaft {
  straight: boolean;
  h: number;            // straight shaft thickness
  parts: BarArtPart[];  // shaped art
  boxW: number; boxH: number;
}

export interface BarWellProps {
  left: PlateVisual[];
  right: PlateVisual[];
  shaft: Shaft;
  hero: boolean;
  /** 1 (barbell) or [1, 2] (matched dumbbell pair) */
  units: number[];
  gap: number;
  barLen: number;
  /** set cards pre-scale the row (renderVals.setScale) and fit-scale below that */
  scale?: number;
  height: number;
  aria: string;
  style?: StyleProp<ViewStyle>;
}

function WellFrame({ height, hero, aria, style, children }: { height: number; hero: boolean; aria: string; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={aria}
      style={[{ height, borderRadius: hero ? 16 : 14, overflow: 'hidden' }, style]}
    >
      <RadialFill
        cx="18%" cy="100%" rx="130%" ry="100%"
        stops={[stop(0, t.well1), stop(0.62, hero ? t.well2b : t.well2), stop(1, hero ? t.well3b : t.well3)]}
      />
      {children}
    </View>
  );
}

function Shaft({ shaft, len, hero }: { shaft: Shaft; len: number; hero: boolean }) {
  if (shaft.straight) {
    return <GradientBox w={len} h={shaft.h} stops={g3('#aeb4bb', '#6a7178', 0.55, '#474d54')} knurl={4} />;
  }
  const k = hero ? 1 : 0.92;
  return <BarArt parts={shaft.parts} vbW={shaft.boxW} vbH={shaft.boxH} w={Math.round(shaft.boxW * k)} h={Math.round(shaft.boxH * k)} />;
}

export function BarWell({ left, right, shaft, hero, units, gap, barLen, scale = 1, height, aria, style }: BarWellProps) {
  const { t } = useTheme();
  const collar = (
    <GradientBox w={11} h={34} radius={3} stops={g('#b6bcc3', '#5d646c')} border={hero ? t.bd5 : undefined} />
  );
  const endCap = <GradientBox w={9} h={20} radius={3} stops={g('#8d949c', '#4a5057')} />;
  const stub = <GradientBox w={5} h={12} stops={g('#7e858d', '#43484e')} />;
  return (
    <WellFrame height={height} hero={hero} aria={aria} style={style}>
      <FitScale base={scale}>
        {units.map((u, i) => (
          <View key={u} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: i ? gap : 0 }}>
            {endCap}
            {hero ? stub : null}
            {left.map((p, j) => <Plate key={'l' + j} p={p} hero={hero} />)}
            {collar}
            <Shaft shaft={shaft} len={barLen} hero={hero} />
            {collar}
            {right.map((p, j) => <Plate key={'r' + j} p={p} hero={hero} />)}
            {hero ? stub : null}
            {endCap}
          </View>
        ))}
      </FitScale>
    </WellFrame>
  );
}

// ---- landmine ---------------------------------------------------------------

export interface LandmineWellProps {
  right: PlateVisual[];
  hero: boolean;
  anchor: 'rack' | 'hinge' | 'sleeve';
  rotate: number;
  pivotX: number;
  pivotY: number;
  height: number;
  aria: string;
  style?: StyleProp<ViewStyle>;
}

const abs = (left: number, bottom: number, extra?: ViewStyle): ViewStyle => ({ position: 'absolute', left, bottom, ...extra });

function RackRig() {
  const { t } = useTheme();
  return (
    <>
      <GradientBox style={abs(6, 14)} w={78} h={11} radius={3} stops={g('#454d57', t.card2)} />
      <GradientBox style={abs(26, 22)} w={22} h={152} radius={3} dir="h" stops={g3('#4e565f', '#2b3138', 0.44, '#14171b')} topLight={t.bd3} />
      <View style={[abs(31, 36), { width: 11, height: 130, borderRadius: 5, overflow: 'hidden' }]}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * 28, height: 9, backgroundColor: 'rgba(0,0,0,.7)' }} />
        ))}
      </View>
      <GradientBox style={abs(44, 71)} w={20} h={24} radius={[2, 5, 5, 2]} stops={g('#79828c', '#2d333a')} topLight="rgba(255,255,255,.24)" />
    </>
  );
}
function HingeRig() {
  const { t } = useTheme();
  return (
    <>
      <GradientBox style={abs(4, 14)} w={112} h={10} radius={3} stops={g('#454d57', t.card2)} />
      <GradientBox style={abs(12, 23)} w={96} h={9} radius={4} stops={g('#333941', t.card2)} topLight="rgba(255,255,255,.11)" />
      <GradientBox style={abs(16, 31)} w={88} h={9} radius={4} stops={g('#3a414a', '#1d2228')} topLight="rgba(255,255,255,.11)" />
      <GradientBox style={abs(20, 39)} w={80} h={9} radius={4} stops={g('#414951', '#20252b')} topLight="rgba(255,255,255,.11)" />
      <GradientBox style={abs(42, 41)} w={26} h={24} radius={[4, 9, 9, 4]} stops={g('#68717b', '#2c3239')} topLight="rgba(255,255,255,.2)" />
    </>
  );
}
function SleeveRig() {
  const { t } = useTheme();
  return (
    <>
      <GradientBox style={abs(28, 12)} w={116} h={11} radius={6} stops={g('#31363b', '#141719')} topLight={t.bd4} />
      <GradientBox style={abs(62, 21)} w={54} h={22} radius={4} stops={g3('#5c656f', '#333a42', 0.48, '#1c2127')} topLight="rgba(255,255,255,.2)" />
      <GradientBox style={abs(70, 21)} w={9} h={22} stops={g('#858c95', '#3d434b')} />
      <GradientBox style={abs(99, 21)} w={9} h={22} stops={g('#858c95', '#3d434b')} />
    </>
  );
}

export function LandmineWell({ right, hero, anchor, rotate, pivotX, pivotY, height, aria, style }: LandmineWellProps) {
  const { t } = useTheme();
  const sz = hero
    ? { block: [44, 27], ball: 21, ballMl: -9, shaft: [90, 13], collar: [11, 36], end: [10, 28], cap: [7, 17], pr: 5 }
    : { block: [34, 21], ball: 16, ballMl: -7, shaft: [68, 10], collar: [9, 28], end: [8, 22], cap: [6, 13], pr: 4 };
  return (
    <WellFrame height={height} hero={hero} aria={aria} style={style}>
      {/* floor line + ground shadow */}
      <GradientBox
        style={{ position: 'absolute', left: 0, right: 0, bottom: hero ? 22 : 18 }} h={1} dir="h"
        stops={hero
          ? [stop(0, 'rgba(255,255,255,.02)'), stop(0.2, 'rgba(255,255,255,.17)'), stop(0.82, 'rgba(255,255,255,.02)')]
          : [stop(0, 'rgba(255,255,255,.02)'), stop(0.12, 'rgba(255,255,255,.06)'), stop(0.34, 'rgba(255,255,255,.15)'), stop(0.88, 'rgba(255,255,255,.02)')]}
      />
      <View style={abs(hero ? 0 : 84, 6, { width: hero ? 200 : 160, height: hero ? 32 : 24, borderRadius: 99, overflow: 'hidden' })}>
        <RadialFill cx={hero ? '40%' : '44%'} cy="50%" rx="46%" ry="50%" stops={[stop(0, hero ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.62)'), stop(0.72, 'rgba(0,0,0,0)')]} />
      </View>
      {hero ? (anchor === 'rack' ? <RackRig /> : anchor === 'hinge' ? <HingeRig /> : <SleeveRig />) : (
        <>
          <GradientBox style={abs(104, 10)} w={100} h={8} radius={4} stops={g('#343a41', '#15181c')} />
          <GradientBox style={abs(124, 17)} w={48} h={15} radius={3} stops={g3('#5b636d', '#363d45', 0.48, '#1d2228')} topLight={t.bd5} />
        </>
      )}
      {/* the bar, pivoting about the anchor */}
      <View
        style={{
          position: 'absolute', left: pivotX, bottom: pivotY, height: 0,
          flexDirection: 'row', alignItems: 'center',
          transform: [{ rotate: rotate + 'deg' }], transformOrigin: '0% 50%',
        }}
      >
        <GradientBox
          w={sz.block[0]} h={sz.block[1]} radius={[hero ? 7 : 6, 3, 3, hero ? 7 : 6]} style={{ marginLeft: -sz.block[0] }}
          stops={g3('#78818b', '#394048', 0.5, '#1c2127')} topLight={hero ? 'rgba(255,255,255,.24)' : t.bd6}
        />
        <View style={{ width: sz.ball, height: sz.ball, borderRadius: 99, marginLeft: sz.ballMl, overflow: 'hidden', borderWidth: 1, borderColor: hero ? 'rgba(255,255,255,.2)' : t.bd5 }}>
          <RadialFill cx="34%" cy="28%" rx="62%" ry="62%" stops={[stop(0, hero ? '#ccd2d9' : '#c6ccd3'), stop(0.58, hero ? '#6c737c' : '#697079'), stop(1, '#31363c')]} />
        </View>
        <GradientBox w={sz.shaft[0]} h={sz.shaft[1]} knurl={4} stops={hero ? [stop(0, '#d2d8de'), stop(0.38, '#9097a0'), stop(0.72, '#5b626b'), stop(1, '#3c424a')] : [stop(0, '#cdd3d9'), stop(0.38, '#8d949c'), stop(0.74, '#585f68'), stop(1, '#3c424a')]} />
        <GradientBox w={sz.collar[0]} h={sz.collar[1]} radius={hero ? 3 : 2} stops={hero ? g3('#d6dce2', '#707880', 0.58, '#454b53') : g3('#d1d7dd', '#6d757d', 0.58, '#454b53')} topLight={hero ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.3)'} />
        {right.map((p, j) => <Plate key={'r' + j} p={p} hero={hero} radius={sz.pr} />)}
        <GradientBox w={sz.end[0]} h={sz.end[1]} radius={hero ? 3 : 2} stops={g3('#cdd3da', '#6b737b', 0.6, '#434950')} topLight={hero ? 'rgba(255,255,255,.32)' : 'rgba(255,255,255,.28)'} />
        <GradientBox w={sz.cap[0]} h={sz.cap[1]} radius={[0, 4, 4, 0]} stops={g('#a0a7af', '#4d535a')} />
      </View>
    </WellFrame>
  );
}
