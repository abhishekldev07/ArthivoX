<template>
  <div class="text-base flex flex-col overflow-hidden arthivox-record-list">
    <div
      class="arthivox-record-column-head flex items-center"
      :style="{ paddingRight: dataSlice.length > 13 ? 'var(--w-scrollbar)' : '' }"
    >
      <div v-if="!isSelectionMode" class="w-10 flex-shrink-0 text-center text-xs text-gray-400">
        {{ t`ID` }}
      </div>
      <div v-else class="w-10 flex justify-center flex-shrink-0">
        <Check
          :df="{ fieldtype: 'Check', fieldname: 'selectAll', label: '' }"
          :show-label="false"
          :value="isAllSelected"
          @change="toggleSelectAll"
        />
      </div>

      <Row
        class="flex-1 text-gray-500 dark:text-gray-400 min-h-9"
        :column-count="columns.length"
        gap="1rem"
      >
        <div
          v-for="(column, i) in columns"
          :key="column.label"
          class="overflow-x-auto no-scrollbar whitespace-nowrap items-center flex text-xs font-semibold uppercase tracking-wider"
          :class="{
            'ms-auto': isNumeric(column.fieldtype),
            'pe-4': i === columns.length - 1,
          }"
        >
          {{ column.label }}
        </div>
      </Row>
    </div>

    <div
      v-if="dataSlice.length !== 0"
      class="overflow-y-auto custom-scroll custom-scroll-thumb1 px-3 pb-3 space-y-2"
    >
      <div
        v-for="(row, i) in dataSlice"
        :key="(row.name as string)"
        class="arthivox-record-row flex items-center"
      >
        <div v-if="!isSelectionMode" class="w-10 flex-shrink-0 flex justify-center">
          <div class="arthivox-record-index">{{ i + pageStart + 1 }}</div>
        </div>
        <div v-else class="w-10 flex justify-center flex-shrink-0">
          <Check
            :df="{ fieldtype: 'Check', fieldname: 'selectItem', label: '' }"
            :show-label="false"
            :value="selectedItems.includes(row.name as string)"
            @change="toggleItemSelection(row.name as string)"
          />
        </div>

        <Row
          gap="1rem"
          class="cursor-pointer text-gray-900 dark:text-gray-200 flex-1 min-h-12 items-center"
          :column-count="columns.length"
          @click="isSelectionMode ? null : $emit('openDoc', row.name)"
        >
          <ListCell
            v-for="(column, c) in columns"
            :key="column.label"
            :class="{
              'text-end': isNumeric(column.fieldtype),
              'pe-4': c === columns.length - 1,
              'font-medium': c === 0,
            }"
            :row="(row as RenderData)"
            :column="column"
            @status-found="handleStatusFound"
          />
        </Row>

        <feather-icon name="chevron-right" class="w-4 h-4 text-gray-300 dark:text-gray-600 me-3 flex-shrink-0" />
      </div>
    </div>

    <div v-if="data?.length" class="arthivox-record-pagination mt-auto">
      <Paginator
        :item-count="data.length"
        class="px-4"
        @index-change="setPageIndices"
      />
    </div>

    <div v-if="!data?.length" class="flex flex-col items-center justify-center my-auto px-8">
      <div class="w-20 h-20 rounded-3xl bg-teal-50 dark:bg-teal-900 dark:bg-opacity-20 flex-center mb-4">
        <feather-icon name="inbox" class="w-8 h-8 text-teal-600 dark:text-teal-300" />
      </div>
      <p class="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {{ t`Nothing here yet` }}
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 text-center max-w-sm">
        {{ t`Create the first record in this workspace to begin building your history.` }}
      </p>
      <Button v-if="canCreate" type="primary" @click="$emit('makeNewDoc')">
        <feather-icon name="plus" class="w-4 h-4 me-2" />
        {{ t`Create First Record` }}
      </Button>
    </div>
  </div>
</template>

<script lang="ts">
import { ListViewSettings, RenderData } from 'fyo/model/types';
import { cloneDeep } from 'lodash';
import Button from 'src/components/Button.vue';
import Check from 'src/components/Controls/Check.vue';
import Paginator from 'src/components/Paginator.vue';
import Row from 'src/components/Row.vue';
import { fyo } from 'src/initFyo';
import { isNumeric } from 'src/utils';
import { QueryFilter } from 'utils/db/types';
import { PropType, defineComponent, toRaw } from 'vue';
import ListCell from './ListCell.vue';

