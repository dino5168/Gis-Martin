import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from '@maplibre/maplibre-gl-style-spec';

/** Martin source ids, which are also the MVT `source-layer` names. */
export const SOURCE_LAYERS = [
  'land',
  'boundaries',
  'landuse',
  'water',
  'waterways',
  'roads',
  'transit',
  'buildings',
  'pois',
] as const;
export type SourceLayer = (typeof SOURCE_LAYERS)[number];

export const SOURCE_ID = 'taiwan';

/** LOD1 extruded buildings; visibility is driven by the 3D mode toggle, not only its group. */
export const BUILDINGS_3D_LAYER_ID = 'buildings-3d';
/** Heights are only in z14 tiles; extrude from z15 to keep the GPU load reasonable. */
export const BUILDINGS_3D_MINZOOM = 15;
/**
 * Height used when a building has no height/levels tags (2 levels × 3.2 m).
 * Must match `01_post_import.sql`; tile_buildings omits the field for these buildings.
 */
export const DEFAULT_BUILDING_HEIGHT_M = 6.4;

// demotiles 只提供拉丁字型；中日韓文字由 MapView 的 localIdeographFontFamily 在瀏覽器端繪製
export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
const FONT = ['Open Sans Semibold'];

/** Toggleable layer groups shown in the side panel, in display order. */
export const LAYER_GROUPS = [
  { id: 'landuse', label: '土地使用' },
  { id: 'water', label: '水域' },
  { id: 'boundaries', label: '行政界' },
  { id: 'roads', label: '道路' },
  { id: 'railways', label: '鐵路・捷運' },
  { id: 'buildings', label: '建物' },
  { id: 'pois', label: '興趣點' },
  { id: 'labels', label: '文字標註' },
] as const;
export type LayerGroupId = (typeof LAYER_GROUPS)[number]['id'];

/** Map palette; the background is the sea and the `land` layer paints coastline polygons over it. */
export const PALETTE = {
  land: '#f4f1ea',
  sea: '#a8cfe6',
  water: '#a8cfe6',
  waterLine: '#7fb6d9',
  forest: '#cfe3c3',
  grass: '#dcecc9',
  farmland: '#eef0d5',
  residential: '#ece6df',
  commercial: '#f1e3df',
  industrial: '#e6dde8',
  landuseOther: '#e9e6dc',
  building: '#dcd3cb',
  buildingOutline: '#c8bdb3',
  building3dLow: '#e6ddd3',
  building3dMid: '#cdbfb2',
  building3dHigh: '#a99a8c',
  building3dTop: '#857565',
  boundaryCounty: '#8a7fa8',
  boundaryTown: '#b3a9c9',
  boundaryVillage: '#d2cce0',
  motorway: '#d9363e',
  trunk: '#f0b36a',
  primary: '#f6d27c',
  secondary: '#fbe7a1',
  minorRoad: '#ffffff',
  roadCasing: '#c9c2b8',
  path: '#a58f73',
  rail: '#8c8c8c',
  subway: '#4f7fc7',
  poi: '#b5615a',
  poiTransit: '#4f7fc7',
  label: '#3a3a3a',
  labelHalo: '#ffffff',
} as const;

const PATH_CLASSES = ['footway', 'path', 'cycleway', 'steps', 'bridleway'];
const MAJOR_ROADS = ['motorway', 'trunk', 'primary', 'secondary'];

/**
 * Builds a zoom-interpolated road width expression.
 *
 * MapLibre only allows `zoom` as the input of a top-level interpolate, so the
 * casing cannot be expressed as `fill width + n`; it is generated with an offset instead.
 *
 * Args:
 *   extra: Pixels added at every stop (0 for the fill, > 0 for the casing).
 *
 * Returns:
 *   An `interpolate` expression usable as `line-width`.
 */
