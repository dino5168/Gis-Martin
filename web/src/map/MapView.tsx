import { Map as MapLibreMap, NavigationControl, ScaleControl, type MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useEffect, useRef, useState } from 'react';
import { createDotImage, POI_ICONS } from './icons';
import { BUILDINGS_3D_MINZOOM, INTERACTIVE_LAYER_IDS, layerVisibility, type LayerGroupId } from './style';

/** Feature picked by a map click. */
export interface SelectedFeature {
  sourceLayer: string;
  properties: Record<string, unknown>;
}

/** Current camera, reported for the status bar (EPSG:4326 lon/lat). */
export interface ViewState {
  zoom: number;
  lng: number;
  lat: number;
}

interface MapViewProps {
  style: StyleSpecification;
  hiddenGroups: ReadonlySet<LayerGroupId>;
  /** LOD1 3D building mode: shows extrusions and tilts the camera. */
  threeD: boolean;
  onSelect: (feature: SelectedFeature | null) => void;
  onViewChange: (view: ViewState) => void;
  onError: (message: string) => void;
}

// 台灣本島中心；maxBounds 稍大於 Martin bounds（含東沙、金馬）；改動時同步 martin/05_land.sql 裁切範圍與 config.yaml land bounds
const INITIAL_CENTER: [number, number] = [120.97, 23.7];
const INITIAL_ZOOM = 7;
const MAX_BOUNDS: [[number, number], [number, number]] = [[114.5, 19.5], [124.5, 27.5]];
// 3D 模式的相機：60° 傾斜可看出高度，又不至於讓遠方圖磚數暴增
const PITCH_3D = 60;
const BEARING_3D = -20;

/**
 * MapLibre map bound to the Martin vector tiles.
 *
 * The map instance is created once; style changes are not expected at runtime,
 * and layer visibility is applied imperatively to avoid re-creating the WebGL context.
 *
 * Args:
 *   props: Style, hidden layer groups and event callbacks.
 *
 * Returns:
 *   The map container element.
 */
export function MapView({ style, hiddenGroups, threeD, onSelect, onViewChange, onError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 回呼放 ref：父元件每次 render 產生新函式時不必重建地圖
  const callbacks = useRef({ onSelect, onViewChange, onError });
  callbacks.current = { onSelect, onViewChange, onError };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      maxBounds: MAX_BOUNDS,
      maxZoom: 19,
      // 中文由瀏覽器字型繪製，不需下載 CJK glyph PBF
      localIdeographFontFamily: "'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif",
      attributionControl: { compact: true, customAttribution: '© OpenStreetMap contributors' },
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      // 開發時方便在 DevTools 檢查：window.__map.areTilesLoaded() 等；production build 會移除
      (window as unknown as { __map?: MapLibreMap }).__map = map;
    }

    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    const reportView = (): void => {
      const c = map.getCenter();
      callbacks.current.onViewChange({ zoom: map.getZoom(), lng: c.lng, lat: c.lat });
    };

    const handleClick = (e: MapMouseEvent): void => {
      const [hit] = map.queryRenderedFeatures(e.point, { layers: [...INTERACTIVE_LAYER_IDS] });
      callbacks.current.onSelect(
        hit ? { sourceLayer: hit.sourceLayer ?? hit.source, properties: { ...hit.properties } } : null,
      );
    };

    const handleHover = (e: MapMouseEvent): void => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [...INTERACTIVE_LAYER_IDS] });
      map.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : '';
    };

    // 樣式第一次用到圖示時才產生；以裝置像素比例繪製，高 DPI 螢幕才不會糊
    map.on('styleimagemissing', (e: { id: string }) => {
      const icon = POI_ICONS[e.id];
      if (!icon || map.hasImage(e.id)) return;
      const ratio = Math.max(1, Math.round(window.devicePixelRatio));
      map.addImage(e.id, createDotImage(icon.diameter, icon.fill, ratio), { pixelRatio: ratio });
    });

    map.on('load', () => {
      // 樣式載入前 queryRenderedFeatures 指定的圖層還不存在，會觸發 error 事件（滑鼠停在地圖上重整頁面即重現）
      map.on('click', handleClick);
      map.on('mousemove', handleHover);
      setLoaded(true);
      reportView();
    });
    map.on('moveend', reportView);
    map.on('error', (e) => {
      // tile 404/逾時等錯誤：只回報訊息，地圖可繼續使用
      callbacks.current.onError(e.error instanceof Error ? e.error.message : '地圖載入發生錯誤');
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    for (const [id, visibility] of Object.entries(layerVisibility(hiddenGroups, threeD))) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }, [hiddenGroups, threeD, loaded]);

  // 切換 3D 時調整相機：開啟時傾斜並確保至少在 3D 建物出現的 zoom；關閉時回正
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (threeD) {
      map.easeTo({
        pitch: PITCH_3D,
        bearing: BEARING_3D,
        zoom: Math.max(map.getZoom(), BUILDINGS_3D_MINZOOM + 0.5),
        duration: 1000,
      });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    }
  }, [threeD, loaded]);

  return <div ref={containerRef} className="map" aria-label="台灣向量地圖" role="region" />;
}
