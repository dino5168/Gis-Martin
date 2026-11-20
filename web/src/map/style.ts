import { EMPTY_BUSES, type BusFeatureCollection, type BusFeatureProperties } from '../bus/busData';
import { EMPTY_ROUTE, type RouteFeatureCollection } from '../routing/osrm';
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
  { id: 'buses', label: '公車動態' },
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
  poiTourism: '#16867f',
  poiFood: '#e07b28',
  poiShop: '#8c5bb8',
  poiHealth: '#d64545',
  poiCivic: '#7a6a58',
  poiLeisure: '#4c9a3f',
  poiHistoric: '#a5823b',
  poiOffice: '#6b7a8f',
  busGo: '#e4572e',
  busBack: '#7b2cbf',
  label: '#3a3a3a',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
  route: '#1a73e8',
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
  poiTourism: '#3a9d96',
  poiFood: '#e88a3c',
  poiShop: '#9a6cc4',
  poiHealth: '#e05a5a',
  poiCivic: '#8a7a68',
  poiLeisure: '#5aa84c',
  poiHistoric: '#b08e47',
  poiOffice: '#7a889c',
  busGo: '#e4572e',
  busBack: '#7b2cbf',
  label: '#333333',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
  route: '#1a73e8',
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
  poiTourism: '#4fb8b0',
  poiFood: '#f29a4a',
  poiShop: '#b48ce0',
  poiHealth: '#f07070',
  poiCivic: '#b8a690',
  poiLeisure: '#78c46a',
  poiHistoric: '#d4b060',
  poiOffice: '#9aabc2',
  busGo: '#ff8a5c',
  busBack: '#c39bf0',
  label: '#e6e6e6',
  labelHalo: '#1d1f22',
  transitCasing: '#1d1f22',
  route: '#4da3ff',
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
  poiTourism: '#7aa9a4',
  poiFood: '#d9a066',
  poiShop: '#a990c4',
  poiHealth: '#d98282',
  poiCivic: '#a39686',
  poiLeisure: '#8fb886',
  poiHistoric: '#c2aa7a',
  poiOffice: '#98a3b2',
  busGo: '#e88a6e',
  busBack: '#a07cc5',
  label: '#5a5a5a',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
  route: '#2f6fd6',
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
  poiTourism: '#000000',
  poiFood: '#000000',
  poiShop: '#000000',
  poiHealth: '#000000',
  poiCivic: '#000000',
  poiLeisure: '#000000',
  poiHistoric: '#000000',
  poiOffice: '#000000',
  busGo: '#000000',
  busBack: '#555555',
  label: '#000000',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
  route: '#000000',
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
  poiTourism: '#777777',
  poiFood: '#777777',
  poiShop: '#777777',
  poiHealth: '#777777',
  poiCivic: '#777777',
  poiLeisure: '#777777',
  poiHistoric: '#777777',
  poiOffice: '#777777',
  busGo: '#555555',
  busBack: '#999999',
  label: '#555555',
  labelHalo: '#ffffff',
  transitCasing: '#ffffff',
  route: '#333333',
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

/** Semantic POI groups; each group has its own disc colour per theme (a class like `amenity` spans several groups). */
export type PoiGroup = 'food' | 'shop' | 'health' | 'transport' | 'civic' | 'leisure' | 'tourism' | 'historic' | 'office';

/** Palette colour of each POI group's icon disc. */
export const POI_GROUP_COLOR = {
  food: 'poiFood',
  shop: 'poiShop',
  health: 'poiHealth',
  transport: 'poiTransit',
  civic: 'poiCivic',
  leisure: 'poiLeisure',
  tourism: 'poiTourism',
  historic: 'poiHistoric',
  office: 'poiOffice',
} as const satisfies Record<PoiGroup, keyof Palette>;

/** Display names of the POI groups (legend / docs). */
export const POI_GROUP_LABELS: Readonly<Record<PoiGroup, string>> = {
  food: '餐飲',
  shop: '購物',
  health: '醫療',
  transport: '交通',
  civic: '公共／教育',
  leisure: '休閒娛樂',
  tourism: '觀光',
  historic: '古蹟',
  office: '辦公／金融',
};

