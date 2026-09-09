import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Tinos_400Regular,
  Tinos_700Bold,
} from '@expo-google-fonts/tinos';
import { Allura_400Regular } from '@expo-google-fonts/allura';

import AnimatedSplashScreen from './src/screens/SplashScreen';
import AppLockScreen from './src/screens/AppLockScreen';
import RootNavigator from './src/navigation/RootNavigator';
import ThemeProvider, { useTheme } from './src/theme/ThemeContext';
import { getCurrentManager } from './src/services/storeService';
import { isAppLockEnabled } from './src/services/appLockService';
import type { ManagerProfile } from './src/services/types';
import { colors } from './src/theme/theme';

type Phase = 'splash' | 'ready';

// Zuia native splash isijifiche yenyewe kabla hatujawa tayari.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  const { isDark } = useTheme();
  const [phase, setPhase] = useState<Phase>('splash');
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [locked, setLocked] = useState(false);

  const handleSplashFinish = useCallback(() => {
    // Baada ya splash, angalia kama msimamizi amesajiliwa kwenye kifaa:
    //   - hapana → Onboarding (chagua Admin → jina, simu, chagua duka)
    //   - ndio → ApprovalGate (inasubiri idhini ya Admin, kisha MainTabs)
    // Pia angalia App Lock: ikiwa imewashwa → onyesha PIN kabla ya kuingia.
    getCurrentManager()
      .then((profile) => setManager(profile))
      .catch(() => setManager(null))
      .then(() => isAppLockEnabled())
      .then((enabled) => {
        setAppLockEnabled(enabled);
        setLocked(enabled);
      })
      .catch(() => {})
      .finally(() => setPhase('ready'));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setLocked((prev) => appLockEnabled || prev);
      }
    });
    return () => sub.remove();
  }, [appLockEnabled]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.logoBlue }}>
      <StatusBar
        style={phase === 'splash' || locked ? 'light' : isDark ? 'light' : 'dark'}
      />
      {phase === 'splash' ? (
        <AnimatedSplashScreen onFinish={handleSplashFinish} />
      ) : locked ? (
        <AppLockScreen onUnlock={() => setLocked(false)} />
      ) : (
        <RootNavigator manager={manager} />
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Tinos_400Regular,
    Tinos_700Bold,
    Allura_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Fonti ziko tayari — ficha native splash na achia nafasi splash ya JS.
      await ExpoSplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}