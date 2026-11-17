import { setWorkerUrl } from 'maplibre-gl';
// `?url` 讓 Vite 把 worker 檔當成靜態資產輸出（dev 與 production 皆同）
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

/**
 * Points MapLibre at the bundled worker script.
 *
 * maplibre-gl 6 resolves its worker relative to its own `import.meta.url`.
 * Vite's dep pre-bundling (dev) and chunking (build) move that module, so the
 * default URL 404s and no tiles load. Must run before the first Map is created.
 */
export function configureMapLibreWorker(): void {
  setWorkerUrl(workerUrl);
}
