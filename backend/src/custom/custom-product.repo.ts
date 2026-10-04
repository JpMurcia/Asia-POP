import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { HttpError } from '../api/errors';
import type { Db } from '../db/database';

export const optionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  price: z.number().int().min(0),
  maxFlavors: z.number().int().min(1).max(50).nullable().optional(),
});

/** Regla (data-model): un producto propio tiene precio o al menos una opción con precio. */
export const productSchema = z
  .object({
    sectionId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(600).default(''),
    price: z.number().int().min(0).nullable().optional(),
    options: z.array(optionSchema).max(10).optional(),
    flavors: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  })
  .refine((p) => p.price != null || (p.options?.length ?? 0) > 0, {
    message: 'Indica un precio o al menos una opción con precio.',
    path: ['price'],
  });

export type ProductInput = z.infer<typeof productSchema>;

export interface CustomProduct {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  imagePath: string | null;
  price: number | null;
  flavors: string[];
  options: { id: string; label: string; price: number; maxFlavors: number | null }[];
}

interface ProductRow {
  id: string;
  section_id: string;
  name: string;
  description: string;
  image_path: string | null;
  price: number | null;
  flavors: string | null;
}

export class CustomProductRepo {
  constructor(
    private db: Db,
    private uploadsDir: string,
  ) {}

  private hydrate(r: ProductRow): CustomProduct {
    const options = this.db
      .prepare('SELECT id, label, price, max_flavors FROM product_option WHERE product_id = ? ORDER BY rowid')
      .all(r.id) as { id: string; label: string; price: number; max_flavors: number | null }[];
    return {
      id: r.id,
      sectionId: r.section_id,
      name: r.name,
      description: r.description,
      imagePath: r.image_path,
      price: r.price,
      flavors: r.flavors ? (JSON.parse(r.flavors) as string[]) : [],
      options: options.map((o) => ({ id: o.id, label: o.label, price: o.price, maxFlavors: o.max_flavors })),
    };
  }

  list(sectionId?: string): CustomProduct[] {
    const rows = (
      sectionId
        ? this.db
            .prepare('SELECT * FROM custom_product WHERE section_id = ? ORDER BY sort_index, name')
            .all(sectionId)
        : this.db.prepare('SELECT * FROM custom_product ORDER BY section_id, sort_index, name').all()
    ) as ProductRow[];
    return rows.map((r) => this.hydrate(r));
  }

  get(id: string): CustomProduct | null {
    const r = this.db.prepare('SELECT * FROM custom_product WHERE id = ?').get(id) as ProductRow | undefined;
    return r ? this.hydrate(r) : null;
  }

  create(input: ProductInput): CustomProduct {
    this.assertSection(input.sectionId);
    const id = crypto.randomUUID();
    this.db.transaction(() => {
      const next = (
        this.db
          .prepare('SELECT COALESCE(MAX(sort_index), -1) + 1 AS n FROM custom_product WHERE section_id = ?')
          .get(input.sectionId) as { n: number }
      ).n;
      this.db
        .prepare(
          `INSERT INTO custom_product (id, section_id, name, description, price, flavors, sort_index)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.sectionId,
          input.name,
          input.description,
          input.price ?? null,
          input.flavors?.length ? JSON.stringify(input.flavors) : null,
          next,
        );
      this.writeOptions(id, input);
    })();
    return this.get(id)!;
  }

  update(id: string, input: ProductInput): CustomProduct | null {
    if (!this.get(id)) return null;
    this.assertSection(input.sectionId);
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE custom_product SET section_id = ?, name = ?, description = ?, price = ?, flavors = ? WHERE id = ?`,
        )
        .run(
          input.sectionId,
          input.name,
          input.description,
          input.price ?? null,
          input.flavors?.length ? JSON.stringify(input.flavors) : null,
          id,
        );
      this.db.prepare('DELETE FROM product_option WHERE product_id = ?').run(id);
      this.writeOptions(id, input);
    })();
    return this.get(id);
  }

  /** Bloquea la eliminación si el producto es componente de un combo. */
  remove(id: string): boolean {
    const used = this.db
      .prepare("SELECT 1 FROM bundle_component WHERE source = 'custom' AND product_id = ? LIMIT 1")
      .get(id);
    if (used) {
      throw new HttpError(409, 'used_in_bundle', 'Este producto forma parte de un combo. Quítalo del combo primero.');
    }
    const p = this.get(id);
    if (!p) return false;
    this.db.prepare('DELETE FROM custom_product WHERE id = ?').run(id);
    if (p.imagePath) fs.rmSync(path.join(this.uploadsDir, p.imagePath), { force: true });
    return true;
  }

  /** Reemplaza la imagen (y borra la anterior). Recibe solo el nombre de archivo. */
  setImage(id: string, file: string): boolean {
    const p = this.get(id);
    if (!p) return false;
    this.db.prepare('UPDATE custom_product SET image_path = ? WHERE id = ?').run(file, id);
    if (p.imagePath && p.imagePath !== file) fs.rmSync(path.join(this.uploadsDir, p.imagePath), { force: true });
    return true;
  }

  private writeOptions(productId: string, input: ProductInput): void {
    const ins = this.db.prepare(
      'INSERT INTO product_option (id, product_id, label, price, max_flavors) VALUES (?, ?, ?, ?, ?)',
    );
    for (const o of input.options ?? []) ins.run(crypto.randomUUID(), productId, o.label, o.price, o.maxFlavors ?? null);
  }

  private assertSection(sectionId: string): void {
    if (!this.db.prepare('SELECT 1 FROM section WHERE id = ?').get(sectionId)) {
      throw new HttpError(422, 'invalid_section', 'La sección indicada no existe.');
    }
  }
}