/**
 * Maki (CC0) glyph and group per `class/subclass`.
 *
 * Only subclasses that are actually drawn (non-null `minzoom` in 01_post_import.sql) are listed;
 * several subclasses intentionally share a glyph. Subclasses missing here fall back to
 * POI_CLASS_MAKI, then to the plain dots.
 */
export const POI_MAKI = {
  // ---- 交通 ----
  'railway/station': ['rail', 'transport'],
  'railway/halt': ['rail', 'transport'],
  'railway/tram_stop': ['rail-light', 'transport'],
  'public_transport/station': ['rail-metro', 'transport'],
  'public_transport/platform': ['bus', 'transport'],
  'amenity/bus_station': ['bus', 'transport'],
  'amenity/ferry_terminal': ['ferry', 'transport'],
  'amenity/fuel': ['fuel', 'transport'],
  'amenity/charging_station': ['charging-station', 'transport'],
  'amenity/parking': ['parking', 'transport'],
  'amenity/bicycle_rental': ['bicycle-share', 'transport'],
  'amenity/bicycle_repair_station': ['bicycle', 'transport'],
  'amenity/car_rental': ['car-rental', 'transport'],
  'amenity/car_wash': ['car', 'transport'],
  'amenity/motorcycle_rental': ['scooter', 'transport'],
  'amenity/taxi': ['taxi', 'transport'],

  // ---- 餐飲 ----
  'amenity/restaurant': ['restaurant', 'food'],
  'amenity/food_court': ['restaurant', 'food'],
  'amenity/cafe': ['cafe', 'food'],
  'amenity/fast_food': ['fast-food', 'food'],
  'amenity/bar': ['bar', 'food'],
  'amenity/pub': ['beer', 'food'],
  'amenity/ice_cream': ['ice-cream', 'food'],

  // ---- 醫療 ----
  'amenity/hospital': ['hospital', 'health'],
  'amenity/clinic': ['doctor', 'health'],
  'amenity/doctors': ['doctor', 'health'],
  'amenity/dentist': ['dentist', 'health'],
  'amenity/pharmacy': ['pharmacy', 'health'],
  'amenity/veterinary': ['veterinary', 'health'],
  'amenity/nursing_home': ['residential-community', 'health'],

  // ---- 公共／教育 ----
  'amenity/school': ['school', 'civic'],
  'amenity/kindergarten': ['school', 'civic'],
  'amenity/childcare': ['school', 'civic'],
  'amenity/prep_school': ['school', 'civic'],
  'amenity/language_school': ['school', 'civic'],
  'amenity/music_school': ['music', 'civic'],
  'amenity/college': ['college', 'civic'],
  'amenity/university': ['college', 'civic'],
  'amenity/library': ['library', 'civic'],
  'amenity/public_bookcase': ['library', 'civic'],
  'amenity/townhall': ['town-hall', 'civic'],
  // Maki 沒有法院；以公所（公家機關）圖示代表
  'amenity/courthouse': ['town-hall', 'civic'],
  'amenity/community_centre': ['residential-community', 'civic'],
  'amenity/social_facility': ['residential-community', 'civic'],
  'amenity/police': ['police', 'civic'],
  'amenity/fire_station': ['fire-station', 'civic'],
  'amenity/post_office': ['post', 'civic'],
  'amenity/prison': ['prison', 'civic'],
  'amenity/place_of_worship': ['place-of-worship', 'civic'],
  'amenity/grave_yard': ['cemetery', 'civic'],
  'amenity/toilets': ['toilet', 'civic'],

  // ---- 休閒娛樂 ----
  'amenity/cinema': ['cinema', 'leisure'],
  'amenity/theatre': ['theatre', 'leisure'],
  'amenity/arts_centre': ['theatre', 'leisure'],
  'amenity/events_venue': ['theatre', 'leisure'],
  'amenity/nightclub': ['nightclub', 'leisure'],
  'amenity/karaoke_box': ['karaoke', 'leisure'],
  'amenity/internet_cafe': ['gaming', 'leisure'],
  'amenity/bbq': ['bbq', 'leisure'],
  'amenity/fountain': ['water', 'leisure'],
  'amenity/marketplace': ['grocery', 'food'],
  'leisure/playground': ['playground', 'leisure'],
  'leisure/picnic_table': ['picnic-site', 'leisure'],
  'leisure/fitness_station': ['fitness-centre', 'leisure'],
  'leisure/fitness_centre': ['fitness-centre', 'leisure'],
  'leisure/pitch': ['pitch', 'leisure'],
  'leisure/sports_centre': ['stadium', 'leisure'],
  'leisure/stadium': ['stadium', 'leisure'],
  'leisure/amusement_arcade': ['gaming', 'leisure'],
  'leisure/park': ['park', 'leisure'],
  'leisure/garden': ['garden', 'leisure'],
  'leisure/swimming_pool': ['swimming', 'leisure'],
  'leisure/slipway': ['slipway', 'leisure'],
  'leisure/marina': ['harbor', 'leisure'],
  'leisure/firepit': ['bbq', 'leisure'],

  // ---- 觀光 ----
  'tourism/information': ['information', 'tourism'],
  'tourism/attraction': ['attraction', 'tourism'],
  'tourism/viewpoint': ['viewpoint', 'tourism'],
  'tourism/artwork': ['monument', 'tourism'],
  'tourism/hotel': ['lodging', 'tourism'],
  'tourism/motel': ['lodging', 'tourism'],
  'tourism/hostel': ['lodging', 'tourism'],
  'tourism/guest_house': ['home', 'tourism'],
  'tourism/apartment': ['home', 'tourism'],
  'tourism/camp_site': ['campsite', 'tourism'],
  'tourism/camp_pitch': ['campsite', 'tourism'],
  'tourism/museum': ['museum', 'tourism'],
  'tourism/gallery': ['art-gallery', 'tourism'],
  'tourism/picnic_site': ['picnic-site', 'tourism'],
  // Maki 沒有登山檢查點；三角形近似山徑標記
  'tourism/checkpoint': ['triangle', 'tourism'],
  'tourism/alpine_hut': ['shelter', 'tourism'],
  'tourism/zoo': ['zoo', 'tourism'],
  'tourism/aquarium': ['aquarium', 'tourism'],
  'tourism/theme_park': ['amusement-park', 'tourism'],

  // ---- 古蹟 ----
  'historic/memorial': ['monument', 'historic'],
  'historic/monument': ['monument', 'historic'],
  'historic/wayside_shrine': ['place-of-worship', 'historic'],
  'historic/tomb': ['cemetery', 'historic'],
  'historic/aircraft': ['airfield', 'historic'],
  'historic/castle': ['castle', 'historic'],
  'historic/city_gate': ['castle', 'historic'],

  // ---- 辦公／金融 ----
  'amenity/bank': ['bank', 'office'],
  'amenity/coworking_space': ['commercial', 'office'],
  'office/government': ['town-hall', 'office'],
  'office/estate_agent': ['home', 'office'],
  'office/telecommunication': ['mobile-phone', 'office'],
  'office/diplomatic': ['embassy', 'office'],
  'office/religion': ['place-of-worship', 'office'],
  'office/educational_institution': ['school', 'office'],
  'office/university': ['college', 'office'],
  'office/travel_agent': ['suitcase', 'office'],
  'office/financial': ['bank', 'office'],
  'office/insurance': ['bank', 'office'],

  // ---- 購物（未列出的 shop 子類別用 POI_CLASS_MAKI 的購物袋）----
  'shop/convenience': ['convenience', 'shop'],
  'shop/supermarket': ['grocery', 'shop'],
  'shop/greengrocer': ['grocery', 'shop'],
  'shop/grocery': ['grocery', 'shop'],
  'shop/food': ['grocery', 'shop'],
  'shop/health_food': ['grocery', 'shop'],
  'shop/deli': ['restaurant', 'shop'],
  'shop/butcher': ['restaurant', 'shop'],
  'shop/seafood': ['restaurant-seafood', 'shop'],
  'shop/pasta': ['restaurant-noodle', 'shop'],
  'shop/bakery': ['bakery', 'shop'],
  'shop/pastry': ['bakery', 'shop'],
  'shop/confectionery': ['confectionery', 'shop'],
  'shop/beverages': ['teahouse', 'shop'],
  'shop/tea': ['teahouse', 'shop'],
  'shop/coffee': ['cafe', 'shop'],
  'shop/alcohol': ['alcohol-shop', 'shop'],
  'shop/wine': ['alcohol-shop', 'shop'],
  'shop/clothes': ['clothing-store', 'shop'],
  'shop/fabric': ['clothing-store', 'shop'],
  'shop/tailor': ['clothing-store', 'shop'],
  'shop/fashion_accessories': ['clothing-store', 'shop'],
  'shop/shoes': ['shoe', 'shop'],
  'shop/jewelry': ['jewelry-store', 'shop'],
  'shop/watches': ['watch', 'shop'],
  'shop/optician': ['optician', 'shop'],
  'shop/hairdresser': ['hairdresser', 'shop'],
  'shop/beauty': ['hairdresser', 'shop'],
  'shop/chemist': ['pharmacy', 'shop'],
  'shop/herbalist': ['pharmacy', 'shop'],
  'shop/medical_supply': ['pharmacy', 'shop'],
  'shop/laundry': ['laundry', 'shop'],
  'shop/dry_cleaning': ['laundry', 'shop'],
  'shop/books': ['library', 'shop'],
  'shop/mobile_phone': ['mobile-phone', 'shop'],
  'shop/telecommunication': ['mobile-phone', 'shop'],
  'shop/hardware': ['hardware', 'shop'],
  'shop/doityourself': ['hardware', 'shop'],
  'shop/trade': ['hardware', 'shop'],
  'shop/locksmith': ['hardware', 'shop'],
  'shop/electrical': ['hardware', 'shop'],
  'shop/doors': ['hardware', 'shop'],
  'shop/repair': ['hardware', 'shop'],
  'shop/paint': ['paint', 'shop'],
  'shop/furniture': ['furniture', 'shop'],
  'shop/bed': ['furniture', 'shop'],
  'shop/kitchen': ['furniture', 'shop'],
  'shop/interior_decoration': ['furniture', 'shop'],
  'shop/curtain': ['furniture', 'shop'],
  'shop/bathroom_furnishing': ['furniture', 'shop'],
  'shop/lighting': ['furniture', 'shop'],
  'shop/gift': ['gift', 'shop'],
  'shop/florist': ['florist', 'shop'],
  'shop/garden_centre': ['garden-centre', 'shop'],
  'shop/farm': ['farm', 'shop'],
  'shop/agrarian': ['farm', 'shop'],
  'shop/car': ['car', 'shop'],
  'shop/car_repair': ['car-repair', 'shop'],
  'shop/car_parts': ['car-repair', 'shop'],
  'shop/tyres': ['car-repair', 'shop'],
  'shop/motorcycle': ['scooter', 'shop'],
  'shop/motorcycle_repair': ['scooter', 'shop'],
  'shop/bicycle': ['bicycle', 'shop'],
  'shop/outdoor': ['campsite', 'shop'],
  'shop/pet': ['dog-park', 'shop'],
  'shop/pet_grooming': ['dog-park', 'shop'],
  'shop/video_games': ['gaming', 'shop'],
  'shop/games': ['gaming', 'shop'],
  'shop/musical_instrument': ['music', 'shop'],
  'shop/music': ['music', 'shop'],
  'shop/hifi': ['music', 'shop'],
  'shop/art': ['art-gallery', 'shop'],
  'shop/craft': ['art-gallery', 'shop'],
  'shop/religion': ['place-of-worship', 'shop'],
  'shop/funeral_directors': ['cemetery', 'shop'],
  'shop/travel_agency': ['suitcase', 'shop'],
  'shop/gas': ['fuel', 'shop'],
  'shop/water': ['drinking-water', 'shop'],
  'shop/wholesale': ['warehouse', 'shop'],
} as const satisfies Record<string, readonly [string, PoiGroup]>;

