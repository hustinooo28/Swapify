import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuthState, AuthContext } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { Colors } from './src/lib/theme';
import { supabase } from './src/lib/supabase';

function Main() {
  const auth = useAuthState();
  const { isDark, theme } = useTheme();
  const [showRegister, setShowRegister] = useState(false);

  // Log out when app is closed/backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        supabase.auth.signOut();
      }
    });
    return () => sub.remove();
  }, []);

  if (auth.loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {auth.session ? (
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      ) : showRegister ? (
        <RegisterScreen onToggle={() => setShowRegister(false)} />
      ) : (
        <LoginScreen onToggle={() => setShowRegister(true)} />
      )}
    </>
  );
}

export default function App() {
  const auth = useAuthState();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthContext.Provider value={auth}>
          <Main />
        </AuthContext.Provider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});