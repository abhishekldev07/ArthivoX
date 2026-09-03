import type { Fyo } from 'fyo';
import type { DocValueMap, RawValueMap } from 'fyo/core/types';
import type { Doc } from 'fyo/model/doc';
import { FieldTypeEnum } from 'schemas/types';
import {
  getLatestSyncSequence,
  hasCloudSyncRecords,
  listSyncRecords,
  pullSyncChanges,
  pushSyncRecord,
  registerCompanyDevice,
  touchCompanyDevice,
  type ArthivoXCloudSyncChange,
} from './supabase';

export const ARTHIVOX_SYNC_STATUS_EVENT = 'arthivox-sync-status';
export const ARTHIVOX_SYNC_NOW_EVENT = 'arthivox-sync-now';
export const ARTHIVOX_SYNC_CONFLICT_EVENT = 'arthivox-sync-conflict';
export const ARTHIVOX_OPEN_CONFLICT_EVENT = 'arthivox-open-sync-conflict';

export type ArthivoXSyncState =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'conflict'
  | 'disabled';

export interface ArthivoXSyncStatus {
  state: ArthivoXSyncState;
  companyId: string | null;
  pending: number;
  lastSyncedAt: string | null;
  message: string;
}

export interface ArthivoXSyncConflict {
  companyId: string;
  entityType: string;
  entityId: string;
  source: 'push' | 'pull' | 'protected';
  message: string;
  localPayload: Record<string, unknown>;
  cloudPayload: Record<string, unknown>;
  localDeleted: boolean;
  cloudDeleted: boolean;
  cloudRevision: number;
  cloudSeq: number | null;
  cloudUpdatedAt: string | null;
  protectedRecord: boolean;
}

interface QueueItem {
  entityType: string;
  entityId: string;
  deleted: boolean;
  queuedAt: string;
}

type QueueMap = Record<string, QueueItem>;
type RevisionMap = Record<string, number>;
type Listener = (payload: unknown) => unknown | Promise<unknown>;

/**
 * Root documents synchronized in v10.
 * Child tables (invoice items, payment references, journal rows, etc.) travel
 * inside their parent document payload and are intentionally not synchronized
 * as independent entities.
 */
export const ARTHIVOX_SYNC_ENTITY_TYPES = [
  'Account',
  'ItemGroup',
  'UOM',
  'Address',
  'Party',
  'Item',
  'Tax',
  'PaymentMethod',
  'PriceList',
  'SalesQuote',
  'SalesInvoice',
  'PurchaseInvoice',
  'Payment',
  'JournalEntry',
] as const;

const SYNC_INTERVAL_MS = 20_000;
const DEVICE_STORAGE_KEY = 'arthivox-device-id-v1';
const QUEUE_PREFIX = 'arthivox-sync-queue-v1:';
const REVISION_PREFIX = 'arthivox-sync-revisions-v1:';
const CURSOR_PREFIX = 'arthivox-sync-cursor-v1:';
const LAST_SYNC_PREFIX = 'arthivox-sync-last-success-v1:';
const CONFLICT_PREFIX = 'arthivox-sync-conflict-v1:';
const SYNC_STATE_VERSION_PREFIX = 'arthivox-sync-state-version:';
const CURRENT_SYNC_STATE_VERSION = 2;

class CloudSyncConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudSyncConflictError';
  }
}

function entityKey(entityType: string, entityId: string): string {
  return `${entityType}::${entityId}`;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeForCompare(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForCompare);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((out, key) => {
        out[key] = normalizeForCompare(
          (value as Record<string, unknown>)[key]
        );
        return out;
      }, {});
  }
  return value;
}

function payloadsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

function makeDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ax-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
}

function getDeviceName(fyo: Fyo): string {
  const platform = fyo.store.platform || 'Desktop';
  return `${platform} ArthivoX`;
}

function stripRemoteMeta(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const copy = cloneJson(payload);
  delete copy.created;
  delete copy.createdBy;
  delete copy.modified;
  delete copy.modifiedBy;
  return copy;
}

class ArthivoXCloudSyncEngine {
  private fyo: Fyo | null = null;
  private companyId: string | null = null;
  private deviceId = makeDeviceId();
  private queue: QueueMap = {};
  private revisions: RevisionMap = {};
  private cursor = 0;
  private lastSyncedAt: string | null = null;
  private timer: number | null = null;
  private syncing = false;
  private suppressLocalEvents = false;
  private conflict: ArthivoXSyncConflict | null = null;
  private listeners: Array<{
    source: 'doc' | 'db';
    event: string;
    listener: Listener;
  }> = [];

