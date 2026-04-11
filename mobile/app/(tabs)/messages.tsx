﻿﻿import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/lib/api';
import { resolvePhoto, sanitizePublicMatches } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';
import { connectSocket, setActiveMatchId } from '@/lib/realtime';

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The tab bar is rendered as an absolute, floating element in `(tabs)/_layout.tsx`.
  // When chatting, ensure the composer is always above it (and above the safe-area).
  const tabBarHeight = Platform.select({ ios: 64, android: 64, default: 64 }) ?? 64;
  const tabBarBottom = Math.max(insets.bottom, 8);
  const tabBarTopOffset = tabBarHeight + tabBarBottom;
  const [matches, setMatches] = useState<any[]>([]);
  const [activeMatch, setActiveMatch] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const activeMatchRef = useRef<any | null>(null);
  const [listenedIds, setListenedIds] = useState<string[]>([]);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState<number>(0);
  const params = useLocalSearchParams<{ matchId?: string | string[] }>();
  const pendingMatchId = useMemo(() => {
    const raw = params?.matchId;
    if (Array.isArray(raw)) return String(raw[0] || '');
    return String(raw || '');
  }, [params?.matchId]);
  const handledMatchIdRef = useRef<string | null>(null);

  const getMessageId = (msg: any) => String(msg?.id || msg?._id || msg?.message_id || '');
  const dedupeByKey = useCallback(<T,>(list: T[], getKey: (item: T) => string) => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of list) {
      const key = getKey(item);
      if (!key) {
        out.push(item);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, []);
  const markAudioListened = useCallback(
    async (msg: any) => {
      const messageId = getMessageId(msg);
      if (!messageId) return;
      setListenedIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]));
      if (msg?.type !== 'audio') return;
      const toUserId = String(msg?.to_user_id || '');
      if (!currentUserId || toUserId !== String(currentUserId)) return;
      if (msg?.listened_at) return;
      const matchId = String(msg?.match_id || activeMatchRef.current?.id || '');
      if (!matchId) return;
      try {
        await api.post(`/messages/${matchId}/listened`, { messageId });
      } catch {
        // Ignore listened errors.
      }
    },
    [currentUserId, getMessageId],
  );
  const recordingOptions: Audio.RecordingOptions = {
    android: {
      extension: '.m4a',
      outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
      audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 96000,
    },
    ios: {
      extension: '.wav',
      outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
      audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 96000,
    },
  };

  const upsertMessage = useCallback((list: any[], msg: any) => {
    const messageId = getMessageId(msg);
    if (!messageId) return [...list, msg];
    const index = list.findIndex((item) => getMessageId(item) === messageId);
    if (index === -1) return [...list, msg];
    const next = [...list];
    next[index] = { ...next[index], ...msg };
    return next;
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const data = await api.get('/match/list');
      const sanitized = sanitizePublicMatches(Array.isArray(data) ? data : []);
      setMatches(dedupeByKey(sanitized, (m: any) => String(m?.id || m?._id || '')));
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de charger les conversations');
    }
  }, [dedupeByKey]);

  const loadLikesCount = useCallback(async () => {
    try {
      const data = await api.get('/match/liked-me');
      if (Array.isArray(data)) {
        setLikesCount(data.length);
      } else {
        setLikesCount(0);
      }
    } catch {
      setLikesCount(0);
    }
  }, []);

  const refreshConversation = useCallback(async () => {
    if (!activeMatchRef.current?.id) return;
    const matchId = activeMatchRef.current.id;
    try {
      const data = await api.get(`/messages/${matchId}`);
      const list = Array.isArray(data) ? data : [];
      setMessages(dedupeByKey(list, (m: any) => getMessageId(m)));
      await api.post(`/messages/${matchId}/received`, {});
      await api.post(`/messages/${matchId}/read`, {});
      await loadMatches();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de rafraichir la conversation');
    }
  }, [dedupeByKey, loadMatches]);

  const getTargetUserId = useCallback(() => {
    const user = activeMatchRef.current?.user;
    return String(user?.id || user?._id || '');
  }, []);

  const blockProfile = useCallback(() => {
    const userId = getTargetUserId();
    if (!userId) return;
    Alert.alert('Bloquer ce profil ?', 'Vous ne verrez plus ses messages.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bloquer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/moderation/block', { userId });
            setActiveMatch(null);
            await loadMatches();
          } catch (err) {
            Alert.alert('Erreur', 'Impossible de bloquer ce profil');
          }
        },
      },
    ]);
  }, [getTargetUserId, loadMatches]);

  const reportProfile = useCallback(() => {
    const userId = getTargetUserId();
    if (!userId) return;
    const submit = async (reason: string) => {
      try {
        await api.post('/moderation/report', { userId, reason });
        Alert.alert('Merci', 'Signalement envoye.');
      } catch (err) {
        Alert.alert('Erreur', 'Impossible de signaler ce profil');
      }
    };
    Alert.alert('Signaler', 'Choisissez une raison', [
      { text: 'Spam', onPress: () => submit('spam') },
      { text: 'Faux profil', onPress: () => submit('fake') },
      { text: 'Contenu inapproprie', onPress: () => submit('abuse') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [getTargetUserId]);

  const endConversation = useCallback(() => {
    const matchId = activeMatchRef.current?.id;
    if (!matchId) return;
    Alert.alert('Terminer la conversation ?', 'Les messages seront supprimes.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/messages/${matchId}/clear`, {});
            setMessages([]);
            setActiveMatch(null);
            await loadMatches();
          } catch (err) {
            Alert.alert('Erreur', 'Impossible de terminer la conversation');
          }
        },
      },
    ]);
  }, [loadMatches]);

  const openOptions = useCallback(() => {
    if (!activeMatchRef.current) return;
    Alert.alert('Options', '', [
      { text: 'Actualiser', onPress: refreshConversation },
      { text: 'Signaler', onPress: reportProfile },
      { text: 'Bloquer', style: 'destructive', onPress: blockProfile },
      { text: 'Terminer la conversation', style: 'destructive', onPress: endConversation },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [refreshConversation, reportProfile, blockProfile, endConversation]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const data = await api.get('/profile/me');
      const id = String(data?.id || data?._id || '');
      setCurrentUserId(id || null);
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  useEffect(() => {
    loadMatches();
    loadCurrentUser();
    loadLikesCount();
  }, [loadMatches, loadCurrentUser, loadLikesCount]);

  useEffect(() => {
    activeMatchRef.current = activeMatch;
    setActiveMatchId(activeMatch?.id ? String(activeMatch.id) : null);
  }, [activeMatch]);

  useEffect(() => {
    return () => setActiveMatchId(null);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const socket = connectSocket(currentUserId);
    if (!socket) return;

    const handleNewMessage = async (payload: any) => {
      const matchId = String(payload?.match_id || '');
      const messageId = getMessageId(payload);
      const isIncoming = String(payload?.to_user_id) === String(currentUserId);
      const activeId = String(activeMatchRef.current?.id || '');

      if (matchId && activeId && matchId === activeId) {
        setMessages((prev) => upsertMessage(prev, payload));
        if (isIncoming) {
          try {
            await api.post(`/messages/${matchId}/received`, messageId ? { messageId } : {});
            await api.post(`/messages/${matchId}/read`, messageId ? { messageId } : {});
          } catch {
            // Ignore delivery errors in realtime handler.
          }
        }
      } else {
        if (isIncoming && matchId) {
          try {
            await api.post(`/messages/${matchId}/received`, messageId ? { messageId } : {});
          } catch {
            // Ignore delivery errors in realtime handler.
          }
        }
        loadMatches();
      }
    };

    const handleStatus = (payload: any) => {
      const messageId = String(payload?.message_id || payload?.id || payload?._id || '');
      if (!messageId) return;
      const matchId = String(payload?.match_id || '');
      const activeId = String(activeMatchRef.current?.id || '');
      if (matchId && activeId && matchId !== activeId) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (getMessageId(msg) !== messageId) return msg;
          return {
            ...msg,
            delivered_at: payload?.delivered_at || msg.delivered_at,
            read_at: payload?.read_at || msg.read_at,
            listened_at: payload?.listened_at || msg.listened_at,
            status: payload?.status || msg.status,
          };
        }),
      );
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:status', handleStatus);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:status', handleStatus);
    };
  }, [currentUserId, loadMatches, upsertMessage]);

  const selectMatch = useCallback(async (match: any) => {
    try {
      setActiveMatch(match);
      const data = await api.get(`/messages/${match.id}`);
      const list = Array.isArray(data) ? data : [];
      setMessages(dedupeByKey(list, (m: any) => getMessageId(m)));
      await api.post(`/messages/${match.id}/received`, {});
      await api.post(`/messages/${match.id}/read`, {});
      setMatches((prev) =>
        prev.map((item) =>
          String(item.id) === String(match.id) ? { ...item, unread_count: 0 } : item,
        ),
      );
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de charger les messages');
    }
  }, [dedupeByKey]);

  useEffect(() => {
    const matchId = pendingMatchId;
    if (!matchId) return;
    if (handledMatchIdRef.current === matchId) return;
    const found = matches.find((item) => String(item?.id || item?._id || '') === String(matchId));
    if (!found) return;
    handledMatchIdRef.current = matchId;
    selectMatch(found);
  }, [pendingMatchId, matches, selectMatch]);

  const sendMessage = async () => {
    if (!activeMatch || !text.trim()) return;
    const data = await api.post(`/messages/${activeMatch.id}`, { content: text.trim() });
    setMessages((prev) => upsertMessage(prev, data));
    setText('');
    await loadMatches();
  };

  const pickImage = async () => {
    if (!activeMatch) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    Alert.alert('Envoyer cette photo ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Envoyer',
        onPress: async () => {
          const form = new FormData();
          form.append('image', {
            uri: asset.uri,
            name: `image-${Date.now()}.jpg`,
            type: asset.type ? `${asset.type}/jpeg` : 'image/jpeg',
          } as any);
          const data = await api.upload(`/messages/${activeMatch.id}/image`, form);
          setMessages((prev) => upsertMessage(prev, data));
          await loadMatches();
        },
      },
    ]);
  };

  const toggleRecording = async () => {
    if (!activeMatch) return;
    if (voiceUploading) return;
    if (isRecording && recording) {
      setVoiceUploading(true);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setIsRecording(false);
        setRecording(null);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        if (!uri) {
          Alert.alert('Erreur', "Enregistrement introuvable.");
          return;
        }
        const ext = String(uri.split('.').pop() || 'm4a').toLowerCase();
        const safeExt = ['m4a', 'aac', 'wav', 'mp3'].includes(ext) ? ext : 'm4a';
        const mime =
          safeExt === 'wav'
            ? 'audio/wav'
            : safeExt === 'aac'
              ? 'audio/aac'
              : safeExt === 'mp3'
                ? 'audio/mpeg'
                : 'audio/mp4';
        const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
        const form = new FormData();
        form.append('audio', {
          uri: normalizedUri,
          name: `voice-${Date.now()}.${safeExt}`,
          type: mime,
        } as any);
        const data = await api.upload(`/messages/${activeMatch.id}/audio`, form);
        setMessages((prev) => upsertMessage(prev, data));
        await loadMatches();
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err || '');
        const detail = raw ? `\n${raw}` : '';
        Alert.alert('Erreur', `Impossible d'envoyer le message vocal.${detail}`);
      } finally {
        setVoiceUploading(false);
      }
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Micro requis', 'Autorisez le micro pour enregistrer un message vocal.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(recordingOptions);
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      setRecording(null);
      setIsRecording(false);
      const raw = err instanceof Error ? err.message : String(err || '');
      const detail = raw ? `\n${raw}` : '';
      Alert.alert('Erreur', `Impossible de demarrer l'enregistrement.${detail}`);
    }
  };

  const newMatches = useMemo(() => matches.filter((m) => !m.has_messages), [matches]);
  const threads = useMemo(() => {
    const list = Array.isArray(matches) ? [...matches] : [];
    return list.sort((a, b) => {
      const aTime = new Date(a?.last_message_at || a?.created_at || 0).getTime();
      const bTime = new Date(b?.last_message_at || b?.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [matches]);

  const likesCountDisplay = useMemo(() => (likesCount > 99 ? '99+' : String(Math.max(0, likesCount || 0))), [likesCount]);

  const shortName = useCallback((name: any) => {
    const raw = String(name || '').trim();
    if (!raw) return '';
    const first = raw.split(/\s+/).filter(Boolean)[0] || raw;
    return first.length > 10 ? `${first.slice(0, 10)}…` : first;
  }, []);

  const previewText = useCallback((match: any) => {
    const last = match?.last_message;
    if (last) {
      if (last.type === 'image') return 'Photo';
      if (last.type === 'audio') return 'Message vocal';
      const content = String(last.content || '').trim();
      return content || 'Message';
    }
    if (!match?.has_messages) return 'Activite recente, Matche des maintenant...';
    return 'Discussion';
  }, []);

  if (!activeMatch) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: '#fff' }]}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 90 }}
      >
        <View style={styles.messagesHead}>
          <Text style={styles.messagesTitle}>Messages</Text>
          <View style={styles.messagesActionPill}>
            <Pressable style={styles.iconBtn} accessibilityLabel="Securite">
              <Ionicons name="shield-checkmark-outline" size={18} color="rgba(26,26,29,0.65)" />
            </Pressable>
            <Pressable style={styles.iconBtn} accessibilityLabel="Cle">
              <Ionicons name="key-outline" size={18} color="rgba(26,26,29,0.65)" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.blockTitle}>Nouveaux Matchs</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchStrip}>
          <Pressable style={styles.likesTile} onPress={() => router.push('/(tabs)/actions')}>
            <View style={styles.likesTileBox}>
              <View style={styles.likesCountCircle}>
                <Text style={styles.likesCountText}>{likesCountDisplay}</Text>
              </View>
            </View>
            <Ionicons name="heart" size={18} color="rgba(255,183,3,0.95)" style={{ marginTop: 8 }} />
            <Text style={styles.matchLabel}>Likes</Text>
          </Pressable>

          {newMatches.map((item) => (
            <Pressable key={`match-${item.id}`} style={styles.matchChipRound} onPress={() => selectMatch(item)}>
              <View style={styles.matchAvatarWrap}>
                <Image
                  source={{
                    uri:
                      resolvePhoto(item.user?.photos?.[0]) ||
                      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
                  }}
                  style={styles.matchAvatarRound}
                />
                <View style={styles.newDot} />
              </View>
              <View style={styles.matchNameRow}>
                <Text style={styles.matchLabel} numberOfLines={1}>
                  {shortName(item.user?.name)}
                </Text>
                {item.user?.verified_photo ? (
                  <Ionicons name="checkmark-circle" size={14} color="#2b7cff" />
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.blockTitle, { marginTop: 16 }]}>Messages</Text>
        <View style={styles.threadList}>
          {threads.map((item, idx) => {
            const pill =
              item.unread_count > 0 ? { text: 'A TON TOUR', style: styles.pillTurn } :
              !item.has_messages ? { text: 'TA ENVOYE UN LIKE', style: styles.pillLike } :
              null;
            const pillTextStyle = item.unread_count > 0 ? styles.pillTextLight : !item.has_messages ? styles.pillTextDark : styles.pillTextLight;

            return (
              <Pressable
                key={`${String(item?.id || item?._id || 'thread')}-${idx}`}
                style={styles.threadRow}
                onPress={() => selectMatch(item)}
              >
                <View style={styles.threadAvatarWrap}>
                  <Image
                    source={{
                      uri:
                        resolvePhoto(item.user?.photos?.[0]) ||
                        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
                    }}
                    style={styles.threadAvatar}
                  />
                  {item.unread_count > 0 ? <View style={styles.threadDot} /> : null}
                </View>
                <View style={styles.threadMain}>
                  <View style={styles.threadTop}>
                    <View style={styles.threadNameRow}>
                      <Text style={styles.threadName} numberOfLines={1}>
                        {item.user?.name}
                      </Text>
                      {item.user?.verified_photo ? (
                        <Ionicons name="checkmark-circle" size={16} color="#2b7cff" />
                      ) : null}
                    </View>
                    {pill ? (
                      <View style={[styles.pillBase, pill.style]}>
                        <Text style={[styles.pillTextBase, pillTextStyle]}>{pill.text}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.threadSnippet} numberOfLines={1}>
                    {previewText(item)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View
        style={[
          styles.chatCard,
          { backgroundColor: colors.card },
          // Keep the input row visible when the floating tab bar is present.
          { paddingBottom: Math.max(12, tabBarTopOffset) },
        ]}
      >
        <View style={styles.chatHeader}>
          <Pressable onPress={() => setActiveMatch(null)}>
            <Text style={styles.backText}>Retour</Text>
          </Pressable>
          <View style={styles.chatAvatarWrap}>
            <Image
              source={{
                uri:
                  resolvePhoto(activeMatch.user?.photos?.[0]) ||
                  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
              }}
              style={styles.chatAvatar}
            />
          </View>
          <View style={styles.chatTitleWrap} />
        </View>
        <Pressable style={styles.chatMenuFloating} onPress={openOptions}>
          <Ionicons name="ellipsis-vertical" size={18} color="#6b7280" />
        </Pressable>
        <ScrollView
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, idx) => {
            const isFromOther = String(msg.from_user_id) === String(activeMatch.user?.id);
            const isMine = currentUserId
              ? String(msg.from_user_id) === String(currentUserId)
              : !isFromOther;
            const messageId = getMessageId(msg);
            const status = msg.status || (msg.read_at ? 'read' : msg.delivered_at ? 'received' : 'sent');
            const statusLabel = status === 'read' ? 'Lu' : status === 'received' ? 'Recu' : 'Envoye';

            return (
              <View
                key={`${String(messageId || msg?.id || msg?._id || 'msg')}-${idx}`}
                style={[
                  styles.messageBubble,
                  isFromOther ? styles.messageThem : styles.messageMe,
                ]}
              >
                {msg.type === 'text' ? (
                  <Text
                    style={[
                      styles.messageText,
                      isFromOther ? styles.messageTextDark : styles.messageTextLight,
                    ]}
                  >
                    {msg.content}
                  </Text>
                ) : msg.type === 'image' ? (
                  <Pressable onPress={() => setLightboxUri(resolvePhoto(msg.media_url))}>
                    <Image source={{ uri: resolvePhoto(msg.media_url) }} style={styles.messageImage} />
                  </Pressable>
                ) : msg.type === 'audio' ? (
                <AudioPlayer
                  uri={resolvePhoto(msg.media_url)}
                  isMine={isMine}
                  listened={Boolean(msg.listened_at) || (messageId ? listenedIds.includes(messageId) : false)}
                  onPlayed={() => markAudioListened(msg)}
                />
                ) : (
                  <Text style={styles.messageText}>Message non supporte.</Text>
                )}
                {isMine ? (
                  <Text style={[styles.messageStatus, styles.messageStatusLight]}>
                    {statusLabel}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {isRecording ? (
          <Text style={[styles.recordingHint, { color: colors.text }]}>
            Enregistrement... appuyez sur le micro pour envoyer.
          </Text>
        ) : null}
        {voiceUploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color="#ff5a5f" />
            <Text style={[styles.uploadingText, { color: colors.text }]}>
              Envoi du message vocal...
            </Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <Pressable style={styles.attachButton} onPress={pickImage}>
            <Ionicons name="image" size={20} color="#6b7280" />
          </Pressable>
          <View style={styles.inputWrap}>
            <Pressable style={[styles.iconButton, isRecording && styles.recording]} onPress={toggleRecording}>
              <Ionicons name="mic" size={18} color={isRecording ? '#fff' : '#6b7280'} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              value={text}
              onChangeText={setText}
            />
            <Pressable style={styles.sendButton} onPress={sendMessage}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
        <Modal visible={!!lightboxUri} transparent animationType="fade">
          <Pressable style={styles.lightboxBackdrop} onPress={() => setLightboxUri(null)}>
            {lightboxUri ? (
              <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
            ) : null}
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

function AudioPlayer({
  uri,
  listened = false,
  onPlayed,
  isMine = false,
}: {
  uri: string;
  listened?: boolean;
  onPlayed?: () => void;
  isMine?: boolean;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [markedPlayed, setMarkedPlayed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const textColor = listened ? '#3b82f6' : isMine ? '#fff' : '#111';
  const baseBg = isMine ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,29,0.06)';
  const listenedBg = isMine ? 'rgba(255,255,255,0.36)' : 'rgba(59,130,246,0.12)';

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    setLoadError(null);
    setPlaying(false);
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
  }, [uri]);

  const markPlayed = () => {
    if (markedPlayed || listened) return;
    setMarkedPlayed(true);
    if (onPlayed) onPlayed();
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Audio timeout')), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  const resolvePlayableUri = async () => {
    if (!uri) return '';
    if (uri.startsWith('file://')) return uri;
    if (!FileSystem.cacheDirectory) return uri;
    const baseName = (uri.split('?')[0].split('/').pop() || `voice-${Date.now()}.m4a`)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const localUri = `${FileSystem.cacheDirectory}${baseName}`;
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists || !info.size) {
        await withTimeout(FileSystem.downloadAsync(encodeURI(uri), localUri), 15000);
      }
      const finalInfo = await FileSystem.getInfoAsync(localUri);
      if (finalInfo.exists && finalInfo.size) return localUri;
      return localUri;
    } catch {
      return uri;
    }
  };

  const toggle = async () => {
    if (!uri) {
      Alert.alert('Erreur audio', "Fichier audio introuvable.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const mode: Audio.AudioMode = {
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      };
      const androidMode = (Audio as any).InterruptionModeAndroid?.DuckOthers;
      const iosMode = (Audio as any).InterruptionModeIOS?.DuckOthers;
      if (androidMode != null) {
        (mode as any).interruptionModeAndroid = androidMode;
      }
      if (iosMode != null) {
        (mode as any).interruptionModeIOS = iosMode;
      }
      await Audio.setAudioModeAsync(mode);

      if (!sound) {
        const sourceUri = await resolvePlayableUri();
        const createPromise = Audio.Sound.createAsync(
          { uri: sourceUri },
          { shouldPlay: true },
          undefined,
          true,
        );
        const { sound: newSound } = await withTimeout(createPromise, 30000);
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            if (status.error) {
              setLoadError(status.error);
              setPlaying(false);
            }
            return;
          }
          if (status.didJustFinish) {
            setPlaying(false);
            newSound.unloadAsync();
            setSound(null);
          }
        });
        setSound(newSound);
        setPlaying(true);
        markPlayed();
        return;
      }

      if (playing) {
        await withTimeout(sound.pauseAsync(), 5000);
        setPlaying(false);
      } else {
        await withTimeout(sound.playAsync(), 5000);
        setPlaying(true);
        markPlayed();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err || '');
      setLoadError(raw || 'Audio error');
      Alert.alert('Erreur audio', raw || "Impossible de lire le message vocal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={[
          styles.audioButton,
          { backgroundColor: listened ? listenedBg : baseBg, borderColor: listened ? 'rgba(59,130,246,0.3)' : 'rgba(26,26,29,0.08)' },
        ]}
      >
        <Ionicons name="mic" size={18} color={textColor} />
        <Text style={[styles.audioLabel, { color: textColor }]}>Vocal</Text>
        <View style={styles.audioSpacer} />
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color={textColor} />
        )}
      </Pressable>
      {loadError ? (
        <Text style={styles.audioError} numberOfLines={2}>
          {loadError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  messagesHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  messagesTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#111',
  },
  messagesActionPill: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    backgroundColor: 'rgba(26,26,29,0.06)',
    borderRadius: 999,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(26,26,29,0.12)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    marginTop: 10,
    marginBottom: 8,
  },
  matchStrip: {
    gap: 14,
    paddingBottom: 4,
  },
  likesTile: {
    width: 74,
    alignItems: 'center',
  },
  likesTileBox: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,183,3,0.9)',
    backgroundColor: 'rgba(255,183,3,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likesCountCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,183,3,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likesCountText: {
    fontWeight: '900',
    color: '#231a00',
  },
  matchChipRound: {
    width: 74,
    alignItems: 'center',
  },
  matchAvatarWrap: {
    width: 66,
    height: 66,
    borderRadius: 999,
  },
  matchAvatarRound: {
    width: 66,
    height: 66,
    borderRadius: 999,
  },
  newDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#ff5a5f',
    borderWidth: 3,
    borderColor: '#fff',
  },
  matchLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  threadList: {
    flexDirection: 'column',
  },
  threadRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,26,29,0.10)',
  },
  threadAvatarWrap: {
    width: 54,
    height: 54,
  },
  threadAvatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
  },
  threadDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#28c76f',
    borderWidth: 3,
    borderColor: '#fff',
  },
  threadMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    paddingTop: 2,
  },
  threadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  threadNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  threadName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
    flexShrink: 1,
  },
  threadSnippet: {
    fontSize: 13,
    color: 'rgba(26,26,29,0.62)',
  },
  pillBase: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pillTurn: {
    backgroundColor: '#12131a',
  },
  pillLike: {
    backgroundColor: 'rgba(255,183,3,0.38)',
  },
  pillTextBase: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  pillTextLight: {
    color: '#fff',
  },
  pillTextDark: {
    color: '#6a4a00',
  },
  chatCard: {
    borderRadius: 18,
    padding: 12,
    gap: 12,
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
  },
  chatTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  chatMenuFloating: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,26,29,0.06)',
    zIndex: 5,
  },
  chatAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  chatAvatar: {
    width: 36,
    height: 36,
  },
  backText: {
    color: '#ff5a5f',
    fontWeight: '600',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    gap: 8,
    paddingBottom: 6,
  },
  recordingHint: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  uploadingText: {
    fontSize: 12,
    opacity: 0.7,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#ff5a5f',
  },
  messageThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    color: '#111',
  },
  messageTextLight: {
    color: '#fff',
  },
  messageTextDark: {
    color: '#111',
  },
  messageStatus: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageStatusLight: {
    color: 'rgba(255,255,255,0.85)',
  },
  messageImage: {
    width: 180,
    height: 140,
    borderRadius: 12,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  audioLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  audioSpacer: {
    flex: 1,
  },
  audioError: {
    marginTop: 4,
    fontSize: 11,
    color: '#ef4444',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7eaf2',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(26,26,29,0.08)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,26,29,0.08)',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,26,29,0.08)',
  },
  recording: {
    backgroundColor: '#ff5a5f',
    borderColor: '#ff5a5f',
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ff5a5f',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
