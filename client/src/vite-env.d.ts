/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin used for every API request. Empty means same-origin. */
  readonly VITE_API_BASE_URL?: string;
  /** Local Vite dev-server proxy target. */
  readonly VITE_DEV_API_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
