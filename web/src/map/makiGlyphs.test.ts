import { describe, expect, it } from 'vitest';
import { MAKI_SVGS } from './makiGlyphs';
import { POI_CLASS_MAKI, POI_MAKI } from './style';

const used = new Set<string>([...Object.values(POI_MAKI), ...Object.values(POI_CLASS_MAKI)].map(([maki]) => maki));

describe('MAKI_SVGS', () => {
  it('bundles an SVG for every glyph used by the POI mapping', () => {
    for (const maki of used) {
      expect(MAKI_SVGS[maki as keyof typeof MAKI_SVGS], maki).toMatch(/<svg[\s>]/);
    }
  });

  it('does not bundle unused glyphs', () => {
    expect(Object.keys(MAKI_SVGS).sort()).toEqual([...used].sort());
  });
});
