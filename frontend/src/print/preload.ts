import type { FontRef, Template } from '../../../backend/src/catalog/template';
import { FONT_FAMILIES, IMAGES, fontKeyOf, weightFor } from './assets';

/** Texto de muestra: pide también el subconjunto con tildes y signos del español. */
export const FONT_SAMPLE = 'AaÁáÉéÍíÓóÚúÑñ¿¡·×$0123456789';

/**
 * Las tipografías (con su peso) y las imágenes que usa una plantilla. Las fuentes de @fontsource se cargan al
 * usarse y `document.fonts.ready` no espera las que aún no se pidieron: la vista de impresión las pide de antemano
 * (y precarga las imágenes) antes de marcar `window.__printReady`.
 */
export function templateAssetRequests(template: Template): { fonts: string[]; images: string[] } {
  const fonts = new Set<string>();
  const images = new Set<string>();
  const addFont = (ref: FontRef, weight: number) => {
    const key = fontKeyOf(template, ref);
    fonts.add(`${weightFor(key, weight)} 16px "${FONT_FAMILIES[key]}"`);
  };
  for (const page of Object.values(template.pages)) {
    if (page.bg.type === 'image') images.add(IMAGES[page.bg.image]);
    for (const el of page.els) {
      if (el.type === 'text') addFont(el.font, el.weight);
      else if (el.type === 'badge') addFont(el.font, 700);
      else if (el.type === 'image') images.add(IMAGES[el.src]);
      else if (el.type !== 'shape') for (const w of [500, 600, 700]) addFont('body', w); // bloques automáticos
    }
  }
  return { fonts: [...fonts], images: [...images] };
}

async function preloadImage(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);
}

/** Pide al navegador las tipografías y las imágenes de la plantilla y espera a que estén listas. */
export async function loadTemplateAssets(template: Template): Promise<void> {
  const { fonts, images } = templateAssetRequests(template);
  await Promise.all([
    ...fonts.map((spec) => document.fonts.load(spec, FONT_SAMPLE).catch(() => [])),
    ...images.map(preloadImage),
  ]);
}
