<template>
  <FormContainer :use-full-width="true" :show-header="false">
    <template #body>
      <div v-if="hasDoc" class="arthivox-document-shell">
        <aside class="arthivox-document-sidebar">
          <div class="arthivox-document-identity">
            <p class="arthivox-kicker">{{ displaySchemaLabel }}</p>
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white mt-1 break-words">
              {{ title }}
            </h1>
            <div class="mt-3">
              <StatusPill :doc="doc" />
            </div>
          </div>

          <div v-if="groupedFields && groupedFields.size > 1" class="arthivox-document-tabs">
            <p class="arthivox-context-label text-gray-400">{{ t`Sections` }}</p>
            <button
              v-for="key of groupedFields.keys()"
              :key="key"
              class="arthivox-document-tab"
              :class="{ active: key === activeTab }"
              @click="activeTab = key"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              <span class="truncate">{{ key === t`Default` ? t`Details` : key }}</span>
            </button>
          </div>

          <div class="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              class="arthivox-document-side-action"
              :title="t`Toggle workspace width`"
              @click="toggleWidth"
            >
              <feather-icon :name="useFullWidth ? 'minimize' : 'maximize'" class="w-4 h-4" />
              <span>{{ useFullWidth ? t`Focused width` : t`Wide canvas` }}</span>
            </button>
            <button
              v-if="canShowLinks"
              class="arthivox-document-side-action"
              @click="showLinks = true"
            >
              <feather-icon name="link" class="w-4 h-4" />
              <span>{{ t`Related records` }}</span>
            </button>
          </div>
        </aside>

        <main class="arthivox-document-main">
          <div class="arthivox-document-toolbar">
            <div class="flex items-center gap-2 min-w-0">
              <Barcode
                v-if="canShowBarcode"
                class="h-8"
                @item-selected="(name:string) => {
                  // @ts-ignore
                  doc?.addItem(name);
                }"
              />
              <ExchangeRate
                v-if="canShowExchangeRate"
                :disabled="doc?.isSubmitted || doc?.isCancelled"
                :from-currency="fromCurrency"
                :to-currency="toCurrency"
                :exchange-rate="exchangeRate"
                @change="async (exchangeRate: number) => await doc.set('exchangeRate', exchangeRate)"
              />
              <span v-if="!(canShowBarcode || canShowExchangeRate)" class="text-xs text-gray-500 dark:text-gray-400">
                {{ t`Record workspace` }}
              </span>
            </div>

            <div class="flex items-center gap-2 ms-auto">
              <Button
                v-if="canPrint"
                ref="printButton"
                :icon="true"
                :title="t`Print document`"
                @click="routeTo(`/print/${doc.schemaName}/${doc.name}`)"
              >
                <feather-icon name="printer" class="w-4 h-4" />
              </Button>

              <DropdownWithActions
                v-for="group of groupedActions"
                :key="group.label"
                :type="group.type"
                :actions="group.actions"
              >
                <p v-if="group.group">{{ group.group }}</p>
                <feather-icon v-else name="more-horizontal" class="w-4 h-4" />
              </DropdownWithActions>

              <Button v-if="doc?.canSave" type="primary" @click="sync">
                <feather-icon name="check" class="w-4 h-4 me-2" />
                {{ t`Save Record` }}
              </Button>
              <Button v-else-if="doc?.canSubmit" type="primary" @click="submit">
                <feather-icon name="send" class="w-4 h-4 me-2" />
                {{ t`Finalize` }}
              </Button>
            </div>
          </div>

          <div class="arthivox-document-scroll custom-scroll custom-scroll-thumb1">
            <div class="arthivox-document-intro">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                  {{ activeTab === t`Default` ? t`Record details` : activeTab }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ t`Review and update the information for this record.` }}
                </p>
              </div>
            </div>

            <div class="arthivox-form-sections">
              <CommonFormSection
                v-for="([n, fields], idx) in activeGroup.entries()"
                :key="n + idx"
                ref="section"
                class="arthivox-form-section-card"
                :show-title="activeGroup.size > 1 && n !== t`Default`"
                :title="n"
                :fields="fields"
                :doc="doc"
                :errors="errors"
                @editrow="(doc: Doc) => showRowEditForm(doc)"
                @value-change="onValueChange"
                @row-change="updateGroupedFields"
              />
            </div>
          </div>
        </main>
      </div>
    </template>

    <template #quickedit>
      <Transition name="quickedit">
        <LinkedEntries
          v-if="showLinks && canShowLinks"
          :doc="doc"
          @close="showLinks = false"
        />
      </Transition>
      <Transition name="quickedit">
        <RowEditForm
          v-if="row && !showLinks"
          :doc="doc"
          :fieldname="row.fieldname"
          :index="row.index"
          @previous="(i:number) => row!.index = i"
          @next="(i:number) => row!.index = i"
          @close="() => (row = null)"
        />
      </Transition>
    </template>
  </FormContainer>
