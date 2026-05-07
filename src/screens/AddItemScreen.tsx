import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

const CATEGORIES = [
  { label: 'Electronics', icon: 'phone-portrait-outline' },
  { label: 'Clothing',    icon: 'shirt-outline' },
  { label: 'Books',       icon: 'book-outline' },
  { label: 'Sports',      icon: 'football-outline' },
  { label: 'Home',        icon: 'home-outline' },
  { label: 'Other',       icon: 'grid-outline' },
];

const CONDITIONS = [
  { label: 'Brand New', color: '#10B981', desc: 'Never used, still in packaging' },
  { label: 'Like New',  color: '#3B82F6', desc: 'Used once or twice, no defects' },
  { label: 'Good',      color: '#6366F1', desc: 'Minor signs of use, fully working' },
  { label: 'Fair',      color: '#F59E0B', desc: 'Visible wear but fully functional' },
  { label: 'Poor',      color: '#EF4444', desc: 'Heavy wear, may have defects' },
];

export default function AddItemScreen() {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('Good');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageUri) return null;
    try {
      const ext = imageUri.split('.').pop() || 'jpg';
      const fileName = `${userId}_${Date.now()}.${ext}`;
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error } = await supabase.storage.from('item-images').upload(fileName, arrayBuffer, { contentType: `image/${ext}` });
      if (error) throw error;
      const { data } = supabase.storage.from('item-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (e) { return null; }
  };

  const handleSubmit = async () => {
    if (!title || !description || !estimatedValue || !category) { Alert.alert('Missing fields', 'Please fill in all fields and select a category.'); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const imageUrl = await uploadImage(user.id);
    const { error } = await supabase.from('items').insert({ user_id: user.id, title: title.trim(), description: description.trim(), estimated_value: parseFloat(estimatedValue), category, condition, image_url: imageUrl || '', status: 'available' });
    setLoading(false);
    if (error) { Alert.alert('Error', 'Could not add item.'); return; }
    Alert.alert('🎉 Listed!', 'Your item is now live on the marketplace.', [{ text: 'OK', onPress: () => { setTitle(''); setDescription(''); setEstimatedValue(''); setCategory(''); setCondition('Good'); setImageUri(null); } }]);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>List an Item</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Share what you want to trade</Text>
        </View>

        <View style={styles.body}>
          {/* Image Picker */}
          <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={pickImage} activeOpacity={0.8}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                <View style={styles.imageOverlay}>
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={styles.imageOverlayText}>Change Photo</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={[styles.cameraCircle, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                </View>
                <Text style={[styles.imagePlaceholderTitle, { color: theme.text }]}>Add Photo</Text>
                <Text style={[styles.imagePlaceholderSub, { color: theme.textSecondary }]}>Tap to upload from gallery</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Item Title</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="pricetag-outline" size={18} color={theme.textLight} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: theme.text }]} placeholder="e.g. iPhone 13 Pro" placeholderTextColor={theme.textLight} value={title} onChangeText={setTitle} />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Description</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TextInput style={[styles.input, styles.textArea, { color: theme.text }]} placeholder="Describe condition, specs, and what you're looking for..." placeholderTextColor={theme.textLight} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />
            </View>
          </View>

          {/* Value */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Estimated Value</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.currencyPrefix, { color: theme.textSecondary }]}>₱</Text>
              <TextInput style={[styles.input, { color: theme.text }]} placeholder="0" placeholderTextColor={theme.textLight} value={estimatedValue} onChangeText={setEstimatedValue} keyboardType="numeric" />
            </View>
          </View>

            {/* Condition */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Condition</Text>
            <View style={styles.conditionList}>
              {CONDITIONS.map((c) => {
                const selected = condition === c.label;
                return (
                  <TouchableOpacity
                    key={c.label}
                    style={[
                      styles.conditionRow,
                      {
                        backgroundColor: selected ? c.color + '15' : theme.card,
                        borderColor: selected ? c.color : theme.border,
                      },
                    ]}
                    onPress={() => setCondition(c.label)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.conditionDot, { backgroundColor: c.color }]} />
                    <View style={styles.conditionInfo}>
                      <Text style={[styles.conditionLabel, { color: selected ? c.color : theme.text }]}>
                        {c.label}
                      </Text>
                      <Text style={[styles.conditionDesc, { color: theme.textSecondary }]}>
                        {c.desc}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={18} color={c.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat.label;
                return (
                  <TouchableOpacity
                    key={cat.label}
                    style={[styles.catCard, { backgroundColor: selected ? Colors.primary : theme.card, borderColor: selected ? Colors.primary : theme.border }]}
                    onPress={() => setCategory(cat.label)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={cat.icon as any} size={22} color={selected ? '#fff' : theme.textSecondary} />
                    <Text style={[styles.catCardText, { color: selected ? '#fff' : theme.textSecondary }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>List Item</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conditionList: { gap: 8 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1.5, padding: 12, gap: 12 },
  conditionDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  conditionInfo: { flex: 1 },
  conditionLabel: { fontSize: FontSize.sm, fontWeight: '700' },
  conditionDesc: { fontSize: FontSize.xs, marginTop: 1 },
  container: { flex: 1 },
  scroll: { paddingBottom: 120 },
  header: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: FontSize.sm, marginTop: 2 },
  body: { padding: Spacing.lg },
  imagePicker: { width: '100%', height: 200, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', marginBottom: Spacing.lg },
  previewImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', paddingVertical: 10, gap: 2 },
  imageOverlayText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cameraCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderTitle: { fontSize: FontSize.md, fontWeight: '700' },
  imagePlaceholderSub: { fontSize: FontSize.xs },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: 14 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: FontSize.sm },
  textAreaWrapper: { alignItems: 'flex-start', paddingVertical: 12 },
  textArea: { height: 100, paddingVertical: 0 },
  currencyPrefix: { fontSize: FontSize.md, fontWeight: '700', marginRight: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  catCardText: { fontSize: FontSize.sm, fontWeight: '600' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});