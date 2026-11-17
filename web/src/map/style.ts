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

/**
 * Default map palette; the background is the sea and the `land` layer paints coastline polygons over it.
 * Every value must be `#rrggbb` (POI dots are rasterised from it by icons.ts).
 */
const DEFAULT_PALETTE = {
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
  transitCasing: '#ffffff',
} as const;

/** Colour roles shared by every theme; themes only swap colours, never layers. */
export type Palette = Readonly<Record<keyof typeof DEFAULT_PALETTE, string>>;

/** Default palette, kept as a named export for callers that do not care about themes. */
export const PALETTE: Palette = DEFAULT_PALETTE;

// OSM Bright（OpenMapTiles，CC-BY 4.0）的配色近似值。原 style JSON 針對 OpenMapTiles schema，
// 圖層與本專案 Martin 自訂 schema 不相容，因此只取色、圖層結構沿用本專案。
const BRIGHT_PALETTE: Palette = {
  land: '#f8f4f0',
  sea: '#94c1e1',
  water: '#94c1e1',
  waterLine: '#94c1e1',
  forest: '#dde7cc',
  grass: '#d8e8c8',
  farmland: '#e2ebd6',
  residential: '#f1ece7',
  commercial: '#f7eae7',
  industrial: '#f9f4e0',
  landuseOther: '#f1ede6',
  building: '#e8e0d8',
  buildingOutline: '#dfdbd7',
  building3dLow: '#f2eae2',
  building3dMid: '#dfdbd7',
  building3dHigh: '#c9c1b8',
  building3dTop: '#a8a097',
  boundaryCounty: '#9e9cab',
  boundaryTown: '#b9b7c4',
  boundaryVillage: '#d3d1da',
  motorway: '#ffcc88',
  trunk: '#ffeeaa',
  primary: '#ffeeaa',
  secondary: '#fff4c6',
  minorRoad: '#ffffff',
  roadCasing: '#cfcdca',
  path: '#c8a98a',
  rail: '#bbbbbb',
  subway: '#4f7fc7',
  poi: '#8c6d62',
  poiTransit: '#4f7fc7',
  label: '#333333',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
};

const DARK_PALETTE: Palette = {
  land: '#2a2c30',
  sea: '#1b2a3a',
  water: '#1b2a3a',
  waterLine: '#2c4a66',
  forest: '#2c3a2e',
  grass: '#2f3a30',
  farmland: '#33372d',
  residential: '#303136',
  commercial: '#36302f',
  industrial: '#33303a',
  landuseOther: '#2e2f33',
  building: '#3c3e44',
  buildingOutline: '#4a4d54',
  building3dLow: '#45484f',
  building3dMid: '#565a62',
  building3dHigh: '#6c717a',
  building3dTop: '#8a8f98',
  boundaryCounty: '#9a8fc0',
  boundaryTown: '#6f6890',
  boundaryVillage: '#4d4866',
  motorway: '#b5653a',
  trunk: '#8f6a3c',
  primary: '#6f6346',
  secondary: '#5a5446',
  minorRoad: '#4a4c52',
  roadCasing: '#1f2023',
  path: '#6b5d4f',
  rail: '#6b6b6b',
  subway: '#6f9be0',
  poi: '#e08a80',
  poiTransit: '#7ea6e0',
  label: '#e6e6e6',
  labelHalo: '#1d1f22',
  transitCasing: '#1d1f22',
};

// 淡灰低彩度底圖，適合疊加業務資料（類似 Stadia Alidade Smooth 的用途）
const SMOOTH_PALETTE: Palette = {
  land: '#f5f5f3',
  sea: '#cad7e0',
  water: '#cad7e0',
  waterLine: '#b3c6d4',
  forest: '#e3ebdd',
  grass: '#e6eddf',
  farmland: '#eef0e6',
  residential: '#f0efec',
  commercial: '#f1edeb',
  industrial: '#eeedf0',
  landuseOther: '#efefec',
  building: '#e4e2de',
  buildingOutline: '#d8d5d0',
  building3dLow: '#ebe9e5',
  building3dMid: '#d9d6d1',
  building3dHigh: '#c4c0ba',
  building3dTop: '#a9a49d',
  boundaryCounty: '#a3a0b0',
  boundaryTown: '#c2c0cc',
  boundaryVillage: '#dcdbe2',
  motorway: '#f7d9a8',
  trunk: '#fbe6c2',
  primary: '#ffffff',
  secondary: '#ffffff',
  minorRoad: '#ffffff',
  roadCasing: '#dcd9d4',
  path: '#c5b9a8',
  rail: '#c4c4c4',
  subway: '#7d9fd1',
  poi: '#9a8a84',
  poiTransit: '#7d9fd1',
  label: '#5a5a5a',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
};

