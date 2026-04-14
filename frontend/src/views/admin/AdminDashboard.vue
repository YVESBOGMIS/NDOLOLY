<template>
  <div class="admin-shell">
    <header class="admin-topbar">
      <div>
        <div class="badge">Administration</div>
        <h1>Dashboard NDOLOLY</h1>
        <p class="muted">Connecte au backend en temps reel de gestion.</p>
      </div>
      <div class="admin-topbar-actions">
        <div class="admin-user-card">
          <strong>{{ admin.name }}</strong>
          <span>{{ admin.email }}</span>
        </div>
        <button class="button secondary" @click="refreshAll">Actualiser</button>
        <button class="button ghost" @click="$emit('logout')">Se deconnecter</button>
      </div>
    </header>

    <p v-if="notice" class="notice">{{ notice }}</p>

    <section class="admin-metrics grid five">
      <article class="card metric-card">
        <span class="metric-label">Utilisateurs</span>
        <strong>{{ overview.metrics?.users_total || 0 }}</strong>
        <small>{{ overview.metrics?.users_verified || 0 }} verifies</small>
      </article>
      <article class="card metric-card">
        <span class="metric-label">Messages</span>
        <strong>{{ overview.metrics?.messages_total || 0 }}</strong>
        <small>messages echanges</small>
      </article>
      <article class="card metric-card">
        <span class="metric-label">Moderation</span>
        <strong>{{ overview.metrics?.pending_reports || 0 }}</strong>
        <small>signalements en attente</small>
      </article>
      <article class="card metric-card">
        <span class="metric-label">Verifications</span>
        <strong>{{ overview.metrics?.total_verifications || 0 }}</strong>
        <small>
          {{ overview.metrics?.pending_verifications || 0 }} a revoir ·
          {{ overview.metrics?.approved_verifications || 0 }} approuvees ·
          {{ overview.metrics?.rejected_verifications || 0 }} rejetees
        </small>
      </article>
      <article class="card metric-card">
        <span class="metric-label">Activite 7 jours</span>
        <strong>{{ overview.metrics?.active_users_7d || 0 }}</strong>
        <small>utilisateurs actifs</small>
      </article>
    </section>

    <nav class="admin-tabs">
      <button :class="{ active: tab === 'overview' }" @click="tab = 'overview'">Vue d'ensemble</button>
      <button :class="{ active: tab === 'users' }" @click="tab = 'users'">Utilisateurs</button>
      <button :class="{ active: tab === 'reports' }" @click="tab = 'reports'">Signalements</button>
      <button :class="{ active: tab === 'verifications' }" @click="tab = 'verifications'">Verifications photo</button>
    </nav>

    <section v-if="tab === 'overview'" class="grid two">
      <article class="card">
        <h2>Derniers inscrits</h2>
        <div class="admin-list">
          <div v-for="item in overview.recent_users || []" :key="item.id" class="admin-list-row">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <span
                  :title="item.is_online ? 'Connecte maintenant' : 'Non connecte'"
                  :style="{
                    width: '10px',
                    height: '10px',
                    borderRadius: '999px',
                    display: 'inline-block',
                    background: item.is_online ? '#22c55e' : '#ef4444'
                  }"
                ></span>
                <strong>{{ item.name }}</strong>
              </div>
              <div class="muted">{{ item.email || item.phone || "Sans contact" }}</div>
            </div>
            <div class="admin-pills">
              <span class="pill">{{ item.location || "Sans ville" }}</span>
              <span class="pill" :class="{ warn: !item.verified }">{{ item.verified ? "verifie" : "non verifie" }}</span>
            </div>
            <div class="admin-actions">
              <button v-if="!item.verified" class="button tiny" @click="activateUserAccount(item)">
                Activer compte (OTP)
              </button>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Etat plateforme</h2>
        <div class="admin-kpi-stack">
          <div class="admin-kpi-row">
            <span>Premium</span>
            <strong>{{ overview.metrics?.premium_users || 0 }}</strong>
          </div>
          <div class="admin-kpi-row">
            <span>Suspendus</span>
            <strong>{{ overview.metrics?.suspended_users || 0 }}</strong>
          </div>
          <div class="admin-kpi-row">
            <span>Matchs</span>
            <strong>{{ overview.metrics?.matches_total || 0 }}</strong>
          </div>
          <div class="admin-kpi-row">
            <span>Messages</span>
            <strong>{{ overview.metrics?.messages_total || 0 }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section v-if="tab === 'users'" class="card">
      <div class="admin-toolbar">
        <input v-model="userSearch" placeholder="Rechercher un nom, email, telephone, ville" />
        <select v-model="userStatus">
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="premium">Premium</option>
          <option value="unverified">Non verifies</option>
        </select>
        <select v-model="userRole">
          <option value="user">Utilisateurs</option>
          <option value="admin">Admins</option>
          <option value="all">Tous roles</option>
        </select>
        <button class="button" @click="loadUsers">Filtrer</button>
      </div>

      <div v-if="conversationTarget" ref="conversationPanelRef" class="admin-conversations">
        <div class="admin-subtoolbar">
          <div>
            <h3>Conversations de {{ conversationTarget.name }}</h3>
            <p class="muted">
              {{ conversationPayload.length }} conversation(s)
            </p>
          </div>
          <button class="button secondary" @click="closeConversations">Fermer</button>
        </div>

        <div v-if="conversationLoading" class="card">
          <p class="muted">Chargement des conversations...</p>
        </div>

        <div v-else-if="conversationPayload.length" class="chat-layout admin-chat-layout">
          <div>
            <div class="field">
              <input v-model="conversationSearch" placeholder="Rechercher une conversation..." />
            </div>
            <div class="section-title">Discussions</div>
            <div class="grid" style="gap: 10px;">
              <div
                v-for="conversation in filteredConversationPayload"
                :key="conversation.id"
                class="profile-card admin-conversation-list-item"
                :class="{ active: String(activeConversationId) === String(conversation.id) }"
                @click="selectConversation(conversation)"
              >
                <div v-if="resolveAsset(conversation.other_user?.photos?.[0])" class="avatar-badge">
                  <img :src="resolveAsset(conversation.other_user?.photos?.[0])" alt="" />
                </div>
                <div style="margin-top: 8px;">
                  <strong>{{ conversation.other_user?.name || "Utilisateur inconnu" }}</strong>
                  <div class="muted">{{ conversation.other_user?.location || conversation.other_user?.email || "Sans detail" }}</div>
                  <div class="muted">{{ conversation.messages_count }} message(s)</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div v-if="!activeConversation" class="muted">Selectionnez une conversation pour lire les messages.</div>
            <div v-else>
              <div class="chat-frame admin-chat-frame">
                <div class="chat-header">
                  <img v-if="resolveAsset(activeConversation.other_user?.photos?.[0])" :src="resolveAsset(activeConversation.other_user?.photos?.[0])" alt="" />
                  <div>
                    <strong>{{ activeConversation.other_user?.name || "Utilisateur inconnu" }}</strong>
                    <div class="muted">
                      {{ activeConversation.other_user?.location || activeConversation.other_user?.email || "Sans detail" }}
                    </div>
                  </div>
                  <button class="chat-close" type="button" aria-label="Retour a la liste" @click="clearActiveConversation">
                    &times;
                  </button>
                </div>

                <div class="message-list chat-scroll">
                  <div
                    v-for="message in activeConversation.messages"
                    :key="message.id"
                    class="message"
                    :class="isAdminConversationSender(message) ? 'me' : 'them'"
                  >
                    <template v-if="message.type === 'text'">
                      <span>{{ message.content }}</span>
                    </template>
                    <template v-else-if="message.type === 'image'">
                      <img
                        :src="resolveAsset(message.media_url)"
                        alt="image"
                        style="max-width: 100%; border-radius: 12px;"
                      />
                    </template>
                    <template v-else-if="message.type === 'audio'">
                      <audio
                        :src="resolveAsset(message.media_url)"
                        controls
                        style="width: 100%; margin-top: 6px;"
                      />
                    </template>
                    <template v-else>
                      <span>{{ message.content || message.type }}</span>
                    </template>
                    <div class="message-status">
                      {{ messageSenderLabel(activeConversation, message) }} · {{ formatDate(message.created_at) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <article v-else class="card admin-report-card">
          <h3>Aucune conversation</h3>
          <p class="muted">Cet utilisateur n'a encore aucun match ou aucun message.</p>
        </article>
      </div>

      <div v-if="photoTarget" ref="photoPanelRef" class="admin-conversations">
        <div class="admin-subtoolbar">
          <div>
            <h3>Photos de {{ photoTarget.name }}</h3>
            <p class="muted">{{ photoList.length }} photo(s) dans le profil</p>
          </div>
          <button class="button secondary" @click="closePhotos">Fermer</button>
        </div>

        <div v-if="photoLoading" class="card">
          <p class="muted">Chargement des photos...</p>
        </div>

        <div v-else-if="photoList.length" class="admin-photo-grid">
          <article v-for="photo in photoList" :key="photo" class="card admin-photo-card">
            <img class="admin-proof" :src="resolveAsset(photo)" alt="" />
            <div class="admin-actions">
              <a class="button tiny secondary" :href="resolveAsset(photo)" target="_blank" rel="noreferrer">Ouvrir</a>
              <button class="button tiny danger" @click="deleteUserPhoto(photo)">Supprimer</button>
            </div>
          </article>
        </div>

        <article v-else class="card admin-report-card">
          <h3>Aucune photo</h3>
          <p class="muted">Cet utilisateur n'a actuellement aucune photo dans son profil.</p>
        </article>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Etat</th>
              <th>Signalements</th>
              <th>Verification</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in users" :key="item.id">
              <td>
                <div class="admin-table-user">
                  <img v-if="item.photos?.[0]" :src="resolveAsset(item.photos[0])" alt="" />
                  <div>
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                      <span
                        :title="item.is_online ? 'Connecte maintenant' : 'Non connecte'"
                        :style="{
                          width: '10px',
                          height: '10px',
                          borderRadius: '999px',
                          display: 'inline-block',
                          background: item.is_online ? '#22c55e' : '#ef4444'
                        }"
                      ></span>
                      <strong>{{ item.name }}</strong>
                    </div>
                    <div class="muted">{{ item.email || item.phone || "Sans contact" }}</div>
                    <div class="muted">{{ item.location || "Sans ville" }}</div>
                    <div class="admin-actions" style="margin-top: 8px;">
                      <button v-if="!item.verified" class="button tiny" @click="activateUserAccount(item)">
                        Activer compte (OTP)
                      </button>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div class="admin-pills">
                  <span class="pill">{{ item.role }}</span>
                  <span class="pill" :class="{ warn: item.suspended }">{{ item.suspended ? "suspendu" : "actif" }}</span>
                  <span class="pill" :class="{ success: item.premium }">{{ item.premium ? "premium" : "standard" }}</span>
                  <span class="pill" :class="{ warn: !item.verified, success: item.verified }">
                    {{ item.verified ? "verifie" : "non verifie" }}
                  </span>
                  <span v-if="item.reverification_required" class="pill warn">reverification requise</span>
                </div>
              </td>
              <td>{{ item.reports_pending }} en attente / {{ item.reports_total }} total</td>
              <td>
                <div class="admin-pills">
                  <span class="pill">
                    {{ item.reverification_required ? "reverification requise" : item.verification_status }}
                  </span>
                  <span v-if="!item.verified" class="pill" :class="{ warn: !item.otp_pending, success: item.otp_pending }">
                    {{ item.otp_pending ? "OTP en attente" : "OTP manquant/expire" }}
                  </span>
                </div>
              </td>
              <td>
                <div class="admin-actions">
                  <button class="button tiny secondary" @click="toggleUser(item, 'suspended', !item.suspended)">
                    {{ item.suspended ? "Restaurer" : "Suspendre" }}
                  </button>
                  <button class="button tiny secondary" @click="toggleUser(item, 'premium', !item.premium)">
                    {{ item.premium ? "Retirer premium" : "Mettre premium" }}
                  </button>
                  <button class="button tiny ghost" @click="toggleUser(item, 'verified_photo', !item.verified_photo)">
                    {{ item.verified_photo ? "Retirer badge photo" : "Valider photo" }}
                  </button>
                  <button class="button tiny ghost" @click="openPhotos(item)">
                    Photos
                  </button>
                  <button class="button tiny ghost" @click="openConversations(item)">
                    Conversations
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="tab === 'reports'" class="grid two">
      <article v-for="item in reports" :key="item.id" class="card admin-report-card">
        <div class="admin-report-head">
          <div>
            <h3>{{ item.reason }}</h3>
            <p class="muted">Statut: {{ item.status }}</p>
          </div>
          <span class="pill" :class="{ warn: item.status === 'pending', success: item.status === 'reviewed' }">
            {{ item.status }}
          </span>
        </div>
        <div class="admin-report-users">
          <div>
            <span class="muted">Reporter</span>
            <strong>{{ item.reporter?.name || "Inconnu" }}</strong>
          </div>
          <div>
            <span class="muted">Signale</span>
            <strong>{{ item.reported?.name || "Inconnu" }}</strong>
          </div>
        </div>
        <p class="muted">{{ formatDate(item.created_at) }}</p>
        <p v-if="item.note" class="admin-note">{{ item.note }}</p>
        <button
          v-if="item.status !== 'reviewed'"
          class="button"
          @click="reviewReport(item)"
        >
          Marquer comme traite
        </button>
      </article>
    </section>

    <section v-if="tab === 'verifications'" class="card">
      <div class="admin-subtoolbar">
        <div>
          <div class="admin-pills">
            <span class="pill warn">En attente {{ overview.metrics?.pending_verifications || 0 }}</span>
            <span class="pill success">Approuvees {{ overview.metrics?.approved_verifications || 0 }}</span>
            <span class="pill">Rejetees {{ overview.metrics?.rejected_verifications || 0 }}</span>
          </div>
          <div class="muted" style="margin-top: 6px;">
            {{ overview.metrics?.total_verifications || 0 }} verification(s) historisees
          </div>
        </div>
        <div class="admin-pills">
          <button
            class="button tiny"
            :class="verificationStatusFilter === 'all' ? '' : 'secondary'"
            @click="setVerificationFilter('all')"
          >
            Toutes
          </button>
          <button
            class="button tiny"
            :class="verificationStatusFilter === 'pending' ? '' : 'secondary'"
            @click="setVerificationFilter('pending')"
          >
            En attente
          </button>
          <button
            class="button tiny"
            :class="verificationStatusFilter === 'approved' ? '' : 'secondary'"
            @click="setVerificationFilter('approved')"
          >
            Approuvees
          </button>
          <button
            class="button tiny"
            :class="verificationStatusFilter === 'rejected' ? '' : 'secondary'"
            @click="setVerificationFilter('rejected')"
          >
            Rejetees
          </button>
        </div>
        <span class="muted">{{ verifications.length }} proposition(s)</span>
      </div>

      <div class="grid two">
      <article v-for="item in verifications" :key="item.id" class="card admin-report-card">
        <div class="admin-report-head">
          <div>
            <h3>{{ item.user?.name || "Utilisateur supprime" }}</h3>
            <p class="muted">{{ item.user?.email || item.user?.phone || "Sans contact" }}</p>
          </div>
          <span class="pill" :class="{ warn: item.status === 'pending', success: item.status === 'approved' }">
            {{ item.status }}
          </span>
        </div>
        <img
          v-if="item.photo_url"
          class="admin-proof"
          :src="resolveAsset(item.photo_url)"
          alt=""
        />
        <div v-else class="admin-proof admin-proof-empty">Aucune photo de preuve</div>
        <p class="muted">Soumis le {{ formatDate(item.submitted_at) }}</p>
        <p v-if="item.note" class="admin-note">{{ item.note }}</p>
        <div v-if="item.status === 'pending'" class="admin-actions">
          <button class="button" @click="reviewVerification(item, 'approve')">Approuver</button>
          <button class="button ghost" @click="reviewVerification(item, 'reject')">Rejeter</button>
        </div>
        <div v-else-if="item.status === 'approved'" class="admin-actions">
          <button class="button ghost" @click="toggleUser(item.user, 'verified_photo', false)">Retirer validation</button>
        </div>
        <div v-else-if="item.status === 'rejected'" class="admin-actions">
          <button class="button" @click="reviewVerification(item, 'approve')">Approuver</button>
        </div>
      </article>
      <article v-if="!verifications.length" class="card admin-report-card">
        <h3>Aucune verification a afficher</h3>
        <p class="muted">
          Aucun utilisateur n'a actuellement soumis de photo de verification et aucune validation historique n'est disponible.
        </p>
      </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import adminApi from "../../adminApi";

const props = defineProps({
  admin: {
    type: Object,
    required: true
  }
});

defineEmits(["logout"]);

const tab = ref("overview");
const overview = ref({ metrics: {} });
const users = ref([]);
const reports = ref([]);
const verifications = ref([]);
const conversationTarget = ref(null);
const conversationPayload = ref([]);
const conversationLoading = ref(false);
const conversationPanelRef = ref(null);
const photoTarget = ref(null);
const photoList = ref([]);
const photoLoading = ref(false);
const photoPanelRef = ref(null);
const conversationSearch = ref("");
const activeConversationId = ref(null);
const notice = ref("");
const userSearch = ref("");
const userStatus = ref("all");
const userRole = ref("user");
const verificationStatusFilter = ref("all");
let liveStatusTimer = null;

const setError = (err, fallback) => {
  notice.value = err.response?.data?.error || fallback;
};

const resolveAsset = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${adminApi.defaults.baseURL}${url}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const sortedConversationPayload = computed(() => (
  [...conversationPayload.value].sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
));

const filteredConversationPayload = computed(() => {
  const term = conversationSearch.value.trim().toLowerCase();
  if (!term) return sortedConversationPayload.value;
  return sortedConversationPayload.value.filter((conversation) => {
    const other = conversation.other_user || {};
    return [
      other.name,
      other.email,
      other.phone,
      other.location
    ].some((value) => String(value || "").toLowerCase().includes(term));
  });
});

const activeConversation = computed(() => (
  filteredConversationPayload.value.find((item) => String(item.id) === String(activeConversationId.value))
  || sortedConversationPayload.value.find((item) => String(item.id) === String(activeConversationId.value))
  || null
));

const loadOverview = async () => {
  const { data } = await adminApi.get("/admin/overview");
  overview.value = data;
};

const loadUsers = async () => {
  const { data } = await adminApi.get("/admin/users", {
    params: {
      search: userSearch.value,
      status: userStatus.value,
      role: userRole.value
    }
  });
  users.value = data;
};

const loadReports = async () => {
  const { data } = await adminApi.get("/admin/reports");
  reports.value = data;
};

const loadVerifications = async () => {
  const { data } = await adminApi.get("/admin/verifications", {
    params: { status: verificationStatusFilter.value }
  });
  verifications.value = data;
};

const setVerificationFilter = async (status) => {
  verificationStatusFilter.value = status;
  notice.value = "";
  try {
    await loadVerifications();
  } catch (err) {
    setError(err, "Impossible de charger les verifications photo.");
  }
};

const refreshAll = async () => {
  notice.value = "";
  try {
    await Promise.all([loadOverview(), loadUsers(), loadReports(), loadVerifications()]);
  } catch (err) {
    setError(err, "Impossible de charger le dashboard admin.");
  }
};

const toggleUser = async (user, field, value) => {
  notice.value = "";
  try {
    await adminApi.patch(`/admin/users/${user.id}`, { [field]: value });
    await Promise.all([loadUsers(), loadOverview(), loadVerifications()]);
  } catch (err) {
    setError(err, "Impossible de mettre a jour cet utilisateur.");
  }
};

const activateUserAccount = async (user) => {
  if (!user?.id) return;
  const confirmed = window.confirm("Activer ce compte (validation OTP faite manuellement par l'admin) ?");
  if (!confirmed) return;
  notice.value = "";
  try {
    try {
      await adminApi.post(`/admin/users/${user.id}/verify-account`, {});
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      // Compatibility fallback: if dedicated endpoint is unavailable or unstable,
      // force account activation through generic admin update.
      if (![401, 403].includes(status)) {
        await adminApi.patch(`/admin/users/${user.id}`, { verified: true });
      } else {
        throw err;
      }
    }
    await Promise.all([loadUsers(), loadOverview()]);
    notice.value = "Compte active avec succes.";
  } catch (err) {
    setError(err, "Impossible d'activer ce compte.");
  }
};

const openConversations = async (user) => {
  conversationTarget.value = user;
  conversationPayload.value = [];
  conversationLoading.value = true;
  activeConversationId.value = null;
  conversationSearch.value = "";
  notice.value = "";
  await nextTick();
  conversationPanelRef.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  try {
    const { data } = await adminApi.get(`/admin/users/${user.id}/conversations`);
    conversationTarget.value = data.user || user;
    conversationPayload.value = data.conversations || [];
    activeConversationId.value = (data.conversations || [])[0]?.id || null;
    await nextTick();
    conversationPanelRef.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  } catch (err) {
    setError(err, "Impossible de charger les conversations de cet utilisateur.");
  } finally {
    conversationLoading.value = false;
  }
};

const openPhotos = async (user) => {
  photoTarget.value = user;
  photoList.value = Array.isArray(user?.photos) ? [...user.photos] : [];
  photoLoading.value = true;
  notice.value = "";
  await nextTick();
  photoPanelRef.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  try {
    const { data } = await adminApi.get("/admin/users", {
      params: {
        search: user.email || user.phone || user.name,
        status: "all",
        role: "all"
      }
    });
    const refreshed = (data || []).find((item) => String(item.id) === String(user.id)) || user;
    photoTarget.value = refreshed;
    photoList.value = Array.isArray(refreshed.photos) ? refreshed.photos : [];
    await nextTick();
    photoPanelRef.value?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  } catch (err) {
    setError(err, "Impossible de charger les photos de cet utilisateur.");
  } finally {
    photoLoading.value = false;
  }
};

const closePhotos = () => {
  photoTarget.value = null;
  photoList.value = [];
  photoLoading.value = false;
};

const deleteUserPhoto = async (photo) => {
  if (!photoTarget.value || !photo) return;
  const confirmed = window.confirm("Supprimer cette photo du profil utilisateur ?");
  if (!confirmed) return;
  notice.value = "";
  try {
    const { data } = await adminApi.delete(`/admin/users/${photoTarget.value.id}/photos`, {
      data: { photo }
    });
    photoTarget.value = data.user || photoTarget.value;
    photoList.value = (data.user?.photos || []).slice();
    await loadUsers();
  } catch (err) {
    setError(err, "Impossible de supprimer cette photo.");
  }
};

const closeConversations = () => {
  conversationTarget.value = null;
  conversationPayload.value = [];
  conversationLoading.value = false;
  activeConversationId.value = null;
  conversationSearch.value = "";
};

const isAdminConversationSender = (message) => {
  return String(message.from_user_id) === String(conversationTarget.value?.id);
};

const messageSenderLabel = (conversation, message) => {
  if (!conversationTarget.value) return "Utilisateur";
  return isAdminConversationSender(message)
    ? conversationTarget.value.name
    : (conversation?.other_user?.name || "Autre utilisateur");
};

const selectConversation = (conversation) => {
  activeConversationId.value = conversation?.id || null;
};

const clearActiveConversation = () => {
  activeConversationId.value = null;
};

const reviewReport = async (item) => {
  const note = window.prompt("Note de traitement (optionnel)") || "";
  try {
    await adminApi.post(`/admin/reports/${item.id}/review`, { note });
    await Promise.all([loadReports(), loadOverview(), loadUsers()]);
  } catch (err) {
    setError(err, "Impossible de traiter ce signalement.");
  }
};

const reviewVerification = async (item, action) => {
  const note = window.prompt("Note de moderation (optionnel)") || "";
  try {
    await adminApi.post(`/admin/verifications/${item.id}/decision`, { action, note });
    await Promise.all([loadVerifications(), loadOverview(), loadUsers()]);
  } catch (err) {
    setError(err, "Impossible de traiter cette verification.");
  }
};

onMounted(() => {
  refreshAll();
  liveStatusTimer = setInterval(() => {
    if (tab.value !== "users" && tab.value !== "overview") return;
    Promise.all([loadUsers(), loadOverview()]).catch(() => {});
  }, 10000);
});

onBeforeUnmount(() => {
  if (liveStatusTimer) {
    clearInterval(liveStatusTimer);
    liveStatusTimer = null;
  }
});
</script>
