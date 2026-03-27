import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/lib/api';
import { resolvePhoto, computeAge } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import BrandMark from '@/components/BrandMark';

type SmokerOption = 'unknown' | 'yes' | 'no';

type GenderOption = 'male' | 'female' | 'other';

type PrefGenderOption = 'any' | 'male' | 'female' | 'other';

const MAX_PHOTOS = 6;

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { signOut } = useAuth();
  const params = useLocalSearchParams<{ promptVerification?: string | string[] }>();
  const [profile, setProfile] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [rejectionPromptSeen, setRejectionPromptSeen] = useState(false);
  const [languagesText, setLanguagesText] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const verificationPromptHandledRef = React.useRef<string | null>(null);

  const photos = useMemo(() => (profile?.photos || []).filter(Boolean), [profile]);

  const syncVerificationStatus = async () => {
    const statusData = await api.get(`/profile/verification-status?ts=${Date.now()}`);
    setProfile((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        verified_photo: statusData?.status === 'approved',
        photo_verification: statusData?.verification || null,
      };
    });
  };

  const load = async () => {
    try {
      const data = await api.get(`/profile/me?ts=${Date.now()}`);
      const statusData = await api.get(`/profile/verification-status?ts=${Date.now()}`);
      setProfile({
        ...data,
        verified_photo: statusData?.status === 'approved',
        photo_verification: statusData?.verification || null,
      });
      setLanguagesText((data?.languages || []).join(', '));
      setInterestsText((data?.interests || []).join(', '));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger le profil';
      Alert.alert('Erreur profil', message);
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
    if (!profile?.photo_verification || profile?.verified_photo) return;
    if (profile.photo_verification.status !== 'pending') return;
    const handle = setInterval(() => {
      syncVerificationStatus().catch(() => {});
    }, 5000);
    return () => clearInterval(handle);
  }, [profile?.photo_verification?.status, profile?.verified_photo]);

  const updateField = (key: string, value: any) => {
    setProfile((prev: any) => ({ ...prev, [key]: value }));
  };

  const parseNumber = (value: string) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const payload = {
        name: profile.name,
        birthdate: profile.birthdate,
        gender: profile.gender,
        location: profile.location,
        children_count: parseNumber(profile.children_count),
        smoker: profile.smoker,
        religion: profile.religion,
        profession: profile.profession,
        education_level: profile.education_level,
        height_cm: parseNumber(profile.height_cm),
        family_status: profile.family_status,
        languages: languagesText.split(',').map((v) => v.trim()).filter(Boolean),
        looking_for: profile.looking_for,
        interests: interestsText.split(',').map((v) => v.trim()).filter(Boolean),
        bio: profile.bio,
        pref_age_min: parseNumber(profile.pref_age_min) || 18,
        pref_age_max: parseNumber(profile.pref_age_max) || 99,
        pref_distance_km: parseNumber(profile.pref_distance_km) || 50,
        pref_gender: profile.pref_gender || 'any',
        incognito_mode: !!profile.incognito_mode,
      };
      await api.put('/profile/me', payload);
      Alert.alert('OK', 'Profil mis a jour');
      await load();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  };

  const takeVerificationPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Camera requise', "Autorisez la camera pour prendre une photo de verification en temps reel.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      cameraType: ImagePicker.CameraType.front,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return null;
    return result.assets[0];
  };

  const pickVerificationAsset = async () => new Promise<ImagePicker.ImagePickerAsset | null>((resolve) => {
    Alert.alert(
      'Photo de verification',
      'Prenez un selfie en temps reel ou choisissez une photo claire de votre visage.',
      [
        {
          text: 'Prendre une photo',
          onPress: () => {
            takeVerificationPhoto()
              .then(resolve)
              .catch(() => resolve(null));
          },
        },
        {
          text: 'Choisir dans la galerie',
          onPress: () => {
            pickImage()
              .then(resolve)
              .catch(() => resolve(null));
          },
        },
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ]
    );
  });

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limite atteinte', `Maximum ${MAX_PHOTOS} photos.`);
      return;
    }
    const asset = await pickImage();
    if (!asset) return;
    const form = new FormData();
    form.append('photo', {
      uri: asset.uri,
      name: `photo-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    await api.upload('/profile/photo', form);
    await load();
  };

  const replacePhoto = async (photo: string) => {
    const asset = await pickImage();
    if (!asset) return;
    const form = new FormData();
    form.append('photo', {
      uri: asset.uri,
      name: `photo-${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    form.append('oldPhoto', photo);
    await api.put('/profile/photo', form);
    await load();
  };

  const deletePhoto = async (photo: string) => {
    Alert.alert('Supprimer', 'Supprimer cette photo ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await api.delete('/profile/photo', { photo });
          await load();
        },
      },
    ]);
  };

  const deleteAccount = async () => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer votre compte ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await api.delete('/profile/me');
          await signOut();
        },
      },
    ]);
  };

  const smokerValue: SmokerOption = profile?.smoker === true ? 'yes' : profile?.smoker === false ? 'no' : 'unknown';
  const verification = profile?.photo_verification || null;
  const verificationStatus = profile?.verified_photo ? 'approved' : verification?.status || 'none';

  useEffect(() => {
    if (verificationStatus === 'rejected' && !rejectionPromptSeen) {
      Alert.alert(
        'Verification rejetee',
        verification?.note
          ? `${verification.note}\n\nVeuillez recommencer avec une nouvelle photo.`
          : 'Votre photo a ete rejetee. Veuillez recommencer avec une nouvelle photo.'
      );
      setRejectionPromptSeen(true);
      return;
    }
    if (verificationStatus !== 'rejected' && rejectionPromptSeen) {
      setRejectionPromptSeen(false);
    }
  }, [verificationStatus, verification?.note, rejectionPromptSeen]);

  useEffect(() => {
    const promptKey = Array.isArray(params.promptVerification)
      ? params.promptVerification[0]
      : params.promptVerification;
    if (!promptKey) {
      verificationPromptHandledRef.current = null;
      return;
    }
    if (!profile || verificationSubmitting || verificationPromptHandledRef.current === String(promptKey)) return;
    verificationPromptHandledRef.current = String(promptKey);

    if (verificationStatus === 'approved') {
      Alert.alert('Profil deja verifie', 'Votre profil photo est deja valide.');
      return;
    }
    if (verificationStatus === 'pending') {
      Alert.alert('Verification en attente', "Votre photo est deja en cours de validation par l'admin.");
      return;
    }

    Alert.alert(
      'Verification requise',
      "Vous devez verifier votre profil photo avant de liker, super liker ou passer.",
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Charger une photo', onPress: () => void submitVerification() },
      ]
    );
  }, [params.promptVerification, profile, verificationStatus, verificationSubmitting]);

  const submitVerification = async () => {
    if (verificationSubmitting || verificationStatus === 'pending') return;
    const asset = await pickVerificationAsset();
    if (!asset) return;
    setVerificationSubmitting(true);
    try {
      const form = new FormData();
      form.append('photo', {
        uri: asset.uri,
        name: `verification-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      const response = await api.upload('/profile/verify-request', form);
      setProfile((prev: any) => ({
        ...prev,
        verified_photo: false,
        photo_verification: response?.verification || null,
      }));
      Alert.alert(
        'Verification envoyee',
        response?.message || "Votre photo de verification a ete envoyee a l'admin. Vous pourrez liker, super liker et passer apres validation admin."
      );
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Impossible d'envoyer la verification");
    } finally {
      setVerificationSubmitting(false);
    }
  };

  const verificationTitle =
    verificationStatus === 'approved'
      ? 'Photo verifiee'
      : verificationStatus === 'pending'
        ? 'Verification en attente'
        : verificationStatus === 'rejected'
          ? 'Verification rejetee'
          : 'Verification requise';

  const verificationDescription =
    verificationStatus === 'approved'
      ? "Votre photo de verification a ete approuvee par l'admin. Vous pouvez maintenant liker, super liker et passer."
      : verificationStatus === 'pending'
        ? "Votre photo est en cours de revue par l'admin. Tant qu'elle n'est pas validee, vous ne pouvez pas liker, super liker ni passer."
        : verificationStatus === 'rejected'
          ? verification?.note || "La verification a ete rejetee. Envoyez une nouvelle photo nette et recente."
          : "Prenez un selfie en temps reel ou choisissez une photo claire de votre visage. Sans validation admin, vous ne pouvez pas liker, super liker ni passer.";

  if (!profile) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <BrandMark />
        <Text style={[styles.title, { color: colors.text }]}>Mon profil</Text>
        <Text style={[styles.sub, { color: colors.text }]}>Chargement...</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}> 
      <BrandMark />
      <Text style={[styles.title, { color: colors.text }]}>Mon profil</Text>

      <View style={[styles.card, styles.cardCenter, { backgroundColor: colors.card }]}> 
        <Image
          source={{ uri: resolvePhoto(profile.photos?.[0]) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80' }}
          style={styles.avatar}
        />
        <Text style={[styles.name, { color: colors.text }]}>{profile.name} · {computeAge(profile.birthdate)}</Text>
        <Text style={[styles.sub, { color: colors.text }]}>{profile.location}</Text>
        {profile?.reverification_required ? (
          <Text style={styles.lockedNotice}>
            Votre compte est bloque jusqu'a l'envoi d'une nouvelle verification photo.
          </Text>
        ) : null}
        {!profile?.reverification_required ? (
          <Pressable style={styles.secondaryButton} onPress={addPhoto}>
            <Text style={styles.secondaryText}>Ajouter une photo</Text>
          </Pressable>
        ) : null}
      </View>

      {verificationStatus !== 'approved' ? (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{verificationTitle}</Text>
          <Text style={[styles.sub, { color: colors.text }]}>{verificationDescription}</Text>
          {verification?.photo_url ? (
            <Image source={{ uri: resolvePhoto(verification.photo_url) }} style={styles.verificationPreview} />
          ) : null}
          <Pressable
            style={[styles.primaryButton, (verificationSubmitting || verificationStatus === 'pending') && styles.disabledButton]}
            onPress={submitVerification}
            disabled={verificationSubmitting || verificationStatus === 'pending'}
          >
            <Text style={styles.primaryText}>
              {verificationStatus === 'pending'
                ? 'Verification en attente'
                : verificationSubmitting
                  ? 'Envoi en cours...'
                  : verificationStatus === 'rejected'
                    ? 'Recommencer la verification'
                    : 'Envoyer ma photo de verification'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!profile?.reverification_required ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mode incognito</Text>
            <Text style={[styles.sub, { color: colors.text }]}>
              {profile?.premium
                ? profile?.incognito_mode
                  ? "Vos visites de profil ne sont pas enregistrees."
                  : "Activez le mode incognito pour parcourir les profils sans apparaitre dans leurs vues."
                : 'Le mode incognito est reserve aux profils premium.'}
            </Text>
            <Pressable
              style={[styles.primaryButton, !profile?.premium && styles.disabledButton]}
              onPress={() => updateField('incognito_mode', !profile?.incognito_mode)}
              disabled={!profile?.premium}
            >
              <Text style={styles.primaryText}>
                {profile?.incognito_mode ? "Desactiver l'incognito" : "Activer l'incognito"}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo: string, index: number) => (
                <View key={`${photo}-${index}`} style={styles.photoItem}>
                  <Image source={{ uri: resolvePhoto(photo) }} style={styles.photoImage} />
                  <View style={styles.photoActions}>
                    <Pressable style={styles.photoButton} onPress={() => replacePhoto(photo)}>
                      <Text style={styles.photoButtonText}>Modifier</Text>
                    </Pressable>
                    <Pressable style={[styles.photoButton, styles.photoButtonDanger]} onPress={() => deletePhoto(photo)}>
                      <Text style={styles.photoButtonText}>Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              {photos.length < MAX_PHOTOS ? (
                <Pressable style={styles.photoAdd} onPress={addPhoto}>
                  <Text style={styles.photoAddText}>+ Ajouter</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations principales</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom complet"
              value={profile.name || ''}
              onChangeText={(value) => updateField('name', value)}
            />
        <TextInput
          style={styles.input}
          placeholder="Date de naissance (YYYY-MM-DD)"
          value={profile.birthdate || ''}
          onChangeText={(value) => updateField('birthdate', value)}
        />

        <Text style={styles.label}>Sexe</Text>
        <View style={styles.chipRow}>
          {(['male', 'female', 'other'] as GenderOption[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, profile.gender === value && styles.chipActive]}
              onPress={() => updateField('gender', value)}
            >
              <Text style={[styles.chipText, profile.gender === value && styles.chipTextActive]}>
                {value === 'male' ? 'Homme' : value === 'female' ? 'Femme' : 'Autre'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Ville"
          value={profile.location || ''}
          onChangeText={(value) => updateField('location', value)}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations complementaires</Text>
        <TextInput
          style={styles.input}
          placeholder="Profession"
          value={profile.profession || ''}
          onChangeText={(value) => updateField('profession', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Niveau d'etudes"
          value={profile.education_level || ''}
          onChangeText={(value) => updateField('education_level', value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Taille (cm)"
          keyboardType="number-pad"
          value={profile.height_cm ? String(profile.height_cm) : ''}
          onChangeText={(value) => updateField('height_cm', value)}
        />
        <Text style={styles.label}>Statut matrimonial</Text>
        <View style={styles.chipRow}>
          {['celibataire', 'marie'].map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, profile.family_status === value && styles.chipActive]}
              onPress={() => updateField('family_status', value)}
            >
              <Text style={[styles.chipText, profile.family_status === value && styles.chipTextActive]}>
                {value === 'celibataire' ? 'Celibataire' : 'Marie(e)'}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Langues (separees par des virgules)"
          value={languagesText}
          onChangeText={setLanguagesText}
        />
        <Text style={styles.label}>Ce que vous recherchez</Text>
        <View style={styles.chipRow}>
          {['amour', 'amitie'].map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, profile.looking_for === value && styles.chipActive]}
              onPress={() => updateField('looking_for', value)}
            >
              <Text style={[styles.chipText, profile.looking_for === value && styles.chipTextActive]}>
                {value === 'amour' ? 'Amour' : 'Amitie'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Nombre d'enfants"
          keyboardType="number-pad"
          value={profile.children_count !== null && profile.children_count !== undefined ? String(profile.children_count) : ''}
          onChangeText={(value) => updateField('children_count', value)}
        />

        <Text style={styles.label}>Fumeur</Text>
        <View style={styles.chipRow}>
          {(['unknown', 'yes', 'no'] as SmokerOption[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, smokerValue === value && styles.chipActive]}
              onPress={() => updateField('smoker', value === 'unknown' ? null : value === 'yes')}
            >
              <Text style={[styles.chipText, smokerValue === value && styles.chipTextActive]}>
                {value === 'unknown' ? 'Non renseigne' : value === 'yes' ? 'Fumeur' : 'Non fumeur'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Religion</Text>
        <View style={styles.chipRow}>
          {['', 'catholique', 'protestant', 'musulman'].map((value) => (
            <Pressable
              key={value || 'none'}
              style={[styles.chip, (profile.religion || '') === value && styles.chipActive]}
              onPress={() => updateField('religion', value || null)}
            >
              <Text style={[styles.chipText, (profile.religion || '') === value && styles.chipTextActive]}>
                {value === '' ? 'Non renseignee' : value.charAt(0).toUpperCase() + value.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Centres d'interet</Text>
        <TextInput
          style={styles.input}
          placeholder="Centres d'interet (separes par des virgules)"
          value={interestsText}
          onChangeText={setInterestsText}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>A propos</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={profile.bio || ''}
          onChangeText={(value) => updateField('bio', value)}
          multiline
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Age min</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={profile.pref_age_min ? String(profile.pref_age_min) : ''}
              onChangeText={(value) => updateField('pref_age_min', value)}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Age max</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={profile.pref_age_max ? String(profile.pref_age_max) : ''}
              onChangeText={(value) => updateField('pref_age_max', value)}
            />
          </View>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Distance (km)"
          keyboardType="number-pad"
          value={profile.pref_distance_km ? String(profile.pref_distance_km) : ''}
          onChangeText={(value) => updateField('pref_distance_km', value)}
        />

        <Text style={styles.label}>Genre recherche</Text>
        <View style={styles.chipRow}>
          {(['any', 'male', 'female', 'other'] as PrefGenderOption[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, (profile.pref_gender || 'any') === value && styles.chipActive]}
              onPress={() => updateField('pref_gender', value)}
            >
              <Text style={[styles.chipText, (profile.pref_gender || 'any') === value && styles.chipTextActive]}>
                {value === 'any' ? 'Indifferent' : value === 'male' ? 'Homme' : value === 'female' ? 'Femme' : 'Autre'}
              </Text>
            </Pressable>
          ))}
        </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Text>
          </Pressable>
        </>
      ) : null}
      <Pressable style={styles.secondaryButton} onPress={() => signOut()}>
        <Text style={styles.secondaryText}>Deconnexion</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={deleteAccount}>
        <Text style={styles.deleteText}>Supprimer mon compte</Text>
      </Pressable>
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
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  cardCenter: {
    alignItems: 'center',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 28,
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
  },
  sub: {
    fontSize: 13,
    opacity: 0.6,
  },
  lockedNotice: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    color: '#c72642',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e3e3e3',
    borderRadius: 12,
    padding: 10,
    width: '100%',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 29, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    borderColor: 'rgba(255, 90, 95, 0.5)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1d',
  },
  chipTextActive: {
    color: '#ff5a5f',
  },
  primaryButton: {
    backgroundColor: '#ff5a5f',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryText: {
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ffe5e5',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  deleteText: {
    color: '#ff5a5f',
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: '47%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(26,26,29,0.08)',
    backgroundColor: '#fff',
  },
  photoImage: {
    width: '100%',
    height: 120,
  },
  photoActions: {
    padding: 8,
    gap: 6,
  },
  photoButton: {
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(26,26,29,0.06)',
    alignItems: 'center',
  },
  photoButtonDanger: {
    backgroundColor: 'rgba(255,90,95,0.15)',
  },
  photoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1d',
  },
  photoAdd: {
    width: '47%',
    height: 170,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,26,29,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: {
    fontWeight: '700',
    color: '#ff5a5f',
  },
  verificationPreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#f4f4f6',
  },
});