export function roadWidth(extra: number): ExpressionSpecification {
  const w = (n: number): number => n + extra;
  return [
    'interpolate', ['exponential', 1.5], ['zoom'],
    5, ['match', ['get', 'class'], ['motorway', 'trunk'], w(0.8), w(0.4)],
    10, ['match', ['get', 'class'], ['motorway', 'trunk'], w(2.5), 'primary', w(2), 'secondary', w(1.5), w(1)],
    14, ['match', ['get', 'class'],
      ['motorway', 'trunk'], w(8),
      'primary', w(6.5),
      ['secondary', 'tertiary'], w(5),
      ['residential', 'unclassified', 'living_street', 'motorway_link', 'trunk_link', 'primary_link'], w(3.5),
      w(2.5)],
    18, ['match', ['get', 'class'],
      ['motorway', 'trunk'], w(28),
      'primary', w(24),
      ['secondary', 'tertiary'], w(20),
      w(14)],
  ];
}

const roadColor: ExpressionSpecification = [
  'match', ['get', 'class'],
  ['motorway', 'motorway_link'], PALETTE.motorway,
  ['trunk', 'trunk_link'], PALETTE.trunk,
  ['primary', 'primary_link'], PALETTE.primary,
  ['secondary', 'secondary_link'], PALETTE.secondary,
  PALETTE.minorRoad,
];

const landuseColor: ExpressionSpecification = [
  'match', ['get', 'type'],
  ['forest', 'wood', 'scrub', 'heath'], PALETTE.forest,
  ['grass', 'grassland', 'meadow', 'park', 'garden', 'recreation_ground', 'golf_course', 'pitch', 'village_green'], PALETTE.grass,
  ['farmland', 'orchard', 'farmyard', 'vineyard', 'plant_nursery', 'aquaculture'], PALETTE.farmland,
  'residential', PALETTE.residential,
  ['commercial', 'retail'], PALETTE.commercial,
  ['industrial', 'quarry', 'landfill', 'railway'], PALETTE.industrial,
  PALETTE.landuseOther,
];

/** 海上國界虛線的最小顯示 zoom（低於此 zoom 只畫縣市界）。 */
export const COUNTRY_BOUNDARY_MINZOOM = 10;

const isHighway: ExpressionSpecification = ['==', ['get', 'kind'], 'highway'];
/** boundaries 層中的行政區代表點（外框是 MultiPolygon，標註點是 Point）。 */
const isLabelPoint: ExpressionSpecification = ['==', ['geometry-type'], 'Point'];
const isRailway: ExpressionSpecification = ['==', ['get', 'kind'], 'railway'];
const isPath: ExpressionSpecification = ['in', ['get', 'class'], ['literal', PATH_CLASSES]];

const textPaint = {
  'text-color': PALETTE.label,
  'text-halo-color': PALETTE.labelHalo,
  'text-halo-width': 1.5,
} as const;

type GroupedLayer = { group: LayerGroupId | null; layer: LayerSpecification };

