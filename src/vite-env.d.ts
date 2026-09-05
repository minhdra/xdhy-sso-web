/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOWED_REDIRECT_SUFFIX?: string;
  readonly VITE_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
