import { afterEach, describe, expect, it } from 'vitest';
import { countBrokenProductImages } from '../src/print/broken-images';

/** jsdom no carga imágenes: `complete` y `naturalWidth` se fijan a mano para simular cada estado. */
function img(opts: { className?: string; complete: boolean; naturalWidth: number }): HTMLImageElement {
  const el = document.createElement('img');
  if (opts.className) el.className = opts.className;
  Object.defineProperty(el, 'complete', { value: opts.complete, configurable: true });
  Object.defineProperty(el, 'naturalWidth', { value: opts.naturalWidth, configurable: true });
  return el;
}

const root = (...children: HTMLElement[]) => {
  const el = document.createElement('div');
  el.append(...children);
  return el;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('countBrokenProductImages (fotos de producto que terminaron sin cargar)', () => {
  it('cuenta solo las fotos de producto terminadas con ancho natural 0', () => {
    const r = root(
      img({ className: 'pb-img', complete: true, naturalWidth: 0 }),
      img({ className: 'pb-img', complete: true, naturalWidth: 0 }),
      img({ className: 'pb-img', complete: true, naturalWidth: 300 }),
    );
    expect(countBrokenProductImages(r)).toBe(2);
  });

  it('no cuenta las que cargaron bien', () => {
    expect(countBrokenProductImages(root(img({ className: 'pb-img', complete: true, naturalWidth: 120 })))).toBe(0);
  });

  it('no cuenta las que aún no terminaron de cargar', () => {
    expect(countBrokenProductImages(root(img({ className: 'pb-img', complete: false, naturalWidth: 0 })))).toBe(0);
  });

  it('ignora las imágenes que no son fotos de producto (sello, imágenes de plantilla)', () => {
    const r = root(
      img({ className: 'pb-seal', complete: true, naturalWidth: 0 }),
      img({ complete: true, naturalWidth: 0 }),
      img({ className: 'tpl-image', complete: true, naturalWidth: 0 }),
    );
    expect(countBrokenProductImages(r)).toBe(0);
  });

  it('cuenta las fotos anidadas a cualquier profundidad', () => {
    const inner = document.createElement('section');
    inner.append(img({ className: 'pb-img', complete: true, naturalWidth: 0 }));
    expect(countBrokenProductImages(root(inner))).toBe(1);
  });

  it('sin imágenes devuelve 0', () => {
    expect(countBrokenProductImages(root())).toBe(0);
  });

  it('por defecto revisa todo el documento', () => {
    document.body.append(img({ className: 'pb-img', complete: true, naturalWidth: 0 }));
    expect(countBrokenProductImages()).toBe(1);
  });
});
