<template>
  <div
    id="app"
    class="dark:bg-gray-900 h-screen flex flex-col font-sans overflow-hidden antialiased"
    :dir="languageDirection"
    :language="language"
  >
    <WindowsTitleBar
      v-if="platform === 'Windows' && !showStartupBranding"
      :db-path="dbPath"
      :company-name="companyName"
    />

    <AuthScreen
      v-if="activeScreen === 'Auth'"
      class="flex-1"
      @authenticated="onAuthenticated"
    />
    <CloudHome
      v-if="activeScreen === 'CloudHome'"
      class="flex-1"
      :email="cloudUserEmail"
      :companies="cloudCompanies"
      :local-paths="cloudCompanyPaths"
      :loading="cloudLoading"
      @create-company="newDatabase"
      @import-local="importLocalCompany"
      @open-company="openCloudCompany"
      @logout="logoutCloud"
      @refresh="refreshCloudCompanies"
    />
    <Desk
      v-if="activeScreen === 'Desk'"
      class="flex-1"
      :dark-mode="darkMode"
      @change-db-file="showCloudHome"
      @cloud-home="showCloudHome"
    />
    <DatabaseSelector
      v-if="activeScreen === 'DatabaseSelector'"
      ref="databaseSelector"
      @new-database="newDatabase"
      @file-selected="fileSelected"
    />
    <SetupWizard
      v-if="activeScreen === 'SetupWizard'"
      @setup-complete="setupComplete"
      @setup-canceled="showCloudHome"
    />

    <Loading
      :open="showBusyOverlay"
      :full-width="true"
      :show-x="false"
      :percent="-1"
      :message="busyMessage"
    />

    <SplashScreen :open="showStartupBranding" />
    <BackupSecurityDialog />

    <div
      v-if="appearanceOpen"
      class="arthivox-appearance-overlay window-no-drag"
      @click.self="appearanceOpen = false"
    >
      <section class="arthivox-appearance-dialog">
        <header class="arthivox-appearance-header">
          <div>
            <p class="arthivox-eyebrow">Preferences</p>
            <h2>Appearance</h2>
            <p>Choose how ArthivoX looks on this computer.</p>
          </div>
          <button
            class="arthivox-appearance-close"
            title="Close"
            @click="appearanceOpen = false"
          >
            <feather-icon name="x" class="w-4 h-4" />
          </button>
        </header>

        <div class="arthivox-theme-options">
          <button
            class="arthivox-theme-option"
            :class="{ active: themePreference === 'light' }"
            @click="setThemePreference('light')"
          >
            <span class="arthivox-theme-icon"><feather-icon name="sun" class="w-5 h-5" /></span>
            <strong>Light</strong>
            <small>Always use the bright workspace</small>
          </button>
          <button
            class="arthivox-theme-option"
            :class="{ active: themePreference === 'dark' }"
            @click="setThemePreference('dark')"
          >
            <span class="arthivox-theme-icon"><feather-icon name="moon" class="w-5 h-5" /></span>
            <strong>Dark</strong>
            <small>Always use the dark workspace</small>
          </button>
          <button
            class="arthivox-theme-option"
            :class="{ active: themePreference === 'system' }"
            @click="setThemePreference('system')"
          >
            <span class="arthivox-theme-icon"><feather-icon name="monitor" class="w-5 h-5" /></span>
            <strong>System</strong>
            <small>Follow Windows light or dark mode</small>
          </button>
        </div>

        <div class="arthivox-appearance-note">
          <feather-icon name="check-circle" class="w-4 h-4" />
          <span>Changes apply immediately and are remembered for this device.</span>
        </div>
      </section>
    </div>

    <div
      id="toast-container"
      class="absolute bottom-0 flex flex-col items-end mb-3 pe-6"
      style="width: 100%; pointer-events: none"
    ></div>
  </div>
