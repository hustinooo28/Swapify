import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Offer } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

type Tab = 'received' | 'sent';

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pending:   { color: Colors.warning, icon: 'time-outline',             label: 'Pending' },
  accepted:  { color: Colors.success, icon: 'checkmark-circle-outline', label: 'Accepted' },
  declined:  { color: Colors.error,   icon: 'close-circle-outline',     label: 'Declined' },
  cancelled: { color: Colors.textLight, icon: 'ban-outline',            label: 'Cancelled' },
};

export default function OffersScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>('received');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  const fetchOffers = useCallback(async () => {
    if (!userId) return;
    const field = tab === 'received' ? 'receiver_id' : 'sender_id';
    const { data, error } = await supabase
      .from('offers')
      .select(`*, offered_item:items!offered_item_id(id,title,image_url,estimated_value), requested_item:items!requested_item_id(id,title,image_url,estimated_value), sender:profiles!sender_id(id,full_name), receiver:profiles!receiver_id(id,full_name)`)
      .eq(field, userId)
      .order('created_at', { ascending: false });
    if (!error && data) setOffers(data as Offer[]);
    setLoading(false); setRefreshing(false);
  }, [userId, tab]);

  useEffect(() => { if (userId) fetchOffers(); }, [userId, fetchOffers]);

const updateOfferStatus = async (offerId: string, status: 'accepted' | 'declined') => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    await supabase.from('offers').update({ status }).eq('id', offerId);

    if (status === 'accepted') {
      await supabase.from('items').update({ status: 'pending' }).eq('id', offer.offered_item_id);
      await supabase.from('items').update({ status: 'pending' }).eq('id', offer.requested_item_id);
    }

    // Notify the sender of the decision
    await supabase.from('notifications').insert({
      user_id: offer.sender_id,
      type: 'offer',
      title: status === 'accepted' ? '🎉 Offer Accepted!' : '❌ Offer Declined',
      body: status === 'accepted'
        ? `Your offer to trade "${offer.offered_item?.title}" for "${offer.requested_item?.title}" was accepted!`
        : `Your offer to trade "${offer.offered_item?.title}" for "${offer.requested_item?.title}" was declined.`,
      read: false,
    });

    fetchOffers();
  };

  const renderOffer = ({ item: offer }: { item: Offer }) => {
    const sc = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending;
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {/* Status row */}
        <View style={styles.cardTop}>
          <View style={[styles.statusPill, { backgroundColor: sc.color + '18' }]}>
            <Ionicons name={sc.icon as any} size={13} color={sc.color} />
            <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
          </View>
          <Text style={[styles.dateText, { color: theme.textLight }]}>
            {new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Swap row */}
        <View style={styles.swapRow}>
          <View style={styles.itemThumb}>
            <Image source={{ uri: offer.offered_item?.image_url || 'https://via.placeholder.com/70' }} style={styles.thumbImg} />
            <Text style={[styles.thumbTitle, { color: theme.text }]} numberOfLines={2}>{offer.offered_item?.title}</Text>
            <Text style={styles.thumbValue}>₱{offer.offered_item?.estimated_value?.toLocaleString()}</Text>
          </View>

          <View style={styles.swapCenter}>
            <View style={[styles.swapCircle, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
            </View>
            {offer.cash_addition > 0 && (
              <View style={styles.cashBadge}>
                <Text style={styles.cashBadgeText}>+₱{offer.cash_addition.toLocaleString()}</Text>
              </View>
            )}
          </View>

          <View style={styles.itemThumb}>
            <Image source={{ uri: offer.requested_item?.image_url || 'https://via.placeholder.com/70' }} style={styles.thumbImg} />
            <Text style={[styles.thumbTitle, { color: theme.text }]} numberOfLines={2}>{offer.requested_item?.title}</Text>
            <Text style={styles.thumbValue}>₱{offer.requested_item?.estimated_value?.toLocaleString()}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Party + actions */}
        <View style={styles.cardBottom}>
          <View style={styles.partyRow}>
            <View style={styles.partyAvatar}>
              <Text style={styles.partyAvatarText}>
                {((tab === 'received' ? offer.sender?.full_name : offer.receiver?.full_name) || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.partyName, { color: theme.textSecondary }]}>
              {tab === 'received' ? `From ${offer.sender?.full_name}` : `To ${offer.receiver?.full_name}`}
            </Text>
          </View>

          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: theme.border }]}
              onPress={() => navigation.navigate('Chat', { offer })}
            >
              <Ionicons name="chatbubble-outline" size={15} color={Colors.primary} />
            </TouchableOpacity>

            {tab === 'received' && offer.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: Colors.error }]}
                  onPress={() => Alert.alert('Decline', 'Decline this offer?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Decline', style: 'destructive', onPress: () => updateOfferStatus(offer.id, 'declined') },
                  ])}
                >
                  <Ionicons name="close" size={15} color={Colors.error} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => Alert.alert('Accept', 'Accept this trade offer?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Accept', onPress: () => updateOfferStatus(offer.id, 'accepted') },
                  ])}
                >
                  <Ionicons name="checkmark" size={15} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Your trade offers & chats</Text>
        <View style={[styles.tabRow, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'received' && styles.tabBtnActive]}
            onPress={() => setTab('received')}
          >
            <Text style={[styles.tabBtnText, { color: tab === 'received' ? '#fff' : theme.textSecondary }]}>Received</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]}
            onPress={() => setTab('sent')}
          >
            <Text style={[styles.tabBtnText, { color: tab === 'sent' ? '#fff' : theme.textSecondary }]}>Sent</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          renderItem={renderOffer}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOffers(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="swap-horizontal-outline" size={52} color={theme.textLight} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No {tab} offers</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {tab === 'received' ? 'Offers from other traders will appear here.' : 'Offers you send will appear here.'}
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
  header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: FontSize.sm, marginTop: 2, marginBottom: Spacing.md },
  tabRow: { flexDirection: 'row', borderRadius: BorderRadius.full, padding: 4, alignSelf: 'flex-start' },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: BorderRadius.full },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  list: { padding: Spacing.lg, gap: 14, paddingBottom: 120 },
  card: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  dateText: { fontSize: FontSize.xs },
  swapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  itemThumb: { flex: 1, alignItems: 'center', gap: 6 },
  thumbImg: { width: 70, height: 70, borderRadius: BorderRadius.md },
  thumbTitle: { fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  thumbValue: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  swapCenter: { alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  swapCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cashBadge: { backgroundColor: Colors.success + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  cashBadgeText: { fontSize: 9, color: Colors.success, fontWeight: '800' },
  divider: { height: 1, marginBottom: Spacing.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partyAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  partyAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  partyName: { fontSize: FontSize.xs, fontWeight: '500' },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: Colors.success, borderColor: Colors.success },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: FontSize.sm, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});