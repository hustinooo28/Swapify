import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import {
  isBiometricsAvailable, authenticateWithBiometrics, setBiometricsEnabled,
} from '../lib/biometrics';
import * as LocalAuthentication from 'expo-local-authentication';
import LocationPicker from '../components/LocationPicker';

type Props = {
  onToggle: () => void;
  onRegistered?: (email: string, avatarUri?: string | null, userId?: string | null) => void;
};

type Step = 'form' | 'photo' | 'biometrics';

function BiometricRegisterStep({
  isFaceID, onDone,
}: {
  isFaceID: boolean; onDone: (success: boolean) => void;
}) {
  const { theme, isDark } = useTheme();
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const timer = setTimeout(() => triggerScan(), 800);
    return () => clearTimeout(timer);
  }, []);

  const triggerScan = async () => {
    setStatus('scanning');
    await new Promise(r => setTimeout(r, 400));
    const success = await authenticateWithBiometrics();
    setStatus(success ? 'success' : 'failed');
    if (success) setTimeout(() => onDone(true), 1000);
  };

  const icon = () => {
    if (status === 'success') return <Ionicons name="checkmark-circle" size={56} color={Colors.success} />;
    if (status === 'failed') return <Ionicons name="close-circle" size={56} color={Colors.error} />;
    return <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={56} color={Colors.primary} />;
  };

  const circleColor = () => {
    if (status === 'success') return Colors.success + '18';
    if (status === 'failed') return Colors.error + '18';
    return Colors.primaryLight;
  };

  const title = () => {
    if (status === 'scanning') return isFaceID ? 'Look at your camera' : 'Place your finger';
    if (status === 'success') return 'All set!';
    if (status === 'failed') return 'Not recognized';
    return isFaceID ? 'Setting up Face ID' : 'Setting up Fingerprint';
  };

  const subtitle = () => {
    if (status === 'scanning') return isFaceID ? 'Position your face in front of the camera' : 'Keep your finger on the sensor';
    if (status === 'success') return 'Biometrics registered successfully.';
    if (status === 'failed') return "We couldn't register your biometrics. You can try again or skip and enable it later in Settings.";
    return isFaceID ? "We'll use Face ID to keep your account secure" : "We'll use your fingerprint to keep your account secure";
  };

  const bg = isDark ? '#0F1120' : '#F0F4FF';
  const cardBg = isDark ? '#1C1F2E' : '#FFFFFF';

  return (
    <View style={[bioStyles.container, { backgroundColor: bg }]}>
      <View style={bioStyles.topDecor}>
        <View style={bioStyles.circle1} />
        <View style={bioStyles.circle2} />
      </View>
      <View style={[bioStyles.card, { backgroundColor: cardBg }]}>
        <View style={bioStyles.dotsRow}>
          <View style={[bioStyles.dot, bioStyles.dotDone]} />
          <View style={bioStyles.line} />
          <View style={[bioStyles.dot, bioStyles.dotDone]} />
          <View style={bioStyles.line} />
          <View style={[bioStyles.dot, bioStyles.dotActive]} />
        </View>
        <View style={[bioStyles.iconCircle, { backgroundColor: circleColor() }]}>
          {status === 'scanning' ? <ActivityIndicator size="large" color={Colors.primary} /> : icon()}
        </View>
        <Text style={[bioStyles.title, { color: theme.text }]}>{title()}</Text>
        <Text style={[bioStyles.subtitle, { color: theme.textSecondary }]}>{subtitle()}</Text>
        {status === 'failed' && (
          <View style={bioStyles.actions}>
            <TouchableOpacity style={bioStyles.retryBtn} onPress={triggerScan}>
              <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={18} color="#fff" />
              <Text style={bioStyles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={bioStyles.skipBtn} onPress={() => onDone(false)}>
              <Text style={[bioStyles.skipText, { color: theme.textSecondary }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}
        {status === 'idle' && (
          <TouchableOpacity style={bioStyles.retryBtn} onPress={triggerScan}>
            <Text style={bioStyles.retryBtnText}>Start</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const bioStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  topDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, overflow: 'hidden' },
  circle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: Colors.primary, top: -140, left: -60, opacity: 0.1 },
  circle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.primary, top: -60, right: -30, opacity: 0.07 },
  card: { borderRadius: 28, padding: Spacing.xl, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 24, borderRadius: 5 },
  dotDone: { backgroundColor: Colors.success },
  line: { flex: 1, height: 2, backgroundColor: Colors.border, maxWidth: 40 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  actions: { width: '100%', gap: 10 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  retryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  skipBtn: { alignItems: 'center', padding: Spacing.md },
  skipText: { fontSize: FontSize.sm, fontWeight: '600' },
});

export default function RegisterScreen({ onToggle, onRegistered }: Props) {
  const { theme, isDark } = useTheme();
  const [step, setStep] = useState<Step>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const showPhotoOptions = () => {
    Alert.alert('Profile Photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) { Alert.alert('Missing Fields', 'Please fill in all required fields.'); return; }
    if (password.length < 6) { Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return; }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });

    if (error || !data.user) {
      setLoading(false);
      Alert.alert('Registration Failed', 'Could not create account. Please try again.');
      return;
    }

    const newUserId = data.user.id;
    setRegisteredUserId(newUserId);

    await supabase.from('profiles').upsert({
      id: newUserId, email, full_name: fullName,
      address: address.trim() || null,
      phone: phone.trim() || null,
    });

    setLoading(false);
    setStep('photo');
  };

  // Don't upload avatar here — user isn't verified yet.
  // Just pass the URI forward so App.tsx can upload after OTP.
  const handlePhotoNext = async () => {
    setUploadingPhoto(true);
    await new Promise(r => setTimeout(r, 300));
    setUploadingPhoto(false);

    const available = await isBiometricsAvailable();
    if (available) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setIsFaceID(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
      setStep('biometrics');
    } else {
      if (onRegistered) onRegistered(email, avatarUri, registeredUserId);
    }
  };

  const bg = isDark ? '#0F1120' : '#F0F4FF';
  const cardBg = isDark ? '#1C1F2E' : '#FFFFFF';
  const inputBg = isDark ? '#252836' : '#F7F9FC';
  const inputBorder = isDark ? '#2E3248' : '#E5E7EB';

  // ── STEP: PHOTO ──
  if (step === 'photo') {
    return (
      <View style={[styles.stepContainer, { backgroundColor: bg }]}>
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={[styles.stepCard, { backgroundColor: cardBg }]}>
          <View style={styles.stepIconRow}>
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>
          <Text style={[styles.stepTitle, { color: theme.text }]}>Add a profile photo</Text>
          <Text style={[styles.stepSub, { color: theme.textSecondary }]}>Help others recognize you in trades</Text>
          <TouchableOpacity style={styles.avatarPicker} onPress={showPhotoOptions} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, {
                backgroundColor: isDark ? '#252836' : Colors.borderLight,
                borderColor: isDark ? '#2E3248' : Colors.border,
              }]}>
                <Ionicons name="person-outline" size={48} color={theme.textLight} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoPickerBtn} onPress={showPhotoOptions}>
            <Ionicons name="camera-outline" size={18} color={Colors.primary} />
            <Text style={styles.photoPickerBtnText}>{avatarUri ? 'Change Photo' : 'Choose Photo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, uploadingPhoto && styles.btnDisabled]}
            onPress={handlePhotoNext}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>{avatarUri ? 'Save & Continue' : 'Skip for now'}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── STEP: BIOMETRICS ──
  if (step === 'biometrics') {
    return (
      <BiometricRegisterStep
        isFaceID={isFaceID}
        onDone={async (success) => {
          await setBiometricsEnabled(success);
          if (onRegistered) onRegistered(email, avatarUri, registeredUserId);
        }}
      />
    );
  }

  // ── STEP: FORM ──
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="swap-horizontal" size={32} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>Swapify</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>Join the trade revolution.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Create account</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Fill in your details to get started</Text>

          <View style={styles.stepIconRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <View style={styles.inputIcon}><Ionicons name="person-outline" size={18} color={theme.textLight} /></View>
            <TextInput style={[styles.input, { color: theme.text }]} placeholder="Full name *" placeholderTextColor={theme.textLight} value={fullName} onChangeText={setFullName} />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <View style={styles.inputIcon}><Ionicons name="mail-outline" size={18} color={theme.textLight} /></View>
            <TextInput style={[styles.input, { color: theme.text }]} placeholder="Email address *" placeholderTextColor={theme.textLight} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <View style={styles.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={theme.textLight} /></View>
            <TextInput style={[styles.input, { color: theme.text, paddingRight: 44 }]} placeholder="Password (min. 6 chars) *" placeholderTextColor={theme.textLight} secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textLight} />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <View style={styles.inputIcon}><Ionicons name="call-outline" size={18} color={theme.textLight} /></View>
            <TextInput style={[styles.input, { color: theme.text }]} placeholder="Phone number (optional)" placeholderTextColor={theme.textLight} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          </View>

          <View style={styles.locationField}>
            <Text style={[styles.locationLabel, { color: theme.textSecondary }]}>Location (optional)</Text>
            <LocationPicker value={address} onChange={setAddress} />
          </View>

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>Already have an account? </Text>
            <TouchableOpacity onPress={onToggle}><Text style={styles.footerLink}>Sign In</Text></TouchableOpacity>
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
  logoSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 24 },
  logoCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm, marginTop: 6, textAlign: 'center' },
  card: { marginHorizontal: Spacing.lg, borderRadius: 28, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8, marginBottom: 32 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 4 },
  cardSub: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: 12, position: 'relative' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: FontSize.sm },
  eyeBtn: { position: 'absolute', right: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { fontSize: FontSize.sm },
  footerLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  locationField: { marginBottom: 12 },
  locationLabel: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 6 },
  stepContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  stepCard: { borderRadius: 28, padding: Spacing.xl, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  stepIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, alignSelf: 'stretch', justifyContent: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, width: 24, borderRadius: 5 },
  stepDotDone: { backgroundColor: Colors.success },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, maxWidth: 40 },
  stepTitle: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  stepSub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  avatarPicker: { width: 120, height: 120, borderRadius: 60, marginBottom: Spacing.md, position: 'relative' },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed' },
  avatarEditBadge: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  photoPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight, marginBottom: Spacing.lg },
  photoPickerBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  skipBtn: { marginTop: Spacing.md, padding: Spacing.md },
  skipText: { fontSize: FontSize.sm, fontWeight: '600' },
});