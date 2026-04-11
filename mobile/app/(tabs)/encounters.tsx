import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Alert, GestureResponderEvent, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import VerificationReminderCard from '@/components/VerificationReminderCard';
import { api } from '@/lib/api';
import { computeAge, resolvePhoto, sanitizePublicProfiles } from '@/lib/utils';
import { getFilters } from '@/lib/filters';
import { isVerificationRequiredError, showVerificationRequiredPrompt } from '@/lib/verification-gate';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80';

const SWIPE_STATE_KEY = 'loveconnect.swipeState.v1';

type SwipeState = {
  filterKey: string;
  seenIds: string[];
  currentId: string | null;
};

const readSwipeState = async (): Promise<SwipeState | null> => {
  const raw = await SecureStore.getItemAsync(SWIPE_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      filterKey: typeof parsed.filterKey === 'string' ? parsed.filterKey : '',
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds.map(String) : [],
      currentId: parsed.currentId ? String(parsed.currentId) : null,
    };
  } catch {
    return null;
  }
};

const writeSwipeState = async (state: SwipeState) => {
  await SecureStore.setItemAsync(SWIPE_STATE_KEY, JSON.stringify(state));
};

const findNextUnseenIndex = (list: any[], seen: Set<string>, start = 0) => {
  for (let i = start; i < list.length; i += 1) {
    const id = list[i]?.id;
    if (!id) continue;
    if (!seen.has(String(id))) return i;
  }
  return -1;
};

