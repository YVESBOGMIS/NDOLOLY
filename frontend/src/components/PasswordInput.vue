<template>
  <div class="password-input">
    <input
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      v-bind="inputAttrs"
      :class="inputClass"
      @input="onInput"
    />
    <button
      class="password-toggle"
      type="button"
      :aria-label="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
      @click="visible = !visible"
    >
      <svg v-if="!visible" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M2.5 12S6.5 5 12 5s9.5 7 9.5 7-4 7-9.5 7-9.5-7-9.5-7Z"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 4l18 18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M10.4 10.4A3 3 0 0 0 12 15a3 3 0 0 0 2.6-4.6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M6.4 6.6C4.2 8.4 2.5 12 2.5 12S6.5 19 12 19c2 0 3.8-.5 5.3-1.3"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M9.3 5.4C10.1 5.1 11 5 12 5c5.5 0 9.5 7 9.5 7s-1.4 2.4-3.7 4.3"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed, ref, useAttrs } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  inputClass: { type: [String, Array, Object], default: "" }
});

const emit = defineEmits(["update:modelValue"]);
const attrs = useAttrs();
const visible = ref(false);

const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});

const onInput = (event) => {
  emit("update:modelValue", event?.target?.value ?? "");
};
</script>