/** Class-level fallback glyph for subclasses not in POI_MAKI (amenity/tourism/railway keep the plain dots). */
export const POI_CLASS_MAKI = {
  shop: ['shop', 'shop'],
  office: ['commercial', 'office'],
  historic: ['historic', 'historic'],
  leisure: ['park', 'leisure'],
} as const satisfies Record<string, readonly [string, PoiGroup]>;

type MakiEntry = (typeof POI_MAKI)[keyof typeof POI_MAKI] | (typeof POI_CLASS_MAKI)[keyof typeof POI_CLASS_MAKI];
export type MakiName = MakiEntry[0];

/** Diameter (CSS px) of the coloured disc behind a Maki glyph; larger than the plain dots so the glyph is legible. */
export const MAKI_ICON_DIAMETER = 18;

/**
 * Image id of a Maki POI icon (theme in the id for the same reason as poiIconId; group because one glyph can
 * appear in several groups with different colours).
 *
 * Args:
 *   maki: Maki glyph name.
 *   group: POI group (selects the disc colour).
 *   theme: Theme id.
 *
 * Returns:
 *   Image id such as `maki-lodging-tourism-dark`.
 */
export function makiIconId(maki: MakiName, group: PoiGroup, theme: ThemeId): string {
  return `maki-${maki}-${group}-${theme}`;
}

