import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

type NotifType = 'offer' | 'message' | 'admin';

type Notif = {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  time: string;
  avatar?: string;
  avatarInitial: string;
  payload: any;
  read: boolean;
  rawId?: string; // actual DB id for admin notifs
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchNotifs = useCallback(async () => {
    if (!userId) return;
    const results: Notif[] = [];

    // Trade offers received
    const { data: offers } = await supabase
      .from('offers')
      .select(`
        id, status, cash_addition, created_at,
        offered_item:items!offered_item_id(title, image_url),
        requested_item:items!requested_item_id(title),
        sender:profiles!sender_id(id, full_name, avatar_url)
      `)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (offers) {
      offers.forEach((o: any) => {
        const statusLabel =
          o.status === 'pending' ? 'New Trade Offer' :
          o.status === 'accepted' ? 'Offer Accepted' :
          o.status === 'declined' ? 'Offer Declined' : 'Trade Offer';
        results.push({
          id: `offer_${o.id}`,
          type: 'offer',
          title: statusLabel,
          subtitle: `${o.sender?.full_name} wants to trade "${o.offered_item?.title}" for your "${o.requested_item?.title}"${o.cash_addition > 0 ? ` + ₱${o.cash_addition.toLocaleString()} cash` : ''}`,
          time: o.created_at,
          avatar: o.sender?.avatar_url,
          avatarInitial: (o.sender?.full_name || 'U')[0].toUpperCase(),
          payload: o,
          read: o.status !== 'pending',
        });
      });
    }

    // Messages received
    const { data: messages } = await supabase
      .from('messages')
      .select(`
        id, content, created_at,
        sender:profiles!sender_id(id, full_name, avatar_url),
        offer:offers(id,
          offered_item:items!offered_item_id(title),
          requested_item:items!requested_item_id(title)
        )
      `)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (messages) {
      messages.forEach((m: any) => {
        results.push({
          id: `msg_${m.id}`,
          type: 'message',
          title: `New Message from ${m.sender?.full_name}`,
          subtitle: m.content.length > 60 ? m.content.slice(0, 60) + '...' : m.content,
          time: m.created_at,
          avatar: m.sender?.avatar_url,
          avatarInitial: (m.sender?.full_name || 'U')[0].toUpperCase(),
          payload: m,
          read: false,
        });
      });
    }

    // Admin notifications
    const { data: adminNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (adminNotifs) {
      adminNotifs.forEach((n: any) => {
        results.push({
          id: `notif_${n.id}`,
          rawId: n.id,
          type: 'admin',
          title: n.title,
          subtitle: n.body,
          time: n.created_at,
          avatarInitial: 'A',
          payload: n,
          read: n.read,
        });
      });
    }

    results.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifs(results);
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!userId) return;

    const offersChannel = supabase
      .channel(`notif_offers_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'offers', filter: `receiver_id=eq.${userId}` }, () => fetchNotifs())
      .subscribe();

    const msgsChannel = supabase
      .channel(`notif_msgs_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => fetchNotifs())
      .subscribe();

    const adminChannel = supabase
      .channel(`notif_admin_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => fetchNotifs())
      .subscribe();

    return () => {
      supabase.removeChannel(offersChannel);
      supabase.removeChannel(msgsChannel);
      supabase.removeChannel(adminChannel);
    };
  }, [userId, fetchNotifs]);

  useEffect(() => { if (userId) fetchNotifs(); }, [userId, fetchNotifs]);

  // Mark admin notification as read in DB
  const markAdminRead = async (rawId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', rawId);
  };

  const handlePress = async (notif: Notif) => {
    // Mark as read locally immediately
    setNotifs(prev =>
      prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
    );

    // Persist read state for admin notifs
    if (notif.type === 'admin' && notif.rawId && !notif.read) {
      await markAdminRead(notif.rawId);
    }

    // Navigate
    if (notif.type === 'offer') {
      navigation.navigate('Offers');
    } else if (notif.type === 'message') {
      const m = notif.payload;
      if (m.offer?.id) navigation.navigate('Chat', { offer: m.offer });
    }
    // admin type: no navigation, just marks read
  };

  const iconConfig = (type: NotifType, read: boolean) => {
    if (type === 'admin') return { icon: 'shield', color: Colors.error, bg: Colors.error + '18' };
    if (type === 'offer') return { icon: 'swap-horizontal', color: Colors.primary, bg: read ? Colors.primaryLight : Colors.primary + '22' };
    return { icon: 'chatbubble', color: Colors.secondary, bg: read ? '#E0FAF5' : '#0BC9A822' };
  };

  const renderNotif = ({ item: notif }: { item: Notif }) => {
    const cfg = iconConfig(notif.type, notif.read);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: theme.surface },
          !notif.read && { borderLeftWidth: 3, borderLeftColor: Colors.primary },
        ]}
        onPress={() => handlePress(notif)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeft}>
          {notif.avatar ? (
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: notif.avatar }} style={styles.avatar} />
              <View style={[styles.iconBadge, { backgroundColor: cfg.color }]}>
                <Ionicons name={cfg.icon as any} size={9} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.avatarInitialText, { color: cfg.color }]}>
                {notif.avatarInitial}
              </Text>
              <View style={[styles.iconBadge, { backgroundColor: cfg.color }]}>
                <Ionicons name={cfg.icon as any} size={9} color="#fff" />
              </View>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {notif.title}
            </Text>
            {!notif.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
            {notif.subtitle}
          </Text>
          <Text style={[styles.cardTime, { color: theme.textLight }]}>
            {timeAgo(notif.time)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          renderItem={renderNotif}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNotifs(); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: Colors.primaryLight }]}>
                <Ionicons name="notifications-outline" size={36} color={Colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up!</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                New trade offers and messages will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  list: { padding: Spacing.lg, gap: 10, paddingBottom: 40 },
  card: { flexDirection: 'row', borderRadius: BorderRadius.xl, padding: Spacing.md, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardLeft: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  avatarWrapper: { position: 'relative', width: 46, height: 46 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarInitialText: { fontSize: FontSize.lg, fontWeight: '800' },
  iconBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, flexShrink: 0 },
  cardSubtitle: { fontSize: FontSize.xs, lineHeight: 17, marginBottom: 4 },
  cardTime: { fontSize: FontSize.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
});