import fs from 'node:fs';
import path from 'node:path';
import type { AppContext } from '../context';
import { BundleRepo } from '../custom/bundle.repo';
import { CustomProductRepo } from '../custom/custom-product.repo';
import { OmittedItemRepo } from '../custom/omitted-item.repo';
import { OverrideRepo } from '../custom/override.repo';
import { SectionRepo } from '../custom/section.repo';
import type { BundleBuilderInput, CustomSectionInput } from './catalog-builder';
import { BusinessSettingsRepo, SectionOrderRepo } from './settings.repo';
import type { BusinessInfo, Term } from './types';

/** Datos locales (no son de Alegra) que necesita `buildCatalog`; los comparten `prepare` y el resumen de Inicio. */
export interface LocalCatalogInputs {
  config: BusinessInfo;
  terms: Term[];
  customSections: CustomSectionInput[];
  bundles: BundleBuilderInput[];
  overrides: Map<string, string>;
  /** Artículos de Alegra que la persona omitió del catálogo (feature 006). */
  omittedIds: Set<string>;
  sectionOrder: string[];
}

export function loadLocalInputs(ctx: AppContext): LocalCatalogInputs {
  const { terms, ...config } = new BusinessSettingsRepo(ctx.db).get();
  return {
    config,
    terms,
    customSections: loadCustomSections(ctx),
    bundles: loadBundles(ctx),
    overrides: new OverrideRepo(ctx.db).all(),
    omittedIds: new OmittedItemRepo(ctx.db).all(),
    sectionOrder: new SectionOrderRepo(ctx.db).get(),
  };
}

function uploadedImage(ctx: AppContext, file: string | null): string | null {
  return file && fs.existsSync(path.join(ctx.uploadsDir, file)) ? `/media/uploads/${file}` : null;
}

function loadBundles(ctx: AppContext): BundleBuilderInput[] {
  return new BundleRepo(ctx.db, ctx.uploadsDir).list().map((b) => ({
    id: b.id,
    sectionKey: `custom:${b.sectionId}`,
    name: b.name,
    description: b.description,
    imageUrl: uploadedImage(ctx, b.imagePath),
    pricing: b.pricing,
    components: b.components,
  }));
}

/** Secciones propias con sus productos; una imagen faltante en disco cuenta como "sin imagen". */
function loadCustomSections(ctx: AppContext): CustomSectionInput[] {
  const products = new CustomProductRepo(ctx.db, ctx.uploadsDir).list();
  return new SectionRepo(ctx.db, ctx.uploadsDir).list().map((s) => ({
    key: `custom:${s.id}`,
    name: s.name,
    introText: s.introText,
    products: products
      .filter((p) => p.sectionId === s.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: uploadedImage(ctx, p.imagePath),
        price: p.price,
        options: p.options.map((o) => ({ label: o.label, price: o.price, maxFlavors: o.maxFlavors })),
        flavors: p.flavors,
      })),
  }));
}
