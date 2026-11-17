// Maki 圖示（CC0 1.0，@mapbox/maki）以 ?raw 打包進 bundle，不需額外請求
import artGallery from '@mapbox/maki/icons/art-gallery.svg?raw';
import attraction from '@mapbox/maki/icons/attraction.svg?raw';
import campsite from '@mapbox/maki/icons/campsite.svg?raw';
import home from '@mapbox/maki/icons/home.svg?raw';
import information from '@mapbox/maki/icons/information.svg?raw';
import lodging from '@mapbox/maki/icons/lodging.svg?raw';
import monument from '@mapbox/maki/icons/monument.svg?raw';
import museum from '@mapbox/maki/icons/museum.svg?raw';
import picnicSite from '@mapbox/maki/icons/picnic-site.svg?raw';
import shelter from '@mapbox/maki/icons/shelter.svg?raw';
import triangle from '@mapbox/maki/icons/triangle.svg?raw';
import viewpoint from '@mapbox/maki/icons/viewpoint.svg?raw';
import { glyphPixelSize, iconPixelRatio, type GlyphMask } from './icons';
import { MAKI_ICON_DIAMETER, type MakiName } from './style';

/** SVG source of every glyph referenced by TOURISM_MAKI (checked by the type: missing keys fail to compile). */
export const MAKI_SVGS: Readonly<Record<MakiName, string>> = {
  'art-gallery': artGallery,
  attraction,
  campsite,
  home,
  information,
  lodging,
  monument,
  museum,
  'picnic-site': picnicSite,
  shelter,
  triangle,
  viewpoint,
};

const glyphs = new Map<MakiName, GlyphMask>();

/**
 * Returns a glyph mask prepared by preloadMakiGlyphs.
 *
 * Args:
 *   maki: Maki glyph name.
 *
 * Returns:
 *   The mask, or undefined if it failed to load (callers fall back to a plain dot).
 */
export function getMakiGlyph(maki: MakiName): GlyphMask | undefined {
  return glyphs.get(maki);
}

/**
 * Rasterises one SVG into a coverage mask using an offscreen canvas.
 *
 * Args:
 *   svg: SVG markup.
 *   size: Output edge length in device pixels.
 *
 * Returns:
 *   The glyph's alpha channel.
 *
 * Raises:
 *   Error: If the SVG cannot be decoded or a 2D context is unavailable.
 */
async function rasterize(svg: string, size: number): Promise<GlyphMask> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image(size, size);
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    // SVG 是向量，直接畫到目標尺寸不會模糊
    ctx.drawImage(img, 0, 0, size, size);
    const rgba = ctx.getImageData(0, 0, size, size).data;
    const alpha = new Uint8Array(size * size);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
    return { size, alpha };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Rasterises every Maki glyph before the map is created.
 *
 * Decoding SVG is asynchronous, but MapLibre's `styleimagemissing` must add the
 * image synchronously or the first tiles are laid out without icons. Preloading
 * lets the handler composite icons synchronously from this cache.
 *
 * Returns:
 *   Names of glyphs that failed to load (they render as plain dots).
 */
export async function preloadMakiGlyphs(): Promise<MakiName[]> {
  const size = glyphPixelSize(MAKI_ICON_DIAMETER, iconPixelRatio());
  const entries = Object.entries(MAKI_SVGS) as [MakiName, string][];
  const results = await Promise.allSettled(entries.map(([, svg]) => rasterize(svg, size)));
  const failed: MakiName[] = [];
  results.forEach((r, i) => {
    const name = entries[i]?.[0];
    if (!name) return;
    if (r.status === 'fulfilled') glyphs.set(name, r.value);
    else failed.push(name);
  });
  return failed;
}
