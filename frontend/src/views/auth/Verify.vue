<template>
  <div class="auth-shell">
    <div class="auth-hero">
      <h1 class="brand-title luxe">NDOLOLY</h1>
      <p class="auth-subtitle">Verifiez votre compte pour activer votre profil.</p>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </div>

    <div class="card auth-card">
      <h2 class="auth-title">Verifiez votre compte</h2>
      <p class="auth-info">Un code OTP a ete envoye a votre email ou telephone.</p>

      <form @submit.prevent="verify">
        <div class="field">
          <label>Email ou numero de telephone</label>
          <input v-model="contact" placeholder="email ou +237..." />
        </div>
        <div class="field">
          <label>Code OTP</label>
          <input v-model="otp" placeholder="123456" />
        </div>
        <button class="button auth-button" type="submit">Verifier mon compte</button>
      </form>

      <div class="auth-foot">
        <span>Code non recu ?</span>
        <button class="link" type="button" @click="resend">Renvoyer le code</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import api from "../../api";

const emit = defineEmits(["verified"]);

const contact = ref("");
const otp = ref("");
const notice = ref("");

const loadFromLink = () => {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const linkedContact =
      params.get("contact") ||
      params.get("email") ||
      params.get("phone") ||
      "";
    const linkedCode = params.get("code") || "";

    if (linkedContact) {
      contact.value = linkedContact;
      localStorage.setItem(
        "ndololy_pending_contact",
        JSON.stringify(linkedContact.includes("@") ? { email: linkedContact } : { phone: linkedContact })
      );
    }
    if (linkedCode) {
      otp.value = linkedCode;
    }
  } catch {
    // ignore
  }
};

const parseContact = () => {
  const value = contact.value.trim();
  if (!value) return {};
  if (value.includes("@")) return { email: value };
  return { phone: value.replace(/[^\d+]/g, "") };
};

const loadSavedContact = () => {
  try {
    const raw = localStorage.getItem("ndololy_pending_contact");
    if (!raw) return;
    const data = JSON.parse(raw);
    contact.value = data.email || data.phone || "";
  } catch {
    contact.value = "";
  }
};

const verify = async () => {
  notice.value = "";
  try {
    const payload = parseContact();
    payload.code = otp.value;
    const { data } = await api.post("/auth/verify", payload);
    notice.value = data.message || "Compte verifie";
    localStorage.removeItem("ndololy_pending_contact");
    emit("verified");
  } catch (err) {
    notice.value = err.response?.data?.error || "Erreur de verification";
  }
};

const resend = async () => {
  notice.value = "";
  try {
    const payload = parseContact();
    const { data } = await api.post("/auth/resend-otp", payload);
    notice.value = data.message || "Code renvoye";
  } catch (err) {
    notice.value = err.response?.data?.error || "Impossible de renvoyer le code";
  }
};

onMounted(() => {
  loadSavedContact();
  loadFromLink();
});
</script>
