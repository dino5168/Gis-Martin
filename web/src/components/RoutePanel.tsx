import { formatDistance, formatDuration, ROUTE_PROFILES } from '../routing/osrm';
import type { RoutePlanner } from '../routing/useRoutePlanner';

interface RoutePanelProps {
  planner: RoutePlanner;
}

/**
 * Builds the one-line guidance shown under the controls.
 *
 * Args:
 *   planner: Planner state.
 *
 * Returns:
 *   Hint text, or an empty string when nothing needs saying.
 */
function hintOf(planner: RoutePlanner): string {
  const { points, route, error, loading } = planner;
  if (error) return `⚠ ${error}`;
  if (!points.start) return '在地圖上點選起點';
  if (!points.end) return '在地圖上點選終點';
  if (loading) return '計算路線中…';
  return route ? '再點地圖可重新選起點' : '';
}

/**
 * Route planning panel: start/stop planning, travel mode, result summary.
 *
 * Args:
 *   props: Planner state and actions.
 *
 * Returns:
 *   The route planning panel.
 */
export function RoutePanel({ planner }: RoutePanelProps) {
  const { active, points, profile, route } = planner;
  return (
    <section className="panel route-panel" aria-label="路徑規劃">
      <div className="route-header">
        <h2>路徑規劃</h2>
        <button type="button" className="link-button" onClick={() => planner.setActive(!active)} aria-pressed={active}>
          {active ? '結束' : '開始'}
        </button>
      </div>
      {active && (
        <>
          <div className="segmented" role="group" aria-label="交通方式">
            {ROUTE_PROFILES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === profile ? 'active' : ''}
                aria-pressed={p.id === profile}
                onClick={() => planner.setProfile(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {route && (
            <p className="route-summary" aria-live="polite">
              <strong>{formatDuration(route.duration)}</strong>
              <span>{formatDistance(route.distance)}</span>
            </p>
          )}
          <p className="hint" aria-live="polite">
            {hintOf(planner)}
          </p>
          <div className="route-actions">
            <button type="button" onClick={planner.swap} disabled={!points.start && !points.end}>
              起訖對調
            </button>
            <button type="button" onClick={planner.clear} disabled={!points.start && !points.end}>
              清除
            </button>
          </div>
        </>
      )}
    </section>
  );
}
