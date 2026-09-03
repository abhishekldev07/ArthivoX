<template>
  <div class="arthivox-form-header flex justify-between items-center flex-shrink-0">
    <div class="min-w-0">
      <p v-if="formSubTitle" class="text-xs uppercase tracking-wider text-teal-700 dark:text-teal-300 font-semibold mb-1">
        {{ formSubTitle }}
      </p>
      <h1 v-if="formTitle" class="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 truncate">
        {{ formTitle }}
      </h1>
    </div>
    <slot />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    formTitle: { type: String, default: '' },
    formSubTitle: { type: String, default: '' },
  },
});
</script>
