<template>
  <div class="auth-shell admin-auth-shell">
    <div class="auth-hero">
      <span class="badge">Backoffice</span>
      <h1 class="brand-title luxe">NDOLOLY Admin</h1>
      <p class="auth-subtitle">Pilotez les utilisateurs, la moderation et les validations depuis une interface dediee.</p>
    </div>

    <div class="card auth-card">
      <h2 class="auth-title">Connexion administrateur</h2>
      <p v-if="notice" class="notice auth-notice">{{ notice }}</p>
      <form @submit.prevent="login">
        <div class="field">
          <label>Email admin</label>
          <input v-model="email" type="email" placeholder="admin@ndololy.com" />
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <PasswordInput v-model="password" autocomplete="current-password" />
        </div>
        <button class="button auth-button" type="submit">Entrer dans le dashboard</button>
      </form>

      <div class="auth-foot">
        <span>Retour a l'application ?</span>
        <button class="link" type="button" @click="$emit('go-user-app')">Interface utilisateur</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import adminApi, { setAdminToken } from "../../adminApi";
import PasswordInput from "../../components/PasswordInput.vue";

const emit = defineEmits(["authenticated", "go-user-app"]);

const email = ref("");
const password = ref("");
const notice = ref("");

const login = async () => {
  notice.value = "";
  if (!email.value.trim() || !password.value) {
    notice.value = "Saisissez un email admin et un mot de passe.";
    return;
  }

  try {
    const { data } = await adminApi.post("/auth/admin/login", {
      email: email.value.trim(),
      password: password.value
    });
    setAdminToken(data.token);
    emit("authenticated", data.admin);
  } catch (err) {
    notice.value = err.response?.data?.error || "Connexion admin impossible.";
  }
};
</script>
