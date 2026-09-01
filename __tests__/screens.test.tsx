// History / Library / Settings screens and the bar, scheme, reverse, 1RM and rack sheets through the UI.

import React from 'react';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { INITIAL_STATE } from '../src/logic/PlateIQLogic';
import { logic, useStore } from '../src/store/useStore';
import { Root } from '../src/Root';

const initialMetrics = { frame: { x: 0, y: 0, width: 428, height: 926 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const mount = () => render(<SafeAreaProvider initialMetrics={initialMetrics}><Root /></SafeAreaProvider>);
const reset = () => useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);
const press = (name: RegExp | string) => fireEvent.press(screen.getByRole('button', { name }));
const pick = (name: RegExp | string) => fireEvent.press(screen.getByRole('radio', { name }));
const DAY = 86400000;
const rec = (exercise: string, at: number, sets: Array<[number, number]>, units: 'lb' | 'kg' = 'lb', mode: 'barbell' | 'dumbbell' | 'landmine' = 'barbell') =>
  ({ id: 'r' + at + exercise, at, exercise, mode, units, sets: sets.map(([w, r], i) => ({ label: 'Set ' + (i + 1), w, r, planW: w, planR: r })) });

beforeEach(reset);
afterEach(async () => { await cleanup(); });

describe('History', () => {
  test('empty state on a fresh install', async () => {
    useStore.setState({ screen: 'history' });
    await mount();
    expect(screen.getByText('No sessions logged yet')).toBeTruthy();
    expect(screen.getByText('0 sessions logged · last 10 weeks')).toBeTruthy();
    expect(screen.getByText(/Not enough data yet/)).toBeTruthy();
  });

  test('derives stats, volume, PRs, the trend and recent rows from records; kg records convert', async () => {
    const now = Date.now();
    useStore.setState({
      screen: 'history',
      records: [
        rec('Bench press', now - 20 * DAY, [[45, 15], [215, 5]]),
        rec('Bench press', now - 13 * DAY, [[45, 15], [225, 5]]),
        rec('Bench press', now - 1 * DAY, [[45, 15], [235, 5]]),
        rec('Back squat', now - 2 * DAY, [[100, 5], [140, 3]], 'kg'),
      ],
    });
    await mount();
    expect(screen.getByText('4')).toBeTruthy(); // sessions
    expect(screen.getByText(/^Bench press · last 8 weeks$/)).toBeTruthy();
    expect(screen.getByLabelText(/Estimated one rep max trend for Bench press, \+\d+ lb/)).toBeTruthy();
    expect(screen.getByText('Yesterday · Barbell')).toBeTruthy();
    expect(screen.getByText('235 × 5')).toBeTruthy();
    expect(screen.getByText('140 × 3')).toBeTruthy(); // recorded in kg, shown as recorded
    expect(screen.getByText(/2 sets · 920 kg/)).toBeTruthy();
    expect(screen.getAllByText('PR').length).toBe(2); // two bench sessions beat the previous best
    expect(screen.getByText('2')).toBeTruthy(); // new PRs stat
    // trend switcher lists lifts in the session queue plus the current trend
    await pick('Show trend for Bench press');
    expect(useStore.getState().trendEx).toBe('Bench press');
  });

  test('the tour shows sample data', async () => {
    useStore.setState({ screen: 'history' });
    logic.startTour('settings');
    useStore.setState({ screen: 'history' });
    await mount();
    expect(screen.getByText('Sample data while the tour plays', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('18', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Library', () => {
  test('search filters, queue toggles with undo, picking loads the exercise and seeds its target', async () => {
    useStore.setState({ screen: 'library' });
    await mount();
    expect(screen.getAllByText('last top set').length).toBe(9);
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'landmine');
    expect(screen.getAllByText('last top set').length).toBe(3);
    await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'zzz');
    expect(screen.getByText(/No exercise matches that/)).toBeTruthy();
    await press('Clear search');
    await press('Add Deadlift to session');
    expect(useStore.getState().session).toContain('Deadlift');
    expect(screen.getByText('Deadlift added to session')).toBeTruthy();
    await press('Remove Deadlift from session');
    expect(useStore.getState().session).not.toContain('Deadlift');
    await press(/^Back squat, Barbell · Legs, last top set 315 × 3/);
    const s = useStore.getState();
    expect(s.screen).toBe('main');
    expect(s.exercise).toBe('Back squat');
    expect(s.working).toBe(315);
  });

  test('last top set comes from logged history when there is one', async () => {
    useStore.setState({ screen: 'library', records: [rec('Deadlift', Date.now() - DAY, [[135, 5], [405, 2]])] });
    await mount();
    expect(screen.getByText('405 × 2')).toBeTruthy();
    await press(/^Deadlift, Barbell · Pull, last top set 405 × 2/);
    expect(useStore.getState().working).toBe(405);
  });
});

describe('Settings', () => {
  test('theme, accent, units, rounding, anchor, toggles, collars, tour and history entry points', async () => {
    useStore.setState({ screen: 'settings' });
    await mount();
    await pick('Light theme');
    expect(useStore.getState().theme).toBe('light');
    await pick('Sky accent');
    expect(useStore.getState().accent).toBe('sky');
    expect(screen.getByText('Sky')).toBeTruthy();
    await pick('Kilograms');
    expect(useStore.getState().units).toBe('kg');
    await pick('Round to 2.5');
    expect(useStore.getState().roundTo).toBe(2.5);
    await pick('Weighted hinge');
    expect(useStore.getState().anchorType).toBe('hinge');
    await fireEvent.press(screen.getByRole('switch', { name: 'Home gym mode' }));
    expect(useStore.getState().homeGym).toBe(true);
    await fireEvent.press(screen.getByRole('switch', { name: 'Fewest plate changes' }));
    expect(useStore.getState().minChanges).toBe(false);
    await fireEvent.press(screen.getByRole('switch', { name: 'Competition mode' }));
    expect(useStore.getState().comp).toBe(true);
    await pick(/^Competition collars/);
    expect(useStore.getState().collarId).toBe('comp');
    await fireEvent.press(screen.getByRole('switch', { name: 'Auto-start rest timer' }));
    expect(useStore.getState().autoRest).toBe(false);
    await press('Training history');
    expect(useStore.getState().screen).toBe('history');
    await act(async () => { useStore.setState({ screen: 'settings' }); });
    await press('Watch the tour');
    expect(useStore.getState().tour).toBe('play');
    await act(async () => { logic.endTour(true); });
    expect(useStore.getState().screen).toBe('settings');
    await press('Run first-time setup again');
    expect(useStore.getState().onboard).toBe(true);
  });
});

describe('sheets', () => {
  test('bar picker sets profile, weight and sleeve; the main screen reflects it', async () => {
    await mount();
    await press(/^Bar: Standard barbell/);
    expect(screen.getByText('Which bar?')).toBeTruthy();
    await pick(/^EZ curl bar/);
    const s = useStore.getState();
    expect(s.barProfile).toBe('ez'); expect(s.bar).toBe(25); expect(s.sheet).toBe(false);
    expect(screen.getByText('190 mm sleeve')).toBeTruthy();
  });

  test('scheme picker adds after-sets under the top set', async () => {
    await mount();
    await press(/Change the set scheme/);
    await pick(/^Back-off sets/);
    expect(useStore.getState().scheme).toBe('backoff');
    expect(screen.getByText('Then · Back-off sets')).toBeTruthy();
    expect(screen.getByText('BACK-OFF SETS')).toBeTruthy();
    expect(screen.getAllByText('Back-off 1').length).toBe(1);
  });

  test('reverse reader doubles one sleeve, adds the bar, and applies the total', async () => {
    await mount();
    await press('Read a loaded bar');
    expect(screen.getByText(/Nothing on the sleeve yet — that’s a bare 45 lb/)).toBeTruthy();
    await press('Add a 45 lb plate');
    await press('Add a 25 lb plate');
    expect(screen.getByText('185')).toBeTruthy();
    expect(screen.getByText('70 lb per side · 45 lb base')).toBeTruthy();
    await press('Remove the 25 lb plate');
    expect(screen.getByText('135')).toBeTruthy();
    await press('Use 135 lb as target');
    expect(useStore.getState().working).toBe(135);
    expect(useStore.getState().sheet).toBe(false);
  });

  test('1RM calculator: Epley with RIR, percentage rows load exactly and set the target', async () => {
    await mount();
    await press('Set the target from a one rep max');
    expect(screen.getByText('278')).toBeTruthy(); // 225 × 5 @ RPE 8 → 7 reps → 225 × (1 + 7/30) = 277.5
    await press('Raise RPE'); await press('Raise RPE'); await press('Raise RPE'); await press('Raise RPE');
    expect(screen.getByText('263')).toBeTruthy(); // RPE 10 → 5 reps
    await press(/^90% of your estimated max/);
    expect(useStore.getState().working).toBe(236.5); // 263 × 0.9 = 236.7 → 0.5 grid → loads exactly
    expect(useStore.getState().sheet).toBe(false);
  });

  test('plate rack sheet: unlimited rows in a commercial gym, steppers in home-gym mode', async () => {
    await mount();
    await press('Plate rack');
    expect(screen.getAllByText('unlimited').length).toBe(10);
    await fireEvent.press(screen.getByRole('switch', { name: /Home gym mode, off/ }));
    expect(useStore.getState().homeGym).toBe(true);
    await press('One more 45 lb plate');
    expect(useStore.getState().qty[45]).toBe(3);
    await press('Done');
    expect(useStore.getState().sheet).toBe(false);
  });
});