</template>

<script lang="ts">
import { DocValue } from 'fyo/core/types';
import { Doc } from 'fyo/model/doc';
import { DEFAULT_CURRENCY } from 'fyo/utils/consts';
import { ValidationError } from 'fyo/utils/errors';
import { getDocStatus } from 'models/helpers';
import { ModelNameEnum } from 'models/types';
import { Field, Schema } from 'schemas/types';
import Button from 'src/components/Button.vue';
import Barcode from 'src/components/Controls/Barcode.vue';
import ExchangeRate from 'src/components/Controls/ExchangeRate.vue';
import DropdownWithActions from 'src/components/DropdownWithActions.vue';
import FormContainer from 'src/components/FormContainer.vue';
import StatusPill from 'src/components/StatusPill.vue';
import { getErrorMessage } from 'src/utils';
import { shortcutsKey } from 'src/utils/injectionKeys';
import { docsPathMap } from 'src/utils/misc';
import { docsPathRef } from 'src/utils/refs';
import { ActionGroup, DocRef, UIGroupedFields } from 'src/utils/types';
import {
  commonDocSubmit,
  commonDocSync,
  getDocFromNameIfExistsElseNew,
  getFieldsGroupedByTabAndSection,
  getFormRoute,
  getGroupedActionsForDoc,
  isPrintable,
  routeTo,
} from 'src/utils/ui';
import { useDocShortcuts } from 'src/utils/vueUtils';
import { computed, defineComponent, inject, nextTick, ref } from 'vue';
import CommonFormSection from './CommonFormSection.vue';
import LinkedEntries from './LinkedEntries.vue';
import RowEditForm from './RowEditForm.vue';

