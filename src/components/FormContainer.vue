<template>
  <div class="arthivox-form-workspace flex overflow-x-auto custom-scroll custom-scroll-thumb1">
    <div class="flex flex-1 flex-col min-w-0">
      <PageHeader
        v-if="showHeader"
        :title="title"
        :border="false"
        :searchborder="searchborder"
      >
        <template #left>
          <slot name="header-left" />
        </template>
        <slot name="header" />
      </PageHeader>

      <div class="arthivox-form-stage flex-1 min-h-0">
        <div
          class="flex flex-col h-full overflow-auto dark:bg-gray-890"
          :class="
            useFullWidth
              ? 'w-full'
              : 'arthivox-form-surface w-form mx-auto'
          "
        >
          <slot name="body" />
        </div>
      </div>
    </div>

    <slot name="quickedit" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import PageHeader from './PageHeader.vue';

export default defineComponent({
  components: { PageHeader },
  props: {
    title: { type: String, default: '' },
    useFullWidth: { type: Boolean, default: false },
    showHeader: { type: Boolean, default: true },
    searchborder: { type: Boolean, default: true },
  },
});
</script>
