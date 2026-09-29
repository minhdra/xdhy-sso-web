import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import packageJson from './package.json';

// Thẻ meta/OG trong index.html là HTML tĩnh - bot xem trước link (Zalo,
// Facebook...) không chạy JS nên không thấy thương hiệu tải từ API. Mỗi công ty
// là 1 triển khai riêng (build riêng) nên thay placeholder {{...}} LÚC BUILD
// theo biến VITE_*; mặc định = giá trị cũ. Trình duyệt vẫn cập nhật tiêu đề/
// favicon theo DB lúc chạy (store/branding.ts).
const brandingMeta = (env: Record<string, string>): Plugin => {
  const siteUrl = (env.VITE_SITE_URL || 'https://xdhy.vn').replace(/\/+$/, '');
  const orgName = env.VITE_ORG_NAME || 'An Trường Phát Hưng Yên';
  const values: Record<string, string> = {
    ORG_NAME: orgName,
    SHORT_NAME: env.VITE_SHORT_NAME || 'XDHY',
    APP_NAME: env.VITE_APP_NAME || 'Tài khoản',
    SITE_URL: siteUrl,
    THEME_COLOR: env.VITE_THEME_COLOR || '#2563a6',
    OG_IMAGE: env.VITE_OG_IMAGE || `${siteUrl}/logo.png`,
    DESCRIPTION:
      env.VITE_DESCRIPTION ||
      `Cổng đăng nhập một lần (SSO) của ${orgName} — đăng nhập một lần, dùng chung cho mọi ứng dụng nội bộ.`,
  };
  const escape = (v: string) =>
    v
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return {
    name: 'branding-meta',
    transformIndexHtml: (html) =>
      html.replace(/\{\{([A-Z_]+)\}\}/g, (m, key: string) =>
        key in values ? escape(values[key]) : m,
      ),
    // Bản sao index.html cho api-sso làm khuôn render meta từ DB
    // (GET /api-sso/render-page, env SSO_WEB_TEMPLATE_URL) - không bị route
    // SPA/nginx render đè vì là file thật.
    writeBundle(options) {
      if (!options.dir) return;
      copyFileSync(
        join(options.dir, 'index.html'),
        join(options.dir, 'index.template.html'),
      );
    },
  };
};

const versionAsset = (buildInfo: Record<string, string>): Plugin => ({
  name: 'version-asset',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify(buildInfo, null, 2)}\n`,
    });
  },
});

// Frontend độc lập (origin/port riêng như build-web/task-web). Build production
// serve qua nginx của chính nó - nginx proxy /api same-origin sang api-gateway
// (xem config/default.conf). Dev server cũng proxy /api sang gateway local,
// giống hệt build-web/task-web (server.proxy dưới đây) - browser luôn gọi
// path tương đối VITE_BASE_URL=/api, không cần URL tuyệt đối/CORS ở cả 2 môi
// trường.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const builtAt = new Date().toISOString();
  const buildInfo = {
    app: 'sso-web',
    version: packageJson.version,
    buildId: env.VITE_BUILD_ID || builtAt,
    builtAt,
  };

  return {
    define: {
      __APP_BUILD_INFO__: JSON.stringify(buildInfo),
    },
    plugins: [react(), versionAsset(buildInfo), brandingMeta(env)],
    build: {
      // antd + icons một mình đã hơn 500KB - sàn của UI kit, không phải
      // regression (đồng bộ với build-web/task-web, xem vite.config.ts 2
      // app đó). Nâng ngưỡng cảnh báo để chỉ báo bloat thật.
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          // Tách vendor ít đổi khỏi app code để browser cache qua các lần
          // deploy - trước đây gộp hết vào 1 chunk 800KB+, đổi 1 dòng code
          // app là toàn bộ vendor phải tải lại.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-antd': ['antd', '@ant-design/icons'],
            'vendor-utils': ['dayjs', 'zustand'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:6005',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  };
});
