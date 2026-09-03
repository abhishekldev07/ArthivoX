<template>
  <div
    v-if="open"
    class="ax12-security-overlay window-no-drag"
    @click.self="cancel"
  >
    <section class="ax12-security-card" role="dialog" aria-modal="true">
      <header class="ax12-security-header">
        <div class="ax12-security-icon">
          <feather-icon name="shield" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <p class="ax12-eyebrow">Encrypted backup</p>
          <h2>{{ request?.title }}</h2>
          <p>{{ request?.message }}</p>
        </div>
      </header>

      <div class="ax12-security-body">
        <label class="ax12-field">
          <span>Recovery passphrase</span>
          <div class="ax12-input-wrap">
            <input
              ref="passphraseInput"
              v-model="passphrase"
              :type="showPassphrase ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              placeholder="Enter recovery passphrase"
              @keyup.enter="submit"
            />
            <button
              type="button"
              class="ax12-eye"
              :title="showPassphrase ? 'Hide passphrase' : 'Show passphrase'"
              @click="showPassphrase = !showPassphrase"
            >
              <feather-icon :name="showPassphrase ? 'eye-off' : 'eye'" class="w-4 h-4" />
            </button>
          </div>
        </label>

        <label v-if="request?.confirm" class="ax12-field">
          <span>Confirm passphrase</span>
          <input
            v-model="confirmation"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="Type it again"
            @keyup.enter="submit"
          />
        </label>

        <div v-if="request?.mode === 'create'" class="ax12-warning">
          <feather-icon name="key" class="w-4 h-4" />
          <p>
            Store this somewhere safe. ArthivoX and Supabase do not receive this
            passphrase, so an encrypted backup cannot be restored without it.
          </p>
        </div>

        <p v-if="errorMessage" class="ax12-error">
          <feather-icon name="alert-circle" class="w-4 h-4" />
          <span>{{ errorMessage }}</span>
        </p>
      </div>

      <footer class="ax12-security-actions">
        <button class="ax12-btn secondary" :disabled="busy" @click="cancel">
          Cancel
        </button>
        <button class="ax12-btn primary" :disabled="busy" @click="submit">
          <span v-if="busy" class="ax12-mini-spinner"></span>
          {{ request?.mode === 'create' ? 'Enable encrypted backups' : 'Unlock' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script lang="ts">
import {
  ARTHIVOX_BACKUP_PASSPHRASE_EVENT,
  type ArthivoXBackupPassphraseRequest,
} from 'src/cloud/backup';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'BackupSecurityDialog',
  data() {
    return {
      open: false,
      request: null,
      passphrase: '',
      confirmation: '',
      showPassphrase: false,
      busy: false,
      errorMessage: '',
    } as {
      open: boolean;
      request: ArthivoXBackupPassphraseRequest | null;
      passphrase: string;
      confirmation: string;
      showPassphrase: boolean;
      busy: boolean;
      errorMessage: string;
    };
  },
  mounted() {
    window.addEventListener(
      ARTHIVOX_BACKUP_PASSPHRASE_EVENT,
      this.handleRequest as EventListener
    );
  },
  beforeUnmount() {
    window.removeEventListener(
      ARTHIVOX_BACKUP_PASSPHRASE_EVENT,
      this.handleRequest as EventListener
    );
  },
  methods: {
    handleRequest(event: Event) {
      const detail = (event as CustomEvent<ArthivoXBackupPassphraseRequest>).detail;
      if (!detail) return;
      if (this.request) {
        this.request.reject(new Error('Another backup security request replaced this one.'));
      }
      this.request = detail;
      this.passphrase = '';
      this.confirmation = '';
      this.errorMessage = '';
      this.busy = false;
      this.open = true;
      this.$nextTick(() => {
        (this.$refs.passphraseInput as HTMLInputElement | undefined)?.focus();
      });
    },
    async submit() {
      if (!this.request || this.busy) return;
      this.errorMessage = '';

      const value = this.passphrase;
      if (value.length < 10) {
        this.errorMessage = 'Use at least 10 characters for the recovery passphrase.';
        return;
      }
      if (this.request.confirm && value !== this.confirmation) {
        this.errorMessage = 'The two passphrases do not match.';
        return;
      }

      this.busy = true;
      try {
        if (this.request.validate) {
          await this.request.validate(value);
        }
        const resolver = this.request.resolve;
        this.finish();
        resolver(value);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : String(error);
        this.busy = false;
      }
    },
    cancel() {
      if (!this.request || this.busy) return;
      const reject = this.request.reject;
      this.finish();
      reject(new Error('Backup passphrase entry was cancelled.'));
    },
    finish() {
      this.open = false;
      this.request = null;
      this.passphrase = '';
      this.confirmation = '';
      this.showPassphrase = false;
      this.busy = false;
      this.errorMessage = '';
    },
  },
});
</script>

<style scoped>
.ax12-security-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 10, 24, 0.66);
  backdrop-filter: blur(10px);
}
.ax12-security-card {
  width: min(520px, 100%);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 28px 80px rgba(2, 8, 23, 0.32);
}
:global(.dark) .ax12-security-card {
  border-color: rgba(148, 163, 184, 0.18);
  background: #111c30;
  color: #f8fafc;
}
.ax12-security-header {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 14px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}
.ax12-security-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f9f93;
}
.ax12-eyebrow {
  margin: 0 0 3px;
  color: #0f9f93;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.ax12-security-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.ax12-security-header p:not(.ax12-eyebrow) {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.ax12-security-body {
  display: grid;
  gap: 15px;
  padding: 20px 24px;
}
.ax12-field {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
:global(.dark) .ax12-field { color: #a8b3c7; }
.ax12-field input {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border: 1px solid #dbe2ec;
  border-radius: 10px;
  outline: none;
  background: #f8fafc;
  color: #0f172a;
}
:global(.dark) .ax12-field input {
  border-color: #26364f;
  background: #0c1628;
  color: #f8fafc;
}
.ax12-field input:focus {
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20,184,166,.12);
}
.ax12-input-wrap { position: relative; min-width: 0; }
.ax12-input-wrap input { padding-right: 42px; }
.ax12-eye {
  position: absolute;
  top: 50%;
  right: 10px;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  color: #64748b;
}
.ax12-warning, .ax12-error {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin: 0;
  padding: 11px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
}
.ax12-warning {
  background: rgba(245, 158, 11, .1);
  color: #9a6700;
}
:global(.dark) .ax12-warning { color: #f7c65f; }
.ax12-warning p { margin: 0; }
.ax12-error {
  background: rgba(239, 68, 68, .09);
  color: #dc2626;
  overflow-wrap: anywhere;
}
.ax12-security-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
}
.ax12-btn {
  min-width: 100px;
  height: 38px;
  padding: 0 15px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 650;
}
.ax12-btn.secondary {
  border: 1px solid #dbe2ec;
  color: #334155;
}
:global(.dark) .ax12-btn.secondary {
  border-color: #2b3b55;
  color: #cbd5e1;
}
.ax12-btn.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #0f9f93;
  color: white;
}
.ax12-btn:disabled { opacity: .55; cursor: wait; }
.ax12-mini-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,.38);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ax12spin .75s linear infinite;
}
@keyframes ax12spin { to { transform: rotate(360deg); } }
</style>
