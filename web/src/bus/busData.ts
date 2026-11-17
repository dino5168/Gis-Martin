import { err, ok, type Result } from '../result';

/**
 * Taipei City real-time bus positions (Data.Taipei, 臺北市政府交通局).
 * Public blob with `Access-Control-Allow-Origin: *`, gzip body served as octet-stream,
 * refreshed roughly every 30–60 s; coordinates are WGS84 (EPSG:4326).
 */
export const BUS_DATA_URL = 'https://tcgbusfs.blob.core.windows.net/blobbus/GetBusData.gz';

/** A bus route shown on the map. */
export interface BusRoute {
  /** GetRoute `Id` (one per signed route). */
  id: string;
  /** Route name as signed on the bus. */
  name: string;
  /**
   * GetRoute `pathAttributeId` values of the route's variants; GetBusData `RouteID`
   * refers to these, not to `Id` (verified 2026-11-17: 394 of 398 live RouteIDs).
   */
  routeIds: readonly string[];
  /** Terminal reached on the outbound trip (GoBack = 0; GetRoute `destinationZh`). */
  outboundTo: string;
  /** Terminal reached on the return trip (GoBack = 1; GetRoute `departureZh`). */
  returnTo: string;
}

/**
 * 1 號公車（欣欣客運，萬華 ↔ 松仁路）；160559 為「1 狗狗公車」班次。
 * Default selection, and the fallback before the route list has loaded.
 */
export const ROUTE_1: BusRoute = {
  id: '10723',
  name: '1',
  routeIds: ['10723', '160559'],
  outboundTo: '松仁路',
  returnTo: '萬華',
};

/**
 * Downloads a Data.Taipei `.gz` blob and parses it as JSON.
 *
 * Args:
 *   url: Blob URL.
 *   signal: Aborts the request.
 *
 * Returns:
 *   The parsed (still untrusted) JSON, or an error (network, HTTP, gzip or JSON failure).
 */
export async function fetchGzipJson(url: string, signal?: AbortSignal): Promise<Result<unknown>> {
  try {
    // blob 會被瀏覽器快取；即時資料一律不用快取
    const res = await fetch(url, { cache: 'no-store', signal });
    if (!res.ok) return err(`下載失敗：HTTP ${res.status}`);
    if (!res.body) return err('下載失敗：沒有內容');
    // 伺服器以 octet-stream 回傳 gzip 檔（沒有 Content-Encoding），瀏覽器不會自動解壓
    const text = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
    const json: unknown = JSON.parse(text);
    return ok(json);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return err('已取消');
    return err(`讀取失敗：${e instanceof Error ? e.message : String(e)}`);
  }
}

/** One validated vehicle position. */
export interface BusPosition {
  plate: string;
  routeId: string;
  /** 0 = outbound, 1 = return; other feed values are kept as null (direction unknown). */
  goBack: 0 | 1 | null;
  lng: number;
  lat: number;
  /** km/h. */
  speed: number;
  /** Degrees clockwise from north. */
  azimuth: number;
  /** Vehicle GPS timestamp, local time `YYYY-MM-DD HH:mm:ss`. */
  dataTime: string;
}

/** Parsed feed. */
export interface BusSnapshot {
  /** Feed generation time, local time. */
  updateTime: string;
  buses: BusPosition[];
}

// 合理座標範圍：台灣本島＋金馬（排除 0,0 等車機故障值）
const LNG_RANGE: readonly [number, number] = [118, 123];
const LAT_RANGE: readonly [number, number] = [21, 27];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Feed values are strings ("121.5", "061"); accepts numbers too in case the provider changes types. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validates one `BusInfo` entry.
 *
 * Args:
 *   item: Raw entry from the feed.
 *
 * Returns:
 *   The position, or null when required fields are missing or the coordinate is implausible.
 */
function parseBus(item: unknown): BusPosition | null {
  if (!isRecord(item)) return null;
  const lng = toNumber(item.Longitude);
  const lat = toNumber(item.Latitude);
  const { BusID: plate, RouteID: routeId, DataTime: dataTime } = item;
  if (lng === null || lat === null || typeof plate !== 'string' || typeof routeId !== 'string') return null;
  if (lng < LNG_RANGE[0] || lng > LNG_RANGE[1] || lat < LAT_RANGE[0] || lat > LAT_RANGE[1]) return null;
  const goBack = toNumber(item.GoBack);
  return {
    plate,
    routeId,
    goBack: goBack === 0 || goBack === 1 ? goBack : null,
    lng,
    lat,
    speed: toNumber(item.Speed) ?? 0,
    azimuth: ((toNumber(item.Azimuth) ?? 0) % 360 + 360) % 360,
    dataTime: typeof dataTime === 'string' ? dataTime : '',
  };
}

