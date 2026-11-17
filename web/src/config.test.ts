import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

describe('parseConfig', () => {
  it('accepts a plain http origin', () => {
    const result = parseConfig({ VITE_MARTIN_URL: 'http://localhost:3000' });
    expect(result.error).toBeNull();
    expect(result.data?.martinUrl).toBe('http://localhost:3000');
  });

  it('strips trailing slashes and keeps a path prefix', () => {
    const result = parseConfig({ VITE_MARTIN_URL: ' https://tiles.example.com/martin/// ' });
    expect(result.data?.martinUrl).toBe('https://tiles.example.com/martin');
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['not a url', 'localhost:3000/tiles'],
    ['wrong protocol', 'ftp://localhost:3000'],
    ['query string', 'http://localhost:3000?x=1'],
    ['hash', 'http://localhost:3000#a'],
  ])('rejects %s', (_label, value) => {
    const result = parseConfig({ VITE_MARTIN_URL: value });
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  it('rejects http in production', () => {
    const result = parseConfig({ VITE_MARTIN_URL: 'http://tiles.example.com' }, true);
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('https');
  });

  it('accepts https in production', () => {
    const result = parseConfig({ VITE_MARTIN_URL: 'https://tiles.example.com' }, true);
    expect(result.data?.martinUrl).toBe('https://tiles.example.com');
  });
});
