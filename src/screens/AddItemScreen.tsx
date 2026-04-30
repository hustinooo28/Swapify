import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Sports', 'Home', 'Other'];

export default function AddItemScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [category, setCategory] = useState('');
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
    } catch (e) { console.error('Upload error:', e); return null; }
  };

  const handleSubmit = async () => {
    if (!title || !description || !estimatedValue || !category) { Alert.alert('Missing fields', 'Please fill in all required fields and select a category.'); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); Alert.alert('Error', 'Not logged in.'); return; }
    const imageUrl = await uploadImage(user.id);
    const { error } = await supabase.from('items').insert({ user_id: user.id, title: title.trim(), description: description.trim(), estimated_value: parseFloat(estimatedValue), category, image_url: imageUrl || '', status: 'available' });
    setLoading(false);
    if (error) { Alert.alert('Error', 'Could not add item. Please try again.'); return; }
    Alert.alert('Item Added!', 'Your item is now listed.', [{ text: 'OK', onPress: () => { setTitle(''); setDescription(''); setEstimatedValue(''); setCategory(''); setImageUri(null); } }]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>List an Item</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={36} color={Colors.textLight} />
              <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} placeholder="e.g. iPhone 13 Pro" placeholderTextColor={Colors.textLight} value={title} onChangeText={setTitle} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description *</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Describe your item's condition, details, etc." placeholderTextColor={Colors.textLight} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Estimated Value (₱) *</Text>
          <TextInput style={styles.input} placeholder="e.g. 5000" placeholderTextColor={Colors.textLight} value={estimatedValue} onChangeText={setEstimatedValue} keyboardType="numeric" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipActive]} onPress={() => setCategory(cat)}>
                <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : (<><Ionicons name="add-circle-outline" size={20} color={Colors.white} /><Text style={styles.submitBtnText}>List Item</Text></>)}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingTop: 60, paddingBottom: 40 },
  header: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  imagePicker: { width: '100%', height: 200, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.lg, backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 8 },
  field: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { height: 100 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  catTextActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.md },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
