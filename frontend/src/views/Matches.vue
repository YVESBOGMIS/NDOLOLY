<template>
  <div class="card">
    <h2>Mes matchs</h2>
    <div class="match-list">
      <div v-for="match in matches" :key="match.id" class="match" @click="select(match)">
        <img :src="resolvePhoto(match.user?.photos?.[0]) || placeholder" alt="" />
        <div>
          <strong>{{ match.user?.name }}</strong>
          <div class="muted">{{ match.user?.location }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { resolvePhoto } from "../utils";
const props = defineProps({
  matches: { type: Array, default: () => [] }
});
const emit = defineEmits(["select"]);

const placeholder = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

const select = (match) => emit("select", match);
</script>

<style scoped>
.muted {
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
