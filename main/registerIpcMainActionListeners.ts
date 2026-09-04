import {
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions,
  app,
  dialog,
  ipcMain,
} from 'electron';
import { constants } from 'fs';
import fs from 'fs-extra';
import path from 'path';
import type { RequestInit } from 'node-fetch';
import { SelectFileOptions, SelectFileReturn } from 'utils/types';
import databaseManager from '../backend/database/manager';
import { emitMainProcessError } from '../backend/helpers';
import { Main } from '../main';
import config from 'utils/config';
import { DatabaseMethod } from '../utils/db/types';
import { IPC_ACTIONS } from '../utils/messages';
import { getLanguageMap } from './getLanguageMap';
import { getTemplates } from './getPrintTemplates';
import { printHtmlDocument } from './printHtmlDocument';
import {
  getConfigFilesWithModified,
  getErrorHandledReponse,  setAndGetCleanedConfigFiles,
} from './helpers';
import { saveHtmlAsPdf } from './saveHtmlAsPdf';
import { sendAPIRequest } from './api';
import { initScheduler } from './initSheduler';

export default function registerIpcMainActionListeners(main: Main) {
  ipcMain.handle(IPC_ACTIONS.CHECK_DB_ACCESS, async (_, filePath: string) => {
    try {
      await fs.access(filePath, constants.W_OK | constants.R_OK);
    } catch (err) {
      return false;
    }

    return true;
  });

  ipcMain.handle(
    IPC_ACTIONS.GET_DB_DEFAULT_PATH,
    async (_, companyName: string) => {
      let root: string;
      try {
        root = app.getPath('documents');
      } catch {
        root = app.getPath('userData');
      }

      if (main.isDevelopment) {
        root = 'dbs';
      }

      const dbsPath = path.join(root, 'ArthivoX');
      const backupPath = path.join(dbsPath, 'backups');
      await fs.ensureDir(backupPath);

      let dbFilePath = path.join(dbsPath, `${companyName}.books.db`);

      if (await fs.pathExists(dbFilePath)) {
        const option = await dialog.showMessageBox({
          type: 'question',
          title: 'File Exists',
          message: `Filename already exists. Do you want to overwrite the existing file or create a new one?`,
          buttons: ['Overwrite', 'New'],
        });

        if (option.response === 1) {
          const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');

          dbFilePath = path.join(
            dbsPath,
            `${companyName}_${timestamp}.books.db`
          );

          await dialog.showMessageBox({
            type: 'info',
            message: `New file: ${path.basename(dbFilePath)}`,
          });
        }
      }

      return dbFilePath;
    }
  );

  ipcMain.handle(
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
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();

      if (!safeName) {
        throw new Error('The company name cannot be used as a Windows filename.');
      }

      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeName)) {
        safeName = `${safeName} Company`;
      }

      const destinationPath = path.join(
        path.dirname(sourcePath),
        `${safeName}.books.db`
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
          `A local database named "${path.basename(destinationPath)}" already exists.`
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

  ipcMain.handle(
    IPC_ACTIONS.GET_OPEN_FILEPATH,
    async (_, options: OpenDialogOptions) => {
      return await dialog.showOpenDialog(main.mainWindow!, options);
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.GET_SAVE_FILEPATH,
    async (_, options: SaveDialogOptions) => {
      return await dialog.showSaveDialog(main.mainWindow!, options);
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.GET_DIALOG_RESPONSE,
    async (_, options: MessageBoxOptions) => {
      if (main.isDevelopment || main.isLinux) {
        Object.assign(options, { icon: main.icon });
      }

      return await dialog.showMessageBox(main.mainWindow!, options);
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.SHOW_ERROR,
    (_, { title, content }: { title: string; content: string }) => {
      return dialog.showErrorBox(title, content);
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.SAVE_HTML_AS_PDF,
    async (
      _,
      html: string,
      savePath: string,
      width: number,
      height: number
    ) => {
      return await saveHtmlAsPdf(html, savePath, app, width, height);
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.PRINT_HTML_DOCUMENT,
    async (_, html: string, width: number, height: number) => {
      return await printHtmlDocument(html, app, width, height);
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.SAVE_DATA,
    async (_, data: string, savePath: string) => {
      return await fs.writeFile(savePath, data, { encoding: 'utf-8' });
    }
  );

  ipcMain.handle(IPC_ACTIONS.CREATE_DB_SNAPSHOT, async () => {
    const driver = databaseManager.getDriver();
    if (!driver) {
      throw new Error('No ArthivoX company database is currently open.');
    }

    const tempDir = path.join(app.getPath('temp'), 'arthivox-cloud-backups');
    await fs.ensureDir(tempDir);
    const snapshotPath = path.join(
      tempDir,
      'snapshot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.db'
    );

    try {
      await driver.backup(snapshotPath);
      return Array.from(await fs.readFile(snapshotPath));
    } finally {
      try { driver.close(); } catch {}
      try { await fs.remove(snapshotPath); } catch {}
    }
  });

  ipcMain.handle(
    IPC_ACTIONS.SAVE_BINARY_DATA,
    async (_, data: number[] | Uint8Array, savePath: string) => {
      await fs.ensureDir(path.dirname(savePath));
      await fs.writeFile(savePath, Buffer.from(data));
      return true;
    }
  );

  ipcMain.handle(IPC_ACTIONS.SEND_ERROR, async () => undefined);

  ipcMain.handle(IPC_ACTIONS.CHECK_FOR_UPDATES, async () => undefined);

  ipcMain.handle(IPC_ACTIONS.GET_LANGUAGE_MAP, async (_, code: string) => {
    const obj = { languageMap: {}, success: true, message: '' };
    try {
      obj.languageMap = await getLanguageMap(code);
    } catch (err) {
      obj.success = false;
      obj.message = (err as Error).message;
    }

    return obj;
  });

  ipcMain.handle(
    IPC_ACTIONS.SELECT_FILE,
    async (_, options: SelectFileOptions): Promise<SelectFileReturn> => {
      const response: SelectFileReturn = {
        name: '',
        filePath: '',
        success: false,
        data: Buffer.from('', 'utf-8'),
        canceled: false,
      };
      const { filePaths, canceled } = await dialog.showOpenDialog(
        main.mainWindow!,
        { ...options, properties: ['openFile'] }
      );

      response.filePath = filePaths?.[0];
      response.canceled = canceled;

      if (!response.filePath) {
        return response;
      }

      response.success = true;
      if (canceled) {
        return response;
      }

      response.name = path.basename(response.filePath);
      response.data = await fs.readFile(response.filePath);
      return response;
    }
  );

  ipcMain.handle(IPC_ACTIONS.GET_CREDS, () => ({ errorLogUrl: '', tokenString: '', telemetryUrl: '' }));

  ipcMain.handle(IPC_ACTIONS.DELETE_FILE, async (_, filePath: string) => {
    return getErrorHandledReponse(async () => await fs.unlink(filePath));
  });

  ipcMain.handle(IPC_ACTIONS.GET_DB_LIST, async () => {
    const files = await setAndGetCleanedConfigFiles();
    return await getConfigFilesWithModified(files);
  });

  ipcMain.handle(IPC_ACTIONS.GET_ENV, async () => {
    let version = app.getVersion();
    if (main.isDevelopment) {
      const packageJson = await fs.readFile('package.json', 'utf-8');
      version = (JSON.parse(packageJson) as { version: string }).version;
    }

    return {
      isDevelopment: main.isDevelopment,
      platform: process.platform,
      version,
    };
  });

  ipcMain.handle(
    IPC_ACTIONS.GET_TEMPLATES,
    async (_, posPrintWidth?: number) => {
      return getTemplates(posPrintWidth);
    }
  );

  ipcMain.handle(IPC_ACTIONS.INIT_SHEDULER, async (_, interval: string) => {
    return initScheduler(interval);
  });

  ipcMain.handle(
    IPC_ACTIONS.SEND_API_REQUEST,
    async (e, endpoint: string, options: RequestInit | undefined) => {
      return sendAPIRequest(endpoint, options);
    }
  );

  /**
   * Database Related Actions
   */

  ipcMain.handle(
    IPC_ACTIONS.DB_CREATE,
    async (_, dbPath: string, countryCode: string) => {
      return await getErrorHandledReponse(async () => {
        return await databaseManager.createNewDatabase(dbPath, countryCode);
      });
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.DB_CONNECT,
    async (_, dbPath: string, countryCode?: string) => {
      return await getErrorHandledReponse(async () => {
        return await databaseManager.connectToDatabase(dbPath, countryCode);
      });
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.DB_CALL,
    async (_, method: DatabaseMethod, ...args: unknown[]) => {
      return await getErrorHandledReponse(async () => {
        return await databaseManager.call(method, ...args);
      });
    }
  );

  ipcMain.handle(
    IPC_ACTIONS.DB_BESPOKE,
    async (_, method: string, ...args: unknown[]) => {
      return await getErrorHandledReponse(async () => {
        return await databaseManager.callBespoke(method, ...args);
      });
    }
  );

  ipcMain.handle(IPC_ACTIONS.DB_SCHEMA, async () => {
    return await getErrorHandledReponse(() => {
      return databaseManager.getSchemaMap();
    });
  });
}
