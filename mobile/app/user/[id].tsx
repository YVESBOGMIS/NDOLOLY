import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { api } from '@/lib/api';
import { computeAge, resolvePhoto } from '@/lib/utils';
import BrandMark from '@/components/BrandMark';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<any | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await api.get(`/profile/user/${id}`);
      setProfile(data);
    } catch (err) {
      Alert.alert('Erreur', 'Profil introuvable');
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (!profile) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <BrandMark />
        <Text style={styles.title}>Profil</Text>
        <Text style={styles.subtitle}>Chargement...</Text>
      </ScrollView>
    );
  }

  const gallery = (profile.photos || []).slice(0, 6);
  const mainPhoto = resolvePhoto(profile.photos?.[0]) || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80';
  const openLightbox = (uri: string) => {
    setLightboxPhoto(uri);
    setLightboxVisible(true);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
      <BrandMark />
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Retour</Text>
      </Pressable>

        <Pressable onPress={() => openLightbox(mainPhoto)} style={styles.mainPhotoWrap}>
          <Image
            source={{ uri: mainPhoto }}
            style={styles.mainPhoto}
          />
        </Pressable>

      <Text style={styles.name}>{profile.name} · {computeAge(profile.birthdate)}</Text>
      <Text style={styles.subtitle}>
        {profile.location} {profile.distance_km ? `· ${profile.distance_km} km` : ''}
      </Text>

      {profile.verified_photo ? <Text style={styles.badge}>Profil verifie</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {gallery.map((photo: string, idx: number) => (
            <Pressable
              key={`${photo}-${idx}`}
              onPress={() => openLightbox(resolvePhoto(photo))}
              style={styles.galleryPhotoWrap}
            >
              <Image source={{ uri: resolvePhoto(photo) }} style={styles.galleryPhoto} />
            </Pressable>
          ))}
        </ScrollView>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>A propos</Text>
        <Text style={styles.sectionText}>{profile.bio || 'Non renseigne.'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <Text style={styles.sectionText}>Profession: {profile.profession || 'Non renseigne'}</Text>
        <Text style={styles.sectionText}>Etudes: {profile.education_level || 'Non renseigne'}</Text>
        <Text style={styles.sectionText}>Taille: {profile.height_cm ? `${profile.height_cm} cm` : 'Non renseigne'}</Text>
        <Text style={styles.sectionText}>Situation: {profile.family_status || 'Non renseigne'}</Text>
        <Text style={styles.sectionText}>
          Habitudes: {profile.smoker === true ? 'Fumeur' : profile.smoker === false ? 'Non fumeur' : 'Non renseigne'}
        </Text>
        <Text style={styles.sectionText}>
          Langues: {(profile.languages || []).join(', ') || 'Non renseigne'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recherche</Text>
        <Text style={styles.sectionText}>{profile.looking_for || 'Non renseigne.'}</Text>
      </View>
      </ScrollView>
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <Pressable style={styles.lightboxBackdrop} onPress={() => setLightboxVisible(false)}>
          {lightboxPhoto ? <Image source={{ uri: lightboxPhoto }} style={styles.lightboxImage} /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  back: {
    color: '#ff5a5f',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6b6b6b',
  },
  mainPhoto: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    backgroundColor: '#f4f4f6',
  },
  mainPhotoWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
    borderRadius: 18,
    resizeMode: 'contain',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#ffe5e5',
    color: '#ff5a5f',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
    fontWeight: '600',
  },
  gallery: {
    marginTop: 8,
  },
  galleryPhoto: {
    width: 140,
    height: 100,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: '#f4f4f6',
  },
  galleryPhotoWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
  },
  section: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionText: {
    color: '#444',
    marginBottom: 4,
  },
});
