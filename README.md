# PlateIQ

Native iOS barbell-loading calculator and workout companion, built with Expo SDK 57 (React Native
0.86, TypeScript) from the design handoff in `../design_handoff_plateiq/`.

Picking this up on a Mac? Read **[docs/MAC-HANDOFF.md](docs/MAC-HANDOFF.md)** first.

## Layout

| Path | What |
|---|---|
| `src/logic/PlateIQLogic.ts` | The prototype's logic class ported line-for-line: solver (`evaluate` / `plan` / `alts`), reducers, tour timeline, view model (`renderVals`), history derivation |
| `src/logic/constants.ts` | Plate sets, thickness, bar profiles, collars, schemes, skins, bar art, accents |
| `src/logic/types.ts` | The store's state shape (README "State management") |
| `src/store/useStore.ts` | The single zustand store, persistence (AsyncStorage), `bootStore()` platform wiring, `useView()` / `useTokens()` |
| `src/ui/theme.ts`, `src/ui/primitives.tsx` | Tokens, type ramp, `Tap` (accessible Pressable), cards, SVG gradients, tour anchors |
| `src/ui/plates/` | Plate renderer, barbell/dumbbell/landmine wells, shaped bar art, measure-then-scale fit |
| `src/ui/overlays/` | Rest timer panel, undo toast, sheet frame, log / bar / scheme / reverse / 1RM / rack sheets, completion modal, onboarding |
| `src/ui/tour/` | Guided tour overlay and the host that bridges the timeline to real controls |
| `src/screens/` | Main / Calculator, History, Library, Settings |
| `qa/harness.ts` | Port of `qa/stress-test.html` (same invariants, same seeds) |
| `__tests__/` | Stress, differential, store, render, flow, tour, screens suites |

## Tests

```bash
npm test
```

Reduced harness (20,000 solver scenarios, 10,000 UI actions), a 30,000-scenario differential
against the prototype's original script, and the UI suites. About a minute.

```bash
npm run test:full
```

The prototype's full counts: 1,000,000 solver scenarios (≈5.57M sets) and 250,000 UI actions
across 5,000 users. About 8 minutes. Counts can also be set directly: `PLATEIQ_SCENARIOS`,
`PLATEIQ_USERS` (×50 actions), `PLATEIQ_DIFF`.

```bash
npm run typecheck
```

## Running

```bash
npx expo start          # then i (iOS Simulator) or scan with Expo Go
npx expo start --web    # browser preview at http://localhost:8081
```

In development the web build exposes `window.plateiq = { useStore, logic }` for driving state from
the console.

## Deviations from the prototype (all agreed on 2026-09-01)

- Every input that changes what the ladder prescribes calls `progressReset()`, including the target
  steppers, rounding step, anchor, home-gym toggle, plate quantities and fewest-changes (the
  prototype only reset on typed targets). Starting a rest clears the undo toast.
- History, weekly volume, PRs, 1RM trends and the library's "last top set" derive from persisted
  session records; the demo constants appear only while the tour plays.
- The hero card shows a LOGGED row and registers tour anchors `set-{workIndex}` / `log-{workIndex}`.
- The completion modal is suppressed while the tour plays; the tour overlay owns accessibility
  focus while it plays.
- Rest timer follows a wall-clock end time (survives backgrounding); haptic at zero; VoiceOver
  announces at start, every 30 s, at 10 s and at zero.
- Done-card tones and a few hard-coded dark colours in the prototype became theme tokens.
