import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import {
  isBiometricsAvailable,
  getBiometricsEnabled,
  authenticateWithBiometrics,
  saveCredentialsForBiometrics,
  getStoredCredentials,
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
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    checkBiometricOption();
  }, []);

  const checkBiometricOption = async () => {
    const available = await isBiometricsAvailable();
    const enabled = await getBiometricsEnabled();
    if (available && enabled) {
      setShowBiometricBtn(true);
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setIsFaceID(
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      );
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

    if (error) {
      // Generic — never expose specific reason
      Alert.alert('Login Failed', 'Invalid credentials. Please try again.');
      return;
    }

    // Save credentials securely so biometric login can re-auth later
    await saveCredentialsForBiometrics(email, password);
  };

  const handleBiometricLogin = async () => {
    setBioLoading(true);

    // Step 1: verify identity with Face ID
    const success = await authenticateWithBiometrics();

    if (!success) {
      setBioLoading(false);
      Alert.alert(
        'Verification Failed',
        'Face ID was not recognised. Please use your email and password.',
      );
      return;
    }

    // Step 2: retrieve stored credentials and sign in
    const creds = await getStoredCredentials();

    if (!creds) {
      setBioLoading(false);
      Alert.alert(
        'Session Expired',
        'Please log in with your email and password once to restore biometric login.',
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });

    setBioLoading(false);

    if (error) {
      Alert.alert(
        'Login Failed',
        'Could not sign you in. Please use your email and password.',
      );
    }
    // On success, auth state updates automatically → app navigates in
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Decorations */}
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="swap-horizontal" size={32} color="#fff" />
          </View>
          <Text style={styles.appName}>Swapify</Text>
          <Text style={styles.tagline}>
            Trade what you have.{'\n'}Get what you need.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to continue trading</Text>

          {/* Email */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}>
              <Ionicons name="mail-outline" size={18} color={Colors.textLight} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textLight} />
            </View>
            <TextInput
              style={[styles.input, { paddingRight: 44 }]}
              placeholder="Password"
              placeholderTextColor={Colors.textLight}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass(!showPass)}
            >
              <Ionicons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.textLight}
              />
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* Biometric option */}
          {showBiometricBtn && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <TouchableOpacity
                style={[styles.bioBtn, bioLoading && styles.btnDisabled]}
                onPress={handleBiometricLogin}
                disabled={bioLoading}
              >
                {bioLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
                      size={20}
                      color={Colors.primary}
                    />
                    <Text style={styles.bioBtnText}>
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
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  scroll: { flexGrow: 1 },
  topDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, overflow: 'hidden' },
  decorCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, top: -120, left: -60, opacity: 0.12 },
  decorCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.primary, top: -60, right: -40, opacity: 0.08 },
  logoSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  appName: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#fff', marginHorizontal: Spacing.lg, borderRadius: 28, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, position: 'relative' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: FontSize.sm, color: Colors.text },
  eyeBtn: { position: 'absolute', right: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, fontSize: FontSize.xs, color: Colors.textLight },
  bioBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  bioBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  footerLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
});