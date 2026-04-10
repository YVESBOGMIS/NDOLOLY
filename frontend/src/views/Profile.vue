<template>
  <div class="card">
    <h2>Mon profil</h2>
    <div class="actions" style="margin-bottom: 12px;">
      <button class="button ghost" @click="$emit('back')">Retour</button>
      <button class="button ghost" type="button" @click="$emit('preview')">Apercu</button>
      <button class="button secondary" type="button" @click="$emit('logout')">Se deconnecter</button>
    </div>

    <div v-if="!form.verified_photo" :class="['verification-card', { rejected: verification?.status === 'rejected' }]">
      <div class="verification-text">
        <strong>Verification photo</strong>
        <span :class="['pill', verificationPillClass]">{{ verificationLabel }}</span>
        <p class="verification-note">{{ verificationNote }}</p>
      </div>
      <div class="verification-actions">
        <button
          v-if="!form.verified_photo"
          class="button secondary"
          :disabled="verificationSubmitting || verificationPending"
          @click="openVerificationPicker"
        >
          {{ verificationPending ? "En attente admin" : verificationSubmitting ? "Envoi..." : verificationActionLabel }}
        </button>
      </div>
    </div>

    <p v-if="form.reverification_required" class="notice" style="margin-bottom: 12px;">
      Votre compte est bloque jusqu'a l'envoi d'une nouvelle verification photo.
    </p>

    <template v-if="!form.reverification_required">
    <div class="verification-card" style="margin-bottom: 12px;">
      <div class="verification-text">
        <strong>Mode incognito</strong>
        <span :class="['pill', form.incognito_mode ? 'success' : '']">
          {{ form.incognito_mode ? "Actif" : "Inactif" }}
        </span>
        <p class="verification-note">
          {{ form.premium
            ? "Quand le mode incognito est actif, vos visites de profil ne sont pas enregistrees."
            : "Le mode incognito est reserve aux profils premium." }}
        </p>
      </div>
      <div class="verification-actions">
        <button
          class="button secondary"
          :disabled="!form.premium"
          @click="form.incognito_mode = !form.incognito_mode"
        >
          {{ form.incognito_mode ? "Desactiver l'incognito" : "Activer l'incognito" }}
        </button>
      </div>
    </div>

    <div class="grid two">
      <div class="field">
        <label>Nom</label>
        <input v-model="form.name" />
      </div>
      <div class="field">
        <label>Naissance</label>
        <input v-model="form.birthdate" type="date" />
      </div>
      <div class="field">
        <label>Sexe</label>
        <select v-model="form.gender">
          <option value="male">Homme</option>
          <option value="female">Femme</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div class="field">
        <label>Ville</label>
        <input v-model="form.location" />
      </div>
    </div>
    <div class="grid two">
      <div class="field">
        <label>Nombre d'enfants</label>
        <input v-model.number="form.children_count" type="number" min="0" />
      </div>
      <div class="field">
        <label>Fumeur</label>
        <select v-model="form.smoker">
          <option :value="null">Non renseigne</option>
          <option :value="true">Fumeur</option>
          <option :value="false">Non fumeur</option>
        </select>
      </div>
      <div class="field">
        <label>Religion</label>
        <select v-model="form.religion">
          <option value="">Non renseignee</option>
          <option value="catholique">Catholique</option>
          <option value="protestant">Protestant</option>
          <option value="musulman">Musulman</option>
        </select>
      </div>
    </div>
    <div class="grid two">
      <div class="field">
        <label>Profession</label>
        <input v-model="form.profession" />
      </div>
      <div class="field">
        <label>Niveau d'etudes</label>
        <input v-model="form.education_level" />
      </div>
      <div class="field">
        <label>Taille (cm)</label>
        <input v-model.number="form.height_cm" type="number" min="0" />
      </div>
      <div class="field">
        <label>Situation familiale</label>
        <input v-model="form.family_status" />
      </div>
    </div>
    <div class="grid two">
      <div class="field">
        <label>Langues parlees (separees par des virgules)</label>
        <input v-model="languages" />
      </div>
      <div class="field">
        <label>Recherche</label>
        <input v-model="form.looking_for" placeholder="Relation serieuse, amitie, mariage..." />
      </div>
    </div>
    <div class="field">
      <label>Centres d'interet (separes par des virgules)</label>
      <input v-model="interests" />
    </div>
    <div class="field">
      <label>Description</label>
      <textarea v-model="form.bio"></textarea>
    </div>

    <div class="grid two">
      <div class="field">
        <label>Age min</label>
        <input v-model.number="form.pref_age_min" type="number" />
      </div>
      <div class="field">
        <label>Age max</label>
        <input v-model.number="form.pref_age_max" type="number" />
      </div>
      <div class="field">
        <label>Distance km</label>
        <input v-model.number="form.pref_distance_km" type="number" />
      </div>
      <div class="field">
        <label>Genre recherche</label>
        <select v-model="form.pref_gender">
          <option value="any">Indifferent</option>
          <option value="male">Homme</option>
          <option value="female">Femme</option>
          <option value="other">Autre</option>
        </select>
      </div>
    </div>

    <div class="actions">
      <button class="button" :disabled="saving" @click="save">
        {{ saving ? "Sauvegarde..." : "Sauvegarder" }}
      </button>
      <button class="button secondary" @click="uploadPhoto">Ajouter une photo</button>
    </div>
    <div class="actions">
      <button class="button danger" :disabled="deleting" @click="deleteAccount">
        {{ deleting ? "Suppression..." : "Supprimer mon compte" }}
      </button>
    </div>
    <div v-if="saveStatus" class="muted" style="margin-top: 8px;">{{ saveStatus }}</div>
    </template>

    <div v-else-if="saveStatus" class="muted" style="margin-top: 8px;">{{ saveStatus }}</div>

    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="handleFile" />
    <input ref="replaceInput" type="file" accept="image/*" style="display:none" @change="handleReplaceFile" />
    <input
      ref="verificationInput"
      type="file"
      accept="image/*"
      style="display:none"
      @change="handleVerificationFile"
    />

    <div v-if="!form.reverification_required" class="photo-list" style="margin-top: 12px;">
      <div v-for="(photo, index) in form.photos" :key="photo + index" class="photo-item">
        <button class="photo-preview-trigger" type="button" @click="openPhotoPreview(photo)" aria-label="Agrandir la photo">
          <img :src="resolvePhotoSrc(photo)" alt="photo" @error="handleImgError(photo)" />
        </button>
        <div class="photo-actions">
          <button class="button tiny secondary" @click="startReplace(photo)">Modifier</button>
          <button class="button tiny danger" @click="deletePhoto(photo)">Supprimer</button>
        </div>
      </div>
    </div>

    <div v-if="photoPreviewSrc" class="modal photo-preview-wrap" @click.self="closePhotoPreview">
      <div class="photo-preview-modal fullscreen">
        <button class="photo-preview-close" type="button" @click="closePhotoPreview" aria-label="Fermer">×</button>
        <img class="photo-preview-image fullscreen" :src="photoPreviewSrc" alt="photo" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import api from "../api";
