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
