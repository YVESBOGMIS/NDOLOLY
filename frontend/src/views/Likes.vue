<template>
  <div class="card">
    <div class="tabs">
      <button :class="{ active: activeTab === 'likes' }" @click="activeTab = 'likes'">Likes</button>
      <button :class="{ active: activeTab === 'views' }" @click="activeTab = 'views'">Vues</button>
    </div>

    <div v-if="activeTab === 'likes'">
      <h2>Ils vous aiment</h2>
      <p class="muted">Qui a like ou super-like votre profil.</p>
      <div v-if="likesPremiumRequired" class="card" style="margin: 12px 0;">
        <strong>Fonction premium</strong>
        <p class="muted" style="margin-top: 6px;">
          Seuls les profils premium peuvent voir qui les a likes.
        </p>
      </div>
      <div class="grid three" v-if="likes.length">
        <div v-for="profile in likes" :key="profile.id" class="profile-card">
          <button class="profile-link" @click="$emit('open-profile', profile)">
            <img :src="resolvePhoto(profile.photos?.[0]) || placeholder" alt="" />
          </button>
          <div style="margin-top: 8px;">
            <button class="profile-link name-link" @click="$emit('open-profile', profile)">
              <strong>{{ profile.name }}</strong>
            </button>
            <div class="muted">{{ profile.location }}</div>
            <span class="badge" v-if="profile.like_type === 'superlike'">Super-like</span>
            <div class="actions">
              <button class="button secondary" @click="$emit('open-profile', profile)">Voir profil</button>
              <button class="button" @click="$emit('like', profile)">Match</button>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="muted">Personne pour l'instant.</p>
    </div>

    <div v-else>
      <h2>Vues</h2>
      <p class="muted">Les personnes qui ont consulte votre profil.</p>
      <div class="grid three" v-if="views.length">
        <div v-for="view in views" :key="view.id + view.viewed_at" class="profile-card">
          <button class="profile-link" @click="$emit('open-profile', view)">
            <img :src="resolvePhoto(view.photos?.[0]) || placeholder" alt="" />
          </button>
          <div style="margin-top: 8px;">
            <button class="profile-link name-link" @click="$emit('open-profile', view)">
              <strong>{{ view.name }}</strong>
            </button>
            <div class="muted">{{ view.location }}</div>
            <div class="muted">Vu le {{ formatDate(view.viewed_at) }}</div>
            <div class="actions">
              <button class="button secondary" @click="$emit('open-profile', view)">Voir profil</button>
              <button class="button" @click="$emit('like-back', view)">Like en retour</button>
              <button class="button ghost" @click="$emit('message', view)">Envoyer un message</button>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="muted">Aucune vue pour l'instant.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { resolvePhoto } from "../utils";

defineProps({
  likes: { type: Array, default: () => [] },
  likesPremiumRequired: { type: Boolean, default: false },
  views: { type: Array, default: () => [] }
});

const placeholder = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80";
const activeTab = ref("likes");

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};
</script>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.tabs button {
  border: none;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  background: rgba(17, 18, 20, 0.08);
}

.tabs button.active {
  background: var(--accent);
  color: white;
}
</style>
