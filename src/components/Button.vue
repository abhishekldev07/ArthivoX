<template>
  <button
    class="rounded-lg flex justify-center items-center text-sm font-medium window-no-drag"
    :disabled="disabled"
    :class="_class"
    v-bind="$attrs"
  >
    <slot></slot>
  </button>
</template>
<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Button',
  props: {
    type: {
      type: String,
      default: 'secondary',
    },
    icon: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    padding: {
      type: Boolean,
      default: true,
    },
    background: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    _class() {
      return {
        'opacity-50 cursor-not-allowed pointer-events-none': this.disabled,
        'text-white bg-blue-700 hover:bg-blue-800 dark:bg-teal-600 dark:hover:bg-teal-500 shadow-button':
          this.type === 'primary' && this.background,
        'text-blue-800 dark:text-teal-300':
          this.type === 'primary' && !this.background,
        'text-gray-700 dark:text-gray-200': this.type !== 'primary',
        'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-850 dark:border-gray-700 dark:hover:bg-gray-800':
          this.type !== 'primary' && this.background,
        'h-9': this.background,
        'px-3': this.padding && this.icon,
        'px-5': this.padding && !this.icon,
      };
    },
  },
});
</script>
<style scoped>
button:focus {
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.16);
}
</style>
