/**
 * Copias reducidas de las fotos de un catálogo (feature 005). Módulo PURO: lista las fotos locales de un payload y
 * devuelve otro con las direcciones reemplazadas, sin tocar nada más (FR-005: el diseño, los textos, los precios y
 * las indicaciones AGOTADO son idénticos en ambas calidades).
 */
import type { CatalogItem, CatalogPayload } from '../catalog/types';

/** Dirección local original de una foto → dirección local de su copia reducida. */
export type PhotoVariants = Map<string, string>;

/** Fotos que se pueden reducir: las de Alegra descargadas y las que subió la persona. */
const LOCAL_PHOTO = /^\/media\/(?:cache|uploads)\//;

const isLocalPhoto = (url: unknown): url is string => typeof url === 'string' && LOCAL_PHOTO.test(url);

/** Las direcciones locales de las fotos del payload, sin repetir. */
export function collectPhotoUrls(payload: CatalogPayload): string[] {
  const urls = new Set<string>();
  for (const section of payload.sections) {
    for (const page of section.pages) {
      for (const item of page) if (isLocalPhoto(item.imageUrl)) urls.add(item.imageUrl);
    }
  }
  return [...urls];
}

/** Un payload nuevo en el que solo cambia `imageUrl` de los ítems que tienen copia. No muta el original. */
export function withPhotoVariants(payload: CatalogPayload, variants: PhotoVariants): CatalogPayload {
  if (variants.size === 0) return payload;
  const swap = (item: CatalogItem): CatalogItem => {
    const copy = variants.get(item.imageUrl);
    return copy ? { ...item, imageUrl: copy } : item;
  };
  return {
    ...payload,
    sections: payload.sections.map((section) => ({ ...section, pages: section.pages.map((page) => page.map(swap)) })),
  };
}
