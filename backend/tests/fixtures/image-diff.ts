/**
 * Herramienta de revisión visual (no forma parte de las pruebas automáticas): compara dos carpetas de capturas PNG
 * página a página (por ejemplo la línea base de 002 contra Neón Noche) y guarda, por página, una imagen con
 * "antes | después | diferencias" junto con el porcentaje de píxeles que cambian.
 *
 *   A=carpeta/base B=carpeta/nueva OUT=carpeta/salida npx tsx backend/tests/fixtures/image-diff.ts
 *
 * Variables opcionales:
 *   THRESHOLD=48   diferencia de color (suma de canales) a partir de la cual un píxel cuenta como distinto
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { resolveChromePath } from '../../src/pdf/pdf.service';

const a = process.env.A;
const b = process.env.B;
const out = process.env.OUT;
if (!a || !b || !out) throw new Error('Indica A=carpeta, B=carpeta y OUT=carpeta');
const threshold = Number(process.env.THRESHOLD ?? 48);
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(a).filter((f) => f.endsWith('.png') && fs.existsSync(path.join(b, f))).sort();
const browser = await puppeteer.launch({ headless: true, executablePath: await resolveChromePath(), args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
// tsx (esbuild) inyecta __name en las funciones que se serializan hacia la página
await page.evaluate('globalThis.__name = (f) => f;');

for (const f of files) {
  const A = fs.readFileSync(path.join(a, f)).toString('base64');
  const B = fs.readFileSync(path.join(b, f)).toString('base64');
  const res = (await page.evaluate(
    async (ia: string, ib: string, th: number) => {
      const load = (b64: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = `data:image/png;base64,${b64}`;
        });
      const [x, y] = await Promise.all([load(ia), load(ib)]);
      const w = Math.min(x.width, y.width);
      const h = Math.min(x.height, y.height);
      const data = (img: HTMLImageElement) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return { c, d: g.getImageData(0, 0, w, h) };
      };
      const A2 = data(x);
      const B2 = data(y);
      const diff = document.createElement('canvas');
      diff.width = w;
      diff.height = h;
      const dg = diff.getContext('2d')!;
      const dd = dg.createImageData(w, h);
      let changed = 0;
      for (let i = 0; i < A2.d.data.length; i += 4) {
        const s =
          Math.abs(A2.d.data[i]! - B2.d.data[i]!) +
          Math.abs(A2.d.data[i + 1]! - B2.d.data[i + 1]!) +
          Math.abs(A2.d.data[i + 2]! - B2.d.data[i + 2]!);
        const lum = (B2.d.data[i]! + B2.d.data[i + 1]! + B2.d.data[i + 2]!) / 3;
        if (s > th) {
          changed++;
          dd.data[i] = 255;
          dd.data[i + 1] = 0;
          dd.data[i + 2] = 80;
        } else {
          dd.data[i] = dd.data[i + 1] = dd.data[i + 2] = 255 - (255 - lum) * 0.25;
        }
        dd.data[i + 3] = 255;
      }
      dg.putImageData(dd, 0, 0);
      const sheet = document.createElement('canvas');
      sheet.width = w * 3 + 20;
      sheet.height = h;
      const sg = sheet.getContext('2d')!;
      sg.fillStyle = '#888';
      sg.fillRect(0, 0, sheet.width, sheet.height);
      sg.drawImage(A2.c, 0, 0);
      sg.drawImage(B2.c, w + 10, 0);
      sg.drawImage(diff, 2 * w + 20, 0);
      return { changed: (changed / (w * h)) * 100, png: sheet.toDataURL('image/png').split(',')[1]! };
    },
    A,
    B,
    threshold,
  )) as { changed: number; png: string };
  fs.writeFileSync(path.join(out, f), Buffer.from(res.png, 'base64'));
  console.log(`${f}  ${res.changed.toFixed(2)} % de píxeles distintos`);
}
await browser.close();
process.exit(0);
