<template>
  <div class="card">
    <h2>Pres de vous</h2>
    <p class="muted">Profils a proximite.</p>
    <div class="grid three" v-if="profiles.length">
      <div v-for="profile in profiles" :key="profile.id" class="profile-card">
        <button class="profile-link" @click="$emit('open-profile', profile)">
          <img :src="resolvePhoto(profile.photos?.[0]) || placeholder" alt="" />
        </button>
        <div style="margin-top: 8px;">
          <button class="profile-link name-link" @click="$emit('open-profile', profile)">
            <strong>{{ profile.name }} · {{ profile.age }}</strong>
          </button>
          <div class="muted">{{ profile.distance_km }} km · {{ profile.location }}</div>
          <div class="actions">
            <button class="button secondary" @click="$emit('like', profile)">Like</button>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="muted">Aucun profil proche pour le moment.</p>
  </div>
</template>

<script setup>
import { resolvePhoto } from "../utils";

defineProps({
  profiles: { type: Array, default: () => [] }
});

const placeholder = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";
</script>
