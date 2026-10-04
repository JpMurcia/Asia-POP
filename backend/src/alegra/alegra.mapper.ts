import type { AlegraImageRaw, AlegraItemRaw } from './alegra.types';

/** Ítem de Alegra normalizado (aún sin resolver la imagen local). */
export interface NormalizedItem {
  id: string;
  name: string;
  description: string;
  price: number;
  /** La foto elegida (la primera candidata); `null` si Alegra no informa ninguna utilizable. */
  remoteImageUrl: string | null;
  /**
   * Todas las candidatas en orden de preferencia (favoritas primero). Si la elegida no se puede descargar se
   * prueban las siguientes. Ausente = solo `remoteImageUrl`.
   */
  imageUrls?: string[];
  soldOut: boolean;
  categoryId: string | null;
  categoryName: string | null;
  type: string;
}

/**
 * Regla de stock (FR-011): si el ítem controla inventario y la cantidad disponible es <= 0 está agotado.
 * Si no controla inventario, está disponible. Si controla pero Alegra no informa cantidad, no se afirma
 * que esté agotado.
 */
export function isSoldOut(raw: AlegraItemRaw): boolean {
  const inv = raw.inventory;
  const explicit = raw.trackInventory ?? inv?.trackInventory;
  const qty = inv?.availableQuantity ?? inv?.quantity;
  const tracked = explicit ?? (inv != null && qty != null);
  if (!tracked) return false;
  if (qty == null) return false;
  return qty <= 0;
}

/** Dirección web de una foto (texto suelto u objeto), o `null` si está vacía o no es http(s). */
function photoUrl(photo: string | AlegraImageRaw): string | null {
  const url = typeof photo === 'string' ? photo : (photo.url ?? photo.link ?? photo.src);
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Fotos utilizables de un ítem en orden de preferencia: las marcadas `favorite` primero (cada grupo en su orden
 * original) y después el resto. Alegra marca la principal con `favorite`, no con `isPrimary`, y en los productos con
 * varias fotos la favorita no suele ser la primera de la lista.
 */
export function extractImageUrls(raw: AlegraItemRaw): string[] {
  const favorites: string[] = [];
  const others: string[] = [];
  for (const photo of raw.images ?? []) {
    if (!photo) continue;
    const url = photoUrl(photo);
    if (!url) continue;
    (typeof photo === 'object' && photo.favorite === true ? favorites : others).push(url);
  }
  return [...new Set([...favorites, ...others])];
}

/** La foto elegida: la primera de `extractImageUrls`. */
export function extractImageUrl(raw: AlegraItemRaw): string | null {
  return extractImageUrls(raw)[0] ?? null;
}

export function extractPrice(raw: AlegraItemRaw): number {
  const p = raw.price;
  if (typeof p === 'number') return p;
  if (Array.isArray(p) && p.length > 0) {
    const preferred = p.find((x) => String(x.idPriceList) === '1') ?? p[0];
    return typeof preferred?.price === 'number' ? preferred.price : 0;
  }
  return 0;
}

export function mapAlegraItem(raw: AlegraItemRaw): NormalizedItem {
  const imageUrls = extractImageUrls(raw);
  return {
    id: String(raw.id),
    name: raw.name?.trim() ?? '',
    description: raw.description?.trim() ?? '',
    price: extractPrice(raw),
    remoteImageUrl: imageUrls[0] ?? null,
    imageUrls,
    soldOut: isSoldOut(raw),
    categoryId: raw.category?.id != null && raw.category.id !== '' ? String(raw.category.id) : null,
    categoryName: raw.category?.name ?? null,
    type: raw.type ?? 'simple',
  };
}
