// Screen switch + overlays. The prototype swaps screens on `state.screen`; there is no navigator.
// Overlay order (bottom → top): rest panel, undo toast, sheet scrim + sheet, completion modal,
// onboarding, guided tour.

import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logic, useView } from './store/useStore';
import { useTheme } from './ui/theme';
import { MainScreen } from './screens/MainScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TimerPanel } from './ui/overlays/TimerPanel';
import { UndoToast } from './ui/overlays/UndoToast';
import { Scrim } from './ui/overlays/Sheet';
import { LogSheet } from './ui/overlays/LogSheet';
import { BarSheet, RackSheet, ReverseSheet, RmSheet, SchemeSheet } from './ui/overlays/Sheets';
import { CompletionModal } from './ui/overlays/CompletionModal';
import { Onboarding } from './ui/overlays/Onboarding';
import { TourOverlay } from './ui/tour/TourOverlay';
import { tourHost } from './ui/tour/tourUI';

logic.tourHost = tourHost;

export function Root() {
  const v = useView();
  const { t, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {v.isMain ? <MainScreen /> : null}
      {v.isHistory ? <HistoryScreen v={v} /> : null}
      {v.isLibrary ? <LibraryScreen v={v} /> : null}
      {v.isSettings ? <SettingsScreen v={v} /> : null}

      {v.timer.show ? <TimerPanel timer={v.timer} onToggleExpand={v.toggleExpand} /> : null}
      {v.undoShow ? <UndoToast label={v.undoLabel} aboveTimer={v.timer.show} onUndo={v.undoTap} onDismiss={v.undoDismiss} /> : null}

      {v.sheet ? <Scrim onClose={v.closeSheet} /> : null}
      {v.sheetBar ? <BarSheet v={v} /> : null}
      {v.sheetScheme ? <SchemeSheet v={v} /> : null}
      {v.sheetReverse ? <ReverseSheet v={v} /> : null}
      {v.sheetRm ? <RmSheet v={v} /> : null}
      {v.sheetLog ? <LogSheet v={v} /> : null}
      {v.sheetRack ? <RackSheet v={v} /> : null}

      {/* the tour's demo set is also the last set; its completion card would cover the log-sheet chapter */}
      {v.allDone && !v.tourOn ? <CompletionModal v={v} /> : null}

      {v.onboard ? <Onboarding v={v} /> : null}
      {v.tourOn ? <TourOverlay v={v} /> : null}
    </View>
  );
}
