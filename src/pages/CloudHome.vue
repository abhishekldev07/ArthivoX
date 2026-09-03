<template>
  <main class="ax8-cloud" :class="{ 'ax-system-dark': systemDark }">
    <header class="ax8-cloud-bar">
      <div class="ax8-cloud-lockup">
        <span class="ax8-cloud-mark">
          <img :src="arthivoxSymbol" alt="" />
        </span>
        <div>
          <strong>Arthivo<span>X</span></strong>
          <small>Cloud workspace</small>
        </div>
      </div>

      <div class="ax8-cloud-account">
        <span class="ax8-cloud-avatar">{{ userInitial }}</span>
        <div class="ax8-cloud-account-copy">
          <small>Signed in as</small>
          <strong>{{ email }}</strong>
        </div>
        <button class="ax8-icon-button" type="button" title="Sign out" @click="$emit('logout')">
          <feather-icon name="log-out" class="w-4 h-4" />
        </button>
      </div>
    </header>

    <section class="ax8-cloud-page">
      <div class="ax8-cloud-hero">
        <div class="ax8-cloud-hero-copy">
          <span class="ax8-cloud-eyebrow">COMPANIES</span>
          <h1>Your ArthivoX workspaces</h1>
          <p>
            Open a company already linked to this account, create a new one, or connect an
            existing local database.
          </p>
        </div>

        <div class="ax8-cloud-actions">
          <button class="ax8-cloud-secondary" type="button" @click="$emit('import-local')">
            <feather-icon name="upload-cloud" class="w-4 h-4" />
            <span>Connect local</span>
          </button>
          <button class="ax8-cloud-primary" type="button" @click="$emit('create-company')">
            <feather-icon name="plus" class="w-4 h-4" />
            <span>New company</span>
          </button>
        </div>
      </div>

      <div class="ax8-cloud-toolbar">
        <div>
          <strong>{{ companies.length ? `${companies.length} ${companies.length === 1 ? 'company' : 'companies'}` : 'No companies yet' }}</strong>
          <small>{{ companies.length ? 'Available to this account' : 'Create or connect your first workspace' }}</small>
        </div>
        <button class="ax8-cloud-refresh" type="button" :disabled="loading" @click="$emit('refresh')">
          <feather-icon name="refresh-cw" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
          <span>Refresh</span>
        </button>
      </div>

      <div v-if="loading && !companies.length" class="ax8-cloud-loading">
        <span class="ax8-cloud-spinner"></span>
      </div>

      <div v-else-if="companies.length" class="ax8-company-grid">
        <article v-for="company in companies" :key="company.id" class="ax8-company-card">
          <div class="ax8-company-card-top">
            <span class="ax8-company-logo">{{ company.name.trim().charAt(0).toUpperCase() }}</span>
            <span class="ax8-company-state" :class="hasLocalPath(company.id) ? 'is-ready' : 'is-cloud'">
              <i></i>
              {{ hasLocalPath(company.id) ? 'Ready on this PC' : 'Cloud only' }}
            </span>
          </div>

          <div class="ax8-company-main">
            <h2>{{ company.name }}</h2>
            <p>
              <span v-if="company.currency">{{ company.currency }}</span>
              <span v-if="company.currency && company.country_code" class="ax8-separator">•</span>
              <span v-if="company.country_code">{{ company.country_code }}</span>
              <span v-if="!company.currency && !company.country_code">Company workspace</span>
            </p>
          </div>

          <div class="ax8-company-footer">
            <small>Updated {{ formatDate(company.updated_at) }}</small>
            <button type="button" @click="$emit('open-company', company.id)">
              <span>{{ hasLocalPath(company.id) ? 'Open workspace' : 'Restore locally' }}</span>
              <feather-icon name="arrow-up-right" class="w-4 h-4" />
            </button>
          </div>
        </article>
      </div>

      <section v-else class="ax8-cloud-empty">
        <div class="ax8-cloud-empty-icon">
          <feather-icon name="briefcase" class="w-6 h-6" />
        </div>
        <span class="ax8-cloud-eyebrow">GET STARTED</span>
        <h2>No companies connected yet</h2>
        <p>
          Start a new accounting workspace or attach an existing ArthivoX database from this computer.
        </p>
        <div>
          <button class="ax8-cloud-primary" type="button" @click="$emit('create-company')">
            <feather-icon name="plus" class="w-4 h-4" />
            <span>Create company</span>
          </button>
          <button class="ax8-cloud-secondary" type="button" @click="$emit('import-local')">
            <feather-icon name="folder-plus" class="w-4 h-4" />
            <span>Connect existing</span>
          </button>
        </div>
      </section>
    </section>
  </main>
