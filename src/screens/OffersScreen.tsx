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

type Tab = 'received' | 'sent';
const statusColor: Record<string, string> = { pending: Colors.warning, accepted: Colors.success, declined: Colors.error, cancelled: Colors.textLight };

export default function OffersScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('received');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); }); }, []);

  const fetchOffers = useCallback(async () => {
    if (!userId) return;
    const field = tab === 'received' ? 'receiver_id' : 'sender_id';
    const { data, error } = await supabase.from('offers').select(`*, offered_item:items!offered_item_id(id, title, image_url, estimated_value), requested_item:items!requested_item_id(id, title, image_url, estimated_value), sender:profiles!sender_id(id, full_name), receiver:profiles!receiver_id(id, full_name)`).eq(field, userId).order('created_at', { ascending: false });
    if (!error && data) setOffers(data as Offer[]);
    setLoading(false); setRefreshing(false);
  }, [userId, tab]);

  useEffect(() => { if (userId) fetchOffers(); }, [userId, fetchOffers]);

  const updateOfferStatus = async (offerId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase.from('offers').update({ status }).eq('id', offerId);
    if (error) { Alert.alert('Error', 'Could not update offer.'); return; }
    if (status === 'accepted') {
      const offer = offers.find(o => o.id === offerId);
      if (offer) {
        await supabase.from('items').update({ status: 'pending' }).eq('id', offer.offered_item_id);
        await supabase.from('items').update({ status: 'pending' }).eq('id', offer.requested_item_id);
      }
    }
    fetchOffers();
  };

  const renderOffer = ({ item: offer }: { item: Offer }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor[offer.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor[offer.status] }]} />
          <Text style={[styles.statusText, { color: statusColor[offer.status] }]}>{offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}</Text>
        </View>
        <Text style={styles.dateText}>{new Date(offer.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.swapRow}>
        <View style={styles.itemThumb}>
          <Image source={{ uri: offer.offered_item?.image_url || 'https://via.placeholder.com/60' }} style={styles.thumbImage} />
          <Text style={styles.thumbTitle} numberOfLines={1}>{offer.offered_item?.title}</Text>
          <Text style={styles.thumbValue}>₱{offer.offered_item?.estimated_value?.toLocaleString()}</Text>
        </View>
        <View style={styles.swapIcon}>
          <Ionicons name="swap-horizontal" size={24} color={Colors.primary} />
          {offer.cash_addition > 0 && <Text style={styles.cashText}>+₱{offer.cash_addition.toLocaleString()}</Text>}
        </View>
        <View style={styles.itemThumb}>
          <Image source={{ uri: offer.requested_item?.image_url || 'https://via.placeholder.com/60' }} style={styles.thumbImage} />
          <Text style={styles.thumbTitle} numberOfLines={1}>{offer.requested_item?.title}</Text>
          <Text style={styles.thumbValue}>₱{offer.requested_item?.estimated_value?.toLocaleString()}</Text>
        </View>
      </View>
      <Text style={styles.partyText}>{tab === 'received' ? `From: ${offer.sender?.full_name}` : `To: ${offer.receiver?.full_name}`}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.msgBtn} onPress={() => navigation.navigate('Chat', { offer })}>
          <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
          <Text style={styles.msgBtnText}>Message</Text>
        </TouchableOpacity>
        {tab === 'received' && offer.status === 'pending' && (
          <>
            <TouchableOpacity style={styles.declineBtn} onPress={() => Alert.alert('Decline Offer', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Decline', style: 'destructive', onPress: () => updateOfferStatus(offer.id, 'declined') }])}>
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => Alert.alert('Accept Offer', 'Accept this trade?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Accept', onPress: () => updateOfferStatus(offer.id, 'accepted') }])}>
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Offers</Text>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'received' && styles.tabActive]} onPress={() => setTab('received')}><Text style={[styles.tabText, tab === 'received' && styles.tabTextActive]}>Received</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'sent' && styles.tabActive]} onPress={() => setTab('sent')}><Text style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}>Sent</Text></TouchableOpacity>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View> : (
        <FlatList data={offers} keyExtractor={(o) => o.id} renderItem={renderOffer} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOffers(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="swap-horizontal-outline" size={48} color={Colors.textLight} /><Text style={styles.emptyText}>No {tab} offers yet</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md, backgroundColor: Colors.white },
  tabs: { flexDirection: 'row', backgroundColor: Colors.white, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.borderLight },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  list: { padding: Spacing.lg, gap: 16 },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  dateText: { fontSize: FontSize.xs, color: Colors.textLight },
  swapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  itemThumb: { flex: 1, alignItems: 'center' },
  thumbImage: { width: 60, height: 60, borderRadius: BorderRadius.sm, marginBottom: 4 },
  thumbTitle: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  thumbValue: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  swapIcon: { alignItems: 'center', paddingHorizontal: 8 },
  cashText: { fontSize: FontSize.xs, color: Colors.secondary, fontWeight: '700', marginTop: 2 },
  partyText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  msgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.primary },
  msgBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  declineBtn: { flex: 1, alignItems: 'center', padding: 8, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.error },
  declineBtnText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  acceptBtn: { flex: 1, alignItems: 'center', padding: 8, borderRadius: BorderRadius.sm, backgroundColor: Colors.success },
  acceptBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, marginTop: 12 },
});
