import type { BusRoute } from '../bus/busData';
import { routeLabel } from '../bus/busRoutes';
import type { BusPositionsState, BusRoutesState } from '../bus/useBusPositions';
import type { Palette } from '../map/style';

interface BusStatusProps {
  route: BusRoute;
  routes: BusRoutesState;
  state: BusPositionsState;
  palette: Palette;
  onSelectRoute: (id: string) => void;
}

/**
 * Route picker and live summary: vehicle counts per direction and feed time.
 *
 * Args:
 *   props: Selected route, route list, polling state, active palette and the selection handler.
 *
 * Returns:
 *   The bus status panel.
 */
export function BusStatus({ route, routes, state, palette, onSelectRoute }: BusStatusProps) {
  const go = state.buses.features.filter((f) => f.properties.dir === 'go').length;
  const back = state.buses.features.filter((f) => f.properties.dir === 'back').length;
  const time = state.updateTime?.split(' ')[1] ?? null;
  // 清單載入前只有預設路線可選
  const options = routes.routes ?? [route];

  return (
    <section className="panel bus-status" aria-label="公車動態">
      <label className="style-select">
        <span>公車路線</span>
        <select value={route.id} onChange={(e) => onSelectRoute(e.target.value)} disabled={!routes.routes}>
          {options.map((r) => (
            <option key={r.id} value={r.id}>
              {routeLabel(r)}
            </option>
          ))}
        </select>
      </label>
      {routes.error && <p className="hint">⚠ {routes.error}</p>}
      <ul aria-live="polite">
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
            ? go + back === 0
              ? `目前沒有營運中的車輛（資料時間 ${time}）`
              : `資料時間 ${time}（每 30 秒更新）`
            : state.loading
              ? '載入中…'
              : ''}
      </p>
    </section>
  );
}
