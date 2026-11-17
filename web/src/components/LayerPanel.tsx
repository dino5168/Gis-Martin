import { LAYER_GROUPS, type LayerGroupId, type Palette } from '../map/style';

// 圖例色塊與地圖樣式共用同一份色盤，切換主題時一起變
const swatchKey: Readonly<Record<LayerGroupId, keyof Palette>> = {
  landuse: 'forest',
  water: 'water',
  boundaries: 'boundaryCounty',
  roads: 'motorway',
  railways: 'subway',
  buildings: 'building',
  pois: 'poi',
  labels: 'label',
  buses: 'busGo',
};

interface LayerPanelProps {
  hiddenGroups: ReadonlySet<LayerGroupId>;
  /** Palette of the active theme, used for the legend swatches. */
  palette: Palette;
  onToggle: (group: LayerGroupId) => void;
}

/**
 * Checkbox list that toggles style layer groups.
 *
 * Args:
 *   props: Currently hidden groups, active palette and the toggle handler.
 *
 * Returns:
 *   The layer toggle fieldset.
 */
export function LayerPanel({ hiddenGroups, palette, onToggle }: LayerPanelProps) {
  return (
    <fieldset className="panel layers">
      <legend>圖層</legend>
      {LAYER_GROUPS.map((g) => (
        <label key={g.id} className="layer-toggle">
          <input type="checkbox" checked={!hiddenGroups.has(g.id)} onChange={() => onToggle(g.id)} />
          <span className="swatch" style={{ background: palette[swatchKey[g.id]] }} aria-hidden="true" />
          {g.label}
        </label>
      ))}
    </fieldset>
  );
}
