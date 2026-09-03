<template>
  <FormContainer
    :show-header="false"
    class="justify-content items-center h-full"
    :class="{ 'window-drag': platform !== 'Windows' }"
  >
    <template #body>
      <div class="px-5 pt-5 pb-2 flex items-center gap-3 window-no-drag">
        <div class="w-11 h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 flex-center shadow-sm">
          <img
            :src="arthivoxSymbol"
            alt="ArthivoX"
            class="w-9 h-9 object-contain"
          />
        </div>
        <div>
          <p class="arthivox-kicker">New workspace</p>
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            ArthivoX Setup
          </h1>
        </div>
      </div>

      <FormHeader
        :form-title="t`Set up your organization`"
        class="sticky top-0 bg-white dark:bg-gray-890 border-b dark:border-gray-800"
      >
      </FormHeader>

      <div
        v-if="hasDoc"
        class="overflow-auto custom-scroll custom-scroll-thumb1"
      >
        <CommonFormSection
          v-for="([name, fields], idx) in activeGroup.entries()"
          :key="name + idx"
          ref="section"
          class="p-5"
          :class="
            idx !== 0 && activeGroup.size > 1
              ? 'border-t dark:border-gray-800'
              : ''
          "
          :show-title="activeGroup.size > 1 && name !== t`Default`"
          :title="name"
          :fields="fields"
          :doc="doc"
          :errors="errors"
          :collapsible="false"
          @value-change="onValueChange"
        />
      </div>

      <div
        class="mt-auto p-5 flex items-center justify-between border-t dark:border-gray-800 flex-shrink-0 sticky bottom-0 bg-white dark:bg-gray-890"
      >
        <p v-if="loading" class="text-base text-gray-600 dark:text-gray-400">
          {{ t`Preparing your ArthivoX workspace...` }}
        </p>
        <Button
          v-if="!loading"
          class="w-24"
          @click="cancel"
          >{{ t`Cancel` }}</Button
        >
        <Button
          type="primary"
          class="w-28"
          data-testid="submit-button"
          :disabled="!areAllValuesFilled || loading"
          @click="submit"
          >{{ t`Create` }}</Button
        >
      </div>
    </template>
  </FormContainer>
</template>
<script lang="ts">
import { ARTHIVOX_SYMBOL_DATA_URL } from 'src/assets/brand/embeddedBrand';
import { DocValue } from 'fyo/core/types';
import { Doc } from 'fyo/model/doc';
import { TranslationString } from 'fyo/utils/translation';
import { Field } from 'schemas/types';
import Button from 'src/components/Button.vue';
import FormContainer from 'src/components/FormContainer.vue';
import FormHeader from 'src/components/FormHeader.vue';
import { getErrorMessage } from 'src/utils';
import { showDialog } from 'src/utils/interactive';
import { getSetupWizardDoc } from 'src/utils/misc';
import { getFieldsGroupedByTabAndSection } from 'src/utils/ui';
import { computed, defineComponent } from 'vue';
import CommonFormSection from '../CommonForm/CommonFormSection.vue';

export default defineComponent({
  name: 'SetupWizard',
  components: {
    Button,
    FormContainer,
    FormHeader,
    CommonFormSection,
  },
  provide() {
    return {
      doc: computed(() => this.docOrNull),
    };
  },
  emits: ['setup-complete', 'setup-canceled'],
  data() {
    return {
      arthivoxSymbol: ARTHIVOX_SYMBOL_DATA_URL,
      docOrNull: null,
      errors: {},
      loading: false,
    } as {
      arthivoxSymbol: string;
      errors: Record<string, string>;
      docOrNull: null | Doc;
      loading: boolean;
    };
  },
  computed: {
    hasDoc(): boolean {
      return this.docOrNull instanceof Doc;
    },
    doc(): Doc {
      if (this.docOrNull instanceof Doc) {
        return this.docOrNull;
      }

      throw new Error(`Doc is null`);
    },
    areAllValuesFilled(): boolean {
      if (!this.hasDoc) {
        return false;
      }

      const values = this.doc.schema.fields
        .filter((f) => f.required)
        .map((f) => this.doc[f.fieldname]);

      return values.every(Boolean);
    },
    activeGroup(): Map<string, Field[]> {
      if (!this.hasDoc) {
        return new Map();
      }

      const groupedFields = getFieldsGroupedByTabAndSection(
        this.doc.schema,
        this.doc
      );

      return [...groupedFields.values()][0];
    },
  },
  async mounted() {
    const languageMap = TranslationString.prototype.languageMap;
    this.docOrNull = getSetupWizardDoc(languageMap);
    if (!this.fyo.db.isConnected) {
      await this.fyo.db.init();
    }
  },
  methods: {
    async onValueChange(field: Field, value: DocValue) {
      if (!this.hasDoc) {
        return;
      }

      const { fieldname } = field;
      delete this.errors[fieldname];

      try {
        await this.doc.set(fieldname, value);
      } catch (err) {
        if (!(err instanceof Error)) {
          return;
        }

        this.errors[fieldname] = getErrorMessage(err, this.doc);
      }
    },
    async submit() {
      if (!this.hasDoc) {
        return;
      }

      if (!this.areAllValuesFilled) {
        return await showDialog({
          title: this.t`Mandatory Error`,
          detail: this.t`Please fill all values.`,
          type: 'error',
        });
      }

      this.loading = true;
      this.$emit('setup-complete', this.doc.getValidDict());
    },
    cancel() {
      this.$emit('setup-canceled');
    },
  },
});
</script>
