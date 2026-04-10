<template>
  <div class="card">
    <div class="actions">
      <button class="button ghost" @click="$emit('back')">Retour</button>
    </div>

    <div v-if="loading" class="muted">Chargement du profil...</div>
    <div v-else-if="!profile" class="muted">Profil introuvable.</div>
    <div v-else class="profile-view">
      <div class="profile-hero">
        <button class="profile-main-trigger" type="button" @click="openPhotoPreview(mainPhoto)" aria-label="Agrandir la photo">
          <img class="profile-main" :src="mainPhoto" alt="Photo principale" />
        </button>
        <div class="profile-info">
          <div class="profile-title">
            <h2>{{ profile.name }} · {{ age }}</h2>
            <span v-if="profile.verified_photo" class="badge">Profil verifie</span>
          </div>
          <div class="muted">
            {{ profile.location }}
            <span v-if="profile.distance_km"> · {{ profile.distance_km }} km</span>
          </div>

          <div class="profile-gallery" v-if="galleryPhotos.length">
            <button
              v-for="(photo, idx) in galleryPhotos"
              :key="photo + idx"
              class="gallery-item"
              :class="{ active: photo === selectedPhoto }"
              @click="selectPhoto(photo); openPhotoPreview(resolvePhoto(photo))"
            >
              <img :src="resolvePhoto(photo)" alt="Galerie" />
            </button>
          </div>

          <div class="profile-section">
            <h3>A propos</h3>
            <p>{{ profile.bio || "Non renseigne." }}</p>
          </div>

          <div class="profile-section">
            <h3>Informations complementaires</h3>
            <div class="profile-info-grid">
              <div>
                <span class="label">Profession</span>
                <span>{{ profile.profession || "Non renseigne" }}</span>
              </div>
              <div>
                <span class="label">Niveau d'etudes</span>
                <span>{{ profile.education_level || "Non renseigne" }}</span>
              </div>
              <div>
                <span class="label">Taille</span>
                <span>{{ heightText }}</span>
              </div>
              <div>
                <span class="label">Situation familiale</span>
                <span>{{ profile.family_status || "Non renseigne" }}</span>
              </div>
              <div>
                <span class="label">Habitudes</span>
                <span>{{ smokerText }}</span>
              </div>
              <div>
                <span class="label">Langues parlees</span>
                <span>{{ languagesText }}</span>
              </div>
            </div>
          </div>

          <div class="profile-section">
            <h3>Ce que la personne recherche</h3>
            <p>{{ profile.looking_for || "Non renseigne." }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="photoPreviewSrc" class="modal photo-preview-wrap" @click.self="closePhotoPreview">
      <div class="photo-preview-modal fullscreen">
        <button class="photo-preview-close" type="button" @click="closePhotoPreview" aria-label="Fermer">×</button>
        <img class="photo-preview-image fullscreen" :src="photoPreviewSrc" alt="photo" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  profile: { type: Object, default: null },
  loading: { type: Boolean, default: false }
});

const selectedPhoto = ref(null);
const photoPreviewSrc = ref("");

watch(
  () => props.profile?.id,
  () => {
    selectedPhoto.value = null;
  }
);

const computeAge = (birthdate) => {
  if (!birthdate) return "-";
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
};

const age = computed(() => computeAge(props.profile?.birthdate));

const mainPhoto = computed(() => {
  const photo = selectedPhoto.value || props.profile?.photos?.[0];
  if (!photo) {
    return "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80";
  }
  return resolvePhoto(photo);
});

const galleryPhotos = computed(() => {
  const photos = props.profile?.photos || [];
  return photos.slice(0, 6);
});

const selectPhoto = (photo) => {
  if (!photo) return;
  selectedPhoto.value = photo;
};

const openPhotoPreview = (src) => {
  if (!src) return;
  photoPreviewSrc.value = String(src);
};

const closePhotoPreview = () => {
  photoPreviewSrc.value = "";
};

const heightText = computed(() => {
  const value = props.profile?.height_cm;
  if (!value) return "Non renseigne";
  return `${value} cm`;
});

const smokerText = computed(() => {
  if (props.profile?.smoker === true) return "Fumeur";
  if (props.profile?.smoker === false) return "Non fumeur";
  return "Non renseigne";
});

const languagesText = computed(() => {
  const langs = props.profile?.languages || [];
  if (!langs.length) return "Non renseigne";
  return langs.join(", ");
});
</script>
