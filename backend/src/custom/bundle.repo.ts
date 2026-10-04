import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { HttpError } from '../api/errors';
import type { BundlePricing } from '../catalog/bundle-pricing';
import type { Db } from '../db/database';

export const bundleSchema = z.object({
  sectionId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).default(''),
  pricing: z.discriminatedUnion('type', [
    z.object({ type: z.literal('fixed'), price: z.number().int().min(0) }),
    z.object({ type: z.literal('discount'), percent: z.number().gt(0).max(100) }),
  ]),
  components: z
    .array(
      z.object({
        source: z.enum(['alegra', 'custom']),
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, 'El combo necesita al menos un producto.')
    .max(20),
});

export type BundleInput = z.infer<typeof bundleSchema>;

export interface Bundle {
  id: string;
  sectionId: string;
  name: string;
  description: string;
  imagePath: string | null;
  pricing: BundlePricing;
  components: { source: 'alegra' | 'custom'; productId: string; quantity: number }[];
}

interface Row {
  id: string;
  section_id: string;
  name: string;
  description: string;
  image_path: string | null;
  pricing_type: 'fixed' | 'discount';
  fixed_price: number | null;
  discount_percent: number | null;
}

export class BundleRepo {
  constructor(
    private db: Db,
    private uploadsDir: string,
  ) {}

  private hydrate(r: Row): Bundle {
    const components = this.db
      .prepare('SELECT source, product_id, quantity FROM bundle_component WHERE bundle_id = ? ORDER BY rowid')
      .all(r.id) as { source: 'alegra' | 'custom'; product_id: string; quantity: number }[];
    return {
      id: r.id,
      sectionId: r.section_id,
      name: r.name,
      description: r.description,
      imagePath: r.image_path,
      pricing:
        r.pricing_type === 'fixed'
          ? { type: 'fixed', price: r.fixed_price ?? 0 }
          : { type: 'discount', percent: r.discount_percent ?? 0 },
      components: components.map((c) => ({ source: c.source, productId: c.product_id, quantity: c.quantity })),
    };
  }

  list(): Bundle[] {
    return (this.db.prepare('SELECT * FROM bundle ORDER BY section_id, name').all() as Row[]).map((r) =>
      this.hydrate(r),
    );
  }

  get(id: string): Bundle | null {
    const r = this.db.prepare('SELECT * FROM bundle WHERE id = ?').get(id) as Row | undefined;
    return r ? this.hydrate(r) : null;
  }

  create(input: BundleInput): Bundle {
    this.validate(input);
    const id = crypto.randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO bundle (id, section_id, name, description, pricing_type, fixed_price, discount_percent)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.sectionId,
          input.name,
          input.description,
          input.pricing.type,
          input.pricing.type === 'fixed' ? input.pricing.price : null,
          input.pricing.type === 'discount' ? input.pricing.percent : null,
        );
      this.writeComponents(id, input);
    })();
    return this.get(id)!;
  }

  update(id: string, input: BundleInput): Bundle | null {
    if (!this.get(id)) return null;
    this.validate(input);
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE bundle SET section_id = ?, name = ?, description = ?, pricing_type = ?, fixed_price = ?,
           discount_percent = ? WHERE id = ?`,
        )
        .run(
          input.sectionId,
          input.name,
          input.description,
          input.pricing.type,
          input.pricing.type === 'fixed' ? input.pricing.price : null,
          input.pricing.type === 'discount' ? input.pricing.percent : null,
          id,
        );
      this.db.prepare('DELETE FROM bundle_component WHERE bundle_id = ?').run(id);
      this.writeComponents(id, input);
    })();
    return this.get(id);
  }

  remove(id: string): boolean {
    const b = this.get(id);
    if (!b) return false;
    this.db.prepare('DELETE FROM bundle WHERE id = ?').run(id);
    if (b.imagePath) fs.rmSync(path.join(this.uploadsDir, b.imagePath), { force: true });
    return true;
  }

  setImage(id: string, file: string): boolean {
    const b = this.get(id);
    if (!b) return false;
    this.db.prepare('UPDATE bundle SET image_path = ? WHERE id = ?').run(file, id);
    if (b.imagePath && b.imagePath !== file) fs.rmSync(path.join(this.uploadsDir, b.imagePath), { force: true });
    return true;
  }

  private writeComponents(bundleId: string, input: BundleInput): void {
    const ins = this.db.prepare(
      'INSERT INTO bundle_component (id, bundle_id, source, product_id, quantity) VALUES (?, ?, ?, ?, ?)',
    );
    for (const c of input.components) ins.run(crypto.randomUUID(), bundleId, c.source, c.productId, c.quantity);
  }

  private validate(input: BundleInput): void {
    if (!this.db.prepare('SELECT 1 FROM section WHERE id = ?').get(input.sectionId)) {
      throw new HttpError(422, 'invalid_section', 'La sección indicada no existe.');
    }
    for (const c of input.components) {
      if (c.source === 'custom' && !this.db.prepare('SELECT 1 FROM custom_product WHERE id = ?').get(c.productId)) {
        throw new HttpError(422, 'invalid_component', 'Un producto propio del combo no existe.');
      }
    }
  }
}
