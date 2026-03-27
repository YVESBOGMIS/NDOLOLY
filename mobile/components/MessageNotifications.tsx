import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { connectSocket, getActiveMatchId, resetSocket } from '@/lib/realtime';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const getMessagePreview = (payload: any) => {
  if (!payload) return 'Nouveau message';
  if (payload.type === 'text') return payload.content || 'Nouveau message';
  if (payload.type === 'image') return 'Photo';
  if (payload.type === 'audio') return 'Message vocal';
  return 'Nouveau message';
};

export default function MessageNotifications() {
  const { token, loading } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const seenMessages = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!token) {
      setUserId(null);
      resetSocket();
      return;
    }
    let active = true;
    const loadUser = async () => {
      try {
        const me = await api.get('/profile/me');
        const id = String(me?.id || me?._id || '');
        if (active) {
          setUserId(id || null);
        }
      } catch {
        if (active) setUserId(null);
      }
    };
    loadUser();
    return () => {
      active = false;
    };
  }, [token, loading]);

  useEffect(() => {
    if (!token) return;
    const requestPermission = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    };
    requestPermission();
  }, [token]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff5a5f',
    }).catch(() => {
      // Ignore channel setup errors.
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const socket = connectSocket(userId);
    if (!socket) return;

    const handleNewMessage = async (payload: any) => {
      const messageId = String(payload?.id || payload?._id || payload?.message_id || '');
      if (messageId && seenMessages.current.has(messageId)) return;
      if (messageId) seenMessages.current.add(messageId);

      if (String(payload?.to_user_id) !== String(userId)) return;

      const matchId = String(payload?.match_id || '');
      if (matchId) {
        try {
          await api.post(`/messages/${matchId}/received`, messageId ? { messageId } : {});
        } catch {
          // Ignore delivery errors for notifications.
        }
      }

      const activeMatchId = getActiveMatchId();
      if (activeMatchId && matchId && String(activeMatchId) === String(matchId)) {
        if (matchId) {
          try {
            await api.post(`/messages/${matchId}/read`, messageId ? { messageId } : {});
          } catch {
            // Ignore read errors for notifications.
          }
        }
        return;
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Nouveau message',
            body: getMessagePreview(payload),
            data: { matchId },
            channelId: 'messages',
          },
          trigger: null,
        });
      } catch {
        // Notifications can fail if permissions are denied.
      }
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [userId]);

  return null;
}
