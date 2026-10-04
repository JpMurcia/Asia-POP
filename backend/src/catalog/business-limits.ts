/**
 * Límites de los datos del negocio y su validación. Módulo PURO (sin Node): lo comparten el esquema del servidor
 * (`business.routes.ts`) y el editor, que con ellos avisa y deshabilita Guardar antes de pedir un `422`.
 */
import type { BusinessSettings, Term } from './types';

export const BUSINESS_LIMITS = {
  storeName: 80,
  phone: 30,
  address: 160,
  coverTitle: 80,
  terms: 10,
  termTitle: 80,
  termBody: 1200,
  /** Total de caracteres de las políticas: más que esto no cabe en la página final del PDF. */
  termsChars: 3500,
} as const;

export interface BusinessIssue {
  /** Mismo nombre de campo que usa el servidor en `details` (`coverTitle`, `terms`, `terms[1].title`…). */
  field: string;
  message: string;
}

/** Caracteres de las políticas que cuentan para el límite (los textos, sin los espacios de los extremos). */
export const termsChars = (terms: readonly Term[]): number => terms.reduce((n, t) => n + t.body.trim().length, 0);

/**
 * Lo que el servidor rechazaría con `422 invalid_business`: cada regla replica la de `businessSchema`
 * (`trim()` y luego mínimo y máximo), de modo que el editor y el servidor nunca discrepan.
 */
export function businessIssues(b: BusinessSettings): BusinessIssue[] {
  const out: BusinessIssue[] = [];
  const L = BUSINESS_LIMITS;
  const required = (field: string, label: string, value: string, max: number) => {
    const n = value.trim().length;
    if (n === 0) out.push({ field, message: `${label} no puede estar vacío.` });
    else if (n > max) out.push({ field, message: `${label}: máximo ${max} caracteres.` });
  };
  const optional = (field: string, label: string, value: string, max: number) => {
    if (value.trim().length > max) out.push({ field, message: `${label}: máximo ${max} caracteres.` });
  };

  required('storeName', 'El nombre de la tienda', b.storeName, L.storeName);
  required('coverTitle', 'El texto del banner', b.coverTitle, L.coverTitle);
  optional('phone1', 'El teléfono 1', b.phone1, L.phone);
  optional('phone2', 'El teléfono 2', b.phone2, L.phone);
  optional('address', 'La dirección', b.address, L.address);

  if (b.terms.length > L.terms) out.push({ field: 'terms', message: `Máximo ${L.terms} políticas.` });
  b.terms.forEach((t, i) => {
    required(`terms[${i}].title`, `El título de la política ${i + 1}`, t.title, L.termTitle);
    optional(`terms[${i}].body`, `El texto de la política ${i + 1}`, t.body, L.termBody);
  });
  if (termsChars(b.terms) > L.termsChars) {
    out.push({
      field: 'terms',
      message: `Las políticas no pueden superar ${L.termsChars} caracteres en total (no caben en una página).`,
    });
  }
  return out;
}
