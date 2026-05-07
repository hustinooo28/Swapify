import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, Platform,
  TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { Colors } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { useNavigationState } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import AddItemScreen from '../screens/AddItemScreen';
import OffersScreen from '../screens/OffersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import EditItemScreen from '../screens/EditItemScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Screens where nav should be hidden
const HIDDEN_NAV_SCREENS = ['Chat', 'ItemDetail', 'Notifications'];

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EditItem" component={EditItemScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

function OffersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OffersMain" component={OffersScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditItem" component={EditItemScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

const TABS = [
  { name: 'Home',    label: 'Market',   icon: 'storefront',  iconOff: 'storefront-outline' },
  { name: 'AddItem', label: 'List',     icon: 'add-circle',  iconOff: 'add-circle-outline' },
  { name: 'Offers',  label: 'Messages', icon: 'chatbubbles', iconOff: 'chatbubbles-outline' },
  { name: 'Profile', label: 'Profile',  icon: 'person',      iconOff: 'person-outline' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_MARGIN = 24;
const TAB_BAR_H_PAD = 8;
const TAB_BAR_WIDTH = SCREEN_WIDTH - H_MARGIN * 2;
const TAB_COUNT = TABS.length;
const SLOT_W = (TAB_BAR_WIDTH - TAB_BAR_H_PAD * 2) / TAB_COUNT;
const NAV_HEIGHT = 58;
const BOTTOM_OFFSET = Platform.OS === 'ios' ? 28 : 16;

// Hook to detect if current screen should hide nav
function useIsNavHidden() {
  const navState = useNavigationState(state => state);

  const getCurrentRouteName = (state: any): string => {
    if (!state) return '';
    const route = state.routes[state.index];
    if (route.state) return getCurrentRouteName(route.state);
    return route.name;
  };

  const currentScreen = getCurrentRouteName(navState);
  return HIDDEN_NAV_SCREENS.includes(currentScreen);
}

function FloatingTabBar({ state, navigation }: any) {
  const { isDark } = useTheme();
  const isHidden = useIsNavHidden();

  // Animated values
  const activeIndex = useRef(new Animated.Value(state.index)).current;
  const prevIndex = useRef(state.index);

  // Slide up/down animation for show/hide
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Animate nav hide/show based on current screen
  useEffect(() => {
    if (isHidden) {
      // Slide down and fade out
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: NAV_HEIGHT + BOTTOM_OFFSET + 20,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide up and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isHidden]);

  // Animate active tab pill
  useEffect(() => {
    if (prevIndex.current === state.index) return;
    prevIndex.current = state.index;
    Animated.spring(activeIndex, {
      toValue: state.index,
      useNativeDriver: false,
      tension: 70,
      friction: 11,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    }).start();
  }, [state.index]);

  const bgColor = isDark ? '#1C1F2E' : '#FFFFFF';
  const inactiveColor = isDark ? '#64748B' : '#9CA3AF';

  const pillLeft = activeIndex.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => TAB_BAR_H_PAD + i * SLOT_W),
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.outerWrapper,
        {
          transform: [{ translateY }],
          opacity,
          // When fully hidden, disable touches
          pointerEvents: isHidden ? 'none' : 'box-none',
        },
      ]}
      pointerEvents={isHidden ? 'none' : 'box-none'}
    >
      {/* Shadow layer */}
      <View style={[styles.shadowLayer, { backgroundColor: bgColor }]} />

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: bgColor }]}>
        {/* Sliding pill */}
        <Animated.View style={[styles.pill, { left: pillLeft, width: SLOT_W }]} />

        {/* Tabs */}
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;

          const labelOpacity = useRef(
            new Animated.Value(index === state.index ? 1 : 0),
          ).current;

          useEffect(() => {
            Animated.timing(labelOpacity, {
              toValue: isFocused ? 1 : 0,
              duration: 180,
              useNativeDriver: true,
            }).start();
          }, [isFocused]);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[index].key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(state.routes[index].name);
            }
          };

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.85}
              style={[styles.tabSlot, { width: SLOT_W }]}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={(isFocused ? tab.icon : tab.iconOff) as any}
                  size={21}
                  color={isFocused ? '#fff' : inactiveColor}
                />
                <Animated.Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    {
                      opacity: labelOpacity,
                      maxWidth: isFocused ? 80 : 0,
                    },
                  ]}
                >
                  {' '}{tab.label}
                </Animated.Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="AddItem" component={AddItemScreen} />
      <Tab.Screen name="Offers" component={OffersStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: BOTTOM_OFFSET,
    left: H_MARGIN,
    right: H_MARGIN,
    height: NAV_HEIGHT,
  },
  shadowLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  tabBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    borderRadius: 999,
    paddingHorizontal: TAB_BAR_H_PAD,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 6, bottom: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    zIndex: 0,
  },
  tabSlot: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 21,
    overflow: 'hidden',
  },
});