const MAKI_ENTRIES: readonly (readonly [MakiName, PoiGroup])[] = [
  ...Object.values(POI_MAKI),
  ...Object.values(POI_CLASS_MAKI),
];

/** How a generated Maki image is drawn: white glyph on a coloured disc, or the glyph itself in colour. */
export interface MakiIconSpec {
  maki: MakiName;
  fill: string;
  diameter: number;
  shape: 'disc' | 'glyph';
}

/** GeoJSON source holding live bus positions (updated through the style; see buildStyle). */
export const BUS_SOURCE_ID = 'buses';
/** GeoJSON source holding the planned route and its endpoints (see routing/osrm.ts). */
export const ROUTE_SOURCE_ID = 'route';
/** Route layers are driven by the planner, not by a toggle group. */
export const ROUTE_LAYER_IDS = ['route-casing', 'route-line', 'route-endpoints', 'route-endpoint-labels'] as const;
/** Bus discs are larger than POIs: moving vehicles are the focus when the layer is on. */
const BUS_ICON_DIAMETER = 22;
type BusDir = BusFeatureProperties['dir'];
const BUS_DIR_COLOR: Readonly<Record<BusDir, keyof Palette>> = { go: 'busGo', back: 'busBack', unknown: 'poiTransit' };

/**
 * Image ids of the bus marker and its heading arrow.
 *
 * Args:
 *   dir: Travel direction (selects the colour).
 *   theme: Theme id.
 *
 * Returns:
 *   Disc and arrow image ids.
 */
