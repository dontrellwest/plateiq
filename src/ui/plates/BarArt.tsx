// Shaped bar silhouettes (EZ, trap, SSB, Swiss): stroked SVG paths with steel gradients whose
// span runs across the shaft's own thickness so a flat sleeve still shades.

import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { BarArtPart } from '../../logic/constants';
import { STEEL_D_STOPS, STEEL_STOPS } from '../../logic/constants';

let seq = 0;

export interface BarArtProps {
  parts: BarArtPart[];
  vbW: number;
  vbH: number;
  w: number;
  h: number;
  /** picker rows: flat colours instead of gradients */
  flat?: boolean;
}

export function BarArt({ parts, vbW, vbH, w, h, flat }: BarArtProps) {
  const id = React.useMemo(() => 'ba' + (++seq).toString(36), []);
  const top = vbH / 2 - 8, bot = vbH / 2 + 8;
  return (
    <Svg width={w} height={h} viewBox={'0 0 ' + vbW + ' ' + vbH}>
      {!flat ? (
        <Defs>
          <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={bot}>
            <Stop offset={0} stopColor={STEEL_STOPS[0]} />
            <Stop offset={0.46} stopColor={STEEL_STOPS[1]} />
            <Stop offset={1} stopColor={STEEL_STOPS[2]} />
          </LinearGradient>
          <LinearGradient id={id + 'd'} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={bot}>
            <Stop offset={0} stopColor={STEEL_D_STOPS[0]} />
            <Stop offset={0.46} stopColor={STEEL_D_STOPS[1]} />
            <Stop offset={1} stopColor={STEEL_D_STOPS[2]} />
          </LinearGradient>
        </Defs>
      ) : null}
      {parts.map((q, i) => (
        <Path
          key={i}
          d={q.d}
          fill="none"
          stroke={flat ? q.flat : 'url(#' + id + (q.dark ? 'd' : '') + ')'}
          strokeWidth={q.w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
