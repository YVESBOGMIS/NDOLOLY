<template>
  <div class="auth-shell">
    <div class="auth-hero">
      <h1 class="brand-title luxe">NDOLOLY</h1>
      <p>Rencontrez des personnes compatibles, simplement et en toute securite.</p>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </div>
    <div class="card auth-card">
      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">Connexion</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">Inscription</button>
        <button :class="{ active: mode === 'verify' }" @click="mode = 'verify'">OTP</button>
        <button :class="{ active: mode === 'reset' }" @click="mode = 'reset'">Reset</button>
      </div>

      <form v-if="mode === 'login'" @submit.prevent="login">
        <div class="field">
          <label>Email ou Telephone</label>
          <input v-model="contact" placeholder="email ou +237..." />
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <PasswordInput v-model="password" autocomplete="current-password" />
        </div>
        <button class="button" type="submit">Se connecter</button>
      </form>

      <form v-if="mode === 'register'" @submit.prevent="register">
        <div class="grid two">
          <div class="field">
            <label>Nom ou Pseudo</label>
            <input v-model="name" />
          </div>
          <div class="field">
            <label>Naissance</label>
            <input v-model="birthdate" type="date" />
          </div>
          <div class="field">
            <label>Sexe</label>
            <select v-model="gender">
              <option value="male">Homme</option>
              <option value="female">Femme</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div class="field">
            <label>Ville</label>
            <input v-model="location" />
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>Nombre d'enfants</label>
            <input v-model.number="childrenCount" type="number" min="0" />
          </div>
          <div class="field">
            <label>Fumeur</label>
            <select v-model="smoker">
              <option :value="null">Non renseigne</option>
              <option :value="true">Fumeur</option>
              <option :value="false">Non fumeur</option>
            </select>
          </div>
          <div class="field">
            <label>Religion</label>
            <select v-model="religion">
              <option value="">Non renseignee</option>
              <option value="catholique">Catholique</option>
              <option value="protestant">Protestant</option>
              <option value="musulman">Musulman</option>
            </select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>Email</label>
            <input v-model="email" type="email" />
          </div>
          <div class="field">
            <label>Telephone</label>
            <input v-model="phone" placeholder="+237..." />
          </div>
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <PasswordInput v-model="password" autocomplete="new-password" />
        </div>
        <button class="button" type="submit">Creer mon compte</button>
      </form>

      <form v-if="mode === 'verify'" @submit.prevent="verify">
        <div class="field">
          <label>Email ou Telephone</label>
          <input v-model="contact" placeholder="email ou +237..." />
        </div>
        <div class="field">
          <label>Code OTP</label>
          <input v-model="otp" placeholder="123456" />
        </div>
        <button class="button" type="submit">Verifier</button>
        <p v-if="lastOtp" class="notice">OTP demo: {{ lastOtp }}</p>
      </form>

      <form v-if="mode === 'reset'" @submit.prevent="resetPassword">
        <div class="field">
          <label>Email ou Telephone</label>
          <input v-model="contact" placeholder="email ou +237..." />
        </div>
        <div class="field">
          <label>Nouveau mot de passe</label>
          <PasswordInput v-model="newPassword" autocomplete="new-password" />
        </div>
        <div class="field">
          <label>Code OTP</label>
          <input v-model="otp" placeholder="123456" />
        </div>
        <button class="button secondary" type="button" @click="requestReset">Demander un code</button>
        <button class="button" type="submit">Mettre a jour</button>
        <p v-if="lastOtp" class="notice">OTP demo: {{ lastOtp }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import api, { setToken } from "../api";
import PasswordInput from "../components/PasswordInput.vue";

const emit = defineEmits(["authenticated"]);

const mode = ref("login");
const email = ref("");
const phone = ref("");
const password = ref("");
const newPassword = ref("");
const name = ref("");
const birthdate = ref("");
const gender = ref("male");
const location = ref("");
const childrenCount = ref(null);
const smoker = ref(null);
const religion = ref("");
const contact = ref("");
const otp = ref("");
const lastOtp = ref("");
const notice = ref("");

const parseContact = () => {
  const value = contact.value.trim();
  if (!value) return {};
  if (value.includes("@")) return { email: value };
  return { phone: value };
};

const login = async () => {
  notice.value = "";
  try {
    const payload = parseContact();
    payload.password = password.value;
    const { data } = await api.post("/auth/login", payload);
    setToken(data.token);
    emit("authenticated", data.token);
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur de connexion";
  }
};

const register = async () => {
  notice.value = "";
  try {
    const normalizedChildren = childrenCount.value === "" || childrenCount.value === null
      ? null
      : Number(childrenCount.value);
    const normalizedReligion = religion.value ? religion.value : null;
    const payload = {
      email: email.value || undefined,
      phone: phone.value || undefined,
      password: password.value,
      name: name.value,
      birthdate: birthdate.value,
      gender: gender.value,
      location: location.value,
      children_count: Number.isFinite(normalizedChildren) ? normalizedChildren : null,
      smoker: smoker.value,
      religion: normalizedReligion
    };
    const { data } = await api.post("/auth/register", payload);
    lastOtp.value = data.otp;
    notice.value = data.message;
    mode.value = "verify";
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur d'inscription";
  }
};

const verify = async () => {
  try {
    const payload = parseContact();
    payload.code = otp.value;
    const { data } = await api.post("/auth/verify", payload);
    notice.value = data.message;
    mode.value = "login";
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur de verification";
  }
};

const requestReset = async () => {
  try {
    const payload = parseContact();
    const { data } = await api.post("/auth/request-reset", payload);
    lastOtp.value = data.otp;
    notice.value = data.message;
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur";
  }
};

const resetPassword = async () => {
  try {
    const payload = parseContact();
    payload.code = otp.value;
    payload.newPassword = newPassword.value;
    const { data } = await api.post("/auth/reset", payload);
    notice.value = data.message;
    mode.value = "login";
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur";
  }
};
</script>

<style scoped>
.auth-shell {
  min-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 40px 20px;
  text-align: center;
}

.auth-hero {
  max-width: 560px;
}

.auth-card {
  width: min(560px, 100%);
  text-align: left;
}

.auth-hero p {
  margin: 0 0 8px 0;
  color: var(--muted);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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

.notice {
  color: var(--muted);
}
</style>
