/**
 * Herramienta de revisión visual (no forma parte de las pruebas automáticas): guarda como PNG las páginas
 * indicadas de un PDF para compararlas a ojo (por ejemplo `docs/Cat.pdf` contra un catálogo generado).
 *
 *   PDF=docs/Cat.pdf PAGES=1,3,38 OUT=carpeta npx tsx backend/tests/fixtures/pdf-pages.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const file = process.env.PDF;
const out = process.env.OUT;
if (!file || !out) throw new Error('Indica PDF=ruta.pdf y OUT=carpeta');
const pages = (process.env.PAGES ?? '1').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });

const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
const shots = await parser.getScreenshot({ partial: pages, desiredWidth: 794 });
for (const p of shots.pages) {
  const name = path.join(out, `${path.basename(file, '.pdf')}-p${String(p.pageNumber).padStart(2, '0')}.png`);
  fs.writeFileSync(name, Buffer.from(p.data));
  console.log('guardada', name);
}
await parser.destroy();
