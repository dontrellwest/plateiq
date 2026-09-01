import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import type { PressableProps, StyleProp, TextProps, TextStyle, ViewProps, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop, Pattern } from 'react-native-svg';
import { useTheme, sysWeight, numStyle, TAP_MIN } from './theme';
import type { ArchivoWeight } from './theme';

// ---- text -----------------------------------------------------------------

export interface TxtProps extends TextProps {
  size?: number; weight?: number; color?: string; ls?: number; lh?: number; align?: TextStyle['textAlign'];
}
/** System (SF) text for UI copy. `color` is a token key or a literal colour. */
export function Txt({ size = 13, weight = 400, color = 'tx', ls, lh, align, style, ...rest }: TxtProps) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[{ fontSize: size, fontWeight: sysWeight(weight), color: c(color), letterSpacing: ls, lineHeight: lh, textAlign: align }, style]}
    />
  );
}

export interface NumProps extends TextProps {
  size?: number; weight?: ArchivoWeight; color?: string; ls?: number; lh?: number; align?: TextStyle['textAlign'];
}
/** Archivo numerals with tabular figures — for weights and numbers only. */
export function Num({ size = 16, weight = 700, color = 'tx', ls = 0, lh, align, style, ...rest }: NumProps) {
  const { c } = useTheme();
  return <Text {...rest} style={[numStyle(size, weight, ls), { color: c(color), lineHeight: lh, textAlign: align }, style]} />;
}

// ---- pressable ------------------------------------------------------------

export interface TapProps extends Omit<PressableProps, 'style'> {
  label: string;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  /** Extend the touch area to 44 pt when the visual is smaller. */
  minSize?: number;
  role?: 'button' | 'radio' | 'switch' | 'tab' | 'link';
  selected?: boolean;
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
}
/** Every control: a real Pressable with a role, a name and a ≥44 pt target. */
export function Tap({ label, style, pressedStyle, minSize = TAP_MIN, role = 'button', selected, children, hitSlop, ...rest }: TapProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={hitSlop ?? Math.max(0, (minSize - 34) / 2)}
      {...rest}
      style={({ pressed }) => [style, pressed ? (pressedStyle ?? { opacity: 0.82 }) : null]}
    >
      {children}
    </Pressable>
  );
}

// ---- surfaces -------------------------------------------------------------

export interface CardProps extends ViewProps { bg?: string; bd?: string; radius?: number; pad?: number | [number, number]; }
export function Card({ bg = 'card', bd = 'bd', radius = 18, pad = 13, style, ...rest }: CardProps) {
  const { c } = useTheme();
  const p = Array.isArray(pad) ? { paddingVertical: pad[0], paddingHorizontal: pad[1] } : { padding: pad };
  return <View {...rest} style={[{ backgroundColor: c(bg), borderColor: c(bd), borderWidth: StyleSheet.hairlineWidth > 0 ? 1 : 1, borderRadius: radius }, p, style]} />;
}

/** A 1 px hairline at 6 % — never a solid grey line. */
export function Hairline({ color = 'bd', style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c(color) }, style]} />;
}

// ---- gradients (react-native-svg only) --------------------------------------

export interface GradStop { offset: number; color: string; opacity?: number }
let gid = 0;
const uid = () => 'g' + (++gid).toString(36);

export interface GradientBoxProps extends ViewProps {
  w?: number; h?: number;
  /** vertical stops (top → bottom) */
  stops: GradStop[];
  /** direction: 'v' (default) or 'h' */
  dir?: 'v' | 'h';
  radius?: number | [number, number, number, number];
  /** an inset 1 px highlight along the top edge */
  topLight?: string;
  /** a second, horizontal overlay (sheen) */
  overlay?: GradStop[];
  /** vertical 1 px knurl stripes every `knurl` px */
  knurl?: number;
  border?: string;
}
/** A box painted with an SVG gradient — the RN stand-in for the prototype's linear-gradient divs. */
export function GradientBox({ w, h, stops, dir = 'v', radius = 0, topLight, overlay, knurl, border, style, children, ...rest }: GradientBoxProps) {
  const id = React.useMemo(uid, []);
  const r = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
  const borderStyle = border ? { borderWidth: 1, borderColor: border } : null;
  return (
    <View
      {...rest}
      style={[{ width: w, height: h, overflow: 'hidden', borderTopLeftRadius: r[0], borderTopRightRadius: r[1], borderBottomRightRadius: r[2], borderBottomLeftRadius: r[3] }, borderStyle, style]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={dir === 'h' ? '1' : '0'} y2={dir === 'h' ? '0' : '1'}>
            {stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />)}
          </LinearGradient>
          {overlay ? (
            <LinearGradient id={id + 'o'} x1="0" y1="0" x2="1" y2="0">
              {overlay.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />)}
            </LinearGradient>
          ) : null}
          {knurl ? (
            <Pattern id={id + 'k'} patternUnits="userSpaceOnUse" width={knurl} height={100} x="0" y="0">
              <Rect x="0" y="0" width="1" height="100" fill="rgba(0,0,0,.34)" />
            </Pattern>
          ) : null}
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + ')'} />
        {overlay ? <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + 'o)'} /> : null}
        {knurl ? <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + 'k)'} /> : null}
      </Svg>
      {topLight ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: topLight }} /> : null}
      {children}
    </View>
  );
}