</template>

<script lang="ts">
import { ARTHIVOX_SYMBOL_DATA_URL } from 'src/assets/brand/embeddedBrand';
import type { ArthivoXCloudCompany } from '../cloud/supabase';
import { defineComponent, PropType } from 'vue';

export default defineComponent({
  name: 'CloudHome',
  props: {
    email: { type: String, default: '' },
    companies: {
      type: Array as PropType<ArthivoXCloudCompany[]>,
      default: () => [],
    },
    localPaths: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
    loading: { type: Boolean, default: false },
  },
  emits: ['create-company', 'import-local', 'open-company', 'logout', 'refresh'],
  data() {
    return {
      arthivoxSymbol: ARTHIVOX_SYMBOL_DATA_URL,
      systemDark: false,
      systemThemeMedia: null as MediaQueryList | null,
    };
  },
  mounted() {
    this.systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemDark = this.systemThemeMedia.matches;
    this.systemThemeMedia.addEventListener?.('change', this.handleSystemThemeChange);
  },
  beforeUnmount() {
    this.systemThemeMedia?.removeEventListener?.('change', this.handleSystemThemeChange);
  },
  computed: {
    userInitial(): string {
      return (this.email || 'A').trim().charAt(0).toUpperCase();
    },
  },
  methods: {
    handleSystemThemeChange(event: MediaQueryListEvent) {
      this.systemDark = event.matches;
    },
    hasLocalPath(companyId: string): boolean {
      return !!this.localPaths[companyId];
    },
    formatDate(value: string): string {
      if (!value) {
        return 'recently';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return 'recently';
      }
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    },
  },
});
</script>

<style scoped>
.ax8-cloud {
  --axc-bg: #f4f7fb;
  --axc-surface: #ffffff;
  --axc-surface-2: #f8fafc;
  --axc-border: #e3e9f0;
  --axc-text: #142033;
  --axc-muted: #68778b;
  --axc-muted-2: #8b99ab;
  --axc-teal: #14b8a6;
  --axc-teal-dark: #0f8f82;

  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--axc-bg);
  color: var(--axc-text);
}

.ax8-cloud.ax-system-dark {
  --axc-bg: #07111f;
  --axc-surface: #0d1b2e;
  --axc-surface-2: #0a1728;
  --axc-border: #21364e;
  --axc-text: #eff5fb;
  --axc-muted: #9aa9bc;
  --axc-muted-2: #71849a;
}

.ax8-cloud,
.ax8-cloud * { box-sizing: border-box; }
.ax8-cloud button { border: 0; font: inherit; cursor: pointer; }
.ax8-cloud button:disabled { cursor: default; opacity: .55; }

