const SUPABASE_URL = 'https://wbcjqvwvehwujlmqhohs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vwIVWggTuanVrHHTeuG0DA_nVsX4MYC';
const SESSION_STORAGE_KEY = 'arthivox-cloud-session-v1';

export interface ArthivoXCloudUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
}

export interface ArthivoXCloudSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: ArthivoXCloudUser;
}

export interface ArthivoXCloudCompany {
  id: string;
  name: string;
  country_code: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}


async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('ArthivoX Cloud did not respond. Check your internet connection.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

interface SupabaseErrorPayload {
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
  code?: string;
}

function authHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function normalizeSession(session: ArthivoXCloudSession): ArthivoXCloudSession {
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
  }
  return session;
}

function saveSession(session: ArthivoXCloudSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(normalizeSession(session))
  );
}

export function getStoredSession(): ArthivoXCloudSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as ArthivoXCloudSession;
    if (!session.access_token || !session.refresh_token || !session.user?.id) {
      saveSession(null);
      return null;
    }
    return normalizeSession(session);
  } catch {
    saveSession(null);
    return null;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = (data ?? {}) as SupabaseErrorPayload;
    const message =
      payload.msg ||
      payload.message ||
      payload.error_description ||
      payload.error ||
      `Cloud request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

async function refreshSession(
  refreshToken: string
): Promise<ArthivoXCloudSession> {
  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );

  const session = normalizeSession(
    await parseResponse<ArthivoXCloudSession>(response)
  );
  saveSession(session);
  return session;
}

export async function getValidSession(): Promise<ArthivoXCloudSession | null> {
  const session = getStoredSession();
  if (!session) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt > now + 90) {
    return session;
  }

  try {
    return await refreshSession(session.refresh_token);
  } catch {
    saveSession(null);
    return null;
  }
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<ArthivoXCloudSession> {
  const response = await fetchWithTimeout(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email: email.trim(), password }),
    }
  );

  const session = normalizeSession(
    await parseResponse<ArthivoXCloudSession>(response)
  );
  saveSession(session);
  return session;
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<void> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = await parseResponse<{
    access_token?: string;
    refresh_token?: string;
    user?: ArthivoXCloudUser;
    expires_in?: number;
    expires_at?: number;
  }>(response);

  // Email confirmation should be enabled for ArthivoX. If the project is ever
  // configured to auto-confirm, keep the returned session instead of losing it.
  if (data.access_token && data.refresh_token && data.user) {
    saveSession(
      normalizeSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: data.expires_at,
        user: data.user,
      })
    );
  }
}

export async function verifySignupOtp(
  email: string,
  token: string
): Promise<ArthivoXCloudSession> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      type: 'email',
      email: email.trim(),
      token: token.trim(),
    }),
  });

  const session = normalizeSession(
    await parseResponse<ArthivoXCloudSession>(response)
  );
  saveSession(session);
  return session;
}

export async function resendSignupOtp(email: string): Promise<void> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/resend`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type: 'signup', email: email.trim() }),
  });
  await parseResponse<unknown>(response);
}


/**
 * Starts the password recovery flow. Supabase deliberately avoids disclosing
 * whether an email exists; callers should show a neutral success message.
 */
export async function requestPasswordRecoveryOtp(email: string): Promise<void> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email: email.trim() }),
  });
  await parseResponse<unknown>(response);
}

/**
 * Verifies the emailed recovery OTP and returns a short-lived recovery session.
 * This session is intentionally NOT persisted as the normal ArthivoX session.
 */
export async function verifyRecoveryOtp(
  email: string,
  token: string
): Promise<ArthivoXCloudSession> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      type: 'recovery',
      email: email.trim(),
      token: token.trim(),
    }),
  });

  return normalizeSession(await parseResponse<ArthivoXCloudSession>(response));
}

/**
 * Uses the verified recovery session to set a new password, then invalidates
 * that temporary session. The user signs in normally with the new password.
 */
