// eslint-disable-next-line
require('source-map-support').install({
  handleUncaughtException: false,
  environment: 'node',
});

import { emitMainProcessError } from 'backend/helpers';
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  nativeImage,
  protocol,
} from 'electron';
import path from 'path';
import registerAppLifecycleListeners from './main/registerAppLifecycleListeners';
import registerIpcMainActionListeners from './main/registerIpcMainActionListeners';
import registerIpcMainMessageListeners from './main/registerIpcMainMessageListeners';
import registerProcessListeners from './main/registerProcessListeners';

export class Main {
  title = 'ArthivoX';
  icon: string;

  winURL = '';
  mainWindow: BrowserWindow | null = null;

  WIDTH = 1280;
  HEIGHT = process.platform === 'win32' ? 860 : 834;

  constructor() {
    app.setName('ArthivoX');
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.arthivox.desktop');
    }

    // BrowserWindow uses the PNG through nativeImage. The Windows EXE and
    // installers still use build/icon.ico through electron-builder.
    this.icon = this.isDevelopment
      ? path.resolve('./build/icon.png')
      : path.join(process.resourcesPath, 'build', 'icon.png');

    protocol.registerSchemesAsPrivileged([
      { scheme: 'app', privileges: { secure: true, standard: true } },
    ]);

    app.commandLine.appendSwitch('disable-http2');

    this.registerListeners();
    if (this.isMac && this.isDevelopment) {
      app.dock.setIcon(this.icon);
    }
  }

  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  get isTest() {
    return !!process.env.IS_TEST;
  }

  get isMac() {
    return process.platform === 'darwin';
  }

  get isLinux() {
    return process.platform === 'linux';
  }

  registerListeners() {
    registerIpcMainMessageListeners(this);
    registerIpcMainActionListeners(this);
    registerAppLifecycleListeners(this);
    registerProcessListeners(this);
  }

  getOptions(): BrowserWindowConstructorOptions {
    const preload = path.join(__dirname, 'main', 'preload.js');
    const options: BrowserWindowConstructorOptions = {
      width: this.WIDTH,
      height: this.HEIGHT,
      minWidth: 1040,
      minHeight: 700,
      title: this.title,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 16, y: 16 },
      backgroundColor: '#F4F7FB',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload,
      },
      autoHideMenuBar: true,
      frame: !this.isMac,
      resizable: true,
    };

    const windowIcon = nativeImage.createFromPath(this.icon);
    if (
      !windowIcon.isEmpty() &&
      (this.isDevelopment || this.isLinux || process.platform === 'win32')
    ) {
      Object.assign(options, { icon: windowIcon });
    }

    if (this.isLinux) {
      Object.assign(options, {
        icon: path.join(__dirname, '/icons/512x512.png'),
      });
    }

    return options;
  }

  async createWindow() {
    const options = this.getOptions();
    this.mainWindow = new BrowserWindow(options);

    if (process.platform === 'win32') {
      const windowIcon = nativeImage.createFromPath(this.icon);
      if (!windowIcon.isEmpty()) {
        this.mainWindow.setIcon(windowIcon);
      }
    }

    this.mainWindow.setTitle(this.title);

    if (this.isDevelopment) {
      this.setViteServerURL();
    } else {
      this.registerAppProtocol();
    }

    await this.mainWindow.loadURL(this.winURL);
    this.mainWindow.setTitle(this.title);

    this.setMainWindowListeners();
  }

  setViteServerURL() {
    let port = 6969;
    let host = '0.0.0.0';

    if (process.env.VITE_PORT && process.env.VITE_HOST) {
      port = Number(process.env.VITE_PORT);
      host = process.env.VITE_HOST;
    }

    this.winURL = `http://${host}:${port}/`;
  }

  registerAppProtocol() {
    protocol.registerFileProtocol('app', (request, callback) => {
      try {
        callback({ path: resolveAppProtocolPath(request.url) });
      } catch (error) {
        const appError =
          error instanceof Error ? error : new Error(String(error));
        emitMainProcessError(appError);
        callback({ error: -6 });
      }
    });
    this.winURL = 'app://./index.html';
  }

  setMainWindowListeners() {
    if (this.mainWindow === null) {
      return;
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.mainWindow?.setTitle(this.title);
    });

    this.mainWindow.webContents.on('did-fail-load', () => {
      this.mainWindow!.loadURL(this.winURL).catch((err) =>
        emitMainProcessError(err)
      );
    });
  }
}

function resolveAppProtocolPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  const host = url.host === '.' ? '' : decodeURIComponent(url.host);
  const pathname = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');
  const relativePath = path.normalize(path.join(host, pathname));

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid app protocol path: ${requestUrl}`);
  }

  return path.join(__dirname, 'src', relativePath);
}

export default new Main();
