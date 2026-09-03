<template>
  <div class="flex flex-col h-full arthivox-records-page">
    <header class="arthivox-records-head flex-shrink-0">
      <div class="flex items-center gap-3">
        <div class="arthivox-nav-cluster">
          <PageHeaderNavGroup />
        </div>
        <div>
          <p class="arthivox-kicker">{{ t`Record library` }}</p>
          <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mt-0.5">
            {{ title }}
          </h1>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ t`Browse, filter and open records from this workspace.` }}
          </p>
        </div>
      </div>

      <div class="arthivox-record-actions">
        <Button
          v-if="canCreate"
          ref="makeNewDocButton"
          type="primary"
          class="arthivox-new-record"
          @click="handleMakeNewDoc"
        >
          <feather-icon name="plus" class="w-4 h-4 me-2" />
          {{ t`New Record` }}
        </Button>

        <FilterDropdown
          ref="filterDropdown"
          :schema-name="schemaName"
          @change="applyFilter"
        />

        <Button ref="exportButton" @click="openExportModal = true">
          <feather-icon name="download" class="w-4 h-4 me-2" />
          {{ t`Export Data` }}
        </Button>

        <Button
          v-if="schemaName === 'Item' && (!isSelectionMode || selectedItems.length === 0)"
          @click="toggleSelectionMode"
        >
          <feather-icon name="check-square" class="w-4 h-4 me-2" />
          {{ t`Pick Multiple` }}
        </Button>

        <div
          v-if="isSelectionMode && schemaName === 'Item' && selectedItems.length > 0"
          class="relative"
        >
          <Button class="w-40" @click="toggleDropdown">
            {{ t`Create From Selection` }}
          </Button>
          <div
            v-if="showDropdown"
            class="absolute end-0 top-full mt-2 bg-white dark:bg-gray-875 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 w-48 overflow-hidden"
          >
            <button
              v-for="option in actionOptions"
              :key="option.value"
              class="w-full text-start px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
              @click="createInvoice(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="arthivox-records-body flex-1 min-h-0">
      <div class="arthivox-records-summary">
        <div>
          <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold">{{ t`Collection` }}</p>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-200 mt-1">{{ title }}</p>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t`Select a row to open its detail workspace` }}
        </div>
      </div>

      <List
        ref="list"
        :schema-name="schemaName"
        :list-config="listConfig"
        :filters="filters"
        :can-create="canCreate"
        :is-selection-mode="isSelectionMode"
        class="flex-1 h-full min-h-0"
        @open-doc="openDoc"
        @updated-data="updatedData"
        @make-new-doc="makeNewDoc"
        @selected-items-changed="updateSelectedItems"
      />
    </div>

    <Modal :open-modal="openExportModal" @closemodal="openExportModal = false">
      <ExportWizard
        class="w-form"
        :schema-name="schemaName"
        :title="pageTitle"
        :list-filters="listFilters"
      />
    </Modal>
  </div>
</template>

<script lang="ts">
import { Field } from 'schemas/types';
import Button from 'src/components/Button.vue';
import ExportWizard from 'src/components/ExportWizard.vue';
import FilterDropdown from 'src/components/FilterDropdown.vue';
import Modal from 'src/components/Modal.vue';
import PageHeaderNavGroup from 'src/components/PageHeaderNavGroup.vue';
import { fyo } from 'src/initFyo';
import { shortcutsKey } from 'src/utils/injectionKeys';
import {
  docsPathMap,
  getCreateFiltersFromListViewFilters,
} from 'src/utils/misc';
import { docsPathRef } from 'src/utils/refs';
import { getFormRoute, routeTo } from 'src/utils/ui';
import { QueryFilter } from 'utils/db/types';
import { defineComponent, inject, ref } from 'vue';
import List from './List.vue';
import { Money } from 'pesa';
import { ModelNameEnum } from 'models/types';

