import { describe, expect, it } from 'vitest';
import { MAKI_SVGS } from './makiGlyphs';
import { TOURISM_MAKI } from './style';

describe('MAKI_SVGS', () => {
  it('bundles an SVG for every glyph used by TOURISM_MAKI', () => {
    for (const maki of new Set(Object.values(TOURISM_MAKI))) {
      expect(MAKI_SVGS[maki], maki).toMatch(/<svg[\s>]/);
    }
  });

  it('does not bundle unused glyphs', () => {
    expect(Object.keys(MAKI_SVGS).sort()).toEqual([...new Set(Object.values(TOURISM_MAKI))].sort());
  });
});
