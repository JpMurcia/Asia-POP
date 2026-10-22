import { PALETTE_KEYS, PALETTE_LABELS, isPaletteKey, type Template } from '../../../../backend/src/catalog/template';

/**
 * Colores del selector (feature 009): todo se calcula a partir de lo que la plantilla ya contiene; no se guarda nada.
 * El formato guardado no cambia: una clave de la paleta o `#RRGGBB` en mayúsculas.
 */
export interface ColorOption {
  /** Lo que se guardaría: clave de la paleta, `#RRGGBB`, `none` o `transparent`. */
  value: string;
  /** El color resuelto, `#RRGGBB` en mayúsculas (`null` para «Ninguno» y «Transparente»). */
  hex: string | null;
  /** Nombre visible: «Acento 1», «Rojo» o el propio código. */
  label: string;
  group: 'plantilla' | 'basico' | 'especial';
}

/** Colores básicos con nombre en español: un conjunto corto y fijo (no un diccionario de colores). */
export const BASIC_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Rojo', hex: '#E53935' },
  { name: 'Naranja', hex: '#FB8C00' },
  { name: 'Amarillo', hex: '#FDD835' },
  { name: 'Verde', hex: '#43A047' },
  { name: 'Azul', hex: '#1E88E5' },
  { name: 'Morado', hex: '#8E24AA' },
  { name: 'Rosado', hex: '#EC407A' },
  { name: 'Negro', hex: '#000000' },
  { name: 'Gris', hex: '#9E9E9E' },
  { name: 'Blanco', hex: '#FFFFFF' },
];

const HEX_TEXT = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Claves cuyo valor es texto libre y puede contener algo parecido a un código de color. */
const NOT_COLOR_KEYS = new Set(['text', 'name', 'id', 'src']);

/** `#RRGGBB` en mayúsculas desde `e91e8c`, `#E91E8C` o `#e91`; `null` si no es un código completo. */
export function normalizeHex(text: string): string | null {
  const m = HEX_TEXT.exec(text.trim());
  if (!m) return null;
  const digits = m[1]!.toUpperCase();
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return `#${full}`;
}

/** Minúsculas y sin tildes: la búsqueda por nombre no distingue mayúsculas ni diacríticos. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** El color de la paleta (`#RRGGBB` en mayúsculas) o `null` si `value` no es una clave de la paleta. */
function paletteHex(template: Pick<Template, 'palette'>, value: string): string | null {
  return isPaletteKey(value) ? (normalizeHex(template.palette[value]) ?? template.palette[value].toUpperCase()) : null;
}

/** El código en mayúsculas con que se compara y se muestra un valor guardado (clave de la paleta o `#RRGGBB`). */
export function hexOf(template: Pick<Template, 'palette'>, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return paletteHex(template, value) ?? normalizeHex(value);
}

function collect(value: unknown, found: Set<string>, key?: string): void {
  if (typeof value === 'string') {
    if (!key || !NOT_COLOR_KEYS.has(key)) {
      const hex = value.startsWith('#') ? normalizeHex(value) : null;
      if (hex) found.add(hex);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, found, key);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collect(v, found, k);
  }
}

/**
 * Los colores libres que usa la plantilla en cualquier página (fondo o elemento): `#RRGGBB` normalizados, sin repetir,
 * en orden de primer uso y sin los que coinciden con un color de la paleta (esos se muestran como el de la paleta).
 */
export function usedColors(template: Pick<Template, 'palette' | 'pages'>): string[] {
  const found = new Set<string>();
  for (const page of Object.values(template.pages)) {
    collect(page.bg, found);
    for (const el of page.els) collect(el, found);
  }
  const palette = new Set(PALETTE_KEYS.map((k) => paletteHex(template, k)));
  return [...found].filter((hex) => !palette.has(hex));
}

/** Las opciones del selector, en orden: los seis de la paleta, los libres usados, los básicos y, si procede, la especial. */
export function colorOptions(template: Pick<Template, 'palette' | 'pages'>, opts: { none?: 'none' | 'transparent' } = {}): ColorOption[] {
  const options: ColorOption[] = PALETTE_KEYS.map((k) => ({ value: k, hex: paletteHex(template, k), label: PALETTE_LABELS[k], group: 'plantilla' }));
  for (const hex of usedColors(template)) options.push({ value: hex, hex, label: hex, group: 'plantilla' });
  for (const c of BASIC_COLORS) options.push({ value: c.hex, hex: c.hex, label: c.name, group: 'basico' });
  if (opts.none) options.push({ value: opts.none, hex: null, label: opts.none === 'none' ? 'Ninguno' : 'Transparente', group: 'especial' });
  return options;
}

/** Filtra por nombre (o por el código escrito); las opciones especiales no entran en una búsqueda. */
export function searchColors(options: readonly ColorOption[], query: string): ColorOption[] {
  const q = foldText(query);
  if (!q) return [...options];
  const hex = normalizeHex(query);
  return options.filter((o) => o.group !== 'especial' && (foldText(o.label).includes(q) || (hex !== null && o.hex === hex)));
}
