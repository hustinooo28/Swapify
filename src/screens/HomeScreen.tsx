import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, TextInput, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

const CATEGORIES = [
  { label: 'All',         icon: 'apps-outline' },
  { label: 'Electronics', icon: 'phone-portrait-outline' },
  { label: 'Clothing',    icon: 'shirt-outline' },
  { label: 'Books',       icon: 'book-outline' },
  { label: 'Sports',      icon: 'football-outline' },
  { label: 'Home',        icon: 'home-outline' },
  { label: 'Other',       icon: 'grid-outline' },
] as const;

const CATEGORY_COLORS = [
  '#3B82F6', '#F59E0B', '#EF4444', '#06B6D4',
  '#10B981', '#8B5CF6', '#6B7280',
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('full_name').eq('id', user.id).single()
          .then(({ data }) => { if (data) setProfile(data); });
      }
    });
  }, []);

  const fetchItems = useCallback(async () => {
    let query = supabase
      .from('items')
      .select('*, user:profiles(id, full_name, avatar_url)')
      .eq('status', 'available')
      .order('created_at', { ascending: false });
    if (selectedCategory !== 'All') query = query.eq('category', selectedCategory);
    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);
    const { data, error } = await query;
    if (!error && data) setItems(data as Item[]);
    setLoading(false);
    setRefreshing(false);
  }, [search, selectedCategory]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('ItemDetail', { item })}
      activeOpacity={0.88}
    >
      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/300x200?text=No+Image' }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={[styles.cardBadge, { backgroundColor: theme.background }]}>
        <Text style={[styles.cardBadgeText, { color: Colors.primary }]}>
          ₱{item.estimated_value.toLocaleString()}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.listerRow}>
            <View style={styles.avatarTiny}>
              <Text style={styles.avatarTinyText}>
                {(item.user?.full_name || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.listerName, { color: theme.textSecondary }]}>
              {item.user?.full_name || 'Unknown'}
            </Text>
          </View>
          <View style={styles.swapChip}>
            <Ionicons name="swap-horizontal" size={11} color={Colors.primary} />
            <Text style={styles.swapChipText}>{item.category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchItems(); }}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* ── Header ── */}
            <View style={[styles.header, { backgroundColor: theme.surface }]}>
              <View style={styles.headerTop}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerAvatar}>
                    <Text style={styles.headerAvatarText}>
                      {firstName[0].toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.hiText, { color: theme.textSecondary }]}>
                      Hi, {firstName} 👋
                    </Text>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>
                      Discover Trades
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.notifBtn, { backgroundColor: theme.background }]}
                  onPress={() => navigation.navigate('Offers')}
                >
                  <Ionicons name="swap-horizontal-outline" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={18} color={theme.textLight} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search items to trade..."
                  placeholderTextColor={theme.textLight}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  onSubmitEditing={fetchItems}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={18} color={theme.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Category Icons ── */}
            <View style={[styles.categoriesWrapper, { backgroundColor: theme.surface }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                {CATEGORIES.map((cat, index) => (
                  <TouchableOpacity
                    key={cat.label}
                    style={styles.catItem}
                    onPress={() => setSelectedCategory(cat.label)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.catIconBox,
                      {
                        backgroundColor: selectedCategory === cat.label
                          ? CATEGORY_COLORS[index] + '20'
                          : theme.background,
                        borderWidth: selectedCategory === cat.label ? 1.5 : 0,
                        borderColor: selectedCategory === cat.label
                          ? CATEGORY_COLORS[index]
                          : 'transparent',
                      }
                    ]}>
                      <Ionicons
                        name={cat.icon as any}
                        size={24}
                        color={selectedCategory === cat.label
                          ? CATEGORY_COLORS[index]
                          : theme.textSecondary}
                      />
                    </View>
                    <Text style={[
                      styles.catLabel,
                      {
                        color: selectedCategory === cat.label
                          ? CATEGORY_COLORS[index]
                          : theme.textSecondary,
                        fontWeight: selectedCategory === cat.label ? '700' : '500',
                      }
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ── Banner ── */}
            <TouchableOpacity
              style={[styles.banner, { backgroundColor: isDark ? '#1E3A5F' : '#EBF4FF' }]}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('AddItem')}
            >
              <View style={styles.bannerLeft}>
                <Text style={[styles.bannerTitle, { color: isDark ? '#fff' : Colors.text }]}>
                  Got something{'\n'}to trade?
                </Text>
                <Text style={[styles.bannerSub, { color: isDark ? '#94A3B8' : Colors.textSecondary }]}>
                  List it in seconds
                </Text>
                <View style={styles.bannerBtn}>
                  <Text style={styles.bannerBtnText}>List Now</Text>
                </View>
              </View>
              <View style={styles.bannerRight}>
                <View style={styles.bannerIconCircle}>
                  <Ionicons name="swap-horizontal" size={36} color={Colors.primary} />
                </View>
              </View>
            </TouchableOpacity>

            {/* ── Section Title ── */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {selectedCategory === 'All' ? 'All Listings' : selectedCategory}
              </Text>
              <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
                {items.length} items
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No items found</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Try a different category or search term
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  hiText: { fontSize: FontSize.xs, fontWeight: '500' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', letterSpacing: -0.3 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: FontSize.sm },

  // Categories
  categoriesWrapper: { paddingVertical: Spacing.md, borderBottomWidth: 0 },
  categoriesScroll: { paddingHorizontal: Spacing.lg, gap: 12 },
  catItem: { alignItems: 'center', gap: 6 },
  catIconBox: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: FontSize.xs, textAlign: 'center' },

  // Banner
  banner: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  bannerLeft: { flex: 1 },
  bannerTitle: { fontSize: FontSize.xl, fontWeight: '800', lineHeight: 26, marginBottom: 4 },
  bannerSub: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  bannerBtn: { backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full },
  bannerBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  bannerRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: Spacing.md },
  bannerIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  sectionCount: { fontSize: FontSize.sm },

  // Grid cards
  listContent: { paddingBottom: 32 },
  row: { paddingHorizontal: Spacing.lg, gap: 12 },
  card: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, marginBottom: 12 },
  cardImage: { width: '100%', height: 140 },
  cardBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  cardBadgeText: { fontSize: FontSize.xs, fontWeight: '800' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: FontSize.xs, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  avatarTiny: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTinyText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  listerName: { fontSize: 9, flex: 1 },
  swapChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.primaryLight, paddingHorizontal: 5, paddingVertical: 2, borderRadius: BorderRadius.full },
  swapChipText: { fontSize: 9, color: Colors.primary, fontWeight: '700' },

  // Empty
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyText: { fontSize: FontSize.lg, fontWeight: '700', marginTop: 12 },
  emptySubtext: { fontSize: FontSize.sm, marginTop: 4, textAlign: 'center' },
});