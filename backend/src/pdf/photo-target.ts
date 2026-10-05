/**
 * Resolución objetivo de las fotos del PDF (feature 005, FR-004). Módulo PURO: se calcula desde la plantilla de la
 * generación y no desde un tamaño fijo, porque el editor permite agrandar el bloque de productos.
 */
import { PAGE_H, PAGE_W, type Template } from '../catalog/template';
import { layoutRows } from '../catalog/template-layout';

/** Puntos por pulgada mínimos al tamaño impreso de la foto. */
export const PDF_PPP = 150;

/** Píxeles que debe cubrir una foto para llegar a `PDF_PPP` en su recuadro. */
export interface PhotoTarget {
  w: number;
  h: number;
}

/** La página lógica mide 595,28 unidades de ancho sobre 210 mm: 1 unidad = 1/72 de pulgada. */
const pixels = (units: number): number => Math.ceil((units * PDF_PPP) / 72);

/**
 * El mayor ancho y el mayor alto de los recuadros de foto de los bloques de productos visibles de la página
 * «Productos». `null` si no hay ninguno: no hay fotos que dibujar y nada que reducir.
 */
export function photoTarget(template: Template): PhotoTarget | null {
  let w = 0;
  let h = 0;
  let found = false;
  for (const el of template.pages.productos.els) {
    if (el.type !== 'products' || !el.visible) continue;
    found = true;
    for (const row of layoutRows(el.layout, (el.w / 100) * PAGE_W, (el.h / 100) * PAGE_H)) {
      w = Math.max(w, row.photo.w);
      h = Math.max(h, row.photo.h);
    }
  }
  return found ? { w: pixels(w), h: pixels(h) } : null;
}
