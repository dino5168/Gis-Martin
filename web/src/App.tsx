import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { busBounds, ROUTE_1 } from './bus/busData';
import { loadBusRouteId, saveBusRouteId } from './bus/busRoutes';
import { useBusPositions, useBusRoutes } from './bus/useBusPositions';
import { BusStatus } from './components/BusStatus';
import { FeatureInfo } from './components/FeatureInfo';
import { LayerPanel } from './components/LayerPanel';
import { RoutePanel } from './components/RoutePanel';
import { StyleSwitcher } from './components/StyleSwitcher';
import { ViewModeToggle } from './components/ViewModeToggle';
import type { AppConfig } from './config';
import { MapView, type MapFocus, type SelectedFeature, type ViewState } from './map/MapView';
import { buildStyle, paletteOf, type LayerGroupId, type ThemeId } from './map/style';
import { browserStorage, loadTheme, saveTheme } from './map/themeStorage';
import { routeBounds, routeToGeoJSON } from './routing/osrm';
import { useRoutePlanner } from './routing/useRoutePlanner';

interface AppProps {
  config: AppConfig;
}

/**
 * Root layout: side panel (layers + feature info) and the map.
 *
 * Args:
 *   props: Validated runtime configuration.
 *
 * Returns:
 *   The application shell.
 */
export function App({ config }: AppProps) {
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme(browserStorage()));
  const [hiddenGroups, setHiddenGroups] = useState<ReadonlySet<LayerGroupId>>(() => new Set());
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [threeD, setThreeD] = useState(false);
  // 圖層關閉時停止輪詢（每次都要下載全市約 50 KB）
  const busesOn = !hiddenGroups.has('buses');
  const busRoutes = useBusRoutes(busesOn);
  const [busRouteId, setBusRouteId] = useState(() => loadBusRouteId(browserStorage()));
  // 記住的路線若已停駛（不在清單中），退回 1 號
  const busRoute = useMemo(
    () => busRoutes.routes?.find((r) => r.id === busRouteId) ?? ROUTE_1,
    [busRoutes.routes, busRouteId],
  );
  const bus = useBusPositions(busRoute, busesOn);

  // 使用者選了路線 → 等該路線的車輛資料出現後縮放過去（路線常在目前畫面外）
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const focusPending = useRef(false);
  useEffect(() => {
    if (!focusPending.current) return;
    const bounds = busBounds(bus.buses);
    if (!bounds) return;
    focusPending.current = false;
    setFocus({ bounds });
  }, [bus.buses]);

  const selectBusRoute = useCallback((id: string) => {
    setBusRouteId(id);
    saveBusRouteId(browserStorage(), id);
    focusPending.current = true;
  }, []);

  const planner = useRoutePlanner(config.osrmUrl);
  const routeData = useMemo(
    () => routeToGeoJSON(planner.points.start, planner.points.end, planner.route),
    [planner.points, planner.route],
  );
  // 新路線算出來時縮放到整條路線（起訖可能一個在畫面外）
  useEffect(() => {
    if (planner.route) setFocus({ bounds: routeBounds(planner.route) });
  }, [planner.route]);

  const style = useMemo(
    () => buildStyle(config.martinUrl, { theme, hiddenGroups, threeD, buses: bus.buses, route: routeData }),
    [config.martinUrl, theme, hiddenGroups, threeD, bus.buses, routeData],
  );

  const changeTheme = useCallback((next: ThemeId) => {
    setTheme(next);
    saveTheme(browserStorage(), next);
  }, []);

  const toggleGroup = useCallback((group: LayerGroupId) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="brand">
          <h1>台灣向量地圖</h1>
          <p>OSM → PostGIS → Martin → MapLibre</p>
        </header>
        <StyleSwitcher theme={theme} onChange={changeTheme} />
        <ViewModeToggle threeD={threeD} buildingsHidden={hiddenGroups.has('buildings')} onChange={setThreeD} />
        {config.osrmUrl && <RoutePanel planner={planner} />}
        <LayerPanel hiddenGroups={hiddenGroups} palette={paletteOf(theme)} onToggle={toggleGroup} />
        {busesOn && (
          <BusStatus
            route={busRoute}
            routes={busRoutes}
            state={bus}
            palette={paletteOf(theme)}
            onSelectRoute={selectBusRoute}
          />
        )}
        <FeatureInfo feature={selected} onClose={() => setSelected(null)} />
      </aside>

      <main className="map-area">
        <MapView
          style={style}
          threeD={threeD}
          focus={focus}
          onSelect={setSelected}
          onPick={planner.picking ? planner.pick : null}
          onViewChange={setView}
          onError={setMapError}
        />
        {mapError && (
          <div className="toast" role="alert">
            <span>圖磚載入失敗：{mapError}</span>
            <button type="button" onClick={() => setMapError(null)} aria-label="關閉錯誤訊息">
              ×
            </button>
          </div>
        )}
        {view && (
          <div className="statusbar" aria-live="polite">
            z{view.zoom.toFixed(1)} · {view.lng.toFixed(5)}, {view.lat.toFixed(5)}（EPSG:4326）
          </div>
        )}
      </main>
    </div>
  );
}