export function busIconIds(dir: BusDir, theme: ThemeId): { disc: string; arrow: string } {
  return { disc: `bus-${dir}-${theme}`, arrow: `bus-arrow-${dir}-${theme}` };
}

/** Every generated Maki image id the styles can request (POI discs, bus discs and heading arrows). */
export const MAKI_ICONS: Readonly<Record<string, MakiIconSpec>> = Object.fromEntries(
  THEMES.flatMap((t) => [
    ...MAKI_ENTRIES.map(([maki, group]): [string, MakiIconSpec] => [
      makiIconId(maki, group, t.id),
      { maki, fill: t.palette[POI_GROUP_COLOR[group]], diameter: MAKI_ICON_DIAMETER, shape: 'disc' },
    ]),
    ...(Object.keys(BUS_DIR_COLOR) as BusDir[]).flatMap((dir): [string, MakiIconSpec][] => {
      const ids = busIconIds(dir, t.id);
      const fill = t.palette[BUS_DIR_COLOR[dir]];
      return [
        [ids.disc, { maki: 'bus', fill, diameter: BUS_ICON_DIAMETER, shape: 'disc' }],
        [ids.arrow, { maki: 'triangle', fill, diameter: BUS_ICON_DIAMETER, shape: 'glyph' }],
      ];
    }),
  ]),
);

