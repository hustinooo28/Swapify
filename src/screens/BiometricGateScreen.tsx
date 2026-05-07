import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { authenticateWithBiometrics, isFaceIDAvailable, setBiometricsEnabled } from '../lib/biometrics';
import { supabase } from '../lib/supabase';

type Props = {
  onSuccess: () => void;
  onFallback: () => void;
};

export default function BiometricGateScreen({ onSuccess, onFallback }: Props) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    isFaceIDAvailable().then(setIsFaceID);
    // Auto-trigger on mount after short delay
    const timer = setTimeout(() => triggerAuth(), 600);
    return () => clearTimeout(timer);
  }, []);

  const triggerAuth = async () => {
    setLoading(true);
    setFailed(false);
    const success = await authenticateWithBiometrics();
    setLoading(false);
    if (success) {
      onSuccess();
    } else {
      setFailed(true);
      setAttemptCount(c => c + 1);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleDisableBiometrics = async () => {
    // If they can't auth, let them disable it and go to app
    // They'll need to re-enable from settings
    await setBiometricsEnabled(false);
    onFallback();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      <View style={styles.content}>
        {/* App logo */}
        <View style={styles.logoCircle}>
          <Ionicons name="swap-horizontal" size={28} color="#fff" />
        </View>
        <Text style={styles.appName}>Swapify</Text>

        {/* Biometric icon */}
        <View style={[styles.bioCircle, failed && styles.bioCircleFailed]}>
          {loading ? (
            <ActivityIndicator size="large" color={failed ? Colors.error : Colors.primary} />
          ) : (
            <Ionicons
              name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
              size={52}
              color={failed ? Colors.error : Colors.primary}
            />
          )}
        </View>

        <Text style={styles.title}>
          {failed ? 'Authentication Failed' : `Verify with ${isFaceID ? 'Face ID' : 'Fingerprint'}`}
        </Text>
        <Text style={styles.subtitle}>
          {failed
            ? 'Could not verify your identity.'
            : `Use ${isFaceID ? 'Face ID' : 'your fingerprint'} to securely access Swapify`}
        </Text>

        {/* Try Again */}
        <TouchableOpacity
          style={[styles.tryBtn, loading && styles.btnDisabled]}
          onPress={triggerAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
                size={18}
                color="#fff"
              />
              <Text style={styles.tryBtnText}>
                {failed ? 'Try Again' : `Use ${isFaceID ? 'Face ID' : 'Fingerprint'}`}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Show disable option after 2 failed attempts */}
        {attemptCount >= 2 && (
          <TouchableOpacity
            style={styles.disableBtn}
            onPress={handleDisableBiometrics}
          >
            <Text style={styles.disableBtnText}>
              Disable biometrics & continue
            </Text>
          </TouchableOpacity>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign in with a different account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  topDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, overflow: 'hidden' },
  decorCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, top: -140, left: -60, opacity: 0.1 },
  decorCircle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.primary, top: -60, right: -30, opacity: 0.07 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  logoCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  appName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl },
  bioCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.primary + '30' },
  bioCircleFailed: { backgroundColor: Colors.error + '12', borderColor: Colors.error + '30' },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  tryBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 15, borderRadius: BorderRadius.md, width: '100%', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  tryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  disableBtn: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, width: '100%', alignItems: 'center' },
  disableBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  signOutBtn: { marginTop: Spacing.md, padding: Spacing.md },
  signOutText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
});