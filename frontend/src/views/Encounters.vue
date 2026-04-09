<template>
  <section class="encounters-view">
    <div class="encounter-mobile-brandbar">
      <button class="encounter-tune" type="button" @click="$emit('open-filters')" aria-label="Filtres">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
          <path d="M4 7h16" />
          <path d="M4 17h16" />
          <circle cx="8" cy="7" r="1.8" />
          <circle cx="16" cy="17" r="1.8" />
        </svg>
      </button>
      <div class="encounter-mobile-logo brand luxe">NDOLOLY</div>
      <span class="encounter-brandbar-spacer" aria-hidden="true"></span>
    </div>

    <button class="encounter-filter-mobile" type="button" @click="$emit('open-filters')" aria-label="Filtres">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
        <path d="M4 7h16" />
        <path d="M4 17h16" />
        <circle cx="8" cy="7" r="1.8" />
        <circle cx="16" cy="17" r="1.8" />
      </svg>
    </button>

    <div class="encounters-heading encounters-heading-desktop">
      <div>
        <h2>Rencontres</h2>
        <p class="muted encounters-subtitle">Decouvrez des profils compatibles.</p>
      </div>
      <button class="button encounter-filter-button" @click="$emit('open-filters')">
        <span class="encounter-filter-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
            <path d="M5 7h14" />
            <path d="M8 12h8" />
            <path d="M10.5 17h3" />
          </svg>
        </span>
        <span>Filtre</span>
      </button>
    </div>

    <div class="hero hero-center">
      <div class="swipe-stack swipe-stack-mobile">
        <div v-if="!profiles.length" class="swipe-card encounter-card">
          <div class="encounter-empty">
            <h3>Plus de profils</h3>
            <p class="muted">Reviens plus tard pour de nouvelles rencontres.</p>
          </div>
        </div>
        <div v-else class="swipe-card encounter-card">
          <div class="photo-carousel encounter-carousel">
            <img class="profile-clickable encounter-photo" :src="mainPhoto" alt="Profil" @click="handlePhotoTap" />
            <button class="photo-nav prev" @click="prevPhoto" aria-label="Photo precedente">&lt;</button>
            <button class="photo-nav next" @click="nextPhoto" aria-label="Photo suivante">&gt;</button>
            <div v-if="photos.length > 1" class="photo-dots">
              <span
                v-for="(p, idx) in photos"
                :key="p + idx"
                :class="{ active: idx === photoIndex }"
                @click="photoIndex = idx"
              />
            </div>
          </div>

          <div class="encounter-content">
            <div class="encounter-title-row">
              <h3 class="profile-name encounter-title" @click="openProfile">
                {{ current.name }} <span>{{ current.age }}</span>
              </h3>
              <span
                :class="['encounter-verified-icon', { verified: current.verified_photo }]"
                :title="current.verified_photo ? 'Profil verifie' : 'Profil non verifie'"
                aria-hidden="true"
              >
                <template v-if="current.verified_photo">&#10003;</template>
                <template v-else>!</template>
              </span>
            </div>

            <p class="encounter-about">{{ current.bio || "A propos non renseigne." }}</p>

            <div class="actions encounter-actions">
              <button class="pass encounter-action-button" type="button" @click="pass" aria-label="Passer">
                <span class="encounter-action-icon">&times;</span>
              </button>
              <button class="super encounter-action-button" type="button" @click="superlike" aria-label="Super like">
                <span class="encounter-action-icon">&#9733;</span>
              </button>
              <button class="like encounter-action-button" type="button" @click="like" aria-label="Like">
                <span class="encounter-action-icon">&#9829;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  profiles: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) }
});

const current = computed(() => props.profiles[0] || {});
const photoIndex = ref(0);

const photos = computed(() => current.value.photos?.length ? current.value.photos : []);

const mainPhoto = computed(() => {
  const photo = photos.value[photoIndex.value] || current.value.photos?.[0];
  if (!photo) {
    return "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80";
  }
  return resolvePhoto(photo);
});

const emit = defineEmits(["like", "pass", "superlike", "boost", "filters-change", "open-profile", "open-filters"]);

const like = () => emit("like", current.value);
const pass = () => emit("pass", current.value);
const superlike = () => emit("superlike", current.value);
const openProfile = () => emit("open-profile", current.value);

const handlePhotoTap = (event) => {
  if (photos.value.length <= 1) {
    openProfile();
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const tapX = event.clientX - rect.left;
  if (tapX < rect.width / 2) {
    prevPhoto();
    return;
  }
  nextPhoto();
};

const nextPhoto = () => {
  if (!photos.value.length) return;
  photoIndex.value = (photoIndex.value + 1) % photos.value.length;
};

const prevPhoto = () => {
  if (!photos.value.length) return;
  photoIndex.value = (photoIndex.value - 1 + photos.value.length) % photos.value.length;
};

watch(
  () => current.value.id,
  () => {
    photoIndex.value = 0;
  }
);
</script>
