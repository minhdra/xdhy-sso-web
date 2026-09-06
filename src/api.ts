// sso-web là frontend app độc lập (port riêng, không đi qua gateway để phục vụ
// trang) - gọi API cross-origin sang gateway, cần URL tuyệt đối
// (VITE_GATEWAY_URL, build arg). Mọi endpoint đi qua 1 tiền tố /api/sso/* ->
// /api-sso/* (xem gateway.config.yml ssoApiPipeline + SSO_ORIGIN cho CORS).
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? '';
const BASE = `${GATEWAY_URL}/api/sso`;

export interface ApiError {
  message: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & Partial<ApiError>;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
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
  access_count: number;
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
  position_name: string | null;
}
export const getAdminUsers = () => get<AdminUser[]>('admin/users');
export const getAppAccessRequest = (app_id: string) =>
  get<AdminUser[]>(`admin/apps/${app_id}/access`);
export const setAppAccessRequest = (app_id: string, user_ids: string[]) =>
  post<{ success: boolean; message: string }>(`admin/apps/${app_id}/access`, { user_ids });

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

// Ảnh avatar: giá trị lưu ở DB có 2 dạng - đường dẫn mới của api-sso
// ("/api-sso/uploads/...") hoặc đường dẫn cũ kế thừa từ api-core
// ("uploads\\yyyy-mm-dd\\..."). Trả về URL trình duyệt tải được.
export function avatarSrc(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^https?:\/\//.test(raw)) return raw;
  const clean = raw.replace(/\\/g, '/');
  if (clean.startsWith('/api-sso/')) return `${GATEWAY_URL}/api/sso${clean.slice('/api-sso'.length)}`;
  // Đường dẫn cũ do api-core lưu -> phục vụ qua pipeline api-core.
  return `${GATEWAY_URL}/api/api-core/${clean.replace(/^\/+/, '')}`;
}
