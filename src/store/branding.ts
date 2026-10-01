import { create } from 'zustand';

import { type Branding, getBranding } from '../api';

// Thông tin thương hiệu (tên tổ chức, logo, màu, footer) lưu ở api-sso
// (a_org_setting, 26/09/2026) - mỗi công ty 1 triển khai tự đổi được, không
// sửa code/build lại. DEFAULT_BRANDING = giá trị trước đây ghi cứng, dùng khi
// API chưa trả về / lỗi để giao diện không trống.
export const DEFAULT_BRANDING: Branding = {
  org_name: 'An Trường Phát Hưng Yên',
  short_name: 'XDHY',
  app_name: 'Tài khoản',
  tagline: 'Một tài khoản cho mọi ứng dụng',
  login_heading: 'Cổng truy cập chung của doanh nghiệp',
  login_description: 'Đăng nhập một lần để sử dụng các ứng dụng nội bộ được kết nối trong hệ thống.',
  primary_color: '#2563a6',
  footer_text: '© {year} An Trường Phát Hưng Yên. All rights reserved.',
  footer_links: [],
  logo_light: null,
  logo_dark: null,
  favicon: null,
  login_background: null,
};
export const DEFAULT_LOGO = '/logo.png';
const DEFAULT_FAVICON = '/favicon.ico';

interface BrandingState {
  branding: Branding;
  loaded: boolean;
  load: () => Promise<void>;
  set: (branding: Branding) => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: DEFAULT_BRANDING,
  loaded: false,
  load: async () => {
    try {
      const res = await getBranding();
      if (res.ok) {
        applyBranding(res.data);
        set({ branding: res.data, loaded: true });
        return;
      }
    } catch {
      // mạng lỗi - giữ mặc định
    }
    set({ loaded: true });
  },
  set: (branding) => {
    applyBranding(branding);
    set({ branding });
  },
}));

export const footerText = (b: Branding): string =>
  (b.footer_text ?? '').replace(/\{year\}/g, String(new Date().getFullYear()));

export const logoFor = (b: Branding, mode: 'light' | 'dark'): string =>
  (mode === 'dark' ? b.logo_dark || b.logo_light : b.logo_light) || DEFAULT_LOGO;

// Phần nằm ngoài React: favicon, theme-color, biến CSS màu chủ đạo (index.css
// dùng --color-primary / --color-primary-soft xuyên suốt).
function applyBranding(b: Branding): void {
  const root = document.documentElement;
  if (b.primary_color && b.primary_color.toLowerCase() !== DEFAULT_BRANDING.primary_color) {
    root.style.setProperty('--color-primary', b.primary_color);
    root.style.setProperty('--color-primary-soft', `color-mix(in srgb, ${b.primary_color} 14%, var(--color-card-bg))`);
  } else {
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--color-primary-soft');
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b.primary_color);
  const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]');
  icons.forEach((link) => {
    if (!link.dataset.defaultHref) link.dataset.defaultHref = link.getAttribute('href') ?? DEFAULT_FAVICON;
    link.href = b.favicon || link.dataset.defaultHref;
  });
}
