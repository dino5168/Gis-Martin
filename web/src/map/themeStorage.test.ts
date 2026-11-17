import { describe, expect, it } from 'vitest';
import { loadTheme, saveTheme } from './themeStorage';

/** Minimal in-memory Storage stand-in. */
function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwing: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('theme storage', () => {
  it('round-trips a valid theme', () => {
    const s = memoryStorage();
    saveTheme(s, 'dark');
    expect(loadTheme(s)).toBe('dark');
  });

  it('falls back to the default theme for unknown or missing values', () => {
    expect(loadTheme(memoryStorage({ 'gis-martin.theme': 'neon' }))).toBe('default');
    expect(loadTheme(memoryStorage())).toBe('default');
    expect(loadTheme(null)).toBe('default');
  });

  it('never throws when storage is blocked', () => {
    expect(loadTheme(throwing)).toBe('default');
    expect(() => saveTheme(throwing, 'bright')).not.toThrow();
  });
});
