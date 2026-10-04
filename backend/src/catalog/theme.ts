/**
 * Utilidades de color compartidas por el esquema de plantillas, las advertencias de contraste y el editor.
 * Módulo PURO: no debe importar nada de Node, porque el frontend también lo usa.
 *
 * El tema de cuatro colores de la feature 002 lo reemplazó la paleta de seis colores de cada plantilla
 * (`template.ts`); aquí solo quedan las dos funciones que siguen haciendo falta.
 */

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Solo `#RRGGBB`: sin `#RGB`, nombres ni transparencia. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Relación de contraste WCAG entre dos colores `#RRGGBB` (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
