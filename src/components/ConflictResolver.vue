<template>
  <div
    v-if="open && conflict"
    class="ax12-conflict-overlay window-no-drag"
    @click.self="open = false"
  >
    <section class="ax12-conflict-card" role="dialog" aria-modal="true">
      <header class="ax12-conflict-header">
        <div>
          <p class="ax12-eyebrow">Sync conflict</p>
          <h2>Choose which version should win</h2>
          <p>
            {{ conflict.entityType }} <strong>{{ conflict.entityId }}</strong>
            was changed in two places. ArthivoX has preserved both versions.
          </p>
        </div>
        <button class="ax12-close" title="Review later" @click="open = false">
          <feather-icon name="x" class="w-4 h-4" />
        </button>
      </header>

      <div v-if="conflict.protectedRecord" class="ax12-protected">
        <feather-icon name="lock" class="w-4 h-4" />
        <span>
          This is protected/submitted accounting data. ArthivoX will not replace
          the local accounting document automatically. You can make this
          computer the cloud winner, or review the record manually.
        </span>
      </div>

      <div class="ax12-conflict-body">
        <div class="ax12-version-head local">
          <span>This computer</span>
          <small>{{ conflict.localDeleted ? 'Deleted locally' : 'Local copy' }}</small>
        </div>
        <div class="ax12-version-head cloud">
          <span>Cloud</span>
          <small>Revision {{ conflict.cloudRevision }}</small>
        </div>

        <div
          v-for="row in differences"
          :key="row.field"
          class="ax12-diff-row"
        >
          <div class="ax12-field-name">{{ row.field }}</div>
          <div class="ax12-diff-value">{{ row.local }}</div>
          <div class="ax12-diff-value">{{ row.cloud }}</div>
        </div>

        <div v-if="!differences.length" class="ax12-no-diff">
          The payloads are structurally similar, but their cloud revisions do not
          match. Choose the version you want ArthivoX to keep.
        </div>

        <p v-if="errorMessage" class="ax12-conflict-error">
          <feather-icon name="alert-circle" class="w-4 h-4" />
          <span>{{ errorMessage }}</span>
        </p>
      </div>

      <footer class="ax12-conflict-actions">
        <button class="ax12-btn ghost" :disabled="busy" @click="open = false">
          Review later
        </button>
        <button
          class="ax12-btn cloud"
          :disabled="busy || conflict.protectedRecord"
          :title="
            conflict.protectedRecord
              ? 'Protected accounting documents cannot be replaced automatically'
              : 'Replace the editable local copy with the cloud version'
          "
          @click="resolve('cloud')"
        >
          Use cloud copy
        </button>
        <button class="ax12-btn local" :disabled="busy" @click="resolve('local')">
          <span v-if="busy" class="ax12-mini-spinner"></span>
          Use this computer
        </button>
      </footer>
    </section>
  </div>
</template>

<script lang="ts">
import {
  ARTHIVOX_OPEN_CONFLICT_EVENT,
  ARTHIVOX_SYNC_CONFLICT_EVENT,
  getCurrentSyncConflict,
  resolveCloudConflict,
  type ArthivoXSyncConflict,
} from 'src/cloud/sync';
import { defineComponent } from 'vue';

interface DifferenceRow {
  field: string;
  local: string;
  cloud: string;
}

