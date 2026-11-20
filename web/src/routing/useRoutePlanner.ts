import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNearestName, fetchRoute, type LngLat, type PlannedRoute, type RouteProfile } from './osrm';
import {
  addWaypoint,
  filledPoints,
  firstEmptyIndex,
  initialWaypoints,
  moveWaypoint,
  removeWaypoint,
  setWaypointName,
  setWaypointPoint,
  type Waypoint,
} from './waypoints';

/** Planner state and actions exposed to the UI. */
export interface RoutePlanner {
  /** Planning mode on (panel expanded). */
  active: boolean;
  /** Stops in visiting order: start, intermediate stops, destination. */
  waypoints: readonly Waypoint[];
  /** Row the next map click fills; null when every row is set and none was selected. */
  activeIndex: number | null;
  profile: RouteProfile;
  route: PlannedRoute | null;
  error: string | null;
  loading: boolean;
  /** Whether map clicks should go to `pick` instead of feature info. */
  picking: boolean;
  setActive: (active: boolean) => void;
  pick: (clicked: LngLat) => void;
  /** Selects a row so the next map click (re)sets it. */
  selectRow: (index: number) => void;
  addStop: () => void;
  removeStop: (index: number) => void;
  moveStop: (from: number, to: number) => void;
  reverse: () => void;
  clear: () => void;
  setProfile: (profile: RouteProfile) => void;
}

/**
 * Route planning state: an ordered stop list, travel mode and the OSRM result.
 *
 * A route is requested through the set stops (empty rows are skipped) whenever at least two
 * are set and a point, the order or the profile changes; an in-flight request is aborted so a
 * slow answer never overwrites a newer one. Each newly picked stop gets its nearest road name.
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL; null (not configured) never requests anything.
 *
 * Returns:
 *   Planner state and actions.
 */
export function useRoutePlanner(osrmUrl: string | null): RoutePlanner {
  const [active, setActiveState] = useState(false);
  const [waypoints, setWaypoints] = useState<readonly Waypoint[]>(initialWaypoints);
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const [profile, setProfile] = useState<RouteProfile>('driving');
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 名稱查回來也會產生新的 waypoints 陣列；只有點位或順序變了才重新算路線
  const points = useMemo(() => filledPoints(waypoints), [waypoints]);
  const pointsKey = points.map((p) => p.join(',')).join(';');
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    setRoute(null);
    setError(null);
    const current = pointsRef.current;
    if (!osrmUrl || current.length < 2) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetchRoute(osrmUrl, profile, current, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoading(false);
      if (result.error) setError(result.error.message);
      else setRoute(result.data);
    });
    return () => controller.abort();
  }, [osrmUrl, profile, pointsKey]);

  // 新選的點查最近道路名稱；以 id＋點位物件判斷是否仍有效，點位換掉後的舊結果會被忽略
  const pendingNames = useRef(new Set<string>());
  useEffect(() => {
    if (!osrmUrl) return;
    for (const w of waypoints) {
      const point = w.point;
      if (!point || w.name !== undefined) continue;
      const key = `${w.id}@${point.join(',')}`;
      if (pendingNames.current.has(key)) continue;
      pendingNames.current.add(key);
      void fetchNearestName(osrmUrl, profile, point).then((result) => {
        pendingNames.current.delete(key);
        // 查不到名稱時以空字串表示，面板改顯示座標
        setWaypoints((prev) => setWaypointName(prev, w.id, point, result.error ? '' : result.data));
      });
    }
  }, [osrmUrl, profile, waypoints]);

  const setActive = useCallback((next: boolean) => {
    setActiveState(next);
    // 開始與結束都從空白的起點／目的地重來
    setWaypoints(initialWaypoints());
    setActiveIndex(0);
  }, []);

  const pick = useCallback(
    (clicked: LngLat) => {
      if (activeIndex === null) return;
      const next = setWaypointPoint(waypoints, activeIndex, clicked);
      setWaypoints(next);
      // 接著填下一個空白列；全部填滿後地圖點擊恢復為查看要素
      setActiveIndex(firstEmptyIndex(next));
    },
    [activeIndex, waypoints],
  );

  // 增刪排序後，選取列改為第一個空白列（原本選的列可能已移位或刪除）
  const update = useCallback((next: readonly Waypoint[]) => {
    setWaypoints(next);
    setActiveIndex(firstEmptyIndex(next));
  }, []);

  const addStop = useCallback(() => update(addWaypoint(waypoints)), [update, waypoints]);
  const removeStop = useCallback((index: number) => update(removeWaypoint(waypoints, index)), [update, waypoints]);
  const moveStop = useCallback((from: number, to: number) => update(moveWaypoint(waypoints, from, to)), [update, waypoints]);
  const reverse = useCallback(() => update([...waypoints].reverse()), [update, waypoints]);
  const clear = useCallback(() => update(initialWaypoints()), [update]);

  return {
    active,
    waypoints,
    activeIndex,
    profile,
    route,
    error,
    loading,
    picking: active && activeIndex !== null,
    setActive,
    pick,
    selectRow: setActiveIndex,
    addStop,
    removeStop,
    moveStop,
    reverse,
    clear,
    setProfile,
  };
}
