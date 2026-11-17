import { describe, expect, it } from 'vitest';
import { describeFeature, formatValue } from './featureInfo';

describe('formatValue', () => {
  it('hides empty values', () => {
    expect(formatValue('name', null)).toBeNull();
    expect(formatValue('name', undefined)).toBeNull();
    expect(formatValue('name', '')).toBeNull();
  });

  it('translates booleans, admin levels and oneway directions', () => {
    expect(formatValue('bridge', true)).toBe('是');
    expect(formatValue('tunnel', false)).toBe('否');
    expect(formatValue('admin_level', 4)).toBe('直轄市／縣市');
    expect(formatValue('admin_level', 10)).toBe('第 10 級');
    expect(formatValue('oneway', -1)).toBe('是（逆向）');
    expect(formatValue('oneway', 0)).toBe('否');
  });

  it('translates known OSM values and passes unknown ones through', () => {
    expect(formatValue('class', 'motorway')).toBe('國道／高速公路');
    expect(formatValue('building', 'yes')).toBe('一般建物');
    expect(formatValue('class', 'something_new')).toBe('something_new');
  });
});

describe('describeFeature', () => {
  it('uses the name as title and orders known fields first', () => {
    const d = describeFeature('roads', {
      zzz_extra: 'x',
      ref: '1',
      name: '中山高速公路',
      class: 'motorway',
      kind: 'highway',
      tunnel: null,
    });
    expect(d.title).toBe('中山高速公路');
    expect(d.layerLabel).toBe('道路／鐵路');
    expect(d.rows.map((r) => r.key)).toEqual(['name', 'kind', 'class', 'ref', 'zzz_extra']);
  });

  it('treats buildings without height fields as the 2-level default', () => {
    // tile_buildings 不輸出預設 2 層建物的高度欄位
    const d = describeFeature('buildings', { building: 'yes', has_parts: true });
    const rows = Object.fromEntries(d.rows.map((r) => [r.key, r.value]));
    expect(rows.render_height).toBe('6.4 m');
    expect(rows.height_source).toBe('無資料，預設 2 層推估');
    expect(rows).not.toHaveProperty('has_parts');
    expect(formatValue('height_source', 'height')).toBe('OSM 高度標註');
    expect(formatValue('render_min_height', 12)).toBe('12.0 m');
  });

  it('keeps tagged heights as delivered', () => {
    const d = describeFeature('buildings', { name: '台北101', render_height: 508, height_source: 'height' });
    const rows = Object.fromEntries(d.rows.map((r) => [r.key, r.value]));
    expect(rows.render_height).toBe('508.0 m');
    expect(rows.height_source).toBe('OSM 高度標註');
  });

  it('does not add height rows to non-building layers', () => {
    const d = describeFeature('pois', { name: 'x', class: 'amenity' });
    expect(d.rows.map((r) => r.key)).not.toContain('render_height');
  });

  it('hides internal rendering properties', () => {
    const d = describeFeature('pois', { name: '台北車站', class: 'railway', subclass: 'station', minzoom: 11 });
    expect(d.rows.map((r) => r.key)).not.toContain('minzoom');
  });

  it('falls back to the subclass, then the layer label, when unnamed', () => {
    expect(describeFeature('pois', { class: 'amenity', subclass: 'hospital' }).title).toBe('醫院');
    expect(describeFeature('buildings', {}).title).toBe('建物');
  });
});
