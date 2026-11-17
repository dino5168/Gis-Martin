import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import {
  BUILDINGS_3D_LAYER_ID,
  BUS_SOURCE_ID,
  busIconIds,
  COUNTRY_BOUNDARY_MINZOOM,
  buildStyle,
  DEFAULT_THEME,
  isThemeId,
  layerVisibility,
  compositeTileJsonUrl,
  INTERACTIVE_LAYER_IDS,
  LAYER_GROUPS,
  layerIdsOf,
  MAKI_ICONS,
  makiIconId,
  type MakiName,
  PALETTE,
  paletteOf,
  POI_CLASS_MAKI,
  POI_GROUP_COLOR,
  POI_GROUP_LABELS,
  POI_ICONS,
  POI_MAKI,
  type PoiGroup,
  SOURCE_LAYERS,
  THEMES,
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

  it.each(THEMES.map((t) => t.id))('%s theme only references icons MapView can generate', (theme) => {
    const themed = buildStyle('http://localhost:3000', { theme }).layers.find((l) => l.id === 'pois-symbol');
    const iconExpr = JSON.stringify(themed?.type === 'symbol' ? themed.layout?.['icon-image'] : null);
    const referenced = new Set([...iconExpr.matchAll(/"((?:poi|maki)-[a-z-]+)"/g)].map((m) => m[1] ?? ''));
    const known = new Set([...Object.keys(POI_ICONS), ...Object.keys(MAKI_ICONS)]);
    expect([...referenced].filter((id) => id.startsWith('poi-'))).toHaveLength(3);
    for (const id of referenced) {
      expect(known, id).toContain(id);
      expect(id).toMatch(new RegExp(`-${theme}$`));
    }
  });
});

describe('POI Maki icons', () => {
  // Tasks/4-興趣點.md 列出的 tourism 子類別（筆數 ≥ 20）
  const TOURISM_REQUIRED = [
    'information', 'attraction', 'viewpoint', 'artwork', 'hotel', 'hostel', 'camp_site', 'guest_house',
    'museum', 'checkpoint', 'picnic_site', 'motel', 'gallery', 'apartment', 'camp_pitch', 'alpine_hut',
  ];
  const iconExpr = (theme: (typeof THEMES)[number]['id']): string => {
    const layer = buildStyle('http://localhost:3000', { theme }).layers.find((l) => l.id === 'pois-symbol');
    return JSON.stringify(layer?.type === 'symbol' ? layer.layout?.['icon-image'] : null);
  };

  it('maps every listed tourism subclass to a Maki glyph', () => {
    for (const s of TOURISM_REQUIRED) expect(Object.keys(POI_MAKI), s).toContain(`tourism/${s}`);
  });

  it('uses only class/subclass keys whose class the importer produces', () => {
    const classes = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'office', 'railway', 'public_transport'];
    for (const key of Object.keys(POI_MAKI)) expect(classes, key).toContain(key.split('/')[0]);
    for (const cls of Object.keys(POI_CLASS_MAKI)) expect(classes).toContain(cls);
  });

  it('defines one image per glyph, group and theme, coloured with the group colour of that theme', () => {
    const pairs = new Set([...Object.values(POI_MAKI), ...Object.values(POI_CLASS_MAKI)].map(([m, g]) => `${m}|${g}`));
    expect(Object.keys(MAKI_ICONS).filter((id) => id.startsWith('maki-'))).toHaveLength(pairs.size * THEMES.length);
    for (const t of THEMES) {
      for (const pair of pairs) {
        const [maki, group] = pair.split('|') as [MakiName, PoiGroup];
        expect(MAKI_ICONS[makiIconId(maki, group, t.id)]).toEqual({
          maki,
          fill: t.palette[POI_GROUP_COLOR[group]],
          diameter: 18,
          shape: 'disc',
        });
      }
    }
  });

  it('routes subclasses to glyphs, then class fallbacks, then the plain dots', () => {
    const expr = iconExpr('dark');
    expect(expr).toContain('"maki-lodging-tourism-dark"');
    expect(expr).toContain('["tourism/hotel","tourism/motel","tourism/hostel"]');
    expect(expr).toContain('"maki-bus-transport-dark"');
    // 未列出的商店子類別 → 購物袋；其他類別 → 圓點
    expect(expr).toContain('["shop"],"maki-shop-shop-dark"');
    expect(expr).toContain('"poi-transit-dark"');
  });

  it('gives every POI group a label and a palette colour', () => {
    expect(Object.keys(POI_GROUP_LABELS).sort()).toEqual(Object.keys(POI_GROUP_COLOR).sort());
  });
});

