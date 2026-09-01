export type Units = 'lb' | 'kg';
export type Mode = 'barbell' | 'dumbbell' | 'landmine';
export type AnchorType = 'rack' | 'hinge' | 'sleeve';
export type SchemeId = 'single' | 'straight' | 'backoff' | 'reverse' | 'drop' | 'cluster' | 'amrap';
export type CollarId = 'none' | 'clip' | 'comp';
export type Screen = 'main' | 'history' | 'library' | 'settings';
export type Sheet = false | 'log' | 'scheme' | 'rack' | 'bar' | '1rm' | 'reverse';
export type ThemeMode = 'light' | 'dark' | 'system';
export type TourState = 'auto' | 'play' | false;
export type RoundTo = 0.25 | 0.5 | 1.25 | 2.5;

export interface SetSpec { label: string; pct: number; reps: number; rest: number; id?: string; key?: string }
export interface Warmup { id: string; label: string; pct: number; reps: number; rest: number }
export interface LogEntry { w: number; r: number; planW: number; planR: number }
export interface Undo { label: string; patch: Partial<AppState> }
export interface TourCard { title: string; sub: string }

/** One fully-resolved load — what `evaluate()` returns. */
export interface Load {
  total: number;
  main: number;
  side: number[];
  sub: string;
  want: number;
  short: number;
  miss: number;
  overBase: boolean;
  full: boolean;
}
export type PlannedSet = SetSpec & Load;

/** A logged session — the production replacement for the prototype's demo SESSIONS/TRENDS. */
export interface SessionRecord {
  id: string;
  at: number; // epoch ms
  exercise: string;
  mode: Mode;
  units: Units;
  sets: Array<{ label: string; w: number; r: number; planW: number; planR: number }>;
}

export interface AppState {
  // core
  mode: Mode;
  bar: number;
  working: number;
  lmTarget: number;
  dbHandle: number;
  dbPair: boolean;
  dbTotal: number;
  activeIdx: number | null;
  doneIdx: number[];
  remaining: number;
  expanded: boolean;
  sheet: Sheet;
  homeGym: boolean;
  allDone: boolean;
  qty: Record<number, number>;
  anchorType: AnchorType;
  scheme: SchemeId;
  barProfile: string;
  comp: boolean;
  collarId: CollarId;
  minChanges: boolean;
  revSide: number[];
  rmW: number;
  rmR: number;
  rmRpe: number;
  barDraft: string;
  workDraft: string | null;
  screen: Screen;
  exercise: string;
  units: Units;
  roundTo: RoundTo;
  autoRest: boolean;
  // guided tour: 'auto' = undecided until mount, 'play' = running, false = off
  tour: TourState;
  tourPaused: boolean;
  tourWait: string | null;
  tourCap: string;
  tourCard: TourCard | null;
  tourKey: number;
  tourNote: boolean;
  onboard: boolean | null;
  onboardStep: number;
  sessionsLogged: number;
  theme: ThemeMode;
  systemDark: boolean;
  accent: string;
  search: string;
  paused: boolean;
  session: string[];
  sessionDone: string[];
  log: Record<number, LogEntry>;
  undo: Undo | null;
  undoAt: number;
  logIdx: number | null;
  trendEx: string | null;
  restTotal: number;
  warmups: Warmup[];
  // production additions (not in the prototype)
  tourSeen: boolean;
  records: SessionRecord[];
  restEndsAt: number | null;
}

export type StatePatch = Partial<AppState>;
export type StateUpdater = StatePatch | null | ((s: AppState) => StatePatch | null | undefined);

/** What the logic class needs from whoever owns the state (zustand in the app, a plain object in tests). */
export interface StateHost {
  get(): AppState;
  set(patch: StatePatch): void;
}

/** DOM-free hooks the guided tour needs from the UI layer. Absent → headless (fires immediately). */
export interface TourHost {
  /** Show the fingertip on a registered anchor. Return false when the anchor is not mounted. */
  press(anchor: string): boolean;
  scrollTo(fraction: number): void;
  setProgress(fraction: number): void;
}
