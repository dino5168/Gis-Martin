import { BUILDINGS_3D_MINZOOM } from '../map/style';

interface ViewModeToggleProps {
  threeD: boolean;
  /** 3D extrusions belong to the buildings group; hidden group means nothing to show. */
  buildingsHidden: boolean;
  onChange: (threeD: boolean) => void;
}

/**
 * Segmented 2D / 3D switch for LOD1 building extrusions.
 *
 * Args:
 *   props: Current mode, whether the buildings group is hidden, and the change handler.
 *
 * Returns:
 *   The view mode panel.
 */
export function ViewModeToggle({ threeD, buildingsHidden, onChange }: ViewModeToggleProps) {
  return (
    <section className="panel view-mode" aria-label="檢視模式">
      <div className="segmented" role="radiogroup" aria-label="2D 或 3D 建物">
        <button type="button" role="radio" aria-checked={!threeD} className={threeD ? '' : 'active'} onClick={() => onChange(false)}>
          2D
        </button>
        <button type="button" role="radio" aria-checked={threeD} className={threeD ? 'active' : ''} onClick={() => onChange(true)}>
          3D 建物
        </button>
      </div>
      <p className="hint">
        {buildingsHidden
          ? '「建物」圖層已關閉，3D 建物不會顯示。'
          : `3D 建物於 z${BUILDINGS_3D_MINZOOM} 以上顯示；高度以 OSM 標註為主，無資料者以樓層或預設 2 層推估。右鍵拖曳可旋轉、傾斜。`}
      </p>
    </section>
  );
}
