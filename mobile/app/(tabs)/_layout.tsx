import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { sanitizePublicMatches } from '@/lib/utils';
import { subscribeActiveMatchId } from '@/lib/realtime';

export default function TabLayout() {
  const { token, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [reverificationRequired, setReverificationRequired] = useState(false);
  const [activeChatMatchId, setActiveChatMatchId] = useState<string | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, 8);
  const tabBarHeight = Platform.select({ ios: 64, android: 64, default: 64 }) ?? 64;
  const tabBarPaddingBottom = Platform.select({ ios: 7, android: 7, default: 7 }) ?? 7;

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
      const visibleMatches = sanitizePublicMatches(Array.isArray(data) ? data : []);
      if (!Array.isArray(visibleMatches)) {
        setUnreadCount(0);
        return;
      }
      const total = visibleMatches.reduce((sum, item) => sum + (Number(item?.unread_count) || 0), 0);
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

  useEffect(() => {
    return subscribeActiveMatchId(setActiveChatMatchId);
  }, []);

  return (
    <Tabs
      screenOptions={({ route }) => {
        const currentTab = segments[1];
        const hideTabBar = currentTab === 'messages' && !!activeChatMatchId;

        const baseTabBarStyle = {
          position: 'absolute' as const,
          left: 12,
          right: 12,
          bottom: tabBarBottom,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 7,
          paddingHorizontal: 8,
          backgroundColor: 'rgba(6,6,8,0.96)',
          borderTopWidth: 0,
          borderRadius: 22,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.32,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -4 },
        };

        return {
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.78)',
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          textAlign: 'center',
          marginTop: 0,
          lineHeight: 12,
          width: '100%',
        },
        tabBarIconStyle: {
          marginBottom: 0,
          width: 38,
          alignItems: 'center',
        },
        tabBarItemStyle: {
          flex: 0,
          width: '20%',
          maxWidth: '20%',
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
        },
        tabBarStyle: hideTabBar
          ? { display: 'none' as const }
          : baseTabBarStyle,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      };
      }}>
      <Tabs.Screen
        name="encounters"
        options={{
          title: 'Swipe',
          headerShown: false,
          href: reverificationRequired ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabIcon : styles.tabIcon}>
              <Ionicons name="heart" size={focused ? 22 : 19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Proches',
          href: reverificationRequired ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabIcon : styles.tabIcon}>
              <Ionicons name="location" size={focused ? 22 : 19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'Actions',
          href: reverificationRequired ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabIcon : styles.tabIcon}>
              <Ionicons name="star" size={focused ? 22 : 19} color={color} />
            </View>
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
            <View style={focused ? styles.activeTabIcon : styles.tabIcon}>
              <Ionicons name="chatbubble" size={focused ? 22 : 19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabIcon : styles.tabIcon}>
              <Ionicons name="person" size={focused ? 22 : 19} color={color} />
            </View>
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

const styles = StyleSheet.create({
  tabIcon: {
    width: 38,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabIcon: {
    width: 38,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
