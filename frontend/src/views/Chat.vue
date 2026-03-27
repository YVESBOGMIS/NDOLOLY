<template>
  <div class="card">
    <h2>Chat</h2>
    <div v-if="!activeMatch" class="muted">Selectionnez un match pour discuter.</div>
    <div v-else class="chat">
      <div>
        <div class="match">
          <img :src="resolvePhoto(activeMatch.user?.photos?.[0]) || placeholder" alt="" />
          <div>
            <strong>{{ activeMatch.user?.name }}</strong>
            <div class="muted">{{ activeMatch.user?.location }}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="message-list">
          <div
            v-for="message in messages"
            :key="message.id || message._id"
            class="message"
            :class="String(message.from_user_id) === String(meId) ? 'me' : 'them'"
          >
            <span v-if="message.type === 'text'">{{ message.content }}</span>
            <img v-else :src="resolvePhoto(message.media_url)" alt="image" style="max-width: 100%; border-radius: 12px;" />
          </div>
        </div>
        <form class="actions input-send" @submit.prevent="send">
          <input v-model="text" placeholder="Ecrire un message..." />
          <button class="send-icon" type="submit" aria-label="Envoyer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12L20 4l-4 16-4-6-8-2z" fill="currentColor"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  activeMatch: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  meId: { type: Number, default: null }
});

const emit = defineEmits(["send"]);

const text = ref("");
const placeholder = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

const send = () => {
  if (!text.value.trim()) return;
  emit("send", text.value);
  text.value = "";
};

watch(
  () => props.activeMatch,
  () => {
    text.value = "";
  }
);
</script>

<style scoped>
.muted {
  color: var(--muted);
}
</style>
