import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Martin 的 CORS 白名單是 http://localhost:5173；用 127.0.0.1 開啟會被擋
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
  build: {
    // maplibre-gl 本身壓縮後約 1 MB（gzip ~350 KB），屬預期大小
    chunkSizeWarningLimit: 1500,
  },
  test: {
    // 測試只涵蓋純函式（設定、樣式、屬性格式化），不需要 DOM / WebGL
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