.ax8-cloud-bar {
  min-width: 0;
  min-height: 70px;
  flex: 0 0 70px;
  padding: 0 clamp(24px, 4vw, 54px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid var(--axc-border);
  background: var(--axc-surface);
}

.ax8-cloud-lockup,
.ax8-cloud-account,
.ax8-cloud-actions,
.ax8-company-card-top,
.ax8-company-footer,
.ax8-cloud-toolbar,
.ax8-cloud-empty > div:last-child {
  display: flex;
  align-items: center;
}

.ax8-cloud-lockup { gap: 11px; min-width: 0; }

.ax8-cloud-mark {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 11px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e4e9f0;
  box-shadow: 0 6px 17px rgba(12,31,55,.08);
}

.ax8-cloud-mark img { width: 29px; height: 29px; object-fit: contain; }

.ax8-cloud-lockup > div { min-width: 0; display: grid; gap: 2px; }
.ax8-cloud-lockup strong { color: var(--axc-text); font-size: 13px; line-height: 1.2; white-space: nowrap; }
.ax8-cloud-lockup strong span { color: var(--axc-teal); }
.ax8-cloud-lockup small { color: var(--axc-muted); font-size: 9px; line-height: 1.2; }

.ax8-cloud-account {
  min-width: 0;
  gap: 10px;
  padding: 6px 7px 6px 8px;
  border: 1px solid var(--axc-border);
  border-radius: 12px;
  background: var(--axc-surface-2);
}

.ax8-cloud-avatar {
  width: 31px;
  height: 31px;
  flex: 0 0 31px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #0f8f82, #20c4b1);
  font-size: 11px;
  font-weight: 750;
}

.ax8-cloud-account-copy { min-width: 0; display: grid; gap: 1px; max-width: 230px; }
.ax8-cloud-account-copy small { color: var(--axc-muted); font-size: 8px; }
.ax8-cloud-account-copy strong { min-width: 0; color: var(--axc-text); font-size: 10px; font-weight: 620; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ax8-icon-button {
  width: 31px;
  height: 31px;
  flex: 0 0 31px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--axc-muted);
  background: transparent;
}
.ax8-icon-button:hover { color: #ef4444; background: rgba(239,68,68,.08); }

.ax8-cloud-page {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: clamp(34px, 5vh, 54px) clamp(28px, 5vw, 72px) 56px;
}

.ax8-cloud-page > * { width: min(100%, 1160px); margin-left: auto; margin-right: auto; }

.ax8-cloud-hero {
  min-width: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 34px;
}

.ax8-cloud-hero-copy { min-width: 0; max-width: 620px; }
.ax8-cloud-eyebrow { color: var(--axc-teal-dark); font-size: 9px; font-weight: 800; letter-spacing: .16em; }
.ax8-cloud.ax-system-dark .ax8-cloud-eyebrow { color: #5eead4; }
.ax8-cloud-hero h1 { margin: 8px 0 0; color: var(--axc-text); font-size: clamp(28px, 3vw, 40px); line-height: 1.13; letter-spacing: -.035em; font-weight: 740; overflow-wrap: anywhere; }
.ax8-cloud-hero p { margin: 11px 0 0; max-width: 590px; color: var(--axc-muted); font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; }

.ax8-cloud-actions { flex: 0 0 auto; gap: 9px; }
.ax8-cloud-primary,
.ax8-cloud-secondary,
.ax8-cloud-refresh,
.ax8-company-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 680;
  transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
}
.ax8-cloud-primary { height: 40px; padding: 0 15px; color: #fff; background: linear-gradient(135deg,#0f8f82,#14b8a6); box-shadow: 0 7px 20px rgba(20,184,166,.18); }
.ax8-cloud-primary:hover { transform: translateY(-1px); }
.ax8-cloud-secondary { height: 40px; padding: 0 14px; color: var(--axc-text); background: var(--axc-surface); border: 1px solid var(--axc-border) !important; }
.ax8-cloud-secondary:hover { border-color: rgba(20,184,166,.45) !important; }

.ax8-cloud-toolbar {
  min-width: 0;
  margin-top: 42px;
  padding: 0 0 13px;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid var(--axc-border);
}
.ax8-cloud-toolbar > div { min-width: 0; display: grid; gap: 3px; }
.ax8-cloud-toolbar strong { color: var(--axc-text); font-size: 12px; }
.ax8-cloud-toolbar small { color: var(--axc-muted); font-size: 9px; }
.ax8-cloud-refresh { height: 32px; padding: 0 10px; color: var(--axc-muted); background: transparent; }
.ax8-cloud-refresh:hover { color: var(--axc-teal-dark); background: rgba(20,184,166,.07); }

.ax8-cloud-loading { min-height: 260px; display: flex; align-items: center; justify-content: center; }
.ax8-cloud-spinner { width: 26px; height: 26px; border: 2px solid rgba(20,184,166,.18); border-top-color: var(--axc-teal); border-radius: 999px; animation: ax8-cloud-spin 720ms linear infinite; }
@keyframes ax8-cloud-spin { to { transform: rotate(360deg); } }

.ax8-company-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 14px;
  margin-top: 18px;
}

.ax8-company-card {
  min-width: 0;
  min-height: 205px;
  padding: 17px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--axc-border);
  border-radius: 15px;
  background: var(--axc-surface);
  box-shadow: 0 8px 24px rgba(18,35,58,.035);
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
.ax8-company-card:hover { transform: translateY(-2px); border-color: rgba(20,184,166,.30); box-shadow: 0 13px 30px rgba(18,35,58,.07); }
.ax8-company-card-top { min-width: 0; justify-content: space-between; gap: 12px; }
.ax8-company-logo { width: 38px; height: 38px; flex: 0 0 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: linear-gradient(145deg,#143b6c,#0f8f82); font-size: 14px; font-weight: 760; }
.ax8-company-state { min-width: 0; max-width: 160px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 999px; font-size: 8px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ax8-company-state i { width: 5px; height: 5px; flex: 0 0 5px; border-radius: 999px; }
.ax8-company-state.is-ready { color: #0f766e; background: rgba(20,184,166,.09); }
.ax8-company-state.is-ready i { background: #14b8a6; }
.ax8-company-state.is-cloud { color: #526274; background: rgba(100,116,139,.08); }
.ax8-company-state.is-cloud i { background: #94a3b8; }
.ax8-cloud.ax-system-dark .ax8-company-state.is-ready { color: #7af0df; }
.ax8-cloud.ax-system-dark .ax8-company-state.is-cloud { color: #a3b1c2; }

.ax8-company-main { min-width: 0; margin-top: 22px; }
.ax8-company-main h2 { margin: 0; color: var(--axc-text); font-size: 16px; line-height: 1.25; font-weight: 700; overflow-wrap: anywhere; }
.ax8-company-main p { min-width: 0; margin: 7px 0 0; color: var(--axc-muted); font-size: 10px; line-height: 1.4; overflow-wrap: anywhere; }
.ax8-separator { margin: 0 5px; color: var(--axc-muted-2); }

.ax8-company-footer { min-width: 0; margin-top: auto; padding-top: 18px; justify-content: space-between; gap: 12px; border-top: 1px solid var(--axc-border); }
.ax8-company-footer small { min-width: 0; color: var(--axc-muted-2); font-size: 8px; overflow-wrap: anywhere; }
.ax8-company-footer button { flex: 0 0 auto; padding: 6px 7px; color: var(--axc-teal-dark); background: transparent; }
.ax8-cloud.ax-system-dark .ax8-company-footer button { color: #5eead4; }
.ax8-company-footer button:hover { background: rgba(20,184,166,.07); }

.ax8-cloud-empty {
  min-width: 0;
  min-height: 310px;
  margin-top: 18px;
  padding: 48px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px dashed var(--axc-border);
  border-radius: 17px;
  background: linear-gradient(145deg, var(--axc-surface), var(--axc-surface-2));
}
.ax8-cloud-empty-icon { width: 48px; height: 48px; margin-bottom: 16px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: var(--axc-teal-dark); background: rgba(20,184,166,.09); }
.ax8-cloud-empty h2 { margin: 7px 0 0; color: var(--axc-text); font-size: 19px; line-height: 1.25; font-weight: 700; }
.ax8-cloud-empty p { max-width: 490px; margin: 9px 0 0; color: var(--axc-muted); font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.ax8-cloud-empty > div:last-child { margin-top: 22px; justify-content: center; flex-wrap: wrap; gap: 9px; }

@media (max-width: 960px) {
  .ax8-company-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}

@media (max-width: 720px) {
  .ax8-cloud-account-copy { display: none; }
  .ax8-cloud-hero { align-items: stretch; flex-direction: column; }
  .ax8-cloud-actions { align-self: flex-start; }
}

@media (max-width: 560px) {
  .ax8-company-grid { grid-template-columns: 1fr; }
  .ax8-cloud-page { padding-left: 20px; padding-right: 20px; }
  .ax8-cloud-actions { width: 100%; flex-direction: column-reverse; align-items: stretch; }
  .ax8-cloud-primary, .ax8-cloud-secondary { width: 100%; }
}
</style>
