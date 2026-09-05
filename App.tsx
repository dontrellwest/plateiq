import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts, Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { bootStore, isHydrationSettled, onHydrationSettled } from './src/store/useStore';
import { Root } from './src/Root';

// keep the native launch screen up until fonts and the saved state are ready (never a blank frame)
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold });
  const [hydrated, setHydrated] = useState(isHydrationSettled());
  useEffect(() => bootStore(), []);
  useEffect(() => onHydrationSettled(() => setHydrated(true)), []);
  // a font that fails to load is not a reason to show nothing: the system font stands in
  useEffect(() => { if (fontError) console.warn('PlateIQ: Archivo did not load, using the system font', fontError); }, [fontError]);
  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#0b0c0e' }} />;
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
