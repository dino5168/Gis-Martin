import { err, ok, type Result } from '../result';

/** Travel modes; each is served by its own osrm-routed instance (see Question/1-最短路徑.md). */
export const ROUTE_PROFILES = [
  { id: 'driving', label: '開車' },
  { id: 'foot', label: '步行' },
] as const;
export type RouteProfile = (typeof ROUTE_PROFILES)[number]['id'];

/** EPSG:4326 `[lon, lat]`, the coordinate order OSRM and GeoJSON use. */
export type LngLat = readonly [number, number];

/** Route returned by OSRM, reduced to what the map and panel show. */
export interface PlannedRoute {
  /** Route line in EPSG:4326. */
  coordinates: [number, number][];
  /** Metres. */
  distance: number;
  /** Seconds, as estimated by the OSRM profile. */
  duration: number;
}

// OSRM 的錯誤代碼 → 使用者看得懂的訊息；其餘代碼直接顯示原文
const OSRM_ERRORS: Readonly<Record<string, string>> = {
  NoRoute: '找不到可通行的路線（可能跨海或道路不相連）',
  NoSegment: '起點或終點附近沒有可通行的道路',
  TooBig: '查詢範圍過大',
};

/**
 * Builds the OSRM route request URL.
 *
 * Each profile lives under its own path prefix (`{osrmUrl}/{profile}`), so one base URL can
 * front several osrm-routed instances (Vite proxy in dev, reverse proxy / tunnel in production).
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL without trailing slash.
 *   profile: Travel mode.
 *   from: Start point (EPSG:4326).
 *   to: End point (EPSG:4326).
 *
 * Returns:
 *   Request URL asking for the full route geometry as GeoJSON.
 */
export function routeUrl(osrmUrl: string, profile: RouteProfile, from: LngLat, to: LngLat): string {
  // 6 位小數 ≈ 0.1 m，再多只是讓網址變長
  const coords = [from, to].map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
  return `${osrmUrl}/${profile}/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

/**
 * Validates an OSRM `/route` response and extracts the first route.
 *
 * Args:
 *   json: Parsed response body (untrusted).
 *
 * Returns:
 *   The route, or an error carrying OSRM's message (e.g. no route between the points).
 */
export function parseRouteResponse(json: unknown): Result<PlannedRoute> {
  if (!isRecord(json) || typeof json.code !== 'string') {
    return err('路線服務回應格式不符');
  }
  if (json.code !== 'Ok') {
    const message = typeof json.message === 'string' ? json.message : json.code;
    return err(OSRM_ERRORS[json.code] ?? message);
  }

  const route = Array.isArray(json.routes) ? json.routes[0] : undefined;
  if (!isRecord(route) || !isRecord(route.geometry) || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
    return err('路線服務回應缺少路線資料');
  }
  const coordinates = route.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(isPosition)) {
    return err('路線服務回應的路線幾何無效');
  }
  return ok({
    coordinates: coordinates.map(([lon, lat]) => [lon, lat]),
    distance: route.distance,
    duration: route.duration,
  });
}

/**
 * Requests a route from OSRM.
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL without trailing slash.
 *   profile: Travel mode.
 *   from: Start point (EPSG:4326).
 *   to: End point (EPSG:4326).
 *   signal: Aborts the request when the points change before it finishes.
 *
 * Returns:
 *   The route, or an error (network failure, service error, no route).
 */
export async function fetchRoute(
  osrmUrl: string,
  profile: RouteProfile,
  from: LngLat,
  to: LngLat,
  signal?: AbortSignal,
): Promise<Result<PlannedRoute>> {
  let response: Response;
  try {
    response = await fetch(routeUrl(osrmUrl, profile, from, to), { signal });
  } catch (e) {
    return err(e instanceof Error ? `無法連線路線服務：${e.message}` : '無法連線路線服務');
  }
  // NoRoute／NoSegment 等以 HTTP 400 回應但仍有 JSON 內容，先嘗試解析才能顯示具體原因
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return err(`路線服務錯誤（HTTP ${response.status}）`);
  }
  return parseRouteResponse(json);
}

/**
 * Computes the bounding box of a route.
 *
 * Args:
 *   route: Planned route.
 *
 * Returns:
 *   EPSG:4326 `[[west, south], [east, north]]`.
 */
export function routeBounds(route: PlannedRoute): [[number, number], [number, number]] {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of route.coordinates) {
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [[w, s], [e, n]];
}

/**
 * Formats a distance for the panel.
 *
 * Args:
 *   metres: Distance in metres.
 *
 * Returns:
 *   `850 公尺` below 1 km, otherwise `12.3 公里`.
 */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} 公尺` : `${(metres / 1000).toFixed(1)} 公里`;
}

/**
 * Formats a duration for the panel.
 *
 * Args:
 *   seconds: Duration in seconds.
 *
 * Returns:
 *   `5 分鐘` or `2 小時 5 分鐘` (at least 1 minute).
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} 分鐘` : `${hours} 小時 ${minutes % 60} 分鐘`;
}

/** Endpoint role, also the label drawn on the marker. */
export type RouteEndpoint = 'start' | 'end';

export type RouteFeatureProperties = { role: 'line' } | { role: RouteEndpoint; label: string };

/** GeoJSON fed to the route source of the style. */
export interface RouteFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] } | { type: 'LineString'; coordinates: [number, number][] };
    properties: RouteFeatureProperties;
  }[];
}

export const EMPTY_ROUTE: RouteFeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Converts the picked points and the route into GeoJSON for the map.
 *
 * Args:
 *   start: Start point, if picked.
 *   end: End point, if picked.
 *   route: Route between them, if computed.
 *
 * Returns:
 *   Line first, then the endpoint markers (so markers draw on top within one layer).
 */
export function routeToGeoJSON(start: LngLat | null, end: LngLat | null, route: PlannedRoute | null): RouteFeatureCollection {
  const features: RouteFeatureCollection['features'] = [];
  if (route) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: route.coordinates }, properties: { role: 'line' } });
  }
  const points: [RouteEndpoint, string, LngLat | null][] = [['start', '起', start], ['end', '終', end]];
  for (const [role, label, p] of points) {
    if (p) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p[0], p[1]] }, properties: { role, label } });
  }
  return features.length === 0 ? EMPTY_ROUTE : { type: 'FeatureCollection', features };
}
