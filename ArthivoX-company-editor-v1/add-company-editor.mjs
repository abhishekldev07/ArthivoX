import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const cloudHomePath = path.join(projectRoot, 'src', 'pages', 'CloudHome.vue');
const appPath = path.join(projectRoot, 'src', 'App.vue');
const supabasePath = path.join(projectRoot, 'src', 'cloud', 'supabase.ts');
const backupDir = path.join(projectRoot, '.arthivox-company-editor-backup');

function fail(message) {
  throw new Error(message);
}

function readRequired(file) {
  if (!fs.existsSync(file)) {
    fail(`Required file not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function backup(file) {
  fs.mkdirSync(backupDir, { recursive: true });
  const rel = path.relative(projectRoot, file).replace(/[\\/]/g, '__');
  const dest = path.join(backupDir, `${rel}.before-company-editor`);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(file, dest);
  }
}

function replaceRequired(text, oldText, newText, label) {
  if (text.includes(newText)) {
    console.log(`  [already] ${label}`);
    return text;
  }
  if (!text.includes(oldText)) {
    fail(`Could not locate expected block for: ${label}`);
  }
  console.log(`  [apply]   ${label}`);
  return text.replace(oldText, newText);
}

function insertBeforeRequired(text, marker, addition, alreadyMarker, label) {
  if (text.includes(alreadyMarker)) {
    console.log(`  [already] ${label}`);
    return text;
  }
  if (!text.includes(marker)) {
    fail(`Could not locate insertion point for: ${label}`);
  }
  console.log(`  [apply]   ${label}`);
  return text.replace(marker, `${addition}${marker}`);
}

function patchSupabase() {
  console.log('\nPatching src/cloud/supabase.ts...');
  let text = readRequired(supabasePath);
  backup(supabasePath);

  const marker = `// ---------------------------------------------------------------------------
// ArthivoX record sync API (v10)
// ---------------------------------------------------------------------------
`;

  const addition = `export async function updateCompany(
  companyId: string,
  input: { name: string }
): Promise<ArthivoXCloudCompany> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error('Company name must be between 2 and 80 characters.');
  }

  const query = new URLSearchParams();
  query.set('id', \`eq.\${companyId}\`);
  query.set(
    'select',
    'id,name,country_code,currency,created_at,updated_at'
  );

  const response = await authorizedFetch(
    \`/rest/v1/companies?\${query.toString()}\`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name }),
    }
  );

  const rows = await parseResponse<ArthivoXCloudCompany[]>(response);
  if (!rows.length) {
    throw new Error(
      'Company could not be updated. Only the company owner can rename it.'
    );
  }

  return rows[0];
}

`;

  text = insertBeforeRequired(
    text,
    marker,
    addition,
    'export async function updateCompany(',
    'cloud company rename API'
  );

  fs.writeFileSync(supabasePath, text, 'utf8');
}

function patchCloudHome() {
  console.log('\nPatching src/pages/CloudHome.vue...');
  let text = readRequired(cloudHomePath);
  backup(cloudHomePath);

  const oldCardTop = `          <div class="ax8-company-card-top">
            <span class="ax8-company-logo">{{ company.name.trim().charAt(0).toUpperCase() }}</span>
            <span class="ax8-company-state" :class="hasLocalPath(company.id) ? 'is-ready' : 'is-cloud'">
              <i></i>
              {{ hasLocalPath(company.id) ? 'Ready on this PC' : 'Cloud only' }}
            </span>
          </div>`;

  const newCardTop = `          <div class="ax8-company-card-top">
            <span class="ax8-company-logo">{{ company.name.trim().charAt(0).toUpperCase() }}</span>
            <div class="ax8-company-card-tools">
              <span class="ax8-company-state" :class="hasLocalPath(company.id) ? 'is-ready' : 'is-cloud'">
                <i></i>
                {{ hasLocalPath(company.id) ? 'Ready on this PC' : 'Cloud only' }}
              </span>
              <button
                class="ax8-company-edit-button"
                type="button"
                title="Edit company"
                aria-label="Edit company"
                @click="openCompanyEditor(company)"
              >
                <feather-icon name="edit-2" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>`;

  text = replaceRequired(
    text,
    oldCardTop,
    newCardTop,
    'company-card edit action'
  );

  const oldTemplateEnd = `    </section>
  </main>
</template>`;

  const newTemplateEnd = `    </section>

    <div
      v-if="editingCompany"
      class="ax8-company-editor-backdrop"
      @click.self="closeCompanyEditor"
    >
      <form
        class="ax8-company-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ax8-company-editor-title"
        @submit.prevent="saveCompanyEditor"
      >
        <header class="ax8-company-editor-header">
          <div>
            <span class="ax8-cloud-eyebrow">COMPANY PROFILE</span>
            <h2 id="ax8-company-editor-title">Edit company</h2>
            <p>Update the workspace name shown across ArthivoX.</p>
          </div>
          <button
            class="ax8-company-editor-close"
            type="button"
            title="Close"
            @click="closeCompanyEditor"
          >
            <feather-icon name="x" class="w-4 h-4" />
          </button>
        </header>

        <div class="ax8-company-editor-body">
          <label class="ax8-company-editor-field">
            <span>Company name</span>
            <input
              v-model="editingCompanyName"
              type="text"
              maxlength="80"
              autocomplete="organization"
              placeholder="Company name"
              autofocus
            />
            <small>2–80 characters. This changes the visible company name, not the local database filename.</small>
          </label>

          <div class="ax8-company-editor-locked">
            <div>
              <span>Currency</span>
              <strong>{{ editingCompany.currency || 'Not set' }}</strong>
            </div>
            <div>
              <span>Country / region</span>
              <strong>{{ editingCompany.country_code || 'Not set' }}</strong>
            </div>
          </div>

          <div class="ax8-company-editor-note">
            <feather-icon name="shield" class="w-4 h-4" />
            <span>Currency and country stay locked here to protect existing accounting history.</span>
          </div>
        </div>

        <footer class="ax8-company-editor-footer">
          <button
            class="ax8-company-editor-cancel"
            type="button"
            :disabled="savingCompany"
            @click="closeCompanyEditor"
          >
            Cancel
          </button>
          <button
            class="ax8-cloud-primary"
            type="submit"
            :disabled="savingCompany || !canSaveCompanyName"
          >
            <feather-icon
              v-if="savingCompany"
              name="loader"
              class="w-4 h-4 animate-spin"
            />
            <span>{{ savingCompany ? 'Saving…' : 'Save changes' }}</span>
          </button>
        </footer>
      </form>
    </div>
  </main>
</template>`;

  text = replaceRequired(
    text,
    oldTemplateEnd,
    newTemplateEnd,
    'company editor modal'
  );

  text = replaceRequired(
    text,
    `    loading: { type: Boolean, default: false },
  },`,
    `    loading: { type: Boolean, default: false },
    savingCompany: { type: Boolean, default: false },
  },`,
    'saving-company prop'
  );

  text = replaceRequired(
    text,
    `  emits: ['create-company', 'import-local', 'open-company', 'logout', 'refresh'],`,
    `  emits: [
    'create-company',
    'import-local',
    'open-company',
    'edit-company',
    'logout',
    'refresh',
  ],`,
    'edit-company event'
  );

  text = replaceRequired(
    text,
    `      systemDark: false,
      systemThemeMedia: null as MediaQueryList | null,
    };`,
    `      systemDark: false,
      systemThemeMedia: null as MediaQueryList | null,
      editingCompany: null as ArthivoXCloudCompany | null,
      editingCompanyName: '',
    };`,
    'company editor local state'
  );

  text = replaceRequired(
    text,
    `  computed: {
    userInitial(): string {
      return (this.email || 'A').trim().charAt(0).toUpperCase();
    },
  },`,
    `  computed: {
    userInitial(): string {
      return (this.email || 'A').trim().charAt(0).toUpperCase();
    },
    canSaveCompanyName(): boolean {
      const name = this.editingCompanyName.trim();
      return (
        !!this.editingCompany &&
        name.length >= 2 &&
        name.length <= 80 &&
        name !== this.editingCompany.name.trim()
      );
    },
  },`,
    'company-name validation'
  );

  text = replaceRequired(
    text,
    `    handleSystemThemeChange(event: MediaQueryListEvent) {
      this.systemDark = event.matches;
    },
    hasLocalPath(companyId: string): boolean {`,
    `    handleSystemThemeChange(event: MediaQueryListEvent) {
      this.systemDark = event.matches;
    },
    openCompanyEditor(company: ArthivoXCloudCompany) {
      this.editingCompany = company;
      this.editingCompanyName = company.name;
    },
    closeCompanyEditor() {
      if (this.savingCompany) {
        return;
      }
      this.editingCompany = null;
      this.editingCompanyName = '';
    },
    saveCompanyEditor() {
      if (!this.editingCompany || !this.canSaveCompanyName) {
        return;
      }

      this.$emit('edit-company', {
        companyId: this.editingCompany.id,
        name: this.editingCompanyName.trim(),
      });

      this.editingCompany = null;
      this.editingCompanyName = '';
    },
    hasLocalPath(companyId: string): boolean {`,
    'company editor methods'
  );

  const styleMarker = `@media (max-width: 960px) {`;

  const styles = `.ax8-company-card-tools {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.ax8-company-edit-button {
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--axc-muted);
  background: transparent;
  border: 1px solid transparent !important;
}
.ax8-company-edit-button:hover {
  color: var(--axc-teal-dark);
  background: rgba(20,184,166,.08);
  border-color: rgba(20,184,166,.18) !important;
}
.ax8-cloud.ax-system-dark .ax8-company-edit-button:hover { color: #5eead4; }

.ax8-company-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 8, 18, .66);
  backdrop-filter: blur(7px);
}

.ax8-company-editor {
  width: min(100%, 520px);
  overflow: hidden;
  border: 1px solid var(--axc-border);
  border-radius: 18px;
  background: var(--axc-surface);
  color: var(--axc-text);
  box-shadow: 0 30px 90px rgba(0,0,0,.26);
}

.ax8-company-editor-header {
  padding: 22px 23px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid var(--axc-border);
}
.ax8-company-editor-header > div { min-width: 0; }
.ax8-company-editor-header h2 {
  margin: 7px 0 0;
  color: var(--axc-text);
  font-size: 22px;
  line-height: 1.2;
  font-weight: 740;
}
.ax8-company-editor-header p {
  margin: 7px 0 0;
  color: var(--axc-muted);
  font-size: 11px;
  line-height: 1.55;
}
.ax8-company-editor-close {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  color: var(--axc-muted);
  background: var(--axc-surface-2);
  border: 1px solid var(--axc-border) !important;
}
.ax8-company-editor-close:hover { color: var(--axc-text); }

.ax8-company-editor-body {
  padding: 21px 23px;
  display: grid;
  gap: 16px;
}

.ax8-company-editor-field {
  display: grid;
  gap: 7px;
}
.ax8-company-editor-field > span {
  color: var(--axc-text);
  font-size: 10px;
  font-weight: 700;
}
.ax8-company-editor-field input {
  width: 100%;
  height: 43px;
  padding: 0 13px;
  outline: none;
  border-radius: 10px;
  border: 1px solid var(--axc-border);
  background: var(--axc-surface-2);
  color: var(--axc-text);
  font: inherit;
  font-size: 12px;
}
.ax8-company-editor-field input:focus {
  border-color: rgba(20,184,166,.65);
  box-shadow: 0 0 0 3px rgba(20,184,166,.09);
}
.ax8-company-editor-field small {
  color: var(--axc-muted-2);
  font-size: 9px;
  line-height: 1.5;
}

.ax8-company-editor-locked {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ax8-company-editor-locked > div {
  min-width: 0;
  padding: 12px 13px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--axc-border);
  border-radius: 10px;
  background: var(--axc-surface-2);
}
.ax8-company-editor-locked span {
  color: var(--axc-muted-2);
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.ax8-company-editor-locked strong {
  min-width: 0;
  color: var(--axc-text);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ax8-company-editor-note {
  padding: 11px 12px;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border-radius: 10px;
  color: var(--axc-muted);
  background: rgba(20,184,166,.06);
  font-size: 9px;
  line-height: 1.5;
}
.ax8-company-editor-note svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--axc-teal-dark);
}

.ax8-company-editor-footer {
  padding: 15px 23px 19px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  border-top: 1px solid var(--axc-border);
}

.ax8-company-editor-cancel {
  height: 40px;
  padding: 0 15px;
  border-radius: 10px;
  color: var(--axc-text);
  background: var(--axc-surface-2);
  border: 1px solid var(--axc-border) !important;
  font-size: 11px;
  font-weight: 680;
}
.ax8-company-editor-cancel:hover { border-color: rgba(20,184,166,.35) !important; }

`;

  text = insertBeforeRequired(
    text,
    styleMarker,
    styles,
    '.ax8-company-editor-backdrop {',
    'company editor styling'
  );

  fs.writeFileSync(cloudHomePath, text, 'utf8');
}

function patchApp() {
  console.log('\nPatching src/App.vue...');
  let text = readRequired(appPath);
  backup(appPath);

  text = replaceRequired(
    text,
    `      :local-paths="cloudCompanyPaths"
      :loading="cloudLoading"
      @create-company="newDatabase"`,
    `      :local-paths="cloudCompanyPaths"
      :loading="cloudLoading"
      :saving-company="cloudCompanySaving"
      @create-company="newDatabase"`,
    'CloudHome saving state'
  );

  text = replaceRequired(
    text,
    `      @open-company="openCloudCompany"
      @logout="logoutCloud"`,
    `      @open-company="openCloudCompany"
      @edit-company="editCloudCompany"
      @logout="logoutCloud"`,
    'CloudHome edit event'
  );

  text = replaceRequired(
    text,
    `  createCompany as createCloudCompany,
  getValidSession,
  listCompanies,
  signOut as signOutCloud,`,
    `  createCompany as createCloudCompany,
  getValidSession,
  listCompanies,
  signOut as signOutCloud,
  updateCompany as updateCloudCompany,`,
    'cloud update import'
  );

  text = replaceRequired(
    text,
    `      cloudCompanies: [],
      cloudLoading: false,
      cloudCompanyPaths: {},`,
    `      cloudCompanies: [],
      cloudLoading: false,
      cloudCompanySaving: false,
      cloudCompanyPaths: {},`,
    'cloud saving data state'
  );

  text = replaceRequired(
    text,
    `      cloudCompanies: ArthivoXCloudCompany[];
      cloudLoading: boolean;
      cloudCompanyPaths: Record<string, string>;`,
    `      cloudCompanies: ArthivoXCloudCompany[];
      cloudLoading: boolean;
      cloudCompanySaving: boolean;
      cloudCompanyPaths: Record<string, string>;`,
    'cloud saving data type'
  );

  const leaveMarker = `    async leaveLocalWorkspace(): Promise<void> {`;

  const editMethod = `    async editCloudCompany(input: {
      companyId: string;
      name: string;
    }): Promise<void> {
      if (this.cloudCompanySaving) {
        return;
      }

      const name = input.name.trim();
      if (name.length < 2 || name.length > 80) {
        showToast({
          message: 'Company name must be between 2 and 80 characters.',
          type: 'error',
        });
        return;
      }

      const current = this.cloudCompanies.find(
        (company) => company.id === input.companyId
      );
      if (!current) {
        showToast({ message: 'Company could not be found.', type: 'error' });
        return;
      }
      if (current.name.trim() === name) {
        return;
      }

      this.cloudCompanySaving = true;
      try {
        const updated = await updateCloudCompany(input.companyId, { name });
        this.cloudCompanies = this.cloudCompanies.map((company) =>
          company.id === updated.id ? updated : company
        );
        showToast({
          message: \`Company renamed to \${updated.name}\`,
          type: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast({
          message: \`Company could not be renamed: \${message}\`,
          type: 'error',
        });
      } finally {
        this.cloudCompanySaving = false;
      }
    },
`;

  text = insertBeforeRequired(
    text,
    leaveMarker,
    editMethod,
    'async editCloudCompany(input:',
    'company rename controller'
  );

  const oldSetDesk = `      this.dbPath = filePath;
      this.companyName = (await fyo.getValue(
        ModelNameEnum.AccountingSettings,
        'companyName'
      )) as string;
      await this.setSearcher();
      updateConfigFiles(fyo);

      const cloudCompanyId = this.getCloudCompanyIdForPath(filePath);
      if (cloudCompanyId) {
        void this.startCloudSyncForCompany(cloudCompanyId);
      }`;

  const newSetDesk = `      this.dbPath = filePath;

      const cloudCompanyId = this.getCloudCompanyIdForPath(filePath);
      const cloudCompany = cloudCompanyId
        ? this.cloudCompanies.find((company) => company.id === cloudCompanyId)
        : undefined;

      // Cloud company name is the authoritative display name for a linked
      // workspace. Keep the physical .books.db filename unchanged.
      if (cloudCompany?.name?.trim()) {
        const accountingSettings =
          fyo.singles[ModelNameEnum.AccountingSettings];
        if (accountingSettings) {
          const localName = accountingSettings.get('companyName');
          if (localName !== cloudCompany.name.trim()) {
            const changed = await accountingSettings.set(
              'companyName',
              cloudCompany.name.trim()
            );
            if (changed) {
              await accountingSettings.sync();
            }
          }
        }
      }

      this.companyName = (await fyo.getValue(
        ModelNameEnum.AccountingSettings,
        'companyName'
      )) as string;
      await this.setSearcher();
      updateConfigFiles(fyo);

      if (cloudCompanyId) {
        void this.startCloudSyncForCompany(cloudCompanyId);
      }`;

  text = replaceRequired(
    text,
    oldSetDesk,
    newSetDesk,
    'sync renamed cloud company into local AccountingSettings'
  );

  fs.writeFileSync(appPath, text, 'utf8');
}

function verify() {
  const cloudHome = readRequired(cloudHomePath);
  const app = readRequired(appPath);
  const supabase = readRequired(supabasePath);

  const checks = [
    [cloudHome.includes('@click="openCompanyEditor(company)"'), 'card edit button'],
    [cloudHome.includes('class="ax8-company-editor-backdrop"'), 'edit modal'],
    [cloudHome.includes("'edit-company'"), 'edit event'],
    [app.includes('@edit-company="editCloudCompany"'), 'App event wiring'],
    [app.includes('updateCompany as updateCloudCompany'), 'cloud update import'],
    [app.includes('accountingSettings.sync()'), 'local name persistence'],
    [supabase.includes('export async function updateCompany('), 'Supabase update API'],
  ];

  console.log('\nVerification:');
  let failed = 0;
  for (const [ok, label] of checks) {
    console.log(`  ${ok ? '[OK]' : '[FAIL]'} ${label}`);
    if (!ok) failed += 1;
  }

  if (failed) {
    fail(`${failed} verification check(s) failed.`);
  }
}

try {
  patchSupabase();
  patchCloudHome();
  patchApp();
  verify();

  console.log('');
  console.log('Company editor feature applied.');
  console.log('No database filename, SQLite data, or Supabase schema was modified by this patch.');
  console.log('');
  console.log('Next:');
  console.log('  yarn typecheck');
  console.log('');
  console.log('If typecheck passes, rebuild when ready:');
  console.log('  Get-Process ArthivoX,electron -ErrorAction SilentlyContinue | Stop-Process -Force');
  console.log('  Remove-Item .\\dist_electron -Recurse -Force -ErrorAction SilentlyContinue');
  console.log('  yarn build:source');
  console.log('  yarn build:win:unsigned');
} catch (error) {
  console.error('');
  console.error(
    'PATCH STOPPED:',
    error instanceof Error ? error.message : String(error)
  );
  console.error(`Backups (for files already touched): ${backupDir}`);
  process.exit(1);
}
