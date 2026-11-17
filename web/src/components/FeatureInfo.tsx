import { describeFeature } from '../map/featureInfo';
import type { SelectedFeature } from '../map/MapView';

interface FeatureInfoProps {
  feature: SelectedFeature | null;
  onClose: () => void;
}

/**
 * Shows the attributes of the clicked feature.
 *
 * Args:
 *   props: The selected feature (null shows a hint) and a close handler.
 *
 * Returns:
 *   The info panel section.
 */
export function FeatureInfo({ feature, onClose }: FeatureInfoProps) {
  if (!feature) {
    return (
      <section className="panel info">
        <h2>要素資訊</h2>
        <p className="hint">點選地圖上的道路、建物、興趣點等查看屬性。</p>
      </section>
    );
  }

  const d = describeFeature(feature.sourceLayer, feature.properties);
  return (
    <section className="panel info">
      <header className="info-header">
        <div>
          <span className="badge">{d.layerLabel}</span>
          <h2>{d.title}</h2>
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="關閉要素資訊">
          ×
        </button>
      </header>
      {d.rows.length > 0 ? (
        <dl>
          {d.rows.map((r) => (
            <div key={r.key} className="row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="hint">此要素沒有屬性資料。</p>
      )}
    </section>
  );
}
