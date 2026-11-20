import { useState, type DragEvent, type KeyboardEvent } from 'react';
import { formatDistance, formatDuration, ROUTE_PROFILES } from '../routing/osrm';
import type { RoutePlanner } from '../routing/useRoutePlanner';
import { MAX_WAYPOINTS, waypointLetter, type Waypoint } from '../routing/waypoints';

interface RoutePanelProps {
  planner: RoutePlanner;
}

/**
 * Text shown in a stop's field.
 *
 * Args:
 *   w: The stop.
 *   index: Its row.
 *   count: Number of rows.
 *   selected: Whether the next map click fills this row.
 *
 * Returns:
 *   Road name, coordinates, lookup state or a prompt.
 */
function fieldText(w: Waypoint, index: number, count: number, selected: boolean): string {
  if (w.point) {
    if (w.name === undefined) return '查詢道路名稱…';
    // 無名道路（巷弄、產業道路）退回顯示座標（EPSG:4326，緯度在前較符合一般習慣）
    return w.name || `${w.point[1].toFixed(5)}, ${w.point[0].toFixed(5)}`;
  }
  if (selected) return '請在地圖上點選';
  return index === 0 ? '選擇起點' : index === count - 1 ? '選擇目的地' : '選擇中途點';
}

/**
 * One-line status under the stop list.
 *
 * Args:
 *   planner: Planner state.
 *
 * Returns:
 *   Hint text, or an empty string when nothing needs saying.
 */
function hintOf(planner: RoutePlanner): string {
  const { route, error, loading, activeIndex, waypoints } = planner;
  if (error) return `⚠ ${error}`;
  if (loading) return '計算路線中…';
  if (activeIndex !== null) return `在地圖上點選 ${waypointLetter(activeIndex)} 點`;
  if (route) return '點選欄位可在地圖上重新選點；拖曳左側圓點可重新排序';
  return waypoints.filter((w) => w.point).length < 2 ? '至少需要兩個地點' : '';
}

/**
 * Stop marker drawn left of each field: lettered circle, or a pin for the destination.
 *
 * Args:
 *   props: Row letter and whether it is the last row.
 *
 * Returns:
 *   Inline SVG icon.
 */
function StopIcon({ letter, isLast }: { letter: string; isLast: boolean }) {
  return isLast ? (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="stop-pin">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" />
      <text x="12" y="12.5" textAnchor="middle">{letter}</text>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="stop-circle">
      <circle cx="12" cy="12" r="9" />
      <text x="12" y="16" textAnchor="middle">{letter}</text>
    </svg>
  );
}

/**
 * Route planning panel modeled on Google Maps directions: an ordered stop list with
 * drag-to-reorder, "add destination", travel mode and the route summary.
 *
 * Args:
 *   props: Planner state and actions.
 *
 * Returns:
 *   The route planning panel.
 */
export function RoutePanel({ planner }: RoutePanelProps) {
  const { active, waypoints, activeIndex, profile, route } = planner;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const count = waypoints.length;
  const hasAnyPoint = waypoints.some((w) => w.point);

  const endDrag = (): void => {
    setDragFrom(null);
    setDragOver(null);
  };
  const onDrop = (e: DragEvent, to: number): void => {
    e.preventDefault();
    if (dragFrom !== null) planner.moveStop(dragFrom, to);
    endDrag();
  };
  // 拖曳無法用鍵盤操作：Alt+↑／↓ 提供同等的排序方式
  const onHandleKey = (e: KeyboardEvent, index: number): void => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    planner.moveStop(index, e.key === 'ArrowUp' ? index - 1 : index + 1);
  };

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

          <ol className="stops" aria-label="地點（依行經順序）">
            {waypoints.map((w, i) => {
              const selected = activeIndex === i;
              const className = [
                'stop',
                dragFrom === i ? 'dragging' : '',
                dragOver === i && dragFrom !== i ? 'drop-target' : '',
              ].join(' ');
              return (
                <li
                  key={w.id}
                  className={className}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDrop={(e) => onDrop(e, i)}
                >
                  <button
                    type="button"
                    className="stop-handle"
                    draggable
                    onDragStart={(e) => {
                      // Firefox 需要 setData 才會開始拖曳
                      e.dataTransfer.setData('text/plain', String(i));
                      e.dataTransfer.effectAllowed = 'move';
                      setDragFrom(i);
                    }}
                    onDragEnd={endDrag}
                    onKeyDown={(e) => onHandleKey(e, i)}
                    title="拖曳即可重新排序（鍵盤：Alt+↑／↓）"
                    aria-label={`${waypointLetter(i)} 點，拖曳或按 Alt+上下鍵重新排序`}
                  >
                    <StopIcon letter={waypointLetter(i)} isLast={i === count - 1} />
                  </button>
                  <button
                    type="button"
                    className={`stop-field${selected ? ' selected' : ''}${w.point ? '' : ' empty'}`}
                    aria-pressed={selected}
                    onClick={() => planner.selectRow(i)}
                    title={w.point ? '點選後在地圖上重新選點' : '點選後在地圖上選點'}
                  >
                    {fieldText(w, i, count, selected)}
                  </button>
                  <button
                    type="button"
                    className="stop-remove"
                    onClick={() => planner.removeStop(i)}
                    disabled={count <= 2 && !w.point}
                    aria-label={count <= 2 ? `清除 ${waypointLetter(i)} 點` : `移除 ${waypointLetter(i)} 點`}
                    title={count <= 2 ? '清除' : '移除'}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>

          <button type="button" className="stop-add" onClick={planner.addStop} disabled={count >= MAX_WAYPOINTS}>
            <span aria-hidden="true">⊕</span> 新增目的地
          </button>

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
            <button type="button" onClick={planner.reverse} disabled={!hasAnyPoint}>
              反轉順序
            </button>
            <button type="button" onClick={planner.clear} disabled={!hasAnyPoint && count <= 2}>
              清除
            </button>
          </div>
        </>
      )}
    </section>
  );
}
