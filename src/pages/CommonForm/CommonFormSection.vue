<template>
  <section v-if="(fields ?? []).length > 0">
    <div
      v-if="showTitle && title"
      class="arthivox-section-heading select-none"
      :class="collapsible ? 'cursor-pointer' : ''"
      @click="toggleCollapsed"
    >
      <div>
        <p class="text-xs uppercase tracking-wider text-teal-700 dark:text-teal-300 font-semibold">
          {{ t`Section` }}
        </p>
        <h2 class="text-base text-gray-900 dark:text-gray-100 font-semibold mt-1">
          {{ title }}
        </h2>
      </div>
      <feather-icon
        v-if="collapsible"
        :name="collapsed ? 'plus' : 'minus'"
        class="w-4 h-4 text-gray-500 dark:text-gray-400"
      />
    </div>

    <div v-if="!collapsed" class="arthivox-field-grid">
      <div
        v-for="field of fields"
        :key="field.fieldname"
        class="arthivox-field-cell"
        :class="[
          field.fieldtype === 'Table' ? 'col-span-2 arthivox-field-table' : '',
          field.fieldtype === 'AttachImage' ? 'row-span-2' : '',
          field.fieldtype === 'Check' ? 'self-end' : '',
          field.fieldname === 'termsAndConditions' ? 'col-span-2' : '',
          field.invisible ? 'invisible' : '',
        ]"
        :style="field.invisible ? 'visibility: hidden;' : ''"
      >
        <Table
          v-if="field.fieldtype === 'Table'"
          ref="fields"
          :show-label="true"
          :border="true"
          :df="field"
          :value="tableValue(doc[field.fieldname])"
          @editrow="(doc: Doc) => $emit('editrow', doc)"
          @change="(value: DocValue) => $emit('value-change', field, value)"
          @row-change="(field:Field, value:DocValue, parentfield:Field) => $emit('row-change',field, value, parentfield)"
        />
        <FormControl
          v-else
          :ref="field.fieldname === 'name' ? 'nameField' : 'fields'"
          :size="field.fieldtype === 'AttachImage' ? 'form' : undefined"
          :show-label="true"
          :border="true"
          :df="field"
          :value="doc[field.fieldname]"
          @editrow="(doc: Doc) => $emit('editrow', doc)"
          @change="(value: DocValue) => $emit('value-change', field, value)"
          @row-change="(field:Field, value:DocValue, parentfield:Field) => $emit('row-change',field, value, parentfield)"
        />
        <div v-if="errors?.[field.fieldname]" class="text-sm text-red-600 mt-2">
          {{ errors[field.fieldname] }}
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DocValue } from 'fyo/core/types';
import { Doc } from 'fyo/model/doc';
import { Field } from 'schemas/types';
import FormControl from 'src/components/Controls/FormControl.vue';
import Table from 'src/components/Controls/Table.vue';
import { focusOrSelectFormControl } from 'src/utils/ui';
import { defineComponent, PropType } from 'vue';

export default defineComponent({
  components: { FormControl, Table },
  props: {
    title: { type: String, default: '' },
    errors: {
      type: Object as PropType<Record<string, string>>,
      required: true,
    },
    showTitle: Boolean,
    doc: { type: Object as PropType<Doc>, required: true },
    collapsible: { type: Boolean, default: true },
    fields: { type: Array as PropType<Field[]>, required: true },
  },
  emits: ['editrow', 'value-change', 'row-change'],
  data() {
    return { collapsed: false } as { collapsed: boolean };
  },
  mounted() {
    focusOrSelectFormControl(this.doc, this.$refs.nameField);
  },
  methods: {
    tableValue(value: unknown): unknown[] {
      return Array.isArray(value) ? value : [];
    },
    toggleCollapsed() {
      if (!this.collapsible) {
        return;
      }
      this.collapsed = !this.collapsed;
    },
  },
});
</script>
