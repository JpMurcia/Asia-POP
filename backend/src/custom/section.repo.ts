import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../api/errors';
import type { Db } from '../db/database';

export interface CustomSectionRow {
  id: string;
  name: string;
  introText: string | null;
}

interface Row {
  id: string;
  name: string;
  intro_text: string | null;
}

const toSection = (r: Row): CustomSectionRow => ({ id: r.id, name: r.name, introText: r.intro_text });

export class SectionRepo {
  constructor(
    private db: Db,
    private uploadsDir: string,
  ) {}

  list(): CustomSectionRow[] {
    return (this.db.prepare('SELECT * FROM section ORDER BY name').all() as Row[]).map(toSection);
  }

  get(id: string): CustomSectionRow | null {
    const r = this.db.prepare('SELECT * FROM section WHERE id = ?').get(id) as Row | undefined;
    return r ? toSection(r) : null;
  }

  create(name: string, introText?: string | null): CustomSectionRow {
    const id = crypto.randomUUID();
    try {
      this.db.prepare('INSERT INTO section (id, name, intro_text) VALUES (?, ?, ?)').run(id, name, introText ?? null);
    } catch (e) {
      throw this.duplicate(e);
    }
    return this.get(id)!;
  }

  update(id: string, name: string, introText?: string | null): CustomSectionRow | null {
    try {
      const res = this.db
        .prepare('UPDATE section SET name = ?, intro_text = ? WHERE id = ?')
        .run(name, introText ?? null, id);
      if (res.changes === 0) return null;
    } catch (e) {
      throw this.duplicate(e);
    }
    return this.get(id);
  }

  /**
   * Elimina la sección con sus productos y combos. Se bloquea si un producto de la sección es componente
   * de un combo de otra sección (evita combos con componentes huérfanos).
   */
  remove(id: string): boolean {
    const blocking = this.db
      .prepare(
        `SELECT 1 FROM bundle_component bc
         JOIN custom_product p ON bc.source = 'custom' AND bc.product_id = p.id
         JOIN bundle b ON b.id = bc.bundle_id
         WHERE p.section_id = ? AND b.section_id <> ? LIMIT 1`,
      )
      .get(id, id);
    if (blocking) {
      throw new HttpError(
        409,
        'used_in_bundle',
        'Un producto de esta sección forma parte de un combo de otra sección. Edita ese combo primero.',
      );
    }
    const images = this.db
      .prepare(
        `SELECT image_path FROM custom_product WHERE section_id = ? AND image_path IS NOT NULL
         UNION SELECT image_path FROM bundle WHERE section_id = ? AND image_path IS NOT NULL`,
      )
      .all(id, id) as { image_path: string }[];

    const removed = this.db.transaction(() => {
      this.db
        .prepare(
          `DELETE FROM bundle_component WHERE source = 'custom' AND product_id IN
           (SELECT id FROM custom_product WHERE section_id = ?)`,
        )
        .run(id);
      this.db.prepare('DELETE FROM section_order WHERE section_key = ?').run(`custom:${id}`);
      this.db.prepare('DELETE FROM category_override WHERE section_key = ?').run(`custom:${id}`);
      return this.db.prepare('DELETE FROM section WHERE id = ?').run(id).changes > 0;
    })();
    if (removed) {
      for (const i of images) fs.rmSync(path.join(this.uploadsDir, i.image_path), { force: true });
    }
    return removed;
  }

  private duplicate(e: unknown): unknown {
    if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return new HttpError(409, 'duplicate_name', 'Ya existe una sección con ese nombre.');
    }
    return e;
  }
}