function readable(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'Empty';
  if (Array.isArray(value)) return `${value.length} row${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'Changed details';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function stable(value: unknown): string {
  try {
    if (value && typeof value === 'object') {
      return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
    }
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default defineComponent({
  name: 'ConflictResolver',
  data() {
    return {
      open: false,
      conflict: getCurrentSyncConflict(),
      busy: false,
      errorMessage: '',
    } as {
      open: boolean;
      conflict: ArthivoXSyncConflict | null;
      busy: boolean;
      errorMessage: string;
    };
  },
  computed: {
    differences(): DifferenceRow[] {
      if (!this.conflict) return [];
      if (this.conflict.localDeleted || this.conflict.cloudDeleted) {
        return [
          {
            field: 'Record state',
            local: this.conflict.localDeleted ? 'Deleted' : 'Present',
            cloud: this.conflict.cloudDeleted ? 'Deleted' : 'Present',
          },
        ];
      }

      const local = this.conflict.localPayload || {};
      const cloud = this.conflict.cloudPayload || {};
      const ignored = new Set(['created', 'createdBy', 'modified', 'modifiedBy']);
      const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(cloud)]))
        .filter((key) => !ignored.has(key))
        .sort();

      const rows: DifferenceRow[] = [];
      for (const key of keys) {
        if (stable(local[key]) === stable(cloud[key])) continue;
        rows.push({
          field: key,
          local: readable(local[key]),
          cloud: readable(cloud[key]),
        });
        if (rows.length >= 14) break;
      }
      return rows;
    },
  },
  mounted() {
    window.addEventListener(
      ARTHIVOX_SYNC_CONFLICT_EVENT,
      this.handleConflict as EventListener
    );
    window.addEventListener(
      ARTHIVOX_OPEN_CONFLICT_EVENT,
      this.openCurrent as EventListener
    );
    if (this.conflict) this.open = true;
  },
  beforeUnmount() {
    window.removeEventListener(
      ARTHIVOX_SYNC_CONFLICT_EVENT,
      this.handleConflict as EventListener
    );
    window.removeEventListener(
      ARTHIVOX_OPEN_CONFLICT_EVENT,
      this.openCurrent as EventListener
    );
  },
  methods: {
    handleConflict(event: Event) {
      const detail = (event as CustomEvent<ArthivoXSyncConflict | null>).detail;
      this.conflict = detail || getCurrentSyncConflict();
      this.errorMessage = '';
      if (this.conflict) this.open = true;
    },
    openCurrent() {
      this.conflict = getCurrentSyncConflict();
      if (this.conflict) {
        this.errorMessage = '';
        this.open = true;
      }
    },
    async resolve(strategy: 'local' | 'cloud') {
      if (!this.conflict || this.busy) return;
      this.busy = true;
      this.errorMessage = '';
      try {
        await resolveCloudConflict(strategy);
        this.conflict = getCurrentSyncConflict();
        if (!this.conflict) this.open = false;
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : String(error);
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

<style scoped>
.ax12-conflict-overlay {
  position: fixed;
  inset: 0;
  z-index: 115;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 10, 24, .68);
  backdrop-filter: blur(10px);
}
.ax12-conflict-card {
  width: min(760px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(148,163,184,.2);
  border-radius: 18px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 28px 80px rgba(2,8,23,.34);
}
:global(.dark) .ax12-conflict-card {
  background: #111c30;
  color: #f8fafc;
}
.ax12-conflict-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(148,163,184,.16);
}
.ax12-eyebrow {
  margin: 0 0 4px;
  color: #ef4444;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.ax12-conflict-header h2 { margin: 0; font-size: 20px; font-weight: 700; }
.ax12-conflict-header p {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.ax12-close { flex: 0 0 32px; height: 32px; color: #64748b; }
.ax12-protected {
  display: flex;
  gap: 9px;
  margin: 14px 24px 0;
  padding: 11px 12px;
  border-radius: 10px;
  background: rgba(245,158,11,.1);
  color: #a16207;
  font-size: 12px;
  line-height: 1.5;
}
:global(.dark) .ax12-protected { color: #f7c65f; }
.ax12-conflict-body {
  min-height: 0;
  overflow: auto;
  padding: 18px 24px;
}
.ax12-version-head {
  display: inline-grid;
  width: calc((100% - 145px) / 2);
  margin-left: 145px;
  padding: 0 10px 10px;
}
.ax12-version-head.cloud { margin-left: 0; }
.ax12-version-head span { font-size: 12px; font-weight: 750; }
.ax12-version-head small { color: #64748b; font-size: 10px; margin-top: 2px; }
.ax12-diff-row {
  display: grid;
  grid-template-columns: 145px minmax(0,1fr) minmax(0,1fr);
  border-top: 1px solid rgba(148,163,184,.14);
}
.ax12-field-name, .ax12-diff-value {
  min-width: 0;
  padding: 10px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ax12-field-name { color: #64748b; font-weight: 650; }
.ax12-diff-value:nth-child(2) { background: rgba(20,184,166,.045); }
.ax12-diff-value:nth-child(3) { background: rgba(56,189,248,.045); }
.ax12-no-diff {
  padding: 16px;
  border: 1px dashed rgba(148,163,184,.24);
  border-radius: 10px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.ax12-conflict-error {
  display: flex;
  gap: 8px;
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(239,68,68,.09);
  color: #dc2626;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ax12-conflict-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
  border-top: 1px solid rgba(148,163,184,.16);
}
.ax12-btn {
  height: 38px;
  padding: 0 15px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 650;
}
.ax12-btn.ghost { color: #64748b; }
.ax12-btn.cloud {
  border: 1px solid #cbd5e1;
  color: #334155;
}
:global(.dark) .ax12-btn.cloud {
  border-color: #31405a;
  color: #dbe5f3;
}
.ax12-btn.local {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #0f9f93;
  color: #fff;
}
.ax12-btn:disabled { opacity: .42; cursor: not-allowed; }
.ax12-mini-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,.35);
  border-top-color: white;
  border-radius: 50%;
  animation: ax12spin .75s linear infinite;
}
@keyframes ax12spin { to { transform: rotate(360deg); } }
@media (max-width: 700px) {
  .ax12-version-head { display: none; }
  .ax12-diff-row { grid-template-columns: 1fr; }
  .ax12-field-name { padding-bottom: 3px; }
  .ax12-diff-value { border-radius: 7px; margin-bottom: 4px; }
  .ax12-conflict-actions { flex-wrap: wrap; }
}
</style>
