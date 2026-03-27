<template>
  <div class="auth-shell">
    <div class="auth-hero">
      <h1 class="brand-title luxe">NDOLOLY</h1>
      <p class="auth-subtitle">Rencontrez des personnes compatibles, simplement et en toute securite.</p>
    </div>

    <div class="card auth-card">
      <h2 class="auth-title">Connexion</h2>
      <p v-if="notice" class="notice auth-notice">{{ notice }}</p>
      <form @submit.prevent="login">
        <div class="field">
          <label>Email ou numero de telephone</label>
          <input v-model="contact" placeholder="email ou +237..." />
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <input v-model="password" type="password" />
        </div>
        <div class="auth-row">
          <button class="link" type="button" @click="$emit('go-reset')">Mot de passe oublie ?</button>
        </div>
        <button class="button auth-button" type="submit">Se connecter</button>
      </form>

      <div class="auth-foot">
        <span>Vous n'avez pas de compte ?</span>
        <button class="link" type="button" @click="$emit('go-register')">S'inscrire</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import api, { setToken } from "../../api";

const emit = defineEmits(["authenticated", "go-register", "go-reset"]);

const contact = ref("");
const password = ref("");
const notice = ref("");

const parseContact = () => {
  const value = contact.value.trim();
  if (!value) return {};
  if (value.includes("@")) return { email: value };
  return { phone: value.replace(/[^\d+]/g, "") };
};

const login = async () => {
  notice.value = "";
  try {
    const payload = parseContact();
    if (!payload.email && !payload.phone) {
      notice.value = "Veuillez saisir votre email ou telephone.";
      return;
    }
    if (!password.value) {
      notice.value = "Veuillez saisir votre mot de passe.";
      return;
    }
    payload.password = password.value;
    const { data } = await api.post("/auth/login", payload);
    setToken(data.token);
    emit("authenticated", data.token);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      notice.value = "Compte non verifie. Veuillez verifier votre compte.";
      return;
    }
    if (status) {
      notice.value = "Identifiants incorrects. Veuillez mettre les bons identifiants.";
      return;
    }
    notice.value = "Impossible de se connecter. Verifiez votre connexion.";
  }
};
</script>
