import { describe, expect, it } from 'vitest';
import { busBounds, EMPTY_BUSES, parseBusData, ROUTE_1, routeBusesToGeoJSON } from './busData';
import { compareRouteNames, loadBusRouteId, parseBusRoutes, routeLabel, saveBusRouteId } from './busRoutes';

// GetRoute 一列一個子路線；聯營路線（307）每個業者各一列
const row = (Id: number, nameZh: string, pathAttributeId: number, providerName = 'A'): Record<string, unknown> => ({
  Id,
  nameZh,
  pathAttributeId,
  pathAttributeName: nameZh,
  departureZh: `${nameZh}起`,
  destinationZh: `${nameZh}迄`,
  providerName,
});

describe('parseBusRoutes', () => {
  const result = parseBusRoutes({
    EssentialInfo: {},
    BusInfo: [
      row(10821, '紅5', 10821),
      row(10821, '紅5', 157609),
      row(16111, '307', 157462, '臺北客運'),
      row(16111, '307', 157462, '首都客運'), // 聯營重複列
      row(16111, '307', 157463),
      row(10723, '1', 10723),
      row(10723, '1', 160559),
      row(11111, '10', 11111),
      row(22222, '2', 22222),
      { Id: 1, nameZh: '' }, // 缺欄位
      'junk',
    ],
  });

  it('merges variants of one route and drops duplicate operator rows', () => {
    const r307 = result.data?.find((r) => r.id === '16111');
    expect(r307?.routeIds).toEqual(['157462', '157463']);
    expect(result.data?.find((r) => r.id === '10723')?.routeIds).toEqual(['10723', '160559']);
  });

  it('maps GoBack 0 to the destination and 1 to the departure terminal', () => {
    expect(result.data?.find((r) => r.id === '10821')).toMatchObject({ outboundTo: '紅5迄', returnTo: '紅5起' });
  });

  it('sorts numbered routes numerically before named routes', () => {
    expect(result.data?.map((r) => r.name)).toEqual(['1', '2', '10', '307', '紅5']);
  });

  it('rejects documents without routes', () => {
    expect(parseBusRoutes({}).error).toBeInstanceOf(Error);
    expect(parseBusRoutes({ BusInfo: [] }).error).toBeInstanceOf(Error);
  });
});

describe('compareRouteNames', () => {
  it('orders mixed names naturally', () => {
    expect(['藍10', '紅5', '307', '1', '紅57', '20'].sort(compareRouteNames)).toEqual(['1', '20', '307', '紅5', '紅57', '藍10']);
  });
});

describe('route storage', () => {
  const memory = (initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> => {
    const data = new Map(Object.entries(initial));
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it('round-trips a route id and defaults to route 1', () => {
    const s = memory();
    expect(loadBusRouteId(s)).toBe(ROUTE_1.id);
    saveBusRouteId(s, '10821');
    expect(loadBusRouteId(s)).toBe('10821');
  });

  it('ignores non-numeric stored values', () => {
    expect(loadBusRouteId(memory({ 'gis-martin.busRoute': '<script>' }))).toBe(ROUTE_1.id);
    expect(loadBusRouteId(null)).toBe(ROUTE_1.id);
  });
});

describe('routeLabel', () => {
  it('shows both terminals', () => {
    expect(routeLabel(ROUTE_1)).toBe('1（萬華－松仁路）');
  });
});

describe('busBounds', () => {
  const pos = (BusID: string, Longitude: string, Latitude: string): Record<string, unknown> => ({
    BusID, RouteID: '10723', GoBack: '0', Longitude, Latitude, Speed: '0', Azimuth: '0', DataTime: '',
  });

  it('returns the EPSG:4326 extent of the buses', () => {
    const buses = parseBusData({ BusInfo: [pos('A', '121.50', '25.03'), pos('B', '121.57', '25.01')] }).data?.buses ?? [];
    expect(busBounds(routeBusesToGeoJSON(buses, ROUTE_1))).toEqual([[121.5, 25.01], [121.57, 25.03]]);
  });

  it('returns null when the route has no buses', () => {
    expect(busBounds(EMPTY_BUSES)).toBeNull();
  });
});
