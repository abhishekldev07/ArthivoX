import type { Fyo } from 'fyo';
import { ModelNameEnum } from 'models/types';
import {
  downloadCompanyBackup,
  getLatestCompanyBackup,
  getLatestSyncSequence,
  uploadCompanyBackup,
  type ArthivoXCloudBackup,
} from './supabase';
import { setCloudSyncCursorForRestore } from './sync';

export const ARTHIVOX_BACKUP_NOW_EVENT = 'arthivox-cloud-backup-now';
export const ARTHIVOX_BACKUP_PASSPHRASE_EVENT =
  'arthivox-cloud-backup-passphrase-request';

const MAX_STANDARD_BACKUP_BYTES = 240 * 1024 * 1024;
const DEVICE_STORAGE_KEY = 'arthivox-device-id-v1';
const ENCRYPTION_VERSION = 'ax-aesgcm-v1';
const ENCRYPTION_KDF = 'PBKDF2-SHA256';
const PBKDF2_ITERATIONS = 600_000;
const SQLITE_HEADER = 'SQLite format 3\u0000';

type PassphraseMode = 'create' | 'unlock' | 'restore';

export interface ArthivoXBackupPassphraseRequest {
  companyId: string;
  mode: PassphraseMode;
  title: string;
  message: string;
  confirm: boolean;
  validate?: (passphrase: string) => Promise<void>;
  resolve: (passphrase: string) => void;
  reject: (error: Error) => void;
}

export class BackupPassphraseRequiredError extends Error {
  constructor(message = 'Cloud backup encryption is locked for this session.') {
    super(message);
    this.name = 'BackupPassphraseRequiredError';
  }
}

const unlockedPassphrases = new Map<string, string>();

function normalizeBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  const maybeBuffer = value as { type?: string; data?: number[] } | null;
  if (maybeBuffer?.type === 'Buffer' && Array.isArray(maybeBuffer.data)) {
    return Uint8Array.from(maybeBuffer.data);
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error('ArthivoX could not read the local database snapshot.');
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

async function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptSnapshot(
  plaintext: Uint8Array,
  passphrase: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; iv: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt, PBKDF2_ITERATIONS);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { ciphertext: new Uint8Array(encrypted), salt, iv };
}

function assertSQLiteSnapshot(bytes: Uint8Array): void {
  if (bytes.byteLength < 16) {
    throw new Error('The decrypted backup is too small to be a valid SQLite database.');
  }
  const header = new TextDecoder().decode(bytes.slice(0, 16));
  if (header !== SQLITE_HEADER) {
    throw new Error(
      'The backup passphrase is incorrect or this backup is not a valid ArthivoX database.'
    );
  }
}

async function decryptEncryptedBackup(
  backup: ArthivoXCloudBackup,
  ciphertext: Uint8Array,
  passphrase: string
): Promise<Uint8Array> {
  if (
    backup.encryption_version !== ENCRYPTION_VERSION ||
    backup.encryption_kdf !== ENCRYPTION_KDF ||
    !backup.encryption_salt ||
    !backup.encryption_iv ||
    !backup.encryption_iterations
  ) {
    throw new Error(
      'This encrypted backup uses a format that this ArthivoX version cannot unlock.'
    );
  }

  const key = await deriveBackupKey(
    passphrase,
    base64ToBytes(backup.encryption_salt),
    Number(backup.encryption_iterations)
  );
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(backup.encryption_iv) },
      key,
      ciphertext
    );
  } catch {
    throw new Error('Incorrect backup recovery passphrase.');
  }

  const plaintext = new Uint8Array(decrypted);
  assertSQLiteSnapshot(plaintext);
  if (backup.plaintext_sha256) {
    const actual = await sha256Hex(plaintext);
    if (actual.toLowerCase() !== backup.plaintext_sha256.toLowerCase()) {
      throw new Error('Decrypted backup integrity verification failed.');
    }
  }
  return plaintext;
}

async function downloadAndVerifyStoredBytes(
  backup: ArthivoXCloudBackup
): Promise<Uint8Array> {
  const bytes = await downloadCompanyBackup(backup.storage_path);
  if (!bytes.byteLength) throw new Error('The downloaded cloud backup is empty.');
  if (backup.size_bytes && Number(backup.size_bytes) !== bytes.byteLength) {
    throw new Error('Cloud backup size verification failed. Restore was stopped.');
  }
  if (backup.sha256) {
    const actualHash = await sha256Hex(bytes);
    if (actualHash.toLowerCase() !== backup.sha256.toLowerCase()) {
      throw new Error('Cloud backup integrity verification failed. Restore was stopped.');
    }
  }
  return bytes;
}

async function requestPassphrase(
  input: Omit<ArthivoXBackupPassphraseRequest, 'resolve' | 'reject'>
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    window.dispatchEvent(
      new CustomEvent<ArthivoXBackupPassphraseRequest>(
        ARTHIVOX_BACKUP_PASSPHRASE_EVENT,
        { detail: { ...input, resolve, reject } }
      )
    );
  });
}

