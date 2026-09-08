# App Store screenshots

Four screenshots at **1320 × 2868**, the 6.9-inch iPhone size App Store Connect requires. No alpha
channel — an alpha channel is a hard upload failure, not a warning.

| File | What it shows |
|---|---|
| `01-main-loaded-bar.png` | The main screen at 225 lb, plates drawn to scale on the sleeve |
| `02-rest-timer-plate-change.png` | The rest timer running, with the plates to add for the next set |
| `03-one-rep-max.png` | Setting a target from a recent set, with working percentages |
| `04-exercise-library.png` | The exercise library and today's session queue |

Lead with `01` and `02`: the first two are what people see in App Store search results, and the
plate diagram is the thing no competitor screenshot shows as clearly.

No iPad screenshots are needed — `app.json` sets `supportsTablet: false`.

## How these were made

Captured on the **iPhone 17 Pro Max** simulator, which renders at exactly 1320 × 2868 so nothing
has to be resized (resizing is what usually produces a soft, rejected screenshot). The plain
iPhone 17 Pro is 6.3-inch and produces a size Apple treats as optional rather than required.

```bash
xcrun simctl io booted screenshot --type=png screenshots/NN-name.png
node scripts/flatten-screenshots.js
```

`flatten-screenshots.js` strips the alpha channel that `simctl` always writes and checks every file
against the required dimensions. macOS ships nothing that does this — `sips` converts formats, not
channel layouts — so the script decodes and re-encodes the PNG itself.

If you drive the simulator by hand: turn **Tools button** off in the Expo Go dev menu first, or its
floating blue gear sits on top of the app in every shot. The switch ignores a synthetic tap; drag it
instead.

## Worth knowing

These come from the app running through Expo Go, which renders the real UI but is not the binary
you will ship. They are good enough to upload, and they let you fill in App Store Connect before a
build exists. **Retake them from the TestFlight build if anything visual changes** — particularly
the app name, once it is decided.
