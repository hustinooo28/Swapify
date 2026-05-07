import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator, Alert, ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';

type Coords = { lat: number; lng: number };

type Props = {
  value: string;
  onChange: (address: string) => void;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

// Reverse geocode coords → human address
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'SwapifyApp/1.0' } },
    );
    const data = await res.json();
    if (data?.display_name) return data.display_name;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// Search address → results
async function searchAddress(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`,
      { headers: { 'User-Agent': 'SwapifyApp/1.0' } },
    );
    return await res.json();
  } catch {
    return [];
  }
}

export default function LocationPicker({ value, onChange }: Props) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapCoords, setMapCoords] = useState<Coords | null>(null);
  const [confirmedAddress, setConfirmedAddress] = useState(value || '');
  const [confirmingAddress, setConfirmingAddress] = useState(false);

  const openModal = () => {
    setSearchText('');
    setSearchResults([]);
    setConfirmedAddress(value || '');
    setModalVisible(true);
  };

  // Use GPS to get current location
  const handleUseGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please allow location access in your device settings to use this feature.',
        );
        setGpsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = loc.coords;
      setMapCoords({ lat: latitude, lng: longitude });

      setConfirmingAddress(true);
      const address = await reverseGeocode(latitude, longitude);
      setConfirmingAddress(false);
      setConfirmedAddress(address);
      setSearchText('');
      setSearchResults([]);
    } catch (e) {
      Alert.alert('Error', 'Could not get your location. Please try searching manually.');
    }
    setGpsLoading(false);
  };

  // Search by text
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    const results = await searchAddress(searchText.trim());
    setSearching(false);
    setSearchResults(results);
  };

  // Pick a search result
  const handleSelectResult = async (result: SearchResult) => {
    const coords = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setMapCoords(coords);
    setConfirmedAddress(result.display_name);
    setSearchResults([]);
    setSearchText('');
  };

  // Drag map marker to adjust
  const handleMapDrag = async (coords: Coords) => {
    setMapCoords(coords);
    setConfirmingAddress(true);
    const address = await reverseGeocode(coords.lat, coords.lng);
    setConfirmingAddress(false);
    setConfirmedAddress(address);
  };

  // Confirm selection
  const handleConfirm = () => {
    if (!confirmedAddress) {
      Alert.alert('No location', 'Please select a location first.');
      return;
    }
    onChange(confirmedAddress);
    setModalVisible(false);
  };

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: theme.background, borderColor: theme.border }]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <Ionicons name="location-outline" size={18} color={Colors.primary} />
        <Text
          style={[styles.triggerText, { color: value ? theme.text : theme.textLight }]}
          numberOfLines={2}
        >
          {value || 'Set your location'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textLight} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modal, { backgroundColor: theme.background }]}>

          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Set Location</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* GPS button */}
            <TouchableOpacity
              style={[styles.gpsBtn, { backgroundColor: Colors.primaryLight }]}
              onPress={handleUseGPS}
              disabled={gpsLoading}
              activeOpacity={0.8}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="navigate" size={18} color={Colors.primary} />
              )}
              <Text style={styles.gpsBtnText}>
                {gpsLoading ? 'Getting location...' : 'Use my current location'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.orText, { color: theme.textLight }]}>or search</Text>
              <View style={[styles.orLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={18} color={theme.textLight} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search address, city, area..."
                placeholderTextColor={theme.textLight}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searching ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity onPress={handleSearch}>
                  <Text style={styles.searchBtnText}>Search</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Search results */}
            {searchResults.length > 0 && (
              <View style={[styles.resultsList, { backgroundColor: theme.surface }]}>
                {searchResults.map((result, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.resultRow,
                      i < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                    ]}
                    onPress={() => handleSelectResult(result)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={16} color={Colors.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.resultText, { color: theme.text }]} numberOfLines={2}>
                      {result.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Map preview */}
            {mapCoords && (
              <View style={styles.mapSection}>
                <Text style={[styles.mapLabel, { color: theme.text }]}>
                  Drag the pin to adjust
                </Text>
                <View style={styles.mapWrapper}>
                  <MapView
                    provider={PROVIDER_DEFAULT}
                    style={styles.map}
                    region={{
                      latitude: mapCoords.lat,
                      longitude: mapCoords.lng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Marker
                      coordinate={{ latitude: mapCoords.lat, longitude: mapCoords.lng }}
                      draggable
                      onDragEnd={(e) => handleMapDrag({
                        lat: e.nativeEvent.coordinate.latitude,
                        lng: e.nativeEvent.coordinate.longitude,
                      })}
                      pinColor={Colors.primary}
                    />
                  </MapView>
                </View>
              </View>
            )}

            {/* Confirmed address preview */}
            {confirmedAddress ? (
              <View style={[styles.confirmedBox, { backgroundColor: Colors.primaryLight }]}>
                {confirmingAddress ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                )}
                <Text style={[styles.confirmedText, { color: Colors.primary }]} numberOfLines={3}>
                  {confirmingAddress ? 'Getting address...' : confirmedAddress}
                </Text>
              </View>
            ) : null}

            {/* Confirm button */}
            <TouchableOpacity
              style={[styles.doneBtn, !confirmedAddress && styles.doneBtnDisabled]}
              onPress={handleConfirm}
              disabled={!confirmedAddress}
            >
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.doneBtnText}>Set This Location</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  triggerText: { flex: 1, fontSize: FontSize.sm },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800' },
  confirmText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  modalBody: { flex: 1, padding: Spacing.lg },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  gpsBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: FontSize.xs, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm },
  searchBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  resultsList: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  resultText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  mapSection: { marginBottom: Spacing.md },
  mapLabel: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 8 },
  mapWrapper: { borderRadius: BorderRadius.xl, overflow: 'hidden', height: 200 },
  map: { width: '100%', height: '100%' },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  confirmedText: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20 },
  doneBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 15,
    borderRadius: BorderRadius.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  doneBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});