export default function EncountersScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [feedKey, setFeedKey] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'approved' | 'pending' | 'rejected' | 'none'>('none');
  const seenRef = React.useRef<Set<string>>(new Set());
  const current = feed[cursor];
  const canInteract = verificationStatus === 'approved';

  const syncVerificationStatus = useCallback(async () => {
    const statusData = await api.get(`/profile/verification-status?ts=${Date.now()}`);
    const nextStatus = statusData?.status || 'none';
    setVerificationStatus(nextStatus);
    return nextStatus === 'approved';
  }, []);

  const photos = useMemo(() => {
    if (!current) return [];
    const raw = Array.isArray(current.photos) ? current.photos : [];
    const list = raw.map((photo: any) => resolvePhoto(photo)).filter(Boolean);
    return list.length > 0 ? list : [FALLBACK_PHOTO];
  }, [current]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [current?.id]);

  const currentPhoto = photos[photoIndex] || photos[0];

  const buildFilterParams = (saved: Record<string, string>) => {
    const params = new URLSearchParams();
    if (saved.ageMin) params.set('age_min', saved.ageMin);
    if (saved.ageMax) params.set('age_max', saved.ageMax);
    if (saved.city) params.set('city', saved.city);
    if (saved.children) params.set('children', saved.children);
    if (saved.smoker) params.set('smoker', saved.smoker);
    if (saved.religion) params.set('religion', saved.religion);
    const key = JSON.stringify({
      ageMin: saved.ageMin || '',
      ageMax: saved.ageMax || '',
      city: saved.city || '',
      children: saved.children || '',
      smoker: saved.smoker || '',
      religion: saved.religion || ''
    });
    return { params, key };
  };

  const persistState = useCallback(
    async (next: { nextCursor?: number; nextFeed?: any[]; nextKey?: string } = {}) => {
      const nextCursor = next.nextCursor ?? cursor;
      const nextFeed = next.nextFeed ?? feed;
      const nextKey = next.nextKey ?? feedKey;
      const currentId = nextFeed[nextCursor]?.id ? String(nextFeed[nextCursor].id) : null;
      await writeSwipeState({
        filterKey: nextKey,
        seenIds: Array.from(seenRef.current),
        currentId,
      });
    },
    [cursor, feed, feedKey]
  );

  const load = useCallback(
    async ({ force = false, allowRestart = true }: { force?: boolean; allowRestart?: boolean } = {}) => {
      const savedFilters = (await getFilters()) || {};
      const { params, key } = buildFilterParams(savedFilters);
      const shouldReload = force || feed.length === 0 || key !== feedKey;
      if (!shouldReload) return;

      setLoading(true);
      try {
        const stored = await readSwipeState();
        let storedSeen = new Set<string>();
        let storedCurrentId: string | null = null;
        if (stored && stored.filterKey === key) {
          storedSeen = new Set(stored.seenIds || []);
          storedCurrentId = stored.currentId ? String(stored.currentId) : null;
        }

        const path = params.toString() ? `/profile/discover?${params.toString()}` : '/profile/discover';
        const [data, statusData] = await Promise.all([
          api.get(path),
          api.get(`/profile/verification-status?ts=${Date.now()}`),
        ]);
        let nextList = sanitizePublicProfiles(Array.isArray(data) ? data : []);
        setVerificationStatus(statusData?.status || 'none');

        let nextCursor = 0;
        if (nextList.length > 0) {
          if (storedCurrentId && !storedSeen.has(storedCurrentId)) {
            const idx = nextList.findIndex((p) => String(p?.id) === storedCurrentId);
            if (idx >= 0) {
              nextCursor = idx;
            } else {
              nextCursor = findNextUnseenIndex(nextList, storedSeen, 0);
            }
          } else {
            nextCursor = findNextUnseenIndex(nextList, storedSeen, 0);
          }

          if (nextCursor === -1) {
            if (allowRestart) {
              storedSeen = new Set();
              nextCursor = 0;
            } else {
              nextList = [];
              nextCursor = 0;
            }
          }
      }

        seenRef.current = storedSeen;
        setFeed(nextList);
        setCursor(nextCursor);
        setFeedKey(key);
        await writeSwipeState({
          filterKey: key,
          seenIds: Array.from(storedSeen),
          currentId: nextList[nextCursor]?.id ? String(nextList[nextCursor].id) : null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Impossible de charger les profils';
        Alert.alert('Erreur profils', message);
      } finally {
        setLoading(false);
      }
    },
    [feed.length, feedKey]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (verificationStatus === 'approved') return;
    const handle = setInterval(() => {
      syncVerificationStatus().catch(() => {});
    }, 5000);
    return () => clearInterval(handle);
  }, [verificationStatus, syncVerificationStatus]);

  const markSeen = async (id: string) => {
    seenRef.current.add(String(id));
    await persistState();
  };

  const promptVerificationRequired = () => {
    showVerificationRequiredPrompt(() => {
      router.push(`/profile?promptVerification=${Date.now()}`);
    });
  };

  const goToVerification = () => {
    router.push(`/profile?promptVerification=${Date.now()}`);
  };

  const advance = async () => {
    const nextIndex = findNextUnseenIndex(feed, seenRef.current, cursor + 1);
    if (nextIndex >= 0) {
      setCursor(nextIndex);
      await persistState({ nextCursor: nextIndex });
      return;
    }
    await load({ force: true, allowRestart: true });
  };

  const like = async () => {
    if (!current?.id) return;
    if (!canInteract) {
      const approved = await syncVerificationStatus().catch(() => false);
      if (approved) {
        setVerificationStatus('approved');
      } else {
        promptVerificationRequired();
        return;
      }
    }
    try {
      const data = await api.post('/match/like', { userId: current.id, action: 'like' });
      await markSeen(current.id);
      const matchId = String(data?.match?.id || data?.match?._id || '');
      const matchCreated = data?.match_created === true;
      if (matchId && matchCreated) {
        const name = String(current?.name || 'ce profil');
        Alert.alert(
          "C'est un match",
          `Toi et ${name}, vous vous plaisez. Envoie-lui un message pour briser la glace.`,
          [
            { text: 'Continuer a swiper', style: 'cancel', onPress: () => advance().catch(() => {}) },
            {
              text: 'Envoyer un message',
              onPress: () => {
                advance().catch(() => {});
                router.push({ pathname: '/(tabs)/messages', params: { matchId } });
              },
            },
          ],
        );
        return;
      }
      await advance();
    } catch (err) {
      if (isVerificationRequiredError(err)) {
        await syncVerificationStatus().catch(() => {});
        promptVerificationRequired();
        return;
      }
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de liker ce profil');
    }
  };

  const pass = async () => {
    if (!current?.id) return;
    if (!canInteract) {
      const approved = await syncVerificationStatus().catch(() => false);
      if (approved) {
        setVerificationStatus('approved');
      } else {
        promptVerificationRequired();
        return;
      }
    }
    try {
      await api.post('/match/like', { userId: current.id, action: 'dislike' });
      await markSeen(current.id);
      await advance();
    } catch (err) {
      if (isVerificationRequiredError(err)) {
        await syncVerificationStatus().catch(() => {});
        promptVerificationRequired();
        return;
      }
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de passer ce profil');
    }
  };

  const superlike = async () => {
    if (!current?.id) return;
    if (!canInteract) {
      const approved = await syncVerificationStatus().catch(() => false);
      if (approved) {
        setVerificationStatus('approved');
      } else {
        promptVerificationRequired();
        return;
      }
    }
    try {
      const data = await api.post('/match/superlike', { userId: current.id });
      await markSeen(current.id);
      const matchId = String(data?.match?.id || data?.match?._id || '');
      const matchCreated = data?.match_created === true;
      if (matchId && matchCreated) {
        const name = String(current?.name || 'ce profil');
        Alert.alert(
          "C'est un match",
          `Toi et ${name}, vous vous plaisez. Envoie-lui un message pour briser la glace.`,
          [
            { text: 'Continuer a swiper', style: 'cancel', onPress: () => advance().catch(() => {}) },
            {
              text: 'Envoyer un message',
              onPress: () => {
                advance().catch(() => {});
                router.push({ pathname: '/(tabs)/messages', params: { matchId } });
              },
            },
          ],
        );
        return;
      }
      await advance();
    } catch (err) {
      if (isVerificationRequiredError(err)) {
        await syncVerificationStatus().catch(() => {});
        promptVerificationRequired();
        return;
      }
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de super liker ce profil');
    }
  };

  const openProfile = () => {
    if (!current?.id) return;
    router.push(`/user/${current.id}`);
  };

  const nextPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    if (photos.length <= 1) return;
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handlePhotoTap = (event: GestureResponderEvent) => {
    if (photos.length <= 1) {
      openProfile();
      return;
    }
    const tapX = event.nativeEvent.locationX;
    if (tapX < screenWidth / 2) {
      prevPhoto();
      return;
    }
    nextPhoto();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.overlayHeader, { top: insets.top + 12 }]}>
        <Pressable style={styles.filterButton} onPress={() => router.push('/filters')}>
          <Ionicons name="options" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.mobileLogo}>NDOLOLY</Text>
      </View>

      {loading && <Text style={[styles.loadingText, { top: insets.top + 70 }]}>Chargement...</Text>}

      <VerificationReminderCard status={verificationStatus} onVerifyNow={goToVerification} />

      {!current && !loading ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Plus de profils.</Text>
        </View>
      ) : null}

      {current ? (
        <View style={styles.card}>
          <View style={styles.imageContainer}>
            <Pressable style={styles.imagePressable} onPress={handlePhotoTap}>
              <Image
                source={{ uri: currentPhoto }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            </Pressable>
            {photos.length > 1 ? (
              <>
                <Pressable style={[styles.navButton, styles.navLeft]} onPress={prevPhoto}>
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                </Pressable>
                <Pressable style={[styles.navButton, styles.navRight]} onPress={nextPhoto}>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </Pressable>
                <View style={[styles.dots, { top: insets.top + 64 }]}>
                  {photos.map((_: string, idx: number) => (
                    <View
                      key={`dot-${idx}`}
                      style={[styles.dot, idx === photoIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>

          <LinearGradient
            pointerEvents="box-none"
            colors={['rgba(18,18,23,0)', 'rgba(18,18,23,0.68)', 'rgba(18,18,23,0.95)']}
            locations={[0, 0.34, 1]}
            style={[styles.content, { paddingBottom: 96 + insets.bottom }]}
          >
            <Pressable style={styles.titleRow} onPress={openProfile}>
              <Text style={styles.cardTitle}>
                {current.name} <Text style={styles.cardAge}>{computeAge(current.birthdate) === '-' ? current.age : computeAge(current.birthdate)}</Text>
              </Text>
              <View style={[styles.verifiedIcon, current.verified_photo && styles.verifiedIconActive]}>
                <Text style={styles.verifiedIconText}>{current.verified_photo ? '✓' : '!'}</Text>
              </View>
            </Pressable>

            <Text style={styles.cardBio} numberOfLines={1} ellipsizeMode="tail">
              {current.bio || 'A propos non renseigne.'}
            </Text>

            <View style={styles.actions}>
              <Pressable style={[styles.actionButton, styles.pass]} onPress={pass}>
                <Ionicons name="close" size={24} color="#ff5a86" />
              </Pressable>
              <Pressable style={[styles.actionButton, styles.super]} onPress={superlike}>
                <Ionicons name="star" size={22} color="#2797ff" />
              </Pressable>
              <Pressable style={[styles.actionButton, styles.like]} onPress={like}>
                <Ionicons name="heart" size={22} color="#75e247" />
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050506',
  },
  overlayHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogo: {
    color: '#d4af37',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.7,
  },
  loadingText: {
    position: 'absolute',
    left: 16,
    zIndex: 30,
    color: '#fff',
    fontSize: 14,
  },
  noticeCard: {
    position: 'absolute',
    top: 88,
    left: 14,
    right: 14,
    zIndex: 25,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 90, 95, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 95, 0.28)',
    gap: 4,
  },
  noticeTitle: {
    color: '#c72642',
    fontSize: 14,
    fontWeight: '700',
  },
  noticeText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    flex: 1,
    backgroundColor: '#050506',
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePressable: {
    flex: 1,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    display: 'none',
  },
  navLeft: {
    left: 10,
  },
  navRight: {
    right: 10,
  },
  dots: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 14,
    minHeight: 250,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 72,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 42,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
  },
  cardAge: {
    fontWeight: '700',
  },
  verifiedIcon: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a8adb7',
  },
  verifiedIconActive: {
    backgroundColor: '#2797ff',
  },
  verifiedIconText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  cardBio: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pass: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  super: {
    backgroundColor: 'rgba(39,151,255,0.16)',
  },
  like: {
    backgroundColor: 'rgba(108,222,76,0.18)',
  },
});
