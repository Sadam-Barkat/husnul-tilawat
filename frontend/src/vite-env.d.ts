/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QURANI_QRC_API_KEY?: string; // optional legacy; QRC key lives on backend as QURANI_QRC_API_KEY
  /** Override QRC WebSocket URL (default in dev: ws://127.0.0.1:5000/api/qrc-stream) */
  readonly VITE_QRC_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