export default defineComponent({
  name: 'ListView',
  components: {
    List,
    Button,
    FilterDropdown,
    Modal,
    ExportWizard,
    PageHeaderNavGroup,
  },
  props: {
    schemaName: { type: String, required: true },
    filters: { type: Object, default: undefined },
    pageTitle: { type: String, default: '' },
  },
  setup() {
    return {
      shortcuts: inject(shortcutsKey),
      list: ref<InstanceType<typeof List> | null>(null),
      makeNewDocButton: ref<InstanceType<typeof Button> | null>(null),
      exportButton: ref<InstanceType<typeof Button> | null>(null),
      filterDropdown: ref<InstanceType<typeof FilterDropdown> | null>(null),
    };
  },
  data() {
    return {
      listConfig: undefined,
      openExportModal: false,
      listFilters: {},
      isSelectionMode: false,
      showDropdown: false,
      selectedItems: [] as string[],
    } as {
      listConfig: undefined | ReturnType<typeof getListConfig>;
      openExportModal: boolean;
      listFilters: QueryFilter;
      isSelectionMode: boolean;
      showDropdown: boolean;
      selectedItems: string[];
    };
  },
  computed: {
    context(): string {
      return 'ListView-' + this.schemaName;
    },
    title(): string {
      if (this.pageTitle) {
        return this.pageTitle;
      }
      const labels: Record<string, string> = {
        SalesInvoice: this.t`Customer Invoices`,
        PurchaseInvoice: this.t`Vendor Bills`,
        SalesQuote: this.t`Estimates`,
        Payment: this.t`Payment Records`,
        JournalEntry: this.t`Journal Records`,
        Party: this.t`Contacts`,
        Item: this.t`Products & Services`,
        PriceList: this.t`Rate Books`,
        Tax: this.t`Tax Rules`,
        StockMovement: this.t`Inventory Transfers`,
        PrintTemplate: this.t`Document Layouts`,
      };
      return labels[this.schemaName] ?? fyo.schemaMap[this.schemaName]?.label ?? this.schemaName;
    },
    fields(): Field[] {
      return fyo.schemaMap[this.schemaName]?.fields ?? [];
    },
    canCreate(): boolean {
      return fyo.schemaMap[this.schemaName]?.create !== false;
    },
    actionOptions(): { value: string; label: string }[] {
      return [
        { value: 'SalesQuote', label: this.t`Create Estimate` },
        { value: 'SalesInvoice', label: this.t`Create Customer Invoice` },
        { value: 'PurchaseInvoice', label: this.t`Create Vendor Bill` },
      ];
    },
  },
  activated() {
    this.listConfig = getListConfig(this.schemaName);
    docsPathRef.value = docsPathMap[this.schemaName] ?? docsPathMap.Entries ?? '';
    this.setShortcuts();
  },
  deactivated() {
    docsPathRef.value = '';
    this.shortcuts?.delete(this.context);
  },
  methods: {
    setShortcuts() {
      if (!this.shortcuts) {
        return;
      }
      this.shortcuts.pmod.set(this.context, ['KeyN'], () => this.makeNewDocButton?.$el.click());
      this.shortcuts.pmod.set(this.context, ['KeyE'], () => this.exportButton?.$el.click());
    },
    updatedData(listFilters: QueryFilter) {
      this.listFilters = listFilters;
    },
    async openDoc(name: string) {
      const route = getFormRoute(this.schemaName, name);
      await routeTo(route);
    },
    async makeNewDoc() {
      if (!this.canCreate) {
        return;
      }
      const filters = getCreateFiltersFromListViewFilters(this.filters ?? {});
      const doc = fyo.doc.getNewDoc(this.schemaName, filters);
      const route = getFormRoute(this.schemaName, doc.name!);
      await routeTo(route);
    },
    async handleMakeNewDoc() {
      await this.makeNewDoc();
    },
    applyFilter(filters: QueryFilter) {
      this.list?.updateData(filters);
    },
    toggleSelectionMode() {
      this.isSelectionMode = !this.isSelectionMode;
      if (!this.isSelectionMode) {
        this.showDropdown = false;
        this.selectedItems = [];
      }
    },
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    async createInvoice(value: string) {
      if (
        value === ModelNameEnum.SalesQuote ||
        value === ModelNameEnum.SalesInvoice ||
        value === ModelNameEnum.PurchaseInvoice
      ) {
        const doc = fyo.doc.getNewDoc(value);
        for (const itemName of this.selectedItems) {
          const itemDoc = await fyo.doc.getDoc('Item', itemName);
          const itemRow = {
            item: itemName,
            rate: (itemDoc.rate as Money) || fyo.pesa(0),
            quantity: 1,
          };
          await doc.append('items', itemRow);
        }
        const route = getFormRoute(value, doc.name!);
        await routeTo(route);
        this.selectedItems = [];
        this.isSelectionMode = false;
        this.showDropdown = false;
      }
    },
    updateSelectedItems(selected: string[]) {
      this.selectedItems = selected;
    },
  },
});

function getListConfig(schemaName: string) {
  const listConfig = fyo.models[schemaName]?.getListViewSettings?.(fyo);
  if (listConfig?.columns === undefined) {
    return { columns: ['name'] };
  }
  return listConfig;
}
</script>