// 高對比黑白（類似 Stamen Toner）：白色陸地、黑色水域與道路；土地使用不分色
const TONER_PALETTE: Palette = {
  land: '#ffffff',
  sea: '#000000',
  water: '#000000',
  waterLine: '#000000',
  forest: '#ffffff',
  grass: '#ffffff',
  farmland: '#ffffff',
  residential: '#ffffff',
  commercial: '#ffffff',
  industrial: '#ffffff',
  landuseOther: '#ffffff',
  building: '#cccccc',
  buildingOutline: '#999999',
  building3dLow: '#e0e0e0',
  building3dMid: '#bdbdbd',
  building3dHigh: '#8f8f8f',
  building3dTop: '#5c5c5c',
  boundaryCounty: '#000000',
  boundaryTown: '#555555',
  boundaryVillage: '#999999',
  motorway: '#000000',
  trunk: '#000000',
  primary: '#000000',
  secondary: '#000000',
  minorRoad: '#000000',
  roadCasing: '#ffffff',
  path: '#555555',
  rail: '#000000',
  subway: '#000000',
  poi: '#000000',
  poiTransit: '#000000',
  label: '#000000',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
};

// 淡色黑白（類似 Stamen Toner Lite）：灰階、低對比
const TONER_LITE_PALETTE: Palette = {
  land: '#ffffff',
  sea: '#d4d4d4',
  water: '#d4d4d4',
  waterLine: '#c4c4c4',
  forest: '#f4f4f4',
  grass: '#f4f4f4',
  farmland: '#fafafa',
  residential: '#ffffff',
  commercial: '#ffffff',
  industrial: '#fafafa',
  landuseOther: '#ffffff',
  building: '#e6e6e6',
  buildingOutline: '#d0d0d0',
  building3dLow: '#ededed',
  building3dMid: '#d6d6d6',
  building3dHigh: '#b3b3b3',
  building3dTop: '#8a8a8a',
  boundaryCounty: '#9a9a9a',
  boundaryTown: '#bdbdbd',
  boundaryVillage: '#dddddd',
  motorway: '#8f8f8f',
  trunk: '#a3a3a3',
  primary: '#b3b3b3',
  secondary: '#c2c2c2',
  minorRoad: '#dadada',
  roadCasing: '#ffffff',
  path: '#c8c8c8',
  rail: '#9a9a9a',
  subway: '#8a8a8a',
  poi: '#777777',
  poiTransit: '#777777',
  label: '#555555',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
};

/** Selectable map themes, in display order (ids are persisted in localStorage; do not rename). */
export const THEMES = [
  { id: 'default', label: '預設', palette: PALETTE },
  { id: 'bright', label: 'OSM Bright', palette: BRIGHT_PALETTE },
  { id: 'smooth', label: '柔和', palette: SMOOTH_PALETTE },
  { id: 'dark', label: '暗色', palette: DARK_PALETTE },
  { id: 'toner', label: '黑白', palette: TONER_PALETTE },
  { id: 'toner-lite', label: '黑白淡色', palette: TONER_LITE_PALETTE },
] as const satisfies readonly { id: string; label: string; palette: Palette }[];
export type ThemeId = (typeof THEMES)[number]['id'];
export const DEFAULT_THEME: ThemeId = 'default';

/**
 * Narrows an untrusted string (e.g. from localStorage) to a theme id.
 *
 * Args:
 *   value: Candidate theme id.
 *
 * Returns:
 *   True if `value` names a theme in THEMES.
 */
export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/**
 * Looks up the palette of a theme.
 *
 * Args:
 *   theme: Theme id.
 *
 * Returns:
 *   The theme's palette.
 */
export function paletteOf(theme: ThemeId): Palette {
  return THEMES.find((t) => t.id === theme)?.palette ?? PALETTE;
}

/** POI dot kinds referenced by `pois-symbol`; colours come from the active palette. */
const POI_ICON_KINDS = {
  transit: { colorKey: 'poiTransit', diameter: 12 },
  major: { colorKey: 'poi', diameter: 12 },
  default: { colorKey: 'poi', diameter: 9 },
} as const satisfies Record<string, { colorKey: keyof Palette; diameter: number }>;
type PoiIconKind = keyof typeof POI_ICON_KINDS;

