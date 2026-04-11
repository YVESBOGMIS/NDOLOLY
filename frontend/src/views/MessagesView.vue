<template>
  <div class="card messages-view">
    <div class="chat-layout">
      <div v-if="showConversationList">
        <div class="messages-screen-head">
          <div class="messages-screen-title">Messages</div>
          <div class="messages-screen-actions">
            <div class="messages-action-pill" aria-hidden="true">
              <button class="messages-icon-btn" type="button" aria-label="Securite">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </button>
              <button class="messages-icon-btn" type="button" aria-label="Options">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 7h16" />
                  <path d="M4 17h16" />
                  <circle cx="9" cy="7" r="2.2" />
                  <circle cx="15" cy="17" r="2.2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="messages-block">
          <div class="messages-block-title">Nouveaux Matchs</div>
          <div class="match-strip match-strip-mobile">
            <button class="match-chip like-chip" type="button" @click="go('likes')">
              <div class="like-chip-box">
                <div class="like-chip-count">{{ likesCountDisplay }}</div>
              </div>
              <div class="like-chip-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 21s-6.8-4.35-9-8.19C.78 8.96 2.64 4.5 7 4.5c2.02 0 3.4 1.05 5 3 1.6-1.95 2.98-3 5-3 4.36 0 6.22 4.46 4 8.31C18.8 16.65 12 21 12 21Z" />
                </svg>
              </div>
              <div class="match-chip-label">Likes</div>
            </button>

            <button
              v-for="match in newMatches"
              :key="match.id || match._id"
              class="match-chip match-chip-round"
              type="button"
              @click="select(match)"
            >
              <div class="avatar-badge avatar-round">
                <img :src="resolvePhoto(match.user?.photos?.[0]) || placeholder" alt="" />
                <span v-if="match.unread_count > 0" class="chip-dot"></span>
              </div>
              <div class="match-chip-label">
                {{ shortName(match.user?.name) }}
                <span v-if="match.user?.verified_photo" class="verified-mini" aria-label="Profil verifie">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 2l2.3 3.8 4.4 1-3 3.4.5 4.5-4.2-1.8-4.2 1.8.5-4.5-3-3.4 4.4-1L12 2z"
                      fill="#2b7cff"
                    />
                    <path
                      d="M9.3 12.3l1.8 1.8 3.8-4"
                      fill="none"
                      stroke="#fff"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </button>
          </div>
        </div>

        <div class="messages-block">
          <div class="messages-block-title">Messages</div>
          <div v-if="!isMobile" class="field">
            <input v-model="search" placeholder="Rechercher un match..." />
          </div>
          <div class="thread-list">
            <button
              v-for="match in filteredThreads"
              :key="match.id || match._id"
              class="thread-row"
              type="button"
              @click="select(match)"
            >
              <div class="thread-avatar avatar-badge">
                <img :src="resolvePhoto(match.user?.photos?.[0]) || placeholder" alt="" />
                <span v-if="match.unread_count > 0" class="thread-dot"></span>
              </div>
              <div class="thread-main">
                <div class="thread-top">
                  <div class="thread-name">
                    {{ match.user?.name }}
                    <span v-if="match.user?.verified_photo" class="verified-badge" aria-label="Profil verifie">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 2l2.3 3.8 4.4 1-3 3.4.5 4.5-4.2-1.8-4.2 1.8.5-4.5-3-3.4 4.4-1L12 2z"
                          fill="currentColor"
                        />
                        <path
                          d="M9.3 12.3l1.8 1.8 3.8-4"
                          fill="none"
                          stroke="#fff"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <div v-if="match.unread_count > 0" class="thread-pill pill-turn">A TON TOUR</div>
                  <div v-else-if="!match.has_messages" class="thread-pill pill-like">TA ENVOYE UN LIKE</div>
                </div>
                <div class="thread-snippet">{{ previewText(match) }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div v-if="showActivePanel">
        <div v-if="!activeMatch" class="muted">Selectionnez un match pour discuter.</div>
        <div v-else>
          <div class="chat-frame">
            <div class="chat-header">
              <button class="chat-profile-link" type="button" @click="openActiveProfile">
                <img :src="resolvePhoto(activeMatch.user?.photos?.[0]) || placeholder" alt="" />
                <div class="chat-profile-meta">
                  <strong>{{ activeMatch.user?.name }}</strong>
                  <div class="muted">{{ activeMatch.user?.location }}</div>
                </div>
              </button>
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
                  <path
                    d="M16.5 6.5l-7.8 7.8a2.5 2.5 0 003.5 3.5l8-8a4 4 0 10-5.7-5.7l-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
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
                  <path
                    d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zm-5 8v-2h-2v2h2z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <input v-model="text" placeholder="Ecrire un message..." />
              <button class="send-icon" type="submit" aria-label="Envoyer">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12L20 4l-4 16-4-6-8-2z" fill="currentColor" />
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { resolvePhoto } from "../utils";

const props = defineProps({
  matches: { type: Array, default: () => [] },
  likesCount: { type: [Number, String], default: null },
  activeMatch: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  meId: { type: [Number, String], default: null }
});

const emit = defineEmits(["select", "send", "sendImage", "sendAudio", "close", "go", "openProfile"]);

const text = ref("");
const search = ref("");
const fileInput = ref(null);
const isRecording = ref(false);
const recorder = ref(null);
const recordChunks = ref([]);
const isMobile = ref(false);
const placeholder =
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80";

const newMatches = computed(() => props.matches.filter((m) => !m.has_messages));

const threads = computed(() => {
  const list = Array.isArray(props.matches) ? [...props.matches] : [];
  return list.sort((a, b) => {
    const aTime = new Date(a?.last_message_at || a?.created_at || 0).getTime();
    const bTime = new Date(b?.last_message_at || b?.created_at || 0).getTime();
    return bTime - aTime;
  });
});

const likesCountDisplay = computed(() => {
  const value = props.likesCount;
  const num = value === null || value === undefined || value === "" ? 0 : Number(value);
  if (!Number.isFinite(num) || num <= 0) return "0";
  return num > 99 ? "99+" : String(num);
});

const filteredThreads = computed(() => {
  const term = search.value.toLowerCase();
  if (!term) return threads.value;
  return threads.value.filter((m) => m.user?.name?.toLowerCase().includes(term));
});

const showConversationList = computed(() => !isMobile.value || !props.activeMatch);
const showActivePanel = computed(() => !isMobile.value || !!props.activeMatch);

const select = (match) => emit("select", match);
const closeChat = () => emit("close");
const go = (section) => emit("go", section);
const openActiveProfile = () => {
  const user = props.activeMatch?.user;
  if (!user) return;
  emit("openProfile", user);
};

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

const shortName = (name) => {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const first = raw.split(/\s+/).filter(Boolean)[0] || raw;
  return first.length > 10 ? `${first.slice(0, 10)}...` : first;
};

const previewText = (match) => {
  const last = match?.last_message;
  if (last) {
    if (last.type === "image") return "Photo";
    if (last.type === "audio") return "Message vocal";
    const content = String(last.content || "").trim();
    return content || "Message";
  }
  if (!match?.has_messages) return "Activite recente, Matche des maintenant...";
  return "Discussion";
};

const syncViewport = () => {
  if (typeof window === "undefined") return;
  isMobile.value = window.innerWidth <= 720;
};

onMounted(() => {
  syncViewport();
  window.addEventListener("resize", syncViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewport);
});
</script>