/** `class/subclass` lookup key of a POI feature. */
const poiKey: ExpressionSpecification = ['concat', ['get', 'class'], '/', ['coalesce', ['get', 'subclass'], '']];

/**
 * Builds a `match` expression from `input` labels to image ids, merging labels that share an image.
 *
 * Args:
 *   input: Expression evaluated per feature.
 *   pairs: Label and image id pairs.
 *   fallback: Expression used when no label matches.
 *
 * Returns:
 *   A `match` expression, or `fallback` when `pairs` is empty.
 */
function matchImages(
  input: ExpressionSpecification,
  pairs: readonly (readonly [string, string])[],
  fallback: ExpressionSpecification,
): ExpressionSpecification {
  const byImage = new Map<string, string[]>();
  for (const [label, image] of pairs) byImage.set(image, [...(byImage.get(image) ?? []), label]);
  // match 至少要一組 label/output，第一組單獨取出以符合 style-spec 的 tuple 型別
  const [first, ...rest] = [...byImage];
  if (!first) return fallback;
  return [
    'match', input,
    first[1], first[0],
    ...rest.flatMap(([image, labels]) => [labels, image]),
    fallback,
  ];
}

/**
 * Builds the POI `icon-image` expression: subclass glyph → class glyph → plain dot.
 *
 * Args:
 *   theme: Theme id.
 *   dot: Plain-dot expression for POIs without a Maki glyph.
 *
 * Returns:
 *   The `icon-image` expression.
 */
function poiIconImage(theme: ThemeId, dot: ExpressionSpecification): ExpressionSpecification {
  const byClass = matchImages(
    ['get', 'class'],
    Object.entries(POI_CLASS_MAKI).map(([cls, [maki, group]]) => [cls, makiIconId(maki, group, theme)] as const),
    dot,
  );
  return matchImages(
    poiKey,
    Object.entries(POI_MAKI).map(([key, [maki, group]]) => [key, makiIconId(maki, group, theme)] as const),
    byClass,
  );
}

