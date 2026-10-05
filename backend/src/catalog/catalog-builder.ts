import type { NormalizedItem } from '../alegra/alegra.mapper';
import { computeBundlePrice, type BundlePricing } from './bundle-pricing';
import { formatCop } from './price-format';
import type { Template } from './template';
import { baseTemplate } from './template-presets';
import type {
  AvailableSection,
  BundleDecision,
  BusinessInfo,
  CatalogItem,
  CatalogPayload,
  CatalogSectionPayload,
  OmittedItem,
  PhotoFailureReason,
  PhotoNotObtained,
  ReviewReport,
  SoldOutBundle,
  Term,
} from './types';

export const ITEMS_PER_PAGE = 3;
const NOT_AVAILABLE = 'Producto no disponible';

export interface BuilderCategory {
  id: string;
  name: string;
}

export interface CustomProductInput {
  id: string;
  name: string;
  description: string;
  /** URL local de la imagen; null = sin imagen (se omite). */
  imageUrl: string | null;
  price: number | null;
  options?: { label: string; price: number; maxFlavors?: number | null }[];
  flavors?: string[];
}

export interface CustomSectionInput {
  /** `custom:<id>` */
  key: string;
  name: string;
  introText?: string | null;
  products: CustomProductInput[];
}

export interface BundleBuilderInput {
  id: string;
  /** `custom:<id>`: sección propia donde aparece el combo. */
  sectionKey: string;
  name: string;
  description: string;
  imageUrl: string | null;
  pricing: BundlePricing;
  components: { source: 'alegra' | 'custom'; productId: string; quantity: number }[];
}

export interface BuilderInput {
  config: BusinessInfo;
  /** Plantilla con la que se dibuja el catálogo; sin plantilla se usa Neón Noche de fábrica. */
  template?: Template;
  /** Texto del banner de portada para esta generación; vacío o ausente = `config.coverTitle`. */
  bannerText?: string;
  bundles?: BundleBuilderInput[];
  /** Decisión del usuario por combo con componentes agotados. Sin decisión se muestra con sello (vista previa). */
  decisions?: Record<string, BundleDecision>;
  /** Secciones propias (mochis, regalos...). Existen aunque estén vacías, para poder recibir asignaciones. */
  customSections?: CustomSectionInput[];
  terms: Term[];
  categories: BuilderCategory[];
  items: NormalizedItem[];
  /** Mapa itemId -> URL local de la imagen ya descargada (ausente o null = sin imagen). */
  localImages: Map<string, string | null>;
  /**
   * itemId -> por qué no se pudo obtener la foto que Alegra sí informa. Ausente = sin motivos (el panel de Inicio no
   * descarga fotos): ningún producto se informa como "foto no obtenida".
   */
  photoFailures?: Map<string, PhotoFailureReason>;
  /** Asignaciones locales para ítems sin categoría: itemId -> sectionKey. */
  overrides: Map<string, string>;
  /** Artículos de Alegra que la persona omitió. Ausente o vacío = el comportamiento de siempre. */
  omittedIds?: Set<string>;
  /** Orden de secciones (claves `alegra:<id>` / `custom:<id>`). Las que no estén van al final por nombre. */
  sectionOrder: string[];
  /** Si se indica, solo se incluyen estas secciones. */
  sectionKeys?: string[];
  hideSoldOut?: boolean;
  generatedAt?: string;
}

export interface BuildResult {
  payload: CatalogPayload;
  report: ReviewReport;
  /** Secciones con contenido elegible, calculadas antes de aplicar `sectionKeys`. */
  availableSections: AvailableSection[];
}

/** Entrada del informe asociada a la sección donde habría aparecido. */
interface Tagged<T> {
  sectionKey: string;
  entry: T;
}