export default defineComponent({
  name: 'List',
  components: { Row, ListCell, Button, Check, Paginator },
  props: {
    listConfig: {
      type: Object as PropType<ListViewSettings | undefined>,
      default: () => ({ columns: [] }),
    },
    filters: {
      type: Object as PropType<QueryFilter>,
      default: () => ({}),
    },
    schemaName: { type: String, required: true },
    canCreate: Boolean,
    isSelectionMode: Boolean,
  },
  emits: ['openDoc', 'makeNewDoc', 'updatedData', 'selected-items-changed'],
  data() {
    return {
      data: [] as RenderData[],
      pageStart: 0,
      pageEnd: 0,
      statusMap: {} as Record<string, string>,
      selectedItems: [] as string[],
    };
  },
  computed: {
    dataSlice() {
      return this.data.slice(this.pageStart, this.pageEnd);
    },
    count() {
      return this.pageEnd - this.pageStart + 1;
    },
    isAllSelected(): boolean {
      return this.data.length > 0 && this.selectedItems.length === this.data.length;
    },
    columns() {
      let columns = this.listConfig?.columns ?? [];
      if (columns.length === 0) {
        columns = fyo.schemaMap[this.schemaName]?.quickEditFields ?? [];
        columns = [...new Set(['name', ...columns])];
      }

      return columns
        .map((fieldname) => {
          if (typeof fieldname === 'object') {
            return fieldname;
          }
          return fyo.getField(this.schemaName, fieldname);
        })
        .filter(Boolean);
    },
  },
  watch: {
    async schemaName(oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      await this.updateData();
    },
  },
  async mounted() {
    await this.updateData();
    this.setUpdateListeners();
  },
  methods: {
    handleStatusFound({ rowId, status }: { rowId: string; status: string }) {
      this.statusMap[rowId] = status;
    },
    isNumeric,
    setPageIndices({ start, end }: { start: number; end: number }) {
      this.pageStart = start;
      this.pageEnd = end;
    },
    setUpdateListeners() {
      if (!this.schemaName) {
        return;
      }
      const listener = async () => await this.updateData();
      if (fyo.schemaMap[this.schemaName]?.isSubmittable) {
        fyo.doc.observer.on(`submit:${this.schemaName}`, listener);
        fyo.doc.observer.on(`revert:${this.schemaName}`, listener);
      }
      fyo.doc.observer.on(`sync:${this.schemaName}`, listener);
      fyo.db.observer.on(`delete:${this.schemaName}`, listener);
      fyo.doc.observer.on(`rename:${this.schemaName}`, listener);
    },
    async updateData(filters?: Record<string, unknown>) {
      const baseFilters = cloneDeep(toRaw(this.filters));
      filters = cloneDeep({ ...baseFilters, ...filters });

      let statusFilter: [string, string] | undefined;
      if ('status' in filters) {
        statusFilter = filters['status'] as [string, string];
      }

      const isStatusFilter = Array.isArray(statusFilter) && statusFilter[0] === 'like';
      if (isStatusFilter) {
        delete filters['status'];
      }

      const orderBy = ['created'];
      if (fyo.db.fieldMap[this.schemaName]['date']) {
        orderBy.unshift('date');
      }

      const tableData = await fyo.db.getAll(this.schemaName, {
        fields: ['*'],
        filters: filters as QueryFilter,
        orderBy,
      });

      let filteredData = tableData;
      if (isStatusFilter && statusFilter?.[1]) {
        const lowercaseStatus = String(statusFilter[1]).toLowerCase();
        const matchedNames = Object.entries(this.statusMap)
          .filter((entry) => entry[1].toLowerCase() === lowercaseStatus)
          .map((entry) => entry[0]);
        filteredData = tableData.filter((row) => matchedNames.includes(String(row.name)));
      }

      this.data = filteredData.map((d) => ({
        ...d,
        schema: fyo.schemaMap[this.schemaName],
      })) as RenderData[];
      this.$emit('updatedData', filters);
    },
    toggleItemSelection(itemName: string) {
      const index = this.selectedItems.indexOf(itemName);
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      } else {
        this.selectedItems.push(itemName);
      }
      this.$emit('selected-items-changed', this.selectedItems);
    },
    toggleSelectAll(checked: boolean) {
      this.selectedItems = checked ? this.data.map((row) => row.name as string) : [];
      this.$emit('selected-items-changed', this.selectedItems);
    },
  },
});
</script>
