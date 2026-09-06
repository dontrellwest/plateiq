// The guided tour's spotlight: one full-screen scrim with a rounded-rectangle hole punched in it,
// plus an accent glow and edge around the hole.
//
// The scrim is a single <Path> whose `d` is "outer screen rect" + "inner rounded rect" with
// fillRule="evenodd", so the inner subpath is a hole in one filled shape. That is deliberately not
// a <Mask> (which pushes the whole screen through an offscreen buffer every frame on iOS, and has
// no animatable geometry of its own) and not four dark Views (which cannot round the corners).
// Geometry comes from tourUI's shared values through useAnimatedProps, so moving from one step to
// the next animates entirely on the UI thread and never re-renders React.

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { tourUI } from './tourUI';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** width of the soft accent halo straddling the cutout edge */
const GLOW_W = 14;

/**
 * Under the Jest Reanimated mock a shared value is a plain number, so `.value` reads `undefined`
 * and every sum becomes NaN. Collapse that to a safe default rather than emitting "MNaN NaN…".
 * Written without `isFinite` so it depends on nothing the worklet runtime has to provide.
 */
function fin(n: number, fallback: number): number {
  'worklet';
  if (typeof n !== 'number' || n !== n || n === Infinity || n === -Infinity) return fallback;
  return n;
}
function r2(n: number): number {
  'worklet';
  return Math.round(n * 100) / 100;
}

/** Outer screen rect + an inner rounded rect, as one even-odd path: the inner one is the hole. */
function holePath(W: number, H: number, x: number, y: number, w: number, h: number, r: number): string {
  'worklet';
  const outer = 'M0 0H' + r2(W) + 'V' + r2(H) + 'H0Z';
  if (w < 1 || h < 1) return outer;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const q = r2(rr);
  const xa = r2(x); const ya = r2(y);
  const xb = r2(x + w); const yb = r2(y + h);
  const xi = r2(x + rr); const yi = r2(y + rr);
  const xo = r2(x + w - rr); const yo = r2(y + h - rr);
  // clockwise, matching the outer rect; sweep-flag 1 on every corner
  return outer
    + 'M' + xi + ' ' + ya
    + 'H' + xo + 'A' + q + ' ' + q + ' 0 0 1 ' + xb + ' ' + yi
    + 'V' + yo + 'A' + q + ' ' + q + ' 0 0 1 ' + xo + ' ' + yb
    + 'H' + xi + 'A' + q + ' ' + q + ' 0 0 1 ' + xa + ' ' + yo
    + 'V' + yi + 'A' + q + ' ' + q + ' 0 0 1 ' + xi + ' ' + ya + 'Z';
}

export function Spotlight({ scrim, ring }: { scrim: string; ring: string }) {
  const { width: W, height: H } = useWindowDimensions();

  const scrimProps = useAnimatedProps(() => ({
    d: holePath(
      W, H,
      fin(tourUI.spotX.value, 0), fin(tourUI.spotY.value, 0),
      fin(tourUI.spotW.value, 0), fin(tourUI.spotH.value, 0),
      fin(tourUI.spotR.value, 16),
    ),
  }), [W, H]);

  // one geometry object, shared by the glow and the lit edge
  const edgeProps = useAnimatedProps(() => {
    const w = Math.max(0, fin(tourUI.spotW.value, 0));
    const h = Math.max(0, fin(tourUI.spotH.value, 0));
    const rr = Math.max(0, Math.min(fin(tourUI.spotR.value, 16), w / 2, h / 2));
    return {
      x: r2(fin(tourUI.spotX.value, 0)),
      y: r2(fin(tourUI.spotY.value, 0)),
      width: r2(w),
      height: r2(h),
      rx: r2(rr),
      ry: r2(rr),
      opacity: Math.max(0, Math.min(1, fin(tourUI.spotOn.value, 0))),
    };
  });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { zIndex: 29 }]}
    >
      <Svg width={W} height={H} viewBox={'0 0 ' + W + ' ' + H}>
        <AnimatedPath animatedProps={scrimProps} fill={scrim} fillRule="evenodd" />
        <AnimatedRect animatedProps={edgeProps} fill="none" stroke={ring} strokeOpacity={0.18} strokeWidth={GLOW_W} />
        <AnimatedRect animatedProps={edgeProps} fill="none" stroke={ring} strokeOpacity={0.95} strokeWidth={2} />
      </Svg>
    </View>
  );
}
