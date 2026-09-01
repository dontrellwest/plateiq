// Render smoke tests: the Main screen mounts in every mode, both themes, with warnings, alternatives,
// a resting set and a logged set — and every control exposes a role and a name.
// (@testing-library/react-native 14: render / fireEvent / unmount are async.)

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { INITIAL_STATE } from '../src/logic/PlateIQLogic';
import { logic, useStore } from '../src/store/useStore';
import { Root } from '../src/Root';

const initialMetrics = { frame: { x: 0, y: 0, width: 428, height: 926 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const mount = () => render(<SafeAreaProvider initialMetrics={initialMetrics}><Root /></SafeAreaProvider>);
const reset = () => useStore.setState({ ...INITIAL_STATE, onboard: false, tour: false }, true);

beforeEach(reset);

describe('Main screen', () => {
  test.each([['barbell', 'dark'], ['barbell', 'light'], ['dumbbell', 'dark'], ['dumbbell', 'light'], ['landmine', 'dark'], ['landmine', 'light']] as const)(
    'renders %s mode in the %s theme', async (mode, theme) => {
      useStore.setState({ mode, theme });
      await mount();
      expect(screen.getByText('PlateIQ')).toBeTruthy();
      expect(screen.getByText('TOP SET')).toBeTruthy();
      expect(screen.getAllByLabelText(/Top set\./).length).toBe(1);
    },
  );

  test('specialty bars, matched pair, and each landmine anchor render', async () => {
    for (const id of ['ez', 'trap', 'ssb', 'swiss', 'axle', 'dl']) {
      logic.pickBarProfile(logic.barProfiles().find((b) => b.id === id)!);
      const r = await mount();
      expect(screen.getByText('TOP SET')).toBeTruthy();
      await r.unmount();
    }
    useStore.setState({ mode: 'dumbbell', dbPair: true });
    const d = await mount();
    expect(screen.getByText('Matched pair')).toBeTruthy();
    await d.unmount();
    for (const anchorType of ['rack', 'hinge', 'sleeve'] as const) {
      useStore.setState({ mode: 'landmine', anchorType });
      const r = await mount();
      expect(screen.getByText('Anchor setup — how your landmine is grounded')).toBeTruthy();
      await r.unmount();
    }
  });

  test('warning card with LOADS EXACTLY chips, empty rack, and collar banner', async () => {
    useStore.setState({ homeGym: true, qty: { 45: 2 }, working: 140 });
    const r = await mount();
    expect(screen.getByText('LOADS EXACTLY')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Load exactly 135/));
    expect(useStore.getState().working).toBe(135);
    await r.unmount();
    useStore.setState({ qty: {} });
    const e = await mount();
    expect(screen.getByText('Add my plates ›')).toBeTruthy();
    await e.unmount();
    useStore.setState({ homeGym: false, comp: true, collarId: 'comp' });
    await mount();
    expect(screen.getByText(/Competition · Bar 45 \+ collars 11/)).toBeTruthy();
  });

  test('tapping a set starts its rest; logging shows the LOGGED row on the card and on the hero', async () => {
    await mount();
    await fireEvent.press(screen.getByRole('button', { name: /^Empty bar, 45 lb/ }));
    expect(useStore.getState().activeIdx).toBe(0);
    expect(screen.getByText('RESTING')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Empty bar, 45 lb/ })); // tap again → logged
    expect(screen.getByText('DONE')).toBeTruthy();
    expect(screen.getByLabelText(/Edit what you logged for Empty bar/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Top set\./));
    await fireEvent.press(screen.getByLabelText(/^Top set\./));
    expect(screen.getByLabelText(/Edit what you logged for Working set: 225 lb × 5/)).toBeTruthy();
  });

  test('steppers, mode segment, scheme rows and the warm-up editors are reachable controls', async () => {
    useStore.setState({ scheme: 'backoff' });
    await mount();
    await fireEvent.press(screen.getByLabelText('Raise working weight'));
    expect(useStore.getState().working).toBe(230);
    await fireEvent.press(screen.getByLabelText('Dumbbell'));
    expect(useStore.getState().mode).toBe('dumbbell');
    await fireEvent.press(screen.getByLabelText('Barbell'));
    expect(screen.getByText('BACK-OFF SETS')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add warm-up set'));
    expect(useStore.getState().warmups.length).toBe(2);
    await fireEvent.press(screen.getByLabelText('Raise 40% by 5 percent'));
    expect(useStore.getState().warmups[1].pct).toBe(45);
    await fireEvent.press(screen.getByLabelText('Remove 45%'));
    expect(useStore.getState().warmups.length).toBe(1);
  });

  test('typing a bar weight commits on blur and an unchanged blur keeps progress', async () => {
    logic.tapSet(0); logic.finishRest();
    await mount();
    const bar = screen.getByLabelText('Bar weight');
    await fireEvent.changeText(bar, '45');
    await fireEvent(bar, 'blur');
    expect(useStore.getState().doneIdx).toEqual([0]);
    await fireEvent.changeText(bar, '33');
    await fireEvent(bar, 'blur');
    expect(useStore.getState().bar).toBe(33);
    expect(useStore.getState().barProfile).toBe('tech');
    expect(useStore.getState().doneIdx).toEqual([]);
    expect(screen.getByText('Technique bar')).toBeTruthy();
  });
});
