# PlateIQ

Native iOS barbell-loading calculator and workout companion, built with Expo (React Native, TypeScript)
from the design handoff in `../design_handoff_plateiq/`.

## Layout

- `src/logic/PlateIQLogic.ts` — the prototype's logic class ported line-for-line (solver, reducers, tour timeline, view model).
- `src/logic/constants.ts` — plate sets, thickness, bar profiles, collars, schemes, skins, bar art, accents.
- `src/logic/types.ts` — the store's state shape (README "State management").
- `__tests__/stress.test.ts` — port of `qa/stress-test.html`: same invariants, same seeds.
- `__tests__/differential.test.ts` — executes the prototype's original script from the handoff HTML and requires identical solver output.

## Tests

```bash
npm test
```

Runs the reduced harness (20,000 solver scenarios, 10,000 UI actions) plus the 30,000-scenario differential check.
Both are deterministic prefixes of the full runs, so a reduced green run is comparable with the prototype.

```bash
npm run test:full
```

Runs the prototype's full counts: 1,000,000 solver scenarios (≈5.6M sets) and 250,000 UI actions across 5,000 users,
plus a 200,000-scenario differential. Takes roughly 10 minutes on a laptop.

Counts can also be set directly: `PLATEIQ_SCENARIOS`, `PLATEIQ_USERS` (×50 actions), `PLATEIQ_DIFF`.

## Typecheck

```bash
npm run typecheck
```
