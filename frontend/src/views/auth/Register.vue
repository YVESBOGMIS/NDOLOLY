<template>
  <div class="auth-shell">
    <div class="auth-hero">
      <h1 class="brand-title luxe">NDOLOLY</h1>
      <p class="auth-subtitle">Creez votre compte pour rencontrer des profils selectionnes.</p>
    </div>

    <div class="card auth-card">
      <h2 class="auth-title">Creer un compte</h2>
      <p v-if="notice" class="notice auth-notice">{{ notice }}</p>
      <form @submit.prevent="register">
        <div class="grid two">
          <div class="field">
            <label>Nom</label>
            <input v-model="lastName" :class="{ 'input-error': errors.lastName }" />
            <small v-if="errors.lastName" class="field-error">{{ errors.lastName }}</small>
          </div>
          <div class="field">
            <label>Prenom</label>
            <input v-model="firstName" />
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>Email</label>
            <input v-model="email" type="email" :class="{ 'input-error': errors.contact }" />
          </div>
          <div class="field">
            <label>Numero de telephone</label>
            <input v-model="phone" placeholder="+237..." :class="{ 'input-error': errors.contact }" />
            <small v-if="errors.contact" class="field-error">{{ errors.contact }}</small>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>Mot de passe</label>
            <PasswordInput
              v-model="password"
              autocomplete="new-password"
              :input-class="{ 'input-error': errors.password }"
            />
            <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
          </div>
          <div class="field">
            <label>Confirmer mot de passe</label>
            <PasswordInput
              v-model="confirmPassword"
              autocomplete="new-password"
              :input-class="{ 'input-error': errors.confirmPassword }"
            />
            <small v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</small>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label>Date de naissance</label>
            <input v-model="birthdate" type="date" :class="{ 'input-error': errors.birthdate }" />
            <small v-if="errors.birthdate" class="field-error">{{ errors.birthdate }}</small>
          </div>
          <div class="field">
            <label>Sexe</label>
            <select v-model="gender">
              <option value="male">Homme</option>
              <option value="female">Femme</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Ville</label>
          <input v-model="location" :class="{ 'input-error': errors.location }" />
          <small v-if="errors.location" class="field-error">{{ errors.location }}</small>
        </div>

        <button class="button auth-button" type="submit">Creer mon compte</button>
      </form>

      <div class="auth-foot">
        <span>Deja un compte ?</span>
        <button class="link" type="button" @click="$emit('go-login')">Connexion</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import api from "../../api";
import PasswordInput from "../../components/PasswordInput.vue";

const emit = defineEmits(["registered", "go-login"]);

const lastName = ref("");
const firstName = ref("");
const email = ref("");
const phone = ref("");
const password = ref("");
const confirmPassword = ref("");
const birthdate = ref("");
const gender = ref("male");
const location = ref("");
const notice = ref("");
const errors = ref({});

const validate = () => {
  const nextErrors = {};
  if (!lastName.value.trim()) nextErrors.lastName = "Champ obligatoire.";
  if (!email.value.trim() && !phone.value.trim()) {
    nextErrors.contact = "Email ou telephone obligatoire.";
  }
  if (!password.value) {
    nextErrors.password = "Mot de passe obligatoire.";
  } else if (password.value.length < 6) {
    nextErrors.password = "Mot de passe trop court.";
  }
  if (!confirmPassword.value) {
    nextErrors.confirmPassword = "Confirmation obligatoire.";
  } else if (password.value !== confirmPassword.value) {
    nextErrors.confirmPassword = "Les mots de passe ne correspondent pas.";
  }
  if (!birthdate.value) nextErrors.birthdate = "Date de naissance obligatoire.";
  if (!location.value.trim()) nextErrors.location = "Ville obligatoire.";
  return nextErrors;
};

const register = async () => {
  notice.value = "";
  errors.value = validate();
  if (Object.keys(errors.value).length > 0) {
    notice.value = "Veuillez corriger les champs manquants.";
    return;
  }

  try {
    const payload = {
      email: email.value.trim().toLowerCase() || undefined,
      phone: phone.value.trim().replace(/[^\d+]/g, "") || undefined,
      password: password.value,
      name: `${firstName.value.trim()} ${lastName.value.trim()}`.trim(),
      birthdate: birthdate.value,
      gender: gender.value,
      location: location.value
    };
    const { data } = await api.post("/auth/register", payload);
    notice.value = data.message || "Compte cree.";
    emit("registered", { email: payload.email, phone: payload.phone });
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur d'inscription";
  }
};
</script>
