import { tokensFrom, type DataTokens, type PageKey } from '../../../../backend/src/catalog/template';
import type { BusinessSettings, CatalogItem, Term } from '../../../../backend/src/catalog/types';
import { IMAGES } from '../../print/assets';

/**
 * Datos de muestra del editor (FR-004): no depende de Alegra, así que el editor sigue funcionando aunque Alegra
 * esté caído. Los productos usan el collage como foto y `SAMPLE_POSITIONS` recorta una zona distinta en cada uno.
 */
export const SAMPLE_SECTION = 'RAMEN';

export const SAMPLE_INTRO =
  '¿Qué es el mochi?\nPostre japonés de arroz glutinoso relleno de crema.\nElaborado bajo pedido.';

/** Tres productos, el segundo agotado, para ver la distribución y el estilo de agotado. */
export const SAMPLE_ITEMS: CatalogItem[] = [
  {
    kind: 'alegra',
    id: 'muestra-1',
    name: 'Buldak Carbonara',
    description: 'Fideos salteados picantes con salsa cremosa de queso.',
    priceLabel: '$9.000',
    imageUrl: IMAGES.collage,
    soldOut: false,
  },
  {
    kind: 'alegra',
    id: 'muestra-2',
    name: 'Soon Veggie Ramyun',
    description: 'Caldo suave de vegetales, apto para vegetarianos.',
    priceLabel: '$7.000',
    imageUrl: IMAGES.collage,
    soldOut: true,
  },
  {
    kind: 'alegra',
    id: 'muestra-3',
    name: 'Cream Tteokbokki',
    description: 'Pasteles de arroz en salsa cremosa, listos en 3 minutos.',
    priceLabel: '$15.000',
    imageUrl: IMAGES.collage,
    soldOut: false,
  },
];

/** Recorte (`background-position`) del collage para cada producto de muestra. */
export const SAMPLE_POSITIONS = ['69% 15%', '15% 11%', '28% 92%'];

/** Lo que cada página necesita para dibujarse con los datos de muestra y los datos reales del negocio. */
export interface PageData {
  tokens: DataTokens;
  items?: CatalogItem[];
  terms?: Term[];
  introText?: string;
  photoPositions?: string[];
}

export function pageData(page: PageKey, business: BusinessSettings): PageData {
  const inSection = page === 'seccion' || page === 'productos';
  const tokens = tokensFrom(business, inSection ? SAMPLE_SECTION : '');
  if (page === 'productos') return { tokens, items: SAMPLE_ITEMS, photoPositions: SAMPLE_POSITIONS };
  if (page === 'seccion') return { tokens, introText: SAMPLE_INTRO };
  if (page === 'politicas') return { tokens, terms: business.terms };
  return { tokens };
}
