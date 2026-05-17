import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

type AdminTab = 'analytics' | 'reports' | 'users';

export default function AdminScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [tab, setTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analytics, setAnalytics] = useState({
    totalUsers: 0, totalListings: 0, totalTrades: 0,
    totalReports: 0, pendingReports: 0,
  });
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAnalytics(), fetchReports(), fetchUsers()]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const fetchAnalytics = async () => {
    const [
      { count: totalUsers },
      { count: totalListings },
      { count: totalTrades },
      { count: totalReports },
      { count: pendingReports },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('items').select('id', { count: 'exact', head: true }),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setAnalytics({
      totalUsers: totalUsers ?? 0, totalListings: totalListings ?? 0,
      totalTrades: totalTrades ?? 0, totalReports: totalReports ?? 0,
      pendingReports: pendingReports ?? 0,
    });
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select(`*, reporter:profiles!reporter_id(full_name, avatar_url), reported:profiles!reported_user_id(full_name, avatar_url)`)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, is_banned, is_admin, created_at')
      .order('created_at', { ascending: false });
    if (error) console.error('fetchUsers error:', error.message);
    if (data) setUsers(data);
  };

  const handleReportAction = async (reportId: string, status: 'resolved' | 'dismissed') => {
    const label = status === 'resolved' ? 'Resolve' : 'Dismiss';
    Alert.alert(`${label} Report`, `Mark this report as ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          await supabase.from('reports').update({ status }).eq('id', reportId);
          fetchReports();
          fetchAnalytics();
        },
      },
    ]);
  };

  const handleToggleBan = async (userId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'Unban' : 'Ban';
    const newBanState = !currentlyBanned;

    Alert.alert(
      `${action} User`,
      `Are you sure you want to ${action.toLowerCase()} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: currentlyBanned ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ is_banned: newBanState })
              .eq('id', userId);

            if (error) {
              console.error('Ban error:', error.message);
              Alert.alert('Error', `Could not ${action.toLowerCase()} user: ${error.message}`);
              return;
            }

            console.log(`✅ User ${userId} is_banned set to ${newBanState}`);
            // Refresh users list to show updated state
            await fetchUsers();
          },
        },
      ],
    );
  };

  const handleDeleteListing = async (reportedUserId: string, reportId: string) => {
    const { data: items } = await supabase
      .from('items')
      .select('id, title')
      .eq('user_id', reportedUserId)
      .eq('status', 'available');

    if (!items || items.length === 0) {
      Alert.alert('No Listings', 'This user has no active listings to delete.');
      return;
    }

    const buttons = items.map((item: any) => ({
      text: item.title,
      onPress: () => {
        Alert.alert('Delete Listing', `Delete "${item.title}"?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await supabase.from('items').delete().eq('id', item.id);
              await supabase.from('notifications').insert({
                user_id: reportedUserId,
                type: 'admin',
                title: '⚠️ Listing Removed',
                body: `Your listing "${item.title}" was removed by an admin for violating community guidelines.`,
              });
              await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
              Alert.alert('Done', 'Listing deleted and user notified.');
              fetchAll();
            },
          },
        ]);
      },
    }));

    Alert.alert(
      'Select Listing to Delete',
      `${items.length} active listing(s) found`,
      [...buttons, { text: 'Cancel', style: 'cancel' as const }],
    );
  };

  const STAT_CARDS = [
    { label: 'Total Users',      value: analytics.totalUsers,    icon: 'people',          color: '#3B82F6' },
    { label: 'Total Listings',   value: analytics.totalListings, icon: 'cube',            color: '#10B981' },
    { label: 'Completed Trades', value: analytics.totalTrades,   icon: 'swap-horizontal', color: '#8B5CF6' },
    { label: 'Pending Reports',  value: analytics.pendingReports, icon: 'flag',           color: '#EF4444' },
  ];

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    pending:   { color: Colors.warning,   label: 'Pending' },
    resolved:  { color: Colors.success,   label: 'Resolved' },
    dismissed: { color: Colors.textLight, label: 'Dismissed' },
  };

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'analytics', label: 'Analytics', icon: 'bar-chart-outline' },
    { key: 'reports',   label: 'Reports',   icon: 'flag-outline' },
    { key: 'users',     label: 'Users',     icon: 'people-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Panel</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Swapify Management</Text>
        </View>
        <View style={[styles.adminBadge, { backgroundColor: Colors.error + '18' }]}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.error} />
          <Text style={[styles.adminBadgeText, { color: Colors.error }]}>Admin</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { borderBottomColor: Colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Ionicons name={t.icon as any} size={16} color={tab === t.key ? Colors.primary : theme.textLight} />
            <Text style={[styles.tabBtnText, { color: tab === t.key ? Colors.primary : theme.textLight }]}>
              {t.label}
            </Text>
            {t.key === 'reports' && analytics.pendingReports > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{analytics.pendingReports}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll(); }}
              tintColor={Colors.primary}
            />
          }
        >
          {/* ── Analytics Tab ── */}
          {tab === 'analytics' && (
            <View style={styles.tabContent}>
              <View style={styles.statGrid}>
                {STAT_CARDS.map((card) => (
                  <View key={card.label} style={[styles.statCard, { backgroundColor: theme.surface }]}>
                    <View style={[styles.statIconBox, { backgroundColor: card.color + '18' }]}>
                      <Ionicons name={card.icon as any} size={22} color={card.color} />
                    </View>
                    <Text style={[styles.statValue, { color: theme.text }]}>{card.value}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{card.label}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>Platform Summary</Text>
                {[
                  { label: 'Total Reports Filed', value: analytics.totalReports },
                  { label: 'Reports Resolved',    value: analytics.totalReports - analytics.pendingReports },
                  { label: 'Active Listings',     value: analytics.totalListings },
                  { label: 'Successful Trades',   value: analytics.totalTrades },
                ].map((row) => (
                  <View key={row.label} style={[styles.summaryRow, { borderTopColor: theme.border }]}>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                    <Text style={[styles.summaryValue, { color: theme.text }]}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Reports Tab ── */}
          {tab === 'reports' && (
            <View style={styles.tabContent}>
              {reports.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
                  <Ionicons name="flag-outline" size={36} color={theme.textLight} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No reports yet</Text>
                </View>
              ) : (
                reports.map((report) => {
                  const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
                  return (
                    <View key={report.id} style={[styles.reportCard, { backgroundColor: theme.surface }]}>
                      <View style={styles.reportTopRow}>
                        <View style={[styles.statusPill, { backgroundColor: sc.color + '18' }]}>
                          <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                        <Text style={[styles.reportDate, { color: theme.textLight }]}>
                          {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>

                      <View style={styles.reportParties}>
                        <View style={styles.partyBox}>
                          <Text style={[styles.partyRole, { color: theme.textLight }]}>Reporter</Text>
                          <View style={styles.partyRow}>
                            {report.reporter?.avatar_url ? (
                              <Image source={{ uri: report.reporter.avatar_url }} style={styles.partyAvatar} />
                            ) : (
                              <View style={[styles.partyAvatarFallback, { backgroundColor: Colors.primary }]}>
                                <Text style={styles.partyAvatarText}>{(report.reporter?.full_name || 'U')[0].toUpperCase()}</Text>
                              </View>
                            )}
                            <Text style={[styles.partyName, { color: theme.text }]} numberOfLines={1}>{report.reporter?.full_name}</Text>
                          </View>
                        </View>

                        <Ionicons name="arrow-forward" size={16} color={theme.textLight} />

                        <View style={styles.partyBox}>
                          <Text style={[styles.partyRole, { color: theme.textLight }]}>Reported</Text>
                          <View style={styles.partyRow}>
                            {report.reported?.avatar_url ? (
                              <Image source={{ uri: report.reported.avatar_url }} style={styles.partyAvatar} />
                            ) : (
                              <View style={[styles.partyAvatarFallback, { backgroundColor: Colors.error }]}>
                                <Text style={styles.partyAvatarText}>{(report.reported?.full_name || 'U')[0].toUpperCase()}</Text>
                              </View>
                            )}
                            <Text style={[styles.partyName, { color: theme.text }]} numberOfLines={1}>{report.reported?.full_name}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={[styles.reasonBox, { backgroundColor: theme.background }]}>
                        <Text style={[styles.reasonLabel, { color: theme.textLight }]}>Reason</Text>
                        <Text style={[styles.reasonText, { color: theme.text }]}>{report.reason}</Text>
                        {report.details ? (
                          <Text style={[styles.reasonDetails, { color: theme.textSecondary }]}>{report.details}</Text>
                        ) : null}
                      </View>

                      {report.status === 'pending' && (
                        <View style={styles.reportActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => handleReportAction(report.id, 'dismissed')}
                          >
                            <Ionicons name="close" size={15} color={theme.textSecondary} />
                            <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Dismiss</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: Colors.success + '18', borderColor: Colors.success }]}
                            onPress={() => handleReportAction(report.id, 'resolved')}
                          >
                            <Ionicons name="checkmark" size={15} color={Colors.success} />
                            <Text style={[styles.actionBtnText, { color: Colors.success }]}>Resolve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: Colors.error + '18', borderColor: Colors.error }]}
                            onPress={() => handleToggleBan(report.reported_user_id, false)}
                          >
                            <Ionicons name="ban" size={15} color={Colors.error} />
                            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Ban User</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: Colors.warning + '18', borderColor: Colors.warning }]}
                            onPress={() => handleDeleteListing(report.reported_user_id, report.id)}
                          >
                            <Ionicons name="trash" size={15} color={Colors.warning} />
                            <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Del. Listing</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ── Users Tab ── */}
          {tab === 'users' && (
            <View style={styles.tabContent}>
              <Text style={[styles.userCount, { color: theme.textSecondary }]}>
                {users.length} total users
              </Text>
              {users.map((user) => (
                <View key={user.id} style={[styles.userCard, { backgroundColor: theme.surface }]}>
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
                  ) : (
                    <View style={[styles.userAvatarFallback, {
                      backgroundColor: user.is_banned ? Colors.error : Colors.primary,
                    }]}>
                      <Text style={styles.userAvatarText}>
                        {(user.full_name || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                        {user.full_name}
                      </Text>
                      {user.is_admin && (
                        <View style={[styles.adminTag, { backgroundColor: Colors.error + '18' }]}>
                          <Text style={[styles.adminTagText, { color: Colors.error }]}>Admin</Text>
                        </View>
                      )}
                      {user.is_banned && (
                        <View style={[styles.bannedTag, { backgroundColor: Colors.error }]}>
                          <Text style={styles.bannedTagText}>Banned</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                    <Text style={[styles.userJoined, { color: theme.textLight }]}>
                      Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>

                  {!user.is_admin && (
                    <TouchableOpacity
                      style={[
                        styles.banBtn,
                        { backgroundColor: user.is_banned ? Colors.success + '18' : Colors.error + '18' },
                      ]}
                      onPress={() => handleToggleBan(user.id, user.is_banned)}
                    >
                      <Ionicons
                        name={user.is_banned ? 'checkmark-circle-outline' : 'ban-outline'}
                        size={18}
                        color={user.is_banned ? Colors.success : Colors.error}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  headerSub: { fontSize: FontSize.xs, marginTop: 1 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, marginLeft: 'auto' },
  adminBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  tabBadge: { backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  body: { padding: Spacing.lg },
  tabContent: { gap: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', borderRadius: BorderRadius.xl, padding: Spacing.md, alignItems: 'flex-start', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: FontSize.xxl, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs },
  summaryCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  summaryTitle: { fontSize: FontSize.md, fontWeight: '800', marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  summaryLabel: { fontSize: FontSize.sm },
  summaryValue: { fontSize: FontSize.sm, fontWeight: '700' },
  reportCard: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  reportTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  reportDate: { fontSize: FontSize.xs },
  reportParties: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  partyBox: { flex: 1, gap: 4 },
  partyRole: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partyAvatar: { width: 28, height: 28, borderRadius: 14 },
  partyAvatarFallback: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  partyAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  partyName: { fontSize: FontSize.xs, fontWeight: '600', flex: 1 },
  reasonBox: { borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.md, gap: 2 },
  reasonLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { fontSize: FontSize.sm, fontWeight: '700' },
  reasonDetails: { fontSize: FontSize.xs, marginTop: 2 },
  reportActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  actionBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  userCount: { fontSize: FontSize.sm, marginBottom: 4 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.xl, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  userAvatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  userAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  userInfo: { flex: 1, minWidth: 0 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  userName: { fontSize: FontSize.sm, fontWeight: '700', flexShrink: 1 },
  adminTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  adminTagText: { fontSize: 9, fontWeight: '800' },
  bannedTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  bannedTagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  userEmail: { fontSize: FontSize.xs, marginBottom: 2 },
  userJoined: { fontSize: FontSize.xs },
  banBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  emptyCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: FontSize.sm },
});