<template>
  <div v-if="open && !close">
    <div v-if="fullWidth" class="arthivox-busy-overlay window-no-drag">
      <div class="arthivox-busy-content">
        <span class="arthivox-spinner" aria-label="Loading"></span>
      </div>
    </div>

    <div v-else class="arthivox-inline-loader">
      <div class="arthivox-inline-loader-card">
        <span class="arthivox-spinner arthivox-spinner-small"></span>
        <p v-if="message?.length" class="text-sm text-gray-600 dark:text-gray-300">
          {{ message }}
        </p>
        <feather-icon
          v-if="showX"
          name="x"
          class="w-4 h-4 ms-auto text-gray-500 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200"
          @click="closeToast"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    open: { type: Boolean, default: false },
    percent: { type: Number, default: -1 },
    message: { type: String, default: '' },
    fullWidth: { type: Boolean, default: false },
    showX: { type: Boolean, default: true },
  },
  data() {
    return { close: false };
  },
  methods: {
    closeToast() {
      this.close = true;
    },
  },
};
</script>
