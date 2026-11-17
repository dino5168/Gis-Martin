import { describe, expect, it } from 'vitest';
import { parseBusData, ROUTE_1, routeBusesToGeoJSON } from './busData';

// 取自 2026-11-17 實際 GetBusData 回應的欄位格式（數值皆為字串）
const raw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ProviderID: 5100,
  StationID: 15180,
  BusID: '706-U3',
  CarType: '1',
  CarID: 222236066,
  DutyStatus: '1',
  BusStatus: '0',
  RouteID: '10723',
  GoBack: '0',
  Longitude: '121.545567',
  Latitude: '25.018127',
  Speed: '19',
  Azimuth: '047',
  DataTime: '2026-11-17 17:19:50',
  ...over,
});

const feed = (items: unknown[], crs = 'WGS84'): unknown => ({
  EssentialInfo: { Location: { name: '台北市' }, UpdateTime: '2026/11/17 17:20:00', CoordinateSystem: crs },
  BusInfo: items,
});

describe('parseBusData', () => {
  it('parses string fields into numbers', () => {
    const r = parseBusData(feed([raw()]));
    expect(r.error).toBeNull();
    expect(r.data?.updateTime).toBe('2026/11/17 17:20:00');
    expect(r.data?.buses[0]).toEqual({
      plate: '706-U3',
      routeId: '10723',
      goBack: 0,
      lng: 121.545567,
      lat: 25.018127,
      speed: 19,
      azimuth: 47,
      dataTime: '2026-11-17 17:19:50',
    });
  });

  it('drops malformed entries instead of failing the whole update', () => {
    const r = parseBusData(
      feed([
        raw(),
        raw({ Longitude: '0', Latitude: '0' }), // 車機故障常見的 0,0
        raw({ Latitude: 'abc' }),
        raw({ BusID: undefined }),
        'not an object',
      ]),
    );
    expect(r.data?.buses).toHaveLength(1);
  });

  it('keeps unknown GoBack codes as null direction', () => {
    expect(parseBusData(feed([raw({ GoBack: '2' })])).data?.buses[0]?.goBack).toBeNull();
  });

  it('rejects a document without BusInfo', () => {
    expect(parseBusData({ foo: 1 }).error).toBeInstanceOf(Error);
    expect(parseBusData(null).error).toBeInstanceOf(Error);
  });

  it('rejects coordinates that are not WGS84', () => {
    expect(parseBusData(feed([raw()], 'TWD97')).error?.message).toContain('WGS84');
  });
});

describe('routeBusesToGeoJSON', () => {
  const buses = parseBusData(
    feed([
      raw(),
      raw({ BusID: '393-U8', GoBack: '1', Azimuth: '226' }),
      raw({ BusID: 'DOG-1', RouteID: '160559' }),
      raw({ BusID: 'OTHER', RouteID: '15183' }),
    ]),
  ).data?.buses ?? [];
  const fc = routeBusesToGeoJSON(buses, ROUTE_1);

  it('keeps only the route (including its variants)', () => {
    expect(fc.features.map((f) => f.properties.plate)).toEqual(['706-U3', '393-U8', 'DOG-1']);
  });

  it('emits EPSG:4326 lon/lat points with direction labels', () => {
    const [go, back] = fc.features;
    expect(go?.geometry.coordinates).toEqual([121.545567, 25.018127]);
    expect(go?.properties).toMatchObject({ dir: 'go', direction: '往松仁路', azimuth: 47 });
    expect(back?.properties).toMatchObject({ dir: 'back', direction: '往萬華', azimuth: 226 });
  });
});
