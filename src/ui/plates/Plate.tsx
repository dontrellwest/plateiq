// One plate seen edge-on: a vertical face gradient, a horizontal sheen, a 1 px top highlight, a
// dark rim, and the denomination rotated onto the face. Heights tween 220 ms when the load changes
// (README "Interactions & motion"); reduced motion snaps.

import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { PlateVisual } from '../../logic/PlateIQLogic';
import { SHEEN_STOPS } from '../../logic/constants';
import { ARCHIVO, EASE, MOTION, useTheme } from '../theme';

let seq = 0;

export interface PlateProps {
  p: PlateVisual;
  /** hero wells add the bottom inset shading and a deeper drop shadow */
  hero?: boolean;
  radius?: number;
}

export const Plate = React.memo(function Plate({ p, hero = false, radius = 5 }: PlateProps) {
  const { reduceMotion } = useTheme();
  const id = React.useMemo(() => 'pl' + (++seq).toString(36), []);
  const h = useSharedValue(p.h);
  useEffect(() => {
    h.value = reduceMotion
      ? p.h
      : withTiming(p.h, { duration: MOTION.plate, easing: Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]) });
  }, [p.h, reduceMotion, h]);
  const anim = useAnimatedStyle(() => ({ height: h.value }));
  const lh = Math.round(p.fs * 1.25);
  const shadow = Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: hero ? 0.55 : 0.45, shadowRadius: hero ? 5 : 4, shadowOffset: { width: 0, height: hero ? 4 : 3 } },
    android: { elevation: 3 },
    default: {},
  });
  return (
    <Animated.View
      style={[
        { width: p.w, marginHorizontal: 1, borderRadius: radius, backgroundColor: p.skin.stops[1] },
        shadow,
        anim,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: p.skin.bd }]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id + 'f'} x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={p.skin.stops[0]} />
              <Stop offset={p.skin.mid} stopColor={p.skin.stops[1]} />
              <Stop offset={1} stopColor={p.skin.stops[2]} />
            </LinearGradient>
            <LinearGradient id={id + 's'} x1="0" y1="0" x2="1" y2="0">
              {SHEEN_STOPS.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />)}
            </LinearGradient>
            {hero ? (
              <LinearGradient id={id + 'b'} x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0.7} stopColor="#000" stopOpacity={0} />
                <Stop offset={1} stopColor="#000" stopOpacity={0.45} />
              </LinearGradient>
            ) : null}
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + 'f)'} />
          <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + 's)'} />
          {hero ? <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + 'b)'} /> : null}
        </Svg>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,.28)' }} />
        {p.label ? (
          // a View sized to the plate's height, rotated onto the face; the Text inside is never
          // constrained by the (narrow) plate width, which react-native-web would otherwise clamp
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: p.h - 4,
              height: lh,
              left: (p.w - 2 - (p.h - 4)) / 2,
              top: (p.h - 2 - lh) / 2,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-90deg' }],
            }}
          >
            <Text
              numberOfLines={1}
              style={{ lineHeight: lh, fontFamily: ARCHIVO[700], fontSize: p.fs, letterSpacing: p.fs * 0.02, color: p.skin.fg }}
            >
              {p.label}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});
