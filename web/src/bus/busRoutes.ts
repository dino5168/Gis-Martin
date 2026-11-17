import { err, ok, type Result } from '../result';
import { fetchGzipJson, ROUTE_1, type BusRoute } from './busData';

/** Taipei City bus route list (Data.Taipei; ~800 entries, refreshed daily). */
export const BUS_ROUTE_URL = 'https://tcgbusfs.blob.core.windows.net/blobbus/GetRoute.gz';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null;

// 數字路線依數值排（2 在 10 前），再依中文名稱；「紅5」「307西藏三民」等混合名稱也自然排序
const collator = new Intl.Collator('zh-Hant-TW', { numeric: true });

/**
 * Orders route names the way riders expect: numbered routes first by number, then the rest.
 *
 * Args:
 *   a: Route name.
 *   b: Route name.
 *
 * Returns:
 *   Negative, zero or positive like Array.prototype.sort comparators.
 */
export function compareRouteNames(a: string, b: string): number {
  const da = /^\d/.test(a);
  const db = /^\d/.test(b);
  if (da !== db) return da ? -1 : 1;
  return collator.compare(a, b);
}

/**
 * Validates `GetRoute` JSON and merges its per-variant rows into one entry per route.
 *
 * The feed has one row per path variant (and duplicates for jointly operated routes);
 * rows sharing an `Id` are one signed route whose variants are its `pathAttributeId`s.
 *
 * Args:
 *   json: Parsed JSON document.
 *
 * Returns:
 *   Routes sorted by name, or an error if the document shape is not the expected feed.
 */
export function parseBusRoutes(json: unknown): Result<BusRoute[]> {
  if (!isRecord(json) || !Array.isArray(json.BusInfo)) return err('路線資料格式不符：缺少 BusInfo');
  const byId = new Map<string, { name: string; ids: Set<string>; from: string; to: string }>();
  for (const row of json.BusInfo) {
    if (!isRecord(row)) continue;
    const id = str(row.Id);
    const name = str(row.nameZh);
    const pathId = str(row.pathAttributeId);
    if (!id || !name || !pathId) continue;
    const entry = byId.get(id) ?? { name, ids: new Set<string>(), from: str(row.departureZh) ?? '', to: str(row.destinationZh) ?? '' };
    entry.ids.add(pathId);
    byId.set(id, entry);
  }
  const routes = [...byId].map(
    ([id, r]): BusRoute => ({ id, name: r.name, routeIds: [...r.ids], outboundTo: r.to, returnTo: r.from }),
  );
  if (routes.length === 0) return err('路線資料是空的');
  return ok(routes.sort((a, b) => compareRouteNames(a.name, b.name)));
}

/**
 * Downloads and validates the route list.
 *
 * Args:
 *   signal: Aborts the request.
 *
 * Returns:
 *   Routes sorted by name, or an error.
 */
export async function fetchBusRoutes(signal?: AbortSignal): Promise<Result<BusRoute[]>> {
  const json = await fetchGzipJson(BUS_ROUTE_URL, signal);
  return json.error ? err(`公車路線${json.error.message}`) : parseBusRoutes(json.data);
}

const STORAGE_KEY = 'gis-martin.busRoute';

/**
 * Reads the remembered route id.
 *
 * Args:
 *   storage: Storage to read from; null when unavailable.
 *
 * Returns:
 *   The stored id, or route 1's id. Validity is checked against the loaded list by the caller.
 */
export function loadBusRouteId(storage: Pick<Storage, 'getItem'> | null): string {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    // 只接受數字 id，避免把任意字串帶進後續比對
    return value && /^\d{1,10}$/.test(value) ? value : ROUTE_1.id;
  } catch {
    return ROUTE_1.id;
  }
}

/**
 * Remembers the selected route id; failures are ignored on purpose (it is only a preference).
 *
 * Args:
 *   storage: Storage to write to; null when unavailable.
 *   id: Route id.
 */
export function saveBusRouteId(storage: Pick<Storage, 'setItem'> | null, id: string): void {
  try {
    storage?.setItem(STORAGE_KEY, id);
  } catch {
    // 只是使用者偏好，寫入失敗不影響地圖
  }
}

/**
 * Formats a route for the drop-down.
 *
 * Args:
 *   route: Route.
 *
 * Returns:
 *   Label such as `1（萬華－松仁路）`.
 */
export function routeLabel(route: BusRoute): string {
  return route.returnTo && route.outboundTo ? `${route.name}（${route.returnTo}－${route.outboundTo}）` : route.name;
}
