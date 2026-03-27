<template>
  <div class="auth-shell">
    <div class="auth-hero">
      <h1 class="brand-title luxe">NDOLOLY</h1>
      <p class="auth-subtitle">Reinitialisez votre mot de passe en toute securite.</p>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </div>

    <div class="card auth-card">
      <h2 class="auth-title">Reinitialiser le mot de passe</h2>
      <form @submit.prevent="requestCode">
        <div class="field">
          <label>Email ou telephone</label>
          <input v-model="contact" placeholder="email ou +237..." />
        </div>
        <button class="button auth-button" type="submit">Envoyer le code</button>
      </form>

      <div v-if="codeSent" class="auth-divider"></div>

      <form v-if="codeSent" @submit.prevent="resetPassword">
        <div class="field">
          <label>Code OTP</label>
          <input v-model="otp" placeholder="123456" />
        </div>
        <div class="field">
          <label>Nouveau mot de passe</label>
          <input v-model="newPassword" type="password" />
        </div>
        <div class="field">
          <label>Confirmer mot de passe</label>
          <input v-model="confirmPassword" type="password" />
        </div>
        <button class="button auth-button" type="submit">Reinitialiser le mot de passe</button>
      </form>

      <div class="auth-foot">
        <button class="link" type="button" @click="$emit('go-login')">Retour a la connexion</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import api from "../../api";

const emit = defineEmits(["go-login"]);

const contact = ref("");
const otp = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const codeSent = ref(false);
const notice = ref("");

const parseContact = () => {
  const value = contact.value.trim();
  if (!value) return {};
  if (value.includes("@")) return { email: value };
  return { phone: value.replace(/[^\d+]/g, "") };
};

const requestCode = async () => {
  notice.value = "";
  try {
    const payload = parseContact();
    const { data } = await api.post("/auth/request-reset", payload);
    notice.value = data.message || "Code envoye";
    codeSent.value = true;
  } catch (err) {
    notice.value = err.response?.data?.error || "Impossible d'envoyer le code";
  }
};

const resetPassword = async () => {
  notice.value = "";
  if (newPassword.value !== confirmPassword.value) {
    notice.value = "Les mots de passe ne correspondent pas.";
    return;
  }
  try {
    const payload = parseContact();
    payload.code = otp.value;
    payload.newPassword = newPassword.value;
    const { data } = await api.post("/auth/reset", payload);
    notice.value = data.message || "Mot de passe mis a jour";
    codeSent.value = false;
    otp.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur de reinitialisation";
  }
};
</script>
