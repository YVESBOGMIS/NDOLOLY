﻿<template>
  <div class="card">
    <div class="hero hero-center">
      <div class="swipe-stack">
        <div v-if="!profiles.length" class="swipe-card">
          <div>
            <h3>Plus de profils</h3>
            <p class="muted">Reviens plus tard pour de nouvelles rencontres.</p>
          </div>
        </div>
        <div v-else class="swipe-card">
          <div class="photo-carousel">
            <img class="profile-clickable" :src="mainPhoto" alt="Profil" @click="openProfile" />
            <button class="photo-nav prev" @click="prevPhoto" aria-label="Photo precedente">‹</button>
            <button class="photo-nav next" @click="nextPhoto" aria-label="Photo suivante">›</button>
            <div class="photo-dots">
              <span
                v-for="(p, idx) in photos"
                :key="p + idx"
                :class="{ active: idx === photoIndex }"
                @click="photoIndex = idx"
              />
            </div>
          </div>
          <div>
            <h3 class="profile-name" @click="openProfile">{{ current.name }} · {{ current.age }}</h3>
            <p class="muted">{{ current.location }} · {{ current.gender }}</p>
            <p>{{ current.bio || 'Profil sans description.' }}</p>
            <div class="badges">
              <span v-if="current.verified_photo">Verifie</span>
              <span v-for="interest in current.interests" :key="interest">{{ interest }}</span>
            </div>
            <div class="actions fixed-actions">
              <button class="pass" @click="pass">Passer</button>
              <button class="super" @click="superlike">Super</button>
              <button class="like" @click="like">Like</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  profiles: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["like", "pass", "superlike", "boost", "filters-change", "open-profile"]);

const defaultFilters = {
  age_min: "",
  age_max: "",
  city: "",
  children: "any",
  smoker: "any",
  religion: "any"
};

const localFilters = ref({ ...defaultFilters, ...props.filters });

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

const like = () => emit("like", current.value);
const pass = () => emit("pass", current.value);
const superlike = () => emit("superlike", current.value);
const openProfile = () => emit("open-profile", current.value);

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

watch(
  () => props.filters,
  (value) => {
    localFilters.value = { ...defaultFilters, ...(value || {}) };
  },
  { deep: true }
);

</script>