export interface RadialProps extends ViewProps { cx: string; cy: string; rx: string; ry: string; stops: GradStop[]; radius?: number }
/** Absolute-fill radial gradient (the plate wells). */
/** "130%" → 1.3 so radii larger than the box (the CSS ellipse idiom) survive every renderer. */
const frac = (v: string) => (v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v));
export function RadialFill({ cx, cy, rx, ry, stops, radius = 0, style, ...rest }: RadialProps) {
  const id = React.useMemo(uid, []);
  return (
    <View pointerEvents="none" {...rest} style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx={frac(cx)} cy={frac(cy)} rx={frac(rx)} ry={frac(ry)} gradientUnits="objectBoundingBox">
            {stops.map((s, i) => <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />)}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={'url(#' + id + ')'} />
      </Svg>
    </View>
  );
}

/** rgba(r,g,b,a) → { color:#rrggbb, opacity } so SVG stops can take the prototype's rgba strings. */
export function splitRgba(v: string): { color: string; opacity: number } {
  const m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return { color: v, opacity: 1 };
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return { color: '#' + hex(m[1]) + hex(m[2]) + hex(m[3]), opacity: m[4] === undefined ? 1 : Number(m[4]) };
}
export const stop = (offset: number, v: string): GradStop => { const s = splitRgba(v); return { offset, color: s.color, opacity: s.opacity }; };

// ---- small pieces ---------------------------------------------------------

export function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, backgroundColor: c(bg) }}>
      <Txt size={9.5} weight={800} ls={0.76} color={fg}>{text}</Txt>
    </View>
  );
}

/** Square icon button (header ⏱ / ⚙ / ‹). */
export function IconButton({ label, glyph, onPress, size = 38, glyphSize = 15, bg = 'card3', fg = 'mut', testID, anchor }: { label: string; glyph: string; onPress: () => void; size?: number; glyphSize?: number; bg?: string; fg?: string; testID?: string; anchor?: string }) {
  const { c } = useTheme();
  return (
    <Tap label={label} onPress={onPress} testID={testID} style={{ width: size, height: size, borderRadius: 12, backgroundColor: c(bg), alignItems: 'center', justifyContent: 'center' }} pressedStyle={{ backgroundColor: c('ctl2') }} {...anchorProps(anchor)}>
      <Text style={{ color: c(fg), fontSize: glyphSize }}>{glyph}</Text>
    </Tap>
  );
}

// ---- tour anchors ----------------------------------------------------------
// The guided tour presses real controls. Anchors register their on-screen frame by name so the
// fingertip can find them; `anchorProps(name)` attaches the ref + layout hook to any Tap.
export type AnchorFrame = { x: number; y: number; w: number; h: number };
const anchorNodes = new Map<string, View>();
export type AnchorProps = { ref?: React.Ref<View>; collapsable?: boolean };
export function anchorProps(name?: string): AnchorProps {
  if (!name) return {};
  return {
    collapsable: false,
    ref: (node: View | null) => { if (node) anchorNodes.set(name, node); else anchorNodes.delete(name); },
  };
}
export const hasAnchor = (name: string) => anchorNodes.has(name);
export function measureAnchor(name: string): Promise<AnchorFrame | null> {
  const node = anchorNodes.get(name);
  if (!node || !node.measureInWindow) return Promise.resolve(null);
  return new Promise((res) => node.measureInWindow((x, y, w, h) => res(w || h ? { x, y, w, h } : null)));
}
