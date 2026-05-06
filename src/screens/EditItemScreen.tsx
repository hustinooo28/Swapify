import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { Item } from '../types';

const CATEGORIES = [
  { label: 'Electronics', icon: 'phone-portrait-outline' },
  { label: 'Clothing',    icon: 'shirt-outline' },
  { label: 'Books',       icon: 'book-outline' },
  { label: 'Sports',      icon: 'football-outline' },
  { label: 'Home',        icon: 'home-outline' },
  { label: 'Other',       icon: 'grid-outline' },
];

export default function EditItemScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { item }: { item: Item } = route.params;
  const { theme } = useTheme();

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [estimatedValue, setEstimatedValue] = useState(String(item.estimated_value));
  const [category, setCategory] = useState(item.category);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl] = useState(item.image_url);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
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
    } catch { return null; }
  };

  const handleUpdate = async () => {
    if (!title || !description || !estimatedValue || !category) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Upload new image if selected, otherwise keep existing
    const newImageUrl = imageUri ? await uploadImage(user.id) : null;

    const { error } = await supabase
      .from('items')
      .update({
        title: title.trim(),
        description: description.trim(),
        estimated_value: parseFloat(estimatedValue),
        category,
        image_url: newImageUrl || existingImageUrl,
      })
      .eq('id', item.id);

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not update item. Please try again.');
      return;
    }

    Alert.alert('✅ Updated!', 'Your listing has been updated.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const displayImage = imageUri || existingImageUrl;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Listing</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.body}>
          {/* Image Picker */}
          <TouchableOpacity
            style={[styles.imagePicker, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {displayImage ? (
              <>
                <Image source={{ uri: displayImage }} style={styles.previewImage} />
                <View style={styles.imageOverlay}>
                  <Ionicons name="camera" size={22} color="#fff" />
                  <Text style={styles.imageOverlayText}>Change Photo</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={[styles.cameraCircle, { backgroundColor: Colors.primaryLight }]}>
                  <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                </View>
                <Text style={[styles.placeholderText, { color: theme.text }]}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Title</Text>
            <View style={[styles.inputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="pricetag-outline" size={18} color={theme.textLight} style={styles.inputIcon} />
              <TextInput style={[styles.input, { color: theme.text }]} placeholder="Item title" placeholderTextColor={theme.textLight} value={title} onChangeText={setTitle} />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Description</Text>
            <View style={[styles.inputRow, styles.textAreaRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TextInput style={[styles.input, styles.textArea, { color: theme.text }]} placeholder="Describe your item..." placeholderTextColor={theme.textLight} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />
            </View>
          </View>

          {/* Value */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Estimated Value</Text>
            <View style={[styles.inputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.prefix, { color: theme.textSecondary }]}>₱</Text>
              <TextInput style={[styles.input, { color: theme.text }]} placeholder="0" placeholderTextColor={theme.textLight} value={estimatedValue} onChangeText={setEstimatedValue} keyboardType="numeric" />
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(cat => {
                const selected = category === cat.label;
                return (
                  <TouchableOpacity
                    key={cat.label}
                    style={[styles.catCard, { backgroundColor: selected ? Colors.primary : theme.card, borderColor: selected ? Colors.primary : theme.border }]}
                    onPress={() => setCategory(cat.label)}
                  >
                    <Ionicons name={cat.icon as any} size={20} color={selected ? '#fff' : theme.textSecondary} />
                    <Text style={[styles.catCardText, { color: selected ? '#fff' : theme.textSecondary }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  body: { padding: Spacing.lg },
  imagePicker: { width: '100%', height: 180, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', marginBottom: Spacing.lg },
  previewImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', paddingVertical: 10, gap: 4 },
  imageOverlayText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cameraCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: FontSize.sm, fontWeight: '600' },
  fieldGroup: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: 14 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: FontSize.sm },
  textAreaRow: { alignItems: 'flex-start', paddingVertical: 12 },
  textArea: { height: 100, paddingVertical: 0 },
  prefix: { fontSize: FontSize.md, fontWeight: '700', marginRight: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  catCardText: { fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: Spacing.sm, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});