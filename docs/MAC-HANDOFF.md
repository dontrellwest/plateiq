# Picking PlateIQ up on a Mac

Everything below is what the Windows machine could not do: run the app on an iOS Simulator or a
real iPhone. The code, tests, and web preview work anywhere Node runs.

## 1. One-time installs

| What | Why | How |
|---|---|---|
| Xcode (App Store, ~15 GB) | iOS Simulator + native build tools | Install, open it once, accept the licence, then `xcode-select --install` for the command-line tools |
| An iOS Simulator runtime | Xcode ▸ Settings ▸ Components ▸ iOS 17/18 simulator | Downloaded inside Xcode; several GB |
| Node 20 or 24 | Metro / Jest / Expo CLI | `brew install node` (or nvm). The project was built on Node 24.19 |
| Watchman (optional) | Faster file watching for Metro | `brew install watchman` |
| Expo Go on your iPhone (free, App Store) | Run on a real device without a build | Same Wi‑Fi as the Mac |

No Apple Developer account is needed for the Simulator or Expo Go. A paid account ($99/yr) is only
needed to install a standalone build on a device or ship to TestFlight/App Store.

## 2. First run

```bash
git clone https://github.com/dontrellwest/plateiq.git
```

The design handoff (`design_handoff_plateiq/`, needed only by the differential test and the
side-by-side comparison) is not in the repo; copy it next to the clone from OneDrive if you want
those. Without it, the differential test simply skips.

```bash
cd plateiq
npm install
npm test            # reduced harness + differential + UI suites (~1 min)
npx expo start
```

Then press `i` for the iOS Simulator, or scan the QR code with the Camera app on an iPhone that has
Expo Go installed. Every native dependency (react-native-svg, react-native-reanimated,
react-native-worklets, async-storage, expo-haptics, expo-font, safe-area-context) is supported by
Expo Go for SDK 57, so no custom dev client is required.

Permissions the app asks for: none. It has no network, camera, location, or notification usage.

## 3. What to verify on a real device (things the web preview cannot show)

- Archivo loads through `@expo-google-fonts/archivo` at runtime; on iOS check the numerals use
  tabular figures (the `fontVariant: ['tabular-nums']` style).
- iOS shadows on the hero card, sheets, timer panel, and toast (web has no equivalent).
- Reanimated tweens: plate heights (220 ms), timer ring, slide-ups, pulse dot, tour fingertip.
- Reduced motion (Settings ▸ Accessibility ▸ Motion ▸ Reduce Motion) disables all of the above.
- VoiceOver: timer announcements at start / every 30 s / 10 s / zero; sheets and the completion
  modal trap focus; the tour overlay owns focus while it plays.
- Haptic when the rest timer reaches zero (expo-haptics; silent on the Simulator).
- Backgrounding during a rest: the countdown follows the wall clock when you return.
- Dynamic Type at ±2 steps.

## 4. Handy commands

```bash
npm run test:full            # prototype counts: 1M solver scenarios + 250k UI actions (~10 min)
npm run typecheck
npx expo start --web         # browser preview at http://localhost:8081
npx expo start --ios         # simulator directly
npx expo run:ios             # native build (needs Xcode; first build ~10 min)
```

For a side-by-side with the prototype, serve `../design_handoff_plateiq` with any static server
(e.g. `npx serve ../design_handoff_plateiq -p 8090`) and open `#1b`.

## 5. Shipping later (not needed to run)

- `npx expo prebuild` / `eas build -p ios` need an Apple Developer account and EAS (free tier
  exists; iOS cloud builds are limited on it).
- `app.json` already has `bundleIdentifier: com.plateiq.app`, portrait-only, dark splash, and
  `userInterfaceStyle: automatic` for system theme following.
- App icon / splash images are still the Expo defaults in `assets/`.