import { resolvePhoto } from "../utils";

const props = defineProps({
  profile: { type: Object, default: null }
});

const emit = defineEmits(["updated", "back", "deleted", "logout", "preview"]);

const form = ref({
  name: "",
  birthdate: "",
  gender: "male",
  location: "",
  children_count: null,
  smoker: null,
  religion: "",
  profession: "",
  education_level: "",
  height_cm: null,
  family_status: "",
  languages: [],
  looking_for: "",
  interests: [],
  bio: "",
  pref_age_min: 18,
  pref_age_max: 99,
  pref_distance_km: 50,
  pref_gender: "any",
  photos: [],
  premium: false,
  incognito_mode: false,
  verified_photo: false,
  photo_verification: null
});

const interests = ref("");
const languages = ref("");
const fileInput = ref(null);
const replaceInput = ref(null);
const verificationInput = ref(null);
const replaceTarget = ref(null);
const photoBust = ref({});
const photoPreviewSrc = ref("");
const saving = ref(false);
const saveStatus = ref("");
const deleting = ref(false);
const verificationSubmitting = ref(false);

watch(
  () => props.profile,
  (value) => {
    if (!value) return;
    form.value = { ...form.value, ...value };
    interests.value = (value.interests || []).join(", ");
    languages.value = (value.languages || []).join(", ");
    if (value.photo_verification?.status === "rejected") {
      saveStatus.value = value.photo_verification?.note
        ? `Verification rejetee : ${value.photo_verification.note}. Recommencez avec une nouvelle photo.`
        : "Verification rejetee. Recommencez avec une nouvelle photo.";
    }
  },
  { immediate: true }
);

