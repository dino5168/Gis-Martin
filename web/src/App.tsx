import { useCallback, useMemo, useState } from 'react';
import { FeatureInfo } from './components/FeatureInfo';
import { LayerPanel } from './components/LayerPanel';
import { StyleSwitcher } from './components/StyleSwitcher';
import { ViewModeToggle } from './components/ViewModeToggle';
import type { AppConfig } from './config';
import { MapView, type SelectedFeature, type ViewState } from './map/MapView';
import { buildStyle, paletteOf, type LayerGroupId, type ThemeId } from './map/style';
import { browserStorage, loadTheme, saveTheme } from './map/themeStorage';

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
  const style = useMemo(
    () => buildStyle(config.martinUrl, { theme, hiddenGroups, threeD }),
    [config.martinUrl, theme, hiddenGroups, threeD],
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
        <LayerPanel hiddenGroups={hiddenGroups} palette={paletteOf(theme)} onToggle={toggleGroup} />
        <FeatureInfo feature={selected} onClose={() => setSelected(null)} />
      </aside>

      <main className="map-area">
        <MapView
          style={style}
          threeD={threeD}
          onSelect={setSelected}
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
