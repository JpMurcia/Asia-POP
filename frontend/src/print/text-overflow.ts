import type { TextOverflow } from '../../../backend/src/catalog/types';

/**
 * Los productos cuyo texto no cupo completo (feature 007): recorre las filas de producto (`.pb-row`, que llevan el
 * nombre del producto en `data-item-name`) y reúne, por cada una, el nombre y/o la burbuja que `useFit` marcó con
 * `data-clipped` (se cortó con «…») o `data-overflow` (ni a 6 pt cabe). Una misma pareja producto-parte no se repite.
 * La lee `Print` justo antes de marcar la página como lista, y el navegador que genera el PDF la entrega al servidor.
 */
export function collectTextOverflow(root: ParentNode = document): TextOverflow[] {
  const found: TextOverflow[] = [];
  const seen = new Set<string>();
  root.querySelectorAll('.pb-row').forEach((row) => {
    const item = row.getAttribute('data-item-name');
    if (!item) return;
    row.querySelectorAll('[data-clipped="true"], [data-overflow="true"]').forEach((marked) => {
      const part = marked.getAttribute('data-part');
      if (part !== 'name' && part !== 'bubble') return;
      const key = `${part}\u0000${item}`;
      if (seen.has(key)) return;
      seen.add(key);
      found.push({ item, part });
    });
  });
  return found;
}
