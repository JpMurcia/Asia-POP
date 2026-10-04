import type { CatalogPayload, CatalogStructure } from './types';

/**
 * Estructura del PDF que producirá un payload: portadas, páginas de producto y políticas.
 * Invariante (SC-003): `totalPages` es el número de páginas del PDF generado con ese mismo payload.
 */
export function computeStructure(payload: CatalogPayload): CatalogStructure {
  if (payload.sections.length === 0) {
    return {
      coverPages: 0,
      sectionCoverPages: 0,
      productPages: 0,
      termsPages: 0,
      ownItems: 0,
      totalPages: 0,
      nothingToGenerate: true,
      sections: [],
    };
  }

  const sections = payload.sections.map((s) => ({
    key: s.key,
    name: s.name,
    source: s.source,
    items: s.pages.reduce((n, p) => n + p.length, 0),
    pages: s.pages.length,
  }));
  const coverPages = 1;
  const sectionCoverPages = sections.length;
  const productPages = sections.reduce((n, s) => n + s.pages, 0);
  const termsPages = payload.terms.length > 0 ? 1 : 0;
  const ownItems = payload.sections
    .flatMap((s) => s.pages.flat())
    .filter((i) => i.kind === 'custom' || i.kind === 'bundle').length;

  return {
    coverPages,
    sectionCoverPages,
    productPages,
    termsPages,
    ownItems,
    totalPages: coverPages + sectionCoverPages + productPages + termsPages,
    nothingToGenerate: false,
    sections,
  };
}
