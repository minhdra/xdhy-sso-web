// Đồng bộ theme với app chính (build-web) qua cookie `theme_mode` (không
// httpOnly, domain cha dùng chung) - KHÔNG tự đoán theo prefers-color-scheme
// của OS. build-web tự nó cũng không theo OS, luôn mặc định light trừ khi
// user đã từng bấm dark (xem build-web/src/store/layout/store.ts) - trang
// login phải khớp đúng mặc định đó (bug thật đã gặp: đoán theo OS khiến
// login ra dark trong khi app chính đang light).
export type ThemeMode = 'light' | 'dark';

export function getThemeModeFromCookie(): ThemeMode {
  const match = document.cookie.match(/(?:^|;\s*)theme_mode=([^;]*)/);
  return match && decodeURIComponent(match[1]) === 'dark' ? 'dark' : 'light';
}

export const palette = {
  light: { pageBg: '#fcfafc', cardBg: '#ffffff', border: '#e8eaed', text: '#16222c', textSecondary: '#6b7280' },
  dark: { pageBg: '#101215', cardBg: '#1a1c20', border: '#2a2d31', text: '#e7edf2', textSecondary: '#9a9fa6' },
};

export const PRIMARY = '#2563a6';
