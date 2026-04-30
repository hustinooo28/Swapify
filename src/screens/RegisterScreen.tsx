import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import {
  isBiometricsAvailable,
  authenticateWithBiometrics,
  setBiometricsEnabled,
} from '../lib/biometrics';
import * as LocalAuthentication from 'expo-local-authentication';

type Props = { onToggle: () => void };

type Step = 'form' | 'biometrics';

export default function RegisterScreen({ onToggle }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setLoading(false);
      Alert.alert('Registration Failed', error.message);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
      });
    }

    setLoading(false);

    // Check if biometrics available before showing that step
    const available = await isBiometricsAvailable();
    setBioAvailable(available);

    if (available) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setIsFaceID(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
      setStep('biometrics');
    } else {
      Alert.alert('Account Created!', 'You can now log in.');
      onToggle();
    }
  };

  const handleEnableBiometrics = async () => {
    setBioLoading(true);

    // Small delay to let iOS UI settle before triggering Face ID
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = await authenticateWithBiometrics();
    setBioLoading(false);

    if (success) {
      await setBiometricsEnabled(true);
      Alert.alert(
        '✅ Biometrics Registered!',
        `${isFaceID ? 'Face ID' : 'Fingerprint'} is now set up. Use it to log in next time.`,
        [{ text: 'Let\'s Go!', onPress: onToggle }],
      );
    } else {
      Alert.alert(
        'Not Registered',
        'Biometrics were not set up. Make sure Face ID is enabled in your iPhone Settings > Face ID & Passcode > Other Apps.',
        [
          { text: 'Skip', onPress: onToggle },
          { text: 'Try Again', onPress: handleEnableBiometrics },
        ]
      );
    }
  };

  const handleSkipBiometrics = async () => {
    await setBiometricsEnabled(false);
    Alert.alert('Account Created!', 'You can enable biometrics later in Profile > Settings.');
    onToggle();
  };

  // ── Biometrics Registration Step ──
  if (step === 'biometrics') {
    return (
      <View style={styles.bioContainer}>
        <View style={styles.bioCard}>
          <View style={styles.bioIconCircle}>
            <Ionicons
              name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
              size={48}
              color={Colors.white}
            />
          </View>

          <Text style={styles.bioTitle}>
            Set up {isFaceID ? 'Face ID' : 'Fingerprint'}
          </Text>
          <Text style={styles.bioSubtitle}>
            Register your biometrics now so you can log in quickly and securely next time.
          </Text>

          <TouchableOpacity
            style={[styles.bioEnableBtn, bioLoading && styles.buttonDisabled]}
            onPress={handleEnableBiometrics}
            disabled={bioLoading}
          >
            {bioLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={20} color={Colors.white} />
                <Text style={styles.bioEnableBtnText}>
                  {isFaceID ? 'Register Face ID' : 'Register Fingerprint'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.bioSkipBtn} onPress={handleSkipBiometrics}>
            <Text style={styles.bioSkipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Registration Form Step ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}><Text style={styles.logoText}>S</Text></View>
          <Text style={styles.appName}>Swapify</Text>
          <Text style={styles.tagline}>Join the trade revolution.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Create account</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={Colors.textLight}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

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
              placeholder="Min. 6 characters"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Create Account</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onToggle}>
              <Text style={styles.link}>Log In</Text>
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  link: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },

  // Biometrics step
  bioContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  bioCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  bioIconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  bioTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  bioSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  bioEnableBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, width: '100%', marginBottom: Spacing.sm },
  bioEnableBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  bioSkipBtn: { padding: Spacing.md },
  bioSkipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
});