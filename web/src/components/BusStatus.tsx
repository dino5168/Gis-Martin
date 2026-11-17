import type { BusRoute } from '../bus/busData';
import type { BusPositionsState } from '../bus/useBusPositions';
import type { Palette } from '../map/style';

interface BusStatusProps {
  route: BusRoute;
  state: BusPositionsState;
  palette: Palette;
}

/**
 * Live bus summary for the selected route: vehicle counts per direction and feed time.
 *
 * Args:
 *   props: Route, polling state and active palette (legend colours match the map).
 *
 * Returns:
 *   The bus status panel.
 */
export function BusStatus({ route, state, palette }: BusStatusProps) {
  const go = state.buses.features.filter((f) => f.properties.dir === 'go').length;
  const back = state.buses.features.filter((f) => f.properties.dir === 'back').length;
  const time = state.updateTime?.split(' ')[1] ?? null;

  return (
    <section className="panel bus-status" aria-label="公車動態" aria-live="polite">
      <h2>
        {route.name} 號公車
        <span className="hint">
          {route.returnTo} ↔ {route.outboundTo}
        </span>
      </h2>
      <ul>
        <li>
          <span className="swatch" style={{ background: palette.busGo }} aria-hidden="true" />往{route.outboundTo}：{go} 輛
        </li>
        <li>
          <span className="swatch" style={{ background: palette.busBack }} aria-hidden="true" />往{route.returnTo}：{back} 輛
        </li>
      </ul>
      <p className="hint">
        {state.error
          ? `⚠ ${state.error}`
          : time
            ? `資料時間 ${time}（每 30 秒更新）`
            : state.loading
              ? '載入中…'
              : ''}
      </p>
    </section>
  );
}
