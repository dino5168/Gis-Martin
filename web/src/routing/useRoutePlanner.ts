import { useCallback, useEffect, useState } from 'react';
import { fetchRoute, type LngLat, type PlannedRoute, type RouteProfile } from './osrm';

/** Start/end picked on the map. */
export interface RoutePoints {
  start: LngLat | null;
  end: LngLat | null;
}

export const NO_POINTS: RoutePoints = { start: null, end: null };

/**
 * Applies one map click to the picked points.
 *
 * Args:
 *   points: Current points.
 *   clicked: Clicked location (EPSG:4326).
 *
 * Returns:
 *   Fills the missing start, then the missing end; a click after both are set starts over.
 *   (Only the end can be set without a start, after swapping a lone start.)
 */
export function pickPoint(points: RoutePoints, clicked: LngLat): RoutePoints {
  if (!points.start) return { start: clicked, end: points.end };
  if (!points.end) return { start: points.start, end: clicked };
  return { start: clicked, end: null };
}

/** Planner state and actions exposed to the UI. */
export interface RoutePlanner {
  /** Planning mode on: map clicks pick points instead of showing feature info. */
  active: boolean;
  points: RoutePoints;
  profile: RouteProfile;
  route: PlannedRoute | null;
  error: string | null;
  loading: boolean;
  /** Whether the next map click should go to `pick` (active and a point is still missing). */
  picking: boolean;
  setActive: (active: boolean) => void;
  pick: (clicked: LngLat) => void;
  setProfile: (profile: RouteProfile) => void;
  swap: () => void;
  clear: () => void;
}

/**
 * Route planning state: picked points, travel mode and the OSRM result.
 *
 * A new route is requested whenever both points exist and either point or the profile changes;
 * an in-flight request is aborted so a slow answer never overwrites a newer one.
 *
 * Args:
 *   osrmUrl: Validated OSRM base URL; null (not configured) never requests a route.
 *
 * Returns:
 *   Planner state and actions.
 */
export function useRoutePlanner(osrmUrl: string | null): RoutePlanner {
  const [active, setActiveState] = useState(false);
  const [points, setPoints] = useState<RoutePoints>(NO_POINTS);
  const [profile, setProfile] = useState<RouteProfile>('driving');
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { start, end } = points;
  useEffect(() => {
    setRoute(null);
    setError(null);
    if (!osrmUrl || !start || !end) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetchRoute(osrmUrl, profile, start, end, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLoading(false);
      if (result.error) setError(result.error.message);
      else setRoute(result.data);
    });
    return () => controller.abort();
  }, [osrmUrl, profile, start, end]);

  const setActive = useCallback((next: boolean) => {
    setActiveState(next);
    // 結束規劃時一併清掉地圖上的路線
    if (!next) setPoints(NO_POINTS);
  }, []);
  const pick = useCallback((clicked: LngLat) => setPoints((prev) => pickPoint(prev, clicked)), []);
  const swap = useCallback(() => setPoints((prev) => ({ start: prev.end, end: prev.start })), []);
  const clear = useCallback(() => setPoints(NO_POINTS), []);

  return {
    active,
    points,
    profile,
    route,
    error,
    loading,
    picking: active && (!start || !end),
    setActive,
    pick,
    setProfile,
    swap,
    clear,
  };
}
