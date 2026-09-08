# App Store listing — draft copy

Everything App Store Connect asks for at step 18, written to Apple's exact limits. Character counts
are verified by `scripts/check-listing.js`; run it after any edit.

The app **name** is still undecided, so it appears below as `NAME`. Nothing else here depends on it —
swap the word in and the counts still hold, as long as the name is 12 characters or fewer.

---

## Subtitle — 30 characters max

```
Know what goes on the bar
```

Not "calculator". Apple names a basic calculator as its own example of an app rejected under
guideline 4.2 for minimum functionality, so the listing should lead with the job, not the mechanism.

## Promotional text — 170 characters max, changeable any time without review

```
Enter the weight you want. See exactly which plates go on each sleeve, with a warm-up ladder up to it and a rest timer between sets. Works offline. Collects nothing.
```

## Description — 4,000 characters max

```
Walk up to the bar, enter the weight you want, and stop doing arithmetic.

PlateIQ shows you exactly which plates go on each sleeve — drawn to scale, in the order you load
them — then builds the warm-up ladder up to your top set and times the rest in between. It keeps a
log of what you actually lifted, not what you planned to.

WHAT IT DOES

• Plate loading, drawn. Every set shows the real plates on a real sleeve, so you can check it
  against the bar in front of you at a glance.
• Warm-up ladders. Empty bar to top set, in sensible jumps, with reps and rest per rung. Adjust
  any rung and the rest follows.
• Between-set plate changes. When the next set is heavier, it tells you which plates to strip and
  which to add — not just the new total.
• A rest timer that reaches you. Chime, haptic buzz, and an optional lock-screen alert for when
  the phone is in your pocket.
• Your session, in order. Queue several lifts and it hands you from one to the next.
• History that comes from what you lifted. Weekly volume, PRs, and an estimated 1-rep max trend.

IT KNOWS REAL GYMS

• Barbells, loadable dumbbells, and landmines — including the effective weight a landmine actually
  puts in your hands, which is less than what is on the sleeve.
• Kilos or pounds, with the rounding step you choose, down to microplates.
• Home rack mode: tell it which plates you own and it will only suggest loads you can actually
  build.
• Competition mode with collar weight counted in the total.
• Bar profiles with real sleeve lengths, so it knows when the sleeve fills up before the target.
• Fewest plate changes: build each set on top of the last where it costs no accuracy.
• A reverse reader — tell it what is already on the bar and it tells you the total.
• Set your target from a recent set using the Epley formula, adjusted for reps in reserve.

NOTHING TO SIGN UP FOR

No account. No sign-in. No analytics. No ads. No network connections of any kind — PlateIQ does not
have a server to send anything to, so nothing you log can leave your phone. Your sessions, settings
and plate rack are stored on the device and travel with your iPhone backup.

BUILT TO BE USED MID-SET

Big numbers, high contrast, and a dark theme that does not blind you in a quiet gym. Full VoiceOver
labels on every control, Dynamic Type support, and reduced-motion support throughout.

PlateIQ is a loading and logging tool, not a coaching program. It does not tell you what to train
or how hard — it makes sure the number on the bar is the number you meant.
```

## Keywords — 100 characters total, comma-separated, NO spaces (spaces count)

```
barbell,plates,loading,warmup,lifting,gym,squat,bench,deadlift,powerlifting,rest,timer,1rm,kg,lb
```

Do not repeat the app name or the subtitle words here — Apple already indexes those, so repeating
them wastes characters.

## Category

Primary: **Health & Fitness**. No secondary category.

## Age rating

Expect **4+**. Answer the 2026 questionnaire honestly and do not over-declare: claiming medical or
health-treatment content pushes the app into a higher band and a stricter health-app review, and
PlateIQ makes no medical claims.

## App Privacy questionnaire

The answer to "Do you or your third-party partners collect any data from this app?" is **No**. That
produces a **Data Not Collected** label. This is literally true: there is no networking code in the
app at all.

## Screenshots

Four are captured and ready at `screenshots/`, all 1320 x 2868 with no alpha channel. See
`screenshots/README.md` for what each shows, the capture command, and why they should be retaken
from the TestFlight build if anything visual changes.

## Support and privacy URLs

```
https://dontrellwest.github.io/plateiq/support.html
https://dontrellwest.github.io/plateiq/privacy.html
```

## App Review notes

```
PlateIQ needs no account and no sign-in, and works entirely offline — please turn off Wi-Fi and
cellular if you would like to confirm that.

Fastest way to see the whole app: a guided tour runs automatically on first launch and takes about
twenty seconds. You can replay it any time from Settings > Watch the tour.

To try the core feature by hand: on the main screen, use + or - beside the working weight, or tap
the weight to type one. The plate diagram updates immediately. Tap any set card to start its rest
timer.

"Alert on the lock screen" in Settings schedules a LOCAL notification only, for the end of a rest
period. The app has no remote push and no server.

The landmine mode deliberately shows an "effective weight" that is lower than the plates loaded on
the sleeve, because a landmine takes part of the load through its floor pivot. This is explained on
screen under the anchor selector.
```

## What's New — first release

```
First release.
```
