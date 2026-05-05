import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUser(user);
        supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'available')
          .then(({ data }) => { if (data) setMyItems(data); });
      }
    });
  }, []);

  const handleMessageSeller = async () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to message the seller.');
      return;
    }

    // Create a unique conversation ID between the two users for this item
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
    if (!selectedItem) {
      Alert.alert('Select an item', 'Please choose an item to offer.');
      return;
    }
    if (!currentUser) return;

    setSending(true);
    const { data: offer, error } = await supabase.from('offers').insert({
      sender_id: currentUser.id,
      receiver_id: item.user_id,
      offered_item_id: selectedItem.id,
      requested_item_id: item.id,
      cash_addition: parseFloat(cashAddition) || 0,
      status: 'pending',
    }).select().single();
    setSending(false);

    if (error) {
      Alert.alert('Error', 'Could not send offer. Please try again.');
      return;
    }

    setShowOfferModal(false);
    Alert.alert('Offer Sent!', 'Your trade offer has been sent.', [
      { text: 'View Offers', onPress: () => navigation.navigate('Offers') },
      { text: 'OK' },
    ]);
  };

  const isOwnItem = currentUser?.id === item.user_id;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isOwnItem ? 20 : 120 }}
      >
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/400x300?text=No+Image' }}
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={[styles.content, { backgroundColor: theme.surface }]}>
          <View style={styles.topRow}>
            <View style={[styles.categoryBadge, { backgroundColor: theme.borderLight }]}>
              <Text style={[styles.categoryText, { color: theme.textSecondary }]}>{item.category}</Text>
            </View>
            <View style={styles.valueBadge}>
              <Text style={styles.valueText}>₱{item.estimated_value.toLocaleString()}</Text>
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>

          <View style={styles.ownerRow}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarText}>{(item.user?.full_name || 'U')[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.ownerName, { color: theme.text }]}>{item.user?.full_name || 'Unknown'}</Text>
              <Text style={[styles.ownerSub, { color: theme.textSecondary }]}>Seller</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Description</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{item.description}</Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: item.status === 'available' ? Colors.success : Colors.warning }]} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Extra padding for bottom bar */}
       </ScrollView>

      {/* Bottom Action Buttons — fixed outside ScrollView */}
      {!isOwnItem && item.status === 'available' && (
        <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {/* Message Seller */}
          <TouchableOpacity
            style={[styles.msgBtn, { borderColor: Colors.primary }]}
            onPress={handleMessageSeller}
          >
            <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
            <Text style={styles.msgBtnText}>Message</Text>
          </TouchableOpacity>

          {/* Send Trade Offer */}
          <TouchableOpacity
            style={styles.offerBtn}
            onPress={() => setShowOfferModal(true)}
          >
            <Ionicons name="swap-horizontal" size={18} color={Colors.white} />
            <Text style={styles.offerBtnText}>Trade Offer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trade Offer Modal */}
      <Modal visible={showOfferModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Make an Offer</Text>
            <TouchableOpacity onPress={() => setShowOfferModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Choose an item to offer</Text>

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
                    <Text style={styles.myItemValue}>₱{myItem.estimated_value.toLocaleString()}</Text>
                  </View>
                  {selectedItem?.id === myItem.id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.modalSectionTitle, { color: theme.text }]}>Add Cash (Optional)</Text>
            <View style={[styles.cashInput, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
          </ScrollView>

          <View style={[styles.modalFooter, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.sendBtn, (sending || !selectedItem) && styles.sendBtnDisabled]}
              onPress={handleSendOffer}
              disabled={sending || !selectedItem}
            >
              {sending
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.sendBtnText}>Send Offer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 300 },
  backBtn: {
    position: 'absolute', top: 48, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  content: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -20, padding: Spacing.lg,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  categoryText: { fontSize: FontSize.xs, fontWeight: '600' },
  valueBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  valueText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  title: { fontSize: FontSize.xxl, fontWeight: '800', marginBottom: Spacing.sm },
  ownerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: 10 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  ownerName: { fontSize: FontSize.sm, fontWeight: '700' },
  ownerSub: { fontSize: FontSize.xs },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: FontSize.sm, lineHeight: 22, marginBottom: Spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: FontSize.sm, fontWeight: '500' },

  // Bottom bar with 2 buttons
  bottomBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 32 : Spacing.md,
    borderTopWidth: 1,
    gap: 10,
  },
  msgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  msgBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '700' },
  offerBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
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

// Fix missing Platform import
import { Platform } from 'react-native';