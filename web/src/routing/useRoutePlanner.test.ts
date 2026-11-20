import { describe, expect, it } from 'vitest';
import { NO_POINTS, pickPoint } from './useRoutePlanner';

const A: [number, number] = [121.5, 25.0];
const B: [number, number] = [121.6, 25.1];
const C: [number, number] = [121.7, 25.2];

describe('pickPoint', () => {
  it('sets the start, then the end', () => {
    const first = pickPoint(NO_POINTS, A);
    expect(first).toEqual({ start: A, end: null });
    expect(pickPoint(first, B)).toEqual({ start: A, end: B });
  });

  it('starts over after both points are set', () => {
    expect(pickPoint({ start: A, end: B }, C)).toEqual({ start: C, end: null });
  });

  it('keeps a lone end (after swapping) and fills the start', () => {
    expect(pickPoint({ start: null, end: A }, B)).toEqual({ start: B, end: A });
  });
});
