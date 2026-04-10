<template>
  <div>
    <div v-if="isAdminRoute">
      <AdminLogin
        v-if="!admin"
        @authenticated="onAdminAuthenticated"
        @go-user-app="goLogin"
      />
      <AdminDashboard
        v-else
        :admin="admin"
        @logout="logoutAdmin"
      />
    </div>
    <div v-else-if="!user">
      <AuthLogin
        v-if="authRoute === '/login'"
        @authenticated="onAuthenticated"
        @go-register="goRegister"
        @go-reset="goReset"
      />
      <AuthRegister
        v-else-if="authRoute === '/register'"
        @registered="onRegistered"
        @go-login="goLogin"
      />
      <AuthVerify
        v-else-if="authRoute === '/verify-account'"
        @verified="goLogin"
      />
      <AuthReset
        v-else-if="authRoute === '/reset-password'"
        @go-login="goLogin"
      />
    </div>
    <div v-else :class="['app-shell', { 'app-shell-mobile-encounters': current === 'encounters' && !reverificationLocked }]">
      <header class="topbar">
        <div class="topbar-mobile-head">
          <div class="mobile-screen-title">{{ currentNavLabel }}</div>
        </div>
        <div class="topbar-desktop-head">
          <div class="brand luxe">NDOLOLY</div>
          <div class="topbar-actions">
            <button v-if="!reverificationLocked" class="button ghost" @click="current = 'filters'">Filtre</button>
            <button v-if="!reverificationLocked" class="button secondary" @click="handleBoost">Boost</button>
            <button v-if="!reverificationLocked" class="button ghost" @click="openPremium">Premium</button>
            <button class="button ghost" @click="current = 'profile'">Profil</button>
            <button class="button secondary" @click="logout">Se deconnecter</button>
          </div>
        </div>
      </header>

      <div v-if="reverificationLocked" class="toast" style="position: static; margin: 16px;">
        Compte bloque jusqu'a l'envoi d'une nouvelle verification photo.
      </div>

      <div v-if="toast.visible" class="toast" @click="openMessages">
        Nouveau message de {{ toast.fromName }}
      </div>

      <div v-if="actionToast.visible" class="toast" @click="actionToast.visible = false">
        {{ actionToast.message }}
      </div>

      <div v-if="verificationGateOpen" class="modal" @click.self="verificationGateOpen = false">
        <div class="card">
          <h3>Verification requise</h3>
          <p class="muted" style="margin-top: 6px;">
            Vous devez verifier votre photo de profil avant de liker, super liker ou passer.
          </p>
          <div class="actions" style="margin-top: 14px;">
            <button class="button secondary" type="button" @click="verificationGateOpen = false">Plus tard</button>
            <button class="button" type="button" @click="goToProfileForVerification">Ouvrir mon profil</button>
          </div>
        </div>
      </div>

      <main :class="['layout', { 'layout-mobile-encounters': current === 'encounters' && !reverificationLocked }]">
        <Encounters
          v-if="!reverificationLocked && current === 'encounters'"
          :profiles="discover"
          :filters="encounterFilters"
          @filters-change="updateEncounterFilters"
          @open-filters="current = 'filters'"
          @open-profile="openUserProfile"
          @like="handleLike"
          @pass="handlePass"
          @superlike="handleSuperlike"
          @boost="handleBoost"
        />
        <Filters
          v-if="!reverificationLocked && current === 'filters'"
          :filters="encounterFilters"
          @filters-change="updateEncounterFilters"
          @back="current = 'encounters'"
        />
        <Nearby
          v-if="!reverificationLocked && current === 'nearby'"
          :profiles="nearby"
          @like="handleLike"
          @open-profile="openUserProfile"
        />
        <Likes
          v-if="!reverificationLocked && current === 'likes'"
          :likes="likedMe"
          :likes-premium-required="likesPremiumRequired"
          :views="profileViews"
          @like="handleLike"
          @like-back="handleLike"
          @message="startChatWithProfile"
          @open-profile="openUserProfile"
        />
        <UserProfile
          v-if="!reverificationLocked && current === 'user-profile'"
          :profile="selectedProfile"
          :loading="profileLoading"
          @back="current = 'likes'"
        />
        <MessagesView
          v-if="!reverificationLocked && current === 'messages'"
          :matches="matches"
          :active-match="activeMatch"
          :messages="messages"
          :me-id="user.id"
          @select="selectMatch"
          @close="closeConversation"
          @send="sendMessage"
          @send-image="sendImage"
          @send-audio="sendAudio"
        />
        <Profile
          v-if="current === 'profile'"
          :profile="user"
          @updated="reloadProfile"
          @deleted="logout"
          @logout="logout"
          @back="current = 'encounters'"
        />
      </main>

      <nav v-if="!reverificationLocked" class="nav-bottom">
        <button
          v-for="item in navItems"
          :key="item.key"
          :class="{ active: current === item.key }"
          @click="goToSection(item.key)"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg v-if="item.key === 'encounters'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 21s-6.8-4.35-9-8.19C.78 8.96 2.64 4.5 7 4.5c2.02 0 3.4 1.05 5 3 1.6-1.95 2.98-3 5-3 4.36 0 6.22 4.46 4 8.31C18.8 16.65 12 21 12 21Z" />
            </svg>
            <svg v-else-if="item.key === 'nearby'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 21s6-6.02 6-11a6 6 0 1 0-12 0c0 4.98 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
            <svg v-else-if="item.key === 'likes'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3 1.9 5.36H19l-4.14 3.14 1.56 5.5L12 13.9 7.58 17l1.56-5.5L5 8.36h5.1L12 3Z" />
            </svg>
            <svg v-else-if="item.key === 'messages'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4V6.5Z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 20a6 6 0 0 0-12 0" />
              <circle cx="12" cy="8" r="4" />
            </svg>
          </span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.key === 'messages' && unreadCount > 0" class="notif-dot">{{ unreadCount }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import api, { clearToken, getToken } from "./api";
