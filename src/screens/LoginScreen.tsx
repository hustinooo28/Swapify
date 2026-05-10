import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
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
  const { theme, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometricBtn, setShowBiometricBtn] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => { checkBiometricOption(); }, []);

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
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { Alert.alert('Login Failed', 'Invalid credentials. Please try again.'); return; }
    await saveCredentialsForBiometrics(email, password);
  };

  const handleBiometricLogin = async () => {
    setBioLoading(true);
    const success = await authenticateWithBiometrics();
    if (!success) {
      setBioLoading(false);
      Alert.alert('Verification Failed', 'Please use your email and password.');
      return;
    }
    const creds = await getStoredCredentials();
    if (!creds) {
      setBioLoading(false);
      Alert.alert('Session Expired', 'Please log in with your email and password once to restore biometric login.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
    setBioLoading(false);
    if (error) Alert.alert('Login Failed', 'Could not sign you in. Please use your email and password.');
  };

  const bg = isDark ? '#0F1120' : '#F0F4FF';
  const cardBg = isDark ? '#1C1F2E' : '#FFFFFF';
  const inputBg = isDark ? '#252836' : '#F7F9FC';
  const inputBorder = isDark ? '#2E3248' : '#E5E7EB';
  const dividerColor = isDark ? '#2E3248' : '#E5E7EB';

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

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
          <Text style={[styles.appName, { color: theme.text }]}>Swapify</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Trade what you have.{'\n'}Get what you need.
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Welcome back</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Sign in to continue trading</Text>

          {/* Email */}
          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <View style={styles.inputIcon}>
              <Ionicons name="mail-outline" size={18} color={theme.textLight} />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Email address"
              placeholderTextColor={theme.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <View style={styles.inputIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textLight} />
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, paddingRight: 44 }]}
              placeholder="Password"
              placeholderTextColor={theme.textLight}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textLight} />
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
          </TouchableOpacity>

          {/* Biometric option */}
          {showBiometricBtn && (
            <>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
                <Text style={[styles.dividerText, { color: theme.textLight }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />
              </View>
              <TouchableOpacity style={[styles.bioBtn, bioLoading && styles.btnDisabled]} onPress={handleBiometricLogin} disabled={bioLoading}>
                {bioLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={20} color={Colors.primary} />
                    <Text style={styles.bioBtnText}>{isFaceID ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>Don't have an account? </Text>
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
  container: { flex: 1 },
  scroll: { flexGrow: 1 },
  topDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, overflow: 'hidden' },
  decorCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, top: -120, left: -60, opacity: 0.12 },
  decorCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.primary, top: -60, right: -40, opacity: 0.08 },
  logoSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  card: { marginHorizontal: Spacing.lg, borderRadius: 28, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 4 },
  cardSub: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: 12, position: 'relative' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: FontSize.sm },
  eyeBtn: { position: 'absolute', right: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: FontSize.xs },
  bioBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  bioBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { fontSize: FontSize.sm },
  footerLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
});