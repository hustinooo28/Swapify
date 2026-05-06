import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import {
  isBiometricsAvailable, authenticateWithBiometrics, setBiometricsEnabled,
} from '../lib/biometrics';
import * as LocalAuthentication from 'expo-local-authentication';

type Props = {
  onToggle: () => void;
  onRegistered?: (email: string) => void;
};

type Step = 'form' | 'photo' | 'biometrics';

export default function RegisterScreen({ onToggle, onRegistered }: Props) {
  const [step, setStep] = useState<Step>('form');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Photo
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Biometrics
  const [bioLoading, setBioLoading] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);

  // Registered user id (needed to save avatar)
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  // ── Pick photo from gallery ──
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  // ── Take photo with camera ──
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const showPhotoOptions = () => {
    Alert.alert('Profile Photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Upload avatar to Supabase storage ──
  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarUri) return null;
    try {
      const ext = avatarUri.split('.').pop() || 'jpg';
      const fileName = `avatar_${userId}.${ext}`;
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e) {
      return null;
    }
  };

  // ── Step 1: Register account ──
  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error || !data.user) {
      setLoading(false);
      Alert.alert('Registration Failed', 'Could not create account. Please try again.');
      return;
    }

    setRegisteredUserId(data.user.id);

    // Save basic profile first
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      address: address.trim() || null,
      phone: phone.trim() || null,
    });

    setLoading(false);
    // Go to photo step
    setStep('photo');
  };

  // ── Step 2: Save photo and continue ──
  const handlePhotoNext = async () => {
    if (!registeredUserId) return;

    if (avatarUri) {
      setUploadingPhoto(true);
      const avatarUrl = await uploadAvatar(registeredUserId);
      if (avatarUrl) {
        await supabase.from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', registeredUserId);
      }
      setUploadingPhoto(false);
    }

    // Check biometrics
    const available = await isBiometricsAvailable();
    if (available) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setIsFaceID(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION));
      setStep('biometrics');
    } else {
      if (onRegistered) onRegistered(email);
    }
  };

  // ── Step 3: Biometrics ──
  const handleEnableBiometrics = async () => {
    setBioLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const success = await authenticateWithBiometrics();
    setBioLoading(false);
    if (success) {
      await setBiometricsEnabled(true);
      Alert.alert('✅ All Set!', `${isFaceID ? 'Face ID' : 'Fingerprint'} registered.`, [
        { text: "Continue", onPress: () => { if (onRegistered) onRegistered(email); } },
      ]);
    } else {
      Alert.alert('Skipped', 'You can enable biometrics later in Profile > Settings.', [
        { text: 'OK', onPress: () => { if (onRegistered) onRegistered(email); } },
      ]);
    }
  };

  // ────────────────────────────────────────
  // STEP: PHOTO
  // ────────────────────────────────────────
  if (step === 'photo') {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepIconRow}>
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>

          <Text style={styles.stepTitle}>Add a profile photo</Text>
          <Text style={styles.stepSub}>Help others recognize you in trades</Text>

          {/* Avatar preview */}
          <TouchableOpacity style={styles.avatarPicker} onPress={showPhotoOptions} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-outline" size={48} color={Colors.textLight} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.photoPickerBtn} onPress={showPhotoOptions}>
            <Ionicons name="camera-outline" size={18} color={Colors.primary} />
            <Text style={styles.photoPickerBtnText}>
              {avatarUri ? 'Change Photo' : 'Choose Photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, uploadingPhoto && styles.btnDisabled]}
            onPress={handlePhotoNext}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>
                  {avatarUri ? 'Save & Continue' : 'Skip for now'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────
  // STEP: BIOMETRICS
  // ────────────────────────────────────────
  if (step === 'biometrics') {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.stepCard}>
          <View style={styles.stepIconRow}>
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>

          <View style={styles.bioIconCircle}>
            <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={48} color="#fff" />
          </View>
          <Text style={styles.stepTitle}>Set up {isFaceID ? 'Face ID' : 'Fingerprint'}</Text>
          <Text style={styles.stepSub}>Log in quickly and securely without typing your password.</Text>

          <TouchableOpacity
            style={[styles.primaryBtn, bioLoading && styles.btnDisabled]}
            onPress={handleEnableBiometrics}
            disabled={bioLoading}
          >
            {bioLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Register {isFaceID ? 'Face ID' : 'Fingerprint'}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => { setBiometricsEnabled(false); if (onRegistered) onRegistered(email); }}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────
  // STEP: FORM
  // ────────────────────────────────────────
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
          <Text style={styles.cardSub}>Fill in your details to get started</Text>

          {/* Progress dots */}
          <View style={styles.stepIconRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>

          {/* Full Name */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="person-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={styles.input} placeholder="Full name *" placeholderTextColor={Colors.textLight} value={fullName} onChangeText={setFullName} />
          </View>

          {/* Email */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="mail-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={styles.input} placeholder="Email address *" placeholderTextColor={Colors.textLight} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          {/* Password */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="lock-closed-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={[styles.input, { paddingRight: 44 }]} placeholder="Password (min. 6 chars) *" placeholderTextColor={Colors.textLight} secureTextEntry={!showPass} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* Phone */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIcon}><Ionicons name="call-outline" size={18} color={Colors.textLight} /></View>
            <TextInput style={styles.input} placeholder="Phone number (optional)" placeholderTextColor={Colors.textLight} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          </View>

          {/* Address */}
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <View style={[styles.inputIcon, { paddingTop: 2 }]}><Ionicons name="location-outline" size={18} color={Colors.textLight} /></View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Address (optional)"
              placeholderTextColor={Colors.textLight}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
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
  logoSection: { alignItems: 'center', paddingTop: 80, paddingBottom: 24 },
  logoCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  appName: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  card: { backgroundColor: '#fff', marginHorizontal: Spacing.lg, borderRadius: 28, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8, marginBottom: 32 },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, position: 'relative' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingRight: 14, fontSize: FontSize.sm, color: Colors.text },
  textAreaWrapper: { alignItems: 'flex-start', paddingVertical: 4 },
  textArea: { height: 60, paddingVertical: 10 },
  eyeBtn: { position: 'absolute', right: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  footerLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },

  // Shared step styles
  stepContainer: { flex: 1, backgroundColor: '#F0F4FF', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  stepCard: { backgroundColor: '#fff', borderRadius: 28, padding: Spacing.xl, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  stepIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, alignSelf: 'stretch', justifyContent: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, width: 24, borderRadius: 5 },
  stepDotDone: { backgroundColor: Colors.success },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, maxWidth: 40 },
  stepTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  stepSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },

  // Photo step
  avatarPicker: { width: 120, height: 120, borderRadius: 60, marginBottom: Spacing.md, position: 'relative' },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  avatarEditBadge: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  photoPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight, marginBottom: Spacing.lg },
  photoPickerBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },

  // Biometrics step
  bioIconCircle: { width: 100, height: 100, borderRadius: 32, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  skipBtn: { marginTop: Spacing.md, padding: Spacing.md },
  skipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
});