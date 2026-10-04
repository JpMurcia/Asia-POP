import { describe, expect, it } from 'vitest';
import { computeBundlePrice, roundToHundred } from '../../src/catalog/bundle-pricing';
import { bundleSchema } from '../../src/custom/bundle.repo';

const comps = [
  { unitPrice: 9000, quantity: 2 }, // 18.000
  { unitPrice: 12000, quantity: 1 }, // 12.000  => 30.000
];

describe('precio de combo (FR-024)', () => {
  it('precio fijo: se muestra tal cual, sin importar los componentes', () => {
    expect(computeBundlePrice({ type: 'fixed', price: 25000 }, comps)).toBe(25000);
    expect(computeBundlePrice({ type: 'fixed', price: 25000 }, [])).toBe(25000);
  });

  it('descuento porcentual sobre la suma de los componentes', () => {
    expect(computeBundlePrice({ type: 'discount', percent: 10 }, comps)).toBe(27000);
    expect(computeBundlePrice({ type: 'discount', percent: 50 }, comps)).toBe(15000);
  });

  it('el descuento se redondea al múltiplo de $100 más cercano', () => {
    // 31.700 * 0,85 = 26.945 -> 26.900
    expect(computeBundlePrice({ type: 'discount', percent: 15 }, [{ unitPrice: 31700, quantity: 1 }])).toBe(26900);
    expect(roundToHundred(26950)).toBe(27000);
    expect(roundToHundred(26949)).toBe(26900);
  });

  it('el 100 % deja el combo en $0 y nunca queda negativo', () => {
    expect(computeBundlePrice({ type: 'discount', percent: 100 }, comps)).toBe(0);
  });

  it('respeta las cantidades', () => {
    expect(computeBundlePrice({ type: 'discount', percent: 10 }, [{ unitPrice: 5000, quantity: 4 }])).toBe(18000);
  });
});

describe('validación de combos', () => {
  const ok = {
    sectionId: 's1',
    name: 'Combo regalo',
    pricing: { type: 'discount' as const, percent: 10 },
    components: [{ source: 'alegra' as const, productId: '12', quantity: 2 }],
  };

  it('acepta un combo válido', () => {
    expect(bundleSchema.safeParse(ok).success).toBe(true);
    expect(bundleSchema.safeParse({ ...ok, pricing: { type: 'fixed', price: 20000 } }).success).toBe(true);
  });
  it('exige al menos un componente', () => {
    expect(bundleSchema.safeParse({ ...ok, components: [] }).success).toBe(false);
  });
  it('rechaza descuentos fuera de (0, 100] y precios inválidos', () => {
    expect(bundleSchema.safeParse({ ...ok, pricing: { type: 'discount', percent: 0 } }).success).toBe(false);
    expect(bundleSchema.safeParse({ ...ok, pricing: { type: 'discount', percent: 101 } }).success).toBe(false);
    expect(bundleSchema.safeParse({ ...ok, pricing: { type: 'fixed', price: -5 } }).success).toBe(false);
    expect(bundleSchema.safeParse({ ...ok, pricing: { type: 'fixed', price: 1.5 } }).success).toBe(false);
  });
  it('rechaza cantidades inválidas', () => {
    const c = (quantity: number) => ({ ...ok, components: [{ source: 'alegra' as const, productId: '1', quantity }] });
    expect(bundleSchema.safeParse(c(0)).success).toBe(false);
    expect(bundleSchema.safeParse(c(1.5)).success).toBe(false);
  });
});
