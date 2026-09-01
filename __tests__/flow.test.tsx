// Rest timer → log → completion flow through the real UI, plus the VoiceOver cadence and the
// toast/timer bottom-slot rules. Sheets and the completion modal are accessibility modals, so
// Testing Library (like VoiceOver) hides their siblings unless includeHiddenElements is passed.

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { INITIAL_STATE } from '../src/logic/PlateIQLogic';
import { logic, useStore } from '../src/store/useStore';
import { Root } from '../src/Root';

const initialMetrics = { frame: { x: 0, y: 0, width: 428, height: 926 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const mount = () => render(<SafeAreaProvider initialMetrics={initialMetrics}><Root /></SafeAreaProvider>);
const reset = () => useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);
const press = (name: RegExp | string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(reset);
afterEach(async () => { await cleanup(); });

describe('rest timer panel', () => {
  test('tapping a set opens the panel with ring, next-set line, diff chips and rest controls', async () => {
    logic.addSet(); // 40% → 90 lb: next load adds 10 · 10 · 2.5 each side
    await mount();
    await press(/^Empty bar, 45 lb/);
    expect(screen.getAllByText('RESTING').length).toBe(2); // card badge + panel status
    expect(screen.getAllByText('1:00').length).toBeGreaterThanOrEqual(2); // ring + the card's rest pill
    expect(screen.getByText('Next · 40% at 90 lb')).toBeTruthy();
    expect(screen.getByText('ADD FOR NEXT')).toBeTruthy();
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('each side')).toBeTruthy();
    await press('Add thirty seconds to the rest');
    expect(useStore.getState().remaining).toBe(90);
    expect(screen.getAllByText('1:30').length).toBeGreaterThanOrEqual(1);
    await press('Take fifteen seconds off the rest');
    expect(useStore.getState().remaining).toBe(75);
    await press('Skip the rest and log this set');
    expect(useStore.getState().doneIdx).toEqual([0]);
    expect(screen.queryByText('RESTING')).toBeNull();
    expect(screen.getByText('Set 1 logged')).toBeTruthy(); // toast
    await press('Undo the last change');
    expect(useStore.getState().doneIdx).toEqual([]);
    expect(screen.queryByText('Set 1 logged')).toBeNull();
  });

  test('Done on the last set logs planned-as-actual and opens the completion modal over the toast', async () => {
    await mount();
    await press(/^Top set\./);
    expect(screen.getByText('Last set — nice work')).toBeTruthy();
    expect(screen.getByText(/Strip the bar when you’re ready/)).toBeTruthy();
    await press('Done');
    const s = useStore.getState();
    expect(s.doneIdx).toEqual([1]);
    expect(s.log[1]).toEqual({ w: 225, r: 5, planW: 225, planR: 5 });
    expect(s.allDone).toBe(true);
    expect(screen.getByText('Bench press done')).toBeTruthy();
    // the modal is accessibilityViewIsModal: the toast beneath it is hidden from assistive tech
    expect(screen.queryByRole('button', { name: 'Undo the last change' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo the last change', includeHiddenElements: true })).toBeTruthy();
  });

  test('auto-start off: the panel opens paused with a Start rest CTA', async () => {
    useStore.setState({ autoRest: false });
    await mount();
    await press(/^Empty bar, 45 lb/);
    expect(screen.getByText('SET LOGGED')).toBeTruthy();
    await press('Start rest');
    expect(useStore.getState().paused).toBe(false);
    expect(screen.getAllByText('RESTING').length).toBe(2);
  });

  test('the ring dash is clamped even when +30s pushes past the original total', () => {
    logic.tapSet(0);
    logic.bumpRest(30);
    logic.bumpRest(30);
    const d = parseFloat(logic.renderVals().timer.dash as string);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(144.5);
    useStore.setState({ remaining: 0 });
    expect(logic.renderVals().timer.dash).toBe('144.5');
  });

  test('VoiceOver: announces at start, every 30 s, at 10 s and at zero — not every tick', async () => {
    // RN's jest setup already mocks announceForAccessibility; spyOn returns that shared mock, so clear it
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    spy.mockClear();
    await mount();
    await press(/^Top set\./); // 180 s
    const startCalls = spy.mock.calls.map((c) => c[0]);
    expect(startCalls).toEqual([expect.stringMatching(/^Rest started, 3:00/)]);
    for (let s = 179; s >= 0; s--) await act(async () => { useStore.setState({ remaining: s }); });
    const texts = spy.mock.calls.map((c) => c[0]);
    expect(texts.filter((x) => /remaining/.test(x))).toEqual(['2:30 remaining', '2:00 remaining', '1:30 remaining', '1:00 remaining', '0:30 remaining', '0:10 remaining']);
    expect(texts[texts.length - 1]).toMatch(/^Rest over/);
    expect(texts.length).toBe(8);
    spy.mockRestore();
  }, 120000);
});

describe('log sheet', () => {
  test('opens from the LOGGED row, steps weight/reps, resets with Went to plan, and saves', async () => {
    logic.tapSet(0); logic.finishRest();
    await mount();
    await press(/Edit what you logged for Empty bar/);
    expect(screen.getByText('What you actually did')).toBeTruthy();
    expect(screen.getByText(/Empty bar · Planned 45 lb × 15 reps/)).toBeTruthy();
    await press('One rep fewer');
    await press('Raise logged weight');
    expect(useStore.getState().log[0]).toEqual({ w: 45.5, r: 14, planW: 45, planR: 15 });
    // the sheet is modal, so the card behind it is hidden from assistive tech but still rendered
    expect(screen.getByText('planned 45 × 15', { includeHiddenElements: true })).toBeTruthy();
    await press('Reset to the planned numbers');
    expect(useStore.getState().log[0]).toEqual({ w: 45, r: 15, planW: 45, planR: 15 });
    await press('Save logged set');
    expect(useStore.getState().sheet).toBe(false);
    expect(screen.queryByText('What you actually did')).toBeNull();
    expect(screen.queryByText('planned 45 × 15')).toBeNull(); // back to plan → no variance shown
  });

  test('the scrim closes the sheet', async () => {
    logic.tapSet(0); logic.finishRest();
    useStore.setState({ logIdx: 0, sheet: 'log' });
    await mount();
    await fireEvent.press(screen.getByRole('button', { name: 'Close sheet', includeHiddenElements: true }));
    expect(useStore.getState().sheet).toBe(false);
  });
});

describe('completion modal', () => {
  test('summarises logged sets with variances and Log & go advances the session and records history', async () => {
    logic.tapSet(0); logic.finishRest();
    logic.editLog(0, { r: 12 });
    logic.tapSet(1); logic.finishRest();
    await mount();
    expect(screen.getByText('Bench press done')).toBeTruthy();
    expect(screen.getByText('Top set loaded at 225 lb')).toBeTruthy();
    expect(screen.getByText('45 × 12')).toBeTruthy();
    expect(screen.getByText('planned 45 × 15')).toBeTruthy();
    expect(screen.getByText('225 × 5')).toBeTruthy();
    expect(screen.getByText('Next · Overhead press')).toBeTruthy();
    await press('Log & go to Overhead press');
    const s = useStore.getState();
    expect(s.exercise).toBe('Overhead press');
    expect(s.working).toBe(135);
    expect(s.records.length).toBe(1);
    expect(s.records[0].sets.map((x) => x.label)).toEqual(['Empty bar', 'Working set']);
    expect(s.sessionsLogged).toBe(1);
    expect(screen.queryByText('Bench press done')).toBeNull();
  });

  test('Discard clears progress without recording, with an undo', async () => {
    logic.tapSet(1); logic.finishRest();
    await mount();
    await press('Discard this exercise');
    expect(useStore.getState().records.length).toBe(0);
    expect(useStore.getState().doneIdx).toEqual([]);
    expect(screen.getByText('Discarded Bench press')).toBeTruthy();
  });

  test('last exercise in the queue shows Log session', async () => {
    useStore.setState({ session: ['Bench press'] });
    logic.tapSet(1); logic.finishRest();
    await mount();
    expect(screen.getByRole('button', { name: 'Log session' })).toBeTruthy();
    expect(screen.queryByText(/^Next · /)).toBeNull();
  });
});