/** All style layers in draw order, each tagged with its toggle group (null = always on). */
const LAYERS: GroupedLayer[] = [
  // 底圖：背景是海，陸地面蓋在上面；兩者不提供開關
  { group: null, layer: { id: 'background', type: 'background', paint: { 'background-color': PALETTE.sea } } },
  {
    group: null,
    layer: {
      id: 'land-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'land',
      // 關閉 antialias：land 已切塊，開啟時塊與塊之間會出現細縫
      paint: { 'fill-color': PALETTE.land, 'fill-antialias': false },
    },
  },

  // ---- landuse / water ----
  {
    group: 'landuse',
    layer: {
      id: 'landuse-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'landuse',
      paint: { 'fill-color': landuseColor, 'fill-opacity': 0.9 },
    },
  },
  {
    group: 'water',
    layer: {
      id: 'water-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'water',
      paint: { 'fill-color': PALETTE.water },
    },
  },
  {
    group: 'water',
    layer: {
      id: 'waterways-line', type: 'line', source: SOURCE_ID, 'source-layer': 'waterways',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': PALETTE.waterLine,
        'line-width': ['interpolate', ['linear'], ['zoom'],
          8, ['match', ['get', 'class'], 'river', 0.8, 0.3],
          14, ['match', ['get', 'class'], 'river', 4, 'canal', 2.5, 1.2]],
      },
    },
  },

  // ---- buildings ----
  {
    group: 'buildings',
    layer: {
      // 2D 只畫外框；building:part 與外框重疊，畫了會變深色
      id: 'buildings-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'buildings', minzoom: 13,
      filter: ['!=', ['get', 'is_part'], true],
      paint: {
        'fill-color': PALETTE.building,
        'fill-outline-color': PALETTE.buildingOutline,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 15, 1],
      },
    },
  },

  // ---- boundaries（只畫外框，不填色）----
  {
    group: 'boundaries',
    layer: {
      id: 'boundaries-village', type: 'line', source: SOURCE_ID, 'source-layer': 'boundaries', minzoom: 12,
      filter: ['==', ['get', 'admin_level'], 9],
      paint: { 'line-color': PALETTE.boundaryVillage, 'line-width': 0.6, 'line-dasharray': [2, 2] },
    },
  },
  {
    group: 'boundaries',
    layer: {
      id: 'boundaries-town', type: 'line', source: SOURCE_ID, 'source-layer': 'boundaries', minzoom: 9,
      filter: ['in', ['get', 'admin_level'], ['literal', [7, 8]]],
      paint: { 'line-color': PALETTE.boundaryTown, 'line-width': 0.9, 'line-dasharray': [3, 2] },
    },
  },
  {
    group: 'boundaries',
    layer: {
      // 台灣國界（admin_level 2）幾乎全在海上（領海線，面積約為陸地 2.5 倍）；
      // 低 zoom 時是一圈遠離海岸的虛線，像範圍框 → 只在近岸尺度顯示
      id: 'boundaries-country', type: 'line', source: SOURCE_ID, 'source-layer': 'boundaries',
      minzoom: COUNTRY_BOUNDARY_MINZOOM,
      filter: ['==', ['get', 'admin_level'], 2],
      paint: {
        'line-color': PALETTE.boundaryCounty,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 12, 2],
        'line-dasharray': [4, 2],
      },
    },
  },
  {
    group: 'boundaries',
    layer: {
      id: 'boundaries-county', type: 'line', source: SOURCE_ID, 'source-layer': 'boundaries',
      filter: ['==', ['get', 'admin_level'], 4],
      paint: {
        'line-color': PALETTE.boundaryCounty,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 12, 2],
        'line-dasharray': [4, 2],
      },
    },
  },

  // ---- roads ----
  {
    group: 'roads',
    layer: {
      id: 'roads-path', type: 'line', source: SOURCE_ID, 'source-layer': 'roads', minzoom: 14,
      filter: ['all', isHighway, isPath],
      paint: { 'line-color': PALETTE.path, 'line-width': 1, 'line-dasharray': [2, 1.5] },
    },
  },
  {
    group: 'roads',
    layer: {
      // 白色小路需要外框才能和底色區分；z12 以下只有主要道路，不畫外框
      id: 'roads-casing', type: 'line', source: SOURCE_ID, 'source-layer': 'roads', minzoom: 12,
      filter: ['all', isHighway, ['!', isPath]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': PALETTE.roadCasing, 'line-width': roadWidth(1.5) },
    },
  },
  {
    group: 'roads',
    layer: {
      id: 'roads-minor', type: 'line', source: SOURCE_ID, 'source-layer': 'roads',
      filter: ['all', isHighway, ['!', isPath], ['!', ['in', ['get', 'class'], ['literal', MAJOR_ROADS]]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': roadColor, 'line-width': roadWidth(0) },
    },
  },
  {
    group: 'roads',
    layer: {
      // 主要道路畫在最上層，交叉口不被小路蓋住
      id: 'roads-major', type: 'line', source: SOURCE_ID, 'source-layer': 'roads',
      filter: ['all', isHighway, ['in', ['get', 'class'], ['literal', MAJOR_ROADS]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': roadColor, 'line-width': roadWidth(0) },
    },
  },

  // ---- railways ----
  {
    group: 'railways',
    layer: {
      // 軌道本身一律灰色（台鐵、機廠、側線）；捷運／高鐵路線色由下方 transit 圖層疊上
      id: 'railways-line', type: 'line', source: SOURCE_ID, 'source-layer': 'roads',
      filter: isRailway,
      paint: {
        'line-color': PALETTE.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2.5],
      },
    },
  },
  {
    group: 'railways',
    layer: {
      // 白色外框：路線色（如環狀線黃、淡海輕軌粉）壓在淺色底圖上仍清楚
      id: 'transit-casing', type: 'line', source: SOURCE_ID, 'source-layer': 'transit',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 10, 3.5, 14, 6.5, 18, 12],
      },
    },
  },
  {
    group: 'railways',
    layer: {
      id: 'transit-line', type: 'line', source: SOURCE_ID, 'source-layer': 'transit',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        // OSM colour 可能是 #rrggbb 或 CSS 色名（orange、green）；無法解析時退回預設捷運藍
        'line-color': ['to-color', ['coalesce', ['get', 'colour'], PALETTE.subway], PALETTE.subway],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 10, 2, 14, 4, 18, 8],
      },
    },
  },

  // ---- buildings 3D（LOD1）----
  // 放在道路之後：柱體會遮住後方道路，比 2D 圖層更上層才合理。
  // 預設隱藏，由 3D 模式開關控制（見 MapView 的 threeD）。
  {
    group: 'buildings',
    layer: {
      id: BUILDINGS_3D_LAYER_ID, type: 'fill-extrusion', source: SOURCE_ID, 'source-layer': 'buildings',
      minzoom: BUILDINGS_3D_MINZOOM,
      layout: { visibility: 'none' },
      // 有分段的外框改由分段呈現（OSM Simple 3D Buildings），否則外框柱體會包住分段
      filter: ['any', ['==', ['get', 'is_part'], true], ['!=', ['get', 'has_parts'], true]],
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], DEFAULT_BUILDING_HEIGHT_M],
          0, PALETTE.building3dLow,
          30, PALETTE.building3dMid,
          100, PALETTE.building3dHigh,
          300, PALETTE.building3dTop,
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], DEFAULT_BUILDING_HEIGHT_M],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-vertical-gradient': true,
      },
    },
  },

  // ---- pois ----
  {
    group: 'pois',
    layer: {
      // symbol 而非 circle：symbol 有碰撞偵測，密集處自動隱藏重疊的點，疏密隨螢幕自適應。
      // 圖示由 MapView 在 styleimagemissing 時以 icons.ts 產生。
      id: 'pois-symbol', type: 'symbol', source: SOURCE_ID, 'source-layer': 'pois',
      // minzoom 屬性 = 該 POI 最早出現的 zoom（tile_pois 輸出；z14 圖磚含 15/16 級供 overzoom）
      filter: ['<=', ['get', 'minzoom'], ['zoom']],
      layout: {
        'icon-image': [
          'case',
          ['in', ['get', 'class'], ['literal', ['railway', 'public_transport']]], 'poi-transit',
          ['<=', ['get', 'minzoom'], 14], 'poi-major',
          'poi-default',
        ],
        // 碰撞時保留 sort key 小的：minzoom 小 = 越重要
        'symbol-sort-key': ['get', 'minzoom'],
        'icon-padding': 2,
        'text-field': ['step', ['zoom'], '', 15, ['coalesce', ['get', 'name'], '']],
        'text-font': FONT,
        'text-size': 11,
        'text-offset': [0, 0.8],
        'text-anchor': 'top',
        'text-max-width': 8,
        // 名稱放不下時仍顯示點，不讓整個 POI 消失
        'text-optional': true,
      },
      paint: { ...textPaint, 'text-color': PALETTE.poi },
    },
  },

  // ---- labels ----
  // 行政區名稱只用 tile_boundaries 輸出的代表點；若掛在面上，多島縣市（澎湖、連江）每塊島都會重複一次
  {
    group: 'labels',
    layer: {
      id: 'label-roads', type: 'symbol', source: SOURCE_ID, 'source-layer': 'roads', minzoom: 13,
      filter: ['all', isHighway, ['has', 'name']],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 13],
      },
      paint: textPaint,
    },
  },
  {
    group: 'labels',
    layer: {
      id: 'label-towns', type: 'symbol', source: SOURCE_ID, 'source-layer': 'boundaries', minzoom: 10, maxzoom: 13,
      filter: ['all', isLabelPoint, ['in', ['get', 'admin_level'], ['literal', [7, 8]]]],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 12 },
      paint: textPaint,
    },
  },
  {
    group: 'labels',
    layer: {
      id: 'label-counties', type: 'symbol', source: SOURCE_ID, 'source-layer': 'boundaries', minzoom: 6, maxzoom: 10,
      filter: ['all', isLabelPoint, ['==', ['get', 'admin_level'], 4]],
      layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 14 },
      paint: { ...textPaint, 'text-color': PALETTE.boundaryCounty },
    },
  },
];

