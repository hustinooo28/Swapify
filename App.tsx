import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuthState, AuthContext } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OTPScreen from './src/screens/OTPScreen';
import BiometricGateScreen from './src/screens/BiometricGateScreen';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { Colors } from './src/lib/theme';
import {
  getBiometricsEnabled,
  isBiometricsAvailable,
} from './src/lib/biometrics';

type AuthStep = 'login' | 'register' | 'otp' | 'biometric' | 'app';

function Main() {
  const auth = useAuthState();
  const { isDark, theme } = useTheme();
  const [step, setStep] = useState<AuthStep>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [checkingBio, setCheckingBio] = useState(false);
  const [bioChecked, setBioChecked] = useState(false);

  useEffect(() => {
    // Only run biometric check once when session first appears
    if (auth.session && !bioChecked) {
      setBioChecked(true);
      checkBiometricGate();
    }
    // If session disappears (logout), reset everything
    if (!auth.session && !auth.loading) {
      setStep('login');
      setBioChecked(false);
    }
  }, [auth.session, auth.loading]);

  const checkBiometricGate = async () => {
    setCheckingBio(true);
    try {
      // BOTH must be true: user opted in AND device supports it
      const enabled = await getBiometricsEnabled();
      const available = await isBiometricsAvailable();

      if (enabled && available) {
        // User explicitly enabled biometrics — show gate
        setStep('biometric');
      } else {
        // Not enabled or not available — go straight to app
        setStep('app');
      }
    } catch {
      // On any error, just let them in
      setStep('app');
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

  // ── Not logged in ──
  if (!auth.session) {
    if (step === 'register') {
      return (
        <RegisterScreen
          onToggle={() => setStep('login')}
          onRegistered={(email) => {
            setPendingEmail(email);
            setStep('otp');
          }}
        />
      );
    }
    if (step === 'otp') {
      return (
        <OTPScreen
          email={pendingEmail}
          onVerified={() => setStep('login')}
          onBack={() => setStep('login')}
        />
      );
    }
    return <LoginScreen onToggle={() => setStep('register')} />;
  }

  // ── Logged in: biometric gate ──
  if (step === 'biometric') {
    return (
      <BiometricGateScreen
        onSuccess={() => setStep('app')}
        onFallback={() => setStep('app')}
      />
    );
  }

  // ── Logged in: main app ──
  if (step === 'app') {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </>
    );
  }

  // Fallback — show loading while step resolves
  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
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