import { describe, expect, it } from 'vitest';
import { extractImageUrl, extractPrice, isSoldOut, mapAlegraItem } from '../../src/alegra/alegra.mapper';

describe('regla de stock (FR-011)', () => {
  it('controla inventario y cantidad 0 => agotado', () => {
    expect(isSoldOut({ id: '1', name: 'a', inventory: { availableQuantity: 0, trackInventory: true } })).toBe(true);
  });
  it('cantidad negativa => agotado', () => {
    expect(isSoldOut({ id: '1', name: 'a', inventory: { availableQuantity: -3 }, trackInventory: true })).toBe(true);
  });
  it('cantidad positiva => disponible', () => {
    expect(isSoldOut({ id: '1', name: 'a', inventory: { availableQuantity: 5, trackInventory: true } })).toBe(false);
  });
  it('trackInventory=false aunque la cantidad sea 0 => disponible', () => {
    expect(isSoldOut({ id: '1', name: 'a', trackInventory: false, inventory: { availableQuantity: 0 } })).toBe(false);
  });
  it('sin objeto inventory (no controla stock) => disponible', () => {
    expect(isSoldOut({ id: '1', name: 'a' })).toBe(false);
    expect(isSoldOut({ id: '1', name: 'a', inventory: null })).toBe(false);
  });
  it('inventory con cantidad y sin bandera explícita se considera controlado', () => {
    expect(isSoldOut({ id: '1', name: 'a', inventory: { availableQuantity: 0 } })).toBe(true);
  });
  it('usa quantity si no hay availableQuantity', () => {
    expect(isSoldOut({ id: '1', name: 'a', inventory: { quantity: 0 } })).toBe(true);
  });
  it('controla stock pero sin cantidad informada => no afirma agotado', () => {
    expect(isSoldOut({ id: '1', name: 'a', trackInventory: true, inventory: {} })).toBe(false);
  });
});

describe('extracción tolerante de campos', () => {
  it('imagen: acepta URL directa u objeto, ignora no-http', () => {
    expect(extractImageUrl({ id: '1', name: 'a', images: ['https://x.co/a.jpg'] })).toBe('https://x.co/a.jpg');
    expect(extractImageUrl({ id: '1', name: 'a', images: [{ url: 'https://x.co/b.jpg' }] })).toBe('https://x.co/b.jpg');
    expect(extractImageUrl({ id: '1', name: 'a', images: [{ link: 'https://x.co/c.jpg' }] })).toBe('https://x.co/c.jpg');
    expect(extractImageUrl({ id: '1', name: 'a', images: [] })).toBeNull();
    expect(extractImageUrl({ id: '1', name: 'a', images: ['data:foo'] })).toBeNull();
    expect(extractImageUrl({ id: '1', name: 'a' })).toBeNull();
  });
  it('precio: número o lista (prefiere lista 1)', () => {
    expect(extractPrice({ id: '1', name: 'a', price: 9000 })).toBe(9000);
    expect(extractPrice({ id: '1', name: 'a', price: [{ idPriceList: 2, price: 1 }, { idPriceList: 1, price: 12000 }] })).toBe(12000);
    expect(extractPrice({ id: '1', name: 'a', price: [{ price: 5000 }] })).toBe(5000);
    expect(extractPrice({ id: '1', name: 'a' })).toBe(0);
  });
  it('IDs numéricos o nuevos formatos se tratan como texto', () => {
    expect(mapAlegraItem({ id: 42, name: 'a', category: { id: 7 } }).id).toBe('42');
    expect(mapAlegraItem({ id: 'abc-123', name: 'a', category: { id: 'cat-1' } }).categoryId).toBe('cat-1');
  });
});
