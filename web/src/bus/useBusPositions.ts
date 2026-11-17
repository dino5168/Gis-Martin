import { useEffect, useState } from 'react';
import { fetchBusData, routeBusesToGeoJSON, type BusFeatureCollection, type BusRoute, EMPTY_BUSES } from './busData';

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
 * Polls the Taipei bus feed for one route while enabled and the tab is visible.
 *
 * Polling pauses in background tabs (each poll downloads the whole city, ~50 KB)
 * and resumes immediately when the tab becomes visible again.
 *
 * Args:
 *   route: Route to show.
 *   enabled: False stops polling and clears the buses (layer switched off).
 *
 * Returns:
 *   Latest buses, update time, error and loading flag.
 */
export function useBusPositions(route: BusRoute, enabled: boolean): BusPositionsState {
  const [state, setState] = useState<BusPositionsState>({
    buses: EMPTY_BUSES,
    updateTime: null,
    error: null,
    loading: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ buses: EMPTY_BUSES, updateTime: null, error: null, loading: false });
      return;
    }

    const controller = new AbortController();
    let timer: number | undefined;

    const poll = async (): Promise<void> => {
      window.clearTimeout(timer);
      setState((s) => ({ ...s, loading: true }));
      const result = await fetchBusData(controller.signal);
      if (controller.signal.aborted) return;
      // 失敗時保留上一次的車輛位置，只顯示錯誤
      setState((s) =>
        result.error
          ? { ...s, error: result.error.message, loading: false }
          : {
              buses: routeBusesToGeoJSON(result.data.buses, route),
              updateTime: result.data.updateTime,
              error: null,
              loading: false,
            },
      );
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
  }, [route, enabled]);

  return state;
}
