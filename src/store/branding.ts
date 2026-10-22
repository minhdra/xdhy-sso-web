import { create } from 'zustand';

import { type Branding, getBranding } from '../api';

// Thông tin thương hiệu (tên tổ chức, logo, màu, footer) lưu ở api-sso
// (a_org_setting, 26/09/2026) - mỗi công ty 1 triển khai tự đổi được, không
// sửa code/build lại. DEFAULT_BRANDING = giá trị trước đây ghi cứng, dùng khi
// API chưa trả về / lỗi để giao diện không trống.
export const DEFAULT_BRANDING: Branding = {
  org_name: 'An Trường Phát Hưng Yên',
  short_name: 'XDHY',
  show_short_name: false,
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
// Biến nền/minh hoạ ghi đè khi đổi màu chủ đạo (giá trị mặc định ở :root của
// index.css = bản gốc xanh dương, nên màu mặc định không đổi so với trước).
const mix = (pct: number, base = 'transparent') => `color-mix(in srgb, var(--color-primary) ${pct}%, ${base})`;
const BRAND_VARS: Record<string, string> = {
  '--color-primary-soft': 'color-mix(in srgb, var(--color-primary) 14%, var(--color-card-bg))',
  '--brand-orb-a': mix(28),
  '--brand-orb-b': mix(18),
  '--brand-orb-c': mix(10),
  '--brand-page-grad': `linear-gradient(145deg, ${mix(6, '#fff')} 0%, ${mix(14, '#fff')} 46%, ${mix(4, '#fff')} 100%)`,
  '--brand-dark-orb-a': mix(24),
  '--brand-dark-orb-b': mix(14),
  '--brand-dark-grad': `linear-gradient(145deg, ${mix(10, '#0e1115')} 0%, ${mix(18, '#0e1115')} 48%, ${mix(7, '#0e1115')} 100%)`,
  '--brand-illus-mid': mix(70, '#000'),
  '--brand-illus-end': mix(45, '#000'),
  '--brand-progress-bg': mix(14),
  '--brand-progress-fill': `linear-gradient(90deg, var(--color-primary), ${mix(60, '#fff')})`,
  '--brand-shell-grad': `linear-gradient(165deg, ${mix(4, '#f3f4f6')} 0%, ${mix(8, '#e9ebee')} 100%)`,
};

function applyBranding(b: Branding): void {
  const root = document.documentElement;
  if (b.primary_color && b.primary_color.toLowerCase() !== DEFAULT_BRANDING.primary_color) {
    root.style.setProperty('--color-primary', b.primary_color);
    Object.entries(BRAND_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
  } else {
    root.style.removeProperty('--color-primary');
    Object.keys(BRAND_VARS).forEach((k) => root.style.removeProperty(k));
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b.primary_color);
  const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]');
  icons.forEach((link) => {
    if (!link.dataset.defaultHref) link.dataset.defaultHref = link.getAttribute('href') ?? DEFAULT_FAVICON;
    link.href = b.favicon || link.dataset.defaultHref;
  });
}
