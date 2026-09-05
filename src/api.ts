// sso-web giờ là frontend app độc lập (port riêng, không đi qua gateway để
// phục vụ trang nữa) - gọi API cross-origin thật sang gateway, cần URL tuyệt
// đối (VITE_GATEWAY_URL, build arg). Gateway đã có CORS riêng cho origin này
// (xem gateway.config.yml loginServicePipeline + SSO_ORIGIN).
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? '';

export interface ApiError {
  message: string;
}

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T & Partial<ApiError> }> {
  const res = await fetch(`${GATEWAY_URL}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

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

export const forgotPasswordRequest = (email: string) =>
  post<{ message: string; success: boolean }>('forgot-password', { email });

export const resetPasswordConfirmRequest = (token: string, newPassword: string) =>
  post<{ message: string; success: boolean }>('reset-password-confirm', { token, newPassword });