async function validatePassphraseAgainstLatest(
  backup: ArthivoXCloudBackup,
  passphrase: string
): Promise<void> {
  const encrypted = await downloadAndVerifyStoredBytes(backup);
  await decryptEncryptedBackup(backup, encrypted, passphrase);
}

async function ensureUnlockedPassphrase(
  companyId: string,
  purpose: 'backup' | 'restore',
  interactive: boolean
): Promise<string> {
  const cached = unlockedPassphrases.get(companyId);
  if (cached) return cached;

  const latest = await getLatestCompanyBackup(companyId);
  if (!interactive) throw new BackupPassphraseRequiredError();

  if (latest?.encrypted) {
    const passphrase = await requestPassphrase({
      companyId,
      mode: purpose === 'restore' ? 'restore' : 'unlock',
      title:
        purpose === 'restore'
          ? 'Unlock encrypted company backup'
          : 'Unlock cloud backups',
      message:
        purpose === 'restore'
          ? 'Enter the recovery passphrase used to encrypt this company backup.'
          : 'Enter your backup recovery passphrase to continue encrypted backups.',
      confirm: false,
      validate: async (value) => {
        await validatePassphraseAgainstLatest(latest, value);
      },
    });
    unlockedPassphrases.set(companyId, passphrase);
    return passphrase;
  }

  const passphrase = await requestPassphrase({
    companyId,
    mode: 'create',
    title: 'Protect cloud backups',
    message:
      'Create a recovery passphrase. ArthivoX encrypts the SQLite snapshot on this computer before upload. This passphrase is never sent to Supabase.',
    confirm: true,
  });
  unlockedPassphrases.set(companyId, passphrase);
  return passphrase;
}

export function clearUnlockedBackupPassphrases(): void {
  unlockedPassphrases.clear();
}

export async function createCloudBackup(
  fyo: Fyo,
  companyId: string,
  options: { interactive?: boolean } = {}
): Promise<ArthivoXCloudBackup> {
  if (!navigator.onLine) {
    throw new Error('Connect to the internet before creating a cloud backup.');
  }

  const passphrase = await ensureUnlockedPassphrase(
    companyId,
    'backup',
    options.interactive !== false
  );

  const snapshot = normalizeBytes(await ipc.createDbSnapshot());
  if (!snapshot.byteLength) {
    throw new Error('The SQLite snapshot is empty. Backup was not uploaded.');
  }
  if (snapshot.byteLength > MAX_STANDARD_BACKUP_BYTES) {
    throw new Error(
      'This company database is larger than the current 240 MB standard backup limit.'
    );
  }
  assertSQLiteSnapshot(snapshot);

  const plaintextHash = await sha256Hex(snapshot);
  const { ciphertext, salt, iv } = await encryptSnapshot(snapshot, passphrase);
  const encryptedHash = await sha256Hex(ciphertext);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath =
    `${companyId}/${timestamp}-${encryptedHash.slice(0, 12)}.arthivox.db.axenc`;
  const schemaVersion = (await fyo.getValue(
    ModelNameEnum.SystemSettings,
    'version'
  )) as string | undefined;
  const syncChangeSeq = await getLatestSyncSequence(companyId);

  return await uploadCompanyBackup({
    companyId,
    storagePath,
    data: ciphertext,
    sha256: encryptedHash,
    sizeBytes: ciphertext.byteLength,
    databaseSchemaVersion: schemaVersion || null,
    appVersion: fyo.store.appVersion || null,
    deviceId: localStorage.getItem(DEVICE_STORAGE_KEY),
    encrypted: true,
    encryptionVersion: ENCRYPTION_VERSION,
    encryptionKdf: ENCRYPTION_KDF,
    encryptionIterations: PBKDF2_ITERATIONS,
    encryptionSalt: bytesToBase64(salt),
    encryptionIv: bytesToBase64(iv),
    plaintextSha256: plaintextHash,
    syncChangeSeq,
  });
}

export async function restoreLatestCloudBackup(
  companyId: string,
  companyName: string
): Promise<{ filePath: string; backup: ArthivoXCloudBackup }> {
  if (!navigator.onLine) {
    throw new Error('Connect to the internet before restoring this company.');
  }

  const backup = await getLatestCompanyBackup(companyId);
  if (!backup) {
    throw new Error(
      'No cloud database backup exists yet. Open this company on its original computer and choose Back up now once.'
    );
  }

  const storedBytes = await downloadAndVerifyStoredBytes(backup);
  let databaseBytes: Uint8Array;
  if (backup.encrypted) {
    const passphrase = await ensureUnlockedPassphrase(companyId, 'restore', true);
    databaseBytes = await decryptEncryptedBackup(backup, storedBytes, passphrase);
  } else {
    databaseBytes = storedBytes;
    assertSQLiteSnapshot(databaseBytes);
  }

  const filePath = await ipc.getDbDefaultPath(companyName);
  await ipc.saveBinaryData(databaseBytes, filePath);
  setCloudSyncCursorForRestore(companyId, backup.sync_change_seq);
  return { filePath, backup };
}