export async function updatePasswordWithRecoverySession(
  session: ArthivoXCloudSession,
  password: string
): Promise<void> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: authHeaders(session.access_token),
    body: JSON.stringify({ password }),
  });
  await parseResponse<unknown>(response);

  try {
    await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders(session.access_token),
    });
  } catch {
    // Password update already succeeded; failure to invalidate the short-lived
    // recovery token must not make the user repeat the reset flow.
  }
}

export async function signOut(): Promise<void> {
  const session = getStoredSession();
  try {
    if (session?.access_token) {
      await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: authHeaders(session.access_token),
      });
    }
  } finally {
    saveSession(null);
  }
}

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
  retry = true,
  timeoutMs = 12000
): Promise<Response> {
  const session = await getValidSession();
  if (!session) {
    throw new Error('Your ArthivoX session has expired. Please sign in again.');
  }

  const headers = {
    ...authHeaders(session.access_token),
    ...(init.headers as Record<string, string> | undefined),
  };
  const response = await fetchWithTimeout(
    `${SUPABASE_URL}${path}`,
    { ...init, headers },
    timeoutMs
  );

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession(session.refresh_token);
    return await fetchWithTimeout(
      `${SUPABASE_URL}${path}`,
      {
        ...init,
        headers: {
          ...authHeaders(refreshed.access_token),
          ...(init.headers as Record<string, string> | undefined),
        },
      },
      timeoutMs
    );
  }

  return response;
}

export async function listCompanies(): Promise<ArthivoXCloudCompany[]> {
  const response = await authorizedFetch(
    '/rest/v1/companies?select=id,name,country_code,currency,created_at,updated_at&deleted_at=is.null&order=updated_at.desc'
  );
  return await parseResponse<ArthivoXCloudCompany[]>(response);
}

export async function createCompany(input: {
  name: string;
  countryCode?: string | null;
  currency?: string | null;
}): Promise<ArthivoXCloudCompany> {
  const response = await authorizedFetch('/rest/v1/rpc/create_company', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_name: input.name.trim(),
      p_country_code: input.countryCode || null,
      p_currency: input.currency || null,
    }),
  });

  const result = await parseResponse<
    ArthivoXCloudCompany | ArthivoXCloudCompany[]
  >(response);
  if (Array.isArray(result)) {
    if (!result.length) {
      throw new Error('ArthivoX Cloud did not return the new company.');
    }
    return result[0];
  }
  return result;
}

export async function updateCompany(
  companyId: string,
  input: { name: string }
): Promise<ArthivoXCloudCompany> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error('Company name must be between 2 and 80 characters.');
  }

  const query = new URLSearchParams();
  query.set('id', `eq.${companyId}`);
  query.set(
    'select',
    'id,name,country_code,currency,created_at,updated_at'
  );

  const response = await authorizedFetch(
    `/rest/v1/companies?${query.toString()}`,
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

// ---------------------------------------------------------------------------
// ArthivoX record sync API (v10)
// ---------------------------------------------------------------------------

export interface ArthivoXCloudSyncRecord {
  entity_type: string;
  entity_id: string;
  revision: number;
  payload: Record<string, unknown>;
  deleted_at: string | null;
  updated_at?: string;
  updated_from_device?: string | null;
}

export interface ArthivoXCloudSyncChange {
  seq: number;
  entity_type: string;
  entity_id: string;
  revision: number;
  payload: Record<string, unknown>;
  deleted_at: string | null;
  changed_from_device: string | null;
  changed_at: string;
}

export interface ArthivoXPushSyncResult {
  applied: boolean;
  conflict: boolean;
  revision: number;
  server_payload: Record<string, unknown> | null;
  server_deleted_at: string | null;
  server_updated_at: string | null;
}

export async function registerCompanyDevice(input: {
  companyId: string;
  deviceId: string;
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
}): Promise<void> {
  const session = await getValidSession();
  if (!session) {
    throw new Error('Your ArthivoX session has expired. Please sign in again.');
  }

  const response = await authorizedFetch(
    '/rest/v1/company_devices?on_conflict=company_id,device_id',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        company_id: input.companyId,
        user_id: session.user.id,
        device_id: input.deviceId,
        device_name: input.deviceName || null,
        platform: input.platform || null,
        app_version: input.appVersion || null,
        last_seen_at: new Date().toISOString(),
      }),
    }
  );
  await parseResponse<unknown>(response);
}

