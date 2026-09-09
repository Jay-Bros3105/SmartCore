import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  // Brand (zilibakia same kwa modes zote)
  navy: string;
  sky: string;
  light: string;
  pale: string;
  logoBlue: string;
  logoBlueDeep: string;
  white: string;
  success: string;
  amber: string;
  danger: string;
  gold: string;
  charcoal: string;
  black: string;
  // Semantic (hubadilika na mode)
  background: string; // bg ya skrini
  bg: string;         // kadi / surfaces
  surfaceAlt: string; // surfaces nyepesi zaidi
  text: string;
  textMuted: string;
  border: string;
  headerTop: string;  // gradient ya juu ya header
  headerBottom: string;
  onHeader: string;   // maandishi yaliyo kwenye header yenye rangi
  onBrand: string;    // maandishi kwenye bg za logo blue
  shadow: string;
};

export const lightColors: ThemeColors = {
  navy: '#1F4E79',
  sky: '#2BB6C9',
  light: '#DCE9F5',
  pale: '#EAF3FB',
  logoBlue: '#2BB6C9',
  logoBlueDeep: '#146B78',
  white: '#FFFFFF',
  success: '#2E7D32',
  amber: '#F2A93B',
  danger: '#C62828',
  gold: '#C9A227',
  charcoal: '#595959',
  black: '#10202E',
  background: '#EAF3FB',
  bg: '#FFFFFF',
  surfaceAlt: '#DCE9F5',
  text: '#10202E',
  textMuted: '#595959',
  border: '#DCE9F5',
  headerTop: '#1F4E79',
  headerBottom: '#2BB6C9',
  onHeader: '#FFFFFF',
  onBrand: '#FFFFFF',
  shadow: '#1F4E79',
};

export const darkColors: ThemeColors = {
  navy: '#8EC8E6',
  sky: '#2BB6C9',
  light: '#183449',
  pale: '#0B1F30',
  logoBlue: '#2BB6C9',
  logoBlueDeep: '#146B78',
  white: '#FFFFFF',
  success: '#53CD7A',
  amber: '#F2A93B',
  danger: '#F27E7E',
  gold: '#E0B84E',
  charcoal: '#9AB4C5',
  black: '#E4F1F8',
  background: '#0B1F30',
  bg: '#122A3D',
  surfaceAlt: '#183449',
  text: '#E4F1F8',
  textMuted: '#8FB3C4',
  border: '#1E4E61',
  headerTop: '#081826',
  headerBottom: '#146B78',
  onHeader: '#FFFFFF',
  onBrand: '#FFFFFF',
  shadow: '#000000',
};

const STORAGE_KEY = 'neosmartcore.theme';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkColors : lightColors,
      toggleMode: () => setMode(mode === 'dark' ? 'light' : 'dark'),
      setMode,
    }),
    [mode]
  );

  if (!ready) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export default ThemeProvider;