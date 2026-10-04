/**
 * Herramienta de revisión visual (no forma parte de las pruebas automáticas): junta en una sola imagen las páginas
 * indicadas de una carpeta de capturas, para revisar una plantilla de un vistazo.
 *
 *   DIR=carpeta PAGES=1,2,4,5,11 OUT=hoja.png npx tsx backend/tests/fixtures/contact-sheet.ts
 *
 * Variables opcionales:
 *   SCALE=0.5   escala de cada página (por defecto 0,5)
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { resolveChromePath } from '../../src/pdf/pdf.service';

const dir = process.env.DIR;
const out = process.env.OUT;
if (!dir || !out) throw new Error('Indica DIR=carpeta y OUT=archivo.png');
const pages = (process.env.PAGES ?? '1,2,3,11').split(',').map((n) => n.trim().padStart(2, '0'));
const scale = Number(process.env.SCALE ?? 0.5);

const images = pages.map((n) => fs.readFileSync(path.join(dir, `page-${n}.png`)).toString('base64'));
const browser = await puppeteer.launch({ headless: true, executablePath: await resolveChromePath(), args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<body></body>');
await page.evaluate('globalThis.__name = (f) => f;');
const png = (await page.evaluate(
  async (list: string[], s: number) => {
    const load = (b64: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/png;base64,${b64}`;
      });
    const imgs = await Promise.all(list.map(load));
    const w = Math.round(imgs[0]!.width * s);
    const h = Math.round(imgs[0]!.height * s);
    const c = document.createElement('canvas');
    c.width = imgs.length * (w + 10) - 10;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#777';
    g.fillRect(0, 0, c.width, c.height);
    imgs.forEach((img, i) => g.drawImage(img, i * (w + 10), 0, w, h));
    return c.toDataURL('image/png').split(',')[1]!;
  },
  images,
  scale,
)) as string;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(png, 'base64'));
console.log('hoja guardada en', out);
await browser.close();
process.exit(0);
