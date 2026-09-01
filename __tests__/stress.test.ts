// Stress harness against the headless MemoryHost (see qa/harness.ts for the port itself).
// Counts: PLATEIQ_FULL=1 runs the prototype's 1,000,000 scenarios and 5,000 users × 50 actions;
// otherwise a reduced prefix (PLATEIQ_SCENARIOS / PLATEIQ_USERS).

import { A_TOTAL, B_ACTIONS, B_USERS, FULL, RESULTS, phaseA, phaseB, report, resetResults } from '../qa/harness';

describe('PlateIQ stress harness (' + (FULL ? 'FULL' : 'reduced') + ')', () => {
  beforeAll(() => resetResults());

  test('A · ' + A_TOTAL.toLocaleString() + ' solver scenarios: accounting, sleeve fit, inventory, landmine bound, alt fixed points', () => {
    phaseA(A_TOTAL);
    // eslint-disable-next-line no-console
    console.log('phase A: ' + A_TOTAL.toLocaleString() + ' scenarios, ' + RESULTS.sets.toLocaleString() + ' sets checked; ' + (report() || 'no failures'));
    expect(report()).toBe('');
  }, 24 * 3600 * 1000);

  test('B · ' + (B_USERS * B_ACTIONS).toLocaleString() + ' UI actions across ' + B_USERS.toLocaleString() + ' users: state-machine + tour invariants', () => {
    phaseB(B_USERS);
    // eslint-disable-next-line no-console
    console.log('phase B: ' + RESULTS.actions.toLocaleString() + ' actions; ' + (report() || 'no failures'));
    expect(report()).toBe('');
  }, 24 * 3600 * 1000);
});
