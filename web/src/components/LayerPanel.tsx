import { LAYER_GROUPS, PALETTE, type LayerGroupId } from '../map/style';

// 圖例色塊與地圖樣式共用同一份 PALETTE
const SWATCH: Readonly<Record<LayerGroupId, string>> = {
  landuse: PALETTE.forest,
  water: PALETTE.water,
  boundaries: PALETTE.boundaryCounty,
  roads: PALETTE.motorway,
  railways: PALETTE.subway,
  buildings: PALETTE.building,
  pois: PALETTE.poi,
  labels: PALETTE.label,
};

interface LayerPanelProps {
  hiddenGroups: ReadonlySet<LayerGroupId>;
  onToggle: (group: LayerGroupId) => void;
}

/**
 * Checkbox list that toggles style layer groups.
 *
 * Args:
 *   props: Currently hidden groups and the toggle handler.
 *
 * Returns:
 *   The layer toggle fieldset.
 */
export function LayerPanel({ hiddenGroups, onToggle }: LayerPanelProps) {
  return (
    <fieldset className="panel layers">
      <legend>圖層</legend>
      {LAYER_GROUPS.map((g) => (
        <label key={g.id} className="layer-toggle">
          <input type="checkbox" checked={!hiddenGroups.has(g.id)} onChange={() => onToggle(g.id)} />
          <span className="swatch" style={{ background: SWATCH[g.id] }} aria-hidden="true" />
          {g.label}
        </label>
      ))}
    </fieldset>
  );
}
