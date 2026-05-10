import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Item, User } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [profile, setProfile] = useState<User | null>(null);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) {
      setProfile(prof as User);
      setIsAdmin((prof as any).is_admin === true);
    }
    const { data: items } = await supabase.from('items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (items) setMyItems(items as Item[]);
    setLoading(false);
    setRefreshing(false);
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert('Delete Item', 'Remove this listing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('items').delete().eq('id', itemId);
        setMyItems(prev => prev.filter(i => i.id !== itemId));
      }},
    ]);
  };

  const handleMarkTraded = (itemId: string) => {
    Alert.alert('Mark as Traded', 'Mark this item as successfully traded?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Traded', onPress: async () => {
        await supabase.from('items').update({ status: 'traded' }).eq('id', itemId);
        setMyItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'traded' as const } : i));
      }},
    ]);
  };

  const statusColor = (status: string) =>
    status === 'available' ? Colors.success :
    status === 'pending' ? Colors.warning : Colors.textLight;

  const statsData = [
    { label: 'Listed',    value: myItems.length },
    { label: 'Available', value: myItems.filter(i => i.status === 'available').length },
    { label: 'Traded',    value: myItems.filter(i => i.status === 'traded').length },
  ];

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchProfile(); }}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface }]}>

          {/* Top row */}
          <View style={styles.headerTopRow}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
            <TouchableOpacity
              style={[styles.settingsBtn, { backgroundColor: theme.background }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Avatar + info */}
          <View style={styles.profileRow}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => navigation.navigate('EditProfile', { profile })}
              activeOpacity={0.85}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.avatarInitial}>
                    {(profile?.full_name || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={11} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]}>
                {profile?.full_name || 'User'}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                {profile?.email}
              </Text>
              {profile?.phone ? (
                <View style={styles.infoChip}>
                  <Ionicons name="call-outline" size={12} color={theme.textLight} />
                  <Text style={[styles.infoChipText, { color: theme.textSecondary }]}>{profile.phone}</Text>
                </View>
              ) : null}
              {profile?.address ? (
                <View style={styles.infoChip}>
                  <Ionicons name="location-outline" size={12} color={theme.textLight} />
                  <Text style={[styles.infoChipText, { color: theme.textSecondary }]} numberOfLines={1}>{profile.address}</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: Colors.primaryLight }]}
              onPress={() => navigation.navigate('EditProfile', { profile })}
            >
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { backgroundColor: theme.background }]}>
            {statsData.map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.primary }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
                </View>
                {i < statsData.length - 1 && (
                  <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Admin Panel button — only visible to admins */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.adminBtn, { backgroundColor: Colors.error + '12' }]}
              onPress={() => navigation.navigate('Admin')}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={18} color={Colors.error} />
              <Text style={[styles.adminBtnText, { color: Colors.error }]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.error} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}
        </View>

        {/* My Listings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>My Listings</Text>
            <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
              {myItems.length} items
            </Text>
          </View>

          {myItems.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
              <View style={[styles.emptyIconBox, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="cube-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No listings yet</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Start trading by listing your first item
              </Text>
            </View>
          ) : (
            myItems.map((item) => (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: theme.surface }]}>
                <Image
                  source={{ uri: item.image_url || 'https://via.placeholder.com/60' }}
                  style={styles.itemImage}
                />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemValue, { color: Colors.primary }]}>
                    ₱{item.estimated_value.toLocaleString()}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: statusColor(item.status) + '18' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  {item.status !== 'traded' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.primaryLight }]}
                        onPress={() => navigation.navigate('EditItem', { item })}
                      >
                        <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.success + '18' }]}
                        onPress={() => handleMarkTraded(item.id)}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.error + '15' }]}
                    onPress={() => handleDeleteItem(item.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {},
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.3 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: Spacing.lg },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: FontSize.lg, fontWeight: '800' },
  profileEmail: { fontSize: FontSize.xs, marginBottom: 4 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoChipText: { fontSize: FontSize.xs },
  editBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', borderRadius: BorderRadius.xl, padding: Spacing.md, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs, marginTop: 2 },
  statDivider: { width: 1, height: '60%', alignSelf: 'center' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: BorderRadius.lg, padding: 14, marginTop: Spacing.md },
  adminBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  section: { padding: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  sectionCount: { fontSize: FontSize.sm },
  emptyCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center' },
  emptyIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 4 },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  itemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.xl, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  itemImage: { width: 56, height: 56, borderRadius: BorderRadius.lg, marginRight: 12, flexShrink: 0 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 2 },
  itemValue: { fontSize: FontSize.xs, fontWeight: '700', marginBottom: 4 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  itemActions: { flexDirection: 'row', gap: 6, flexShrink: 0, alignItems: 'center' },
  actionBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});