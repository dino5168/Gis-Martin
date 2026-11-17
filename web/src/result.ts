/** Explicit success/failure value used instead of throwing across module boundaries. */
export type Result<T> = { data: T; error: null } | { data: null; error: Error };

/**
 * Wraps a successful value.
 *
 * Args:
 *   data: The success payload.
 *
 * Returns:
 *   A Result in the success state.
 */
export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

/**
 * Wraps a failure.
 *
 * Args:
 *   message: Human-readable error description.
 *
 * Returns:
 *   A Result in the failure state.
 */
export function err<T>(message: string): Result<T> {
  return { data: null, error: new Error(message) };
}