import adminApi, { clearAdminToken, getAdminToken } from "./adminApi";
import { connectSocket, getSocket } from "./socket";
import AuthLogin from "./views/auth/Login.vue";
import AuthRegister from "./views/auth/Register.vue";
import AuthVerify from "./views/auth/Verify.vue";
import AuthReset from "./views/auth/Reset.vue";
import AdminDashboard from "./views/admin/AdminDashboard.vue";
import AdminLogin from "./views/admin/AdminLogin.vue";
import Encounters from "./views/Encounters.vue";
import Nearby from "./views/Nearby.vue";
import Likes from "./views/Likes.vue";
import MessagesView from "./views/MessagesView.vue";
import Filters from "./views/Filters.vue";
import Profile from "./views/Profile.vue";
import UserProfile from "./views/UserProfile.vue";
import { sanitizePublicMatches, sanitizePublicProfile, sanitizePublicProfiles } from "./utils";

const current = ref("encounters");
const user = ref(null);
const admin = ref(null);
const discover = ref([]);
const defaultEncounterFilters = {
  age_min: "",
  age_max: "",
  city: "",
  children: "any",
  smoker: "any",
  religion: "any"
};
const encounterFilters = ref({ ...defaultEncounterFilters });
const nearby = ref([]);
const likedMe = ref([]);
const likesPremiumRequired = ref(false);
const profileViews = ref([]);
const matches = ref([]);
const activeMatch = ref(null);
const messages = ref([]);
const unreadCount = ref(0);
const toast = ref({ visible: false, fromName: "" });
const actionToast = ref({ visible: false, message: "" });
const verificationGateOpen = ref(false);
const selectedProfile = ref(null);
const profileLoading = ref(false);
const authRoute = ref(window.location.pathname || "/login");
const authRoutes = new Set(["/login", "/register", "/verify-account", "/reset-password"]);
const isAdminRoute = computed(() => authRoute.value.startsWith("/admin"));
const reverificationLocked = computed(() => !!user.value?.reverification_required);
const navItems = [
  { key: "encounters", label: "Swipe", title: "Swipe" },
  { key: "nearby", label: "Proches", title: "Proches" },
  { key: "likes", label: "Actions", title: "Actions" },
  { key: "messages", label: "Msg", title: "Messages" },
  { key: "profile", label: "Profil", title: "Profil" }
];
const currentNavLabel = computed(() => {
  if (current.value === "filters") return "Filtres";
  if (current.value === "user-profile") return "Profil";
  return navItems.find((item) => item.key === current.value)?.title || "Swipe";
});
let geoWatchId = null;

