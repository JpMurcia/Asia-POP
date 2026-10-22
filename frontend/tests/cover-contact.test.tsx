import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tokensFrom, type ImageEl, type PageKey, type Template } from '../../backend/src/catalog/template';
import { baseTemplate } from '../../backend/src/catalog/template-presets';
import TemplatePage from '../src/print/TemplatePage';
import { IMAGES } from '../src/print/assets';

/** Feature 010: portadas de Base AsianPop, contacto desde la configuración e imágenes subidas. */
const business = (over: Partial<Parameters<typeof tokensFrom>[0]> = {}) => ({
  storeName: 'ASIANPOP MARKET+',
  phone1: '310 669 0585',
  phone2: '318 807 0709',
  address: 'Cra 10 # 18-15',
  coverTitle: 'Catálogo de productos',
  ...over,
});
const renderCover = (t: Template, page: PageKey, b = business(), seccion = 'RAMEN') =>
  render(<TemplatePage template={t} page={page} tokens={tokensFrom(b, seccion)} items={[]} />).container;

describe('portadas de Base AsianPop', () => {
  it.each(['portada', 'seccion'] as const)('la portada «%s» muestra «Domicilios» y los dos teléfonos de la configuración', (page) => {
    const c = renderCover(baseTemplate('base'), page);
    expect(c.textContent).toContain('Domicilios');
    expect(c.textContent).toContain('310 669 0585 · 318 807 0709');
  });

  it('cambiar un número en la configuración cambia todas las portadas sin tocar la plantilla (SC-006)', () => {
    const t = baseTemplate('base');
    const before = structuredClone(t);
    const b = business({ phone2: '300 111 2233' });
    for (const page of ['portada', 'seccion'] as const) {
      const c = renderCover(t, page, b);
      expect(c.textContent).toContain('310 669 0585 · 300 111 2233');
      expect(c.textContent).not.toContain('318 807 0709');
    }
    expect(t).toEqual(before);
  });

  it('el título de la portada de sección sale en mayúsculas muy grandes', () => {
    const c = renderCover(baseTemplate('base'), 'seccion', business(), 'Ramen');
    const title = [...c.querySelectorAll<HTMLElement>('.tpl-text')].find((e) => /ramen/i.test(e.textContent ?? ''));
    expect(title).toBeDefined();
    expect(title!.style.textTransform).toBe('uppercase');
    const doc = baseTemplate('base').pages.seccion.els.find((e) => e.type === 'text' && e.text === '{seccion}');
    expect(doc && doc.type === 'text' && doc.size).toBeGreaterThanOrEqual(60);
  });

  it('sin ilustración subida la portada queda completa: solo el logo y el ícono propio, sin imágenes vacías', () => {
    const c = renderCover(baseTemplate('base'), 'portada');
    const imgs = [...c.querySelectorAll<HTMLImageElement>('img.tpl-image, .tpl-image img, img')].filter((i) => i.getAttribute('data-src'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const i of imgs) {
      expect(['logo', 'chat']).toContain(i.getAttribute('data-src'));
      expect(i.getAttribute('src')).toBeTruthy();
    }
  });

  it('una imagen subida (upload:) se dibuja desde /media/uploads', () => {
    const t = baseTemplate('base');
    const image: ImageEl = { id: 'ilustracion', type: 'image', x: 10, y: 60, w: 30, h: 20, rot: 0, opacity: 1, visible: true, locked: false, src: 'upload:tpl-ramen-ab12cd34.png', fit: 'contain', radius: 0 };
    t.pages.seccion.els.push(image);
    const c = renderCover(t, 'seccion');
    const img = c.querySelector<HTMLImageElement>('img[data-src="upload:tpl-ramen-ab12cd34.png"]');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/media/uploads/tpl-ramen-ab12cd34.png');
  });

  it('las imágenes fijas siguen resolviéndose a su archivo', () => {
    const c = renderCover(baseTemplate('base'), 'portada');
    const logo = c.querySelector<HTMLImageElement>('img[data-src="logo"]')!;
    expect(logo.getAttribute('src')).toBe(IMAGES.logo);
  });
});
