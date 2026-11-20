import { err, ok, type Result } from '../result';
import { waypointLetter, type Waypoint } from './waypoints';

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
  NoSegment: '有地點附近沒有可通行的道路',
  TooBig: '查詢範圍過大',
};

// 6 位小數 ≈ 0.1 m，再多只是讓網址變長
function formatCoords(points: readonly LngLat[]): string {
  return points.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
}

/**
 * Builds the OSRM route request URL.
 *
 * Each profile lives under its own path prefix (`{osrmUrl}/{profile}`), so one base URL can
 * front several osrm-routed instances (Vite proxy in dev, Caddy + tunnel in production).
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL without trailing slash.
 *   profile: Travel mode.
 *   points: Stops in visiting order (EPSG:4326), at least two.
 *
 * Returns:
 *   Request URL asking for the full route geometry as GeoJSON.
 */
export function routeUrl(osrmUrl: string, profile: RouteProfile, points: readonly LngLat[]): string {
  return `${osrmUrl}/${profile}/route/v1/${profile}/${formatCoords(points)}?overview=full&geometries=geojson`;
}

/**
 * Builds the OSRM nearest request URL (snaps a point to the road network).
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL without trailing slash.
 *   profile: Travel mode (walking snaps to footways the car profile ignores).
 *   point: Clicked location (EPSG:4326).
 *
 * Returns:
 *   Request URL for the single nearest road.
 */
export function nearestUrl(osrmUrl: string, profile: RouteProfile, point: LngLat): string {
  return `${osrmUrl}/${profile}/nearest/v1/${profile}/${formatCoords([point])}?number=1`;
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
 * Validates an OSRM `/nearest` response and extracts the road name.
 *
 * Args:
 *   json: Parsed response body (untrusted).
 *
 * Returns:
 *   Road name ('' for unnamed roads), or an error.
 */
export function parseNearestResponse(json: unknown): Result<string> {
  if (!isRecord(json) || json.code !== 'Ok' || !Array.isArray(json.waypoints)) {
    return err('找不到附近的道路');
  }
  const first: unknown = json.waypoints[0];
  return isRecord(first) && typeof first.name === 'string' ? ok(first.name) : err('找不到附近的道路');
}

/**
 * GETs an OSRM endpoint and returns its JSON body.
 *
 * Args:
 *   url: Request URL.
 *   signal: Aborts the request.
 *
 * Returns:
 *   Parsed body, or an error for network failures and non-JSON answers.
 */
async function getOsrmJson(url: string, signal?: AbortSignal): Promise<Result<unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (e) {
    return err(e instanceof Error ? `無法連線路線服務：${e.message}` : '無法連線路線服務');
  }
  // NoRoute／NoSegment 等以 HTTP 400 回應但仍有 JSON 內容，先嘗試解析才能顯示具體原因
  try {
    return ok(await response.json());
  } catch {
    return err(`路線服務錯誤（HTTP ${response.status}）`);
  }
}

/**
 * Requests a route through all stops from OSRM.
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL without trailing slash.
 *   profile: Travel mode.
 *   points: Stops in visiting order (EPSG:4326), at least two.
 *   signal: Aborts the request when the stops change before it finishes.
 *
 * Returns:
 *   The route, or an error (network failure, service error, no route).
 */
export async function fetchRoute(
  osrmUrl: string,
  profile: RouteProfile,
  points: readonly LngLat[],
  signal?: AbortSignal,
): Promise<Result<PlannedRoute>> {
  const body = await getOsrmJson(routeUrl(osrmUrl, profile, points), signal);
  return body.error ? err(body.error.message) : parseRouteResponse(body.data);
}

/**
 * Looks up the name of the road nearest to a point.
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL without trailing slash.
 *   profile: Travel mode.
 *   point: Clicked location (EPSG:4326).
 *   signal: Aborts the request.
 *
 * Returns:
 *   Road name ('' when unnamed), or an error.
 */
export async function fetchNearestName(
  osrmUrl: string,
  profile: RouteProfile,
  point: LngLat,
  signal?: AbortSignal,
): Promise<Result<string>> {
  const body = await getOsrmJson(nearestUrl(osrmUrl, profile, point), signal);
  return body.error ? err(body.error.message) : parseNearestResponse(body.data);
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

/** Marker role: first stop, intermediate stop or final destination. */
export type RouteStopRole = 'start' | 'via' | 'end';

export type RouteFeatureProperties = { role: 'line' } | { role: RouteStopRole; label: string };

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
 * Converts the stop list and the route into GeoJSON for the map.
 *
 * Args:
 *   waypoints: Stop list; empty rows get no marker but keep their letter.
 *   route: Route through the set stops, if computed.
 *
 * Returns:
 *   Line first, then one lettered marker per set stop.
 */
export function routeToGeoJSON(waypoints: readonly Waypoint[], route: PlannedRoute | null): RouteFeatureCollection {
  const features: RouteFeatureCollection['features'] = [];
  if (route) {
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: route.coordinates }, properties: { role: 'line' } });
  }
  const last = waypoints.length - 1;
  waypoints.forEach((w, i) => {
    if (!w.point) return;
    const role: RouteStopRole = i === 0 ? 'start' : i === last ? 'end' : 'via';
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.point[0], w.point[1]] },
      properties: { role, label: waypointLetter(i) },
    });
  });
  return features.length === 0 ? EMPTY_ROUTE : { type: 'FeatureCollection', features };
}
