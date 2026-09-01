import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { bootStore } from './src/store/useStore';
import { Root } from './src/Root';

export default function App() {
  const [fontsLoaded] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold });
  useEffect(() => bootStore(), []);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0b0c0e' }} />;
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
