// Guided tour + onboarding through the real UI: first launch plays the tour after layout, the
// fingertip presses real anchors, stops wait for Next, Skip shows the rewatch note, and the setup
// steps write real settings. Frames are stepped the way the harness steps them (no rAF in Jest).

import React from 'react';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { INITIAL_STATE } from '../src/logic/PlateIQLogic';
import { logic, useStore } from '../src/store/useStore';
import { Root } from '../src/Root';
import { hasAnchor } from '../src/ui/primitives';

const initialMetrics = { frame: { x: 0, y: 0, width: 428, height: 926 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const mount = () => render(<SafeAreaProvider initialMetrics={initialMetrics}><Root /></SafeAreaProvider>);
const press = (name: RegExp | string) => fireEvent.press(screen.getByRole('button', { name }));
const pick = (name: RegExp | string) => fireEvent.press(screen.getByRole('radio', { name }));
const bump = async () => act(async () => { useStore.setState({}); });

/** Advance the timeline to the next stop exactly as the rAF loop would. */
async function stepToStop() {
  await act(async () => {
    while (logic._tourIdx < logic._tourFrames.length && useStore.getState().tour === 'play' && !useStore.getState().tourWait) {
      const f = logic._tourFrames[logic._tourIdx];
      if (f.cap !== undefined || f.card !== undefined) logic.setState({ tourCap: f.cap || '', tourCard: f.card || null, tourKey: logic._tourIdx });
      if (f.run) f.run();
      jest.advanceTimersByTime(460); // the fingertip fires its action 450 ms after appearing
      logic._tourIdx++;
      if (f.stop) { logic._tourT = f.t; logic.setState({ tourWait: f.stop }); break; }
    }
    if (logic._tourIdx >= logic._tourFrames.length && !useStore.getState().tourWait) logic.endTour(true);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({ ...INITIAL_STATE, onboard: null, tour: 'auto', tourSeen: false }, true);
});
afterEach(async () => { await cleanup(); jest.useRealTimers(); });

describe('guided tour', () => {
  test('first launch: onboarding is hidden while the tour is pending, then the welcome card shows with Next and Skip', async () => {
    await mount();
    expect(screen.queryByText('Where do you lift?')).toBeNull();
    await act(async () => { logic.mount(500); jest.advanceTimersByTime(600); });
    expect(useStore.getState().tour).toBe('play');
    expect(screen.getByText('Welcome to PlateIQ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue the tour: Pick a target weight' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip the tour' })).toBeTruthy();
  });

  test('the fingertip presses real anchors and the bound action fires 450 ms later', async () => {
    await mount();
    await act(async () => { logic.startTour('onboard'); });
    expect(hasAnchor('inc-working')).toBe(true);
    expect(hasAnchor('set-1')).toBe(true); // the hero registers as set-{workIndex}
    expect(hasAnchor('mode-landmine')).toBe(true);
    expect(hasAnchor('nav-history')).toBe(true);
    await press('Continue the tour: Pick a target weight');
    await stepToStop(); // caption + two inc-working presses → stop "The warm-up ladder"
    expect(screen.getByText(/Pick a lift and a target/)).toBeTruthy();
    expect(useStore.getState().working).toBe(245);
    // a press defers its action until the fingertip lands (450 ms)
    let fired = false;
    logic.tourTap('inc-working', () => { fired = true; });
    expect(fired).toBe(false);
    await act(async () => { jest.advanceTimersByTime(460); });
    expect(fired).toBe(true);
    expect(useStore.getState().tourWait).toBe('The warm‑up ladder');
    expect(typeof logic.tourHost!.setProgress).toBe('function'); // progress is a Reanimated mutable (mocked in Jest)
  });

  test('walks every chapter: rest, log sheet, landmine, history — then the closing card and setup', async () => {
    await mount();
    await act(async () => { logic.startTour('onboard'); });
    const stops = ['Pick a target weight', 'The warm‑up ladder', 'The rest timer', 'Logging your sets', 'Dumbbells & landmines', 'History & 1RM trends', 'Start setup'];
    for (const label of stops.slice(0, -1)) {
      expect(useStore.getState().tourWait).toBe(label);
      await press('Continue the tour: ' + label);
      await stepToStop();
      await act(async () => { jest.advanceTimersByTime(500); });
      if (label === 'The rest timer') { expect(useStore.getState().activeIdx).toBe(1); expect(screen.getAllByText('RESTING', { includeHiddenElements: true }).length).toBe(1); }
      if (label === 'Logging your sets') { const st = useStore.getState(); expect(screen.queryByText('Bench press done')).toBeNull(); /* no completion modal mid-tour */ expect(st.doneIdx).toEqual([1]); expect(screen.getByText('What you actually did', { includeHiddenElements: true })).toBeTruthy(); /* visible, but the tour layer owns VoiceOver */ }
      if (label === 'Dumbbells & landmines') { expect(useStore.getState().mode).toBe('landmine'); }
      if (label === 'History & 1RM trends') { expect(useStore.getState().screen).toBe('history'); expect(useStore.getState().mode).toBe('barbell'); }
    }
    expect(useStore.getState().tourWait).toBe('Start setup');
    expect(screen.getByText('That’s the tour!')).toBeTruthy();
    await press('Continue the tour: Start setup');
    await stepToStop();
    const s = useStore.getState();
    expect(s.tour).toBe(false);
    expect(s.tourSeen).toBe(true);
    expect(s.onboard).toBe(true);
    expect(s.tourNote).toBe(false);
    // the demo workout was restored: no residue
    expect(s.activeIdx).toBeNull(); expect(s.doneIdx).toEqual([]); expect(s.screen).toBe('main'); expect(s.sheet).toBe(false);
    expect(screen.getByText('Where do you lift?')).toBeTruthy();
  });

  test('tap anywhere pauses and resumes; Skip ends the animation and setup follows with the note', async () => {
    useStore.setState({ onboard: false, tour: false });
    await mount();
    await act(async () => { logic.startTour('settings'); });
    await press('Continue the tour: Pick a target weight');
    await press('Pause or resume the tour');
    expect(useStore.getState().tourPaused).toBe(true);
    expect(screen.getByText('Paused — tap anywhere to resume')).toBeTruthy();
    await press('Pause or resume the tour');
    expect(useStore.getState().tourPaused).toBe(false);
    await press('Skip the tour');
    expect(useStore.getState().tour).toBe(false);
    expect(useStore.getState().onboard).toBe(false); // from Settings: straight back
    await act(async () => { logic.startTour('onboard'); });
    await press('Skip the tour');
    expect(useStore.getState().onboard).toBe(true);
    expect(screen.getByText(/rewatch the tour anytime from/)).toBeTruthy();
    await press(/No worries — you can rewatch/);
    expect(useStore.getState().tourNote).toBe(false);
  });

  test('a tour from Settings restores the real workout, including a running rest', async () => {
    useStore.setState({ onboard: false, tour: false, mode: 'dumbbell', working: 305 });
    logic.tapSet(0);
    await mount();
    await act(async () => { logic.startTour('settings'); });
    expect(useStore.getState().mode).toBe('barbell');
    expect(useStore.getState().working).toBe(225);
    expect(useStore.getState().activeIdx).toBeNull();
    await act(async () => { logic.endTour(true); });
    const s = useStore.getState();
    expect(s.mode).toBe('dumbbell'); expect(s.working).toBe(305); expect(s.activeIdx).toBe(0);
    expect(s.onboard).toBe(false);
  });
});

describe('onboarding', () => {
  test('commercial gym: 3 steps; home rack adds the plates step; choices land in settings', async () => {
    useStore.setState({ onboard: true, tour: false, tourSeen: true });
    await mount();
    expect(screen.getByText('Where do you lift?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip setup' })).toBeTruthy();
    await pick(/^Home rack/);
    expect(useStore.getState().homeGym).toBe(true);
    await press('Continue');
    expect(screen.getByText('What units do you lift in?')).toBeTruthy();
    await pick('Kilograms');
    expect(useStore.getState().units).toBe('kg');
    await press('Continue');
    expect(screen.getByText('Which plates do you own?')).toBeTruthy();
    expect(screen.getByText('MICROPLATES')).toBeTruthy();
    await press('One more 20 kg plate');
    expect(useStore.getState().qty[20]).toBe(3);
    await press('Continue');
    expect(screen.getByText('What do you load from?')).toBeTruthy();
    await pick('15 kg bar');
    expect(useStore.getState().bar).toBe(15);
    await pick('Floor sleeve/strap');
    await pick('Not sure — use the 2.5 kg standard');
    expect(useStore.getState().dbHandle).toBe(2.5);
    await press('Back');
    expect(screen.getByText('Which plates do you own?')).toBeTruthy();
    await press('Continue');
    await press('Start lifting');
    expect(useStore.getState().onboard).toBe(false);
    expect(screen.queryByText('What do you load from?')).toBeNull();
    await bump();
    // commercial gym path skips plates
    useStore.setState({ onboard: true, onboardStep: 0 });
    await bump();
    await pick(/^Commercial gym/);
    await press('Continue'); await press('Continue');
    expect(screen.getByText('What do you load from?')).toBeTruthy();
    expect(screen.getByText('Start lifting')).toBeTruthy();
  });

  test('Skip on the first step leaves setup immediately', async () => {
    useStore.setState({ onboard: true, tour: false, tourSeen: true });
    await mount();
    await press('Skip setup');
    expect(useStore.getState().onboard).toBe(false);
  });
});
