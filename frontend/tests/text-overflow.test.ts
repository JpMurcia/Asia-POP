import { describe, expect, it } from 'vitest';
import { collectTextOverflow } from '../src/print/text-overflow';

/** Una fila de producto con las marcas que escribe `useFit` en el navegador. */
function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('collectTextOverflow', () => {
  it('lista el nombre recortado y la burbuja desbordada, cada uno con su producto', () => {
    const root = dom(`
      <div class="pb-row" data-item-name="Nombre 1"><div data-part="name" data-clipped="true"></div><div data-part="bubble"></div></div>
      <div class="pb-row" data-item-name="Nombre 2"><div data-part="name"></div><div data-part="bubble" data-overflow="true"></div></div>
      <div class="pb-row" data-item-name="Nombre 3"><div data-part="name"></div><div data-part="bubble"></div></div>`);
    expect(collectTextOverflow(root)).toEqual([
      { item: 'Nombre 1', part: 'name' },
      { item: 'Nombre 2', part: 'bubble' },
    ]);
  });

  it('un producto con el nombre y la burbuja marcados aparece dos veces, una por parte', () => {
    const root = dom(`
      <div class="pb-row" data-item-name="Largo"><div data-part="name" data-overflow="true"></div><div data-part="bubble" data-clipped="true"></div></div>`);
    expect(collectTextOverflow(root)).toEqual([
      { item: 'Largo', part: 'name' },
      { item: 'Largo', part: 'bubble' },
    ]);
  });

  it('una misma pareja producto-parte no se repite, aunque el nombre salga en varias páginas', () => {
    const root = dom(`
      <div class="pb-row" data-item-name="Igual"><div data-part="bubble" data-clipped="true" data-overflow="true"></div></div>
      <div class="pb-row" data-item-name="Igual"><div data-part="bubble" data-clipped="true"></div></div>`);
    expect(collectTextOverflow(root)).toEqual([{ item: 'Igual', part: 'bubble' }]);
  });

  it('sin marcas devuelve una lista vacía', () => {
    expect(collectTextOverflow(dom('<div class="pb-row" data-item-name="A"><div data-part="name"></div></div>'))).toEqual([]);
    expect(collectTextOverflow(dom(''))).toEqual([]);
  });

  it('ignora una marca sin producto conocido o en una parte que no es nombre ni burbuja', () => {
    const root = dom(`
      <div class="pb-row"><div data-part="bubble" data-clipped="true"></div></div>
      <div class="pb-row" data-item-name="Foto"><div data-part="photo" data-clipped="true"></div></div>`);
    expect(collectTextOverflow(root)).toEqual([]);
  });

  it('sin argumento recorre el documento', () => {
    document.body.innerHTML = '<div class="pb-row" data-item-name="En el documento"><div data-part="name" data-clipped="true"></div></div>';
    expect(collectTextOverflow()).toEqual([{ item: 'En el documento', part: 'name' }]);
    document.body.innerHTML = '';
  });
});
