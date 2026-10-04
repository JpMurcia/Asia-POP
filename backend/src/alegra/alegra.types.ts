/**
 * Tipos crudos de la API de Alegra. Los IDs se tratan como texto opaco (Alegra cambió su formato de ID).
 * Campos marcados "tolerante": aceptan más de una forma. La forma de las fotos (`images`) se verificó con la
 * cuenta real el 4-oct-2026: ver specs/004-fix-alegra-images/contracts/alegra-item-photos.md.
 */
export type AlegraId = string | number;

export interface AlegraCategoryRaw {
  id: AlegraId;
  name: string;
  status?: string;
  parent?: { id: AlegraId } | null;
}

export interface AlegraInventoryRaw {
  quantity?: number | null;
  availableQuantity?: number | null;
  trackInventory?: boolean;
}

export interface AlegraPriceRaw {
  idPriceList?: AlegraId;
  price?: number;
  name?: string;
}

/**
 * Foto de un ítem. Forma real: `{ id, name, url, favorite }`, con `url` https firmada del CDN de Alegra.
 * No existe `isPrimary`: la foto principal se marca con `favorite`. `link` y `src` se toleran por compatibilidad.
 */
export interface AlegraImageRaw {
  id?: AlegraId;
  name?: string;
  url?: string;
  link?: string;
  src?: string;
  favorite?: boolean;
}

export interface AlegraItemRaw {
  id: AlegraId;
  name: string;
  description?: string | null;
  status?: string;
  type?: string; // simple | kit | variantParent | variant
  category?: { id: AlegraId; name?: string } | null;
  /** Tolerante: número, o lista de precios. */
  price?: number | AlegraPriceRaw[] | null;
  /** Tolerante: texto suelto (una URL) u objeto de foto. */
  images?: Array<string | AlegraImageRaw> | null;
  inventory?: AlegraInventoryRaw | null;
  trackInventory?: boolean;
}

export type AlegraErrorKind = 'rejected' | 'rate_limit' | 'unreachable' | 'http';

export class AlegraError extends Error {
  constructor(
    public kind: AlegraErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
