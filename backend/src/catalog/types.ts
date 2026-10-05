/**
 * Tipos del catálogo. Este archivo NO debe importar nada de Node: el frontend lo importa solo como tipos.
 */

import type { Template } from './template';

/** Datos del negocio que se guardan y editan en `/settings/business`. */
export interface BusinessInfo {
  storeName: string;
  phone1: string;
  phone2: string;
  address: string;
  coverTitle: string;
}

/** Configuración que viaja en el payload: los datos del negocio (`coverTitle` ya incluye el banner de la generación). */
export type CatalogConfig = BusinessInfo;

export interface Term {
  title: string;
  body: string;
}

/** Datos del negocio con sus políticas: lo que guardan `/settings/business` y `/settings/templates`. */
export interface BusinessSettings extends BusinessInfo {
  terms: Term[];
}

export interface AlegraCatalogItem {
  kind: 'alegra';
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  imageUrl: string;
  soldOut: boolean;
}

export interface CustomCatalogItem {
  kind: 'custom';
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  priceLabel?: string;
  options?: { label: string; priceLabel: string; maxFlavors?: number }[];
  flavors?: string[];
}

export interface BundleCatalogItem {
  kind: 'bundle';
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  priceLabel: string;
  components: { name: string; quantity: number }[];
  soldOut: boolean;
}

export type CatalogItem = AlegraCatalogItem | CustomCatalogItem | BundleCatalogItem;

export interface CatalogSectionPayload {
  key: string;
  name: string;
  source: 'alegra' | 'custom';
  introText?: string;
  pages: CatalogItem[][];
}

export interface CatalogPayload {
  config: CatalogConfig;
  /** La plantilla elegida, completa: se resuelve al construir y `GET /catalog/payload/:id` la refresca. */
  template: Template;
  sections: CatalogSectionPayload[];
  terms: Term[];
  generatedAt: string;
}

export interface OmittedItem {
  source: 'alegra' | 'custom' | 'bundle';
  id: string;
  name: string;
}

/** Por qué no se pudo obtener una foto que Alegra sí informa (la lista de códigos y textos: `photo-reasons.ts`). */
export type PhotoFailureReason =
  | 'unauthorized'
  | 'not_found'
  | 'timeout'
  | 'not_image'
  | 'unsupported_format'
  | 'too_large'
  | 'unavailable';

export interface SoldOutBundle {
  bundleId: string;
  name: string;
  soldOutComponents: string[];
}

/** Producto de Alegra con foto informada cuya foto no se pudo obtener, con el motivo (nunca la dirección de la foto). */
export interface PhotoNotObtained {
  id: string;
  name: string;
  reason: PhotoFailureReason;
}

/** Estado de las fotos de Alegra en una preparación. */
export interface PhotoReport {
  /** Productos activos (sin padres de variantes) para los que Alegra informó al menos una foto. */
  informed: number;
  /** De esos, los que tienen una copia local utilizable. */
  obtained: number;
  /** Solo los de las secciones seleccionadas; cada uno también está en `omittedNoImage`. */
  notObtained: PhotoNotObtained[];
  /** Hay fotos informadas y ninguna se pudo obtener: probable problema general, no de cada producto. */
  allFailed: boolean;
}

export interface ReviewReport {
  uncategorized: { itemId: string; name: string }[];
  /** Todos los omitidos por no tener foto utilizable (incluye los de `photos.notObtained`). */
  omittedNoImage: OmittedItem[];
  omittedNoSection: { itemId: string; name: string }[];
  /**
   * Omitidos por decisión de la persona (feature 006): todos los artículos activos de Alegra que marcó, estén o no en
   * las secciones elegidas. Aparte de los omitidos por un problema: no suman a `counts.omitted`.
   */
  omittedByChoice: { itemId: string; name: string }[];
  soldOutBundles: SoldOutBundle[];
  counts: { included: number; omitted: number; soldOut: number };
  emptyCatalog: boolean;
  photos: PhotoReport;
}

export type BundleDecision = 'keep' | 'omit';

/** Opciones de una generación; se guardan en la preparación y pueden cambiar sin consultar Alegra. */
export interface GenerationOptions {
  /** `undefined` = todas las secciones disponibles. */
  sectionKeys?: string[];
  hideSoldOut: boolean;
  /** Máx. 80 caracteres; vacío o ausente = `coverTitle` guardado. No se persiste. */
  bannerText?: string;
  /** Plantilla de esta generación; ausente = la predeterminada. Si ya no existe se usa la predeterminada. */
  templateId?: string;
}

/** Sección con contenido elegible, calculada antes de aplicar `sectionKeys`. */
export interface AvailableSection {
  key: string;
  name: string;
  source: 'alegra' | 'custom';
  items: number;
}

export interface CatalogStructure {
  coverPages: number;
  sectionCoverPages: number;
  productPages: number;
  termsPages: number;
  /** Productos propios y combos incluidos. */
  ownItems: number;
  totalPages: number;
  /** `true` si no hay secciones incluidas; entonces todos los conteos son 0. */
  nothingToGenerate: boolean;
  sections: { key: string; name: string; source: 'alegra' | 'custom'; items: number; pages: number }[];
}

export type AlegraStatus = 'ok' | 'unreachable' | 'not_configured';

export interface PanelSummary {
  /** `message` explica por qué Alegra no está disponible (credenciales rechazadas, sin conexión...). */
  alegra: {
    status: AlegraStatus;
    email?: string;
    lastTestedAt?: string | null;
    message?: string;
    /** Instante (ISO 8601) de la lectura de Alegra que llenó la caché; solo con `status: 'ok'`. */
    syncedAt?: string;
  };
  /** `null` si Alegra no respondió. */
  stats: {
    /** Productos activos en Alegra: es un dato de Alegra y NO baja al omitir artículos. */
    products: number;
    /** Agotados entre los que no se omitieron (los que saldrán con la indicación). */
    soldOut: number;
    uncategorized: number;
    estimatedPages: number;
    /** Artículos omitidos por la persona que hoy están activos en Alegra (feature 006). */
    omitted: number;
  } | null;
  sections: { key: string; name: string; source: 'alegra' | 'custom'; items: number; soldOut: number }[] | null;
  /** Siempre del historial local, sin caché. */
  lastCatalog: { id: string; createdAt: string; includedCount: number; omittedCount: number; pages?: number } | null;
  generatedAt: string;
}
