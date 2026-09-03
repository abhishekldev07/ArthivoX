<template>
  <header
    class="arthivox-page-header flex-shrink-0"
    :class="[
      border ? 'border-b dark:border-gray-800' : '',
      platform !== 'Windows' ? 'window-drag' : '',
    ]"
  >
    <div class="flex items-center px-5 pt-3 pb-1">
      <Transition name="spacer">
        <div
          v-if="!showSidebar && platform === 'Mac' && languageDirection !== 'rtl'"
          class="h-full"
          :class="spacerClass"
        />
      </Transition>

      <div class="window-no-drag flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span class="font-semibold text-teal-700 dark:text-teal-300">ArthivoX</span>
        <feather-icon name="chevron-right" class="w-3 h-3 opacity-50" />
        <span>{{ t`Workspace` }}</span>
      </div>
    </div>

    <div class="flex items-end px-5 pb-3 min-h-12">
      <div
        class="flex items-end gap-4 window-no-drag me-auto min-w-0"
        :class="platform === 'Mac' && languageDirection === 'rtl' ? 'me-18' : ''"
      >
        <div class="arthivox-nav-cluster flex-shrink-0">
          <PageHeaderNavGroup />
        </div>

        <div v-if="title" class="min-w-0">
          <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white truncate">
            {{ title }}
          </h1>
        </div>

        <div class="flex items-stretch gap-3 mb-0.5">
          <slot name="left" />
        </div>
      </div>

      <div
        class="arthivox-action-tray window-no-drag flex items-center gap-2 ms-auto"
        :class="platform === 'Mac' && languageDirection === 'rtl' ? 'me-18' : ''"
      >
        <slot />
      </div>
    </div>
  </header>
</template>

<script lang="ts">
import { languageDirectionKey } from 'src/utils/injectionKeys';
import { showSidebar } from 'src/utils/refs';
import { defineComponent, inject, Transition } from 'vue';
import PageHeaderNavGroup from './PageHeaderNavGroup.vue';

export default defineComponent({
  components: { Transition, PageHeaderNavGroup },
  props: {
    title: { type: String, default: '' },
    border: { type: Boolean, default: true },
    searchborder: { type: Boolean, default: true },
  },
  setup() {
    return { showSidebar, languageDirection: inject(languageDirectionKey) };
  },
  computed: {
    showBorder() {
      return !!this.$slots.default && this.searchborder;
    },
    spacerClass() {
      if (this.showSidebar) {
        return '';
      }
      return this.border ? 'w-tl me-4 border-e' : 'w-tl me-4';
    },
  },
});
</script>

<style scoped>
.w-tl {
  width: var(--w-trafficlights);
}

.spacer-enter-from,
.spacer-leave-to {
  opacity: 0;
  width: 0;
  margin-right: 0;
  border-right-width: 0;
}

.spacer-enter-to,
.spacer-leave-from {
  opacity: 1;
  width: var(--w-trafficlights);
  margin-right: 1rem;
  border-right-width: 1px;
}

.spacer-enter-active,
.spacer-leave-active {
  transition: all 150ms ease-out;
}
</style>
