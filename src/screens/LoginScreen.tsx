import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import {
  isBiometricsAvailable,
  getBiometricsEnabled,
  authenticateWithBiometrics,
} from '../lib/biometrics';
import * as LocalAuthentication from 'expo-local-authentication';

type Props = { onToggle: () => void };

export default function LoginScreen({ onToggle }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometricBtn, setShowBiometricBtn] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    checkBiometricOption();
  }, []);

  const checkBiometricOption = async () => {
    const available = await isBiometricsAvailable();
    const enabled = await getBiometricsEnabled();
    if (available && enabled) {
      setShowBiometricBtn(true);
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setIsFaceID(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
  };

  const handleBiometricLogin = async () => {
    setBioLoading(true);
    // Small delay to let iOS UI settle
    await new Promise(resolve => setTimeout(resolve, 300));
    const success = await authenticateWithBiometrics();
    setBioLoading(false);

    if (success) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in with email and password once to restore it.',
        );
      }
      // If session is valid, auth state updates automatically and app navigates in
    } else {
      Alert.alert('Try Again', 'Biometric verification was not successful. You can still log in with your email and password.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.appName}>Swapify</Text>
          <Text style={styles.tagline}>Trade what you have. Get what you need.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Log In</Text>
            }
          </TouchableOpacity>

          {/* Biometric option — only shown if user enabled it in settings */}
          {showBiometricBtn && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.biometricBtn, bioLoading && styles.buttonDisabled]}
                onPress={handleBiometricLogin}
                disabled={bioLoading}
              >
                {bioLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
                      size={22}
                      color={Colors.primary}
                    />
                    <Text style={styles.biometricBtnText}>
                      {isFaceID ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onToggle}>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  logoContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  logoText: { fontSize: 36, fontWeight: '800', color: Colors.white },
  appName: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  form: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { backgroundColor: Colors.borderLight, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  button: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, fontSize: FontSize.sm, color: Colors.textLight },
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  biometricBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  link: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
});