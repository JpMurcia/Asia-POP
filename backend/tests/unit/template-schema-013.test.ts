import { describe, expect, it } from 'vitest';
import { baseTemplate, draftImage, draftShape, draftText, draftBadge } from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import { SHAPE_KINDS, isValidLink, type PageElement, type Template } from '../../src/catalog/template';

/** Feature 013: formas, línea, volteo, proporción y enlaces. */
function withEls(...els: PageElement[]): Template {
  const t = baseTemplate('neon');
  t.pages.portada.els = [...t.pages.portada.els, ...els];
  return t;
}
const el = <T extends Omit<PageElement, 'id'>>(id: string, e: T) => ({ ...e, id }) as unknown as PageElement;
const check = (t: Template) => workspaceSchema.safeParse({ templates: [t], defaultId: t.id });
const messages = (t: Template): string[] => {
  const r = check(t);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const found = (t: Template, id: string) => t.pages.portada.els.find((e) => e.id === id) as unknown as Record<string, unknown>;

describe('esquema de plantilla: elementos y formas (feature 013)', () => {
  it('una plantilla sin los campos es válida y se lee sin ellos', () => {
    const r = check(baseTemplate('kraft'));
    expect(r.success).toBe(true);
    if (r.success) {
      for (const e of r.data.templates[0]!.pages.portada.els) {
        for (const k of ['bs', 'capStart', 'capEnd', 'flipH', 'flipV', 'lockAspect', 'href']) expect(k in e).toBe(false);
      }
    }
  });

  it.each([...SHAPE_KINDS])('acepta la forma %s', (kind) => {
    expect(messages(withEls(el('s1', draftShape({ kind }))))).toEqual([]);
  });

  it('rechaza un tipo de forma desconocido', () => {
    expect(messages(withEls(el('s1', draftShape({ kind: 'cuadrado' as never }))))[0]).toContain('La forma');
  });

  it('los campos de forma sobreviven a validar (no los descarta zod)', () => {
    const extra = { bs: 'dashed', capStart: 'arrow', capEnd: 'diamond', flipH: true, flipV: true, lockAspect: true, href: 'https://wa.me/573106690585' };
    const r = check(withEls(el('s1', { ...draftShape({ kind: 'line' }), ...extra } as never)));
    expect(r.success).toBe(true);
    if (r.success) expect(found(r.data.templates[0]!, 's1')).toMatchObject(extra);
  });

  it.each([
    ['bs', 'rayado', 'El estilo del borde'],
    ['capStart', 'estrella', 'El extremo inicial'],
    ['capEnd', 'flecha', 'El extremo final'],
  ])('rechaza %s no válido', (key, value, label) => {
    expect(messages(withEls(el('s1', { ...draftShape({ kind: 'line' }), [key]: value } as never)))[0]).toContain(label);
  });

  it('la imagen acepta volteo, proporción y enlace', () => {
    const extra = { flipH: true, flipV: false, lockAspect: true, href: 'http://example.com/a?b=1' };
    const r = check(withEls(el('i1', { ...draftImage(), ...extra } as never)));
    expect(r.success).toBe(true);
    if (r.success) expect(found(r.data.templates[0]!, 'i1')).toMatchObject(extra);
  });

  it('el texto y la insignia aceptan enlace; el volteo no es de ellos y se descarta', () => {
    const r = check(
      withEls(el('t1', { ...draftText({ text: 'Hola' }), href: 'https://example.com', flipH: true } as never), el('b1', { ...draftBadge(), href: 'https://example.com' } as never)),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      const t = r.data.templates[0]!;
      expect(found(t, 't1').href).toBe('https://example.com');
      expect('flipH' in found(t, 't1')).toBe(false);
      expect(found(t, 'b1').href).toBe('https://example.com');
    }
  });

  it('un enlace vacío significa sin enlace y es válido', () => {
    expect(messages(withEls(el('i1', { ...draftImage(), href: '' } as never)))).toEqual([]);
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,hola'],
    ['ftp://example.com'],
    ['example.com'],
    ['https://exa mple.com'],
    [`https://example.com/${'a'.repeat(2000)}`],
  ])('rechaza el enlace %#', (href) => {
    expect(messages(withEls(el('i1', { ...draftImage(), href } as never)))[0]).toContain('El enlace debe empezar con http');
  });

  it('isValidLink', () => {
    expect(isValidLink('')).toBe(true);
    expect(isValidLink('HTTPS://Example.com')).toBe(true);
    expect(isValidLink('https://')).toBe(false);
  });
});
