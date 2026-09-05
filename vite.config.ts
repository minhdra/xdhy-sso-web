import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// Frontend độc lập (origin/port riêng như build-web), KHÔNG phục vụ qua
// api-gateway. Gọi API cross-origin sang gateway bằng URL tuyệt đối
// (VITE_GATEWAY_URL); gateway có CORS riêng cho origin này (SSO_ORIGIN).
// Build tĩnh, không cần dev-server proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
