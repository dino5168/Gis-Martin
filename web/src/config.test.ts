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

describe('parseConfig VITE_OSRM_URL', () => {
  const martin = { VITE_MARTIN_URL: 'http://localhost:3000' };

  it.each([
    ['missing', undefined],
    ['blank', '  '],
  ])('is optional (%s → route planning off)', (_label, value) => {
    const result = parseConfig({ ...martin, VITE_OSRM_URL: value });
    expect(result.error).toBeNull();
    expect(result.data?.osrmUrl).toBeNull();
  });

  it('keeps the path prefix without trailing slashes', () => {
    const result = parseConfig({ ...martin, VITE_OSRM_URL: 'http://localhost:5173/osrm/' });
    expect(result.data?.osrmUrl).toBe('http://localhost:5173/osrm');
  });

  it.each([
    ['not a url', 'osrm'],
    ['query string', 'http://localhost:5173/osrm?x=1'],
  ])('rejects %s and names the variable', (_label, value) => {
    const result = parseConfig({ ...martin, VITE_OSRM_URL: value });
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('VITE_OSRM_URL');
  });

  it('rejects http in production', () => {
    const result = parseConfig({ VITE_MARTIN_URL: 'https://t.example.com', VITE_OSRM_URL: 'http://r.example.com' }, true);
    expect(result.error?.message).toContain('VITE_OSRM_URL');
  });
});
