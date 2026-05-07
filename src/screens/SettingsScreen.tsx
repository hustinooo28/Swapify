import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import {
  isBiometricsAvailable, getBiometricsEnabled,
  setBiometricsEnabled, authenticateWithBiometrics, isFaceIDAvailable,
  clearStoredCredentials,
} from '../lib/biometrics';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { isDark, toggleDark, theme } = useTheme();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [registeringBio, setRegisteringBio] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    checkBiometrics();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data);
  };

  const checkBiometrics = async () => {
    const available = await isBiometricsAvailable();
    const enabled = await getBiometricsEnabled();
    const faceID = await isFaceIDAvailable();
    setBiometricsAvailable(available);
    setBiometricsEnabledState(enabled);
    setIsFaceID(faceID);
  };

const handleToggleBiometrics = async (value: boolean) => {
    if (value) {
      // User is turning ON — must verify biometrics first to register
      setRegisteringBio(true);
      await new Promise(r => setTimeout(r, 400));
      const success = await authenticateWithBiometrics();
      setRegisteringBio(false);

      if (success) {
        await setBiometricsEnabled(true);
        setBiometricsEnabledState(true);
        Alert.alert(
          '✅ Biometrics Enabled',
          `${isFaceID ? 'Face ID' : 'Fingerprint'} has been registered. You can now use it to log in.`
        );
      } else {
        // Don't enable if registration failed
        setBiometricsEnabledState(false);
        Alert.alert(
          'Registration Failed',
          `Could not register your ${isFaceID ? 'Face ID' : 'fingerprint'}. Please try again.`
        );
      }
    } else {
      // Turning OFF — no verification needed
      await setBiometricsEnabled(false);
      setBiometricsEnabledState(false);
      Alert.alert('Biometrics Disabled', 'Biometric login has been turned off.');
    }
  };

const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearStoredCredentials();
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handleDeleteWithBiometrics = async () => {
    setDeleteLoading(true);
    await new Promise(r => setTimeout(r, 300));
    const success = await authenticateWithBiometrics();
    setDeleteLoading(false);
    if (success) await performDelete();
    else Alert.alert('Failed', 'Biometric verification failed. Try your password instead.');
  };

  const handleDeleteWithPassword = async () => {
    if (!deletePassword) { Alert.alert('Error', 'Please enter your password.'); return; }
    if (!profile?.email) return;
    setDeleteLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password: deletePassword });
    setDeleteLoading(false);
    if (error) { Alert.alert('Wrong Password', 'Incorrect password. Please try again.'); return; }
    await performDelete();
  };

const performDelete = async () => {
    setDeleteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('messages').delete().eq('sender_id', user.id);
      await supabase.from('offers').delete().eq('sender_id', user.id);
      await supabase.from('offers').delete().eq('receiver_id', user.id);
      await supabase.from('items').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      await clearStoredCredentials();
      await supabase.auth.signOut();
    } catch {
      setDeleteLoading(false);
      Alert.alert('Error', 'Could not delete account. Please try again.');
    }
  };

  const SettingRow = ({ icon, label, onPress, rightElement, danger }: any) => (
    <TouchableOpacity
      style={[styles.settingRow, { backgroundColor: theme.card }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIconBox, { backgroundColor: danger ? Colors.error + '15' : Colors.primaryLight }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: danger ? Colors.error : theme.text }]}>{label}</Text>
      {rightElement || (
        onPress && <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

    {/* Biometric registration overlay */}
      {registeringBio && (
        <View style={styles.bioOverlay}>
          <View style={styles.bioOverlayCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.bioOverlayText}>
              {isFaceID ? 'Look at your camera...' : 'Place your finger on the sensor...'}
            </Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APPEARANCE</Text>
        <View style={styles.group}>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleDark}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Security */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SECURITY</Text>
        <View style={styles.group}>
          {biometricsAvailable && (
            <SettingRow
              icon={isFaceID ? 'scan-outline' : 'finger-print-outline'}
              label={`${isFaceID ? 'Face ID' : 'Fingerprint'} Login`}
              rightElement={
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleToggleBiometrics}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#fff"
                />
              }
            />
          )}
          <SettingRow
            icon="key-outline"
            label="Change Password"
            onPress={() => Alert.alert('Change Password', 'A password reset link will be sent to your email.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Send Link', onPress: async () => {
                if (profile?.email) {
                  await supabase.auth.resetPasswordForEmail(profile.email);
                  Alert.alert('Sent!', 'Check your email for the reset link.');
                }
              }},
            ])}
          />
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ABOUT</Text>
        <View style={styles.group}>
          <SettingRow icon="information-circle-outline" label="App Version" rightElement={<Text style={[styles.versionText, { color: theme.textLight }]}>1.0.0</Text>} />
          <SettingRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
          <SettingRow icon="shield-outline" label="Privacy Policy" onPress={() => {}} />
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ACCOUNT</Text>
        <View style={styles.group}>
          <SettingRow icon="log-out-outline" label="Log Out" onPress={handleLogout} danger />
          <SettingRow icon="person-remove-outline" label="Delete Account" onPress={() => setShowDeleteModal(true)} danger />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Modal */}
      <Modal visible={showDeleteModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Account</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={32} color={Colors.error} />
              <Text style={styles.warningTitle}>This cannot be undone</Text>
              <Text style={styles.warningText}>All your listings, offers, and messages will be permanently deleted.</Text>
            </View>
            <Text style={[styles.verifyTitle, { color: theme.text }]}>Verify your identity</Text>
            {biometricsAvailable && biometricsEnabled && (
              <>
                <TouchableOpacity
                  style={[styles.bioVerifyBtn, deleteLoading && styles.btnDisabled]}
                  onPress={handleDeleteWithBiometrics}
                  disabled={deleteLoading}
                >
                  {deleteLoading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={20} color="#fff" />
                        <Text style={styles.bioVerifyBtnText}>Verify with {isFaceID ? 'Face ID' : 'Fingerprint'}</Text>
                      </>
                  }
                </TouchableOpacity>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  <Text style={[styles.dividerText, { color: theme.textLight }]}>or use password</Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                </View>
              </>
            )}
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Enter your password"
              placeholderTextColor={theme.textLight}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
            />
            <TouchableOpacity
              style={[styles.deleteConfirmBtn, deleteLoading && styles.btnDisabled]}
              onPress={handleDeleteWithPassword}
              disabled={deleteLoading}
            >
              {deleteLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteConfirmBtnText}>Delete My Account</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  scroll: { padding: Spacing.lg },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginTop: Spacing.md, marginLeft: 4 },
  group: { borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: 4, gap: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  settingIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: '600' },
  versionText: { fontSize: FontSize.sm },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, paddingTop: 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg, paddingBottom: 48 },
  warningBox: { backgroundColor: Colors.error + '10', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.error + '30' },
  warningTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.error, marginTop: 8, marginBottom: 6 },
  warningText: { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center', lineHeight: 20, opacity: 0.8 },
  verifyTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
  bioVerifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  bioVerifyBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 10, fontSize: FontSize.xs },
  inputLabel: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 6 },
  passwordInput: { borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, borderWidth: 1, marginBottom: Spacing.md },
  deleteConfirmBtn: { backgroundColor: Colors.error, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm },
  deleteConfirmBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: Spacing.md },
  cancelBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  bioOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  bioOverlayCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 16, marginHorizontal: 32 },
  bioOverlayText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, textAlign: 'center' },
});