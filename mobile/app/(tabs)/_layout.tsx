import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { token, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [reverificationRequired, setReverificationRequired] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = Platform.select({ ios: 84, android: 80, default: 84 }) ?? 84;
  const baseTabBarPaddingBottom =
    Platform.select({ ios: 12, android: 10, default: 12 }) ?? 12;
  const androidNavOffset = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 0;
  const iosSafePadding = Platform.OS === 'ios' ? insets.bottom : 0;
  const tabBarPaddingBottom = baseTabBarPaddingBottom + iosSafePadding;
  const tabBarHeight = baseTabBarHeight + iosSafePadding;

  const loadProfileLock = useCallback(async () => {
    if (!token) {
      setReverificationRequired(false);
      return false;
    }
    try {
      const profile = await api.get(`/profile/me?ts=${Date.now()}`);
      const locked = !!profile?.reverification_required;
      setReverificationRequired(locked);
      return locked;
    } catch {
      return false;
    }
  }, [token]);

  const loadUnread = useCallback(async () => {
    if (!token || reverificationRequired) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api.get('/match/list');
      if (!Array.isArray(data)) {
        setUnreadCount(0);
        return;
      }
      const total = data.reduce((sum, item) => sum + (Number(item?.unread_count) || 0), 0);
      setUnreadCount(total);
    } catch {
      // Ignore unread errors to avoid blocking navigation.
    }
  }, [token, reverificationRequired]);

  useEffect(() => {
    if (loading) return;
    loadProfileLock();
    loadUnread();
    if (!token) return;
    const unreadHandle = setInterval(loadUnread, 15000);
    const lockHandle = setInterval(() => {
      loadProfileLock().catch(() => {});
    }, 5000);
    return () => {
      clearInterval(unreadHandle);
      clearInterval(lockHandle);
    };
  }, [loading, token, loadUnread, loadProfileLock]);

  useEffect(() => {
    const currentTab = segments[1];
    if (reverificationRequired && currentTab && currentTab !== 'profile') {
      router.replace('/(tabs)/profile');
    }
  }, [reverificationRequired, segments, router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: '#6b7280',
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          textAlign: 'center',
          marginTop: 0,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
        },
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 10,
          marginBottom: androidNavOffset,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderColor: 'rgba(26,26,29,0.08)',
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="encounters"
        options={{
          title: 'Swipe',
          href: reverificationRequired ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name="heart" size={focused ? 30 : 26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Proches',
          href: reverificationRequired ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name="location" size={focused ? 30 : 26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Actions',
          href: reverificationRequired ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name="star" size={focused ? 30 : 26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Msg',
          href: reverificationRequired ? null : undefined,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ff5a5f',
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name="chatbubble" size={focused ? 30 : 26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name="person" size={focused ? 30 : 26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="filters"
        options={{
          title: 'Filtres',
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}
