<template>
  <div class="card">
    <h2>Decouvrir</h2>
    <p v-if="!profiles.length">Plus de profils disponibles.</p>
    <div v-else class="card-stack">
      <div class="profile">
        <img :src="mainPhoto" alt="Profil" />
        <div>
          <h3>{{ current.name }} · {{ current.age }}</h3>
          <p>{{ current.location }} · {{ current.gender }}</p>
          <p>{{ current.bio || 'Profil sans description.' }}</p>
          <div class="badges">
            <span v-for="interest in current.interests" :key="interest">{{ interest }}</span>
          </div>
          <div class="actions">
            <button class="pass" @click="pass">Passer</button>
            <button class="like" @click="like">Aimer</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  profiles: { type: Array, default: () => [] }
});

const emit = defineEmits(["like", "pass"]);

const current = computed(() => props.profiles[0] || {});

const mainPhoto = computed(() => {
  const photo = current.value.photos?.[0];
  if (!photo) {
    return "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80";
  }
  return resolvePhoto(photo);
});

const like = () => emit("like", current.value);
const pass = () => emit("pass", current.value);
</script>