const verification = computed(() => form.value.photo_verification || null);
const verificationPending = computed(() => verification.value?.status === "pending");
const verificationLabel = computed(() => {
  if (form.value.verified_photo) return "Photo validee";
  if (!verification.value) return "Aucune demande";
  if (verification.value.status === "pending") return "En attente";
  if (verification.value.status === "rejected") return "Rejetee";
  if (verification.value.status === "approved") return "Approuvee";
  return verification.value.status;
});
const verificationPillClass = computed(() => {
  if (form.value.verified_photo) return "success";
  if (verification.value?.status === "pending") return "warn";
  if (verification.value?.status === "rejected") return "warn";
  return "";
});
const verificationActionLabel = computed(() => (
  verification.value?.status === "rejected"
    ? "Recommencer la verification"
    : "Envoyer ma photo de verification"
));
const verificationNote = computed(() => {
  if (form.value.verified_photo) {
    return "Votre photo de verification a ete validee par l'administration. Vous pouvez maintenant liker, super liker et passer.";
  }
  if (verification.value?.status === "pending") {
    return "Votre preuve est en cours de revue. Tant que l'admin n'a pas approuve la photo, vous ne pouvez pas liker, super liker ni passer.";
  }
  if (verification.value?.status === "rejected") {
    return verification.value.note
      ? `Demande rejetee : ${verification.value.note}`
      : "Votre demande a ete rejetee. Envoyez une nouvelle photo nette de votre visage.";
  }
  return "Envoyez une photo de verification distincte de votre galerie publique. Tant que cette verification n'est pas approuvee, vous ne pouvez pas liker, super liker ni passer.";
});

const save = async () => {
  if (saving.value) return;
  saveStatus.value = "";
  saving.value = true;
  try {
    const payload = { ...form.value };
    payload.interests = interests.value.split(",").map((i) => i.trim()).filter(Boolean);
    payload.languages = languages.value.split(",").map((i) => i.trim()).filter(Boolean);
    payload.incognito_mode = !!form.value.incognito_mode;
    await api.put("/profile/me", payload);
    saveStatus.value = "Profil mis a jour.";
    emit("updated");
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      "Echec de la sauvegarde.";
    saveStatus.value = message;
  } finally {
    saving.value = false;
  }
};

const uploadPhoto = () => {
  fileInput.value?.click();
};

const openVerificationPicker = () => {
  if (verificationPending.value || verificationSubmitting.value) return;
  verificationInput.value?.click();
};

const handleFile = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("photo", file);
  const { data } = await api.post("/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  if (data?.photo) {
    form.value.photos = [...(form.value.photos || []), data.photo];
  }
  emit("updated");
  event.target.value = "";
};

const startReplace = (photo) => {
  replaceTarget.value = photo;
  replaceInput.value?.click();
};

const handleReplaceFile = async (event) => {
  const file = event.target.files[0];
  if (!file || !replaceTarget.value) {
    event.target.value = "";
    return;
  }
  const formData = new FormData();
  formData.append("photo", file);
  formData.append("oldPhoto", replaceTarget.value);
  const { data } = await api.put("/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  if (data?.photo) {
    const idx = (form.value.photos || []).indexOf(replaceTarget.value);
    if (idx >= 0) {
      const next = [...form.value.photos];
      next[idx] = data.photo;
      form.value.photos = next;
    }
  }
  replaceTarget.value = null;
  emit("updated");
  event.target.value = "";
};

const deletePhoto = async (photo) => {
  if (!photo) return;
  await api.delete("/profile/photo", { data: { photo } });
  form.value.photos = (form.value.photos || []).filter((p) => p !== photo);
  emit("updated");
};

const handleVerificationFile = async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  verificationSubmitting.value = true;
  saveStatus.value = "";
  try {
    const formData = new FormData();
    formData.append("photo", file);
    const { data } = await api.post("/profile/verify-request", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    form.value.photo_verification = data?.verification || null;
    form.value.verified_photo = false;
    saveStatus.value = data?.message || "Verification envoyee a l'admin.";
    emit("updated");
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      "Echec de l'envoi de la verification.";
    saveStatus.value = message;
  } finally {
    verificationSubmitting.value = false;
  }
};

const resolvePhotoSrc = (photo) => {
  const base = resolvePhoto(photo);
  const bust = photoBust.value[photo];
  if (!bust) return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}t=${bust}`;
};

const handleImgError = (photo) => {
  if (!photo) return;
  photoBust.value = { ...photoBust.value, [photo]: Date.now() };
};

const openPhotoPreview = (photo) => {
  photoPreviewSrc.value = resolvePhotoSrc(photo);
};

const closePhotoPreview = () => {
  photoPreviewSrc.value = "";
};

const deleteAccount = async () => {
  if (deleting.value) return;
  const confirmed = window.confirm("Voulez-vous vraiment supprimer votre compte ? Cette action est definitive.");
  if (!confirmed) return;
  deleting.value = true;
  try {
    await api.delete("/profile/me");
    emit("deleted");
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      "Echec de la suppression du compte.";
    saveStatus.value = message;
  } finally {
    deleting.value = false;
  }
};
</script>
