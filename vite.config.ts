import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// Frontend độc lập (origin/port riêng như build-web/task-web). Build production
// serve qua nginx của chính nó - nginx proxy /api same-origin sang api-gateway
// (xem config/default.conf). Dev server cũng proxy /api sang gateway local,
// giống hệt build-web/task-web (server.proxy dưới đây) - browser luôn gọi
// path tương đối VITE_BASE_URL=/api, không cần URL tuyệt đối/CORS ở cả 2 môi
// trường.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:6005',
        changeOrigin: true,
      },
    },
  },
});
