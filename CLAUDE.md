@AGENTS.md

# PlateIQ — project notes for Claude Code

This repo was built in a Claude Code session on Windows (Sep 2026). Sessions don't sync between
machines, so everything a fresh session needs is here.

## What this is
A native iOS barbell-loading calculator built in Expo SDK 57 / React Native 0.86 / TypeScript from
the design handoff in `../design_handoff_plateiq/` (README.md there is the spec; option `1b` in the
HTML is the live prototype). All seven build steps are done and committed: scaffold + solver port,
store, Main screen, timer/log/completion, tour + onboarding, History/Library/Settings + sheets,
polish. See `README.md` for the layout and `docs/MAC-HANDOFF.md` for running on a Mac / iPhone.

## Non-negotiables
- `src/logic/PlateIQLogic.ts` is a line-for-line port of the prototype's logic class. Do not
  refactor the solver (`evaluate` / `plan` / `alts` / `loadSleeve` / `perSide` / `oneSide`).
  `__tests__/differential.test.ts` runs the prototype's original script and requires identical
  output; `__tests__/stress.test.ts` is the ported fuzz harness with the prototype's seeds.
- Any input that changes what the ladder prescribes must call `progressReset()`; an unchanged
  bar-weight blur must not. `__tests__/store.test.ts` enforces both, plus a source-level check that
  the raw `doneIdx: []` literal appears only in INITIAL_STATE, progressReset, advanceSession, resetAll.
- Every control is a `Tap` (accessible Pressable with role + label + 44 pt target). Plate diagrams
  are images with spoken load descriptions. Reduced motion disables every animation.
- Gradients are react-native-svg only (no expo-linear-gradient). Archivo is for numerals only.
- After touching the maths or reducers: `npm run test:full` (≈10 min) must stay green.

## Agreed deviations from the prototype (user-approved 2026-09-01)
Listed in README.md "Deviations". Highlights: target steppers / rounding / anchor / home-gym /
plate qty / fewest-changes all reset progress; starting a rest clears the undo toast; history
derives from persisted records (demo constants only during the tour); hero card has a LOGGED row;
completion modal suppressed during the tour; tour overlay is the accessibility-modal layer.

## Commands
```bash
npm test              # ~1 min: reduced harness + differential + UI suites
npm run test:full     # prototype counts (1M / 250k / 200k)
npm run typecheck
npx expo start        # i = iOS Simulator, or Expo Go on a phone
npx expo start --web  # browser preview; window.plateiq = { useStore, logic } in dev
```

## Known leftovers
- App icon and splash are Expo defaults (`assets/`).
- Never run on a real iOS device yet — see the verification list in `docs/MAC-HANDOFF.md`.
- The well vignette reads a touch stronger than the prototype's in the bottom-left corner.
- Web only: nested `<button>` warnings from Pressables inside Pressables (fine on iOS).