/**
 * Validates the decoded `GetBusData` JSON.
 *
 * External data is never trusted: malformed entries are dropped instead of failing the whole update.
 *
 * Args:
 *   json: Parsed JSON document.
 *
 * Returns:
 *   The snapshot, or an error if the document shape is not the expected feed.
 */
export function parseBusData(json: unknown): Result<BusSnapshot> {
  if (!isRecord(json) || !Array.isArray(json.BusInfo)) return err('公車資料格式不符：缺少 BusInfo');
  const essential = isRecord(json.EssentialInfo) ? json.EssentialInfo : {};
  const crs = essential.CoordinateSystem;
  // 座標系若被改掉，直接畫會錯位；寧可不顯示
  if (crs !== undefined && crs !== 'WGS84') return err(`公車資料座標系不是 WGS84：${String(crs)}`);
  const buses = json.BusInfo.map(parseBus).filter((b): b is BusPosition => b !== null);
  return ok({ updateTime: typeof essential.UpdateTime === 'string' ? essential.UpdateTime : '', buses });
}

/**
 * Downloads and decodes the city-wide bus feed.
 *
 * Args:
 *   signal: Aborts the request (e.g. when the component unmounts).
 *
 * Returns:
 *   The validated snapshot, or an error (network, HTTP, gzip or JSON failure).
 */
export async function fetchBusData(signal?: AbortSignal): Promise<Result<BusSnapshot>> {
  const json = await fetchGzipJson(BUS_DATA_URL, signal);
  return json.error ? err(`公車位置${json.error.message}`) : parseBusData(json.data);
}

/**
 * Feature properties of a bus point (display-ready; FeatureInfo shows them as-is).
 * A type alias rather than an interface so it is assignable to GeoJSON's index-signature properties.
 */
export type BusFeatureProperties = {
  name: string;
  route: string;
  plate: string;
  /** 'go' | 'back' | 'unknown' — selects icon colour. */
  dir: 'go' | 'back' | 'unknown';
  direction: string;
  speed: number;
  azimuth: number;
  data_time: string;
};

/** GeoJSON FeatureCollection of bus points (structural type, so no @types/geojson dependency). */
export interface BusFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: BusFeatureProperties;
  }[];
}

export const EMPTY_BUSES: BusFeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Bounding box of the buses, for zooming to a newly selected route.
 *
 * Args:
 *   fc: Bus features.
 *
 * Returns:
 *   `[[west, south], [east, north]]` in EPSG:4326, or null when there are no buses.
 */
export function busBounds(fc: BusFeatureCollection): [[number, number], [number, number]] | null {
  if (fc.features.length === 0) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { geometry } of fc.features) {
    const [lng, lat] = geometry.coordinates;
    w = Math.min(w, lng);
    s = Math.min(s, lat);
    e = Math.max(e, lng);
    n = Math.max(n, lat);
  }
  return [[w, s], [e, n]];
}

/**
 * Converts the buses of one route to GeoJSON for the map.
 *
 * Args:
 *   buses: Validated city-wide positions.
 *   route: Route to keep.
 *
 * Returns:
 *   Point features in EPSG:4326 (same as the feed; MapLibre projects to EPSG:3857 when rendering).
 */
export function routeBusesToGeoJSON(buses: readonly BusPosition[], route: BusRoute): BusFeatureCollection {
  const ids = new Set(route.routeIds);
  return {
    type: 'FeatureCollection',
    features: buses
      .filter((b) => ids.has(b.routeId))
      .map((b) => {
        const dir = b.goBack === 0 ? 'go' : b.goBack === 1 ? 'back' : 'unknown';
        const direction = dir === 'go' ? `往${route.outboundTo}` : dir === 'back' ? `往${route.returnTo}` : '未知';
        return {
          type: 'Feature',
          id: b.plate,
          geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
          properties: {
            name: `${route.name} 號公車 ${b.plate}`,
            route: `${route.name} 號`,
            plate: b.plate,
            dir,
            direction,
            speed: b.speed,
            azimuth: b.azimuth,
            data_time: b.dataTime,
          },
        };
      }),
  };
}