export default defineComponent({
  components: {
    FormContainer,
    CommonFormSection,
    Button,
    DropdownWithActions,
    Barcode,
    ExchangeRate,
    LinkedEntries,
    RowEditForm,
    StatusPill,
  },
  provide() {
    return { doc: computed(() => this.docOrNull) };
  },
  props: {
    name: { type: String, default: '' },
    schemaName: { type: String, default: ModelNameEnum.SalesInvoice },
  },
  setup() {
    const shortcuts = inject(shortcutsKey);
    const docOrNull = ref(null) as DocRef;
    let context = 'CommonForm';
    if (shortcuts) {
      context = useDocShortcuts(shortcuts, docOrNull, 'CommonForm', true);
    }

    return {
      docOrNull,
      shortcuts,
      context,
      printButton: ref<InstanceType<typeof Button> | null>(null),
    };
  },
  data() {
    return {
      errors: {},
      activeTab: this.t`Default`,
      groupedFields: null,
      isPrintable: false,
      showLinks: false,
      useFullWidth: false,
      row: null,
    } as {
      errors: Record<string, string>;
      activeTab: string;
      groupedFields: null | UIGroupedFields;
      isPrintable: boolean;
      showLinks: boolean;
      useFullWidth: boolean;
      row: null | { index: number; fieldname: string };
    };
  },
  computed: {
    displaySchemaLabel(): string {
      const labels: Record<string, string> = {
        SalesInvoice: this.t`Customer Invoice`,
        PurchaseInvoice: this.t`Vendor Bill`,
        SalesQuote: this.t`Estimate`,
        Payment: this.t`Payment Record`,
        JournalEntry: this.t`Journal Record`,
        Party: this.t`Contact`,
        Item: this.t`Product or Service`,
        Tax: this.t`Tax Rule`,
        PriceList: this.t`Rate Book`,
        StockMovement: this.t`Inventory Transfer`,
      };
      return labels[this.schemaName] ?? this.schema.label ?? this.schemaName;
    },
    canShowBarcode(): boolean {
      if (!this.fyo.singles.InventorySettings?.enableBarcodes) {
        return false;
      }
      if (!this.hasDoc) {
        return false;
      }
      if (this.doc.isSubmitted || this.doc.isCancelled) {
        return false;
      }
      // @ts-ignore
      return typeof this.doc?.addItem === 'function';
    },
    canShowExchangeRate(): boolean {
      return this.hasDoc && !!this.doc.isMultiCurrency;
    },
    exchangeRate(): number {
      if (!this.hasDoc || typeof this.doc.exchangeRate !== 'number') {
        return 1;
      }
      return this.doc.exchangeRate;
    },
    fromCurrency(): string {
      const currency = this.doc?.currency;
      if (typeof currency !== 'string') {
        return this.toCurrency;
      }
      return currency;
    },
    toCurrency(): string {
      const currency = this.fyo.singles.SystemSettings?.currency;
      if (typeof currency !== 'string') {
        return DEFAULT_CURRENCY;
      }
      return currency;
    },
    canPrint(): boolean {
      if (!this.hasDoc) {
        return false;
      }
      return !this.doc.isCancelled && !this.doc.dirty && this.isPrintable;
    },
    canShowLinks(): boolean {
      if (!this.hasDoc) {
        return false;
      }
      if (this.doc.schema.isSubmittable && !this.doc.isSubmitted) {
        return false;
      }
      return this.doc.inserted;
    },
    hasDoc(): boolean {
      return this.docOrNull instanceof Doc;
    },
    status(): string {
      if (!this.hasDoc) {
        return '';
      }
      return getDocStatus(this.doc);
    },
    doc(): Doc {
      const doc = this.docOrNull;
      if (!doc) {
        throw new ValidationError(
          this.t`Doc ${this.schema.label} ${this.name} not set`
        );
      }
      return doc;
    },
    title(): string {
      if (this.schema.isSubmittable && this.docOrNull?.notInserted) {
        return this.t`New Record`;
      }
      return this.docOrNull?.name || this.t`New Record`;
    },
    schema(): Schema {
      const schema = this.fyo.schemaMap[this.schemaName];
      if (!schema) {
        throw new ValidationError(`no schema found with ${this.schemaName}`);
      }
      return schema;
    },
    activeGroup(): Map<string, Field[]> {
      if (!this.groupedFields) {
        return new Map();
      }
      const group = this.groupedFields.get(this.activeTab);
      if (!group) {
        const tab = [...this.groupedFields.keys()][0];
        return this.groupedFields.get(tab) ?? new Map<string, Field[]>();
      }
      return group;
    },
    groupedActions(): ActionGroup[] {
      if (!this.hasDoc) {
        return [];
      }
      return getGroupedActionsForDoc(this.doc);
    },
  },
  beforeMount() {
    this.useFullWidth = !!this.fyo.singles.Misc?.useFullWidth;
  },
  async mounted() {

    await this.setDoc();
    this.replacePathAfterSync();
    this.updateGroupedFields();
    if (this.groupedFields) {
      this.activeTab = [...this.groupedFields.keys()][0];
    }
    this.isPrintable = await isPrintable(this.schemaName);
  },
  activated(): void {
    this.useFullWidth = !!this.fyo.singles.Misc?.useFullWidth;
    docsPathRef.value = docsPathMap[this.schemaName] ?? '';
    this.shortcuts?.pmod.set(this.context, ['KeyP'], () => {
      if (!this.canPrint) {
        return;
      }
      this.printButton?.$el.click();
    });
    this.shortcuts?.pmod.set(this.context, ['KeyL'], () => {
      if (!this.canShowLinks && !this.showLinks) {
        return;
      }
      this.showLinks = !this.showLinks;
    });
  },
  deactivated(): void {
    docsPathRef.value = '';
    this.showLinks = false;
    this.row = null;
  },
  methods: {
    routeTo,
    async toggleWidth() {
      const value = !this.useFullWidth;
      await this.fyo.singles.Misc?.setAndSync('useFullWidth', value);
      this.useFullWidth = value;
    },
    updateGroupedFields(): void {
      if (!this.hasDoc) {
        return;
      }
      this.groupedFields = getFieldsGroupedByTabAndSection(
        this.schema,
        this.doc
      );
    },
    async sync(useDialog?: boolean) {
      if (await commonDocSync(this.doc, useDialog)) {
        this.updateGroupedFields();
      }
    },
    async submit() {
      if (await commonDocSubmit(this.doc)) {
        this.updateGroupedFields();
      }
    },
    async setDoc() {
      if (this.hasDoc) {
        return;
      }
      this.docOrNull = await getDocFromNameIfExistsElseNew(
        this.schemaName,
        this.name
      );
    },
    replacePathAfterSync() {
      if (!this.hasDoc || this.doc.inserted) {
        return;
      }
      this.doc.once('afterSync', async () => {
        const route = getFormRoute(this.schemaName, this.doc.name!);
        await this.$router.replace(route);
      });
    },
    async showRowEditForm(doc: Doc) {
      if (this.showLinks) {
        this.showLinks = false;
        await nextTick();
      }
      const index = doc.idx;
      const fieldname = doc.parentFieldname;
      if (typeof index === 'number' && typeof fieldname === 'string') {
        this.row = { index, fieldname };
      }
    },
    async onValueChange(field: Field, value: DocValue) {
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
      this.updateGroupedFields();
    },
  },
});
</script>