/**
 * Image id of a POI dot for a theme.
 *
 * The theme is part of the id: MapLibre keeps added images across `setStyle`,
 * so a shared id would keep the previous theme's colour after switching.
 *
 * Args:
 *   kind: POI dot kind.
 *   theme: Theme id.
 *
 * Returns:
 *   Image id such as `poi-major-dark`.
 */
export function poiIconId(kind: PoiIconKind, theme: ThemeId): string {
  return `poi-${kind}-${theme}`;
}

/** Every POI image id the styles can request, mapped to how MapView should draw it. */
export const POI_ICONS: Readonly<Record<string, { fill: string; diameter: number }>> = Object.fromEntries(
  THEMES.flatMap((t) =>
    (Object.keys(POI_ICON_KINDS) as PoiIconKind[]).map((kind) => {
      const { colorKey, diameter } = POI_ICON_KINDS[kind];
      return [poiIconId(kind, t.id), { fill: t.palette[colorKey], diameter }];
    }),
  ),
);

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

const roadColor = (p: Palette): ExpressionSpecification => [
  'match', ['get', 'class'],
  ['motorway', 'motorway_link'], p.motorway,
  ['trunk', 'trunk_link'], p.trunk,
  ['primary', 'primary_link'], p.primary,
  ['secondary', 'secondary_link'], p.secondary,
  p.minorRoad,
];

const landuseColor = (p: Palette): ExpressionSpecification => [
  'match', ['get', 'type'],
  ['forest', 'wood', 'scrub', 'heath'], p.forest,
  ['grass', 'grassland', 'meadow', 'park', 'garden', 'recreation_ground', 'golf_course', 'pitch', 'village_green'], p.grass,
  ['farmland', 'orchard', 'farmyard', 'vineyard', 'plant_nursery', 'aquaculture'], p.farmland,
  'residential', p.residential,
  ['commercial', 'retail'], p.commercial,
  ['industrial', 'quarry', 'landfill', 'railway'], p.industrial,
  p.landuseOther,
];

/** 海上國界虛線的最小顯示 zoom（低於此 zoom 只畫縣市界）。 */
export const COUNTRY_BOUNDARY_MINZOOM = 10;

const isHighway: ExpressionSpecification = ['==', ['get', 'kind'], 'highway'];
/** boundaries 層中的行政區代表點（外框是 MultiPolygon，標註點是 Point）。 */
const isLabelPoint: ExpressionSpecification = ['==', ['geometry-type'], 'Point'];
const isRailway: ExpressionSpecification = ['==', ['get', 'kind'], 'railway'];
const isPath: ExpressionSpecification = ['in', ['get', 'class'], ['literal', PATH_CLASSES]];

type GroupedLayer = { group: LayerGroupId | null; layer: LayerSpecification };

/**
 * Builds all style layers in draw order, each tagged with its toggle group (null = always on).
 *
 * Layer ids, filters and draw order are identical for every theme, so `setStyle` with
 * `diff: true` only updates paint properties when the theme changes.
 *
 * Args:
 *   theme: Theme whose palette and POI images are used.
 *
 * Returns:
 *   Grouped layers; 3D buildings start hidden.
 */