/** Divide una lista en bloques de máximo `size` elementos. */
export function chunk<T>(list: T[], size = ITEMS_PER_PAGE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

interface Bucket {
  key: string;
  name: string;
  source: 'alegra' | 'custom';
  introText?: string;
  items: CatalogItem[];
  /** Las secciones propias respetan el orden indicado por el usuario; las de Alegra se ordenan por nombre. */
  keepOrder?: boolean;
}

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

export function buildCatalog(input: BuilderInput): BuildResult {
  const buckets = new Map<string, Bucket>();
  const ensure = (key: string, name: string): Bucket => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, name, source: 'alegra', items: [] };
      buckets.set(key, b);
    }
    return b;
  };
  for (const c of input.categories) ensure(`alegra:${c.id}`, c.name);

  const omittedCustomNoImage: Tagged<OmittedItem>[] = [];
  for (const cs of input.customSections ?? []) {
    const bucket: Bucket = {
      key: cs.key,
      name: cs.name,
      source: 'custom',
      introText: cs.introText ?? undefined,
      items: [],
      keepOrder: true,
    };
    buckets.set(cs.key, bucket);
    for (const p of cs.products) {
      if (!p.imageUrl) {
        omittedCustomNoImage.push({ sectionKey: cs.key, entry: { source: 'custom', id: p.id, name: p.name } });
        continue;
      }
      bucket.items.push({
        kind: 'custom',
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        priceLabel: p.price != null ? formatCop(p.price) : undefined,
        options: p.options?.map((o) => ({
          label: o.label,
          priceLabel: formatCop(o.price),
          maxFlavors: o.maxFlavors ?? undefined,
        })),
        flavors: p.flavors && p.flavors.length ? p.flavors : undefined,
      });
    }
  }

  const uncategorized: ReviewReport['uncategorized'] = [];
  const omittedNoImage: Tagged<OmittedItem>[] = [];
  const photoNotObtained: Tagged<PhotoNotObtained>[] = [];
  const omittedNoSection: ReviewReport['omittedNoSection'] = [];

  // Artículos que la persona decidió dejar fuera (feature 006, FR-005/FR-006). La omisión se aplica DENTRO de este
  // bucle y no filtrando `input.items`: los combos siguen resolviendo todos sus componentes con los datos de Alegra.
  const omitted = input.omittedIds ?? new Set<string>();
  const omittedByChoice: ReviewReport['omittedByChoice'] = [];

  for (const it of input.items) {
    // Los padres de variantes se ignoran: sus variantes llegan como ítems propios.
    if (it.type === 'variantParent') continue;
    // Un omitido no se clasifica ni se reporta de ninguna otra forma (sin categoría, sin foto, agotado...); solo se
    // informa aparte como omitido por decisión de la persona (FR-008).
    if (omitted.has(it.id)) {
      omittedByChoice.push({ itemId: it.id, name: it.name });
      continue;
    }

    let sectionKey: string | null = null;
    if (it.categoryId) {
      sectionKey = `alegra:${it.categoryId}`;
      if (!buckets.has(sectionKey) && it.categoryName) ensure(sectionKey, it.categoryName);
    } else {
      uncategorized.push({ itemId: it.id, name: it.name });
      const override = input.overrides.get(it.id);
      if (override && buckets.has(override)) sectionKey = override;
      else omittedNoSection.push({ itemId: it.id, name: it.name });
    }
    if (!sectionKey) continue;

    const image = input.localImages.get(it.id) ?? null;
    if (!image) {
      // Sin foto utilizable queda fuera del PDF (principio II); si Alegra sí informó una foto, además se dice por qué
      omittedNoImage.push({ sectionKey, entry: { source: 'alegra', id: it.id, name: it.name } });
      const reason = input.photoFailures?.get(it.id);
      if (reason) photoNotObtained.push({ sectionKey, entry: { id: it.id, name: it.name, reason } });
      continue;
    }
    if (it.soldOut && input.hideSoldOut) continue;

    buckets.get(sectionKey)!.items.push({
      kind: 'alegra',
      id: it.id,
      name: it.name,
      description: it.description,
      priceLabel: formatCop(it.price),
      imageUrl: image,
      soldOut: it.soldOut,
    });
  }

  // Combos (FR-023..026): precio calculado y alerta si algún componente está agotado
  const soldOutBundles: Tagged<SoldOutBundle>[] = [];
  const omittedBundleNoImage: Tagged<OmittedItem>[] = [];
  const alegraById = new Map(input.items.map((i) => [i.id, i]));
  const customById = new Map(
    (input.customSections ?? []).flatMap((cs) =>
      cs.products.map((p) => [p.id, { name: p.name, price: p.price ?? p.options?.[0]?.price ?? 0 }] as const),
    ),
  );
  for (const b of input.bundles ?? []) {
    const bucket = buckets.get(b.sectionKey);
    if (!bucket) continue;
    if (!b.imageUrl) {
      omittedBundleNoImage.push({ sectionKey: b.sectionKey, entry: { source: 'bundle', id: b.id, name: b.name } });
      continue;
    }
    const resolved = b.components.map((c) => {
      if (c.source === 'custom') {
        const p = customById.get(c.productId);
        return { name: p?.name ?? NOT_AVAILABLE, unitPrice: p?.price ?? 0, quantity: c.quantity, soldOut: !p };
      }
      const it = alegraById.get(c.productId);
      return {
        name: it?.name ?? NOT_AVAILABLE,
        unitPrice: it?.price ?? 0,
        quantity: c.quantity,
        soldOut: !it || it.soldOut, // desaparecido o inactivo en Alegra = no disponible
      };
    });
    const soldOutComponents = resolved.filter((c) => c.soldOut).map((c) => c.name);
    const isSoldOut = soldOutComponents.length > 0;
    if (isSoldOut) {
      // "Ocultar agotados" también oculta los combos con algún componente agotado, sin pedir decisión.
      if (input.hideSoldOut) continue;
      soldOutBundles.push({ sectionKey: b.sectionKey, entry: { bundleId: b.id, name: b.name, soldOutComponents } });
      if (input.decisions?.[b.id] === 'omit') continue;
    }
    bucket.items.push({
      kind: 'bundle',
      id: b.id,
      name: b.name,
      description: b.description,
      imageUrl: b.imageUrl,
      priceLabel: formatCop(computeBundlePrice(b.pricing, resolved)),
      components: resolved.map((c) => ({ name: c.name, quantity: c.quantity })),
      soldOut: isSoldOut,
    });
  }

  // Orden de secciones: todas las que tienen contenido elegible (de ahí sale `availableSections`)
  const position = new Map(input.sectionOrder.map((k, i) => [k, i]));
  const allOrdered = [...buckets.values()]
    .filter((b) => b.items.length > 0)
    .sort((a, b) => {
      const pa = position.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const pb = position.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      return pa !== pb ? pa - pb : byName(a, b);
    });
  const availableSections: AvailableSection[] = allOrdered.map((b) => ({
    key: b.key,
    name: b.name,
    source: b.source,
    items: b.items.length,
  }));

  // Solo las secciones seleccionadas entran al PDF y al informe; las claves desconocidas se ignoran
  const selected = input.sectionKeys ? new Set(input.sectionKeys) : null;
  const isSelected = (key: string): boolean => !selected || selected.has(key);
  const ordered = allOrdered.filter((b) => isSelected(b.key));

  const sections: CatalogSectionPayload[] = ordered.map((b) => ({
    key: b.key,
    name: b.name,
    source: b.source,
    introText: b.introText,
    pages: chunk(b.keepOrder ? b.items : [...b.items].sort(byName)),
  }));

  const inSelected = <T>(list: Tagged<T>[]): T[] => list.filter((t) => isSelected(t.sectionKey)).map((t) => t.entry);
  const noImage = [...inSelected(omittedNoImage), ...inSelected(omittedCustomNoImage), ...inSelected(omittedBundleNoImage)];

  // Estado de las fotos de Alegra sobre todos los productos (no solo las secciones seleccionadas): `allFailed` es una
  // señal de problema general. Los padres de variantes se ignoran, como en el resto del constructor, y los omitidos
  // también: ya no importan y no deben falsear esa señal (FR-009).
  const informed = input.items.filter(
    (i) => i.type !== 'variantParent' && !omitted.has(i.id) && (i.imageUrls?.length ?? (i.remoteImageUrl ? 1 : 0)) > 0,
  );
  const obtained = informed.filter((i) => !!input.localImages.get(i.id)).length;

  const allItems = ordered.flatMap((b) => b.items);
  const included = allItems.length;
  const soldOutShown = allItems.filter((i) => i.kind !== 'custom' && i.soldOut).length;
  const report: ReviewReport = {
    // Globales: ítems de Alegra sin sección, que no pertenecen a ninguna sección
    uncategorized,
    omittedNoImage: noImage,
    omittedNoSection,
    omittedByChoice: omittedByChoice.sort(byName),
    soldOutBundles: inSelected(soldOutBundles),
    counts: {
      included,
      omitted: noImage.length + omittedNoSection.length,
      soldOut: soldOutShown,
    },
    emptyCatalog: sections.length === 0,
    photos: {
      informed: informed.length,
      obtained,
      notObtained: inSelected(photoNotObtained),
      allFailed: informed.length > 0 && obtained === 0,
    },
  };

  return {
    availableSections,
    payload: {
      config: {
        ...input.config,
        coverTitle: input.bannerText?.trim() || input.config.coverTitle,
      },
      template: input.template ?? baseTemplate('neon'),
      sections,
      terms: input.terms,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
    },
    report,
  };
}
