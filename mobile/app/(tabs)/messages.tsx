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

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/lib/api';
import { resolvePhoto, sanitizePublicMatches } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';
import { connectSocket, setActiveMatchId } from '@/lib/realtime';

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
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

  const getMessageId = (msg: any) => String(msg?.id || msg?._id || msg?.message_id || '');
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
      setMatches(sanitizePublicMatches(data || []));
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de charger les conversations');
    }
  }, []);

  const refreshConversation = useCallback(async () => {
    if (!activeMatchRef.current?.id) return;
    const matchId = activeMatchRef.current.id;
    try {
      const data = await api.get(`/messages/${matchId}`);
      setMessages(data || []);
      await api.post(`/messages/${matchId}/received`, {});
      await api.post(`/messages/${matchId}/read`, {});
      await loadMatches();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de rafraichir la conversation');
    }
  }, [loadMatches]);

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
  }, [loadMatches, loadCurrentUser]);

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

  const selectMatch = async (match: any) => {
    try {
      setActiveMatch(match);
      const data = await api.get(`/messages/${match.id}`);
      setMessages(data || []);
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
  };

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
  const conversations = useMemo(() => matches.filter((m) => m.has_messages), [matches]);

  if (!activeMatch) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}> 
        <BrandMark />
        <Text style={[styles.title, { color: colors.text }]}>Messages</Text>

        <View style={styles.cards}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Nouveaux matchs</Text>
          {newMatches.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchRow}
            >
              {newMatches.map((item) => (
                <Pressable
                  key={`match-${item.id}`}
                  style={[styles.matchChip, { backgroundColor: colors.card }]}
                  onPress={() => selectMatch(item)}
                >
                  <Image
                    source={{ uri: resolvePhoto(item.user?.photos?.[0]) || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' }}
                    style={styles.matchAvatar}
                  />
                  <Text style={[styles.matchName, { color: colors.text }]} numberOfLines={1}>
                    {item.user?.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.subtleText, { color: colors.text }]}>Aucun nouveau match.</Text>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Conversations</Text>
          {conversations.length > 0 ? (
            <View style={styles.conversationList}>
              {conversations.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.card, { backgroundColor: colors.card }]}
                  onPress={() => selectMatch(item)}
                >
                  <View style={styles.avatarWrap}>
                    <Image
                      source={{ uri: resolvePhoto(item.user?.photos?.[0]) || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' }}
                      style={styles.avatar}
                    />
                    {item.unread_count > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.user?.name}</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.text }]}>{item.user?.location}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.subtleText, { color: colors.text }]}>Aucune conversation.</Text>
          )}
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
      <View style={[styles.chatCard, { backgroundColor: colors.card }]}> 
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
          {messages.map((msg) => {
            const isFromOther = String(msg.from_user_id) === String(activeMatch.user?.id);
            const isMine = currentUserId
              ? String(msg.from_user_id) === String(currentUserId)
              : !isFromOther;
            const messageId = getMessageId(msg);
            const status = msg.status || (msg.read_at ? 'read' : msg.delivered_at ? 'received' : 'sent');
            const statusLabel = status === 'read' ? 'Lu' : status === 'received' ? 'Recu' : 'Envoye';

            return (
              <View
                key={msg.id || msg._id}
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtleText: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 12,
  },
  cards: {
    gap: 12,
  },
  matchRow: {
    gap: 10,
    paddingBottom: 10,
  },
  matchChip: {
    width: 84,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  matchAvatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    marginBottom: 6,
  },
  matchName: {
    fontSize: 12,
    fontWeight: '600',
  },
  conversationList: {
    gap: 12,
  },
  card: {
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 56,
    height: 56,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff5a5f',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.6,
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
