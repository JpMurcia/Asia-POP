import fs from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer';

const FALLBACK_BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
];

/** Usa la ruta configurada; si Puppeteer no tiene su Chrome descargado, recurre a Chrome/Edge instalados. */
export async function resolveChromePath(configured?: string): Promise<string | undefined> {
  if (configured) return configured;
  try {
    const own = await puppeteer.executablePath();
    if (own && fs.existsSync(own)) return undefined; // el de Puppeteer sirve
  } catch {
    /* sigue con los alternativos */
  }
  return FALLBACK_BROWSERS.find((p) => fs.existsSync(p));
}

export interface PdfRenderer {
  /** Abre la URL (con la cookie de sesión dada) y devuelve el PDF A4. */
  render(url: string, sessionId: string): Promise<Buffer>;
  close(): Promise<void>;
}

/** Puppeteer con navegador reutilizado entre generaciones. */
export class PuppeteerRenderer implements PdfRenderer {
  private browser?: Browser;

  constructor(private chromePath?: string) {}

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: await resolveChromePath(this.chromePath),
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async render(url: string, sessionId: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setCookie({ name: 'sid', value: sessionId, url: new URL(url).origin });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 90_000 });
      await page.waitForFunction('window.__printReady === true', { timeout: 60_000 });
      // Una foto de producto que no cargó (copia local borrada o dañada) aborta la generación: nunca se imprime
      // un recuadro roto ni se entrega un PDF parcial (principio II)
      const broken = Number(await page.evaluate('window.__printBrokenImages ?? 0'));
      if (broken > 0) throw new Error(`No se pudo cargar la foto de ${broken} producto(s); no se generó el PDF.`);
      await page.evaluate('document.fonts.ready');
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = undefined;
  }
}