const setRoute = (path) => {
  if (window.location.pathname === path) {
    authRoute.value = path;
    return;
  }
  window.history.pushState({}, "", path);
  authRoute.value = path;
};

const syncRoute = () => {
  authRoute.value = window.location.pathname || "/login";
};

const ensureAuthRoute = () => {
  if (!authRoutes.has(authRoute.value)) {
    setRoute("/login");
  }
};

const ensureAdminRoute = () => {
  if (!authRoute.value.startsWith("/admin")) {
    setRoute("/admin");
  }
};

const goLogin = () => setRoute("/login");
const goRegister = () => setRoute("/register");
const goReset = () => setRoute("/reset-password");

const handlePopState = () => {
  syncRoute();
  if (isAdminRoute.value) {
    if (!admin.value) {
      ensureAdminRoute();
    }
    return;
  }
  if (!user.value) {
    ensureAuthRoute();
  }
};

const postLocation = async (coords) => {
  if (!coords) return;
  const lat = coords.latitude;
  const lng = coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try {
    await api.post("/profile/location", { lat, lng });
  } catch {
    // ignore
  }
};

const updateLocationOnce = async () => {
  if (!navigator.geolocation) return;
  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await postLocation(pos.coords);
        resolve();
      },
      () => resolve(),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  });
};

const startLocationWatch = () => {
  if (!navigator.geolocation || geoWatchId !== null) return;
  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      postLocation(pos.coords);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
};

