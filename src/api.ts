// sso-web same-origin với gateway - production qua nginx proxy của chính nó
// (config/default.conf), dev qua vite server.proxy (vite.config.ts) - giống
// hệt build-web/task-web (VITE_BASE_URL=/api, xem build-web/src/constant/config.ts).
// Mọi endpoint đi qua tiền tố /api/api-sso/* -> /api-sso/* (xem gateway.config.yml
// ssoApiPipeline). Prefix "api-sso" khớp /api/api-core, /api/api-task.
const BASE_URL = import.meta.env.VITE_BASE_URL;
const BASE = `${BASE_URL}/api-sso`;

export interface ApiError {
  message: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & Partial<ApiError>;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const diagnosticHeaders = appRequestHeaders();
  const controller = new AbortController();
  const timeoutMs = path === 'me' ? 12_000 : 30_000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method,
      headers: {
        ...diagnosticHeaders,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      credentials: 'include',
      // Dữ liệu phiên/quyền không được dùng lại từ HTTP cache. Trước đây
      // browser liên tục revalidate /me bằng ETag (server trả 304) trong lúc
      // route login <-> protected remount, làm loading nháy và gọi /me dồn dập.
      cache: 'no-store',
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (path === 'me' || path === 'refresh') {
      recordDiagnostic(path === 'me' ? 'session_check_completed' : 'refresh_completed', {
        path,
        status: res.status,
        requestId: res.headers.get('X-Request-Id') ?? diagnosticHeaders['X-Request-Id'],
      });
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    if (path === 'me' || path === 'refresh') {
      recordDiagnostic(path === 'me' ? 'session_check_failed' : 'refresh_failed', {
        path,
        requestId: diagnosticHeaders['X-Request-Id'],
        detail: controller.signal.aborted ? 'timeout' : 'network',
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);

// ---- Auth ----
export interface LoginPayload {
  username: string;
  password: string;
  remember: boolean;
}

export interface LoginResponseUser {
  user_id: string;
  full_name: string;
  user_name: string;
  role_group: string;
}

export const loginRequest = (payload: LoginPayload) => post<LoginResponseUser>('login', payload);
export const refreshRequest = () => post<{ success: boolean }>('refresh');
export const logoutRequest = () => post<{ success: boolean }>('logout');
export const forgotPasswordRequest = (email: string) =>
  post<{ message: string; success: boolean }>('forgot-password', { email });
export const resetPasswordConfirmRequest = (token: string, newPassword: string) =>
  post<{ message: string; success: boolean }>('reset-password-confirm', { token, newPassword });

// ---- Me / profile ----
export interface Me {
  user_id: string;
  full_name: string;
  user_name: string;
  avatar: string | null;
  gender: number | null;
  date_of_birth: string | null;
  email: string | null;
  phone_number: string | null;
  position_name: string | null;
  // true nếu user có role "sa" (Quản trị hệ thống) - dùng để hiện/ẩn tab
  // "Quản lý ứng dụng". Tính lại mỗi lần gọi ở BE, không tin JWT cache được.
  is_admin: boolean;
}

export const getMe = () => get<Me>('me');

// Hồ sơ đầy đủ cho trang Quản lý tài khoản (thêm phòng ban/chức vụ/chi nhánh).
export interface AccountProfile {
  user_id: string;
  user_name: string;
  type: string | null;
  full_name: string;
  avatar: string | null;
  gender: number | null;
  date_of_birth: string | null;
  email: string | null;
  phone_number: string | null;
  position_name: string | null;
  department_name: string | null;
  branch_name: string | null;
  is_admin: boolean;
}
export const getProfile = () => get<AccountProfile>('account/profile');

export interface UpdateProfilePayload {
  full_name: string;
  email: string;
  phone_number: string;
  gender: number | null;
  date_of_birth: string | null;
}
export const updateProfileRequest = (payload: UpdateProfilePayload) =>
  put<{ success: boolean; message: string }>('account/profile', payload);

export const changePasswordRequest = (oldPassword: string, newPassword: string) =>
  post<{ success: boolean; message: string }>('account/change-password', { oldPassword, newPassword });

// Avatar - multipart, field "file".
export async function uploadAvatarRequest(
  file: File,
): Promise<ApiResult<{ success: boolean; message: string; avatar: string }>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/account/avatar`, {
    method: 'POST',
    credentials: 'include',
    headers: appRequestHeaders(),
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---- Apps ----
// Trước đây là config tĩnh (src/config/apps.ts bên api-sso), giờ lấy từ bảng
// a_app + phân quyền a_app_access - xem "Quản lý ứng dụng" (AppsAdminPanel).
export interface SsoApp {
  app_id: string;
  app_key: string;
  app_name: string;
  description: string | null;
  url: string;
  color: string;
  icon: string | null;
}
export const getApps = () => get<SsoApp[]>('apps');

// ---- Quản lý ứng dụng (chỉ admin - BE tự chặn 403 nếu gọi nhầm) ----
export interface AdminApp extends SsoApp {
  sort_order: number;
  direct_access_count: number;
  eligible_user_count: number;
  effective_access_count: number;
}
export const getAdminApps = () => get<AdminApp[]>('admin/apps');

export interface UpsertAppPayload {
  app_id?: string | null;
  app_key: string;
  app_name: string;
  description?: string;
  url?: string;
  color?: string;
  sort_order?: number;
}
export const upsertAppRequest = (payload: UpsertAppPayload) =>
  post<{ success: boolean; message: string; app_id: string }>('admin/apps', payload);

export async function uploadAppIconRequest(appId: string, file: Blob): Promise<ApiResult<{ icon: string }>> {
  const body = new FormData();
  body.append('file', file, 'icon.png');
  const res = await fetch(`${BASE}/admin/apps/${encodeURIComponent(appId)}/icon`, {
    method: 'POST', body, credentials: 'include', cache: 'no-store',
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export const deleteAppRequest = (app_id: string) =>
  post<{ success: boolean; message: string }>('admin/apps/delete', { app_id });

export interface AdminUser {
  user_id: string;
  user_name: string;
  full_name: string;
  // Đường dẫn lưu DB (chưa phải URL) - dùng avatarSrc() bên dưới để ra URL
  // gọi được thật.
  avatar: string | null;
  position_name: string | null;
}
export const getAdminUsers = () => get<AdminUser[]>('admin/users');

export interface AppAccessCandidate extends AdminUser {
  position_id: number | null;
}

export interface AppAccessCandidatesPage {
  rows: AppAccessCandidate[];
  total: number;
  page: number;
  page_size: number;
}

export const getAppAccessRequest = (app_id: string) =>
  get<AdminUser[]>(`admin/apps/${app_id}/access`);
export const getAppAccessCandidatesRequest = (
  app_id: string,
  filters: { q?: string; position_id?: number; page: number; page_size: number },
) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.page_size),
  });
  if (filters.q) params.set('q', filters.q);
  if (filters.position_id) params.set('position_id', String(filters.position_id));
  return get<AppAccessCandidatesPage>(
    `admin/apps/${app_id}/access-candidates?${params.toString()}`,
  );
};
export const addAppAccessRequest = (app_id: string, user_ids: string[]) =>
  post<{ success: boolean; message: string; affected: number }>(
    `admin/apps/${app_id}/access/add`,
    { user_ids },
  );
export const removeAppAccessRequest = (app_id: string, user_ids: string[]) =>
  post<{ success: boolean; message: string; affected: number }>(
    `admin/apps/${app_id}/access/remove`,
    { user_ids },
  );

// ---- Quản trị người dùng / tổ chức / nhóm quyền (chỉ admin, 26/09/2026 -
// chuyển từ build-web/api-core sang SSO). Mọi thay đổi được api-sso đồng bộ
// sang các app (tài chính, công việc, chat, meeting).
export interface Paged<T> {
  totalItems: number;
  page: number;
  pageSize: number;
  pageCount: number;
  data: T[];
}
export interface OkMessage {
  success: boolean;
  message: string;
}
export interface DropdownItem {
  value: number | string;
  label: string;
}

export interface OrgUserRow {
  user_id: string;
  user_name: string;
  full_name: string;
  avatar: string | null;
  email: string | null;
  phone_number: string | null;
  online_flag: number | null;
  position_name: string | null;
  branch_name: string | null;
  department_name: string | null;
  role_group: string | null;
}
export interface OrgUserDetail {
  user_id: string;
  user_name: string;
  type: string | null;
  description: string | null;
  online_flag: number | null;
  full_name: string;
  avatar: string | null;
  gender: number | null;
  date_of_birth: string | null;
  email: string | null;
  phone_number: string | null;
  branch_id: number | null;
  department_id: number | null;
  position_id: number | null;
  role_ids: string[];
}
export interface OrgUserPayload {
  user_id?: string;
  user_name?: string;
  password?: string;
  full_name: string;
  email: string;
  phone_number?: string;
  gender?: number | null;
  date_of_birth?: string | null;
  type?: string;
  description?: string;
  branch_id: number;
  department_id: number;
  position_id: number;
  role_ids?: string[];
  // Trùng tên đăng nhập với tài khoản đã xoá (409 DELETED_USER_EXISTS): admin
  // chọn khôi phục tài khoản cũ hay tạo tài khoản mới rồi gửi lại.
  deleted_user_action?: 'restore' | 'new';
}
export interface DeletedUserConflict {
  code: 'DELETED_USER_EXISTS';
  deleted_user: {
    user_id: string;
    user_name: string;
    full_name: string | null;
    email: string | null;
    phone_number: string | null;
    deleted_at: string | null;
  };
}
export const searchOrgUsers = (body: {
  pageIndex: number;
  pageSize: number;
  search_content?: string;
  branch_id?: number | null;
  department_id?: number | null;
}) => post<Paged<OrgUserRow>>('admin/org/users/search', body);
export const getOrgUser = (user_id: string) =>
  get<OrgUserDetail>(`admin/org/users/${encodeURIComponent(user_id)}`);
export const createOrgUser = (payload: OrgUserPayload) =>
  post<OkMessage & { user_id: string; restored?: boolean; data?: DeletedUserConflict }>('admin/org/users', payload);
export const updateOrgUser = (payload: OrgUserPayload) => put<OkMessage>('admin/org/users', payload);
export const deleteOrgUsers = (user_ids: string[]) =>
  post<OkMessage>('admin/org/users/delete', { user_ids });
export const lockOrgUser = (user_id: string, online_flag: number) =>
  post<OkMessage>('admin/org/users/lock', { user_id, online_flag });
// Admin đổi avatar hộ user - multipart field "file" (FE đã cắt vuông + nén).
export async function uploadOrgUserAvatar(
  user_id: string,
  file: File,
): Promise<ApiResult<OkMessage & { avatar: string }>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/admin/org/users/${encodeURIComponent(user_id)}/avatar`, {
    method: 'POST',
    credentials: 'include',
    headers: appRequestHeaders(),
    body: form,
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}
export const resetOrgUserPassword = (user_id: string) =>
  post<OkMessage & { new_password: string; emailed: boolean }>('admin/org/users/reset-password', {
    user_id,
  });

// Chi nhánh / phòng ban / chức vụ dùng chung 1 khuôn màn hình.
export type OrgUnitKind = 'branches' | 'departments' | 'positions';
export interface OrgUnitRow {
  branch_id?: number;
  branch_name?: string;
  department_id?: number;
  department_name?: string;
  position_id?: number;
  position_name?: string;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  description?: string | null;
}
export const searchOrgUnits = (kind: OrgUnitKind, body: { pageIndex: number; pageSize: number; search_content?: string }) =>
  post<Paged<OrgUnitRow>>(`admin/org/${kind}/search`, body);
export const getOrgUnitDropdown = (kind: OrgUnitKind) => get<DropdownItem[]>(`admin/org/${kind}/dropdown`);
export const upsertOrgUnit = (kind: OrgUnitKind, payload: Record<string, unknown>) =>
  post<OkMessage>(`admin/org/${kind}`, payload);
export const deleteOrgUnits = (kind: OrgUnitKind, ids: number[]) =>
  post<OkMessage>(`admin/org/${kind}/delete`, { ids });

export interface OrgRole {
  role_id: string;
  role_code: string;
  role_name: string;
  description: string | null;
}
export const searchOrgRoles = (body: { pageIndex: number; pageSize: number; search_content?: string }) =>
  post<Paged<OrgRole>>('admin/org/roles/search', body);
export const getOrgRoleDropdown = () => get<DropdownItem[]>('admin/org/roles/dropdown');
export const upsertOrgRole = (payload: Partial<Omit<OrgRole, 'role_id'>> & { role_id?: string | null }) => post<OkMessage>('admin/org/roles', payload);
export const deleteOrgRoles = (role_ids: string[]) => post<OkMessage>('admin/org/roles/delete', { role_ids });

export type SyncTarget = 'finance' | 'task' | 'chat' | 'meeting';
export interface SyncStatus {
  enabled_targets: SyncTarget[];
  summary: { target: SyncTarget; pending: number; failed: number; last_error: string | null; oldest_pending: string | null }[];
  failed: {
    id: string;
    target: SyncTarget;
    entity: string;
    op: string;
    entity_id: string;
    attempts: number;
    last_error: string | null;
    updated_at: string;
  }[];
}
export const getSyncStatus = () => get<SyncStatus>('admin/org/sync/status');
export const retrySync = (target?: SyncTarget | null) =>
  post<OkMessage & { count: number }>('admin/org/sync/retry', { target: target ?? null });
export const resyncTarget = (target: SyncTarget) =>
  post<OkMessage & { count: number }>('admin/org/sync/resync', { target });

// ---- Thương hiệu (26/09/2026) ----
export interface Branding {
  org_name: string;
  short_name: string;
  app_name: string;
  tagline: string | null;
  login_heading: string | null;
  login_description: string | null;
  primary_color: string;
  footer_text: string | null;
  footer_links: { label: string; url: string }[];
  // URL tải được (đã resolve) hoặc null = dùng file mặc định của sso-web
  logo_light: string | null;
  logo_dark: string | null;
  favicon: string | null;
  login_background: string | null;
}
export type BrandingImageKind = 'logo_light' | 'logo_dark' | 'favicon' | 'login_background';
export type BrandingText = Omit<Branding, BrandingImageKind>;
export const getBranding = () => get<Branding>('branding');
export const updateBranding = (payload: BrandingText) => put<OkMessage>('admin/branding', payload);
export async function uploadBrandingImage(
  kind: BrandingImageKind,
  file: File,
): Promise<ApiResult<{ success: boolean; url: string }>> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/admin/branding/${kind}`, {
    method: 'POST',
    credentials: 'include',
    headers: appRequestHeaders(),
    body: form,
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}
export const resetBrandingImage = (kind: BrandingImageKind) =>
  request<{ success: boolean }>('DELETE', `admin/branding/${kind}`);

// ---- Sessions ----
export interface SsoSession {
  session_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  remember: boolean;
  current: boolean;
}
export const getSessions = () => get<SsoSession[]>('account/sessions');
export const revokeSessionRequest = (session_id: string) =>
  post<{ success: boolean; message: string }>('account/sessions/revoke', { session_id });

// Ảnh avatar. Từ 09/09/2026 api-sso (/me, /account/profile) đã trả URL sẵn
// sàng ("/api/api-sso/uploads/..." hoặc "/api/api-core/uploads/...") - hàm này
// chỉ còn để xử lý path THÔ từ chỗ khác (vd trang quản trị app dùng proc
// a_AdminListUsers trả nguyên "uploads\\yyyy-mm-dd\\..." hoặc "/api-sso/...").
export function avatarSrc(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^https?:\/\//.test(raw)) return raw;
  if (raw.startsWith('/api/')) return raw; // đã resolve sẵn từ backend
  const clean = raw.replace(/\\/g, '/');
  const encode = (p: string) => p.split('/').map(encodeURIComponent).join('/');
  if (clean.startsWith('/api-sso/')) {
    // "/api-sso/uploads/x" -> "/api" + "/api-sso/uploads/x" (gateway
    // /api/api-sso/* -> /api-sso/*).
    return `${BASE_URL}/${encode(clean.replace(/^\/+/, ''))}`;
  }
  // Đường dẫn cũ do api-core lưu -> phục vụ qua pipeline api-core.
  return `${BASE_URL}/api-core/${encode(clean.replace(/^\/+/, ''))}`;
}
import { appRequestHeaders, recordDiagnostic } from './diagnostics';
