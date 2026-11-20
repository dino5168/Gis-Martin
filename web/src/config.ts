import { err, ok, type Result } from './result';

/** Runtime configuration resolved from Vite environment variables. */
export interface AppConfig {
  /** Martin base URL without trailing slash, e.g. `http://localhost:3000`. */
  martinUrl: string;
  /** OSRM base URL without trailing slash; null hides route planning (not deployed yet). */
  osrmUrl: string | null;
}

/**
 * Validates a service base URL from an environment variable.
 *
 * Args:
 *   name: Variable name, used in error messages.
 *   raw: Trimmed, non-empty value.
 *   isProd: True for production builds; http is then rejected.
 *
 * Returns:
 *   Origin plus path without trailing slashes, or an error.
 */
function parseBaseUrl(name: string, raw: string, isProd: boolean): Result<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return err(`${name} 不是合法網址：${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return err(`${name} 只接受 http/https：${raw}`);
  }
  // 正式站是 https（Cloudflare Pages），http 請求會被當 mixed content 擋掉且錯誤不明顯
  if (isProd && url.protocol === 'http:') {
    return err(`正式環境 ${name} 必須是 https：${raw}`);
  }
  // 服務路徑會直接接在後面，query/hash 會產生錯誤的請求網址
  if (url.search || url.hash) {
    return err(`${name} 不可包含 query 或 hash：${raw}`);
  }

  return ok(`${url.origin}${url.pathname.replace(/\/+$/, '')}`);
}

/**
 * Parses and validates the app configuration from environment variables.
 *
 * Env values are build-time input that may be mistyped, so they are validated
 * here once instead of failing later inside MapLibre with an opaque fetch error.
 *
 * Args:
 *   env: Key/value map, normally `import.meta.env`.
 *   isProd: True for production builds (`import.meta.env.PROD`); http is then rejected.
 *
 * Returns:
 *   Validated AppConfig, or an error describing the invalid variable.
 */
export function parseConfig(
  env: Readonly<Record<string, string | undefined>>,
  isProd = false,
): Result<AppConfig> {
  const martinRaw = env.VITE_MARTIN_URL?.trim();
  if (!martinRaw) {
    return err('VITE_MARTIN_URL 未設定（請複製 .env.example 為 .env.local）');
  }
  const martin = parseBaseUrl('VITE_MARTIN_URL', martinRaw, isProd);
  if (martin.error) return err(martin.error.message);

  // OSRM 為選用：未設定時不顯示路徑規劃，地圖其餘功能照常
  const osrmRaw = env.VITE_OSRM_URL?.trim();
  if (!osrmRaw) return ok({ martinUrl: martin.data, osrmUrl: null });
  const osrm = parseBaseUrl('VITE_OSRM_URL', osrmRaw, isProd);
  if (osrm.error) return err(osrm.error.message);

  return ok({ martinUrl: martin.data, osrmUrl: osrm.data });
}
