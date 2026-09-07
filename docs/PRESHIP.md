# Pre-ship audit — 2026-09-06

A ten-dimension audit of the whole app, with every falsifiable claim attacked by an independent
skeptic before it was acted on. This file records what was fixed, what was deliberately not, and
what a claim looked like when it did **not** survive — so none of it gets re-litigated later.

## Fixed

### Blockers
- **`app.json` declared background audio and requested the microphone.** `expo-audio`'s config
  plugin defaults `enableBackgroundPlayback` to `true` (pushing `audio` into `UIBackgroundModes`)
  and applies a placeholder `NSMicrophoneUsageDescription` unless told otherwise. The runtime code
  disables background audio on purpose, but a runtime setting cannot undo a build-config
  declaration, and App Review tests the claim directly (guideline 2.5.4). None of this is visible
  in Expo Go, which uses its own app config. Verify after any plugin change:
  `npx expo config --type introspect` — neither key may appear.
- **A pending undo survived a lift switch.** Logging a set raises a 7 s Undo toast; switching lifts
  on the session strip left it up, and pressing it attached the previous lift's weights to the new
  lift's record. Records cannot be deleted, so that was permanent. `pickExercise`, the scheme picker
  and `setPct` now clear `undo`, matching `setMode` / `setUnits` / `addSet`.
- **No privacy policy.** Required in App Store Connect *and* reachable inside the app
  (guideline 5.1.1(i)). Written to `docs/privacy.html` and `docs/support.html`, linked from
  Settings. **Someone still has to switch GitHub Pages on** (repo → Settings → Pages → branch
  `main`, folder `/docs`) or both links 404 during review.

### Controls that cleared progress without changing anything
`progressReset()` is correct when an input really changes the ladder, but most pickers did not check
whether anything changed. Tapping the lift you were already on, the lit mode chip, the bar profile
you already had, the collar, the dumbbell pairing, a target stepper the floor swallowed, the rack
`−` at zero, or `−` on the 0 % "Empty bar" rung (which ships on the first card of a fresh install
and could only ever destroy progress) all wiped every logged set. Each now returns `null` when the
value is unchanged, following the pattern `roundTo` / `anchorType` / `homeGym` already used.

### Everything else
- `advanceSession` wraps when every queued lift is done, instead of dead-ending on
  "Session · 3 of 3, all ticked" from day two onward, and only counts lifts actually in the queue.
  Its undo is snapshotted *before* the writes and applied *after* the navigation — `pickExercise`
  drops pending undos, and `MemoryHost` mutates its state object in place.
- The rest panel said "each side" in landmine mode, where one end is pinned in the anchor.
- The panel's largest control flipped an `expanded` flag read nowhere. It now pauses and resumes,
  which the panel had no control for. `expanded` and `barDraft` are gone from `PERSISTED_KEYS`.
- Notifications: `ensurePermission` distinguishes granted / denied / **blocked**. Once iOS has been
  told "Don't Allow" it never shows the sheet again, so the switch could only slide on and snap
  back forever. Permission is re-checked on launch and on every foreground. Delivered banners are
  dismissed rather than stacking up.
- Storage failures reached only `console.warn`, which nobody sees on a phone: out of disk you would
  log a whole workout that was never saved. A banner now says so on every screen.
- The set-card log button was announced as the plate picture's own description — the same sentence
  twice, with no verb — and never matched its visible words for Voice Control.
- The tour no longer auto-starts under VoiceOver; the undo toast lasts 20 s with a screen reader
  and takes focus for destructive actions only.
- Copy: "Effective weight" is explained, 1RM is spelled out, RPE names its scale, the 1-rep-max
  sheet names the Epley formula, the Library's queue button has a caption, "1 sessions logged".
- Five Archivo faces are imported by path instead of eighteen via the package entry (−1.6 MB).
- `LICENSE` no longer assigns this work to Expo. Settings no longer claims to be version 1.4.

## Deliberately not done
- **A React error boundary.** Worth adding, but the crash-loop argument for it was refuted: the
  persisted-state sanitizer rejects every bad shape before it reaches a screen, corrupt and
  unreadable saves already fall back to defaults, and a randomised test pins that any reachable
  state survives a save-and-reload.
- **An undo on progress-clearing resets.** With the no-op guards in place the *accidental* wipes
  are gone, and the remaining ones are genuine input changes where clearing is the approved
  behaviour. A generic undo helper here would be actively wrong: it would restore progress without
  restoring the input that changed, which is the corruption the blocker above fixed.
- Custom exercises; palette memoisation (540 store subscriptions on Main); the per-second whole-tree
  re-render during a rest; history pagination and summarisation; editable top-set reps/rest;
  ducking the chime under music. All real, none load-bearing for 1.0.

