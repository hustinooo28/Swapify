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
import { supabase } from './src/lib/supabase';

type AuthStep = 'login' | 'register' | 'otp' | 'biometric' | 'app';

function Main() {
  const auth = useAuthState();
  const { isDark, theme } = useTheme();
  const [step, setStep] = useState<AuthStep>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [checkingBio, setCheckingBio] = useState(false);
  const [bioChecked, setBioChecked] = useState(false);

  useEffect(() => {
    if (auth.session && !bioChecked) {
      setBioChecked(true);
      checkBiometricGate();
    }
    if (!auth.session && !auth.loading) {
      setStep('login');
      setBioChecked(false);
    }
  }, [auth.session, auth.loading]);

  const checkBiometricGate = async () => {
    setCheckingBio(true);
    try {
      const enabled = await getBiometricsEnabled();
      const available = await isBiometricsAvailable();
      setStep(enabled && available ? 'biometric' : 'app');
    } catch {
      setStep('app');
    }
    setCheckingBio(false);
  };

  // Upload avatar after OTP verification — user is now authenticated
  const uploadAvatarAfterVerification = async (userId: string, localUri: string) => {
    try {
      const ext = (localUri.split('.').pop() || 'jpg').split('?')[0];
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const fileName = `${userId}/avatar.${safeExt}`;
      const response = await fetch(localUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${safeExt}`, upsert: true });
      if (error) { console.error('Avatar upload error:', error.message); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
    } catch (e) {
      console.error('Avatar upload failed:', e);
    }
  };

const handleOTPVerified = async () => {
  // Upload avatar now that the user is authenticated
  if (pendingAvatarUri && pendingUserId) {
    await uploadAvatarAfterVerification(pendingUserId, pendingAvatarUri);
  }
  // Clear pending state
  setPendingAvatarUri(null);
  setPendingUserId(null);
  // Don't go to 'login' — session is already active after OTP.
  // Check biometrics and go straight to app.
  setBioChecked(true);
  checkBiometricGate();
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
          onRegistered={(email, avatarUri, userId) => {
            setPendingEmail(email);
            if (avatarUri) setPendingAvatarUri(avatarUri);
            if (userId) setPendingUserId(userId);
            setStep('otp');
          }}
        />
      );
    }
    if (step === 'otp') {
      return (
        <OTPScreen
          email={pendingEmail}
          onVerified={handleOTPVerified}
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