const stopLocationWatch = () => {
  if (geoWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
};

const appendMessageUnique = (message) => {
  if (!message) return;
  const msgId = message.id || message._id;
  if (!msgId) {
    messages.value = [...messages.value, message];
    return;
  }
  const exists = messages.value.some((m) => String(m.id || m._id) === String(msgId));
  if (!exists) {
    messages.value = [...messages.value, message];
  }
};

const updateMessageStatus = (statusPayload) => {
  const messageId = statusPayload?.message_id || statusPayload?.messageId;
  if (!messageId) return;
  messages.value = messages.value.map((message) => {
    const currentId = message.id || message._id;
    if (String(currentId) !== String(messageId)) return message;
    return {
      ...message,
      delivered_at: statusPayload.delivered_at || message.delivered_at || null,
      read_at: statusPayload.read_at || message.read_at || null,
      status: statusPayload.status || message.status || "sent"
    };
  });
};

const acknowledgeReceived = async (message) => {
  if (!message || String(message.from_user_id) === String(user.value?.id)) return;
  const matchId = message.match_id || message.matchId;
  const messageId = message.id || message._id;
  if (!matchId || !messageId) return;
  await api.post(`/messages/${matchId}/received`, { messageId });
};

const acknowledgeRead = async (match, messageId = null) => {
  const matchId = match?.id || match?._id || match;
  if (!matchId) return;
  const payload = messageId ? { messageId } : {};
  await api.post(`/messages/${matchId}/read`, payload);
};

const loadProfile = async () => {
  const { data } = await api.get("/profile/me");
  user.value = { ...data, id: data.id || data._id };
};

const buildDiscoverParams = (filters) => {
  const params = {};
  const ageMinRaw = filters.age_min;
  const ageMaxRaw = filters.age_max;
  if (ageMinRaw !== "" && ageMinRaw !== null && ageMinRaw !== undefined) {
    const ageMin = Number(ageMinRaw);
    if (Number.isFinite(ageMin)) params.age_min = ageMin;
  }
  if (ageMaxRaw !== "" && ageMaxRaw !== null && ageMaxRaw !== undefined) {
    const ageMax = Number(ageMaxRaw);
    if (Number.isFinite(ageMax)) params.age_max = ageMax;
  }
  const city = (filters.city || "").trim();
  if (city) params.city = city;
  if (filters.children && filters.children !== "any") params.children = filters.children;
  if (filters.smoker && filters.smoker !== "any") params.smoker = filters.smoker;
  if (filters.religion && filters.religion !== "any") params.religion = filters.religion;
  return params;
};

const loadDiscover = async (filters = encounterFilters.value) => {
  const params = buildDiscoverParams(filters);
  const { data } = await api.get("/profile/discover", { params });
  discover.value = sanitizePublicProfiles(data);
};

const loadNearby = async () => {
  try {
    await updateLocationOnce();
    const { data } = await api.get("/profile/nearby");
    nearby.value = sanitizePublicProfiles(data);
  } catch {
    nearby.value = [];
  }
};

const loadLikes = async () => {
  try {
    const { data } = await api.get("/match/liked-me");
    likedMe.value = sanitizePublicProfiles(data);
    likesPremiumRequired.value = false;
  } catch (err) {
    if (err?.response?.data?.premium_required) {
      likedMe.value = [];
      likesPremiumRequired.value = true;
      return;
    }
    throw err;
  }
};

const loadProfileViews = async () => {
  const { data } = await api.get("/profile/views");
  profileViews.value = sanitizePublicProfiles(data);
};

const loadMatches = async () => {
  const { data } = await api.get("/match/list");
  const visibleMatches = sanitizePublicMatches(data);
  matches.value = visibleMatches;
  unreadCount.value = visibleMatches.reduce((sum, item) => sum + (item.unread_count || 0), 0);
  return visibleMatches;
};

const loadMessages = async (match) => {
  if (!match) return;
  const { data } = await api.get(`/messages/${match.id}`);
  messages.value = data;
  await acknowledgeRead(match).catch(() => {});
};

const bootstrap = async () => {
  try {
    await loadProfile();
    if (user.value?.role === "admin") {
      clearToken();
      user.value = null;
      setRoute("/admin");
      return;
    }
    if (user.value?.reverification_required) {
      current.value = "profile";
      stopLocationWatch();
      return;
    }
    await Promise.all([loadDiscover(), loadNearby(), loadLikes(), loadProfileViews(), loadMatches()]);

    startLocationWatch();
    const socket = connectSocket(user.value.id);
    socket.on("match:new", () => {
      loadMatches();
      loadLikes();
    });
    socket.on("message:new", (message) => {
      const activeId = activeMatch.value?.id || activeMatch.value?._id;
      const matchId = message.match_id || message.matchId;
      const isActive = activeId && String(activeId) === String(matchId);
      void acknowledgeReceived(message).catch(() => {});
      if (isActive) {
        appendMessageUnique(message);
        if (String(message.from_user_id) !== String(user.value.id)) {
          const messageId = message.id || message._id;
          void acknowledgeRead(matchId, messageId).catch(() => {});
        }
        loadMatches();
        return;
      }

      if (String(message.from_user_id) !== String(user.value.id)) {
        unreadCount.value += 1;
        toast.value = {
          visible: true,
          fromName: message.from_user_id === user.value.id ? "vous" : "un match"
        };
        document.title = `(${unreadCount.value}) NDOLOLY`;
        setTimeout(() => {
          toast.value.visible = false;
        }, 3000);
      }
      loadMatches();
    });
    socket.on("message:status", (statusPayload) => {
      updateMessageStatus(statusPayload);
    });
  } catch (err) {
    logout();
  }
};

const bootstrapAdmin = async () => {
  const { data } = await adminApi.get("/admin/me");
  admin.value = data;
};

const onAuthenticated = async () => {
  await bootstrap();
  if (authRoutes.has(authRoute.value)) {
    setRoute("/");
  }
};

const onAdminAuthenticated = async (payload) => {
  admin.value = payload || null;
  if (!admin.value) {
    await bootstrapAdmin();
  }
  setRoute("/admin");
};

const onRegistered = (payload) => {
  if (payload?.email || payload?.phone) {
    localStorage.setItem("ndololy_pending_contact", JSON.stringify(payload));
  }
  setRoute("/verify-account");
};

const logout = () => {
  clearToken();
  stopLocationWatch();
  user.value = null;
  discover.value = [];
  encounterFilters.value = { ...defaultEncounterFilters };
  nearby.value = [];
  likedMe.value = [];
  likesPremiumRequired.value = false;
  profileViews.value = [];
  matches.value = [];
  activeMatch.value = null;
  messages.value = [];
  unreadCount.value = 0;
  toast.value = { visible: false, fromName: "" };
  selectedProfile.value = null;
  profileLoading.value = false;
  setRoute("/login");
  document.title = "NDOLOLY";
  const socket = getSocket();
  if (socket) socket.disconnect();
};

const logoutAdmin = () => {
  clearAdminToken();
  admin.value = null;
  setRoute("/admin");
};

const isVerificationRequiredError = (err) => {
  const status = err?.response?.status;
  const required = err?.response?.data?.verification_required;
  const message = err?.response?.data?.error || err?.message || "";
  return status === 403 && (required || /profile photo verification required/i.test(message));
};

const showActionToast = (message) => {
  actionToast.value = { visible: true, message: String(message || "") };
  setTimeout(() => {
    actionToast.value.visible = false;
  }, 3000);
};

const goToProfileForVerification = () => {
  verificationGateOpen.value = false;
  current.value = "profile";
};

const promptVerificationRequired = () => {
  verificationGateOpen.value = true;
};

const ensureCanInteract = async () => {
  if (user.value?.verified_photo) return true;
  try {
    const { data } = await api.get(`/profile/verification-status?ts=${Date.now()}`);
    if (data?.status === "approved") {
      user.value = { ...(user.value || {}), verified_photo: true };
      return true;
    }
  } catch {
    // ignore
  }
  promptVerificationRequired();
  return false;
};

const handleLike = async (profile) => {
  if (!profile?.id) return;
  if (!(await ensureCanInteract())) return;
  try {
    const { data } = await api.post("/match/like", { userId: profile.id, action: "like" });
    discover.value = discover.value.filter((p) => p.id !== profile.id);
    likedMe.value = likedMe.value.filter((p) => p.id !== profile.id);
    if (data.match) {
      await loadMatches();
      activeMatch.value = null;
      if (current.value === "likes") {
        current.value = "messages";
      }
    }
  } catch (err) {
    if (isVerificationRequiredError(err)) {
      promptVerificationRequired();
      return;
    }
    showActionToast(err?.response?.data?.error || err?.message || "Impossible d'envoyer le like.");
  }
};

const handleSuperlike = async (profile) => {
  if (!profile?.id) return;
  if (!(await ensureCanInteract())) return;
  try {
    const { data } = await api.post("/match/superlike", { userId: profile.id });
    discover.value = discover.value.filter((p) => p.id !== profile.id);
    if (data.match) {
      await loadMatches();
      activeMatch.value = null;
      if (current.value === "likes") {
        current.value = "messages";
      }
    }
  } catch (err) {
    if (isVerificationRequiredError(err)) {
      promptVerificationRequired();
      return;
    }
    showActionToast(err?.response?.data?.error || err?.message || "Impossible d'envoyer le super like.");
  }
};

const handlePass = async (profile) => {
  if (!profile?.id) return;
  if (!(await ensureCanInteract())) return;
  try {
    await api.post("/match/like", { userId: profile.id, action: "dislike" });
    discover.value = discover.value.filter((p) => p.id !== profile.id);
  } catch (err) {
    if (isVerificationRequiredError(err)) {
      promptVerificationRequired();
      return;
    }
    showActionToast(err?.response?.data?.error || err?.message || "Impossible de passer ce profil.");
  }
};

const selectMatch = async (match) => {
  activeMatch.value = match;
  current.value = "messages";
  await loadMessages(match);
  matches.value = matches.value.map((item) =>
    String(item.id) === String(match.id) ? { ...item, unread_count: 0 } : item
  );
  unreadCount.value = matches.value.reduce((sum, item) => sum + (item.unread_count || 0), 0);
  document.title = "NDOLOLY";
};

const closeConversation = () => {
  activeMatch.value = null;
  messages.value = [];
};

const sendMessage = async (text) => {
  if (!activeMatch.value) return;
  const { data } = await api.post(`/messages/${activeMatch.value.id}`, { content: text });
  appendMessageUnique(data);
  await loadMatches();
};

const sendImage = async (file) => {
  if (!activeMatch.value || !file) return;
  const formData = new FormData();
  formData.append("image", file);
  const { data } = await api.post(`/messages/${activeMatch.value.id}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  appendMessageUnique(data);
  await loadMatches();
};

const sendAudio = async (blob) => {
  if (!activeMatch.value || !blob) return;
  const formData = new FormData();
  const file =
    blob instanceof File
      ? blob
      : new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
  formData.append("audio", file);
  const { data } = await api.post(`/messages/${activeMatch.value.id}/audio`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  appendMessageUnique(data);
  await loadMatches();
};

const reloadProfile = async () => {
  await loadProfile();
  if (user.value?.reverification_required) {
    current.value = "profile";
    return;
  }
  await loadDiscover();
  await loadNearby();
};

const updateEncounterFilters = async (nextFilters) => {
  encounterFilters.value = { ...defaultEncounterFilters, ...(nextFilters || {}) };
  await loadDiscover(encounterFilters.value);
};

const openUserProfile = async (profile) => {
  const id = profile?.id || profile?._id || profile;
  if (!id) return;
  profileLoading.value = true;
  selectedProfile.value = null;
  current.value = "user-profile";
  try {
    const { data } = await api.get(`/profile/user/${id}`);
    selectedProfile.value = sanitizePublicProfile(data);
  } catch (err) {
    selectedProfile.value = null;
  } finally {
    profileLoading.value = false;
  }
};

const startChatWithProfile = async (profile) => {
  if (!profile?.id) return;
  const existing = matches.value.find((m) => String(m.user?.id) === String(profile.id));
  if (existing) {
    await selectMatch(existing);
    return;
  }
  if (!(await ensureCanInteract())) return;
  try {
    const { data } = await api.post("/match/like", { userId: profile.id, action: "like" });
    if (data.match) {
      await loadMatches();
      const updated = matches.value.find((m) => String(m.user?.id) === String(profile.id));
      if (updated) {
        await selectMatch(updated);
        return;
      }
    }
    current.value = "messages";
  } catch (err) {
    if (isVerificationRequiredError(err)) {
      promptVerificationRequired();
      return;
    }
    showActionToast(err?.response?.data?.error || err?.message || "Impossible de demarrer cette conversation.");
  }
};

const handleBoost = async () => {
  await api.post("/match/boost", { minutes: 30 });
  await loadDiscover();
};

const openPremium = () => {
  current.value = "encounters";
};

const goToSection = (section) => {
  if (section === "messages") {
    openMessages();
    return;
  }
  current.value = section;
};

const openMessages = () => {
  current.value = "messages";
  unreadCount.value = matches.value.reduce((sum, item) => sum + (item.unread_count || 0), 0);
  document.title = "NDOLOLY";
};

onMounted(async () => {
  syncRoute();
  window.addEventListener("popstate", handlePopState);

  if (isAdminRoute.value) {
    if (getAdminToken()) {
      try {
        await bootstrapAdmin();
      } catch (err) {
        logoutAdmin();
      }
      return;
    }
    ensureAdminRoute();
    return;
  }

  if (getToken()) {
    await bootstrap();
    if (authRoutes.has(authRoute.value)) {
      setRoute("/");
    }
    return;
  }

  ensureAuthRoute();
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", handlePopState);
  stopLocationWatch();
});
</script>
