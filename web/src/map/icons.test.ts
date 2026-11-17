import { describe, expect, it } from 'vitest';
import { createDotImage, parseHex, POI_ICONS } from './icons';

const pixel = (img: ReturnType<typeof createDotImage>, x: number, y: number): number[] => {
  const i = (y * img.width + x) * 4;
  return Array.from(img.data.slice(i, i + 4));
};

describe('parseHex', () => {
  it('parses six-digit colours', () => {
    expect(parseHex('#4f7fc7')).toEqual([0x4f, 0x7f, 0xc7]);
  });

  it('rejects malformed input', () => {
    expect(() => parseHex('4f7fc7')).toThrow();
    expect(() => parseHex('#fff')).toThrow();
  });
});

describe('createDotImage', () => {
  const img = createDotImage(12, '#b5615a');
  const mid = Math.floor(img.width / 2);

  it('allocates a padded square RGBA bitmap', () => {
    expect(img.width).toBe(14);
    expect(img.height).toBe(14);
    expect(img.data.length).toBe(14 * 14 * 4);
  });

  it('fills the centre with the opaque fill colour', () => {
    expect(pixel(img, mid, mid)).toEqual([0xb5, 0x61, 0x5a, 255]);
  });

  it('draws a white ring near the edge and leaves corners transparent', () => {
    const ring = pixel(img, mid, 1);
    expect(ring[3]).toBeGreaterThan(0);
    expect(ring.slice(0, 3)).toEqual([255, 255, 255]);
    expect(pixel(img, 0, 0)[3]).toBe(0);
  });

  it('scales with the device pixel ratio', () => {
    expect(createDotImage(12, '#000000', 2).width).toBe(26);
  });
});

describe('POI_ICONS', () => {
  it('uses valid palette colours', () => {
    for (const { fill } of Object.values(POI_ICONS)) {
      expect(() => parseHex(fill)).not.toThrow();
    }
  });
});