  private status: ArthivoXSyncStatus = {
    state: 'disabled',
    companyId: null,
    pending: 0,
    lastSyncedAt: null,
    message: 'Cloud sync is not connected',
  };

  private onlineListener = () => {
    void this.syncNow();
  };

  private manualSyncListener = () => {
    void this.syncNow();
  };

  getStatus(): ArthivoXSyncStatus {
    return { ...this.status };
  }

  async start(fyo: Fyo, companyId: string): Promise<void> {
    await this.stop();

    this.fyo = fyo;
    this.companyId = companyId;
    this.deviceId = makeDeviceId();
    this.queue = safeJsonParse<QueueMap>(
      localStorage.getItem(`${QUEUE_PREFIX}${companyId}`),
      {}
    );
    this.revisions = safeJsonParse<RevisionMap>(
      localStorage.getItem(`${REVISION_PREFIX}${companyId}`),
      {}
    );
    this.cursor = Number(localStorage.getItem(`${CURSOR_PREFIX}${companyId}`) || 0) || 0;
    this.lastSyncedAt = localStorage.getItem(`${LAST_SYNC_PREFIX}${companyId}`);
    this.conflict = safeJsonParse<ArthivoXSyncConflict | null>(
      localStorage.getItem(`${CONFLICT_PREFIX}${companyId}`),
      null
    );

    this.attachListeners();
    window.addEventListener('online', this.onlineListener);
    window.addEventListener(ARTHIVOX_SYNC_NOW_EVENT, this.manualSyncListener);

    this.emitStatus(
      navigator.onLine ? 'syncing' : 'offline',
      navigator.onLine ? 'Connecting to ArthivoX Cloud…' : 'Waiting for internet connection'
    );

    if (!navigator.onLine) {
      this.schedule();
      return;
    }

    try {
      await registerCompanyDevice({
        companyId,
        deviceId: this.deviceId,
        deviceName: getDeviceName(fyo),
        platform: fyo.store.platform || null,
        appVersion: fyo.store.appVersion || null,
      });

      const needsSyncStateMigration = this.needsSyncStateMigration;

      if (needsSyncStateMigration && this.conflict) {
        // Pre-v2 conflicts may have been produced by replaying historical
        // intermediate changes. Re-derive any conflict from current cloud state.
        this.clearConflict();
      }

      if (this.conflict) {
        this.emitStatus('conflict', this.conflict.message);
        this.dispatchConflict();
        return;
      }

      const cloudHasData = await hasCloudSyncRecords(companyId);
      if (!cloudHasData) {
        await this.queueInitialLocalSnapshot();
        await this.syncNow();
        this.markSyncStateCurrent();
      } else {
        const hasRevisions = Object.keys(this.revisions).length > 0;

        if (needsSyncStateMigration) {
          // Upgrade old browser-local sync state by reconciling against the
          // current cloud snapshot. Never replay old history over a current DB.
          await this.migrateLegacySyncState();
        } else if (this.cursor === 0) {
          // A zero cursor with cloud data is never allowed to replay all history,
          // even if stale revisions/queue entries happen to exist.
          await this.bootstrapExistingWorkspace();
        } else if (this.cursor > 0 && !hasRevisions) {
          // Restored backups carry an exact cloud sequence. Seed the current
          // revision map before pulling only the changes that happened later.
          await this.seedCurrentRevisions();
        }

        if (!this.conflict) {
          await this.syncNow();
          await this.queueMissingEntitySnapshots();
          if (this.pendingCount) {
            await this.syncNow();
          }
        }
      }
    } catch (error) {
      if (error instanceof CloudSyncConflictError) {
        this.emitStatus('conflict', error.message);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.emitStatus('error', message || 'Cloud sync could not start');
      }
    } finally {
      this.schedule();
    }
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    window.removeEventListener('online', this.onlineListener);
    window.removeEventListener(ARTHIVOX_SYNC_NOW_EVENT, this.manualSyncListener);
    this.detachListeners();

    this.fyo = null;
    this.companyId = null;
    this.syncing = false;
    this.suppressLocalEvents = false;
    this.conflict = null;
    this.emitStatus('disabled', 'Cloud sync is not connected');
  }

