import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

const files = {
  messages: path.join(projectRoot, 'utils', 'messages.ts'),
  preload: path.join(projectRoot, 'main', 'preload.ts'),
  ipcMain: path.join(projectRoot, 'main', 'registerIpcMainActionListeners.ts'),
  app: path.join(projectRoot, 'src', 'App.vue'),
  cloudHome: path.join(projectRoot, 'src', 'pages', 'CloudHome.vue'),
  databaseSelector: path.join(projectRoot, 'src', 'pages', 'DatabaseSelector.vue'),
};

const backupDir = path.join(projectRoot, '.arthivox-safe-db-rename-backup');

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
  const dest = path.join(backupDir, `${rel}.before-safe-db-rename`);
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

function insertBefore(text, marker, addition, alreadyMarker, label) {
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

function patchMessages() {
  console.log('\nPatching utils/messages.ts...');
  let text = readRequired(files.messages);
  backup(files.messages);

  text = replaceRequired(
    text,
    `  GET_DB_DEFAULT_PATH = 'get-db-default-path',
  SEND_API_REQUEST = 'send-api-request',`,
    `  GET_DB_DEFAULT_PATH = 'get-db-default-path',
  RENAME_DB_FILE = 'rename-db-file',
  SEND_API_REQUEST = 'send-api-request',`,
    'rename database IPC action'
  );

  fs.writeFileSync(files.messages, text, 'utf8');
}

function patchPreload() {
  console.log('\nPatching main/preload.ts...');
  let text = readRequired(files.preload);
  backup(files.preload);

  const marker = `  async getEnv() {`;
  const addition = `  async renameDbFile(oldPath: string, companyName: string) {
    return (await ipcRenderer.invoke(
      IPC_ACTIONS.RENAME_DB_FILE,
      oldPath,
      companyName
    )) as string;
  },

`;

  text = insertBefore(
    text,
    marker,
    addition,
    'async renameDbFile(oldPath: string, companyName: string)',
    'renderer renameDbFile bridge'
  );

  fs.writeFileSync(files.preload, text, 'utf8');
}

function patchIpcMain() {
  console.log('\nPatching main/registerIpcMainActionListeners.ts...');
  let text = readRequired(files.ipcMain);
  backup(files.ipcMain);

  if (!text.includes("import config from 'utils/config';")) {
    const marker = `import { DatabaseMethod } from '../utils/db/types';`;
    if (!text.includes(marker)) {
      fail('Could not locate config import insertion point.');
    }
    text = text.replace(
      marker,
      `import config from 'utils/config';\n${marker}`
    );
    console.log('  [apply]   main-process config access');
  } else {
    console.log('  [already] main-process config access');
  }

  const marker = `  ipcMain.handle(
    IPC_ACTIONS.GET_OPEN_FILEPATH,`;

  const addition = `  ipcMain.handle(
    IPC_ACTIONS.RENAME_DB_FILE,
    async (_, oldPath: string, companyName: string) => {
      const sourcePath = path.resolve(oldPath);
      const cleanCompanyName = companyName.trim();

      if (!cleanCompanyName || cleanCompanyName.length > 80) {
        throw new Error('Company name must be between 1 and 80 characters.');
      }

      if (!sourcePath.toLowerCase().endsWith('.books.db')) {
        throw new Error('ArthivoX can only rename .books.db company databases.');
      }

      const stat = await fs.stat(sourcePath).catch(() => null);
      if (!stat?.isFile()) {
        throw new Error('The local company database could not be found.');
      }

      let safeName = cleanCompanyName
        .replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, ' ')
        .replace(/\\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();

      if (!safeName) {
        throw new Error('The company name cannot be used as a Windows filename.');
      }

      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeName)) {
        safeName = \`\${safeName} Company\`;
      }

      const destinationPath = path.join(
        path.dirname(sourcePath),
        \`\${safeName}.books.db\`
      );

      const samePath =
        sourcePath.localeCompare(destinationPath, undefined, {
          sensitivity: 'accent',
        }) === 0;

      if (samePath) {
        return sourcePath;
      }

      if (await fs.pathExists(destinationPath)) {
        throw new Error(
          \`A local database named "\${path.basename(destinationPath)}" already exists.\`
        );
      }

      // Company rename is initiated from the Cloud Home screen, where no local
      // workspace should be active. Close any stale database connection before
      // moving the SQLite file so Windows cannot keep the file locked.
      try {
        await databaseManager.call('close' as DatabaseMethod);
      } catch {
        // If there is no active database, there is nothing to close.
      }

      await fs.move(sourcePath, destinationPath, { overwrite: false });

      // Keep the Recent Companies registry aligned with the physical file.
      const configFiles = config.get('files', []);
      const updatedFiles = configFiles.map((file) => {
        if (path.resolve(file.dbPath) !== sourcePath) {
          return file;
        }
        return {
          ...file,
          dbPath: destinationPath,
          companyName: cleanCompanyName,
        };
      });
      config.set('files', updatedFiles);

      if (config.get('lastSelectedFilePath') === oldPath) {
        config.set('lastSelectedFilePath', destinationPath);
      }

      return destinationPath;
    }
  );

`;

  text = insertBefore(
    text,
    marker,
    addition,
    'IPC_ACTIONS.RENAME_DB_FILE',
    'safe main-process SQLite rename handler'
  );

  fs.writeFileSync(files.ipcMain, text, 'utf8');
}

function patchApp() {
  console.log('\nPatching src/App.vue...');
  let text = readRequired(files.app);
  backup(files.app);

  const startToken = `    async editCloudCompany(input: {`;
  const endToken = `    async leaveLocalWorkspace(): Promise<void> {`;

  if (!text.includes(startToken)) {
    fail(
      'Company editor controller was not found in App.vue. Apply ArthivoX-company-editor-v1 first.'
    );
  }

  const start = text.indexOf(startToken);
  const end = text.indexOf(endToken, start);
  if (end < 0) {
    fail('Could not locate the end of editCloudCompany in App.vue.');
  }

  const newMethod = `    async editCloudCompany(input: {
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

      this.cloudCompanySaving = true;
      try {
        let updated = current;

        if (current.name.trim() !== name) {
          updated = await updateCloudCompany(input.companyId, { name });
        }

        const oldLocalPath = this.cloudCompanyPaths[input.companyId];
        if (oldLocalPath) {
          const newLocalPath = await ipc.renameDbFile(
            oldLocalPath,
            updated.name
          );

          if (newLocalPath !== oldLocalPath) {
            this.cloudCompanyPaths = {
              ...this.cloudCompanyPaths,
              [input.companyId]: newLocalPath,
            };
            this.saveCloudPathMap();

            if (fyo.config.get('lastSelectedFilePath') === oldLocalPath) {
              fyo.config.set('lastSelectedFilePath', newLocalPath);
            }
          }
        }

        this.cloudCompanies = this.cloudCompanies.map((company) =>
          company.id === updated.id ? updated : company
        );

        showToast({
          message:
            current.name.trim() === updated.name.trim()
              ? 'Local company database name updated'
              : \`Company renamed to \${updated.name}\`,
          type: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast({
          message: \`Company update could not finish: \${message}\`,
          type: 'error',
        });
      } finally {
        this.cloudCompanySaving = false;
      }
    },
`;

  const existingBlock = text.slice(start, end);
  if (existingBlock === newMethod) {
    console.log('  [already] company rename + database rename transaction');
  } else {
    text = text.slice(0, start) + newMethod + text.slice(end);
    console.log('  [apply]   company rename + database rename transaction');
  }

  fs.writeFileSync(files.app, text, 'utf8');
}

function patchCloudHome() {
  console.log('\nPatching src/pages/CloudHome.vue...');
  let text = readRequired(files.cloudHome);
  backup(files.cloudHome);

  const oldComputed = `    canSaveCompanyName(): boolean {
      const name = this.editingCompanyName.trim();
      return (
        !!this.editingCompany &&
        name.length >= 2 &&
        name.length <= 80 &&
        name !== this.editingCompany.name.trim()
      );
    },`;

  const newComputed = `    canSaveCompanyName(): boolean {
      const name = this.editingCompanyName.trim();
      return (
        !!this.editingCompany &&
        name.length >= 2 &&
        name.length <= 80 &&
        (
          name !== this.editingCompany.name.trim() ||
          this.localDatabaseNameOutOfDate(this.editingCompany.id, name)
        )
      );
    },`;

  text = replaceRequired(
    text,
    oldComputed,
    newComputed,
    'allow Save when only the local DB filename needs repair'
  );

  const methodMarker = `    hasLocalPath(companyId: string): boolean {`;
  const helper = `    localDatabaseNameOutOfDate(
      companyId: string,
      companyName: string
    ): boolean {
      const filePath = this.localPaths[companyId];
      if (!filePath) {
        return false;
      }

      let safeName = companyName
        .trim()
        .replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, ' ')
        .replace(/\\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();

      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeName)) {
        safeName = \`\${safeName} Company\`;
      }

      const currentFileName = filePath.split(/[\\\\/]/).pop() || '';
      return (
        currentFileName.toLocaleLowerCase() !==
        \`\${safeName}.books.db\`.toLocaleLowerCase()
      );
    },
`;

  text = insertBefore(
    text,
    methodMarker,
    helper,
    'localDatabaseNameOutOfDate(',
    'local DB filename mismatch detector'
  );

  text = replaceRequired(
    text,
    `            <small>2–80 characters. This changes the visible company name, not the local database filename.</small>`,
    `            <small>2–80 characters. ArthivoX also keeps the local database filename aligned with this company name.</small>`,
    'company editor filename explanation'
  );

  fs.writeFileSync(files.cloudHome, text, 'utf8');
}

function patchDatabaseSelector() {
  console.log('\nPatching src/pages/DatabaseSelector.vue...');
  let text = readRequired(files.databaseSelector);
  backup(files.databaseSelector);

  text = replaceRequired(
    text,
    `            <div v-for="(file, i) in files" :key="file.dbPath" class="arthivox-recent-row flex gap-3 items-center cursor-pointer" :title="t\`\${file.companyName} stored at \${file.dbPath}\`" @click="selectFile(file)">`,
    `            <div v-for="(file, i) in files" :key="file.dbPath" class="arthivox-recent-row flex gap-3 items-center cursor-pointer" :title="file.companyName" @click="selectFile(file)">`,
    'remove technical path from Recent Companies tooltip'
  );

  text = replaceRequired(
    text,
    `                <p class="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">{{ truncate(file.dbPath) }}</p>`,
    `                <p class="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">Local company database</p>`,
    'replace raw DB path with professional label'
  );

  fs.writeFileSync(files.databaseSelector, text, 'utf8');
}

function verify() {
  const messages = readRequired(files.messages);
  const preload = readRequired(files.preload);
  const ipcMain = readRequired(files.ipcMain);
  const app = readRequired(files.app);
  const cloudHome = readRequired(files.cloudHome);
  const selector = readRequired(files.databaseSelector);

  const checks = [
    [messages.includes("RENAME_DB_FILE = 'rename-db-file'"), 'IPC action'],
    [preload.includes('async renameDbFile(oldPath: string, companyName: string)'), 'preload bridge'],
    [ipcMain.includes('IPC_ACTIONS.RENAME_DB_FILE'), 'main rename handler'],
    [ipcMain.includes('await fs.move(sourcePath, destinationPath'), 'physical DB move'],
    [ipcMain.includes("config.set('files', updatedFiles)"), 'recent company path update'],
    [app.includes('await ipc.renameDbFile('), 'company editor invokes DB rename'],
    [app.includes('[input.companyId]: newLocalPath'), 'cloud path map update'],
    [cloudHome.includes('localDatabaseNameOutOfDate('), 'existing mismatch repair'],
    [selector.includes('Local company database</p>'), 'clean recent-company subtitle'],
    [!selector.includes('truncate(file.dbPath)'), 'raw path removed from UI'],
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
  patchMessages();
  patchPreload();
  patchIpcMain();
  patchApp();
  patchCloudHome();
  patchDatabaseSelector();
  verify();

  console.log('');
  console.log('Safe database rename feature applied.');
  console.log('');
  console.log('IMPORTANT: this patch does not rename the database immediately.');
  console.log('After rebuilding, open Edit company and press Save changes once.');
  console.log('For your current Northstar Apparel Co. record, Save will be enabled');
  console.log('even though the company name itself is already unchanged.');
  console.log('');
  console.log('Next: yarn typecheck');
} catch (error) {
  console.error('');
  console.error(
    'PATCH STOPPED:',
    error instanceof Error ? error.message : String(error)
  );
  console.error(`Backups: ${backupDir}`);
  process.exit(1);
}
