import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { Item } from '../types';

const REPORT_REASONS = [
  'Fake listing',
  'Inappropriate content',
  'Scam or fraud',
  'Harassment',
  'Spam',
  'Other',
];

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function StarRating({
  rating, size = 16, interactive = false, onChange,
}: {
  rating: number; size?: number; interactive?: boolean; onChange?: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => interactive && onChange?.(star)}
          disabled={!interactive}
          activeOpacity={interactive ? 0.7 : 1}
        >
          <Ionicons
            name={star <= Math.round(rating) ? 'star' : 'star-outline'}
            size={size}
            color={star <= Math.round(rating) ? '#F59E0B' : '#D1D5DB'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SellerProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sellerId } = route.params;
  const { theme } = useTheme();

  const [seller, setSeller] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasTraded, setHasTraded] = useState(false);
  const [myExistingRating, setMyExistingRating] = useState<any>(null);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => { fetchAll(); }, [sellerId]);

  const fetchAll = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);

      const { data: trades } = await supabase
        .from('offers')
        .select('id')
        .eq('status', 'accepted')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${sellerId}),` +
          `and(sender_id.eq.${sellerId},receiver_id.eq.${user.id})`
        );
      setHasTraded((trades?.length || 0) > 0);

      const { data: existing } = await supabase
        .from('ratings')
        .select('*')
        .eq('reviewer_id', user.id)
        .eq('seller_id', sellerId)
        .single();
      if (existing) {
        setMyExistingRating(existing);
        setRatingStars(existing.stars);
        setRatingFeedback(existing.feedback || '');
      }
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sellerId)
      .single();
    if (prof) setSeller(prof);

    const { data: sellerItems } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', sellerId)
      .eq('status', 'available')
      .order('created_at', { ascending: false });
    if (sellerItems) setItems(sellerItems as Item[]);

    const { data: ratingData } = await supabase
      .from('ratings')
      .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });
    if (ratingData && ratingData.length > 0) {
      setRatings(ratingData);
      const avg = ratingData.reduce((sum: number, r: any) => sum + r.stars, 0) / ratingData.length;
      setAvgRating(avg);
    } else {
      setRatings([]);
      setAvgRating(0);
    }

    setLoading(false);
  };

  const handleSubmitRating = async () => {
    if (!currentUser) return;
    setSubmittingRating(true);
    const payload = {
      reviewer_id: currentUser.id,
      seller_id: sellerId,
      stars: ratingStars,
      feedback: ratingFeedback.trim() || null,
    };
    const { error } = myExistingRating
      ? await supabase.from('ratings').update(payload).eq('id', myExistingRating.id)
      : await supabase.from('ratings').insert(payload);
    setSubmittingRating(false);
    if (error) { Alert.alert('Error', 'Could not submit rating. Please try again.'); return; }
    setShowRatingModal(false);
    Alert.alert('✅ Review Submitted', 'Thank you for your feedback!');
    fetchAll();
  };

  const handleSubmitReport = async () => {
    if (!reportReason) { Alert.alert('Select a reason', 'Please choose a reason for the report.'); return; }
    if (!currentUser) return;
    setSubmittingReport(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: sellerId,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });
    setSubmittingReport(false);
    if (error) { Alert.alert('Error', 'Could not submit report. Please try again.'); return; }
    setShowReportModal(false);
    setReportReason('');
    setReportDetails('');
    Alert.alert('Report Submitted', 'Our team will review this. Thank you.');
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isOwnProfile = currentUser?.id === sellerId;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={[styles.topBar, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: theme.text }]}>Seller Profile</Text>
          {!isOwnProfile ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowReportModal(true)}>
              <Ionicons name="flag-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
          ) : <View style={styles.iconBtn} />}
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface }]}>
          {seller?.avatar_url ? (
            <Image source={{ uri: seller.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: Colors.primary }]}>
              <Text style={styles.avatarInitial}>{(seller?.full_name || 'U')[0].toUpperCase()}</Text>
            </View>
          )}

          <Text style={[styles.sellerName, { color: theme.text }]}>{seller?.full_name}</Text>

          {seller?.address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={13} color={theme.textLight} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>{seller.address}</Text>
            </View>
          ) : null}

          {seller?.created_at ? (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={13} color={theme.textLight} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Member since {new Date(seller.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          ) : null}

          <View style={styles.ratingRow}>
            <StarRating rating={avgRating} size={20} />
            <Text style={[styles.ratingAvg, { color: theme.text }]}>
              {avgRating > 0 ? avgRating.toFixed(1) : 'No ratings yet'}
            </Text>
            {avgRating > 0 && (
              <Text style={[styles.ratingCount, { color: theme.textSecondary }]}>
                ({ratings.length} {ratings.length === 1 ? 'review' : 'reviews'})
              </Text>
            )}
          </View>

          <View style={[styles.statsRow, { backgroundColor: theme.background }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: Colors.primary }]}>{items.length}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Listings</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: Colors.primary }]}>{ratings.length}</Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Reviews</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: Colors.primary }]}>
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </Text>
              <Text style={[styles.statLbl, { color: theme.textSecondary }]}>Avg Rating</Text>
            </View>
          </View>

          {!isOwnProfile && hasTraded && (
            <TouchableOpacity style={styles.rateBtn} onPress={() => setShowRatingModal(true)} activeOpacity={0.85}>
              <Ionicons name="star" size={15} color="#fff" />
              <Text style={styles.rateBtnText}>
                {myExistingRating ? 'Edit Your Review' : 'Rate This Seller'}
              </Text>
            </TouchableOpacity>
          )}

          {!isOwnProfile && !hasTraded && (
            <View style={[styles.tradeNotice, { backgroundColor: theme.background }]}>
              <Ionicons name="information-circle-outline" size={15} color={theme.textLight} />
              <Text style={[styles.tradeNoticeText, { color: theme.textSecondary }]}>
                Complete a trade with this seller to leave a review
              </Text>
            </View>
          )}
        </View>

        {/* Active Listings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Listings</Text>
          {items.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
              <Ionicons name="cube-outline" size={32} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No active listings</Text>
            </View>
          ) : (
            <View style={styles.itemGrid}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, { backgroundColor: theme.surface }]}
                  onPress={() => navigation.navigate('ItemDetail', { item })}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.itemPrice, { color: Colors.primary }]}>₱{item.estimated_value.toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Reviews</Text>
          {ratings.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
              <Ionicons name="star-outline" size={32} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No reviews yet</Text>
            </View>
          ) : (
            ratings.map((r) => (
              <View key={r.id} style={[styles.reviewCard, { backgroundColor: theme.surface }]}>
                <View style={styles.reviewHeader}>
                  {r.reviewer?.avatar_url ? (
                    <Image source={{ uri: r.reviewer.avatar_url }} style={styles.reviewAvatar} />
                  ) : (
                    <View style={[styles.reviewAvatarFallback, { backgroundColor: Colors.primary }]}>
                      <Text style={styles.reviewAvatarText}>{(r.reviewer?.full_name || 'U')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.reviewMeta}>
                    <Text style={[styles.reviewerName, { color: theme.text }]}>{r.reviewer?.full_name}</Text>
                    <StarRating rating={r.stars} size={13} />
                  </View>
                  <Text style={[styles.reviewDate, { color: theme.textLight }]}>
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                {r.feedback ? (
                  <Text style={[styles.reviewText, { color: theme.textSecondary }]}>{r.feedback}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Rating Modal */}
      <Modal visible={showRatingModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowRatingModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Rate Seller</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={[styles.ratingSellerRow, { backgroundColor: theme.surface }]}>
              {seller?.avatar_url ? (
                <Image source={{ uri: seller.avatar_url }} style={styles.reviewAvatar} />
              ) : (
                <View style={[styles.reviewAvatarFallback, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.reviewAvatarText}>{(seller?.full_name || 'U')[0].toUpperCase()}</Text>
                </View>
              )}
              <View>
                <Text style={[styles.ratingSellerName, { color: theme.text }]}>{seller?.full_name}</Text>
                <Text style={[styles.ratingSellerSub, { color: theme.textSecondary }]}>How was trading with them?</Text>
              </View>
            </View>

            <View style={styles.starPickerBox}>
              <StarRating rating={ratingStars} size={44} interactive onChange={setRatingStars} />
              <Text style={[styles.starLabel, { color: Colors.primary }]}>{STAR_LABELS[ratingStars]}</Text>
            </View>

            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Leave a comment <Text style={{ color: theme.textLight }}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Share your experience with this seller..."
              placeholderTextColor={theme.textLight}
              value={ratingFeedback}
              onChangeText={setRatingFeedback}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, submittingRating && styles.btnDisabled]}
              onPress={handleSubmitRating}
              disabled={submittingRating}
            >
              {submittingRating
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>{myExistingRating ? 'Update Review' : 'Submit Review'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowReportModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Report User</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.reportPrompt, { color: theme.text }]}>
              Why are you reporting <Text style={{ fontWeight: '800' }}>{seller?.full_name}</Text>?
            </Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonRow,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  reportReason === reason && { borderColor: Colors.error, backgroundColor: Colors.error + '10' },
                ]}
                onPress={() => setReportReason(reason)}
                activeOpacity={0.7}
              >
                <View style={[styles.radioCircle, { borderColor: reportReason === reason ? Colors.error : theme.border }]}>
                  {reportReason === reason && <View style={[styles.radioFill, { backgroundColor: Colors.error }]} />}
                </View>
                <Text style={[styles.reasonText, { color: reportReason === reason ? Colors.error : theme.text }]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.inputLabel, { color: theme.text, marginTop: Spacing.md }]}>
              Additional details <Text style={{ color: theme.textLight }}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Describe what happened..."
              placeholderTextColor={theme.textLight}
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.dangerBtn, submittingReport && styles.btnDisabled]}
              onPress={handleSubmitReport}
              disabled={submittingReport}
            >
              {submittingReport
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Submit Report</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  topBarTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  profileCard: { alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.xl, marginBottom: 4 },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: Spacing.md },
  avatarFallback: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#fff' },
  sellerName: { fontSize: FontSize.xl, fontWeight: '800', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  infoText: { fontSize: FontSize.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.md },
  ratingAvg: { fontSize: FontSize.md, fontWeight: '800' },
  ratingCount: { fontSize: FontSize.xs },
  statsRow: { flexDirection: 'row', borderRadius: BorderRadius.xl, padding: Spacing.md, alignSelf: 'stretch', justifyContent: 'space-around', marginBottom: Spacing.md },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: FontSize.xl, fontWeight: '800' },
  statLbl: { fontSize: FontSize.xs, marginTop: 2 },
  statDivider: { width: 1, height: '60%', alignSelf: 'center' },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.full, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  rateBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  tradeNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, marginTop: 4 },
  tradeNoticeText: { fontSize: FontSize.xs },
  section: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: Spacing.md },
  itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  itemCard: { width: '47%', borderRadius: BorderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  itemImage: { width: '100%', height: 110 },
  itemInfo: { padding: 8 },
  itemTitle: { fontSize: FontSize.xs, fontWeight: '700', marginBottom: 2 },
  itemPrice: { fontSize: FontSize.xs, fontWeight: '800' },
  emptyCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: FontSize.sm },
  reviewCard: { borderRadius: BorderRadius.xl, padding: Spacing.md, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewAvatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.xs },
  reviewMeta: { flex: 1, gap: 2 },
  reviewerName: { fontSize: FontSize.sm, fontWeight: '700' },
  reviewDate: { fontSize: FontSize.xs },
  reviewText: { fontSize: FontSize.sm, lineHeight: 20 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 56 : 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg, paddingBottom: 48 },
  ratingSellerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
  ratingSellerName: { fontSize: FontSize.md, fontWeight: '700' },
  ratingSellerSub: { fontSize: FontSize.xs, marginTop: 2 },
  starPickerBox: { alignItems: 'center', gap: 10, marginBottom: Spacing.xl },
  starLabel: { fontSize: FontSize.lg, fontWeight: '800' },
  reportPrompt: { fontSize: FontSize.md, fontWeight: '600', marginBottom: Spacing.md },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: BorderRadius.md, borderWidth: 1.5, padding: Spacing.md, marginBottom: 8 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  inputLabel: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 8 },
  textArea: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, fontSize: FontSize.sm, minHeight: 100, marginBottom: Spacing.lg },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  dangerBtn: { backgroundColor: Colors.error, borderRadius: BorderRadius.md, padding: 15, alignItems: 'center', marginTop: Spacing.sm },
  btnDisabled: { opacity: 0.6 },
});