/** Raw RGBA image accepted by `map.addImage` (non-premultiplied). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Square coverage mask of a rasterised glyph (0 = empty, 255 = fully covered). */
export interface GlyphMask {
  size: number;
  alpha: Uint8Array;
}

/** Glyph edge length relative to the disc diameter; leaves a margin inside the white ring. */
export const GLYPH_SCALE = 0.6;

/**
 * Device pixel ratio used for every generated icon.
 *
 * Rounded so glyph masks rasterised at startup and discs drawn later share one pixel grid.
 *
 * Returns:
 *   Integer pixel ratio ≥ 1.
 */
export function iconPixelRatio(): number {
  return Math.max(1, Math.round(globalThis.devicePixelRatio ?? 1));
}

/**
 * Glyph mask edge length in device pixels for a disc diameter.
 *
 * Args:
 *   diameter: Disc diameter in CSS pixels.
 *   pixelRatio: Device pixel ratio.
 *
 * Returns:
 *   Edge length in device pixels.
 */
export function glyphPixelSize(diameter: number, pixelRatio: number): number {
  return Math.round(diameter * GLYPH_SCALE * pixelRatio);
}

/**
 * Draws a glyph in a solid colour on a transparent square (no disc), e.g. a heading arrow.
 *
 * Args:
 *   diameter: Bounding size in CSS pixels (same canvas size as a disc of this diameter).
 *   fill: Glyph colour as `#rrggbb`.
 *   glyph: Coverage mask rasterised at `glyphPixelSize(diameter, pixelRatio)`.
 *   pixelRatio: Device pixel ratio the bitmap is rendered for.
 *
 * Returns:
 *   RGBA bitmap; alpha follows the glyph coverage.
 */
export function createGlyphImage(diameter: number, fill: string, glyph: GlyphMask, pixelRatio = 1): RgbaImage {
  const [r, g, b] = parseHex(fill);
  const size = Math.ceil(diameter * pixelRatio) + 2;
  const data = new Uint8Array(size * size * 4);
  const offset = Math.floor((size - glyph.size) / 2);
  for (let gy = 0; gy < glyph.size; gy++) {
    for (let gx = 0; gx < glyph.size; gx++) {
      const a = glyph.alpha[gy * glyph.size + gx] ?? 0;
      if (a === 0) continue;
      const i = ((gy + offset) * size + (gx + offset)) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width: size, height: size, data };
}

/**
 * Draws a coloured disc (same as createDotImage) with a white glyph centred on it.
 *
 * Kept free of DOM APIs so it is unit-testable; only the glyph mask needs a canvas.
 *
 * Args:
 *   diameter: Disc diameter in CSS pixels.
 *   fill: Disc colour as `#rrggbb`.
 *   glyph: Coverage mask rasterised at `glyphPixelSize(diameter, pixelRatio)`.
 *   pixelRatio: Device pixel ratio the bitmap is rendered for.
 *
 * Returns:
 *   RGBA bitmap of the same size as createDotImage would return.
 */
export function createIconImage(diameter: number, fill: string, glyph: GlyphMask, pixelRatio = 1): RgbaImage {
  const img = createDotImage(diameter, fill, pixelRatio);
  const offset = Math.floor((img.width - glyph.size) / 2);
  for (let gy = 0; gy < glyph.size; gy++) {
    for (let gx = 0; gx < glyph.size; gx++) {
      const a = (glyph.alpha[gy * glyph.size + gx] ?? 0) / 255;
      if (a === 0) continue;
      const x = gx + offset;
      const y = gy + offset;
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      // 白色圖案以覆蓋率疊在圓底上（反鋸齒邊緣自然混色）
      for (let c = 0; c < 3; c++) {
        const base = img.data[i + c] ?? 0;
        img.data[i + c] = Math.round(base + (255 - base) * a);
      }
      img.data[i + 3] = Math.max(img.data[i + 3] ?? 0, Math.round(255 * a));
    }
  }
  return img;
}

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