describe('themes', () => {
  const ids = (s: ReturnType<typeof buildStyle>): string[] => s.layers.map((l) => l.id);

  it.each(THEMES.map((t) => t.id))('%s passes MapLibre style-spec validation', (theme) => {
    const errors = validateStyleMin(buildStyle('http://localhost:3000', { theme }));
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('keeps identical layer ids and order so setStyle diff only touches paint', () => {
    for (const t of THEMES) {
      expect(ids(buildStyle('http://localhost:3000', { theme: t.id }))).toEqual(ids(style));
    }
  });

  it('paints the background with the theme sea colour', () => {
    for (const t of THEMES) {
      const [background] = buildStyle('http://localhost:3000', { theme: t.id }).layers;
      expect(background?.type === 'background' ? background.paint?.['background-color'] : null).toBe(t.palette.sea);
    }
  });

  it('defaults to the default theme', () => {
    expect(DEFAULT_THEME).toBe('default');
    expect(paletteOf(DEFAULT_THEME)).toBe(PALETTE);
  });

  it('validates untrusted theme ids', () => {
    expect(isThemeId('dark')).toBe(true);
    expect(isThemeId('neon')).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});

describe('visibility baked into the style', () => {
  const visibilityOf = (s: ReturnType<typeof buildStyle>, id: string): unknown =>
    s.layers.find((l) => l.id === id)?.layout?.visibility;

  it('hides layers of hidden groups and shows 3D buildings only in 3D mode', () => {
    const s = buildStyle('http://localhost:3000', { theme: 'dark', hiddenGroups: new Set(['roads']), threeD: true });
    expect(visibilityOf(s, 'roads-major')).toBe('none');
    expect(visibilityOf(s, 'water-fill')).toBe('visible');
    expect(visibilityOf(s, BUILDINGS_3D_LAYER_ID)).toBe('visible');
  });

  it('leaves the sea/land base layers without a visibility override', () => {
    const s = buildStyle('http://localhost:3000', { hiddenGroups: new Set(['landuse']) });
    expect(visibilityOf(s, 'background')).toBeUndefined();
    expect(visibilityOf(s, 'land-fill')).toBeUndefined();
  });
});

describe('live buses', () => {
  const sample = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        id: '706-U3',
        geometry: { type: 'Point' as const, coordinates: [121.5456, 25.0181] as [number, number] },
        properties: {
          name: '1 號公車 706-U3', route: '1 號', plate: '706-U3', dir: 'go' as const,
          direction: '往松仁路', speed: 19, azimuth: 47, data_time: '2026-11-17 17:19:50',
        },
      },
    ],
  };

  it('puts bus positions into a GeoJSON source of the style', () => {
    const s = buildStyle('http://localhost:3000', { buses: sample });
    expect(s.sources[BUS_SOURCE_ID]).toEqual({ type: 'geojson', data: sample });
    expect(validateStyleMin(s).map((e) => e.message)).toEqual([]);
  });

  it('defaults to an empty collection so the layers always exist', () => {
    expect(style.sources[BUS_SOURCE_ID]).toMatchObject({ type: 'geojson', data: { features: [] } });
  });

  it('draws buses above every other layer and toggles them as one group', () => {
    const ids = style.layers.map((l) => l.id);
    expect(ids.slice(-2)).toEqual(['buses-heading', 'buses-symbol']);
    expect(layerIdsOf('buses')).toEqual(['buses-heading', 'buses-symbol']);
    expect(layerVisibility(new Set(['buses']), false)['buses-symbol']).toBe('none');
  });

  it.each(THEMES.map((t) => t.id))('%s theme: bus images exist with the theme direction colours', (theme) => {
    const t = THEMES.find((x) => x.id === theme);
    const go = busIconIds('go', theme);
    const back = busIconIds('back', theme);
    expect(MAKI_ICONS[go.disc]).toMatchObject({ maki: 'bus', fill: t?.palette.busGo, shape: 'disc' });
    expect(MAKI_ICONS[back.arrow]).toMatchObject({ maki: 'triangle', fill: t?.palette.busBack, shape: 'glyph' });
  });

  it('rotates the heading arrow with the bus azimuth', () => {
    const heading = style.layers.find((l) => l.id === 'buses-heading');
    expect(heading?.type === 'symbol' ? heading.layout?.['icon-rotate'] : null).toEqual(['get', 'azimuth']);
  });
});

describe('compositeTileJsonUrl', () => {
  it('joins every source layer in draw order', () => {
    expect(compositeTileJsonUrl('https://t.example.com/m')).toBe(
      'https://t.example.com/m/land,boundaries,landuse,water,waterways,roads,transit,buildings,pois',
    );
  });
});
