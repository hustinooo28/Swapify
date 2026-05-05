import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { isBiometricsAvailable, authenticateWithBiometrics, setBiometricsEnabled } from '../lib/biometrics';
import * as LocalAuthentication from 'expo-local-authentication';

type Props = { onToggle: () => void };
type Step = 'form' | 'biometrics';

export default function RegisterScreen({ onToggle }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) { setLoading(false); Alert.alert('Registration Failed', error.message); return; }
    if (data.user) await supabase.from('profiles').upsert({ id: data.user.id, email, full_name: fullName });
    setLoading(false);
    const available = await isBiometricsAvailable();
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
    await new Promise(r => setTimeout(r, 500));
    const success = await authenticateWithBiometrics();
    setBioLoading(false);
    if (success) {
      await setBiometricsEnabled(true);
      Alert.alert('✅ All Set!', `${isFaceID ? 'Face ID' : 'Fingerprint'} registered successfully.`, [{ text: "Let's Go!", onPress: onToggle }]);
    } else {
      Alert.alert('Not Registered', 'You can enable biometrics later in Profile > Settings.', [
        { text: 'Skip', onPress: onToggle },
        { text: 'Try Again', onPress: handleEnableBiometrics },
      ]);
    }
  };

  if (step === 'biometrics') {
    return (
      <View style={styles.bioScreen}>
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.bioCard}>
          <View style={styles.bioIconCircle}>
            <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={48} color="#fff" />
          </View>
          <Text style={styles.bioTitle}>Set up {isFaceID ? 'Face ID' : 'Fingerprint'}</Text>
          <Text style={styles.bioSub}>Log in quickly and securely next time without typing your password.</Text>
          <TouchableOpacity style={[styles.primaryBtn, bioLoading && styles.btnDisabled]} onPress={handleEnableBiometrics} disabled={bioLoading}>
            {bioLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Register {isFaceID ? 'Face ID' : 'Fingerprint'}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => { setBiometricsEnabled(false); onToggle(); }}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="swap-horizontal" size={32} color="#fff" />
          </View>
          <Text style={styles.appName}>Swapify</Text>
          <Text style={styles.tagline}>Join the trade revolution.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create account</Text>
          <Text style={styles.cardSub}>Start trading in minutes</Text>

          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="person-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={Colors.textLight} value={fullName} onChangeText={setFullName} />
          </View>

          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="mail-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={Colors.textLight} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={[styles.input, { paddingRight: 44 }]} placeholder="Password (min. 6 chars)" placeholderTextColor={Colors.textLight} secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onToggle}><Text style={styles.footerLink}>Sign In</Text></TouchableOpacity>
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
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  card: { backgroundColor: '#fff', marginHorizontal: Spacing.lg, borderRadius: 28, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, position: 'relative' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: FontSize.sm, color: Colors.text },
  eyeBtn: { position: 'absolute', right: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  footerLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  bioScreen: { flex: 1, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  bioCard: { backgroundColor: '#fff', borderRadius: 28, padding: Spacing.xl, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  bioIconCircle: { width: 100, height: 100, borderRadius: 32, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  bioTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  bioSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  skipBtn: { marginTop: Spacing.md, padding: Spacing.md },
  skipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
});