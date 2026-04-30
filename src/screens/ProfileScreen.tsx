import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, RefreshControl, Switch,
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
} from '../lib/biometrics';

export default function ProfileScreen() {
  const { isDark, toggleDark, theme } = useTheme();
  const [profile, setProfile] = useState<User | null>(null);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const available = await isBiometricsAvailable();
    const enabled = await getBiometricsEnabled();
    setBiometricsAvailable(available);
    setBiometricsEnabledState(enabled);
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
    Alert.alert(value ? 'Biometrics Enabled' : 'Biometrics Disabled', value ? 'You will be asked to verify on next login.' : 'Biometric lock has been turned off.');
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
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('items').delete().eq('id', itemId); setMyItems((prev) => prev.filter((i) => i.id !== itemId)); } },
    ]);
  };

  const handleMarkTraded = (itemId: string) => {
    Alert.alert('Mark as Traded', 'Mark this item as successfully traded?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Traded', onPress: async () => {
          await supabase.from('items').update({ status: 'traded' }).eq('id', itemId);
          setMyItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: 'traded' } : i));
        }
      },
    ]);
  };

  const statsData = [
    { label: 'Listed', value: myItems.length },
    { label: 'Available', value: myItems.filter(i => i.status === 'available').length },
    { label: 'Traded', value: myItems.filter(i => i.status === 'traded').length },
  ];

  const statusColor = (status: string) =>
    status === 'available' ? Colors.success : status === 'pending' ? Colors.warning : Colors.textLight;

  if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(profile?.full_name || 'U')[0].toUpperCase()}</Text></View>
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
                  <Text style={[styles.statusChipText, { color: statusColor(item.status) }]}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
                </View>
              </View>
              <View style={styles.itemActions}>
                {item.status !== 'traded' && (
                  <TouchableOpacity onPress={() => handleMarkTraded(item.id)} style={styles.tradedBtn}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
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
          <Switch value={isDark} onValueChange={toggleDark} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.white} />
        </View>

        {biometricsAvailable && (
          <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print-outline" size={20} color={Colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.text }]}>Fingerprint / Face ID</Text>
            </View>
            <Switch value={biometricsEnabled} onValueChange={handleToggleBiometrics} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.white} />
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={[styles.logoutBtn, { borderColor: Colors.error }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
  section: { padding: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: Spacing.md },
  emptyItems: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: FontSize.sm, marginTop: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  itemImage: { width: 56, height: 56, borderRadius: BorderRadius.sm, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: FontSize.sm, fontWeight: '700' },
  itemValue: { fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, marginTop: 4 },
  statusChipText: { fontSize: FontSize.xs, fontWeight: '600' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tradedBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: FontSize.md, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  logoutText: { color: Colors.error, fontSize: FontSize.md, fontWeight: '700' },
});