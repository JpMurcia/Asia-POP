import type { FontKey, FontRef, ImageKey, Template } from '../../../backend/src/catalog/template';
import collage from '../assets/print/collage.png';
import coverbg from '../assets/print/cover-bg.jpg';
import frame from '../assets/print/frame.png';
import logo from '../assets/print/logo.png';
import marble from '../assets/print/marble.jpg';
import soldOut from '../assets/print/sold-out.png';

/** Las cinco imágenes que ofrece el editor (subir imágenes propias queda fuera de esta versión). */
export const IMAGES: Record<ImageKey, string> = { logo, collage, marble, coverbg, frame };

/** Sello AGOTADO de Cat.pdf. */
export const SOLD_OUT_SEAL = soldOut;

/** Pilas tipográficas de las seis familias (todas locales: `fonts.css`). */
export const FONT_STACKS: Record<FontKey, string> = {
  fredoka: "'Fredoka', sans-serif",
  poppins: "'Poppins', sans-serif",
  bungee: "'Bungee', sans-serif",
  zen: "'Zen Maru Gothic', sans-serif",
  grotesk: "'Space Grotesk', sans-serif",
  serif: "'DM Serif Display', serif",
};

/** Nombre CSS de cada familia, para `document.fonts.load`. */
export const FONT_FAMILIES: Record<FontKey, string> = {
  fredoka: 'Fredoka',
  poppins: 'Poppins',
  bungee: 'Bungee',
  zen: 'Zen Maru Gothic',
  grotesk: 'Space Grotesk',
  serif: 'DM Serif Display',
};

/** Pesos que `fonts.css` importa de cada familia. */
const AVAILABLE_WEIGHTS: Record<FontKey, readonly number[]> = {
  fredoka: [400, 500, 600, 700],
  poppins: [400, 500, 600, 700],
  zen: [400, 500, 700, 900],
  grotesk: [400, 500, 700],
  bungee: [400],
  serif: [400],
};

/** La familia que corresponde a `title`, `body` o una clave concreta. */
export function fontKeyOf(template: Pick<Template, 'fonts'>, ref: FontRef): FontKey {
  if (ref === 'title') return template.fonts.title;
  if (ref === 'body') return template.fonts.body;
  return ref;
}

export function fontFamily(template: Pick<Template, 'fonts'>, ref: FontRef): string {
  return FONT_STACKS[fontKeyOf(template, ref)];
}

/** El peso disponible más cercano al pedido (en un empate, el más grueso): "Semi" (600) no existe en todas. */
export function weightFor(font: FontKey, weight: number): number {
  const options = AVAILABLE_WEIGHTS[font];
  return options.reduce((best, w) => {
    const d = Math.abs(w - weight);
    const bd = Math.abs(best - weight);
    return d < bd || (d === bd && w > best) ? w : best;
  }, options[0]!);
}
