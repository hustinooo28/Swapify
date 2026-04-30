import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, RefreshControl, Switch,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Item, User } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import {
  isBiometricsAvailable,
  getBiometricsEnabled,
  setBiometricsEnabled,
  authenticateWithBiometrics,
  isFaceIDAvailable,
} from '../lib/biometrics';

export default function ProfileScreen() {
  const { isDark, toggleDark, theme } = useTheme();
  const [profile, setProfile] = useState<User | null>(null);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [isFaceID, setIsFaceID] = useState(false);

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [useBioForDelete, setUseBioForDelete] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const available = await isBiometricsAvailable();
    const enabled = await getBiometricsEnabled();
    const faceID = await isFaceIDAvailable();
    setBiometricsAvailable(available);
    setBiometricsEnabledState(enabled);
    setIsFaceID(faceID);
    setUseBioForDelete(available && enabled);
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) setProfile(prof as User);
    const { data: items } = await supabase.from('items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (items) setMyItems(items as Item[]);
    setLoading(false);
    setRefreshing(false);
  };

  const handleToggleBiometrics = async (value: boolean) => {
    await setBiometricsEnabled(value);
    setBiometricsEnabledState(value);
    Alert.alert(
      value ? 'Biometrics Enabled' : 'Biometrics Disabled',
      value ? 'You can now use biometrics to log in.' : 'Biometric login has been turned off.'
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert('Delete Item', 'Remove this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('items').delete().eq('id', itemId);
          setMyItems((prev) => prev.filter((i) => i.id !== itemId));
        }
      },
    ]);
  };

  const handleMarkTraded = (itemId: string) => {
    Alert.alert('Mark as Traded', 'Mark this item as successfully traded?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Traded', onPress: async () => {
          await supabase.from('items').update({ status: 'traded' }).eq('id', itemId);
          setMyItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: 'traded' as const } : i));
        }
      },
    ]);
  };

  // ── Delete Account ──
  const openDeleteModal = () => {
    setDeletePassword('');
    setShowDeleteModal(true);
  };

  const handleDeleteWithBiometrics = async () => {
    setDeleteLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const success = await authenticateWithBiometrics();
    setDeleteLoading(false);

    if (success) {
      await performDeleteAccount();
    } else {
      Alert.alert('Verification Failed', 'Biometric verification was unsuccessful. Please try again or use your password.');
    }
  };

  const handleDeleteWithPassword = async () => {
    if (!deletePassword) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }
    if (!profile?.email) return;

    setDeleteLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: deletePassword,
    });
    setDeleteLoading(false);

    if (error) {
      Alert.alert('Wrong Password', 'The password you entered is incorrect.');
      return;
    }

    await performDeleteAccount();
  };

  const performDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete all user data
      await supabase.from('messages').delete().eq('sender_id', user.id);
      await supabase.from('offers').delete().eq('sender_id', user.id);
      await supabase.from('offers').delete().eq('receiver_id', user.id);
      await supabase.from('items').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);

      // Sign out — account deletion requires Supabase admin SDK on backend
      // so we clear local session and data
      await supabase.auth.signOut();

      setShowDeleteModal(false);
    } catch (e) {
      setDeleteLoading(false);
      Alert.alert('Error', 'Could not delete account. Please try again.');
    }
  };

  const statusColor = (status: string) =>
    status === 'available' ? Colors.success :
    status === 'pending' ? Colors.warning : Colors.textLight;

  const statsData = [
    { label: 'Listed', value: myItems.length },
    { label: 'Available', value: myItems.filter(i => i.status === 'available').length },
    { label: 'Traded', value: myItems.filter(i => i.status === 'traded').length },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.full_name || 'U')[0].toUpperCase()}</Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{profile?.full_name || 'User'}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{profile?.email}</Text>
          <View style={styles.stats}>
            {statsData.map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* My Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>My Listings</Text>
          {myItems.length === 0 ? (
            <View style={styles.emptyItems}>
              <Ionicons name="cube-outline" size={36} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No items listed yet.</Text>
            </View>
          ) : (
            myItems.map((item) => (
              <View key={item.id} style={[styles.itemRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Image source={{ uri: item.image_url || 'https://via.placeholder.com/60' }} style={styles.itemImage} />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.itemValue, { color: Colors.primary }]}>₱{item.estimated_value.toLocaleString()}</Text>
                  <View style={[styles.statusChip, { backgroundColor: statusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusChipText, { color: statusColor(item.status) }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  {item.status !== 'traded' && (
                    <TouchableOpacity onPress={() => handleMarkTraded(item.id)} style={styles.actionBtn}>
                      <Ionicons name="checkmark-circle-outline" size={22} color={Colors.success} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Settings</Text>

          <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={20} color={Colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          {biometricsAvailable && (
            <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.settingLeft}>
                <Ionicons name={isFaceID ? 'scan-outline' : 'finger-print-outline'} size={20} color={Colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  {isFaceID ? 'Face ID' : 'Fingerprint'} Login
                </Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          )}
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Account</Text>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={[styles.actionRowText, { color: Colors.error }]}>Log Out</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.error} style={styles.chevron} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.deleteRow, { borderColor: Colors.error }]}
            onPress={openDeleteModal}
          >
            <Ionicons name="person-remove-outline" size={20} color={Colors.error} />
            <Text style={[styles.actionRowText, { color: Colors.error }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.error} style={styles.chevron} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} animationType="slide" presentationStyle="pageSheet" transparent={false}>
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Account</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Warning */}
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={32} color={Colors.error} />
              <Text style={styles.warningTitle}>This cannot be undone</Text>
              <Text style={styles.warningText}>
                Deleting your account will permanently remove your profile, all listings, offers, and messages. This action is irreversible.
              </Text>
            </View>

            <Text style={[styles.verifyTitle, { color: theme.text }]}>Verify your identity</Text>

            {/* Biometric Option */}
            {biometricsAvailable && biometricsEnabled && (
              <>
                <TouchableOpacity
                  style={[styles.bioVerifyBtn, deleteLoading && styles.btnDisabled]}
                  onPress={handleDeleteWithBiometrics}
                  disabled={deleteLoading}
                >
                  {deleteLoading && useBioForDelete ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons
                        name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
                        size={22}
                        color={Colors.white}
                      />
                      <Text style={styles.bioVerifyBtnText}>
                        Verify with {isFaceID ? 'Face ID' : 'Fingerprint'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  <Text style={[styles.dividerText, { color: theme.textLight }]}>or verify with password</Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                </View>
              </>
            )}

            {/* Password Option */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Enter your password"
              placeholderTextColor={theme.textLight}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.deleteConfirmBtn, deleteLoading && styles.btnDisabled]}
              onPress={handleDeleteWithPassword}
              disabled={deleteLoading}
            >
              {deleteLoading && !useBioForDelete ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.deleteConfirmBtnText}>Delete My Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { fontSize: FontSize.xl, fontWeight: '800' },
  email: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  stats: { flexDirection: 'row', gap: 32 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs, marginTop: 2 },
  section: { padding: Spacing.lg, paddingBottom: 0 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: Spacing.md },
  emptyItems: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: FontSize.sm, marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1 },
  itemImage: { width: 56, height: 56, borderRadius: BorderRadius.sm, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  itemValue: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, marginTop: 4 },
  statusChipText: { fontSize: FontSize.xs, fontWeight: '600' },
  itemActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: FontSize.md, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, gap: 10 },
  deleteRow: { backgroundColor: Colors.error + '10' },
  actionRowText: { fontSize: FontSize.md, fontWeight: '600', flex: 1 },
  chevron: { marginLeft: 'auto' },

  // Modal
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
});