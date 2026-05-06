import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';

type Props = {
  email: string;
  onVerified: () => void;
  onBack: () => void;
};

// Change this to match whatever Supabase sends — 6 is standard
const OTP_LENGTH = 6;

export default function OTPScreen({ email, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (value: string, index: number) => {
    // Strip non-digits, take last character typed
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto advance
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Auto submit when all filled
    if (digit && index === OTP_LENGTH - 1 && newOtp.every(d => d !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  // Handle paste — user pastes full code
  const handlePaste = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH).split('');
    if (digits.length === OTP_LENGTH) {
      setOtp(digits);
      handleVerify(digits.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length < OTP_LENGTH) {
      Alert.alert('Incomplete', `Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });

      if (error) {
        // Generic — never expose raw error
        Alert.alert(
          'Verification Failed',
          'Invalid or expired code. Please check your email and try again.',
        );
        setOtp(Array(OTP_LENGTH).fill(''));
        inputs.current[0]?.focus();
      } else {
        onVerified();
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      Alert.alert('Error', 'Could not resend code. Please try again.');
    } else {
      setCountdown(60);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
      Alert.alert('Code Sent', `A new ${OTP_LENGTH}-digit code was sent to ${email}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Decorations */}
      <View style={styles.topDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={36} color="#fff" />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a {OTP_LENGTH}-digit verification code to
        </Text>
        <Text style={styles.emailText}>{email}</Text>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => { inputs.current[index] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(val) => {
                // Handle paste of full code
                if (val.length > 1) {
                  handlePaste(val);
                  return;
                }
                handleChange(val, index);
              }}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH} // allows paste
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.btnDisabled]}
          onPress={() => handleVerify()}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.verifyBtnText}>Verify Code</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive a code? </Text>
          {countdown > 0 ? (
            <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.resendLink}>Resend</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textLight} />
          <Text style={styles.securityNoteText}>
            This code expires in 10 minutes
          </Text>
        </View>

        {/* Help text */}
        <Text style={styles.helpText}>
          Check your spam folder if you don't see it
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  topDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, overflow: 'hidden' },
  decorCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, top: -140, left: -60, opacity: 0.1 },
  decorCircle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.primary, top: -60, right: -30, opacity: 0.07 },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 20,
    left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    zIndex: 10,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  iconCircle: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emailText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.xl, marginTop: 4 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  otpBox: {
    width: 46, height: 56,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    fontSize: 22, fontWeight: '800',
    color: Colors.text,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  verifyBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, padding: 15, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  resendText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resendCountdown: { fontSize: FontSize.sm, color: Colors.textLight, fontWeight: '600' },
  resendLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.xl,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  securityNoteText: { fontSize: FontSize.xs, color: Colors.textLight },
  helpText: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
});