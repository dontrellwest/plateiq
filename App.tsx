import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
// Imported by file, not from the package entry: that entry loads all eighteen Archivo faces —
// nine weights and nine italics — and Expo copies every one into the app. Archivo is numerals only
// here, so thirteen of them could never render a character.
import { useFonts } from 'expo-font';
const Archivo_400Regular = require('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf');
const Archivo_500Medium = require('@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf');
const Archivo_600SemiBold = require('@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf');
const Archivo_700Bold = require('@expo-google-fonts/archivo/700Bold/Archivo_700Bold.ttf');
const Archivo_800ExtraBold = require('@expo-google-fonts/archivo/800ExtraBold/Archivo_800ExtraBold.ttf');
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
