﻿import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/lib/api';
import { computeAge, resolvePhoto } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';
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
  const colors = Colors[colorScheme];
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
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
    const list = raw.map((photo) => resolvePhoto(photo)).filter(Boolean);
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
      setFilters(savedFilters);
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
        let nextList = Array.isArray(data) ? data : [];
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
      await api.post('/match/like', { userId: current.id, action: 'like' });
      await markSeen(current.id);
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
      await api.post('/match/superlike', { userId: current.id });
      await markSeen(current.id);
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

  const filterCount = useMemo(() => {
    return Object.values(filters || {}).filter((value) => value && String(value).trim().length > 0).length;
  }, [filters]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <BrandMark size="sub" />
          <Text style={[styles.title, { color: colors.text }]}>Rencontres</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>Decouvrez des profils compatibles.</Text>
        </View>
        <Pressable style={styles.filterButton} onPress={() => router.push('/filters')}>
          <Ionicons name="options" size={18} color="#ff5a5f" />
          <Text style={styles.filterText}>Filtre</Text>
          {filterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {loading && <Text style={[styles.subtitle, { color: colors.text }]}>Chargement...</Text>}

      {!canInteract ? (
        <Pressable style={styles.noticeCard} onPress={promptVerificationRequired}>
          <Text style={styles.noticeTitle}>Verification photo requise</Text>
          <Text style={styles.noticeText}>
            Verifiez votre profil pour pouvoir liker, super liker ou passer. Appuyez ici pour envoyer une photo.
          </Text>
        </Pressable>
      ) : null}

      {!current && !loading ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.subtitle, { color: colors.text }]}>Plus de profils.</Text>
        </View>
      ) : null}

      {current ? (
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={styles.imageContainer}>
            <Pressable style={styles.imagePressable} onPress={nextPhoto}>
              <Image
                source={{ uri: currentPhoto }}
                style={styles.cardImage}
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
                <View style={styles.dots}>
                  {photos.map((_, idx) => (
                    <View
                      key={`dot-${idx}`}
                      style={[styles.dot, idx === photoIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>

          <Pressable style={styles.info} onPress={openProfile}>
            <Text style={[styles.cardTitle, { color: colors.text }]}> 
              {current.name} · {computeAge(current.birthdate) === '-' ? current.age : computeAge(current.birthdate)}
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.text }]}>{current.location}</Text>
            {current?.family_status ? (
              <Text style={[styles.cardMeta, { color: colors.text }]}>
                Statut: {current.family_status === 'celibataire' ? 'Celibataire' : 'Marie(e)'}
              </Text>
            ) : null}
            {current?.looking_for ? (
              <Text style={[styles.cardMeta, { color: colors.text }]}>
                Recherche: {current.looking_for === 'amour' ? 'Amour' : 'Amitie'}
              </Text>
            ) : null}
            {current?.bio ? (
              <Text
                style={[styles.cardBio, { color: colors.text }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {current.bio}
              </Text>
            ) : null}
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={[styles.actionButton, styles.pass]} onPress={pass}>
              <Ionicons name="close" size={24} color="#111" />
            </Pressable>
            <Pressable style={[styles.actionButton, styles.super]} onPress={superlike}>
              <Ionicons name="star" size={22} color="#fff" />
            </Pressable>
            <Pressable style={[styles.actionButton, styles.like]} onPress={like}>
              <Ionicons name="heart" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 12,
  },
  header: {
    marginBottom: 10,
    gap: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 95, 0.5)',
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
  },
  filterText: {
    color: '#ff5a5f',
    fontWeight: '700',
  },
  filterBadge: {
    marginLeft: 4,
    backgroundColor: '#ff5a5f',
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
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
    color: '#7d1e2e',
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    flex: 1,
    borderRadius: 22,
    padding: 12,
    gap: 10,
  },
  imageContainer: {
    flex: 1,
    minHeight: 320,
    borderRadius: 20,
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
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 26, 29, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: {
    left: 10,
  },
  navRight: {
    right: 10,
  },
  dots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    backgroundColor: '#ff5a5f',
  },
  info: {
    gap: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  cardMeta: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
  },
  cardBio: {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 4,
    lineHeight: 18,
  },
  actions: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  pass: {
    backgroundColor: '#f0f0f0',
  },
  super: {
    backgroundColor: '#4ecdc4',
  },
  like: {
    backgroundColor: '#ff5a5f',
  },
  actionTextLight: {
    color: '#fff',
    fontWeight: '600',
  },
  actionTextDark: {
    color: '#111',
    fontWeight: '600',
  },
});
