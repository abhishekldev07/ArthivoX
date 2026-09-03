import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = dirname;
const buildDirPath = path.join(root, 'dist_electron', 'build');
const packageDirPath = path.join(root, 'dist_electron', 'bundled');

const arthivoXConfig = {
  productName: 'ArthivoX',
  appId: 'com.arthivox.desktop',
  artifactName: '${productName}-v${version}-${os}-${arch}.${ext}',
  asarUnpack: '**/*.node',
  extraResources: [
    { from: 'translations', to: '../translations' },
    { from: 'templates', to: '../templates' },
    { from: 'build/icon.ico', to: 'build/icon.ico' },
    { from: 'build/icon.png', to: 'build/icon.png' },
  ],
  files: '**',
  extends: null,
  directories: {
    output: packageDirPath,
    app: buildDirPath,
  },
  mac: {
    type: 'distribution',
    artifactName: '${productName}-v${version}-mac-${arch}.${ext}',
    category: 'public.app-category.finance',
    icon: 'build/icon.icns',
    notarize: {
      teamId: process.env.APPLE_TEAM_ID || '',
    },
    hardenedRuntime: true,
    gatekeeperAssess: false,
    darkModeSupport: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },
  win: {
    ...(process.env.WINDOWS_PUBLISHER_NAME
      ? { publisherName: process.env.WINDOWS_PUBLISHER_NAME }
      : {}),
    signDlls: true,
    icon: 'build/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
  },
  nsis: {
    artifactName: '${productName}-Setup-v${version}-windows-${arch}.${ext}',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/installerIcon.ico',
    uninstallerIcon: 'build/uninstallerIcon.ico',
  },
  portable: {
    artifactName: '${productName}-Portable-v${version}-windows-${arch}.${ext}',
  },
  linux: {
    icon: 'build/icons',
    artifactName: '${productName}-v${version}-linux-${arch}.${ext}',
    category: 'Finance',
    target: [
      {
        target: 'deb',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64'],
      },
    ],
  },
};

export default arthivoXConfig;
