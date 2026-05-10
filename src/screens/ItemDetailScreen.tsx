import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

// Condition color helper
function getConditionColor(condition: string): string {
  const map: Record<string, string> = {
    'Brand New': '#10B981',
    'Like New':  '#3B82F6',
    'Good':      '#6366F1',
    'Fair':      '#F59E0B',
    'Poor':      '#EF4444',
  };
  return map[condition] || '#6366F1';
}

// Simple geocoder using OpenStreetMap Nominatim (free, no API key)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'User-Agent': 'SwapifyApp/1.0' } },
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

export default function ItemDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { item }: { item: Item } = route.params;
  const { theme } = useTheme();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [cashAddition, setCashAddition] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sellerAddress, setSellerAddress] = useState<string | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchSellerLocation();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      const { data } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'available');
      if (data) setMyItems(data);
    }
  };

  const fetchSellerLocation = async () => {
    if (!item.user_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('address')
      .eq('id', item.user_id)
      .single();

    if (data?.address) {
      setSellerAddress(data.address);
      setGeocoding(true);
      const coords = await geocodeAddress(data.address);
      setGeocoding(false);
      if (coords) setMapCoords(coords);
    }
  };

  const handleMessageSeller = async () => {
    if (!currentUser) { Alert.alert('Login Required', 'Please log in to message the seller.'); return; }
    const conversationId = [currentUser.id, item.user_id].sort().join('_') + `_item_${item.id}`;
    navigation.navigate('Chat', {
      conversationId,
      otherUserId: item.user_id,
      otherUserName: item.user?.full_name || 'Seller',
      itemId: item.id,
      itemTitle: item.title,
      currentUserId: currentUser.id,
    });
  };

  const handleSendOffer = async () => {
    if (!selectedItem) { Alert.alert('Select an item', 'Please choose an item to offer.'); return; }
    if (!currentUser) return;
    setSending(true);
    const { error } = await supabase.from('offers').insert({
      sender_id: currentUser.id,
      receiver_id: item.user_id,
      offered_item_id: selectedItem.id,
      requested_item_id: item.id,
      cash_addition: parseFloat(cashAddition) || 0,
      status: 'pending',
    });
    setSending(false);
    if (error) { Alert.alert('Error', 'Could not send offer. Please try again.'); return; }
    setShowOfferModal(false);
    Alert.alert('Offer Sent!', 'Your trade offer has been sent.', [
      { text: 'View Offers', onPress: () => navigation.navigate('Offers') },
      { text: 'OK' },
    ]);
  };

  const openInMaps = () => {
    if (!mapCoords) return;
    const url = `https://maps.google.com/?q=${mapCoords.lat},${mapCoords.lng}`;
    Linking.openURL(url);
  };

  const isOwnItem = currentUser?.id === item.user_id;
  const conditionColor = getConditionColor(item.condition || 'Good');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/400x300?text=No+Image' }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          {/* Category pill on image */}
          <View style={[styles.categoryOverlay, { backgroundColor: theme.surface }]}>
            <Text style={[styles.categoryOverlayText, { color: theme.textSecondary }]}>
              {item.category}
            </Text>
          </View>
        </View>

        {/* Content card */}
        <View style={[styles.contentCard, { backgroundColor: theme.surface }]}>

          {/* Price + condition row */}
          <View style={styles.topRow}>
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>₱{item.estimated_value.toLocaleString()}</Text>
            </View>
            <View style={[styles.conditionBadge, { backgroundColor: conditionColor + '18' }]}>
              <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
              <Text style={[styles.conditionText, { color: conditionColor }]}>
                {item.condition || 'Good'}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>

          {/* Seller row — tappable to view seller profile */}
<TouchableOpacity
  style={[styles.sellerRow, { backgroundColor: theme.background }]}
  onPress={() => navigation.navigate('SellerProfile', { sellerId: item.user_id })}
  activeOpacity={0.8}
>
  {item.user?.avatar_url ? (
    <Image
      source={{ uri: item.user.avatar_url }}
      style={styles.sellerAvatarImg}
    />
  ) : (
    <View style={styles.sellerAvatar}>
      <Text style={styles.sellerAvatarText}>
        {(item.user?.full_name || 'U')[0].toUpperCase()}
      </Text>
    </View>
  )}
  <View style={styles.sellerInfo}>
    <Text style={[styles.sellerName, { color: theme.text }]}>
      {item.user?.full_name || 'Unknown'}
    </Text>
    <Text style={[styles.sellerLabel, { color: theme.textSecondary }]}>
      Tap to view seller profile
    </Text>
  </View>
  <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
</TouchableOpacity>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Description */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {item.description}
          </Text>

          {/* Status */}
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot,
              { backgroundColor: item.status === 'available' ? Colors.success : Colors.warning },
            ]} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Seller Location */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Seller Location</Text>

          {sellerAddress ? (
            <View>
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
                <Text style={[styles.addressText, { color: theme.textSecondary }]}>
                  {sellerAddress}
                </Text>
              </View>

              {/* Map */}
              {geocoding ? (
                <View style={[styles.mapPlaceholder, { backgroundColor: theme.background }]}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={[styles.mapLoadingText, { color: theme.textSecondary }]}>
                    Loading map...
                  </Text>
                </View>
              ) : mapCoords ? (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={openInMaps}
                  style={styles.mapWrapper}
                >
                  <MapView
                    provider={PROVIDER_DEFAULT}
                    style={styles.map}
                    initialRegion={{
                      latitude: mapCoords.lat,
                      longitude: mapCoords.lng,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Marker
                      coordinate={{ latitude: mapCoords.lat, longitude: mapCoords.lng }}
                      title={item.user?.full_name || 'Seller'}
                      description={sellerAddress}
                    />
                  </MapView>
                  {/* Tap overlay */}
                  <View style={styles.mapOverlay}>
                    <View style={styles.mapOverlayChip}>
                      <Ionicons name="navigate-outline" size={14} color="#fff" />
                      <Text style={styles.mapOverlayText}>Open in Maps</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.mapPlaceholder, { backgroundColor: theme.background }]}>
                  <Ionicons name="map-outline" size={32} color={theme.textLight} />
                  <Text style={[styles.mapLoadingText, { color: theme.textSecondary }]}>
                    Could not load map for this address
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.mapPlaceholder, { backgroundColor: theme.background }]}>
              <Ionicons name="location-outline" size={32} color={theme.textLight} />
              <Text style={[styles.mapLoadingText, { color: theme.textSecondary }]}>
                Seller has not set a location
              </Text>
            </View>
          )}

          <View style={{ height: 16 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      {!isOwnItem && item.status === 'available' && (
        <View style={[styles.bottomBar, {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        }]}>
          <TouchableOpacity
            style={styles.offerBtn}
            onPress={() => setShowOfferModal(true)}
          >
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
            <Text style={styles.offerBtnText}>Send Trade Offer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trade Offer Modal */}
      <Modal visible={showOfferModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Make an Offer</Text>
            <TouchableOpacity onPress={() => setShowOfferModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Text style={[styles.modalSectionTitle, { color: theme.text }]}>
              Choose an item to offer
            </Text>

            {myItems.length === 0 ? (
              <View style={styles.noItems}>
                <Ionicons name="cube-outline" size={36} color={theme.textLight} />
                <Text style={[styles.noItemsText, { color: theme.textSecondary }]}>
                  You have no available items to trade.
                </Text>
                <TouchableOpacity
                  onPress={() => { setShowOfferModal(false); navigation.navigate('AddItem'); }}
                  style={styles.addItemBtn}
                >
                  <Text style={styles.addItemBtnText}>Add an Item</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myItems.map((myItem) => (
                <TouchableOpacity
                  key={myItem.id}
                  style={[
                    styles.myItemCard,
                    { backgroundColor: theme.card },
                    selectedItem?.id === myItem.id && styles.myItemCardSelected,
                  ]}
                  onPress={() => setSelectedItem(myItem)}
                >
                  <Image
                    source={{ uri: myItem.image_url || 'https://via.placeholder.com/80x80' }}
                    style={styles.myItemImage}
                  />
                  <View style={styles.myItemInfo}>
                    <Text style={[styles.myItemTitle, { color: theme.text }]}>{myItem.title}</Text>
                    <Text style={styles.myItemValue}>
                      ₱{myItem.estimated_value.toLocaleString()}
                    </Text>
                  </View>
                  {selectedItem?.id === myItem.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.modalSectionTitle, { color: theme.text }]}>
              Add Cash (Optional)
            </Text>
            <View style={[styles.cashInput, {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }]}>
              <Text style={[styles.cashPrefix, { color: theme.textSecondary }]}>₱</Text>
              <TextInput
                style={[styles.cashField, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.textLight}
                keyboardType="numeric"
                value={cashAddition}
                onChangeText={setCashAddition}
              />
            </View>
            <Text style={[styles.cashHint, { color: theme.textLight }]}>
              Add cash to balance the value difference.
            </Text>
            <View style={{ height: 32 }} />
          </ScrollView>

          <View style={[styles.modalFooter, {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          }]}>
            <TouchableOpacity
              style={[styles.sendBtn, (sending || !selectedItem) && styles.sendBtnDisabled]}
              onPress={handleSendOffer}
              disabled={sending || !selectedItem}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.sendBtnText}>Send Offer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  sellerAvatarImg: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 300 },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 20, left: 16,
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  categoryOverlay: {
    position: 'absolute', bottom: 16, left: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  categoryOverlayText: { fontSize: FontSize.xs, fontWeight: '700' },
  contentCard: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20, padding: Spacing.lg,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  priceBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full },
  priceText: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary },
  conditionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  conditionDot: { width: 7, height: 7, borderRadius: 4 },
  conditionText: { fontSize: FontSize.xs, fontWeight: '700' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', marginBottom: Spacing.md, letterSpacing: -0.3 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: 12, gap: 10, marginBottom: Spacing.md },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sellerAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: FontSize.sm, fontWeight: '700' },
  sellerLabel: { fontSize: FontSize.xs },
  msgChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full },
  msgChipText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700' },
  divider: { height: 1, marginVertical: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: FontSize.sm, lineHeight: 22, marginBottom: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.sm, fontWeight: '500' },

  // Location & Map
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 },
  addressText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  mapWrapper: { borderRadius: BorderRadius.xl, overflow: 'hidden', height: 180, position: 'relative' },
  map: { width: '100%', height: '100%' },
  mapOverlay: { position: 'absolute', bottom: 10, right: 10 },
  mapOverlayChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full },
  mapOverlayText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  mapPlaceholder: { height: 120, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapLoadingText: { fontSize: FontSize.sm, textAlign: 'center' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    borderTopWidth: 1, gap: 10,
  },
  msgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  msgBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  offerBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  offerBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // Modal
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, paddingTop: 56 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800' },
  modalScroll: { flex: 1, padding: Spacing.lg },
  modalSectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  noItems: { alignItems: 'center', paddingVertical: 32 },
  noItemsText: { fontSize: FontSize.sm, marginTop: 8, textAlign: 'center' },
  addItemBtn: { marginTop: 12, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md },
  addItemBtnText: { color: '#fff', fontWeight: '700' },
  myItemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 2, borderColor: 'transparent' },
  myItemCardSelected: { borderColor: Colors.primary },
  myItemImage: { width: 60, height: 60, borderRadius: BorderRadius.sm, marginRight: 12 },
  myItemInfo: { flex: 1 },
  myItemTitle: { fontSize: FontSize.md, fontWeight: '600' },
  myItemValue: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 2 },
  cashInput: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md },
  cashPrefix: { fontSize: FontSize.lg, fontWeight: '600', marginRight: 4 },
  cashField: { flex: 1, padding: Spacing.md, fontSize: FontSize.lg },
  cashHint: { fontSize: FontSize.xs, marginTop: 6 },
  modalFooter: { padding: Spacing.lg, paddingBottom: 32, borderTopWidth: 1 },
  sendBtn: { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});