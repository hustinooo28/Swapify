import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Books', 'Sports', 'Home', 'Other'];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

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

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('ItemDetail', { item })}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/300x200?text=No+Image' }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>

        {/* Lister info */}
        <View style={styles.listerRow}>
          <View style={styles.avatarTiny}>
            <Text style={styles.avatarTinyText}>{(item.user?.full_name || 'U')[0].toUpperCase()}</Text>
          </View>
          <Text style={[styles.listerName, { color: theme.textSecondary }]}>{item.user?.full_name || 'Unknown'}</Text>
        </View>

        {/* Swap info */}
        <View style={[styles.swapInfo, { backgroundColor: theme.borderLight }]}>
          <Ionicons name="swap-horizontal" size={13} color={Colors.primary} />
          <Text style={styles.swapText} numberOfLines={1}>
            Open to swap for: <Text style={styles.swapCategory}>{item.category} items</Text>
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.valueBadge}>
            <Text style={styles.valueText}>₱{item.estimated_value.toLocaleString()}</Text>
          </View>
          <Text style={[styles.categoryTag, { color: theme.textLight }]}>{item.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.headerGreeting, { color: theme.textSecondary }]}>Discover</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Items to Trade</Text>
        </View>
        <View style={styles.logoSmall}><Text style={styles.logoSmallText}>S</Text></View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textLight} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search items..."
          placeholderTextColor={theme.textLight}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={fetchItems}
        />
      </View>

      <FlatList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c}
        contentContainerStyle={styles.categories}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.catChip, { backgroundColor: theme.surface, borderColor: theme.border }, selectedCategory === cat && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.catText, { color: theme.textSecondary }, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No items found</Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Try adjusting your search or category</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  headerGreeting: { fontSize: FontSize.sm, fontWeight: '500' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800' },
  logoSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoSmallText: { color: '#fff', fontWeight: '800', fontSize: FontSize.lg },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: FontSize.md },
  categories: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 8, flexGrow: 0 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, alignSelf: 'flex-start' },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: FontSize.sm, fontWeight: '600' },
  catTextActive: { color: '#fff' },
  list: { padding: Spacing.lg, gap: 16 },
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardImage: { width: '100%', height: 180 },
  cardBody: { padding: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: FontSize.sm, lineHeight: 18, marginBottom: 8 },
  listerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarTiny: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  avatarTinyText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  listerName: { fontSize: FontSize.xs, fontWeight: '500' },
  swapInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: BorderRadius.sm, marginBottom: 8 },
  swapText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  swapCategory: { color: Colors.primary, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  valueText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  categoryTag: { fontSize: FontSize.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: FontSize.lg, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: FontSize.sm, marginTop: 4 },
});