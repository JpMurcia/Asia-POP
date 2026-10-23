import type { CSSProperties } from 'react';
import { TEXT_EFFECT_DEFAULTS, resolveColor, type Palette, type TextEl } from '../../../backend/src/catalog/template';

/**
 * Efectos del texto (features 011 y 012). Funciones puras que arman el CSS; el lienzo, las miniaturas, la vista
 * previa y el PDF las comparten a través de `TemplateElement` (constitución IV). Las medidas en px de los efectos
 * nuevos se escalan con `--fit`, igual que el grosor del contorno, para que un texto reducido por `FitText`
 * conserve la proporción.
 */

const px = (n: number) => `calc(${n}px * var(--fit, 1))`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** `#RRGGBB` (o `#RGB`) con su transparencia en porcentaje; cualquier otra cosa se dibuja como `transparent`. */
export function withAlpha(color: string, pct: number): string {
  let h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!h) return 'transparent';
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = Math.round(Math.min(100, Math.max(0, pct))) / 100;
  return `rgba(${r},${g},${b},${a})`;
}

/** Una capa de sombra: su valor para `text-shadow` y sus números, para dibujarla también con `drop-shadow` (texto curvo). */
export interface ShadowEntry {
  css: string;
  dx: number;
  dy: number;
  blur: number;
  color: string;
}

/** Entrada con medidas escaladas con `--fit`. */
function scaled(dx: number, dy: number, blur: number, color: string): ShadowEntry {
  return { css: `${px(dx)} ${px(dy)} ${px(blur)} ${color}`, dx, dy, blur, color };
}

/** Sombra de la feature 011 (una sola capa), o `undefined` si no está activa. */
function shadowEntry(el: TextEl, palette: Palette): ShadowEntry | undefined {
  if (!el.shadow) return undefined;
  const d = TEXT_EFFECT_DEFAULTS;
  const dist = el.shDist ?? d.shDist;
  const rad = ((el.shAngle ?? d.shAngle) * Math.PI) / 180;
  // Redondeado a 2 decimales para que 90° dé 0 y no 6e-16
  const dx = round2(dist * Math.cos(rad));
  const dy = round2(dist * Math.sin(rad));
  const color = withAlpha(resolveColor(palette, el.shColor ?? d.shColor), el.shAlpha ?? d.shAlpha);
  return scaled(dx, dy, el.shBlur ?? d.shBlur, color);
}

/** Valor de `text-shadow` de la sombra sola (feature 011), o `undefined` si el texto no la tiene activa. */
export function shadowCss(el: TextEl, palette: Palette): string | undefined {
  return shadowEntry(el, palette)?.css;
}

/**
 * Todas las capas de sombra del texto, de atrás hacia delante, en un orden fijo:
 * resplandor neón → brillo → eco → desalineado → distorsión → sombra.
 * El resplandor neón conserva su valor de siempre (`0 0 10px c, 0 0 24px c`) para que los PDF existentes no cambien.
 */
export function shadowList(el: TextEl, palette: Palette): ShadowEntry[] {
  const d = TEXT_EFFECT_DEFAULTS;
  const out: ShadowEntry[] = [];
  const glow = resolveColor(palette, el.glow);
  if (glow !== 'transparent') {
    out.push({ css: `0 0 10px ${glow}`, dx: 0, dy: 0, blur: 10, color: glow });
    out.push({ css: `0 0 24px ${glow}`, dx: 0, dy: 0, blur: 24, color: glow });
  }
  const c1 = resolveColor(palette, el.fxColor ?? d.fxColor);
  const c2 = resolveColor(palette, el.fxColor2 ?? d.fxColor2);
  const dist = el.fxDist ?? d.fxDist;
  if (el.bright) {
    const i = el.fxI ?? d.fxI;
    out.push(scaled(0, 0, round2(i * 0.3), c1), scaled(0, 0, round2(i * 0.6), c1));
  }
  if (el.echo) {
    // Tres copias hacia abajo y a la derecha, cada vez más lejos y más tenues
    for (const [k, pct] of [[1, 60], [2, 40], [3, 20]] as const) out.push(scaled(dist * k, dist * k, 0, withAlpha(c1, pct)));
  }
  if (el.misalign) {
    out.push(scaled(dist, dist, 0, withAlpha(c1, 60)), scaled(-dist, -dist, 0, withAlpha(c1, 60)));
  }
  if (el.glitch) {
    out.push(scaled(dist, 0, 0, c1), scaled(-dist, 0, 0, c2));
  }
  const shadow = shadowEntry(el, palette);
  if (shadow) out.push(shadow);
  return out;
}

/** Valor completo de `text-shadow`, o `undefined` si el texto no tiene ninguna capa. */
export function textShadowOf(el: TextEl, palette: Palette): string | undefined {
  const list = shadowList(el, palette);
  return list.length > 0 ? list.map((e) => e.css).join(', ') : undefined;
}

/** `filter` equivalente para texto SVG (curvar), donde `text-shadow` no se aplica de forma fiable. */
export function dropShadowFilter(list: readonly ShadowEntry[]): string | undefined {
  return list.length > 0 ? list.map((e) => `drop-shadow(${round2(e.dx)}px ${round2(e.dy)}px ${round2(e.blur / 2)}px ${e.color})`).join(' ') : undefined;
}

/**
 * «Sin relleno» (feature 012): relleno transparente y borde de las letras. Si el texto no tiene contorno, el borde
 * usa el color del texto con 2 px. Devuelve solo lo que cambia; `undefined` si el efecto no está activo.
 */
export function hollowStyle(el: TextEl, palette: Palette): CSSProperties | undefined {
  if (!el.hollow) return undefined;
  const stroke = resolveColor(palette, el.stroke);
  const edge = stroke !== 'transparent' && el.strokeW > 0 ? stroke : resolveColor(palette, el.color);
  const width = el.strokeW > 0 && stroke !== 'transparent' ? el.strokeW : 2;
  return { color: 'transparent', WebkitTextStroke: `${px(width)} ${edge}` };
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
