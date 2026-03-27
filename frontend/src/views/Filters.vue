<template>
  <div class="card">
    <div class="filters-page">
      <div>
        <h2>Filtre</h2>
        <p class="muted">Affinez les profils que vous souhaitez voir.</p>
      </div>
      <div class="filters-panel">
        <div class="grid two">
          <div class="field">
            <label>Age min</label>
            <input v-model.number="localFilters.age_min" type="number" min="18" />
          </div>
          <div class="field">
            <label>Age max</label>
            <input v-model.number="localFilters.age_max" type="number" min="18" />
          </div>
          <div class="field">
            <label>Ville</label>
            <input v-model="localFilters.city" placeholder="Ex: Douala" />
          </div>
          <div class="field">
            <label>Nombre d'enfants</label>
            <select v-model="localFilters.children">
              <option value="any">Tous</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3plus">3+</option>
            </select>
          </div>
          <div class="field">
            <label>Fumeur</label>
            <select v-model="localFilters.smoker">
              <option value="any">Indifferent</option>
              <option value="yes">Fumeur</option>
              <option value="no">Non fumeur</option>
            </select>
          </div>
          <div class="field">
            <label>Religion</label>
            <select v-model="localFilters.religion">
              <option value="any">Toutes</option>
              <option value="catholique">Catholique</option>
              <option value="protestant">Protestant</option>
              <option value="musulman">Musulman</option>
            </select>
          </div>
        </div>
        <div class="actions">
          <button class="button" @click="applyFilters">Appliquer</button>
          <button class="button ghost" @click="resetFilters">Reinitialiser</button>
          <button class="button secondary" @click="$emit('back')">Retour</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  filters: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["filters-change", "back"]);

const defaultFilters = {
  age_min: "",
  age_max: "",
  city: "",
  children: "any",
  smoker: "any",
  religion: "any"
};

const localFilters = ref({ ...defaultFilters, ...props.filters });

watch(
  () => props.filters,
  (value) => {
    localFilters.value = { ...defaultFilters, ...(value || {}) };
  },
  { deep: true }
);

const applyFilters = () => {
  emit("filters-change", { ...localFilters.value });
};

const resetFilters = () => {
  localFilters.value = { ...defaultFilters };
  emit("filters-change", { ...defaultFilters });
};
</script>
