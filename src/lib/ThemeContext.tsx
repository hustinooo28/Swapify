import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeContextType = {
  isDark: boolean;
  toggleDark: () => void;
  theme: typeof lightTheme;
};

export const lightTheme = {
  background: '#F7F9FC',
  surface: '#FFFFFF',
  text: '#0F1828',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  primary: '#1D6AE5',
  primaryLight: '#EBF1FD',
  card: '#FFFFFF',
};

export const darkTheme = {
  background: '#0F1117',
  surface: '#1C1F2E',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textLight: '#64748B',
  border: '#2D3148',
  borderLight: '#1E2235',
  primary: '#3B82F6',
  primaryLight: '#1E3A5F',
  card: '#1C1F2E',
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleDark: () => {},
  theme: lightTheme,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('swapify_dark_mode').then((val) => {
      if (val === 'true') setIsDark(true);
    });
  }, []);

  const toggleDark = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('swapify_dark_mode', next ? 'true' : 'false');
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark, theme: isDark ? darkTheme : lightTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}