﻿﻿﻿<template>
  <div class="card">
    <div v-if="newMatches.length">
      <div class="section-title">Nouveaux matchs</div>
      <div class="match-strip">
        <div
          v-for="match in newMatches"
          :key="match.id || match._id"
          class="match-chip"
          @click="select(match)"
        >
          <div class="avatar-badge">
            <img :src="resolvePhoto(match.user?.photos?.[0]) || placeholder" alt="" />
            <span v-if="match.unread_count > 0" class="unread-dot">
              {{ formatUnread(match.unread_count) }}
            </span>
          </div>
          <div>{{ match.user?.name }}</div>
        </div>
      </div>
    </div>
    <h2>Messages</h2>
    <div class="chat-layout">
      <div>
        <div class="field">
          <input v-model="search" placeholder="Rechercher un match..." />
        </div>
        <div class="section-title">Discussions</div>
        <div class="grid" style="gap: 10px;">
          <div
            v-for="match in filteredConversations"
            :key="match.id"
            class="profile-card"
            @click="select(match)"
            style="cursor: pointer;"
          >
            <div class="avatar-badge">
              <img :src="resolvePhoto(match.user?.photos?.[0]) || placeholder" alt="" />
              <span v-if="match.unread_count > 0" class="unread-dot">
                {{ formatUnread(match.unread_count) }}
              </span>
            </div>
            <div style="margin-top: 8px;">
              <strong>{{ match.user?.name }}</strong>
              <div class="muted">{{ match.user?.location }}</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div v-if="!activeMatch" class="muted">Selectionnez un match pour discuter.</div>
        <div v-else>
            <div class="chat-frame">
              <div class="chat-header">
                <img :src="resolvePhoto(activeMatch.user?.photos?.[0]) || placeholder" alt="" />
                <div>
                  <strong>{{ activeMatch.user?.name }}</strong>
                  <div class="muted">{{ activeMatch.user?.location }}</div>
                </div>
                <button class="chat-close" type="button" aria-label="Fermer la conversation" @click="closeChat">
                  &times;
                </button>
              </div>
            <div class="message-list chat-scroll">
          <div
            v-for="message in messages"
            :key="message.id || message._id"
            class="message"
            :class="String(message.from_user_id) === String(meId) ? 'me' : 'them'"
          >
              <span v-if="message.type === 'text'">{{ message.content }}</span>
              <img
                v-else-if="message.type === 'image'"
                :src="resolvePhoto(message.media_url)"
                alt="image"
                style="max-width: 100%; border-radius: 12px;"
              />
              <audio
                v-else-if="message.type === 'audio'"
                :src="resolvePhoto(message.media_url)"
                controls
                style="width: 100%; margin-top: 6px;"
              />
              <span v-else>Message non supporte.</span>
              <div v-if="String(message.from_user_id) === String(meId)" class="message-status">
                {{ message.status === "read" ? "Lu" : message.status === "received" ? "Recu" : "Envoye" }}
              </div>
            </div>
          </div>
          <form class="actions input-send chat-input" @submit.prevent="send">
            <button class="attach-icon" type="button" aria-label="Ajouter une image" @click="openFile">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.5 6.5l-7.8 7.8a2.5 2.5 0 003.5 3.5l8-8a4 4 0 10-5.7-5.7l-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button
              class="attach-icon record-icon"
              type="button"
              :class="{ recording: isRecording }"
              aria-label="Enregistrer un message vocal"
              @click="toggleRecording"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zm-5 8v-2h-2v2h2z" fill="currentColor"/>
              </svg>
            </button>
            <input v-model="text" placeholder="Ecrire un message..." />
            <button class="send-icon" type="submit" aria-label="Envoyer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12L20 4l-4 16-4-6-8-2z" fill="currentColor"/>
              </svg>
            </button>
            <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFile" />
          </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  matches: { type: Array, default: () => [] },
  activeMatch: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  meId: { type: [Number, String], default: null }
});

const emit = defineEmits(["select", "send", "sendImage", "sendAudio", "close"]);

const text = ref("");
const search = ref("");
const fileInput = ref(null);
const isRecording = ref(false);
const recorder = ref(null);
const recordChunks = ref([]);
const placeholder = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

const newMatches = computed(() => props.matches.filter((m) => !m.has_messages));
const conversations = computed(() => props.matches.filter((m) => m.has_messages));

const filteredConversations = computed(() => {
  const term = search.value.toLowerCase();
  if (!term) return conversations.value;
  return conversations.value.filter((m) => m.user?.name?.toLowerCase().includes(term));
});

const select = (match) => emit("select", match);
const closeChat = () => emit("close");

const send = () => {
  if (!text.value.trim()) return;
  emit("send", text.value);
  text.value = "";
};

const openFile = () => {
  fileInput.value?.click();
};

const handleFile = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  emit("sendImage", file);
  event.target.value = "";
};

const toggleRecording = async () => {
  if (isRecording.value && recorder.value) {
    recorder.value.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    window.alert("Enregistrement vocal non supporte sur cet appareil.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let mimeType = "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      mimeType = "audio/webm";
    }
    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.value = mediaRecorder;
    recordChunks.value = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordChunks.value.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordChunks.value, { type: mediaRecorder.mimeType || "audio/webm" });
      recordChunks.value = [];
      stream.getTracks().forEach((track) => track.stop());
      recorder.value = null;
      isRecording.value = false;
      if (blob.size > 0) {
        emit("sendAudio", blob);
      }
    };
    mediaRecorder.start();
    isRecording.value = true;
  } catch (err) {
    isRecording.value = false;
  }
};

const formatUnread = (count) => {
  if (!count || count <= 0) return "";
  return count > 9 ? "9+" : String(count);
};
</script>
