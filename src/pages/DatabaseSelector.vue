<template>
  <div
    class="arthivox-welcome-bg flex-1 flex justify-center items-center"
    :class="{ 'window-drag': platform !== 'Windows' }"
  >
    <div class="arthivox-welcome-shell window-no-drag">
      <aside class="arthivox-welcome-brand flex flex-col">
        <div class="flex items-center gap-3 relative z-10">
          <div class="arthivox-brand-tile">
            <img :src="arthivoxSymbol" alt="ArthivoX" class="w-8 h-8 object-contain" />
          </div>
          <div>
            <div class="text-2xl font-semibold tracking-tight">Arthivo<span class="text-teal-300">X</span></div>
            <p class="text-xs text-blue-100 opacity-70">Business finance, clearly.</p>
          </div>
        </div>

        <div class="mt-auto mb-auto relative z-10">
          <p class="text-xs uppercase tracking-wider text-teal-200 mb-3">Your financial workspace</p>
          <h1 class="text-3xl font-semibold leading-tight mb-4">Accounting that keeps your business moving.</h1>
          <p class="text-base text-blue-100 opacity-80 leading-relaxed mb-8">
            Manage sales, spending, accounts and financial reporting from one focused desktop workspace.
          </p>
          <div class="flex flex-col gap-4 text-sm text-blue-100">
            <div class="flex items-center gap-3"><span class="w-7 h-7 rounded-lg bg-teal-500 bg-opacity-20 flex-center"><feather-icon name="hard-drive" class="w-4 h-4 text-teal-200" /></span><span>Local-first company data</span></div>
            <div class="flex items-center gap-3"><span class="w-7 h-7 rounded-lg bg-teal-500 bg-opacity-20 flex-center"><feather-icon name="cloud" class="w-4 h-4 text-teal-200" /></span><span>Secure cloud synchronization</span></div>
            <div class="flex items-center gap-3"><span class="w-7 h-7 rounded-lg bg-teal-500 bg-opacity-20 flex-center"><feather-icon name="shield" class="w-4 h-4 text-teal-200" /></span><span>Encrypted cloud backups</span></div>
          </div>
        </div>
        <p class="relative z-10 text-xs text-blue-100 opacity-50">ArthivoX Desktop Accounting</p>
      </aside>

      <main class="arthivox-welcome-content min-h-0">
        <div class="px-8 pt-8 pb-5">
          <span class="arthivox-kicker">Start here</span>
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-25 mt-1">{{ t`Welcome to ArthivoX` }}</h2>
          <p class="text-gray-600 dark:text-gray-400 text-base mt-1">{{ t`Create a company or continue with an existing database.` }}</p>
        </div>

        <div class="px-8 grid grid-cols-1 gap-3">
          <button data-testid="create-new-file" class="arthivox-action-card" @click="newDatabase">
            <span class="arthivox-action-icon teal"><feather-icon name="plus" class="w-5 h-5" /></span>
            <span class="min-w-0"><span class="block font-semibold text-gray-900 dark:text-gray-100">{{ t`New Company` }}</span><span class="block text-sm text-gray-600 dark:text-gray-400 mt-1">{{ t`Create a new accounting workspace on this computer` }}</span></span>
            <feather-icon name="arrow-right" class="w-4 h-4 ms-auto text-gray-400" />
          </button>

          <button class="arthivox-action-card" @click="existingDatabase">
            <span class="arthivox-action-icon"><feather-icon name="folder" class="w-5 h-5" /></span>
            <span class="min-w-0"><span class="block font-semibold text-gray-900 dark:text-gray-100">{{ t`Open Company` }}</span><span class="block text-sm text-gray-600 dark:text-gray-400 mt-1">{{ t`Choose an existing company database from your computer` }}</span></span>
            <feather-icon name="arrow-right" class="w-4 h-4 ms-auto text-gray-400" />
          </button>
        </div>

        <div v-if="files?.length" class="px-8 pt-6 min-h-0 flex flex-col">
          <div class="mb-2">
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t`Recent Companies` }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">{{ t`Continue where you left off` }}</p>
          </div>
          <div class="overflow-y-auto custom-scroll custom-scroll-thumb1" style="max-height: 235px">
            <div v-for="(file, i) in files" :key="file.dbPath" class="arthivox-recent-row flex gap-3 items-center cursor-pointer" :title="t`${file.companyName} stored at ${file.dbPath}`" @click="selectFile(file)">
              <div class="w-9 h-9 rounded-lg flex-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold flex-shrink-0">{{ file.companyName?.charAt(0)?.toUpperCase() || i + 1 }}</div>
              <div class="min-w-0 flex-1">
                <div class="flex justify-between gap-3 items-baseline"><h3 class="font-medium text-gray-900 dark:text-gray-200 truncate">{{ file.companyName }}</h3><p class="whitespace-nowrap text-xs text-gray-500 dark:text-gray-500">{{ formatDate(file.modified) }}</p></div>
                <p class="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">{{ truncate(file.dbPath) }}</p>
              </div>
              <button class="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg text-gray-400 hover:text-red-600" @click.stop="() => deleteDb(i)"><feather-icon name="trash-2" class="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div class="mt-auto px-8 py-5 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
          <LanguageSelector class="text-sm w-28" />
          <p class="text-xs text-gray-500 dark:text-gray-500">Secure local desktop workspace</p>
        </div>
      </main>
    </div>
  </div>
</template>
<script lang="ts">
import { ARTHIVOX_SYMBOL_DATA_URL } from 'src/assets/brand/embeddedBrand';
import { t } from 'fyo';
import { DateTime } from 'luxon';
import LanguageSelector from 'src/components/Controls/LanguageSelector.vue';
import FeatherIcon from 'src/components/FeatherIcon.vue';
import { showDialog } from 'src/utils/interactive';
import { deleteDb, getSelectedFilePath } from 'src/utils/ui';
import type { ConfigFilesWithModified } from 'utils/types';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'DatabaseSelector',
  components: { LanguageSelector, FeatherIcon },
  emits: ['file-selected', 'new-database'],
  data() {
    return {
      arthivoxSymbol: ARTHIVOX_SYMBOL_DATA_URL,
      files: [] as ConfigFilesWithModified[],
    };
  },
  async mounted() {
    await this.setFiles();
  },
  methods: {
    truncate(value: string) {
      if (value.length < 72) return value;
      return '...' + value.slice(value.length - 72);
    },
    formatDate(isoDate: string) {
      return DateTime.fromISO(isoDate).toRelative();
    },
    async deleteDb(i: number) {
      const file = this.files[i];
      const setFiles = this.setFiles.bind(this);
      await showDialog({
        title: t`Delete ${file.companyName}?`,
        detail: t`Database file: ${file.dbPath}`,
        type: 'warning',
        buttons: [
          { label: this.t`Yes`, async action() { await deleteDb(file.dbPath); await setFiles(); }, isPrimary: true },
          { label: this.t`No`, action() { return null; }, isEscape: true },
        ],
      });
    },
    async setFiles() {
      const dbList = await ipc.getDbList();
      this.files = dbList?.sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
    },
    newDatabase() { this.$emit('new-database'); },
    async existingDatabase() {
      const filePath = (await getSelectedFilePath())?.filePaths?.[0];
      this.emitFileSelected(filePath);
    },
    selectFile(file: ConfigFilesWithModified) { this.emitFileSelected(file.dbPath); },
    emitFileSelected(filePath: string) {
      if (!filePath) return;
      this.$emit('file-selected', filePath);
    },
  },
});
</script>
