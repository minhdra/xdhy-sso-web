/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOWED_REDIRECT_SUFFIX?: string;
  readonly VITE_BASE_URL: string;
  readonly VITE_COOKIE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
