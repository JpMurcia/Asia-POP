import { describe, expect, it } from 'vitest';
import { businessSchema } from '../../src/api/business.routes';
import { BUSINESS_LIMITS, businessIssues, termsChars } from '../../src/catalog/business-limits';
import { DEFAULT_BUSINESS } from '../../src/catalog/settings.repo';
import type { BusinessSettings } from '../../src/catalog/types';

const ok = (): BusinessSettings => structuredClone(DEFAULT_BUSINESS);
const withB = (over: Partial<BusinessSettings>): BusinessSettings => ({ ...ok(), ...over });
const x = (n: number) => 'x'.repeat(n);

describe('businessIssues', () => {
  it('los datos por defecto no tienen problemas', () => {
    expect(businessIssues(ok())).toEqual([]);
  });

  it('un banner de 80 caracteres pasa y uno de 81 no', () => {
    expect(businessIssues(withB({ coverTitle: x(80) }))).toEqual([]);
    const issues = businessIssues(withB({ coverTitle: x(81) }));
    expect(issues).toEqual([{ field: 'coverTitle', message: 'El texto del banner: máximo 80 caracteres.' }]);
  });

  it('el banner y el nombre de la tienda no pueden quedar vacíos (ni solo espacios)', () => {
    expect(businessIssues(withB({ coverTitle: '   ' })).map((i) => i.field)).toEqual(['coverTitle']);
    expect(businessIssues(withB({ storeName: '' })).map((i) => i.field)).toEqual(['storeName']);
  });

  it('los teléfonos y la dirección pueden quedar vacíos pero tienen máximo', () => {
    expect(businessIssues(withB({ phone2: '', address: '' }))).toEqual([]);
    expect(businessIssues(withB({ phone1: x(31) })).map((i) => i.field)).toEqual(['phone1']);
    expect(businessIssues(withB({ address: x(161) })).map((i) => i.field)).toEqual(['address']);
  });

  it('las políticas: total de 3500 caracteres, título obligatorio, hasta 10', () => {
    const terms = (n: number, each: number) => Array.from({ length: n }, (_, i) => ({ title: `P${i}`, body: x(each) }));
    expect(businessIssues(withB({ terms: terms(7, 500) }))).toEqual([]); // 3500 exactos
    expect(businessIssues(withB({ terms: terms(7, 501) })).map((i) => i.field)).toEqual(['terms']);
    expect(businessIssues(withB({ terms: [{ title: '', body: 'a' }] })).map((i) => i.field)).toEqual(['terms[0].title']);
    expect(businessIssues(withB({ terms: terms(11, 10) })).map((i) => i.field)).toEqual(['terms']);
    expect(businessIssues(withB({ terms: [{ title: 'a', body: x(1201) }] })).map((i) => i.field)).toContain('terms[0].body');
  });

  it('los espacios de los extremos no cuentan (como en el servidor)', () => {
    expect(termsChars([{ title: 'a', body: `  ${x(10)}  ` }])).toBe(10);
    expect(businessIssues(withB({ coverTitle: `${x(80)}   ` }))).toEqual([]);
  });

  it('coincide con el esquema del servidor: lo que uno rechaza, el otro también', () => {
    const samples: BusinessSettings[] = [
      ok(),
      withB({ coverTitle: x(80) }),
      withB({ coverTitle: x(81) }),
      withB({ coverTitle: '' }),
      withB({ coverTitle: ' \t ' }),
      withB({ storeName: x(81) }),
      withB({ storeName: '' }),
      withB({ phone1: x(30) }),
      withB({ phone1: x(31) }),
      withB({ phone2: '' }),
      withB({ address: x(160) }),
      withB({ address: x(161) }),
      withB({ terms: [] }),
      withB({ terms: [{ title: '', body: 'x' }] }),
      withB({ terms: [{ title: x(81), body: 'x' }] }),
      withB({ terms: [{ title: 'a', body: x(1200) }] }),
      withB({ terms: [{ title: 'a', body: x(1201) }] }),
      withB({ terms: Array.from({ length: 10 }, () => ({ title: 'a', body: x(350) })) }),
      withB({ terms: Array.from({ length: 10 }, () => ({ title: 'a', body: x(351) })) }),
      withB({ terms: Array.from({ length: 11 }, () => ({ title: 'a', body: 'x' })) }),
    ];
    for (const sample of samples) {
      const server = businessSchema.safeParse(sample).success;
      expect(businessIssues(sample).length === 0, JSON.stringify(sample).slice(0, 120)).toBe(server);
    }
  });

  it('expone los límites que usa el servidor', () => {
    expect(BUSINESS_LIMITS.termsChars).toBe(3500);
    expect(BUSINESS_LIMITS.coverTitle).toBe(80);
  });
});
