export type BundlePricing = { type: 'fixed'; price: number } | { type: 'discount'; percent: number };

export interface PricedComponent {
  unitPrice: number;
  quantity: number;
}

/** Redondea al múltiplo de $100 más cercano (precios "limpios" en el catálogo). */
export function roundToHundred(n: number): number {
  return Math.round(n / 100) * 100;
}

/** Suma de los componentes (precio unitario x cantidad), sin descuento. */
export function componentsTotal(components: PricedComponent[]): number {
  return components.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
}

/**
 * Precio del combo (FR-024):
 * - `fixed`: el precio indicado.
 * - `discount`: suma de los componentes menos el porcentaje, redondeado a $100.
 */
export function computeBundlePrice(pricing: BundlePricing, components: PricedComponent[]): number {
  if (pricing.type === 'fixed') return Math.max(0, Math.round(pricing.price));
  const total = componentsTotal(components);
  return Math.max(0, roundToHundred(total * (1 - pricing.percent / 100)));
}