## Claims that did NOT survive
Recorded so they are not raised again.
- *"No `eas.json` means no App Store build."* It is generated by `eas build:configure`, and
  `expo prebuild` + Xcode reaches an `.ipa` anyway. What was real: no `ios.buildNumber`, so a second
  upload would be refused — now handled by `appVersionSource: remote` + `autoIncrement`.
- *"The 4-second storage timeout overwrites saved data with defaults."* It cannot. On iOS every
  AsyncStorage read and write shares one serial queue, so a stuck read blocks later writes rather
  than racing them, and the late rehydrate applies through a raw `setState` that does not persist.
- *"Nothing tests that the app starts, so it could hang forever."* The coverage gap is real; the
  conclusion is not. Run with storage that never answers and fake timers past 4 s, the app comes up
  on defaults and dismisses the splash exactly once.
- *"The keyboard's Done button might not commit a typed weight."* Dismissing the keyboard *is*
  blurring the field — the same call — and blur is what commits.
- *"Day 2 has no way to clear yesterday's ladder."* Three controls on the returning user's own path
  already do. What is left is a labelling gap, not a trap.

## Self-review — 2026-09-07

The pre-ship diff above was then reviewed against itself: thirty-one agents over eight lenses, each
claimed defect attacked by an independent skeptic. Four survived, three of them created by the
diff's own new features. All are fixed, each pinned by a regression test.

- **`setBarWeight` was the picker the no-op-guard pass missed**, and it is on the primary screen.
  In dumbbell mode, tapping the handle chip already lit wiped every logged set with no Undo. Its
  twin `pickHandle` was guarded; this is the entry point the mode chips and onboarding use.
- **A paused rest could not survive a relaunch.** `restEndsAt` is null while paused, so the resume
  branch could not distinguish a mid-rest pause from an auto-start-off one and always restored the
  full time; and the 30-minute stale-rest rule only looked at `restEndsAt`, so an abandoned pause
  never expired. Now stamped with `pausedAt` / `pausedRemaining`, written on pause transitions only.
  **Both keys needed `nullableOk` validators** — the sanitizer accepts only `null` for a
  null-defaulted key otherwise, which would have discarded the stamps and left the fix inert.
- **`ctaAria` told VoiceOver a logged set's button would open the editor.** It starts a rest. Its
  ternary also tested state in a different order from the visible label.
- **The VoiceOver tour guard raced the native accessibility probe.** `mount()` read the flag before
  anything had asked iOS for it, so on a fresh install the guard was roughly a coin flip. Re-checked
  inside the timer callback where the tour actually starts — deliberately not inside `startTour`,
  which is the user-initiated path from Settings.

Lower severity, also fixed: undoing "Log & go to next" left the record in History and re-confirming
wrote a duplicate; the launch-time notification re-check ran before saved settings existed; the
"turn notifications on in iOS Settings" banner could never clear itself; and the 4-second storage
fallback could start the tour on defaults and let its exit overwrite a returning user's workout.

### Claims that did not survive this round
- *"`setBarWeight` silently swaps the bar profile, changing the sleeve length the solver uses."*
  Real state change, no reachable consequence: a sweep of every target across both gym modes found
  the two same-weight profiles emit identical plans.
- *"Back to sets has no way back to the completion card."* Two taps, the same two that reached it.
- *"The new shipping-config test block leaves the 2.5.4 blocker untested."* `expo config --type
  introspect` emits neither key; the blocker is fixed and checkable in one command.
- *"A failed write thrashes storage once a second on a full disk."* Bounded and self-limiting.

### Test-coverage gaps this review named, still open
`saveSession` / `recordSession` had zero coverage before this round; nothing fires an AppState
`change` event, so `recheckNotify` is still untested; nothing exercises the 4-second hydration
fallback; and two existing tests are vacuous (`hardening.test.tsx` "a target that never mounts
leaves the screen plainly dark", and the per-field keyboard Done bar test, which passes with a
hardcoded shared nativeID).

## Still open before submission
- App icon and splash are still the Expo placeholders.
- `eas.json` deliberately omits `ascAppId` and `appleTeamId`. Placeholder strings there fail EAS's
  own schema validation, so `eas submit` would abort before it could prompt; omitted, eas-cli asks
  for both on the first submit and remembers them.
- The bundle identifier is still `com.plateiq.app`, and the App Store name is undecided —
  "PlateIQ - AI Meal Tracker" already exists in the same category. Both are permanent after the
  first build / app record.
- The differential test has never run on this machine; it skips without the design-canvas export.
  Run `PLATEIQ_REQUIRE_DIFF=1 npm test` before shipping any maths change.
