/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARTIN_URL?: string;
  readonly VITE_OSRM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