</template>
<script lang="ts">
import { RTL_LANGUAGES } from 'fyo/utils/consts';
import { ModelNameEnum } from 'models/types';
import type {
  ArthivoXCloudCompany,
  ArthivoXCloudSession,
} from 'src/cloud/supabase';
import {
  createCompany as createCloudCompany,
  getValidSession,
  listCompanies,
  signOut as signOutCloud,
} from 'src/cloud/supabase';
import { startCloudSync, stopCloudSync } from 'src/cloud/sync';
import {
  ARTHIVOX_BACKUP_NOW_EVENT,
  clearUnlockedBackupPassphrases,
  createCloudBackup,
  restoreLatestCloudBackup,
} from 'src/cloud/backup';
import { setDarkMode } from 'src/utils/theme';
import { systemLanguageRef } from 'src/utils/refs';
import { defineComponent, provide, ref, Ref } from 'vue';
import BackupSecurityDialog from './components/BackupSecurityDialog.vue';
import Loading from './components/Loading.vue';
import SplashScreen from './components/SplashScreen.vue';
import WindowsTitleBar from './components/WindowsTitleBar.vue';
import { handleErrorWithDialog } from './errorHandling';
import { fyo } from './initFyo';
import AuthScreen from './pages/Auth/AuthScreen.vue';
import CloudHome from './pages/CloudHome.vue';
import DatabaseSelector from './pages/DatabaseSelector.vue';
import Desk from './pages/Desk.vue';
import SetupWizard from './pages/SetupWizard/SetupWizard.vue';
import setupInstance from './setup/setupInstance';
import { SetupWizardOptions } from './setup/types';
import './styles/index.css';
import { connectToDatabase, dbErrorActionSymbols } from './utils/db';
import { initializeInstance } from './utils/initialization';
import * as injectionKeys from './utils/injectionKeys';
import { showDialog, showToast } from './utils/interactive';
import { setLanguageMap } from './utils/language';
import { updateConfigFiles } from './utils/misc';
import { updatePrintTemplates } from './utils/printTemplates';
import { Search } from './utils/search';
import { Shortcuts } from './utils/shortcuts';
import { routeTo } from './utils/ui';
import { useKeys } from './utils/vueUtils';


type ThemePreference = 'light' | 'dark' | 'system';
const THEME_STORAGE_KEY = 'arthivox-theme-preference';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

enum Screen {
  Auth = 'Auth',
  CloudHome = 'CloudHome',
  Desk = 'Desk',
  DatabaseSelector = 'DatabaseSelector',
  SetupWizard = 'SetupWizard',
}

const CLOUD_PATH_MAP_KEY = 'arthivox-cloud-company-paths-v1';

