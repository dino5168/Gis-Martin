import { PALETTE } from './style';

/** Raw RGBA image accepted by `map.addImage` (non-premultiplied). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** POI dot icons referenced by the `pois-symbol` layer's `icon-image`. */
export const POI_ICONS: Readonly<Record<string, { fill: string; diameter: number }>> = {
  'poi-transit': { fill: PALETTE.poiTransit, diameter: 12 },
  'poi-major': { fill: PALETTE.poi, diameter: 12 },
  'poi-default': { fill: PALETTE.poi, diameter: 9 },
};

/**
 * Parses `#rrggbb` into RGB components.
 *
 * Args:
 *   hex: Six-digit hex colour with leading `#`.
 *
 * Returns:
 *   `[r, g, b]` in 0–255.
 *
 * Raises:
 *   Error: If the string is not a six-digit hex colour (programming error in PALETTE).
 */
export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/**
 * Rasterises an anti-aliased filled dot with a white ring.
 *
 * Generated in code instead of shipping a sprite sheet: the style needs only a
 * few plain dots, and a pure function keeps them unit-testable without a DOM.
 *
 * Args:
 *   diameter: Dot diameter in CSS pixels.
 *   fill: Fill colour as `#rrggbb`.
 *   pixelRatio: Device pixel ratio the bitmap is rendered for.
 *
 * Returns:
 *   RGBA bitmap of size `diameter * pixelRatio` (+2 px padding) squared.
 */
export function createDotImage(diameter: number, fill: string, pixelRatio = 1): RgbaImage {
  const [fr, fg, fb] = parseHex(fill);
  const size = Math.ceil(diameter * pixelRatio) + 2;
  const center = size / 2;
  const outer = (diameter * pixelRatio) / 2;
  const inner = outer - 1.5 * pixelRatio; // 白色外環寬 1.5 CSS px
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      // 以像素覆蓋率近似反鋸齒：邊緣 1 px 內線性漸變
      const outerCov = Math.min(1, Math.max(0, outer + 0.5 - d));
      const innerCov = Math.min(1, Math.max(0, inner + 0.5 - d));
      const i = (y * size + x) * 4;
      data[i] = Math.round(255 + (fr - 255) * innerCov);
      data[i + 1] = Math.round(255 + (fg - 255) * innerCov);
      data[i + 2] = Math.round(255 + (fb - 255) * innerCov);
      data[i + 3] = Math.round(255 * outerCov);
    }
  }
  return { width: size, height: size, data };
}
