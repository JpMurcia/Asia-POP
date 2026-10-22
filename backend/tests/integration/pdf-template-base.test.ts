import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from '../fixtures/pdf-harness';

/**
 * Feature 010 en Chrome real: el PDF de la plantilla Base AsianPop (foto-tarjeta, título en mayúsculas, burbuja,
 * precio y cinta AGOTADO diagonal como texto real y buscable). Sirve también de prueba de peso: las tarjetas viajan
 * por el payload y no se vuelven a reducir.
 */
let h: Harness;

const item = (url: string, id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Fideos ${id}`,
  description: `Descripción del producto ${id}`,
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'ramen' },
  images: [`${url}/img/heavy.jpg`],
  ...extra,
});

beforeAll(async () => {
  h = await startHarness({
    categories: [{ id: 'c1', name: 'ramen' }],
    items: (url) => [
      item(url, '1'),
      item(url, '2', { inventory: { availableQuantity: 0, trackInventory: true } }),
      item(url, '3', { description: 'Fideos instantáneos con caldo intenso y picante. '.repeat(9).slice(0, 400) }),
      item(url, '4'),
    ],
  });
}, 180_000);

afterAll(async () => {
  await h?.close();
});

describe('PDF de la plantilla Base AsianPop', () => {
  it('genera cuatro productos en dos páginas (3 + 1), con el título en mayúsculas y sin imágenes rotas', async () => {
    const r = await h.generate({ prepare: { templateId: 'base', sectionKeys: ['alegra:c1'] } });
    expect(r.payload.template.id).toBe('base');
    const pages = r.pageTexts.filter((t) => t.includes('Fideos'));
    expect(pages).toHaveLength(2);
    for (const t of pages) expect(t).toContain('CATÁLOGO RAMEN');
    // cada foto llegó como tarjeta generada, no como la foto original
    const photos = r.payload.sections.flatMap((s) => s.pages.flat()).map((i) => i.imageUrl);
    expect(photos).toHaveLength(4);
    for (const url of photos) expect(url).toMatch(/^\/media\/cards\/[0-9a-f]{40}\.jpg$/);
  }, 180_000);

  it('muestra AGOTADO como texto real solo en el producto agotado y la descripción de cada uno', async () => {
    const r = await h.generate({ prepare: { templateId: 'base', sectionKeys: ['alegra:c1'] } });
    const page = r.pageTexts.find((t) => t.includes('Fideos 2'))!;
    expect(page).toBeDefined();
    // Con neón, cada capa de resplandor es otra copia del texto en el PDF (igual que el nombre de cada producto): basta con que aparezca
    expect(page.match(/AGOTADO/g)!.length).toBeGreaterThanOrEqual(1);
    expect(page).toContain('Descripción del producto 2');
    expect(page).toContain('$9.000');
    // y no aparece en la página del producto disponible
    expect(r.pageTexts.find((t) => t.includes('Fideos 4'))!).not.toContain('AGOTADO');
  }, 180_000);

  it('una página con un solo producto sale completa: tarjeta, descripción y precio', async () => {
    const r = await h.generate({ prepare: { templateId: 'base', sectionKeys: ['alegra:c1'] } });
    const last = r.pageTexts.filter((t) => t.includes('Fideos'))[1]!;
    expect(last).toContain('Fideos 4');
    expect(last).toContain('Descripción del producto 4');
    expect(last).toContain('$9.000');
  }, 180_000);

  it('una descripción de 400 caracteres se reduce hasta caber en la burbuja sin salirse (FR-017)', async () => {
    const measure = `(() => [...document.querySelectorAll('[data-part="bubble"]')].map((b) => ({ over: b.scrollHeight > b.clientHeight + 1, marked: b.getAttribute('data-overflow') === 'true' })))()`;
    const r = await h.generate({ prepare: { templateId: 'base', sectionKeys: ['alegra:c1'] }, measure });
    const bubbles = r.measure as { over: boolean; marked: boolean }[];
    expect(bubbles.length).toBeGreaterThanOrEqual(4);
    expect(bubbles.some((b) => b.over || b.marked)).toBe(false);
    expect(r.textOverflow).toEqual([]);
  }, 180_000);

  it('el PDF cabe holgadamente en el límite de 25 MB', async () => {
    const r = await h.generate({ prepare: { templateId: 'base', sectionKeys: ['alegra:c1'] } });
    expect(r.pdf.length).toBeLessThan(25 * 1024 * 1024);
  }, 180_000);
});
