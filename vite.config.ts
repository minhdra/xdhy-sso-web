import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import packageJson from './package.json';

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
    plugins: [react(), versionAsset(buildInfo)],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:6005',
          changeOrigin: true,
        },
      },
    },
  };
});
