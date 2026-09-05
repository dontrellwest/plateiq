# Hardening pass — 2026-09-05

A nine-area code audit plus simulator testing on an iPhone 17 Pro, an iPhone SE and an iPad
produced 99 raw findings. This is what changed, grouped by what a lifter would notice. Every
behaviour change below has a regression test in `__tests__/hardening.test.ts`; the randomised
property suite in `__tests__/invariants.test.ts` guards the solver and view model on thousands of
fresh configurations each run (`PLATEIQ_SEED=<n>` reproduces a failure).

The plate solver (`evaluate` / `plan` / `alts` / `loadSleeve` / `perSide` / `oneSide`) was not
touched, and none of the view-model fields the differential test compares (`pivotX`, `pivotY`,
`rotate`, `wellH`, `workWellH`, `warn`, `schemeLine`, `handlingLabel`, `finishedAt`) changed.

## Wrong numbers

- **Comma decimals.** `22,5` typed on a European keyboard became 225. Both weight fields now treat
  a comma as a decimal point.
- **Landmine "What's on the bar?"** applied the *loaded* bar weight as the *effective* target, so
  reading one 45 lb plate prescribed almost twice the plates. The reader now converts through the
  anchor coefficient and says so ("Use 63.5 lb effective as target").
- **Stepper floors.** The minus button raised a typed 47 lb target to 50, used a hard-coded 5 even
  in kg, and could not step down to loadable kg weights. Steppers now floor one plate step above the
  bar or handle in the current unit and never move a typed value up. The landmine stepper moved
  0.5 lb per press (rounding step instead of plate step); it now moves one plate step.
- **Landmine targets below the bare bar** were silently replaced. Typed values are floored at the
  bar seen through the anchor, and a set the bar alone exceeds carries the ADJUSTED badge.
- **Onboarding bar choice** left the bar profile stale, so a 35 lb bar became a 20 kg bar on a
  unit switch. Picking a bar by weight now names its profile. A unit switch also keeps the target
  at or above the converted bar.
- **Infinity** in the bar field rendered "Infinity lb"; it now falls back like any junk input.

## Workout flow

- Logging the **last set from its card** never showed the completion card; it now finishes the
  exercise exactly like the panel's Done.
- **Undo after Done** with auto-start off restarted the rest running; it restores the paused state.
- A **rest in progress survives a relaunch**: iOS often terminates a suspended app between sets.
  The set's index, rest length, wall-clock end time and paused flag are persisted; the countdown is
  recomputed on launch, and a rest that ended more than 30 minutes ago is dropped.
- The **haptic at zero** no longer fires minutes late when the app resumes after the rest ended
  in the background (a local notification remains the right long-term answer; see below).
- **Guided tour:** Skip pressed during the half-second boot window no longer lets the tour start
  anyway; a long frame (locked phone) can no longer drop a keyframe's action; the demo runs on the
  default ladder in the user's units (100 kg / 225 lb) even when they have removed warm-ups or
  picked a scheme, mirrors the bar field correctly when started from dumbbell mode, and restores
  warm-ups, scheme and drafts afterwards.

## Robustness

- **Unreadable saved data** used to leave the app stuck behind a half-mounted tour overlay with
  nothing to press. It now logs, starts with defaults and settles normally; a storage layer that
  never answers is given up on after four seconds.
- **Wrong-shaped saved values** (a string target, a null history) are dropped per key instead of
  reaching the solver or crashing every launch.
- The app **waits for both fonts and saved state** before the first frame (returning users never
  see a flash of the tour chrome), keeps the native launch screen up meanwhile, and no longer stays
  blank forever if a font fails to load.
- Storage is written only when a persisted value actually changed (previously every 1 s tick and
  every typed character rewrote the whole state), a no-op patch no longer re-renders the app, the
  view model is computed once per state instead of twice, and plates only re-render when their
  drawing inputs change.

## Accessibility (VoiceOver, Dynamic Type, contrast)

- Set cards, the hero card, library rows and the rest-timer header were single VoiceOver elements
  that swallowed the controls inside them (the ±5 % pills, Remove, Edit, the queue button, the
  Done / Start rest button). Each is now a container whose controls are reachable, with the card's
  own action on its "Tap when done" row.
- Sheets, the completion card and onboarding move VoiceOver focus to their title when they open.
- The undo toast, tour captions and cards, and the target-unreachable warning are announced (iOS
  ignores live regions). A new rest is announced even when the panel stays mounted.
- Touch targets under 44 pt were enlarged or given hit slop: the Settings switch, unit/rounding
  and trend chips, the undo toast's dismiss button, the search clear button and the "Edit ›" link.
- Muted text now meets WCAG 4.5:1 on every surface it is used on, in both themes; the light-theme
  "ADD FOR NEXT" plate chips were effectively invisible (1.2:1) and are readable now.
- Text scales with Dynamic Type up to 2x; plate-face numerals and the set-number badge stay fixed
  because their geometry is fixed; the working-weight field and the bar card shrink instead of
  overflowing on narrow phones.

## Layout and input

- The decimal keyboard has no return key, so a Done bar sits above it and a scroll dismisses it;
  values still commit on blur.
- The main feed reserves room for the rest panel plus the home indicator; plate lists may wrap to
  two lines instead of truncating; the onboarding footer keeps 16 pt on home-button phones; the
  "Change ›" pill grows with text size.

## Configuration

- `expo-splash-screen` replaces the invalid top-level `splash` key (SDK 57 rejects it); the launch
  screen is dark and hides once the app is ready.
- `ios.supportsTablet` is now `false`: the app is a portrait phone layout and would otherwise be
  forced to rotate and multitask on iPad without a tablet design. It still runs on iPad in
  compatibility mode.
- The `UIViewControllerBasedStatusBarAppearance` override was removed (it made the per-theme status
  bar style a no-op in native builds); `ITSAppUsesNonExemptEncryption` is declared `false`.

## Known, deliberately not changed

- lb ↔ kg round trips round to the plate grid, so 135 lb → 60 kg → 130 lb. Exact restoration would
  need a canonical value per unit; the target stays loadable either way.
- The rest timer is only shown on the Main screen. A compact strip on other screens is a design
  decision.
- No local notification is scheduled for the end of a rest when the app is in the background;
  adding one means a notification permission prompt (the app currently asks for none).
- History demo strings shown during the tour are lb-only.
- The app icon and Android assets are still the Expo template defaults.
