import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/useAuthStore';
import { View, ActivityIndicator, Text, TextInput } from 'react-native';
import { NetworkSyncWrapper } from './src/components/NetworkSyncWrapper';
import { GlobalSyncBanner } from './src/components/GlobalSyncBanner';
import { initFaceService } from './src/services/faceService';

// @ts-ignore
if (Text.defaultProps == null) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.allowFontScaling = false;

// @ts-ignore
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.allowFontScaling = false;

export default function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    restoreSession();
    // Preload the offline face-recognition models in the background so the
    // first scan in AddBabyScreen is instant. Non-blocking — app UI is not
    // held up if this takes a moment on slower devices.
    initFaceService().catch((e) => console.log('Face model preload failed:', e));
  }, [restoreSession]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NetworkSyncWrapper>
        <AppNavigator />
        <GlobalSyncBanner />
        <StatusBar style="auto" />
      </NetworkSyncWrapper>
    </SafeAreaProvider>
  );
}