/** True for features drawn with a Maki icon (used to push the label below the larger disc). */
const hasMakiIcon: ExpressionSpecification = [
  'any',
  ['in', poiKey, ['literal', Object.keys(POI_MAKI)]],
  ['in', ['get', 'class'], ['literal', Object.keys(POI_CLASS_MAKI)]],
];

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

  // ---- 路徑規劃（OSRM，GeoJSON）：壓在道路與捷運之上、POI 與文字之下，不遮路名 ----
  {
    group: null,
    layer: {
      id: 'route-casing', type: 'line', source: ROUTE_SOURCE_ID,
      filter: ['==', ['get', 'role'], 'line'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.labelHalo,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 8, 16, 12, 19, 18],
      },
    },
  },
  {
    group: null,
    layer: {
      id: 'route-line', type: 'line', source: ROUTE_SOURCE_ID,
      filter: ['==', ['get', 'role'], 'line'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.route,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 5, 16, 8, 19, 12],
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
      // 圖示由 MapView 在 styleimagemissing 時以 icons.ts 產生（圓點；觀光類為 Maki 圖示）。
      id: 'pois-symbol', type: 'symbol', source: SOURCE_ID, 'source-layer': 'pois',
      // minzoom 屬性 = 該 POI 最早出現的 zoom（tile_pois 輸出；z14 圖磚含 15/16 級供 overzoom）
      filter: ['<=', ['get', 'minzoom'], ['zoom']],
      layout: {
        // 子類別 Maki 圖示 → 大類通用圖示 → 圓點
        'icon-image': poiIconImage(theme, [
          'case',
          ['in', ['get', 'class'], ['literal', ['railway', 'public_transport']]], poiIconId('transit', theme),
          ['<=', ['get', 'minzoom'], 14], poiIconId('major', theme),
          poiIconId('default', theme),
        ]),
        // 碰撞時保留 sort key 小的：minzoom 小 = 越重要
        'symbol-sort-key': ['get', 'minzoom'],
        'icon-padding': 2,
        'text-field': ['step', ['zoom'], '', 15, ['coalesce', ['get', 'name'], '']],
        'text-font': FONT,
        'text-size': 11,
        // Maki 圓底較大，名稱要再往下移才不壓到圖示
        'text-offset': ['case', hasMakiIcon, ['literal', [0, 1.1]], ['literal', [0, 0.8]]],
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

  // ---- 路徑規劃起訖點：在文字標註之上，避免被路名蓋住 ----
  {
    group: null,
    layer: {
      id: 'route-endpoints', type: 'circle', source: ROUTE_SOURCE_ID,
      filter: ['!=', ['get', 'role'], 'line'],
      paint: {
        'circle-radius': 11,
        'circle-color': ['match', ['get', 'role'], 'start', p.labelHalo, p.route],
        'circle-stroke-color': ['match', ['get', 'role'], 'start', p.route, p.labelHalo],
        'circle-stroke-width': 3,
      },
    },
  },
  {
    group: null,
    layer: {
      id: 'route-endpoint-labels', type: 'symbol', source: ROUTE_SOURCE_ID,
      filter: ['!=', ['get', 'role'], 'line'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': FONT,
        'text-size': 12,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': ['match', ['get', 'role'], 'start', p.route, p.labelHalo] },
    },
  },

  // ---- 公車動態（Data.Taipei 即時位置，GeoJSON；畫在最上層）----
  {
    group: 'buses',
    layer: {
      // 方向箭頭：三角形隨方位角旋轉並繞著圓點外緣，指向行進方向
      id: 'buses-heading', type: 'symbol', source: BUS_SOURCE_ID,
      filter: ['!=', ['get', 'dir'], 'unknown'],
      layout: {
        'icon-image': ['match', ['get', 'dir'], 'go', busIconIds('go', theme).arrow, busIconIds('back', theme).arrow],
        'icon-rotate': ['get', 'azimuth'],
        'icon-rotation-alignment': 'map',
        // offset 會隨 icon-rotate 一起旋轉：向上 14 px 即沿行進方向推到圓外
        'icon-offset': [0, -14],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  },
  {
    group: 'buses',
    layer: {
      id: 'buses-symbol', type: 'symbol', source: BUS_SOURCE_ID,
      layout: {
        'icon-image': [
          'match', ['get', 'dir'],
          'go', busIconIds('go', theme).disc,
          'back', busIconIds('back', theme).disc,
          busIconIds('unknown', theme).disc,
        ],
        // 車輛不參與 POI 碰撞隱藏，永遠顯示
        'icon-allow-overlap': true,
        'text-field': ['step', ['zoom'], '', 13, ['get', 'plate']],
        'text-font': FONT,
        'text-size': 11,
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: textPaint,
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
  /** Live bus positions; part of the style so setStyle diff updates them (setGeoJSONSourceData). */
  buses?: BusFeatureCollection;
  /** Planned route and endpoints; in the style for the same reason as `buses`. */
  route?: RouteFeatureCollection;
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
 *   options: Theme, hidden layer groups, 3D mode and GeoJSON overlays; defaults to the default theme,
 *     all groups on, 2D, no buses and no route.
 *
 * Returns:
 *   A MapLibre style specification (v8).
 */
export function buildStyle(martinUrl: string, options: StyleOptions = {}): StyleSpecification {
  const {
    theme = DEFAULT_THEME,
    hiddenGroups = new Set<LayerGroupId>(),
    threeD = false,
    buses = EMPTY_BUSES,
    route = EMPTY_ROUTE,
  } = options;
  const visibility = layerVisibility(hiddenGroups, threeD);
  return {
    version: 8,
    name: `Taiwan OSM (${theme})`,
    glyphs: GLYPHS_URL,
    sources: {
      [SOURCE_ID]: { type: 'vector', url: compositeTileJsonUrl(martinUrl) },
      // 公車資料若放在 style 外以 setData 更新，下一次 setStyle diff 會把它比對回空資料；放進 style 才一致
      [BUS_SOURCE_ID]: { type: 'geojson', data: buses },
      [ROUTE_SOURCE_ID]: { type: 'geojson', data: route },
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
 *   Map of layer id to `'visible' | 'none'`; ungrouped layers (sea/land, route) are not included.
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
