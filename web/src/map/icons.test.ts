import { describe, expect, it } from 'vitest';
import { createDotImage, createIconImage, glyphPixelSize, parseHex, type GlyphMask } from './icons';
import { POI_ICONS, THEMES } from './style';

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

describe('createIconImage', () => {
  // 18 px 圓、glyph 11 px；glyph 只有中央 3×3 有覆蓋
  const size = glyphPixelSize(18, 1);
  const alpha = new Uint8Array(size * size);
  const c = Math.floor(size / 2);
  for (let y = c - 1; y <= c + 1; y++) for (let x = c - 1; x <= c + 1; x++) alpha[y * size + x] = 255;
  const glyph: GlyphMask = { size, alpha };
  const img = createIconImage(18, '#16867f', glyph);
  const mid = Math.floor(img.width / 2);

  it('keeps the plain dot size so icons and dots share collision boxes logic', () => {
    expect(size).toBe(11);
    expect(img.width).toBe(createDotImage(18, '#16867f').width);
  });

  it('paints the glyph white over the disc', () => {
    expect(pixel(img, mid, mid)).toEqual([255, 255, 255, 255]);
  });

  it('keeps the disc colour where the glyph is empty', () => {
    expect(pixel(img, mid - 5, mid)).toEqual([0x16, 0x86, 0x7f, 255]);
  });
});

describe('POI_ICONS', () => {
  it('uses valid palette colours', () => {
    for (const { fill } of Object.values(POI_ICONS)) {
      expect(() => parseHex(fill)).not.toThrow();
    }
  });

  it('defines one icon set per theme so switching themes never reuses a stale colour', () => {
    for (const t of THEMES) {
      expect(Object.keys(POI_ICONS).filter((id) => id.endsWith(`-${t.id}`))).toHaveLength(3);
    }
  });
});

describe('theme palettes', () => {
  it.each(THEMES.map((t) => [t.id, t.palette] as const))('%s uses #rrggbb colours only', (_id, palette) => {
    for (const [key, colour] of Object.entries(palette)) {
      expect(() => parseHex(colour), key).not.toThrow();
    }
  });
});
