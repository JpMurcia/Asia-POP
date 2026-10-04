import { describe, expect, it } from 'vitest';
import {
  AUTO_BLOCK_TYPES,
  PAGE_KEYS,
  REQUIRED_BLOCKS,
  paletteWarnings,
  resolveColor,
  resolveTokens,
  tokensFrom,
  type Palette,
} from '../../src/catalog/template';

const business = {
  storeName: 'ASIANPOP MARKET+',
  phone1: '310 669 0585',
  phone2: '318 807 0709',
  address: 'Cra 10 # 18-15 centro',
  coverTitle: 'Catálogo de productos',
};

const NEON: Palette = { bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' };

describe('tokensFrom', () => {
  it('arma el contexto de marcadores con los datos del negocio y el nombre de la sección', () => {
    expect(tokensFrom(business, 'RAMEN')).toEqual({
      banner: 'Catálogo de productos',
      seccion: 'RAMEN',
      telefonos: '310 669 0585 · 318 807 0709',
      direccion: 'Cra 10 # 18-15 centro',
      tienda: 'ASIANPOP MARKET+',
    });
  });

  it('une solo los teléfonos no vacíos, sin separadores sobrantes', () => {
    expect(tokensFrom({ ...business, phone2: '' }).telefonos).toBe('310 669 0585');
    expect(tokensFrom({ ...business, phone1: '', phone2: '318 807 0709' }).telefonos).toBe('318 807 0709');
    expect(tokensFrom({ ...business, phone1: '  ', phone2: '' }).telefonos).toBe('');
  });

  it('la sección queda vacía donde no hay sección', () => {
    expect(tokensFrom(business).seccion).toBe('');
  });
});

describe('resolveTokens', () => {
  const tokens = tokensFrom(business, 'RAMEN');

  it('reemplaza los cinco marcadores', () => {
    expect(resolveTokens('{banner}', tokens)).toBe('Catálogo de productos');
    expect(resolveTokens('{seccion}', tokens)).toBe('RAMEN');
    expect(resolveTokens('{telefonos}', tokens)).toBe('310 669 0585 · 318 807 0709');
    expect(resolveTokens('{direccion}', tokens)).toBe('Cra 10 # 18-15 centro');
    expect(resolveTokens('{tienda}', tokens)).toBe('ASIANPOP MARKET+');
  });

  it('reemplaza varios marcadores y el mismo marcador repetido', () => {
    expect(resolveTokens('{tienda} — {seccion} — {seccion}', tokens)).toBe('ASIANPOP MARKET+ — RAMEN — RAMEN');
  });

  it('un marcador desconocido queda tal cual', () => {
    expect(resolveTokens('Hola {otra} y {seccion}', tokens)).toBe('Hola {otra} y RAMEN');
    expect(resolveTokens('{Seccion}', tokens)).toBe('{Seccion}');
  });

  it('el texto sin marcadores no cambia', () => {
    expect(resolveTokens('Políticas de compra', tokens)).toBe('Políticas de compra');
    expect(resolveTokens('', tokens)).toBe('');
  });

  it('un dato vacío no deja el marcador ni separadores colgando', () => {
    const noAddress = tokensFrom({ ...business, address: '' });
    expect(resolveTokens('{telefonos} · {direccion}', noAddress)).toBe('310 669 0585 · 318 807 0709');
    const noPhones = tokensFrom({ ...business, phone1: '', phone2: '' });
    expect(resolveTokens('{telefonos} · {direccion}', noPhones)).toBe('Cra 10 # 18-15 centro');
    const nothing = tokensFrom({ ...business, phone1: '', phone2: '', address: '' });
    expect(resolveTokens('{telefonos} · {direccion}', nothing)).toBe('');
  });

  it('{seccion} vacío en páginas sin sección no deja residuo', () => {
    expect(resolveTokens('Catálogo {seccion}', tokensFrom(business))).toBe('Catálogo');
    expect(resolveTokens('{seccion}', tokensFrom(business))).toBe('');
  });

  it('no toca los separadores de un texto cuyos datos sí existen', () => {
    expect(resolveTokens('· Oferta ·', tokens)).toBe('· Oferta ·');
  });
});

describe('resolveColor', () => {
  it('resuelve una clave de paleta', () => {
    expect(resolveColor(NEON, 'bg')).toBe('#11052C');
    expect(resolveColor(NEON, 'a2')).toBe('#00FF66');
    expect(resolveColor(NEON, 'paper')).toBe('#F4EFE8');
  });

  it('deja pasar un #RRGGBB personalizado', () => {
    expect(resolveColor(NEON, '#123ABC')).toBe('#123ABC');
  });

  it('"none" y "transparent" son transparentes', () => {
    expect(resolveColor(NEON, 'none')).toBe('transparent');
    expect(resolveColor(NEON, 'transparent')).toBe('transparent');
  });

  it('cambiar la paleta cambia el color resuelto, no el personalizado', () => {
    const other = { ...NEON, a1: '#00AAFF' };
    expect(resolveColor(other, 'a1')).toBe('#00AAFF');
    expect(resolveColor(other, '#FF007A')).toBe('#FF007A');
  });

  it('un valor desconocido se trata como transparente en lugar de romper el dibujo', () => {
    expect(resolveColor(NEON, 'rosa')).toBe('transparent');
    expect(resolveColor(NEON, '')).toBe('transparent');
  });
});

describe('paletteWarnings', () => {
  it('la paleta de fábrica de Neón Noche no da avisos', () => {
    expect(paletteWarnings(NEON)).toEqual([]);
  });

  it('avisa si el texto casi no se distingue del papel', () => {
    const w = paletteWarnings({ ...NEON, ink: '#F0EBE4' });
    expect(w.map((x) => x.code)).toEqual(['low_text_contrast']);
    expect(w[0]!.message).toMatch(/papel/i);
  });

  it('avisa si el texto blanco no se lee sobre el color de fondo', () => {
    const w = paletteWarnings({ ...NEON, bg: '#FFD6E5' });
    expect(w.some((x) => x.code === 'low_text_contrast' && /blanco/i.test(x.message))).toBe(true);
  });

  it('avisa por cada acento que casi no se distingue del fondo', () => {
    const w = paletteWarnings({ ...NEON, a2: '#12062E', a3: '#13072F' });
    const accent = w.filter((x) => x.code === 'low_accent_contrast');
    expect(accent).toHaveLength(2);
    expect(accent[0]!.message).toMatch(/acento 2/i);
    expect(accent[1]!.message).toMatch(/acento 3/i);
  });

  it('un acento con contraste suficiente (≥ 3) no avisa', () => {
    // gris #767676 sobre negro: contraste ≈ 4,6
    const w = paletteWarnings({ ...NEON, bg: '#000000', a1: '#767676', a2: '#767676', a3: '#767676' });
    expect(w.filter((x) => x.code === 'low_accent_contrast')).toEqual([]);
  });
});

describe('REQUIRED_BLOCKS', () => {
  it('cubre las cuatro páginas', () => {
    expect(Object.keys(REQUIRED_BLOCKS).sort()).toEqual([...PAGE_KEYS].sort());
    expect(AUTO_BLOCK_TYPES).toEqual(['intro', 'products', 'terms', 'footer']);
  });

  it('exige los bloques de cada página y ninguno más', () => {
    expect(REQUIRED_BLOCKS.portada).toEqual({ intro: 0, products: 0, terms: 0, footer: 0 });
    expect(REQUIRED_BLOCKS.seccion).toEqual({ intro: 1, products: 0, terms: 0, footer: 0 });
    expect(REQUIRED_BLOCKS.productos).toEqual({ intro: 0, products: 1, terms: 0, footer: 1 });
    expect(REQUIRED_BLOCKS.politicas).toEqual({ intro: 0, products: 0, terms: 1, footer: 1 });
  });
});