export default defineComponent({
  name: 'App',
  components: {
    AuthScreen,
    BackupSecurityDialog,
    CloudHome,
    Desk,
    SetupWizard,
    DatabaseSelector,
    WindowsTitleBar,
    SplashScreen,
    Loading,
  },
  setup() {
    const keys = useKeys();
    const searcher: Ref<null | Search> = ref(null);
    const shortcuts = new Shortcuts(keys);
    const languageDirection = ref(
      getLanguageDirection(systemLanguageRef.value)
    );

    provide(injectionKeys.keysKey, keys);
    provide(injectionKeys.searcherKey, searcher);
    provide(injectionKeys.shortcutsKey, shortcuts);
    provide(injectionKeys.languageDirectionKey, languageDirection);

    const databaseSelector = ref<InstanceType<typeof DatabaseSelector> | null>(
      null
    );

    return {
      keys,
      searcher,
      shortcuts,
      languageDirection,
      databaseSelector,
    };
  },
  data() {
    return {
      activeScreen: null,
      dbPath: '',
      companyName: '',
      darkMode: false,
      showStartupBranding: true,
      showBusyOverlay: false,
      busyMessage: '',
      appearanceOpen: false,
      themePreference: 'system',
      systemThemeQuery: null,
      systemThemeListener: null,
      initialBooting: true,
      startupTransitionTimer: null,
      cloudSession: null,
      cloudUserEmail: '',
      cloudCompanies: [],
      cloudLoading: false,
      cloudCompanyPaths: {},
      pendingCloudImport: false,
      cloudBackupTimer: null,
      cloudBackupStartupTimer: null,
      cloudBackupRunning: false,
    } as {
      activeScreen: null | Screen;
      dbPath: string;
      companyName: string;
      darkMode: boolean | undefined;
      showStartupBranding: boolean;
      showBusyOverlay: boolean;
      busyMessage: string;
      appearanceOpen: boolean;
      themePreference: ThemePreference;
      systemThemeQuery: MediaQueryList | null;
      systemThemeListener: ((event: MediaQueryListEvent) => void) | null;
      initialBooting: boolean;
      startupTransitionTimer: number | null;
      cloudSession: ArthivoXCloudSession | null;
      cloudUserEmail: string;
      cloudCompanies: ArthivoXCloudCompany[];
      cloudLoading: boolean;
      cloudCompanyPaths: Record<string, string>;
      pendingCloudImport: boolean;
      cloudBackupTimer: number | null;
      cloudBackupStartupTimer: number | null;
      cloudBackupRunning: boolean;
    };
  },
  computed: {
    language(): string {
      return systemLanguageRef.value;
    },
  },
  watch: {
    language(value: string) {
      this.languageDirection = getLanguageDirection(value);
    },
  },
  async mounted() {
    this.initializeAppearance();
    window.addEventListener('arthivox-open-appearance', this.openAppearance);
    window.addEventListener(
      ARTHIVOX_BACKUP_NOW_EVENT,
      this.requestManualCloudBackup
    );

    const splashStartedAt = Date.now();

    // The startup brand screen is intentionally short-lived. If opening the
    // last workspace takes longer than the splash window, switch to the normal
    // in-app spinner instead of leaving the brand screen hanging indefinitely.
    this.startupTransitionTimer = window.setTimeout(() => {
      if (!this.initialBooting) {
        return;
      }

      this.showStartupBranding = false;
      this.busyMessage = '';
      this.showBusyOverlay = true;
    }, 1100);

    try {
      await this.setInitialScreen();
    } finally {
      this.initialBooting = false;

      if (this.startupTransitionTimer !== null) {
        window.clearTimeout(this.startupTransitionTimer);
        this.startupTransitionTimer = null;
      }

      const minimumBrandTime = 650;
      const remaining = Math.max(
        0,
        minimumBrandTime - (Date.now() - splashStartedAt)
      );
      if (remaining) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      this.showStartupBranding = false;
      this.showBusyOverlay = false;
      this.busyMessage = '';
    }
  },
  beforeUnmount() {
    window.removeEventListener('arthivox-open-appearance', this.openAppearance);
    window.removeEventListener(
      ARTHIVOX_BACKUP_NOW_EVENT,
      this.requestManualCloudBackup
    );
    this.stopCloudBackupSchedule();
    if (this.startupTransitionTimer !== null) {
      window.clearTimeout(this.startupTransitionTimer);
    }
    if (this.systemThemeQuery && this.systemThemeListener) {
      this.systemThemeQuery.removeEventListener(
        'change',
        this.systemThemeListener
      );
    }
  },
  methods: {
    openAppearance() {
      this.appearanceOpen = true;
    },
    initializeAppearance() {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      this.themePreference = isThemePreference(stored) ? stored : 'system';

      this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemThemeListener = () => {
        if (this.themePreference === 'system') {
          this.applyThemePreference();
        }
      };
      this.systemThemeQuery.addEventListener('change', this.systemThemeListener);
      this.applyThemePreference();
    },
    setThemePreference(preference: ThemePreference) {
      this.themePreference = preference;
      localStorage.setItem(THEME_STORAGE_KEY, preference);
      this.applyThemePreference();
    },
    applyThemePreference() {
      const systemDark =
        this.systemThemeQuery?.matches ??
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const darkMode =
        this.themePreference === 'dark' ||
        (this.themePreference === 'system' && systemDark);

      setDarkMode(darkMode);
      this.darkMode = darkMode;
    },
    async setInitialScreen(): Promise<void> {
      this.cloudCompanyPaths = this.loadCloudPathMap();
      const session = await getValidSession();
      if (!session) {
        this.cloudSession = null;
        this.cloudUserEmail = '';
        this.activeScreen = Screen.Auth;
        return;
      }

      this.cloudSession = session;
      this.cloudUserEmail = session.user.email || '';
      await this.showCloudHome(false);
    },
    async onAuthenticated(session: ArthivoXCloudSession): Promise<void> {
      this.cloudSession = session;
      this.cloudUserEmail = session.user.email || '';
      await this.showCloudHome(false);
    },
    loadCloudPathMap(): Record<string, string> {
      const raw = localStorage.getItem(CLOUD_PATH_MAP_KEY);
      if (!raw) {
        return {};
      }
      try {
        const value = JSON.parse(raw) as Record<string, string>;
        return value && typeof value === 'object' ? value : {};
      } catch {
        return {};
      }
    },
    saveCloudPathMap(): void {
      localStorage.setItem(
        CLOUD_PATH_MAP_KEY,
        JSON.stringify(this.cloudCompanyPaths)
      );
    },
    async refreshCloudCompanies(): Promise<void> {
      this.cloudLoading = true;
      try {
        const session = await getValidSession();
        if (!session) {
          this.cloudSession = null;
          this.cloudUserEmail = '';
          this.activeScreen = Screen.Auth;
          return;
        }
        this.cloudSession = session;
        this.cloudUserEmail = session.user.email || '';
        this.cloudCompanies = await listCompanies();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast({ message, type: 'error' });
      } finally {
        this.cloudLoading = false;
      }
    },
    async leaveLocalWorkspace(): Promise<void> {
      localStorage.removeItem('lastRoute');
      this.stopCloudBackupSchedule();
      await stopCloudSync();
      try {
        await fyo.purgeCache();
      } catch {
        // There may be no local database loaded yet.
      }
      this.dbPath = '';
      this.companyName = '';
      this.searcher = null;
    },
    async showCloudHome(clearLocalWorkspace = true): Promise<void> {
      if (clearLocalWorkspace) {
        await this.leaveLocalWorkspace();
      }
      this.pendingCloudImport = false;
      this.cloudCompanyPaths = this.loadCloudPathMap();
      this.activeScreen = Screen.CloudHome;
      await this.refreshCloudCompanies();
    },
    importLocalCompany(): void {
      this.pendingCloudImport = true;
      this.activeScreen = Screen.DatabaseSelector;
    },
    async openCloudCompany(companyId: string): Promise<void> {
      const filePath = this.cloudCompanyPaths[companyId];
      if (filePath) {
        this.pendingCloudImport = false;
        await this.fileSelected(filePath);
        return;
      }

      const company = this.cloudCompanies.find((entry) => entry.id === companyId);
      if (!company) {
        showToast({ message: 'Company could not be found in ArthivoX Cloud.', type: 'error' });
        return;
      }

      this.showBusyOverlay = true;
      this.busyMessage = '';
      try {
        const restored = await restoreLatestCloudBackup(companyId, company.name);
        this.cloudCompanyPaths = {
          ...this.cloudCompanyPaths,
          [companyId]: restored.filePath,
        };
        this.saveCloudPathMap();
        showToast({ message: 'Company restored from ArthivoX Cloud', type: 'success' });
        this.pendingCloudImport = false;
        await this.fileSelected(restored.filePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await showDialog({
          title: this.t`Cloud restore unavailable`,
          type: 'error',
          detail: message,
        });
      } finally {
        this.showBusyOverlay = false;
        this.busyMessage = '';
      }
    },
    async logoutCloud(): Promise<void> {
      this.showBusyOverlay = true;
      try {
        await this.leaveLocalWorkspace();
        clearUnlockedBackupPassphrases();
        await signOutCloud();
        this.cloudSession = null;
        this.cloudUserEmail = '';
        this.cloudCompanies = [];
        this.activeScreen = Screen.Auth;
      } finally {
        this.showBusyOverlay = false;
      }
    },
    getCloudCompanyIdForPath(filePath: string): string | null {
      const entry = Object.entries(this.cloudCompanyPaths).find(
        ([, path]) => path === filePath
      );
      return entry?.[0] || null;
    },
    async startCloudSyncForCompany(companyId: string): Promise<void> {
      try {
        await startCloudSync(fyo, companyId);
        this.startCloudBackupSchedule(companyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast({
          message: `Cloud sync could not start: ${message}`,
          type: 'error',
        });
      }
    },
    requestManualCloudBackup(): void {
      void this.backupCurrentCompany(true);
    },
    stopCloudBackupSchedule(): void {
      if (this.cloudBackupStartupTimer !== null) {
        window.clearTimeout(this.cloudBackupStartupTimer);
        this.cloudBackupStartupTimer = null;
      }
      if (this.cloudBackupTimer !== null) {
        window.clearInterval(this.cloudBackupTimer);
        this.cloudBackupTimer = null;
      }
    },
    startCloudBackupSchedule(companyId: string): void {
      this.stopCloudBackupSchedule();
      this.cloudBackupStartupTimer = window.setTimeout(() => {
        this.cloudBackupStartupTimer = null;
        void this.backupCurrentCompany(false, companyId);
      }, 8000);
      this.cloudBackupTimer = window.setInterval(() => {
        void this.backupCurrentCompany(false, companyId);
      }, 6 * 60 * 60 * 1000);
    },
    async backupCurrentCompany(
      force = false,
      expectedCompanyId?: string
    ): Promise<void> {
      if (this.cloudBackupRunning || !this.dbPath) {
        return;
      }

      const companyId = this.getCloudCompanyIdForPath(this.dbPath);
      if (!companyId || (expectedCompanyId && expectedCompanyId !== companyId)) {
        return;
      }

      if (!navigator.onLine) {
        if (force) {
          showToast({ message: 'Connect to the internet before backing up.', type: 'error' });
        }
        return;
      }

      const lastBackupKey = `arthivox-last-cloud-backup-v1:${companyId}`;
      const lastBackupAt = Number(localStorage.getItem(lastBackupKey) || 0) || 0;
      const autoBackupAge = 12 * 60 * 60 * 1000;
      if (!force && lastBackupAt && Date.now() - lastBackupAt < autoBackupAge) {
        return;
      }

      this.cloudBackupRunning = true;
      try {
        const backup = await createCloudBackup(fyo, companyId, {
          interactive: force,
        });
        localStorage.setItem(lastBackupKey, String(Date.now()));
        if (force) {
          const sizeMb = backup.size_bytes
            ? (Number(backup.size_bytes) / (1024 * 1024)).toFixed(1)
            : '?';
          showToast({
            message: `Cloud backup completed (${sizeMb} MB)`,
            type: 'success',
          });
        }
      } catch (error) {
        if (force) {
          const message = error instanceof Error ? error.message : String(error);
          showToast({ message: `Cloud backup failed: ${message}`, type: 'error' });
        }
      } finally {
        this.cloudBackupRunning = false;
      }
    },
    async registerCompanyInCloud(
      filePath: string,
      companyName: string,
      currency?: string | null
    ): Promise<void> {
      if (!filePath || !companyName) {
        return;
      }

      const existing = Object.entries(this.cloudCompanyPaths).find(
        ([, path]) => path === filePath
      );
      if (existing) {
        return;
      }

      try {
        const company = await createCloudCompany({
          name: companyName,
          currency: currency || null,
        });
        this.cloudCompanyPaths = {
          ...this.cloudCompanyPaths,
          [company.id]: filePath,
        };
        this.saveCloudPathMap();
        await this.refreshCloudCompanies();
        showToast({ message: 'Company connected to ArthivoX Cloud', type: 'success' });
        void this.startCloudSyncForCompany(company.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast({
          message: `Local company is ready. Cloud link pending: ${message}`,
          type: 'error',
        });
      }
    },
    async registerCurrentCompanyInCloud(filePath: string): Promise<void> {
      const companyName = (await fyo.getValue(
        ModelNameEnum.AccountingSettings,
        'companyName'
      )) as string;
      const currency = (await fyo.getValue(
        ModelNameEnum.SystemSettings,
        'currency'
      )) as string;
      await this.registerCompanyInCloud(filePath, companyName, currency);
    },
    async setSearcher(): Promise<void> {
      this.searcher = new Search(fyo);
      await this.searcher.initializeKeywords();
    },
    async setDesk(filePath: string): Promise<void> {
      await setLanguageMap();
      this.activeScreen = Screen.Desk;
      await this.setDeskRoute();

      // ArthivoX uses its own release identity. Automatic update checks are
      // intentionally disabled until an ArthivoX release channel is configured.

      this.dbPath = filePath;
      this.companyName = (await fyo.getValue(
        ModelNameEnum.AccountingSettings,
        'companyName'
      )) as string;
      await this.setSearcher();
      updateConfigFiles(fyo);

      const cloudCompanyId = this.getCloudCompanyIdForPath(filePath);
      if (cloudCompanyId) {
        void this.startCloudSyncForCompany(cloudCompanyId);
      }
    },
    newDatabase() {
      this.pendingCloudImport = false;
      this.activeScreen = Screen.SetupWizard;
    },
    async fileSelected(filePath: string): Promise<void> {
      const manageBusyOverlay = !this.showStartupBranding;
      if (manageBusyOverlay) {
        this.busyMessage = '';
        this.showBusyOverlay = true;
      }

      try {
        fyo.config.set('lastSelectedFilePath', filePath);
        if (filePath !== ':memory:' && !(await ipc.checkDbAccess(filePath))) {
          this.showBusyOverlay = false;
          this.busyMessage = '';
          await showDialog({
            title: this.t`Cannot open file`,
            type: 'error',
            detail: this
              .t`ArthivoX does not have access to the selected file: ${filePath}`,
          });

          fyo.config.set('lastSelectedFilePath', null);
          return;
        }

        try {
          await this.showSetupWizardOrDesk(filePath);
          if (this.pendingCloudImport && this.activeScreen === Screen.Desk) {
            this.pendingCloudImport = false;
            await this.registerCurrentCompanyInCloud(filePath);
          }
        } catch (error) {
          this.showBusyOverlay = false;
          this.busyMessage = '';
          await handleErrorWithDialog(error, undefined, true, true);
          await this.showDbSelector();
        }
      } finally {
        if (manageBusyOverlay) {
          this.showBusyOverlay = false;
          this.busyMessage = '';
        }
      }
    },
    async setupComplete(setupWizardOptions: SetupWizardOptions): Promise<void> {
      this.busyMessage = '';
      this.showBusyOverlay = true;
      try {
        const companyName = setupWizardOptions.companyName;
        const filePath = await ipc.getDbDefaultPath(companyName);
        await setupInstance(filePath, setupWizardOptions, fyo);
        fyo.config.set('lastSelectedFilePath', filePath);
        await this.setDesk(filePath);
        await this.registerCompanyInCloud(
          filePath,
          companyName,
          setupWizardOptions.currency
        );
      } finally {
        this.showBusyOverlay = false;
        this.busyMessage = '';
      }
    },
    async showSetupWizardOrDesk(filePath: string): Promise<void> {
      const { countryCode, error, actionSymbol } = await connectToDatabase(
        this.fyo,
        filePath
      );

      if (!countryCode && error && actionSymbol) {
        return await this.handleConnectionFailed(error, actionSymbol);
      }

      const setupComplete = await fyo.getValue(
        ModelNameEnum.AccountingSettings,
        'setupComplete'
      );

      if (!setupComplete) {
        this.activeScreen = Screen.SetupWizard;
        return;
      }

      await initializeInstance(filePath, false, countryCode, fyo);
      await updatePrintTemplates(fyo);

      // Legacy ERPNext schema is retained only for database compatibility.
      // ArthivoX Cloud is the supported synchronization layer.
      if (fyo.singles.ERPNextSyncSettings) {
        fyo.singles.ERPNextSyncSettings.isEnabled = false;
      }

      await this.setDesk(filePath);
    },
    async handleConnectionFailed(error: Error, actionSymbol: symbol) {
      await this.showDbSelector();

      if (actionSymbol === dbErrorActionSymbols.CancelSelection) {
        return;
      }

      if (actionSymbol === dbErrorActionSymbols.SelectFile) {
        await this.databaseSelector?.existingDatabase();
        return;
      }

      throw error;
    },
    async setDeskRoute(): Promise<void> {
      const { onboardingComplete } = await fyo.doc.getDoc('GetStarted');
      const { hideGetStarted } = await fyo.doc.getDoc('SystemSettings');

      let route = '/get-started';
      if (hideGetStarted || onboardingComplete) {
        route = localStorage.getItem('lastRoute') || '/';
      }

      await routeTo(route);
    },
    async showDbSelector(): Promise<void> {
      localStorage.removeItem('lastRoute');
      fyo.config.set('lastSelectedFilePath', null);
      await fyo.purgeCache();
      this.activeScreen = Screen.DatabaseSelector;
      this.dbPath = '';
      this.searcher = null;
      this.companyName = '';
    },
  },
});

function getLanguageDirection(language: string): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}
</script>
