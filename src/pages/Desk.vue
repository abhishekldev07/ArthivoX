<script setup lang="ts">
import { showSidebar } from 'src/utils/refs';
import { toggleSidebar } from 'src/utils/ui';
</script>

<template>
  <div class="arthivox-desk-root flex overflow-hidden">
    <Transition name="sidebar">
      <Sidebar
        v-show="showSidebar"
        class="flex-shrink-0 whitespace-nowrap w-sidebar"
        :dark-mode="darkMode"
        @change-db-file="$emit('change-db-file')"
        @cloud-home="$emit('cloud-home')"
      />
    </Transition>

    <section class="arthivox-main-shell flex flex-1 flex-col min-w-0 overflow-hidden">
      <div class="arthivox-command-strip flex items-center px-5 flex-shrink-0">
        <button
          v-show="!showSidebar"
          class="arthivox-command-icon rtl-rotate-180"
          :title="t`Open navigation`"
          @click="() => toggleSidebar()"
        >
          <feather-icon name="menu" class="w-4 h-4" />
        </button>
        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span class="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{{ t`Local workspace ready` }}</span>
        </div>
        <div class="ms-auto flex items-center gap-2 text-xs text-slate-400">
          <span>{{ t`ArthivoX Finance Workspace` }}</span>
        </div>
      </div>

      <div class="flex flex-1 overflow-y-hidden custom-scroll custom-scroll-thumb1 arthivox-main-canvas">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component
              :is="Component"
              :key="$route.path"
              :dark-mode="darkMode"
              class="flex-1 min-w-0"
            />
          </keep-alive>
        </router-view>

        <router-view v-slot="{ Component, route }" name="edit">
          <Transition name="quickedit">
            <div v-if="route?.query?.edit">
              <component
                :is="Component"
                :key="route.query.schemaName + route.query.name"
                :dark-mode="darkMode"
              />
            </div>
          </Transition>
        </router-view>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Sidebar from '../components/Sidebar.vue';

export default defineComponent({
  name: 'Desk',
  components: { Sidebar },
  props: {
    darkMode: { type: Boolean, default: false },
  },
  emits: ['change-db-file', 'cloud-home'],
});
</script>

<style scoped>
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
  transform: translateX(calc(-1 * var(--w-sidebar)));
  width: 0;
}

[dir='rtl'] .sidebar-leave-to {
  opacity: 0;
  transform: translateX(calc(1 * var(--w-sidebar)));
  width: 0;
}

.sidebar-enter-to,
.sidebar-leave-from {
  opacity: 1;
  transform: translateX(0);
  width: var(--w-sidebar);
}

.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 170ms ease-out;
}
</style>
