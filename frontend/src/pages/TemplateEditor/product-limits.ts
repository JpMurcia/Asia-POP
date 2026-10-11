import {
  PAGE_H,
  PAGE_W,
  PRODUCTS_ZONE_MIN,
  RANGES,
  type ProductsEl,
} from '../../../../backend/src/catalog/template';
import { photoScaleLimits } from '../../../../backend/src/catalog/template-layout';

/**
 * Límites del tamaño de los productos (feature 007): el reductor del editor recorta con ellos y el inspector explica
 * por qué. Los textos están aquí para que ambos digan exactamente lo mismo.
 */

export const ZONE_MIN_MESSAGE = `La zona de productos debe medir al menos ${PRODUCTS_ZONE_MIN.w} % de ancho y ${PRODUCTS_ZONE_MIN.h} % de alto.`;
export const photoWidthMessage = (max: number) =>
  `El ancho máximo de la foto en esta zona es ${max} %. Agranda la zona para darle más espacio.`;
export const photoHeightMessage = (max: number) =>
  `El alto máximo de la foto en esta zona es ${max} %. Agranda el alto de la zona para darle más espacio.`;

type SizedBlock = Pick<ProductsEl, 'layout' | 'w' | 'h' | 'nameStyle'>;

/** Máximo de la foto (en %) para la zona, la distribución y el estilo de nombre actuales del bloque. */
export function productLimits(el: SizedBlock): { w: number; h: number } {
  const lim = photoScaleLimits(el.layout, (el.w / 100) * PAGE_W, (el.h / 100) * PAGE_H, { nameStyle: el.nameStyle });
  return { w: lim.w[1], h: lim.h[1] };
}

/**
 * Las notas que el inspector muestra bajo los campos de tamaño, según lo guardado: la de la zona cuando está en su
 * mínimo y la de la foto cuando alcanza (o supera, si se cambió la zona después) el máximo que cabe. Vacías si no
 * hay nada que explicar.
 */
export function productNotes(el: ProductsEl): { zone: string; photo: string } {
  const zone = el.w <= PRODUCTS_ZONE_MIN.w || el.h <= PRODUCTS_ZONE_MIN.h ? ZONE_MIN_MESSAGE : '';
  const max = productLimits(el);
  const photo = [
    el.photoW >= max.w && max.w < RANGES.photoScale[1] ? photoWidthMessage(max.w) : '',
    el.photoH >= max.h && max.h < RANGES.photoScale[1] ? photoHeightMessage(max.h) : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { zone, photo };
}