function buildLayers(theme: ThemeId): GroupedLayer[] {
  const p = paletteOf(theme);
  const textPaint = {
    'text-color': p.label,
    'text-halo-color': p.labelHalo,
    'text-halo-width': 1.5,
  } as const;

  return [
  // 底圖：背景是海，陸地面蓋在上面；兩者不提供開關
  { group: null, layer: { id: 'background', type: 'background', paint: { 'background-color': p.sea } } },
  {
    group: null,
    layer: {
      id: 'land-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'land',
      // 關閉 antialias：land 已切塊，開啟時塊與塊之間會出現細縫
      paint: { 'fill-color': p.land, 'fill-antialias': false },
    },
  },

  // ---- landuse / water ----
  {
    group: 'landuse',
    layer: {
      id: 'landuse-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'landuse',
      paint: { 'fill-color': landuseColor(p), 'fill-opacity': 0.9 },
    },
  },
  {
    group: 'water',
    layer: {
      id: 'water-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'water',
      paint: { 'fill-color': p.water },
    },
  },
  {
    group: 'water',
    layer: {
      id: 'waterways-line', type: 'line', source: SOURCE_ID, 'source-layer': 'waterways',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.waterLine,
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
        'fill-color': p.building,
        'fill-outline-color': p.buildingOutline,
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
      paint: { 'line-color': p.boundaryVillage, 'line-width': 0.6, 'line-dasharray': [2, 2] },
    },
  },
  {
    group: 'boundaries',
    layer: {
      id: 'boundaries-town', type: 'line', source: SOURCE_ID, 'source-layer': 'boundaries', minzoom: 9,
      filter: ['in', ['get', 'admin_level'], ['literal', [7, 8]]],
      paint: { 'line-color': p.boundaryTown, 'line-width': 0.9, 'line-dasharray': [3, 2] },
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
        'line-color': p.boundaryCounty,
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
        'line-color': p.boundaryCounty,
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
      paint: { 'line-color': p.path, 'line-width': 1, 'line-dasharray': [2, 1.5] },
    },
  },
  {
    group: 'roads',
    layer: {
      // 白色小路需要外框才能和底色區分；z12 以下只有主要道路，不畫外框
      id: 'roads-casing', type: 'line', source: SOURCE_ID, 'source-layer': 'roads', minzoom: 12,
      filter: ['all', isHighway, ['!', isPath]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.roadCasing, 'line-width': roadWidth(1.5) },
    },
  },
  {
    group: 'roads',
    layer: {
      id: 'roads-minor', type: 'line', source: SOURCE_ID, 'source-layer': 'roads',
      filter: ['all', isHighway, ['!', isPath], ['!', ['in', ['get', 'class'], ['literal', MAJOR_ROADS]]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': roadColor(p), 'line-width': roadWidth(0) },
    },
  },
  {
    group: 'roads',
    layer: {
      // 主要道路畫在最上層，交叉口不被小路蓋住
      id: 'roads-major', type: 'line', source: SOURCE_ID, 'source-layer': 'roads',
      filter: ['all', isHighway, ['in', ['get', 'class'], ['literal', MAJOR_ROADS]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': roadColor(p), 'line-width': roadWidth(0) },
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
        'line-color': p.rail,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2.5],
      },
    },
  },
  {
    group: 'railways',
    layer: {
      // 外框（淺色主題為白）：路線色（如環狀線黃、淡海輕軌粉）壓在底圖上仍清楚
      id: 'transit-casing', type: 'line', source: SOURCE_ID, 'source-layer': 'transit',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.transitCasing,
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
        'line-color': ['to-color', ['coalesce', ['get', 'colour'], p.subway], p.subway],
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
          0, p.building3dLow,
          30, p.building3dMid,
          100, p.building3dHigh,
          300, p.building3dTop,
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
          ['in', ['get', 'class'], ['literal', ['railway', 'public_transport']]], poiIconId('transit', theme),
          ['<=', ['get', 'minzoom'], 14], poiIconId('major', theme),
          poiIconId('default', theme),
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
      paint: { ...textPaint, 'text-color': p.poi },
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
      paint: { ...textPaint, 'text-color': p.boundaryCounty },
    },
  },
  ];
}

/** Layer structure (ids, groups, order) is theme-independent; derive it once from the default theme. */
const LAYERS: readonly GroupedLayer[] = buildLayers(DEFAULT_THEME);

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

/** Runtime choices baked into the style. */
export interface StyleOptions {
  theme?: ThemeId;
  hiddenGroups?: ReadonlySet<LayerGroupId>;
  /** LOD1 3D building mode. */
  threeD?: boolean;
}

/**
 * Builds the complete MapLibre style for the Taiwan vector tiles.
 *
 * Theme and layer visibility are part of the style (instead of being patched onto
 * the map afterwards), so a single `setStyle(style, { diff: true })` applies any
 * combination of changes without the theme switch resetting visibility.
 *
 * Args:
 *   martinUrl: Validated Martin base URL without trailing slash.
 *   options: Theme, hidden layer groups and 3D mode; defaults to the default theme, all groups on, 2D.
 *
 * Returns:
 *   A MapLibre style specification (v8).
 */
export function buildStyle(martinUrl: string, options: StyleOptions = {}): StyleSpecification {
  const { theme = DEFAULT_THEME, hiddenGroups = new Set<LayerGroupId>(), threeD = false } = options;
  const visibility = layerVisibility(hiddenGroups, threeD);
  return {
    version: 8,
    name: `Taiwan OSM (${theme})`,
    glyphs: GLYPHS_URL,
    sources: {
      [SOURCE_ID]: { type: 'vector', url: compositeTileJsonUrl(martinUrl) },
    },
    layers: buildLayers(theme).map(({ layer }) => {
      const v = visibility[layer.id];
      return v === undefined ? layer : ({ ...layer, layout: { ...layer.layout, visibility: v } } as LayerSpecification);
    }),
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