/**
 * Returns the Martin composite TileJSON URL that serves every source layer in one tile.
 *
 * Args:
 *   martinUrl: Validated Martin base URL without trailing slash.
 *
 * Returns:
 *   URL of the composite TileJSON.
 */
export function compositeTileJsonUrl(martinUrl: string): string {
  return `${martinUrl}/${SOURCE_LAYERS.join(',')}`;
}

/**
 * Builds the complete MapLibre style for the Taiwan vector tiles.
 *
 * Args:
 *   martinUrl: Validated Martin base URL without trailing slash.
 *
 * Returns:
 *   A MapLibre style specification (v8).
 */
export function buildStyle(martinUrl: string): StyleSpecification {
  return {
    version: 8,
    name: 'Taiwan OSM',
    glyphs: GLYPHS_URL,
    sources: {
      [SOURCE_ID]: { type: 'vector', url: compositeTileJsonUrl(martinUrl) },
    },
    layers: LAYERS.map((l) => l.layer),
  };
}

/**
 * Lists the style layer ids that belong to a toggle group.
 *
 * Args:
 *   group: Layer group id from LAYER_GROUPS.
 *
 * Returns:
 *   Style layer ids in draw order.
 */
export function layerIdsOf(group: LayerGroupId): string[] {
  return LAYERS.filter((l) => l.group === group).map((l) => l.layer.id);
}

/**
 * Computes the `visibility` of every toggleable layer.
 *
 * Args:
 *   hiddenGroups: Groups switched off in the side panel.
 *   threeD: Whether 3D (LOD1) building mode is on.
 *
 * Returns:
 *   Map of layer id to `'visible' | 'none'`; base layers (sea/land) are not included.
 */
export function layerVisibility(
  hiddenGroups: ReadonlySet<LayerGroupId>,
  threeD: boolean,
): Record<string, 'visible' | 'none'> {
  const result: Record<string, 'visible' | 'none'> = {};
  for (const { group, layer } of LAYERS) {
    if (group === null) continue;
    const on = !hiddenGroups.has(group) && (layer.id !== BUILDINGS_3D_LAYER_ID || threeD);
    result[layer.id] = on ? 'visible' : 'none';
  }
  return result;
}

/** Layer ids that respond to clicks (everything except base layers and labels). */
export const INTERACTIVE_LAYER_IDS: readonly string[] = LAYERS
  .filter((l) => l.group !== null && l.group !== 'labels')
  .map((l) => l.layer.id);
