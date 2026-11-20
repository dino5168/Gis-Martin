import { describe, expect, it } from 'vitest';
import {
  addWaypoint,
  filledPoints,
  firstEmptyIndex,
  initialWaypoints,
  MAX_WAYPOINTS,
  moveWaypoint,
  removeWaypoint,
  setWaypointName,
  setWaypointPoint,
  waypointLetter,
  type Waypoint,
} from './waypoints';

const A: [number, number] = [121.5, 25.0];
const B: [number, number] = [121.6, 25.1];
const C: [number, number] = [121.7, 25.2];

const wp = (id: string, point: [number, number] | null, name?: string): Waypoint =>
  name === undefined ? { id, point } : { id, point, name };

describe('initialWaypoints', () => {
  it('starts with an empty start and destination with distinct ids', () => {
    const list = initialWaypoints();
    expect(list.map((w) => w.point)).toEqual([null, null]);
    expect(new Set(list.map((w) => w.id)).size).toBe(2);
  });
});

describe('setWaypointPoint / setWaypointName', () => {
  it('sets a point and drops the stale road name', () => {
    const next = setWaypointPoint([wp('a', A, '舊路名'), wp('b', null)], 0, C);
    expect(next[0]).toEqual({ id: 'a', point: C });
  });

  it('stores a name only if the stop still has the looked-up point', () => {
    const list = [wp('a', A), wp('b', B)];
    expect(setWaypointName(list, 'a', A, '信義路')[0]?.name).toBe('信義路');
    // 查詢期間使用者重新選點：舊結果不得覆蓋
    expect(setWaypointName(list, 'a', [121.5, 25.0], '信義路')[0]?.name).toBeUndefined();
  });
});

describe('firstEmptyIndex', () => {
  it('finds the first row without a point', () => {
    expect(firstEmptyIndex([wp('a', A), wp('b', null), wp('c', null)])).toBe(1);
    expect(firstEmptyIndex([wp('a', A), wp('b', B)])).toBeNull();
  });
});

describe('addWaypoint', () => {
  it('appends an empty destination', () => {
    const next = addWaypoint([wp('a', A), wp('b', B)]);
    expect(next).toHaveLength(3);
    expect(next[2]?.point).toBeNull();
  });

  it('stops at MAX_WAYPOINTS', () => {
    const full = Array.from({ length: MAX_WAYPOINTS }, (_, i) => wp(String(i), A));
    expect(addWaypoint(full)).toBe(full);
  });
});

describe('removeWaypoint', () => {
  it('removes a row when more than two exist', () => {
    expect(removeWaypoint([wp('a', A), wp('b', B), wp('c', C)], 1).map((w) => w.id)).toEqual(['a', 'c']);
  });

  it('clears instead of removing when only start and destination remain', () => {
    expect(removeWaypoint([wp('a', A), wp('b', B, '路')], 1)).toEqual([wp('a', A), wp('b', null)]);
  });
});

describe('moveWaypoint', () => {
  const list = [wp('a', A), wp('b', B), wp('c', C)];

  it('moves a row down and up', () => {
    expect(moveWaypoint(list, 0, 2).map((w) => w.id)).toEqual(['b', 'c', 'a']);
    expect(moveWaypoint(list, 2, 0).map((w) => w.id)).toEqual(['c', 'a', 'b']);
  });

  it.each([
    [0, 0],
    [0, -1],
    [2, 3],
  ])('ignores %d → %d', (from, to) => {
    expect(moveWaypoint(list, from, to)).toBe(list);
  });
});

describe('filledPoints / waypointLetter', () => {
  it('skips empty rows but keeps order', () => {
    expect(filledPoints([wp('a', B), wp('b', null), wp('c', A)])).toEqual([B, A]);
  });

  it('letters rows A, B, C…', () => {
    expect([0, 1, 9].map(waypointLetter)).toEqual(['A', 'B', 'J']);
  });
});
