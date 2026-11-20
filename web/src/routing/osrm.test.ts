import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_ROUTE,
  fetchRoute,
  formatDistance,
  formatDuration,
  parseRouteResponse,
  routeBounds,
  routeToGeoJSON,
  routeUrl,
  type PlannedRoute,
} from './osrm';

const TAIPEI_101: [number, number] = [121.5645, 25.034];
const TAIPEI_MAIN: [number, number] = [121.517, 25.0478];

const okBody = {
  code: 'Ok',
  routes: [
    {
      distance: 6123.4,
      duration: 540.2,
      geometry: { type: 'LineString', coordinates: [TAIPEI_101, [121.54, 25.04], TAIPEI_MAIN] },
    },
  ],
};

describe('routeUrl', () => {
  it('puts the profile in the path prefix and the OSRM service path, lon before lat', () => {
    expect(routeUrl('http://localhost:5173/osrm', 'foot', TAIPEI_101, TAIPEI_MAIN)).toBe(
      'http://localhost:5173/osrm/foot/route/v1/foot/121.564500,25.034000;121.517000,25.047800?overview=full&geometries=geojson',
    );
  });
});

describe('parseRouteResponse', () => {
  it('extracts geometry, distance and duration of the first route', () => {
    const result = parseRouteResponse(okBody);
    expect(result.error).toBeNull();
    expect(result.data?.distance).toBe(6123.4);
    expect(result.data?.duration).toBe(540.2);
    expect(result.data?.coordinates).toHaveLength(3);
  });

  it.each([
    ['NoRoute', '找不到可通行的路線'],
    ['NoSegment', '沒有可通行的道路'],
  ])('translates OSRM %s', (code, text) => {
    const result = parseRouteResponse({ code, message: 'raw' });
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain(text);
  });

  it('falls back to the OSRM message for other codes', () => {
    expect(parseRouteResponse({ code: 'InvalidQuery', message: 'Query string malformed' }).error?.message).toBe(
      'Query string malformed',
    );
  });

  it.each([
    ['not an object', 'oops'],
    ['no code', { routes: [] }],
    ['no routes', { code: 'Ok', routes: [] }],
    ['one-point line', { code: 'Ok', routes: [{ distance: 0, duration: 0, geometry: { coordinates: [TAIPEI_101] } }] }],
    ['bad coordinate', { code: 'Ok', routes: [{ distance: 1, duration: 1, geometry: { coordinates: [TAIPEI_101, ['x', 1]] } }] }],
    ['missing distance', { code: 'Ok', routes: [{ duration: 1, geometry: { coordinates: [TAIPEI_101, TAIPEI_MAIN] } }] }],
  ])('rejects %s', (_label, body) => {
    const result = parseRouteResponse(body);
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('fetchRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the OSRM error body of an HTTP 400', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'NoRoute' }), { status: 400 })));
    const result = await fetchRoute('http://x/osrm', 'driving', TAIPEI_101, TAIPEI_MAIN);
    expect(result.error?.message).toContain('找不到可通行的路線');
  });

  it('reports a non-JSON error page with its status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })));
    const result = await fetchRoute('http://x/osrm', 'driving', TAIPEI_101, TAIPEI_MAIN);
    expect(result.error?.message).toContain('502');
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const result = await fetchRoute('http://x/osrm', 'driving', TAIPEI_101, TAIPEI_MAIN);
    expect(result.error?.message).toContain('無法連線路線服務');
  });

  it('returns the parsed route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(okBody))));
    const result = await fetchRoute('http://x/osrm', 'driving', TAIPEI_101, TAIPEI_MAIN);
    expect(result.data?.distance).toBe(6123.4);
  });
});

describe('routeBounds', () => {
  it('spans every vertex', () => {
    const route: PlannedRoute = { coordinates: [[121.5, 25.1], [121.6, 25.0], [121.4, 25.05]], distance: 1, duration: 1 };
    expect(routeBounds(route)).toEqual([[121.4, 25.0], [121.6, 25.1]]);
  });
});

describe('formatting', () => {
  it.each([
    [850.4, '850 公尺'],
    [1000, '1.0 公里'],
    [158_712, '158.7 公里'],
  ])('distance %d m → %s', (m, text) => {
    expect(formatDistance(m)).toBe(text);
  });

  it.each([
    [10, '1 分鐘'],
    [540, '9 分鐘'],
    [3600, '1 小時 0 分鐘'],
    [15_000, '4 小時 10 分鐘'],
  ])('duration %d s → %s', (s, text) => {
    expect(formatDuration(s)).toBe(text);
  });
});

describe('routeToGeoJSON', () => {
  it('is empty when nothing is picked', () => {
    expect(routeToGeoJSON(null, null, null)).toBe(EMPTY_ROUTE);
  });

  it('draws the line first, then labelled start and end markers', () => {
    const route: PlannedRoute = { coordinates: [TAIPEI_101, TAIPEI_MAIN], distance: 1, duration: 1 };
    const fc = routeToGeoJSON(TAIPEI_101, TAIPEI_MAIN, route);
    expect(fc.features.map((f) => f.properties)).toEqual([
      { role: 'line' },
      { role: 'start', label: '起' },
      { role: 'end', label: '終' },
    ]);
  });

  it('shows a lone start marker before the end is picked', () => {
    const fc = routeToGeoJSON(TAIPEI_101, null, null);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry).toEqual({ type: 'Point', coordinates: TAIPEI_101 });
  });
});
