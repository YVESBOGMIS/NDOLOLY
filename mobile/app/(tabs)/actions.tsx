import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/lib/api';
import { resolvePhoto } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';
import { isVerificationRequiredError, showVerificationRequiredPrompt } from '@/lib/verification-gate';

export default function ActionsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [tab, setTab] = useState<'likes' | 'views'>('likes');
  const [likes, setLikes] = useState<any[]>([]);
  const [likesPremiumRequired, setLikesPremiumRequired] = useState(false);
  const [views, setViews] = useState<any[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<'approved' | 'pending' | 'rejected' | 'none'>('none');
  const router = useRouter();
  const canInteract = verificationStatus === 'approved';

  const syncVerificationStatus = async () => {
    const statusData = await api.get(`/profile/verification-status?ts=${Date.now()}`);
    const nextStatus = statusData?.status || 'none';
    setVerificationStatus(nextStatus);
    return nextStatus === 'approved';
  };

  const load = async () => {
    try {
      const [viewsData, statusData] = await Promise.all([
        api.get('/profile/views'),
        api.get(`/profile/verification-status?ts=${Date.now()}`),
      ]);
      setVerificationStatus(statusData?.status || 'none');
      setViews(viewsData || []);
      try {
        const likesData = await api.get('/match/liked-me');
        setLikes(likesData || []);
        setLikesPremiumRequired(false);
      } catch (err) {
        if (err instanceof Error && /premium required/i.test(err.message)) {
          setLikes([]);
          setLikesPremiumRequired(true);
        } else {
          throw err;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger Likes/Vues';
      Alert.alert('Erreur actions', message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [])
  );

  useEffect(() => {
    if (verificationStatus === 'approved') return;
    const handle = setInterval(() => {
      syncVerificationStatus().catch(() => {});
    }, 5000);
    return () => clearInterval(handle);
  }, [verificationStatus]);

  const promptVerificationRequired = () => {
    showVerificationRequiredPrompt(() => {
      router.push(`/profile?promptVerification=${Date.now()}`);
    });
  };

  const likeBack = async (profile: any) => {
    if (!profile?.id) return;
    if (!canInteract) {
      const approved = await syncVerificationStatus().catch(() => false);
      if (!approved) {
        promptVerificationRequired();
        return;
      }
    }
    try {
      await api.post('/match/like', { userId: profile.id, action: 'like' });
      setViews((prev) => prev.filter((p) => p.id !== profile.id));
      await load();
    } catch (err) {
      if (isVerificationRequiredError(err)) {
        await syncVerificationStatus().catch(() => {});
        promptVerificationRequired();
        return;
      }
      Alert.alert('Erreur', err instanceof Error ? err.message : "Impossible d'envoyer le like");
    }
  };

  const openProfile = (profile: any) => {
    if (!profile?.id) return;
    router.push(`/user/${profile.id}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <BrandMark />
      <View style={[styles.segment, { backgroundColor: colors.card }]}>
        <Pressable
          style={[styles.segmentButton, tab === 'likes' && styles.segmentActive]}
          onPress={() => setTab('likes')}
        >
          <Text style={[styles.segmentText, { color: colors.text }]}>Likes</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, tab === 'views' && styles.segmentActive]}
          onPress={() => setTab('views')}
        >
          <Text style={[styles.segmentText, { color: colors.text }]}>Vues</Text>
        </Pressable>
      </View>

      {!canInteract ? (
        <Pressable style={styles.noticeCard} onPress={promptVerificationRequired}>
          <Text style={styles.noticeTitle}>Verification photo requise</Text>
          <Text style={styles.noticeText}>
            Vous devez verifier votre profil avant de liker en retour. Appuyez ici pour envoyer une photo.
          </Text>
        </Pressable>
      ) : null}

      {tab === 'likes' ? (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Ils vous aiment</Text>
          {likesPremiumRequired ? (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Fonction premium</Text>
              <Text style={[styles.cardSubtitle, { color: colors.text }]}>
                Seuls les profils premium peuvent voir qui les a likes.
              </Text>
            </View>
          ) : null}
          <View style={styles.cards}>
            {likes.map((profile) => (
              <View key={profile.id} style={[styles.card, { backgroundColor: colors.card }]}>
                <Image
                  source={{ uri: resolvePhoto(profile.photos?.[0]) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80' }}
                  style={styles.cardImage}
                />
                <Text style={[styles.cardTitle, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.text }]}>{profile.location}</Text>
                <View style={styles.actions}>
                  <Pressable style={styles.secondary} onPress={() => openProfile(profile)}>
                    <Text style={styles.actionText}>Voir profil</Text>
                  </Pressable>
                  <Pressable style={styles.primary} onPress={() => likeBack(profile)}>
                    <Text style={styles.actionTextLight}>Like en retour</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: colors.text }]}>Vues</Text>
          <View style={styles.cards}>
            {views.map((profile) => (
              <View key={profile.id} style={[styles.card, { backgroundColor: colors.card }]}>
                <Image
                  source={{ uri: resolvePhoto(profile.photos?.[0]) || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80' }}
                  style={styles.cardImage}
                />
                <Text style={[styles.cardTitle, { color: colors.text }]}>{profile.name}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.text }]}>{profile.location}</Text>
                <Text style={[styles.cardDate, { color: colors.text }]}>Vu le {new Date(profile.viewed_at).toLocaleString()}</Text>
                <View style={styles.actions}>
                  <Pressable style={styles.secondary} onPress={() => openProfile(profile)}>
                    <Text style={styles.actionText}>Voir profil</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#ff5a5f',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noticeCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 95, 0.28)',
  },
  noticeTitle: {
    color: '#c72642',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    color: '#7d1e2e',
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  cards: {
    gap: 14,
  },
  card: {
    borderRadius: 20,
    padding: 12,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  cardDate: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 6,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  primary: {
    flex: 1,
    backgroundColor: '#ff5a5f',
    padding: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  secondary: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  actionText: {
    fontWeight: '600',
  },
  actionTextLight: {
    color: '#fff',
    fontWeight: '600',
  },
});
