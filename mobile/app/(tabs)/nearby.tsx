import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VerificationReminderCard from '@/components/VerificationReminderCard';
import { api } from '@/lib/api';
import { resolvePhoto, computeAge, sanitizePublicProfiles } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';
import { isVerificationRequiredError, showVerificationRequiredPrompt } from '@/lib/verification-gate';

export default function NearbyScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'approved' | 'pending' | 'rejected' | 'none'>('none');
  const canInteract = verificationStatus === 'approved';

  const syncVerificationStatus = async () => {
    const statusData = await api.get(`/profile/verification-status?ts=${Date.now()}`);
    const nextStatus = statusData?.status || 'none';
    setVerificationStatus(nextStatus);
    return nextStatus === 'approved';
  };

  const load = async () => {
    setLoading(true);
    try {
      const [data, statusData] = await Promise.all([
        api.get('/profile/nearby'),
        api.get(`/profile/verification-status?ts=${Date.now()}`),
      ]);
      setProfiles(sanitizePublicProfiles(data || []));
      setVerificationStatus(statusData?.status || 'none');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les profils proches';
      Alert.alert('Erreur proches', message);
    } finally {
      setLoading(false);
    }
  };

  const promptVerificationRequired = () => {
    showVerificationRequiredPrompt(() => {
      router.push(`/profile?promptVerification=${Date.now()}`);
    });
  };

  const goToVerification = () => {
    router.push(`/profile?promptVerification=${Date.now()}`);
  };

  const updateLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setNotice('Autorisez la localisation pour voir les profils proches.');
      return false;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await api.post('/profile/location', {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });
    return true;
  };

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    const init = async () => {
      try {
        await updateLocation();
      } catch (err) {
        setNotice('Impossible de recuperer la localisation.');
      } finally {
        load();
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: 50,
            },
            (pos) => {
              api.post('/profile/location', {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }).catch(() => {});
            }
          );
        }
      } catch {
        // ignore
      }
    };

    init();
    return () => {
      subscription?.remove();
    };
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

  const like = async (profile: any) => {
    if (!profile?.id) return;
    if (!canInteract) {
      const approved = await syncVerificationStatus().catch(() => false);
      if (!approved) {
        promptVerificationRequired();
        return;
      }
    }
    try {
      const data = await api.post('/match/like', { userId: profile.id, action: 'like' });
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));

      const matchId = String(data?.match?.id || data?.match?._id || '');
      const matchCreated = data?.match_created === true;
      if (matchId && matchCreated) {
        const name = String(profile?.name || 'ce profil');
        Alert.alert(
          "C'est un match",
          `Toi et ${name}, vous vous plaisez. Envoie-lui un message pour briser la glace.`,
          [
            { text: 'Continuer', style: 'cancel' },
            {
              text: 'Envoyer un message',
              onPress: () => router.push({ pathname: '/(tabs)/messages', params: { matchId } }),
            },
          ],
        );
      }
    } catch (err) {
      if (isVerificationRequiredError(err)) {
        await syncVerificationStatus().catch(() => {});
        promptVerificationRequired();
        return;
      }
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de liker ce profil');
    }
  };

  const openProfile = (profile: any) => {
    if (!profile?.id) return;
    router.push(`/user/${profile.id}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <BrandMark />
      <Text style={[styles.title, { color: colors.text }]}>Pres de vous</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>Profils a proximite.</Text>
      {notice ? <Text style={[styles.notice, { color: colors.text }]}>{notice}</Text> : null}
      <VerificationReminderCard status={verificationStatus} onVerifyNow={goToVerification} />

      {loading && <Text style={[styles.subtitle, { color: colors.text }]}>Chargement...</Text>}

      <View style={styles.cards}>
        {profiles.map((profile) => (
          <View key={profile.id} style={[styles.card, { backgroundColor: colors.card }]}>
            <Pressable onPress={() => openProfile(profile)}>
              <Image
                source={{ uri: resolvePhoto(profile.photos?.[0]) || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80' }}
                style={styles.cardImage}
              />
            </Pressable>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {profile.name} · {computeAge(profile.birthdate) === '-' ? profile.age : computeAge(profile.birthdate)}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.text }]}>
              {profile.distance_km} km · {profile.location}
            </Text>
            <View style={styles.actions}>
              <Pressable style={styles.likeButton} onPress={() => like(profile)}>
                <Text style={styles.likeText}>Like</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  notice: {
    fontSize: 13,
    color: '#8b1e2d',
    marginBottom: 12,
  },
  noticeCard: {
    marginBottom: 12,
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
  cards: {
    gap: 14,
  },
  card: {
    borderRadius: 20,
    padding: 12,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  actions: {
    marginTop: 10,
  },
  likeButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  likeText: {
    fontWeight: '600',
  },
});
