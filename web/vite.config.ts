import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Martin 的 CORS 白名單是 http://localhost:5173；用 127.0.0.1 開啟會被擋
    host: 'localhost',
    port: 5173,
    strictPort: true,
    // 本機自架 OSRM：每個 profile 一個 osrm-routed 容器（見 Question/1-最短路徑.md），
    // 以同源路徑 /osrm/{profile} 轉發，不必處理 CORS；正式環境由反向代理／tunnel 提供相同路徑
    proxy: {
      '/osrm/driving': { target: 'http://127.0.0.1:5000', rewrite: (path) => path.replace(/^\/osrm\/driving/, '') },
      '/osrm/foot': { target: 'http://127.0.0.1:5001', rewrite: (path) => path.replace(/^\/osrm\/foot/, '') },
    },
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
