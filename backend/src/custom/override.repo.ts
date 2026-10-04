import type { Db } from '../db/database';

/** Asignación local ítem de Alegra sin categoría -> sección. Nunca escribe en Alegra (principio I). */
export class OverrideRepo {
  constructor(private db: Db) {}

  all(): Map<string, string> {
    const rows = this.db.prepare('SELECT alegra_item_id, section_key FROM category_override').all() as {
      alegra_item_id: string;
      section_key: string;
    }[];
    return new Map(rows.map((r) => [r.alegra_item_id, r.section_key]));
  }

  get(itemId: string): string | null {
    const row = this.db
      .prepare('SELECT section_key FROM category_override WHERE alegra_item_id = ?')
      .get(itemId) as { section_key: string } | undefined;
    return row?.section_key ?? null;
  }

  set(itemId: string, sectionKey: string): void {
    this.db
      .prepare(
        `INSERT INTO category_override (alegra_item_id, section_key) VALUES (?, ?)
         ON CONFLICT(alegra_item_id) DO UPDATE SET section_key = excluded.section_key`,
      )
      .run(itemId, sectionKey);
  }

  remove(itemId: string): void {
    this.db.prepare('DELETE FROM category_override WHERE alegra_item_id = ?').run(itemId);
  }
}
