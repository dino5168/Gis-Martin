import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import {
  BUILDINGS_3D_LAYER_ID,
  COUNTRY_BOUNDARY_MINZOOM,
  buildStyle,
  layerVisibility,
  compositeTileJsonUrl,
  INTERACTIVE_LAYER_IDS,
  LAYER_GROUPS,
  layerIdsOf,
  PALETTE,
  SOURCE_LAYERS,
} from './style';

const style = buildStyle('http://localhost:3000');

describe('buildStyle', () => {
  it('passes MapLibre style-spec validation', () => {
    const errors = validateStyleMin(style);
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('points the vector source at the Martin composite TileJSON', () => {
    const source = style.sources.taiwan;
    expect(source).toMatchObject({
      type: 'vector',
      url: 'http://localhost:3000/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois',
    });
  });

  it('paints the sea as background and land on top of it', () => {
    const [background, land] = style.layers;
    expect(background).toMatchObject({ id: 'background', type: 'background' });
    expect(land).toMatchObject({ id: 'land-fill', type: 'fill', 'source-layer': 'land' });
  });

  it('only references source-layers that Martin publishes', () => {
    const used = style.layers.flatMap((l) => ('source-layer' in l && l['source-layer'] ? [l['source-layer']] : []));
    for (const name of used) {
      expect(SOURCE_LAYERS).toContain(name);
    }
  });

  it('has unique layer ids', () => {
    const ids = style.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('layer groups', () => {
  it('every toggle group controls at least one layer', () => {
    for (const g of LAYER_GROUPS) {
      expect(layerIdsOf(g.id).length, g.id).toBeGreaterThan(0);
    }
  });

  it('only the sea/land base layers are outside toggle groups', () => {
    const grouped = new Set(LAYER_GROUPS.flatMap((g) => layerIdsOf(g.id)));
    const ungrouped = style.layers.filter((l) => !grouped.has(l.id)).map((l) => l.id);
    expect(ungrouped).toEqual(['background', 'land-fill']);
  });

  it('base layers are not interactive', () => {
    expect(INTERACTIVE_LAYER_IDS).not.toContain('background');
    expect(INTERACTIVE_LAYER_IDS).not.toContain('land-fill');
  });

  it('labels are not interactive', () => {
    for (const id of layerIdsOf('labels')) {
      expect(INTERACTIVE_LAYER_IDS).not.toContain(id);
    }
  });
});

describe('maritime country boundary', () => {
  it('is hidden at low zoom while county boundaries stay visible', () => {
    const country = style.layers.find((l) => l.id === 'boundaries-country');
    const county = style.layers.find((l) => l.id === 'boundaries-county');
    expect(country).toMatchObject({ minzoom: COUNTRY_BOUNDARY_MINZOOM, filter: ['==', ['get', 'admin_level'], 2] });
    expect(county?.minzoom).toBeUndefined();
    expect(county).toMatchObject({ filter: ['==', ['get', 'admin_level'], 4] });
  });
});

describe('administrative labels', () => {
  it.each(['label-counties', 'label-towns'])('%s uses one representative point per area', (id) => {
    const layer = style.layers.find((l) => l.id === id);
    // 掛在面上時多島縣市（澎湖 119 塊）每塊島各標一次
    expect(layer?.type).toBe('symbol');
    expect(JSON.stringify(layer?.type === 'symbol' ? layer.filter : null)).toContain('["geometry-type"]');
  });
});

describe('LOD1 buildings', () => {
  const extrusion = style.layers.find((l) => l.id === BUILDINGS_3D_LAYER_ID);
  const flat = style.layers.find((l) => l.id === 'buildings-fill');

  it('extrudes buildings from z15 and starts hidden', () => {
    expect(extrusion).toMatchObject({ type: 'fill-extrusion', minzoom: 15, layout: { visibility: 'none' } });
  });

  it('keeps building:part out of the 2D fill to avoid double painting', () => {
    expect(flat?.type).toBe('fill');
    expect(JSON.stringify(flat?.type === 'fill' ? flat.filter : null)).toContain('is_part');
  });

  it('is visible only when 3D mode is on and the buildings group is shown', () => {
    expect(layerVisibility(new Set(), false)[BUILDINGS_3D_LAYER_ID]).toBe('none');
    expect(layerVisibility(new Set(), true)[BUILDINGS_3D_LAYER_ID]).toBe('visible');
    expect(layerVisibility(new Set(['buildings']), true)[BUILDINGS_3D_LAYER_ID]).toBe('none');
    // 3D 模式不影響其他圖層
    expect(layerVisibility(new Set(), true)['buildings-fill']).toBe('visible');
    expect(layerVisibility(new Set(['roads']), false)['roads-major']).toBe('none');
  });

  it('excludes base layers from visibility control', () => {
    const v = layerVisibility(new Set(), false);
    expect(v).not.toHaveProperty('background');
    expect(v).not.toHaveProperty('land-fill');
  });
});

describe('transit route colours', () => {
  const line = style.layers.find((l) => l.id === 'transit-line');
  const rails = style.layers.find((l) => l.id === 'railways-line');

  it('colours transit lines from the feature colour with a safe fallback', () => {
    expect(line?.type).toBe('line');
    const colour = JSON.stringify(line?.type === 'line' ? line.paint?.['line-color'] : null);
    expect(colour).toContain('"to-color"');
    expect(colour).toContain('"colour"');
  });

  it('draws the route colour above the plain grey track layer', () => {
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf('transit-line')).toBeGreaterThan(ids.indexOf('railways-line'));
    expect(ids.indexOf('transit-casing')).toBeLessThan(ids.indexOf('transit-line'));
    expect(rails?.type === 'line' ? rails.paint?.['line-color'] : null).toBe(PALETTE.rail);
  });

  it('is toggled together with the railways group', () => {
    expect(layerIdsOf('railways')).toEqual(['railways-line', 'transit-casing', 'transit-line']);
  });
});

describe('POI layer', () => {
  const poi = style.layers.find((l) => l.id === 'pois-symbol');

  it('is a symbol layer so overlapping POIs are hidden by collision detection', () => {
    expect(poi?.type).toBe('symbol');
  });

  it('only references icons that icons.ts can generate', async () => {
    const { POI_ICONS } = await import('./icons');
    const iconExpr = JSON.stringify(poi?.type === 'symbol' ? poi.layout?.['icon-image'] : null);
    const referenced = [...iconExpr.matchAll(/"(poi-[a-z]+)"/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) expect(Object.keys(POI_ICONS)).toContain(id);
  });
});

describe('compositeTileJsonUrl', () => {
  it('joins every source layer in draw order', () => {
    expect(compositeTileJsonUrl('https://t.example.com/m')).toBe(
      'https://t.example.com/m/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois',
    );
  });
});
