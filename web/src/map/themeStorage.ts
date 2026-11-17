import { DEFAULT_THEME, isThemeId, type ThemeId } from './style';

const STORAGE_KEY = 'gis-martin.theme';

/**
 * Returns `localStorage` if the browser allows it.
 *
 * Accessing the property itself throws in some privacy modes and sandboxed iframes,
 * so the theme preference degrades to "not remembered" instead of breaking the app.
 *
 * Returns:
 *   The storage, or null when unavailable.
 */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the remembered theme.
 *
 * Args:
 *   storage: Storage to read from; null when unavailable.
 *
 * Returns:
 *   The stored theme if valid, otherwise the default theme.
 */
export function loadTheme(storage: Pick<Storage, 'getItem'> | null): ThemeId {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return isThemeId(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Remembers the chosen theme; failures (quota, disabled storage) are ignored on purpose.
 *
 * Args:
 *   storage: Storage to write to; null when unavailable.
 *   theme: Theme to remember.
 */
export function saveTheme(storage: Pick<Storage, 'setItem'> | null, theme: ThemeId): void {
  try {
    storage?.setItem(STORAGE_KEY, theme);
  } catch {
    // 只是使用者偏好，寫入失敗不影響地圖
  }
}
