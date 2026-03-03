/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_TELEGRAM_MOCK?: string;
  readonly VITE_DEV_TELEGRAM_USER_ID?: string;
  readonly VITE_DEV_TELEGRAM_FIRST_NAME?: string;
  readonly VITE_DEV_TELEGRAM_LAST_NAME?: string;
  readonly VITE_DEV_TELEGRAM_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