export async function touchCompanyDevice(input: {
  companyId: string;
  deviceId: string;
  appVersion?: string | null;
}): Promise<void> {
  const query = new URLSearchParams({
    company_id: `eq.${input.companyId}`,
    device_id: `eq.${input.deviceId}`,
  });
  const response = await authorizedFetch(`/rest/v1/company_devices?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      last_seen_at: new Date().toISOString(),
      app_version: input.appVersion || null,
    }),
  });
  await parseResponse<unknown>(response);
}

export async function pushSyncRecord(input: {
  companyId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  expectedRevision: number;
  deleted?: boolean;
  deviceId?: string | null;
}): Promise<ArthivoXPushSyncResult> {
  const response = await authorizedFetch('/rest/v1/rpc/push_sync_record', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_company_id: input.companyId,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_payload: input.payload || {},
      p_expected_revision: Math.max(0, input.expectedRevision || 0),
      p_deleted: !!input.deleted,
      p_device_id: input.deviceId || null,
    }),
  });

  const rows = await parseResponse<ArthivoXPushSyncResult[]>(response);
  if (!rows.length) {
    throw new Error('ArthivoX Cloud returned an empty sync response.');
  }
  return rows[0];
}

export async function pullSyncChanges(input: {
  companyId: string;
  afterSeq?: number;
  limit?: number;
}): Promise<ArthivoXCloudSyncChange[]> {
  const response = await authorizedFetch('/rest/v1/rpc/pull_sync_changes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_company_id: input.companyId,
      p_after_seq: Math.max(0, input.afterSeq || 0),
      p_limit: Math.min(2000, Math.max(1, input.limit || 500)),
    }),
  });
  return await parseResponse<ArthivoXCloudSyncChange[]>(response);
}

export async function listSyncRecords(
  companyId: string,
  limit = 2000
): Promise<ArthivoXCloudSyncRecord[]> {
  const query = new URLSearchParams();
  query.set(
    'select',
    'entity_type,entity_id,revision,payload,deleted_at,updated_at,updated_from_device'
  );
  query.set('company_id', `eq.${companyId}`);
  query.set('order', 'entity_type.asc,entity_id.asc');
  query.set('limit', String(Math.min(10000, Math.max(1, limit))));
  const response = await authorizedFetch(`/rest/v1/sync_records?${query}`);
  return await parseResponse<ArthivoXCloudSyncRecord[]>(response);
}

export async function hasCloudSyncRecords(companyId: string): Promise<boolean> {
  const query = new URLSearchParams();
  query.set('select', 'entity_id');
  query.set('company_id', `eq.${companyId}`);
  query.set('limit', '1');
  const response = await authorizedFetch(`/rest/v1/sync_records?${query}`);
  const rows = await parseResponse<Array<{ entity_id: string }>>(response);
  return rows.length > 0;
}

export async function getLatestSyncSequence(
  companyId: string
): Promise<number> {
  const query = new URLSearchParams();
  query.set('select', 'seq');
  query.set('company_id', `eq.${companyId}`);
  query.set('order', 'seq.desc');
  query.set('limit', '1');

  const response = await authorizedFetch(`/rest/v1/sync_changes?${query}`);
  const rows = await parseResponse<Array<{ seq: number }>>(response);
  return Number(rows[0]?.seq || 0);
}


// ---------------------------------------------------------------------------
// ArthivoX private SQLite backup API (v11)
// ---------------------------------------------------------------------------

export interface ArthivoXCloudBackup {
  id: string;
  company_id: string;
  storage_path: string;
  sha256: string | null;
  size_bytes: number | null;
  database_schema_version: string | null;
  app_version: string | null;
  device_id: string | null;
  encrypted: boolean;
  encryption_version: string | null;
  encryption_kdf: string | null;
  encryption_iterations: number | null;
  encryption_salt: string | null;
  encryption_iv: string | null;
  plaintext_sha256: string | null;
  sync_change_seq: number | null;
  created_by: string;
  created_at: string;
}

function encodeStorageObjectPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export async function uploadCompanyBackup(input: {
  companyId: string;
  storagePath: string;
  data: Uint8Array;
  sha256: string;
  sizeBytes: number;
  databaseSchemaVersion?: string | null;
  appVersion?: string | null;
  deviceId?: string | null;
  encrypted?: boolean;
  encryptionVersion?: string | null;
  encryptionKdf?: string | null;
  encryptionIterations?: number | null;
  encryptionSalt?: string | null;
  encryptionIv?: string | null;
  plaintextSha256?: string | null;
  syncChangeSeq?: number | null;
}): Promise<ArthivoXCloudBackup> {
  const session = await getValidSession();
  if (!session) {
    throw new Error('Your ArthivoX session has expired. Please sign in again.');
  }

  if (!input.storagePath.startsWith(`${input.companyId}/`)) {
    throw new Error('Invalid cloud backup path.');
  }

  const encodedPath = encodeStorageObjectPath(input.storagePath);
  const uploadResponse = await authorizedFetch(
    `/storage/v1/object/company-backups/${encodedPath}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: input.data as unknown as BodyInit,
    },
    true,
    120000
  );
  await parseResponse<unknown>(uploadResponse);

  const metadataResponse = await authorizedFetch('/rest/v1/company_backups', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      company_id: input.companyId,
      storage_path: input.storagePath,
      sha256: input.sha256,
      size_bytes: input.sizeBytes,
      database_schema_version: input.databaseSchemaVersion || null,
      app_version: input.appVersion || null,
      device_id: input.deviceId || null,
      encrypted: !!input.encrypted,
      encryption_version: input.encryptionVersion || null,
      encryption_kdf: input.encryptionKdf || null,
      encryption_iterations: input.encryptionIterations || null,
      encryption_salt: input.encryptionSalt || null,
      encryption_iv: input.encryptionIv || null,
      plaintext_sha256: input.plaintextSha256 || null,
      sync_change_seq: input.syncChangeSeq ?? null,
      created_by: session.user.id,
    }),
  });

  const rows = await parseResponse<ArthivoXCloudBackup[]>(metadataResponse);
  if (!rows.length) {
    throw new Error('ArthivoX Cloud stored the backup but did not return its metadata.');
  }
  return rows[0];
}

export async function getLatestCompanyBackup(
  companyId: string
): Promise<ArthivoXCloudBackup | null> {
  const query = new URLSearchParams();
  query.set(
    'select',
    'id,company_id,storage_path,sha256,size_bytes,database_schema_version,app_version,device_id,encrypted,encryption_version,encryption_kdf,encryption_iterations,encryption_salt,encryption_iv,plaintext_sha256,sync_change_seq,created_by,created_at'
  );
  query.set('company_id', `eq.${companyId}`);
  query.set('order', 'created_at.desc');
  query.set('limit', '1');

  const response = await authorizedFetch(`/rest/v1/company_backups?${query}`);
  const rows = await parseResponse<ArthivoXCloudBackup[]>(response);
  return rows[0] || null;
}

export async function downloadCompanyBackup(
  storagePath: string
): Promise<Uint8Array> {
  const encodedPath = encodeStorageObjectPath(storagePath);
  const response = await authorizedFetch(
    `/storage/v1/object/authenticated/company-backups/${encodedPath}`,
    {},
    true,
    120000
  );

  if (!response.ok) {
    await parseResponse<unknown>(response);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
