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
  pending:   { color: Colors.warning,   icon: 'time-outline',             label: 'Pending' },
  accepted:  { color: Colors.success,   icon: 'checkmark-circle-outline', label: 'Accepted' },
  declined:  { color: Colors.error,     icon: 'close-circle-outline',     label: 'Declined' },
  cancelled: { color: Colors.textLight, icon: 'ban-outline',              label: 'Cancelled' },
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchOffers = useCallback(async () => {
    if (!userId) return;
    const field = tab === 'received' ? 'receiver_id' : 'sender_id';
    const deletedField = tab === 'received' ? 'deleted_by_receiver' : 'deleted_by_sender';

    const { data, error } = await supabase
      .from('offers')
      .select(`
        *,
        offered_item:items!offered_item_id(id, title, image_url, estimated_value),
        requested_item:items!requested_item_id(id, title, image_url, estimated_value),
        sender:profiles!sender_id(id, full_name, avatar_url),
        receiver:profiles!receiver_id(id, full_name, avatar_url)
      `)
      .eq(field, userId)
      .eq(deletedField, false)
      .order('created_at', { ascending: false });

    if (!error && data) setOffers(data as Offer[]);
    setLoading(false);
    setRefreshing(false);
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

  const handleDelete = async (offerId: string) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer) return;

    Alert.alert(
      'Leave Conversation',
      'You will no longer be able to send messages. The other user will see that you left.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const iAmSender = offer.sender_id === userId;
            const updateField = iAmSender
              ? { deleted_by_sender: true }
              : { deleted_by_receiver: true };

            await supabase
              .from('offers')
              .update(updateField)
              .eq('id', offerId);

            setOffers(prev => prev.filter(o => o.id !== offerId));
          },
        },
      ],
    );
  };

  const renderOffer = ({ item: offer }: { item: Offer }) => {
    const sc = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending;
    const iAmSender = offer.sender_id === userId;
    const otherParty = iAmSender ? offer.receiver : offer.sender;
    const partyLabel = tab === 'received' ? `From ${offer.sender?.full_name}` : `To ${offer.receiver?.full_name}`;
    const otherPartyId = iAmSender ? offer.receiver_id : offer.sender_id;

    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>

        {/* Top row: avatar + name + status + date */}
        <View style={styles.cardTop}>
          <TouchableOpacity
            onPress={() => navigation.navigate('SellerProfile', { sellerId: otherPartyId })}
            activeOpacity={0.8}
          >
            {(otherParty as any)?.avatar_url ? (
              <Image
                source={{ uri: (otherParty as any).avatar_url }}
                style={styles.partyAvatarImg}
              />
            ) : (
              <View style={styles.partyAvatar}>
                <Text style={styles.partyAvatarText}>
                  {(otherParty?.full_name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.partyInfo}>
            <Text style={[styles.partyName, { color: theme.text }]} numberOfLines={1}>
              {partyLabel}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: sc.color + '18' }]}>
              <Ionicons name={sc.icon as any} size={10} color={sc.color} />
              <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>

          <Text style={[styles.dateText, { color: theme.textLight }]}>
            {new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Compact swap row */}
        <View style={styles.swapRow}>
          <Image
            source={{ uri: offer.offered_item?.image_url || 'https://via.placeholder.com/50' }}
            style={styles.thumbImg}
          />
          <View style={styles.swapMid}>
            <Text style={[styles.thumbTitle, { color: theme.text }]} numberOfLines={1}>
              {offer.offered_item?.title}
            </Text>
            <View style={styles.swapArrowRow}>
              <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
              {offer.cash_addition > 0 && (
                <View style={styles.cashBadge}>
                  <Text style={styles.cashBadgeText}>+₱{offer.cash_addition.toLocaleString()}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.thumbTitle, { color: theme.text }]} numberOfLines={1}>
              {offer.requested_item?.title}
            </Text>
          </View>
          <Image
            source={{ uri: offer.requested_item?.image_url || 'https://via.placeholder.com/50' }}
            style={styles.thumbImg}
          />
        </View>

        {/* Actions row */}
        <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.primaryLight }]}
            onPress={() => navigation.navigate('Chat', { offer })}
          >
            <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Chat</Text>
          </TouchableOpacity>

          {tab === 'received' && offer.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.error + '15' }]}
                onPress={() => Alert.alert('Decline', 'Decline this offer?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Decline', style: 'destructive', onPress: () => updateOfferStatus(offer.id, 'declined') },
                ])}
              >
                <Ionicons name="close" size={14} color={Colors.error} />
                <Text style={[styles.actionBtnText, { color: Colors.error }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.success + '18' }]}
                onPress={() => Alert.alert('Accept', 'Accept this trade offer?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Accept', onPress: () => updateOfferStatus(offer.id, 'accepted') },
                ])}
              >
                <Ionicons name="checkmark" size={14} color={Colors.success} />
                <Text style={[styles.actionBtnText, { color: Colors.success }]}>Accept</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Spacer to push trash to right */}
          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.background }]}
            onPress={() => handleDelete(offer.id)}
          >
            <Ionicons name="exit-outline" size={14} color={theme.textLight} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        <View style={[styles.tabRow, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'received' && styles.tabBtnActive]}
            onPress={() => setTab('received')}
          >
            <Text style={[styles.tabBtnText, { color: tab === 'received' ? '#fff' : theme.textSecondary }]}>
              Received
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]}
            onPress={() => setTab('sent')}
          >
            <Text style={[styles.tabBtnText, { color: tab === 'sent' ? '#fff' : theme.textSecondary }]}>
              Sent
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          renderItem={renderOffer}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOffers(); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="swap-horizontal-outline" size={48} color={theme.textLight} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No {tab} offers</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {tab === 'received'
                  ? 'Offers from other traders will appear here.'
                  : 'Offers you send will appear here.'}
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
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.3, marginBottom: Spacing.md },
  tabRow: { flexDirection: 'row', borderRadius: BorderRadius.full, padding: 4, alignSelf: 'flex-start' },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: BorderRadius.full },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  list: { padding: Spacing.lg, gap: 10, paddingBottom: 120 },
  card: { borderRadius: BorderRadius.xl, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
  partyAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  partyAvatarImg: { width: 38, height: 38, borderRadius: 19, flexShrink: 0 },
  partyAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  partyInfo: { flex: 1, gap: 3 },
  partyName: { fontSize: FontSize.sm, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  dateText: { fontSize: FontSize.xs, flexShrink: 0 },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
  thumbImg: { width: 48, height: 48, borderRadius: BorderRadius.md, flexShrink: 0 },
  swapMid: { flex: 1, gap: 3 },
  thumbTitle: { fontSize: FontSize.xs, fontWeight: '600' },
  swapArrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cashBadge: { backgroundColor: Colors.success + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full },
  cashBadgeText: { fontSize: 9, color: Colors.success, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 6, borderTopWidth: 1, paddingTop: Spacing.sm, marginTop: 4, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full },
  actionBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: FontSize.sm, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});