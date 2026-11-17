import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_BUSES,
  fetchBusData,
  routeBusesToGeoJSON,
  type BusFeatureCollection,
  type BusRoute,
  type BusSnapshot,
} from './busData';
import { fetchBusRoutes } from './busRoutes';

/** Polling state exposed to the UI. */
export interface BusPositionsState {
  buses: BusFeatureCollection;
  /** Feed update time of the last successful load. */
  updateTime: string | null;
  error: string | null;
  loading: boolean;
}

/** Feed refreshes every ~30–60 s; polling faster only re-downloads the same file. */
export const BUS_POLL_INTERVAL_MS = 30_000;

/**
 * Polls the city-wide Taipei bus feed while enabled and the tab is visible, and filters one route.
 *
 * The whole city is downloaded anyway (~50 KB), so the last snapshot is kept and switching
 * routes re-filters it immediately instead of waiting for the next poll. Polling pauses in
 * background tabs and resumes as soon as the tab is visible again.
 *
 * Args:
 *   route: Route to show.
 *   enabled: False stops polling and clears the buses (layer switched off).
 *
 * Returns:
 *   Buses of the route, update time, error and loading flag.
 */
export function useBusPositions(route: BusRoute, enabled: boolean): BusPositionsState {
  const [snapshot, setSnapshot] = useState<BusSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let timer: number | undefined;

    const poll = async (): Promise<void> => {
      window.clearTimeout(timer);
      setLoading(true);
      const result = await fetchBusData(controller.signal);
      if (controller.signal.aborted) return;
      setLoading(false);
      // 失敗時保留上一次的車輛位置，只顯示錯誤
      if (result.error) {
        setError(result.error.message);
      } else {
        setSnapshot(result.data);
        setError(null);
      }
      if (!document.hidden) timer = window.setTimeout(() => void poll(), BUS_POLL_INTERVAL_MS);
    };

    const onVisibility = (): void => {
      if (document.hidden) window.clearTimeout(timer);
      else void poll();
    };

    void poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  const buses = useMemo(
    () => (snapshot ? routeBusesToGeoJSON(snapshot.buses, route) : EMPTY_BUSES),
    [snapshot, route],
  );

  return { buses, updateTime: snapshot?.updateTime ?? null, error, loading };
}

/** Route list state. */
export interface BusRoutesState {
  /** Sorted routes, or null until loaded. */
  routes: readonly BusRoute[] | null;
  error: string | null;
}

/**
 * Loads the route list once, the first time buses are enabled.
 *
 * Args:
 *   enabled: Whether the bus layer is on (no download while it is off).
 *
 * Returns:
 *   Routes or an error.
 */
export function useBusRoutes(enabled: boolean): BusRoutesState {
  const [state, setState] = useState<BusRoutesState>({ routes: null, error: null });
  const loaded = state.routes !== null;

  useEffect(() => {
    if (!enabled || loaded) return;
    const controller = new AbortController();
    void fetchBusRoutes(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setState(result.error ? { routes: null, error: result.error.message } : { routes: result.data, error: null });
    });
    return () => controller.abort();
  }, [enabled, loaded]);

  return state;
}
