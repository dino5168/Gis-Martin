import { DEFAULT_BUILDING_HEIGHT_M } from './style';

/** One label/value row in the feature info panel. */
export interface InfoRow {
  key: string;
  label: string;
  value: string;
}

/** Display-ready description of a clicked map feature. */
export interface FeatureDescription {
  title: string;
  layerLabel: string;
  rows: InfoRow[];
}

const LAYER_LABELS: Readonly<Record<string, string>> = {
  boundaries: '行政界',
  landuse: '土地使用',
  water: '水域',
  waterways: '水道',
  roads: '道路／鐵路',
  transit: '捷運／高鐵路線',
  buildings: '建物',
  pois: '興趣點',
};

// 顯示順序即宣告順序；未列出的屬性排在後面（依字母序）
const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: '名稱',
  kind: '種類',
  class: '類別',
  subclass: '子類別',
  type: '類型',
  ref: '編號',
  network: '系統',
  admin_level: '行政層級',
  building: '建物類型',
  levels: '樓層數',
  render_height: '高度',
  render_min_height: '底部高度',
  height_source: '高度來源',
  is_part: '建物分段',
  oneway: '單行道',
  layer: '高度層',
  bridge: '橋梁',
  tunnel: '隧道',
  osm_id: 'OSM ID',
};

// 出圖控制用的內部屬性，對使用者沒有意義
// colour 是渲染用的色碼，面板以路線名稱呈現即可
const HIDDEN_FIELDS: ReadonlySet<string> = new Set(['minzoom', 'has_parts', 'colour']);

// 估計值必須標明，避免使用者把推估高度當成實測
const HEIGHT_SOURCES: Readonly<Record<string, string>> = {
  height: 'OSM 高度標註',
  levels: '依樓層數推估（每層 3.2 m）',
  default: '無資料，預設 2 層推估',
};

const VALUE_LABELS: Readonly<Record<string, string>> = {
  // roads
  highway: '道路',
  railway: '鐵路',
  motorway: '國道／高速公路',
  trunk: '快速道路',
  primary: '主要道路（省道）',
  secondary: '次要道路（縣道）',
  tertiary: '一般道路（鄉道）',
  residential: '住宅區道路',
  unclassified: '未分級道路',
  service: '服務道路',
  living_street: '生活街道',
  pedestrian: '行人徒步區',
  footway: '人行道',
  path: '小徑',
  cycleway: '自行車道',
  steps: '階梯',
  track: '產業道路',
  rail: '鐵路',
  subway: '捷運',
  light_rail: '輕軌',
  narrow_gauge: '窄軌鐵路',
  monorail: '單軌',
  hsr: '高鐵',
  // landuse / water
  landuse: '土地使用',
  leisure: '休閒',
  natural: '自然',
  forest: '森林',
  wood: '林地',
  farmland: '農地',
  park: '公園',
  water: '水體',
  river: '河流',
  stream: '溪流',
  canal: '運河／圳',
  reservoir: '水庫',
  // pois
  amenity: '設施',
  shop: '商店',
  tourism: '觀光',
  station: '車站',
  hospital: '醫院',
  school: '學校',
  university: '大學',
  restaurant: '餐廳',
  cafe: '咖啡廳',
  convenience: '便利商店',
};

const ADMIN_LEVELS: Readonly<Record<number, string>> = {
  2: '國家',
  4: '直轄市／縣市',
  7: '鄉鎮市區',
  8: '鄉鎮市區',
  9: '村里',
};

// osm2pgsql direction 型別：1 順向、-1 逆向、0 雙向
const DIRECTIONS: ReadonlyMap<number, string> = new Map([
  [1, '是（順向）'],
  [-1, '是（逆向）'],
  [0, '否'],
]);

/**
 * Formats one property value for display.
 *
 * Args:
 *   key: Property name from the MVT feature.
 *   value: Raw property value (MVT only carries string/number/boolean).
 *
 * Returns:
 *   Human-readable value, or null when the value should be hidden.
 */
export function formatValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? '是' : '否';

  if (typeof value === 'number') {
    if (key === 'admin_level') return ADMIN_LEVELS[value] ?? `第 ${value} 級`;
    if (key === 'oneway') return DIRECTIONS.get(value) ?? String(value);
    if (key === 'render_height' || key === 'render_min_height') return `${value.toFixed(1)} m`;
    return String(value);
  }

  if (typeof value === 'string') {
    if (key === 'height_source') return HEIGHT_SOURCES[value] ?? value;
    // building=yes 在 OSM 只表示「是建物」，沒有類型資訊
    if (key === 'building' && value === 'yes') return '一般建物';
    return VALUE_LABELS[value] ?? value;
  }

  return null;
}

/**
 * Builds the info panel content for a clicked feature.
 *
 * Args:
 *   sourceLayer: MVT source-layer of the feature (Martin source id).
 *   properties: Feature properties as delivered by MapLibre.
 *
 * Returns:
 *   Title, layer label and ordered rows; empty/null properties are omitted.
 */
export function describeFeature(
  sourceLayer: string,
  properties: Readonly<Record<string, unknown>>,
): FeatureDescription {
  // tile_buildings 為節省圖磚大小，預設 2 層的建物不輸出高度欄位；這裡補回，讓面板仍標示為推估值
  const props: Readonly<Record<string, unknown>> =
    sourceLayer === 'buildings' && properties.height_source === undefined
      ? { ...properties, render_height: properties.render_height ?? DEFAULT_BUILDING_HEIGHT_M, height_source: 'default' }
      : properties;

  const known = Object.keys(FIELD_LABELS);
  const keys = Object.keys(props).sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return a.localeCompare(b);
  });

  const rows: InfoRow[] = [];
  for (const key of keys) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const value = formatValue(key, props[key]);
    if (value !== null) rows.push({ key, label: FIELD_LABELS[key] ?? key, value });
  }

  const layerLabel = LAYER_LABELS[sourceLayer] ?? sourceLayer;
  const name = typeof properties.name === 'string' && properties.name ? properties.name : null;
  const classLabel = formatValue('class', properties.subclass ?? properties.type ?? properties.class);
  return { title: name ?? classLabel ?? layerLabel, layerLabel, rows };
}
