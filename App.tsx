import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { useAuthState, AuthContext } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { Colors } from './src/lib/theme';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import {
  isBiometricsAvailable,
  authenticateWithBiometrics,
  getBiometricsEnabled,
} from './src/lib/biometrics';

function Main() {
  const auth = useAuthState();
  const { isDark, theme } = useTheme();
  const [showRegister, setShowRegister] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);
  const [checkingBio, setCheckingBio] = useState(true);

  useEffect(() => {
    checkBiometrics();
  }, [auth.session]);

  const checkBiometrics = async () => {
    if (!auth.session) { setCheckingBio(false); return; }
    const enabled = await getBiometricsEnabled();
    const available = await isBiometricsAvailable();
    if (enabled && available) {
      setBiometricLocked(true);
      const success = await authenticateWithBiometrics();
      if (success) {
        setBiometricLocked(false);
      } else {
        setBiometricFailed(true);
      }
    }
    setCheckingBio(false);
  };

  if (auth.loading || checkingBio) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (biometricLocked && biometricFailed) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <Ionicons name="finger-print-outline" size={64} color={Colors.primary} />
        <Text style={[styles.bioText, { color: theme.text }]}>Authentication Required</Text>
        <Text style={[styles.bioSub, { color: theme.textSecondary }]}>Biometric verification failed</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setBiometricFailed(false); checkBiometrics(); }}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
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
  bioText: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  bioSub: { fontSize: 14, marginTop: 6 },
  retryBtn: { marginTop: 24, backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});