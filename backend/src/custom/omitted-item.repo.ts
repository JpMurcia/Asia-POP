import type { Db } from '../db/database';

/** Artículos de Alegra que la persona omitió del catálogo. Solo local: nunca escribe en Alegra (principio I). */
export class OmittedItemRepo {
  constructor(private db: Db) {}

  all(): Set<string> {
    const rows = this.db.prepare('SELECT alegra_item_id FROM omitted_item').all() as { alegra_item_id: string }[];
    return new Set(rows.map((r) => r.alegra_item_id));
  }

  add(itemId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO omitted_item (alegra_item_id) VALUES (?)').run(itemId);
  }

  remove(itemId: string): void {
    this.db.prepare('DELETE FROM omitted_item WHERE alegra_item_id = ?').run(itemId);
  }
}

/**
 * Firma estable de una lista de omitidos (FR-012): no depende del orden ni de los duplicados. Sirve para saber si la
 * lista cambió entre preparar el catálogo y generarlo.
 */
export function omittedSignature(ids: Iterable<string>): string {
  return JSON.stringify([...new Set(ids)].sort());
}