  async syncNow(): Promise<void> {
    if (!this.fyo || !this.companyId || this.syncing) {
      return;
    }

    if (this.conflict) {
      this.emitStatus('conflict', this.conflict.message);
      return;
    }

    if (!navigator.onLine) {
      this.emitStatus('offline', 'Offline — changes are saved locally');
      return;
    }

    this.syncing = true;
    this.emitStatus('syncing', this.pendingCount ? `Syncing ${this.pendingCount} change${this.pendingCount === 1 ? '' : 's'}…` : 'Checking for cloud changes…');

    try {
      await touchCompanyDevice({
        companyId: this.companyId,
        deviceId: this.deviceId,
        appVersion: this.fyo.store.appVersion || null,
      });

      await this.pushPendingChanges();
      await this.pullRemoteChanges();

      this.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(
        `${LAST_SYNC_PREFIX}${this.companyId}`,
        this.lastSyncedAt
      );
      this.emitStatus('idle', 'All changes synced');
    } catch (error) {
      if (error instanceof CloudSyncConflictError) {
        this.emitStatus('conflict', error.message);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.emitStatus('error', message || 'Cloud sync failed');
      }
    } finally {
      this.syncing = false;
    }
  }

  private schedule(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
    }
    this.timer = window.setInterval(() => {
      void this.syncNow();
    }, SYNC_INTERVAL_MS);
  }

  private get pendingCount(): number {
    return Object.keys(this.queue).length;
  }

  private get syncStateVersion(): number {
    if (!this.companyId) {
      return CURRENT_SYNC_STATE_VERSION;
    }
    return (
      Number(
        localStorage.getItem(
          `${SYNC_STATE_VERSION_PREFIX}${this.companyId}`
        ) || 0
      ) || 0
    );
  }

  private get needsSyncStateMigration(): boolean {
    return this.syncStateVersion < CURRENT_SYNC_STATE_VERSION;
  }

  private markSyncStateCurrent(): void {
    if (!this.companyId) {
      return;
    }
    localStorage.setItem(
      `${SYNC_STATE_VERSION_PREFIX}${this.companyId}`,
      String(CURRENT_SYNC_STATE_VERSION)
    );
  }

  private persistQueue(): void {
    if (!this.companyId) {
      return;
    }
    localStorage.setItem(
      `${QUEUE_PREFIX}${this.companyId}`,
      JSON.stringify(this.queue)
    );
  }

  private persistRevisions(): void {
    if (!this.companyId) {
      return;
    }
    localStorage.setItem(
      `${REVISION_PREFIX}${this.companyId}`,
      JSON.stringify(this.revisions)
    );
  }

  private persistCursor(): void {
    if (!this.companyId) {
      return;
    }
    localStorage.setItem(`${CURSOR_PREFIX}${this.companyId}`, String(this.cursor));
  }

  private emitStatus(state: ArthivoXSyncState, message: string): void {
    this.status = {
      state,
      companyId: this.companyId,
      pending: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      message,
    };
    window.dispatchEvent(
      new CustomEvent<ArthivoXSyncStatus>(ARTHIVOX_SYNC_STATUS_EVENT, {
        detail: { ...this.status },
      })
    );
  }

  private persistConflict(): void {
    if (!this.companyId) return;
    if (!this.conflict) {
      localStorage.removeItem(`${CONFLICT_PREFIX}${this.companyId}`);
      return;
    }
    localStorage.setItem(
      `${CONFLICT_PREFIX}${this.companyId}`,
      JSON.stringify(this.conflict)
    );
  }

  private dispatchConflict(): void {
    window.dispatchEvent(
      new CustomEvent<ArthivoXSyncConflict | null>(
        ARTHIVOX_SYNC_CONFLICT_EVENT,
        { detail: this.conflict ? cloneJson(this.conflict) : null }
      )
    );
  }

  private setConflict(conflict: ArthivoXSyncConflict): never {
    this.conflict = conflict;
    this.persistConflict();
    this.dispatchConflict();
    throw new CloudSyncConflictError(conflict.message);
  }

  private clearConflict(): void {
    this.conflict = null;
    this.persistConflict();
    this.dispatchConflict();
  }

  private async isProtectedLocalRecord(
    entityType: string,
    entityId: string
  ): Promise<boolean> {
    if (!this.fyo || !(await this.fyo.db.exists(entityType, entityId))) {
      return false;
    }
    try {
      const doc = await this.fyo.doc.getDoc(entityType, entityId, {
        skipDocumentCache: true,
      });
      return !!doc.isSubmitted || !!doc.isCancelled;
    } catch {
      return false;
    }
  }

  private async getLocalConflictPayload(
    entityType: string,
    entityId: string,
    deleted: boolean
  ): Promise<Record<string, unknown>> {
    if (deleted) return {};
    try {
      return await this.getLocalPayload(entityType, entityId);
    } catch {
      return {};
    }
  }

  getConflict(): ArthivoXSyncConflict | null {
    return this.conflict ? cloneJson(this.conflict) : null;
  }

  async resolveConflict(strategy: 'local' | 'cloud'): Promise<void> {
    if (!this.conflict || !this.companyId || !this.fyo) {
      return;
    }
    if (!navigator.onLine) {
      throw new Error('Reconnect to the internet before resolving this sync conflict.');
    }

    const conflict = this.conflict;
    const key = entityKey(conflict.entityType, conflict.entityId);

    if (strategy === 'cloud' && conflict.protectedRecord) {
      throw new Error(
        'ArthivoX will not automatically replace a submitted or cancelled accounting document. Use this computer as the cloud winner, or review/correct the accounting document manually.'
      );
    }

    this.syncing = true;
    this.emitStatus('syncing', 'Resolving cloud conflict…');
    try {
      if (strategy === 'local') {
        const result = await pushSyncRecord({
          companyId: this.companyId,
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          payload: conflict.localPayload || {},
          expectedRevision: conflict.cloudRevision,
          deleted: conflict.localDeleted,
          deviceId: this.deviceId,
        });

        if (result.conflict || !result.applied) {
          this.conflict = {
            ...conflict,
            cloudPayload: result.server_payload || {},
            cloudDeleted: !!result.server_deleted_at,
            cloudRevision: result.revision,
            cloudUpdatedAt: result.server_updated_at,
            message:
              'The cloud copy changed again while you were resolving the conflict. Review the newest version before choosing again.',
          };
          this.persistConflict();
          this.dispatchConflict();
          throw new Error(this.conflict.message);
        }

        this.revisions[key] = result.revision;
        delete this.queue[key];
        if (conflict.cloudSeq) {
          this.cursor = Math.max(this.cursor, conflict.cloudSeq);
        }
      } else {
        const syntheticChange: ArthivoXCloudSyncChange = {
          seq: conflict.cloudSeq || this.cursor,
          entity_type: conflict.entityType,
          entity_id: conflict.entityId,
          revision: conflict.cloudRevision,
          payload: conflict.cloudPayload || {},
          deleted_at: conflict.cloudDeleted ? new Date().toISOString() : null,
          changed_from_device: null,
          changed_at: conflict.cloudUpdatedAt || new Date().toISOString(),
        };
        await this.applyRemoteChange(syntheticChange);
        this.revisions[key] = conflict.cloudRevision;
        delete this.queue[key];
        if (conflict.cloudSeq) {
          this.cursor = Math.max(this.cursor, conflict.cloudSeq);
        }
      }

      this.persistQueue();
      this.persistRevisions();
      this.persistCursor();
      this.clearConflict();
      this.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(
        `${LAST_SYNC_PREFIX}${this.companyId}`,
        this.lastSyncedAt
      );
    } finally {
      this.syncing = false;
    }

    if (this.needsSyncStateMigration) {
      try {
        // Continue current-snapshot reconciliation after each resolved conflict.
        // This can surface the next real mismatch without touching old history.
        await this.migrateLegacySyncState();
      } catch (error) {
        if (error instanceof CloudSyncConflictError) {
          this.emitStatus('conflict', error.message);
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        this.emitStatus(
          'error',
          message || 'Cloud sync migration could not finish'
        );
        return;
      }
    }

    await this.syncNow();
  }

  private attachListeners(): void {
    if (!this.fyo) {
      return;
    }

    for (const entityType of ARTHIVOX_SYNC_ENTITY_TYPES) {
      const schema = this.fyo.schemaMap[entityType];
      if (!schema || schema.isChild) {
        continue;
      }

      const syncEvent = `sync:${entityType}`;
      const syncListener: Listener = (name) => {
        if (typeof name === 'string') {
          this.enqueue(entityType, name, false);
        }
      };
      this.fyo.doc.observer.on(syncEvent, syncListener);
      this.listeners.push({ source: 'doc', event: syncEvent, listener: syncListener });

      const deleteEvent = `delete:${entityType}`;
      const deleteListener: Listener = (name) => {
        if (typeof name === 'string') {
          this.enqueue(entityType, name, true);
        }
      };
      this.fyo.doc.observer.on(deleteEvent, deleteListener);
      this.listeners.push({ source: 'doc', event: deleteEvent, listener: deleteListener });

      const renameEvent = `rename:${entityType}`;
      const renameListener: Listener = (names) => {
        const payload = names as { oldName?: unknown; newName?: unknown };
        if (typeof payload?.oldName === 'string') {
          this.enqueue(entityType, payload.oldName, true);
        }
        if (typeof payload?.newName === 'string') {
          this.enqueue(entityType, payload.newName, false);
        }
      };
      this.fyo.db.observer.on(renameEvent, renameListener);
      this.listeners.push({ source: 'db', event: renameEvent, listener: renameListener });
    }
  }

  private detachListeners(): void {
    if (!this.fyo) {
      this.listeners = [];
      return;
    }

    for (const { source, event, listener } of this.listeners) {
      if (source === 'doc') {
        this.fyo.doc.observer.off(event, listener);
      } else {
        this.fyo.db.observer.off(event, listener);
      }
    }
    this.listeners = [];
  }

  private enqueue(entityType: string, entityId: string, deleted: boolean): void {
    if (
      this.suppressLocalEvents ||
      !this.companyId ||
      !ARTHIVOX_SYNC_ENTITY_TYPES.includes(entityType as (typeof ARTHIVOX_SYNC_ENTITY_TYPES)[number])
    ) {
      return;
    }

    const key = entityKey(entityType, entityId);
    this.queue[key] = {
      entityType,
      entityId,
      deleted,
      queuedAt: new Date().toISOString(),
    };
    this.persistQueue();

    if (navigator.onLine) {
      this.emitStatus('syncing', `${this.pendingCount} local change${this.pendingCount === 1 ? '' : 's'} waiting to sync`);
      window.setTimeout(() => void this.syncNow(), 400);
    } else {
      this.emitStatus('offline', `${this.pendingCount} change${this.pendingCount === 1 ? '' : 's'} saved offline`);
    }
  }

  private async migrateLegacySyncState(): Promise<void> {
    if (!this.companyId) {
      return;
    }

    // Move the cursor to the current edge BEFORE reconciliation. If a current
    // snapshot conflict pauses migration, resolving it must never fall back to
    // replaying obsolete historical changes.
    this.cursor = await getLatestSyncSequence(this.companyId);
    this.persistCursor();

    await this.bootstrapExistingWorkspace();
    this.markSyncStateCurrent();
  }

  private async seedCurrentRevisions(): Promise<void> {
    if (!this.companyId) {
      return;
    }

    const records = await listSyncRecords(this.companyId, 10000);
    for (const record of records) {
      this.revisions[entityKey(record.entity_type, record.entity_id)] =
        record.revision;
    }
    this.persistRevisions();
  }

  private async bootstrapExistingWorkspace(): Promise<void> {
    if (!this.companyId || !this.fyo) {
      return;
    }

    const [records, latestSeq] = await Promise.all([
      listSyncRecords(this.companyId, 10000),
      getLatestSyncSequence(this.companyId),
    ]);

    // Persist the current cloud edge before a possible conflict can interrupt
    // reconciliation. This makes conflict resolution safe from old history.
    this.cursor = Math.max(this.cursor, latestSeq);
    this.persistCursor();

    const cloudKeys = new Set<string>();

    for (const record of records) {
      const key = entityKey(record.entity_type, record.entity_id);
      cloudKeys.add(key);
      this.revisions[key] = record.revision;

      if (
        !ARTHIVOX_SYNC_ENTITY_TYPES.includes(
          record.entity_type as (typeof ARTHIVOX_SYNC_ENTITY_TYPES)[number]
        ) ||
        !this.fyo.schemaMap[record.entity_type]
      ) {
        continue;
      }

      const localExists = await this.fyo.db.exists(
        record.entity_type,
        record.entity_id
      );

      if (record.deleted_at) {
        if (localExists) {
          await this.applyRemoteDeletion(record.entity_type, record.entity_id);
        }
        continue;
      }

      if (!localExists) {
        await this.applyRemoteUpsert(
          record.entity_type,
          record.entity_id,
          record.payload || {}
        );
        continue;
      }

      const localPayload = stripRemoteMeta(
        await this.getLocalPayload(record.entity_type, record.entity_id)
      );
      const cloudPayload = stripRemoteMeta(record.payload || {});

      if (!payloadsEqual(localPayload, cloudPayload)) {
        const protectedRecord = await this.isProtectedLocalRecord(
          record.entity_type,
          record.entity_id
        );
        this.setConflict({
          companyId: this.companyId,
          entityType: record.entity_type,
          entityId: record.entity_id,
          source: 'pull',
          message:
            `This local ${record.entity_type} ${record.entity_id} differs from the current cloud copy. ArthivoX preserved both versions for review instead of replaying old history.`,
          localPayload,
          cloudPayload,
          localDeleted: false,
          cloudDeleted: false,
          cloudRevision: record.revision,
          cloudSeq: null,
          cloudUpdatedAt: record.updated_at ?? null,
          protectedRecord,
        });
      }
    }

    // Local records that do not exist in the cloud are legitimate unsynced
    // local records. Queue only those instead of re-queuing the whole database.
    for (const entityType of ARTHIVOX_SYNC_ENTITY_TYPES) {
      const schema = this.fyo.schemaMap[entityType];
      if (!schema || schema.isChild || schema.isSingle) {
        continue;
      }

      const rows = await this.fyo.db.getAllRaw(entityType, { fields: ['name'] });
      for (const row of rows) {
        const name = row.name;
        if (typeof name !== 'string' || !name) {
          continue;
        }

        const key = entityKey(entityType, name);
        if (cloudKeys.has(key)) {
          continue;
        }

        this.queue[key] = {
          entityType,
          entityId: name,
          deleted: false,
          queuedAt: new Date().toISOString(),
        };
      }
    }

    this.cursor = Math.max(this.cursor, latestSeq);
    this.persistRevisions();
    this.persistQueue();
    this.persistCursor();
  }

  private async queueInitialLocalSnapshot(): Promise<void> {
    if (!this.fyo) {
      return;
    }

    for (const entityType of ARTHIVOX_SYNC_ENTITY_TYPES) {
      const schema = this.fyo.schemaMap[entityType];
      if (!schema || schema.isChild || schema.isSingle) {
        continue;
      }

      const rows = await this.fyo.db.getAllRaw(entityType, {
        fields: ['name'],
      });
      for (const row of rows) {
        const name = row.name;
        if (typeof name !== 'string' || !name) {
          continue;
        }
        const key = entityKey(entityType, name);
        this.queue[key] = {
          entityType,
          entityId: name,
          deleted: false,
          queuedAt: new Date().toISOString(),
        };
      }
    }

    this.persistQueue();
    this.emitStatus(
      'syncing',
      `Preparing ${this.pendingCount} record${this.pendingCount === 1 ? '' : 's'} for first cloud sync…`
    );
  }

  private async queueMissingEntitySnapshots(): Promise<void> {
    if (!this.fyo) {
      return;
    }

    const revisionKeys = Object.keys(this.revisions);
    for (const entityType of ARTHIVOX_SYNC_ENTITY_TYPES) {
      const schema = this.fyo.schemaMap[entityType];
      if (!schema || schema.isChild || schema.isSingle) {
        continue;
      }

      // A revision for this type means this installation has already consumed
      // or uploaded cloud state for it. This check makes schema expansion safe
      // for upgrades without re-queuing thousands of old documents every boot.
      const prefix = `${entityType}::`;
      if (revisionKeys.some((key) => key.startsWith(prefix))) {
        continue;
      }

      const rows = await this.fyo.db.getAllRaw(entityType, { fields: ['name'] });
      for (const row of rows) {
        const name = row.name;
        if (typeof name !== 'string' || !name) {
          continue;
        }
        const key = entityKey(entityType, name);
        this.queue[key] = {
          entityType,
          entityId: name,
          deleted: false,
          queuedAt: new Date().toISOString(),
        };
      }
    }

    this.persistQueue();
    if (this.pendingCount) {
      this.emitStatus(
        'syncing',
        `Preparing ${this.pendingCount} newly supported record${this.pendingCount === 1 ? '' : 's'} for cloud sync…`
      );
    }
  }

  private async getLocalPayload(
    entityType: string,
    entityId: string
  ): Promise<Record<string, unknown>> {
    if (!this.fyo) {
      throw new Error('Local workspace is not available.');
    }

    const doc = await this.fyo.doc.getDoc(entityType, entityId, {
      skipDocumentCache: true,
    });
    const raw = this.fyo.db.converter.toRawValueMap(
      entityType,
      doc.getValidDict(false, true)
    ) as RawValueMap;
    return cloneJson(raw as Record<string, unknown>);
  }

  private async pushPendingChanges(): Promise<void> {
    if (!this.companyId || !this.fyo) {
      return;
    }

    const entries = Object.entries(this.queue).sort(
      ([, a], [, b]) => a.queuedAt.localeCompare(b.queuedAt)
    );

    for (const [key, item] of entries) {
      let payload: Record<string, unknown> = {};
      if (!item.deleted) {
        const localExists = await this.fyo.db.exists(
          item.entityType,
          item.entityId
        );

        if (!localExists) {
          // Only an ACTUALLY missing database row is allowed to become a cloud
          // deletion. Validation/loading failures must never delete cloud data.
          item.deleted = true;
          this.persistQueue();
        } else {
          try {
            payload = await this.getLocalPayload(
              item.entityType,
              item.entityId
            );
          } catch (error) {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(
              `Could not prepare ${item.entityType} ${item.entityId} for cloud sync: ${reason}`
            );
          }
        }
      }

      const expectedRevision = this.revisions[key] || 0;
      const result = await pushSyncRecord({
        companyId: this.companyId,
        entityType: item.entityType,
        entityId: item.entityId,
        payload,
        expectedRevision,
        deleted: item.deleted,
        deviceId: this.deviceId,
      });

      if (result.conflict || !result.applied) {
        const serverDeleted = !!result.server_deleted_at;
        if (
          result.revision > 0 &&
          serverDeleted === item.deleted &&
          payloadsEqual(result.server_payload || {}, payload)
        ) {
          // Same data reached the server from another attempt/device. Treat it
          // as already synchronized instead of bothering the user.
          this.revisions[key] = result.revision;
          delete this.queue[key];
          this.persistRevisions();
          this.persistQueue();
          continue;
        }

        const protectedRecord = await this.isProtectedLocalRecord(
          item.entityType,
          item.entityId
        );
        this.setConflict({
          companyId: this.companyId,
          entityType: item.entityType,
          entityId: item.entityId,
          source: 'push',
          message: `Sync conflict in ${item.entityType} ${item.entityId}. ArthivoX preserved both versions for review.`,
          localPayload: payload,
          cloudPayload: result.server_payload || {},
          localDeleted: item.deleted,
          cloudDeleted: serverDeleted,
          cloudRevision: result.revision,
          cloudSeq: null,
          cloudUpdatedAt: result.server_updated_at,
          protectedRecord,
        });
      }

      this.revisions[key] = result.revision;
      delete this.queue[key];
      this.persistRevisions();
      this.persistQueue();
      this.emitStatus(
        'syncing',
        this.pendingCount
          ? `Syncing ${this.pendingCount} remaining change${this.pendingCount === 1 ? '' : 's'}…`
          : 'Local changes uploaded. Checking other devices…'
      );
    }
  }

  private async pullRemoteChanges(): Promise<void> {
    if (!this.companyId || !this.fyo) {
      return;
    }

    while (true) {
      const changes = await pullSyncChanges({
        companyId: this.companyId,
        afterSeq: this.cursor,
        limit: 500,
      });
      if (!changes.length) {
        return;
      }

      for (const change of changes) {
        const key = entityKey(change.entity_type, change.entity_id);

        if (change.changed_from_device === this.deviceId) {
          this.revisions[key] = change.revision;
          this.cursor = Math.max(this.cursor, change.seq);
          this.persistRevisions();
          this.persistCursor();
          continue;
        }

        if (this.queue[key]) {
          const queued = this.queue[key];
          const localPayload = await this.getLocalConflictPayload(
            change.entity_type,
            change.entity_id,
            queued.deleted
          );
          const protectedRecord = await this.isProtectedLocalRecord(
            change.entity_type,
            change.entity_id
          );
          this.setConflict({
            companyId: this.companyId,
            entityType: change.entity_type,
            entityId: change.entity_id,
            source: 'pull',
            message: `Another device changed ${change.entity_type} ${change.entity_id} while this computer also has an unsynced edit. ArthivoX preserved both versions.`,
            localPayload,
            cloudPayload: change.payload || {},
            localDeleted: queued.deleted,
            cloudDeleted: !!change.deleted_at,
            cloudRevision: change.revision,
            cloudSeq: change.seq,
            cloudUpdatedAt: change.changed_at,
            protectedRecord,
          });
        }

        try {
          await this.applyRemoteChange(change);
        } catch (error) {
          if (error instanceof CloudSyncConflictError) {
            const protectedRecord = await this.isProtectedLocalRecord(
              change.entity_type,
              change.entity_id
            );
            const localPayload = await this.getLocalConflictPayload(
              change.entity_type,
              change.entity_id,
              false
            );
            this.setConflict({
              companyId: this.companyId,
              entityType: change.entity_type,
              entityId: change.entity_id,
              source: 'protected',
              message: error.message,
              localPayload,
              cloudPayload: change.payload || {},
              localDeleted: false,
              cloudDeleted: !!change.deleted_at,
              cloudRevision: change.revision,
              cloudSeq: change.seq,
              cloudUpdatedAt: change.changed_at,
              protectedRecord,
            });
          }
          throw error;
        }
        this.revisions[key] = change.revision;
        this.cursor = Math.max(this.cursor, change.seq);
        this.persistRevisions();
        this.persistCursor();
      }

      if (changes.length < 500) {
        return;
      }
    }
  }

  private async applyRemoteChange(change: ArthivoXCloudSyncChange): Promise<void> {
    if (!this.fyo) {
      return;
    }

    if (
      !ARTHIVOX_SYNC_ENTITY_TYPES.includes(
        change.entity_type as (typeof ARTHIVOX_SYNC_ENTITY_TYPES)[number]
      ) ||
      !this.fyo.schemaMap[change.entity_type]
    ) {
      return;
    }

    this.suppressLocalEvents = true;
    try {
      if (change.deleted_at) {
        await this.applyRemoteDeletion(change.entity_type, change.entity_id);
        return;
      }

      await this.applyRemoteUpsert(
        change.entity_type,
        change.entity_id,
        change.payload || {}
      );
    } finally {
      this.suppressLocalEvents = false;
    }
  }

  private async applyRemoteDeletion(
    entityType: string,
    entityId: string
  ): Promise<void> {
    if (!this.fyo || !(await this.fyo.db.exists(entityType, entityId))) {
      return;
    }

    const doc = await this.fyo.doc.getDoc(entityType, entityId, {
      skipDocumentCache: true,
    });
    if (!doc.canDelete) {
      throw new CloudSyncConflictError(
        `Cloud requested deletion of protected ${entityType} ${entityId}. ArthivoX left the local accounting record untouched.`
      );
    }
    await doc.delete();
  }

  private async applyRemoteUpsert(
    entityType: string,
    entityId: string,
    remotePayload: Record<string, unknown>
  ): Promise<void> {
    if (!this.fyo) {
      return;
    }

    const cleanRaw = stripRemoteMeta(remotePayload);
    cleanRaw.name = entityId;
    const remoteSubmitted = !!cleanRaw.submitted;
    const remoteCancelled = !!cleanRaw.cancelled;
    delete cleanRaw.submitted;
    delete cleanRaw.cancelled;

    const exists = await this.fyo.db.exists(entityType, entityId);
    let doc: Doc;

    if (!exists) {
      const insertRaw = {
        ...cleanRaw,
        submitted: false,
        cancelled: false,
      } as RawValueMap;
      doc = this.fyo.doc.getNewDoc(entityType, insertRaw, true);
      await doc.sync();
    } else {
      doc = await this.fyo.doc.getDoc(entityType, entityId, {
        skipDocumentCache: true,
      });

      if (doc.isSubmitted) {
        if (!remoteSubmitted) {
          throw new CloudSyncConflictError(
            `Cloud version of ${entityType} ${entityId} is not submitted, but the local accounting document is already submitted.`
          );
        }
      } else {
        const docValues = this.fyo.db.converter.toDocValueMap(
          entityType,
          cleanRaw as RawValueMap
        ) as DocValueMap;

        // Doc.set() appends table rows by design. Clear each child collection
        // first so remote edits replace rows instead of duplicating them.
        for (const field of doc.schema.fields) {
          if (field.fieldtype === FieldTypeEnum.Table) {
            (doc as unknown as Record<string, unknown>)[field.fieldname] = [];
          }
        }

        await doc.setMultiple(docValues);
        if (doc.dirty) {
          await doc.sync();
        }
      }
    }

    if (remoteSubmitted && !doc.isSubmitted) {
      await doc.submit();
    }
    if (remoteCancelled && !doc.isCancelled) {
      if (!doc.isSubmitted) {
        await doc.submit();
      }
      await doc.cancel();
    }
  }
}

