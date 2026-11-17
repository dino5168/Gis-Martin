import { err, ok, type Result } from './result';

/** Runtime configuration resolved from Vite environment variables. */
export interface AppConfig {
  /** Martin base URL without trailing slash, e.g. `http://localhost:3000`. */
  martinUrl: string;
}

/**
 * Parses and validates the app configuration from environment variables.
 *
 * Env values are build-time input that may be mistyped, so they are validated
 * here once instead of failing later inside MapLibre with an opaque fetch error.
 *
 * Args:
 *   env: Key/value map, normally `import.meta.env`.
 *
 * Returns:
 *   Validated AppConfig, or an error describing the invalid variable.
 */
export function parseConfig(env: Readonly<Record<string, string | undefined>>): Result<AppConfig> {
  const raw = env.VITE_MARTIN_URL?.trim();
  if (!raw) {
    return err('VITE_MARTIN_URL 未設定（請複製 .env.example 為 .env.local）');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return err(`VITE_MARTIN_URL 不是合法網址：${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return err(`VITE_MARTIN_URL 只接受 http/https：${raw}`);
  }
  // Martin source 路徑會直接接在後面，query/hash 會產生錯誤的 tile URL
  if (url.search || url.hash) {
    return err(`VITE_MARTIN_URL 不可包含 query 或 hash：${raw}`);
  }

  const path = url.pathname.replace(/\/+$/, '');
  return ok({ martinUrl: `${url.origin}${path}` });
}
