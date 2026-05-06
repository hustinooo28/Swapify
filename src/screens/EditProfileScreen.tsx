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

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { profile } = route.params;
  const { theme } = useTheme();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [existingAvatar] = useState(profile?.avatar_url || null);
  const [loading, setLoading] = useState(false);

  const showPhotoOptions = () => {
    Alert.alert('Profile Photo', 'Choose a source', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarUri) return null;
    try {
      const ext = avatarUri.split('.').pop() || 'jpg';
      const fileName = `avatar_${userId}.${ext}`;
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return data.publicUrl;
    } catch { return null; }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Upload new avatar if selected
    const newAvatarUrl = avatarUri ? await uploadAvatar(user.id) : null;

    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      avatar_url: newAvatarUrl || existingAvatar,
    }).eq('id', user.id);

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not update profile. Please try again.');
      return;
    }

    Alert.alert('✅ Profile Updated', 'Your profile has been saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const displayAvatar = avatarUri || existingAvatar;

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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={styles.saveHeaderBtn}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.saveHeaderBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={showPhotoOptions} activeOpacity={0.85}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={styles.avatarInitial}>
                    {fullName ? fullName[0].toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
              Tap to change photo
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.formCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PERSONAL INFO</Text>

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Full Name</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="person-outline" size={18} color={theme.textLight} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Your full name"
                  placeholderTextColor={theme.textLight}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Email — read only */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Email</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.borderLight, borderColor: theme.border }]}>
                <Ionicons name="mail-outline" size={18} color={theme.textLight} style={styles.inputIcon} />
                <Text style={[styles.input, { color: theme.textLight, paddingVertical: 14 }]}>
                  {profile?.email}
                </Text>
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={12} color={theme.textLight} />
                </View>
              </View>
              <Text style={[styles.fieldHint, { color: theme.textLight }]}>Email cannot be changed</Text>
            </View>

            {/* Phone */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Phone Number</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="call-outline" size={18} color={theme.textLight} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. +63 912 345 6789"
                  placeholderTextColor={theme.textLight}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {/* Address */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Address</Text>
              <View style={[styles.inputRow, styles.textAreaRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="location-outline" size={18} color={theme.textLight} style={[styles.inputIcon, { paddingTop: 2 }]} />
                <TextInput
                  style={[styles.input, styles.textArea, { color: theme.text }]}
                  placeholder="Your address"
                  placeholderTextColor={theme.textLight}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.btnDisabled]}
            onPress={handleSave}
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
  saveHeaderBtn: { paddingHorizontal: 4 },
  saveHeaderBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  body: { padding: Spacing.lg },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.lg },
  avatarWrapper: { position: 'relative', marginBottom: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: '800', color: Colors.primary },
  avatarBadge: { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint: { fontSize: FontSize.xs },
  formCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.md },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: 14 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: FontSize.sm },
  textAreaRow: { alignItems: 'flex-start', paddingVertical: 12 },
  textArea: { height: 80, paddingVertical: 0 },
  fieldHint: { fontSize: FontSize.xs, marginTop: 4, marginLeft: 4 },
  lockedBadge: { paddingRight: 4 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});