import type { LngLat } from './osrm';

/** One row of the stop list; `point` is null until picked on the map. */
export interface Waypoint {
  /** Stable key for React lists and drag-and-drop; survives reordering. */
  id: string;
  point: LngLat | null;
  /** Nearest road name from OSRM; undefined while unknown, '' when the road has no name. */
  name?: string;
}

/** OSRM handles many more, but a longer list is unusable in the side panel (Google Maps also stops at 10). */
export const MAX_WAYPOINTS = 10;

/**
 * Creates an empty stop.
 *
 * Returns:
 *   A waypoint with a fresh id and no point.
 */
export function newWaypoint(): Waypoint {
  return { id: crypto.randomUUID(), point: null };
}

/**
 * Creates the initial list: an empty start and an empty destination.
 *
 * Returns:
 *   Two empty waypoints.
 */
export function initialWaypoints(): Waypoint[] {
  return [newWaypoint(), newWaypoint()];
}

/**
 * Sets the point of one stop; the old road name no longer applies.
 *
 * Args:
 *   list: Current stops.
 *   index: Row to change.
 *   point: Picked location (EPSG:4326).
 *
 * Returns:
 *   New list (unchanged if `index` is out of range).
 */
export function setWaypointPoint(list: readonly Waypoint[], index: number, point: LngLat): Waypoint[] {
  return list.map((w, i) => (i === index ? { id: w.id, point } : w));
}

/**
 * Stores the looked-up road name, unless the stop moved since the lookup started.
 *
 * Args:
 *   list: Current stops.
 *   id: Stop the lookup was for.
 *   point: Point the lookup was for.
 *   name: Road name ('' when unnamed).
 *
 * Returns:
 *   New list.
 */
export function setWaypointName(list: readonly Waypoint[], id: string, point: LngLat, name: string): Waypoint[] {
  return list.map((w) => (w.id === id && w.point === point ? { ...w, name } : w));
}

/**
 * Finds the first stop without a point.
 *
 * Args:
 *   list: Current stops.
 *
 * Returns:
 *   Its index, or null when every stop is set.
 */
export function firstEmptyIndex(list: readonly Waypoint[]): number | null {
  const i = list.findIndex((w) => w.point === null);
  return i === -1 ? null : i;
}

/**
 * Appends an empty destination.
 *
 * Args:
 *   list: Current stops.
 *
 * Returns:
 *   New list, or the same list when MAX_WAYPOINTS is reached.
 */
export function addWaypoint(list: readonly Waypoint[]): readonly Waypoint[] {
  return list.length >= MAX_WAYPOINTS ? list : [...list, newWaypoint()];
}

/**
 * Removes a stop; the list never drops below start + destination.
 *
 * Args:
 *   list: Current stops.
 *   index: Row to remove.
 *
 * Returns:
 *   New list; with only two rows the row is cleared instead of removed.
 */
export function removeWaypoint(list: readonly Waypoint[], index: number): Waypoint[] {
  if (list.length <= 2) return list.map((w, i) => (i === index ? { id: w.id, point: null } : w));
  return list.filter((_, i) => i !== index);
}

/**
 * Moves a stop to another position (drag-and-drop or keyboard reorder).
 *
 * Args:
 *   list: Current stops.
 *   from: Current index.
 *   to: Target index.
 *
 * Returns:
 *   New list; unchanged when either index is out of range.
 */
export function moveWaypoint(list: readonly Waypoint[], from: number, to: number): readonly Waypoint[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

/**
 * Collects the set points in list order; empty rows are skipped.
 *
 * Args:
 *   list: Current stops.
 *
 * Returns:
 *   Points to route through (a route needs at least two).
 */
export function filledPoints(list: readonly Waypoint[]): LngLat[] {
  return list.flatMap((w) => (w.point ? [w.point] : []));
}

/**
 * Letter shown on a stop in the list and on its map marker.
 *
 * Args:
 *   index: Row index.
 *
 * Returns:
 *   'A', 'B', … (row index, so list and map stay in sync after reordering).
 */
export function waypointLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
