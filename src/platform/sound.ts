// The rest-end chime. Mirrors platform/haptics.ts: the store never depends on the native module
// being present (jest, web, or a build without expo-audio).

type AudioPlayerLike = {
  play: () => void;
  seekTo: (seconds: number) => Promise<void>;
  remove: () => void;
  volume: number;
};
type AudioModule = {
  createAudioPlayer?: (source: number, options?: object) => AudioPlayerLike;
  setAudioModeAsync?: (mode: Record<string, unknown>) => Promise<void>;
};

let mod: AudioModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-audio') as AudioModule;
} catch {
  mod = null;
}

const quiet = (p?: Promise<unknown>) => { if (p && typeof p.catch === 'function') p.catch(() => undefined); };

let player: AudioPlayerLike | null = null;
let modeSet = false;

/**
 * Warm the audio path. Called when a rest STARTS, not at boot, so an app session with no timer
 * never claims an audio session.
 *
 * playsInSilentMode: true — AVAudioSession category `.playback`, which ignores the ring/silent
 *   switch. This is the only setting that makes the chime audible with the phone on silent, and it
 *   is why the Settings row says so out loud.
 * interruptionMode: 'mixWithOthers' — the chime never takes exclusive focus, so the user's music
 *   keeps playing untouched.
 * shouldPlayInBackground: false — avoids needing the `audio` background mode, which App Review
 *   rejects for a non-media app. Reaching a pocketed phone is the notification's job, not audio's.
 */
export function prepareRestSound() {
  if (!mod?.createAudioPlayer) return;
  if (!modeSet) {
    modeSet = true;
    quiet(mod.setAudioModeAsync?.({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }));
  }
  if (!player) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      player = mod.createAudioPlayer(require('../../assets/rest-done.wav'));
      quiet(player.seekTo(0)); // decode now, so the first chime is instant
    } catch { player = null; }
  }
}

export function playRestSound() {
  prepareRestSound();
  const p = player;
  if (!p) return;
  // a player that already rang sits at the end of the file; play() there would be silent
  p.seekTo(0).then(() => p.play()).catch(() => undefined);
}

/** Free the decoder (the store's cleanup). */
export function releaseRestSound() {
  try { player?.remove(); } catch { /* already gone */ }
  player = null;
}

/** Test hook. */
export function _resetSoundForTests() { player = null; modeSet = false; }