const engine = new ArthivoXCloudSyncEngine();

export async function startCloudSync(fyo: Fyo, companyId: string): Promise<void> {
  await engine.start(fyo, companyId);
}

export async function stopCloudSync(): Promise<void> {
  await engine.stop();
}

export async function forceCloudSync(): Promise<void> {
  await engine.syncNow();
}

export function getCloudSyncStatus(): ArthivoXSyncStatus {
  return engine.getStatus();
}

export function getCurrentSyncConflict(): ArthivoXSyncConflict | null {
  return engine.getConflict();
}

export function openCloudConflictResolver(): void {
  window.dispatchEvent(new Event(ARTHIVOX_OPEN_CONFLICT_EVENT));
}

export async function resolveCloudConflict(
  strategy: 'local' | 'cloud'
): Promise<void> {
  await engine.resolveConflict(strategy);
}

export function setCloudSyncCursorForRestore(
  companyId: string,
  sequence: number | null | undefined
): void {
  const seq = Number(sequence || 0);

  // A restored SQLite file must not inherit queue/revision/conflict state from
  // the database that was open before the restore.
  localStorage.removeItem(`${QUEUE_PREFIX}${companyId}`);
  localStorage.removeItem(`${REVISION_PREFIX}${companyId}`);
  localStorage.removeItem(`${CONFLICT_PREFIX}${companyId}`);

  if (seq > 0) {
    localStorage.setItem(`${CURSOR_PREFIX}${companyId}`, String(seq));
    // The backup checkpoint is intentional. Mark it as current-state format so
    // startup seeds revisions then pulls only changes newer than the backup.
    localStorage.setItem(
      `${SYNC_STATE_VERSION_PREFIX}${companyId}`,
      String(CURRENT_SYNC_STATE_VERSION)
    );
  } else {
    localStorage.removeItem(`${CURSOR_PREFIX}${companyId}`);
    localStorage.removeItem(`${SYNC_STATE_VERSION_PREFIX}${companyId}`);
  }
}
