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
import { getBiometricsEnabled, isBiometricsAvailable } from './src/lib/biometrics';

// Auth flow steps
type AuthStep = 'login' | 'register' | 'otp' | 'biometric' | 'app';

function Main() {
  const auth = useAuthState();
  const { isDark, theme } = useTheme();
  const [step, setStep] = useState<AuthStep>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [checkingBio, setCheckingBio] = useState(false);

  // When session appears (after OTP confirm), check if biometrics needed
  useEffect(() => {
    if (auth.session && step === 'otp') {
      checkBiometricGate();
    }
    // On app restart with existing session, go through biometric gate
    if (auth.session && step === 'login') {
      checkBiometricGate();
    }
  }, [auth.session]);

  const checkBiometricGate = async () => {
    setCheckingBio(true);
    const enabled = await getBiometricsEnabled();
    const available = await isBiometricsAvailable();
    setCheckingBio(false);
    if (enabled && available) {
      setStep('biometric');
    } else {
      setStep('app');
    }
  };

  if (auth.loading || checkingBio) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Not logged in flows
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
          onVerified={() => {
            // Session will be set after email confirm
            // For now go back to login with success message
            setStep('login');
          }}
          onBack={() => setStep('login')}
        />
      );
    }
    return <LoginScreen onToggle={() => setStep('register')} />;
  }

  // Logged in flows
  if (step === 'biometric') {
    return (
      <BiometricGateScreen
        onSuccess={() => setStep('app')}
        onFallback={() => setStep('app')}
      />
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
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