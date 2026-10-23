import type { CSSProperties } from 'react';
import { TEXT_EFFECT_DEFAULTS, resolveColor, type Palette, type TextEl } from '../../../backend/src/catalog/template';

/**
 * Sombra y fondo del texto (feature 011). Funciones puras que arman el CSS; el lienzo, las miniaturas, la vista
 * previa y el PDF las comparten a través de `TemplateElement` (constitución IV). Las medidas en px se escalan con
 * `--fit`, igual que el grosor del contorno, para que un texto reducido por `FitText` conserve la proporción.
 */

const px = (n: number) => `calc(${n}px * var(--fit, 1))`;

/** `#RRGGBB` (o `#RGB`) con su transparencia en porcentaje; cualquier otra cosa se dibuja como `transparent`. */
export function withAlpha(color: string, pct: number): string {
  let h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!h) return 'transparent';
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = Math.round(Math.min(100, Math.max(0, pct))) / 100;
  return `rgba(${r},${g},${b},${a})`;
}

/** Valor de `text-shadow` de la sombra, o `undefined` si el texto no la tiene activa. */
export function shadowCss(el: TextEl, palette: Palette): string | undefined {
  if (!el.shadow) return undefined;
  const d = TEXT_EFFECT_DEFAULTS;
  const dist = el.shDist ?? d.shDist;
  const rad = ((el.shAngle ?? d.shAngle) * Math.PI) / 180;
  // Redondeado a 2 decimales para que 90° dé 0 y no 6e-16
  const dx = Math.round(dist * Math.cos(rad) * 100) / 100;
  const dy = Math.round(dist * Math.sin(rad) * 100) / 100;
  const color = withAlpha(resolveColor(palette, el.shColor ?? d.shColor), el.shAlpha ?? d.shAlpha);
  return `${px(dx)} ${px(dy)} ${px(el.shBlur ?? d.shBlur)} ${color}`;
}

/** Estilo del `<span>` de fondo, o `undefined` si el texto no lo tiene activo. Solo relleno horizontal: el vertical lo da la línea. */
export function bgStyle(el: TextEl, palette: Palette): CSSProperties | undefined {
  if (!el.bg) return undefined;
  const d = TEXT_EFFECT_DEFAULTS;
  return {
    backgroundColor: withAlpha(resolveColor(palette, el.bgColor ?? d.bgColor), el.bgAlpha ?? d.bgAlpha),
    padding: `0 ${px(el.bgPad ?? d.bgPad)}`,
    borderRadius: px(el.bgRadius ?? d.bgRadius),
    // Cada línea de un texto de varias lleva su propio fondo, con relleno y esquinas completos
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
}
