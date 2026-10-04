/**
 * Las cuatro plantillas base (Neón Noche, Pop crema, Kawaii pastel y Kraft minimal), las paletas sugeridas y los
 * pares tipográficos. Módulo PURO: lo importan el servidor (siembra) y el editor ("Nueva plantilla", "Restaurar
 * colores originales"). Los valores salen del mockup `Apariencia Editor.dc.html`; **Neón Noche** se calibra contra
 * el PDF de la feature 002 (valores de `print.css` × 0,75, porque la hoja de 002 mide 794 px y la lógica 595,28).
 */

import {
  CIRCLE_RADIUS,
  PAGE_H,
  PAGE_W,
  type BadgeEl,
  type BaseId,
  type FooterEl,
  type FontKey,
  type ImageEl,
  type IntroEl,
  type Page,
  type PageElement,
  type Palette,
  type ProductsEl,
  type ShapeEl,
  type TermsEl,
  type Template,
  type TextEl,
} from './template';

// ---------------------------------------------------------------------------------------------------------------
// Fábricas de elementos (también las usa el editor para "Agregar …")
// ---------------------------------------------------------------------------------------------------------------

/** Un elemento sin id: quien lo coloca en una página le asigna uno único. */
export type ElementDraft = PageElement extends infer E ? (E extends PageElement ? Omit<E, 'id'> : never) : never;

const free = { rot: 0, opacity: 1, visible: true, locked: false } as const;
/** Los bloques automáticos nacen bloqueados. */
const block = { rot: 0, opacity: 1, visible: true, locked: true } as const;

export const draftText = (o: Partial<Omit<TextEl, 'id'>> = {}): Omit<TextEl, 'id'> => ({
  ...free,
  type: 'text',
  text: 'Escribe aquí',
  font: 'title',
  size: 40,
  weight: 700,
  color: 'ink',
  stroke: 'none',
  strokeW: 0,
  glow: 'none',
  align: 'center',
  upper: false,
  ls: 0,
  x: 10,
  y: 10,
  w: 80,
  h: 10,
  ...o,
});

export const draftBadge = (o: Partial<Omit<BadgeEl, 'id'>> = {}): Omit<BadgeEl, 'id'> => ({
  ...free,
  type: 'badge',
  text: 'NUEVO',
  fill: 'a1',
  color: '#FFFFFF',
  font: 'title',
  size: 16,
  rot: -6,
  x: 70,
  y: 5,
  w: 22,
  h: 5,
  ...o,
});

export const draftShape = (o: Partial<Omit<ShapeEl, 'id'>> = {}): Omit<ShapeEl, 'id'> => ({
  ...free,
  type: 'shape',
  kind: 'rect',
  fill: 'a1',
  border: 'none',
  bw: 0,
  radius: 12,
  glow: 'none',
  x: 30,
  y: 42,
  w: 40,
  h: 16,
  ...o,
});

export const draftImage = (o: Partial<Omit<ImageEl, 'id'>> = {}): Omit<ImageEl, 'id'> => ({
  ...free,
  type: 'image',
  src: 'collage',
  fit: 'contain',
  radius: 0,
  x: 10,
  y: 35,
  w: 80,
  h: 30,
  ...o,
});

const draftIntro = (o: Partial<Omit<IntroEl, 'id'>> = {}): Omit<IntroEl, 'id'> => ({
  ...block,
  type: 'intro',
  name: 'Introducción',
  boxFill: '#E8DFD0',
  textColor: '#1C1126',
  radius: 22,
  x: 14,
  y: 56,
  w: 72,
  h: 26,
  ...o,
});

const draftProducts = (o: Partial<Omit<ProductsEl, 'id'>> = {}): Omit<ProductsEl, 'id'> => ({
  ...block,
  type: 'products',
  name: 'Productos',
  layout: 'alternado',
  cardFill: 'bg',
  ring: 'a2',
  ringW: 4,
  cardRadius: 16,
  bubbleFill: '#E8DFD0',
  bubbleRadius: 20,
  textColor: '#1C1126',
  priceFill: 'bg',
  priceBorder: 'a3',
  priceText: '#FFFFFF',
  priceShape: 'pill',
  sold: 'sello',
  soldFill: 'a1',
  x: 4,
  y: 12,
  w: 92,
  h: 80,
  ...o,
});

const draftTerms = (o: Partial<Omit<TermsEl, 'id'>> = {}): Omit<TermsEl, 'id'> => ({
  ...block,
  type: 'terms',
  name: 'Políticas',
  chipFill: 'bg',
  chipText: 'a1',
  boxFill: '#E8DFD0',
  textColor: '#1C1126',
  x: 7,
  y: 14,
  w: 86,
  h: 76,
  ...o,
});

const draftFooter = (o: Partial<Omit<FooterEl, 'id'>> = {}): Omit<FooterEl, 'id'> => ({
  ...block,
  type: 'footer',
  name: 'Pie de página',
  content: '{telefonos} · {direccion}',
  fill: 'bg',
  line: 'a3',
  bw: 2,
  textColor: '#FFFFFF',
  x: 0,
  y: 95.5,
  w: 100,
  h: 4.5,
  ...o,
});

/** Alto (en % de la hoja) de un círculo cuyo ancho es `w` %: la hoja no es cuadrada. */
export const circleHeight = (w: number): number => Math.round(((w * PAGE_W) / PAGE_H) * 10) / 10;

/** Asigna ids deterministas (`<prefijo>1`, `<prefijo>2`…) para que las plantillas base sean estables. */
const els = (prefix: string, drafts: ElementDraft[]): PageElement[] =>
  drafts.map((d, i) => ({ ...d, id: `${prefix}${i + 1}` }) as PageElement);

// ---------------------------------------------------------------------------------------------------------------
// Paletas y tipografías
// ---------------------------------------------------------------------------------------------------------------

/**
 * Paletas del mockup. Neón Noche difiere en un solo valor: el texto es `#1C1126` (el del PDF de 002) en lugar de
 * blanco, porque blanco sobre el papel `#F4EFE8` daría una advertencia de contraste en la plantilla de fábrica.
 */
const PAL = {
  neon: { bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' },
  pop: { bg: '#2A1258', a1: '#E5368C', a2: '#FFB800', a3: '#E5368C', ink: '#2A1258', paper: '#FFF7EC' },
  kawaii: { bg: '#FFD6E5', a1: '#FF5C93', a2: '#7ED8C3', a3: '#FFB84D', ink: '#5A2E4A', paper: '#FFF3F7' },
  kraft: { bg: '#1C1A17', a1: '#D9502F', a2: '#1C1A17', a3: '#D9502F', ink: '#1C1A17', paper: '#EFE6D6' },
  matcha: { bg: '#1F3B2D', a1: '#8FCB5E', a2: '#F4E8C1', a3: '#E86F51', ink: '#1F3B2D', paper: '#F6F1E3' },
} as const satisfies Record<string, Palette>;

export const PALETTE_PRESETS: { name: string; palette: Palette }[] = [
  { name: 'Neón Noche', palette: { ...PAL.neon } },
  { name: 'Pop crema', palette: { ...PAL.pop } },
  { name: 'Kawaii', palette: { ...PAL.kawaii } },
  { name: 'Kraft', palette: { ...PAL.kraft } },
  { name: 'Matcha', palette: { ...PAL.matcha } },
];

export const FONT_PAIRS: { title: FontKey; body: FontKey }[] = [
  { title: 'fredoka', body: 'poppins' },
  { title: 'bungee', body: 'poppins' },
  { title: 'zen', body: 'zen' },
  { title: 'serif', body: 'grotesk' },
  { title: 'grotesk', body: 'grotesk' },
];

// ---------------------------------------------------------------------------------------------------------------
// Plantillas base
// ---------------------------------------------------------------------------------------------------------------

const MARBLE = { type: 'image', image: 'marble', color: 'paper', color2: 'a1' } as const;
const SUNSET = { type: 'image', image: 'coverbg', color: 'bg', color2: 'a1' } as const;
const solid = (color: string, color2: string): Page['bg'] => ({ type: 'color', image: 'marble', color, color2 });

/**
 * Neón Noche: reproduce el catálogo de 002 (portadas sobre el atardecer con el marco, páginas de producto sobre
 * mármol con tarjetas oscuras). Los porcentajes salen de `print.css`; los px se multiplican por 0,75. Diferencias
 * aceptadas: los teléfonos van como texto (sin los íconos de WhatsApp) y los títulos usan Fredoka 700.
 */
function neon(): Template {
  const frame = draftImage({ name: 'Marco', src: 'frame', fit: 'fill', x: 1.4, y: 0, w: 97.2, h: 100, locked: true });
  const contact = [
    draftText({ name: 'Domicilios', text: 'Domicilios', font: 'body', size: 16, color: '#3A0F4D', align: 'right', x: 27, y: 84, w: 62, h: 3.4 }),
    draftText({ name: 'Teléfonos', text: '{telefonos}', font: 'body', size: 22, color: '#3A0F4D', align: 'right', x: 27, y: 87.6, w: 62, h: 5 }),
  ];
  const logo = draftImage({ name: 'Logo', src: 'logo', x: 79.5, y: 1.2, w: 17, h: 12 });
  const footer = draftFooter({ x: 0, y: 96.8, w: 100, h: 3.2, bw: 1.5 });
  return {
    id: 'neon',
    name: 'Neón Noche',
    base: 'neon',
    version: 1,
    palette: { ...PAL.neon },
    fonts: { title: 'fredoka', body: 'poppins' },
    pages: {
      portada: {
        bg: { ...SUNSET },
        els: els('neon-p', [
          frame,
          draftText({ name: 'Banner', text: '{banner}', size: 30, color: 'bg', glow: 'a1', x: 6, y: 27.5, w: 88, h: 8.2 }),
          draftImage({ name: 'Collage', src: 'collage', x: 14.9, y: 37.9, w: 78.8, h: 41 }),
          ...contact,
        ]),
      },
      seccion: {
        bg: { ...SUNSET },
        els: els('neon-s', [
          frame,
          draftText({ name: 'Nombre de sección', text: '{seccion}', size: 88, color: 'bg', stroke: 'a1', strokeW: 3, x: 4, y: 32.2, w: 92, h: 18 }),
          draftIntro({ x: 14, y: 56, w: 72, h: 26 }),
          ...contact,
        ]),
      },
      productos: {
        bg: { ...MARBLE },
        els: els('neon-c', [
          draftText({ name: 'Título de sección', text: 'Catálogo {seccion}', size: 26, color: '#111111', upper: true, ls: 0.4, x: 21, y: 1.5, w: 58, h: 6.8 }),
          logo,
          draftProducts({ x: 0, y: 10.4, w: 100, h: 85.2, ringW: 3, cardRadius: 17, bubbleRadius: 28 }),
          footer,
        ]),
      },
      politicas: {
        bg: { ...MARBLE },
        els: els('neon-t', [
          draftText({ name: 'Título', text: 'Políticas de compra', size: 24, color: '#111111', align: 'left', x: 6, y: 3.6, w: 70, h: 6 }),
          logo,
          draftTerms({ x: 7, y: 15, w: 86, h: 79.6 }),
          footer,
        ]),
      },
    },
  };
}

/** Pop crema: morado y rosa sobre crema, círculos de color. */
function pop(): Template {
  return {
    id: 'pop',
    name: 'Pop crema',
    base: 'pop',
    version: 1,
    palette: { ...PAL.pop },
    fonts: { title: 'fredoka', body: 'poppins' },
    pages: {
      portada: {
        bg: solid('paper', 'a2'),
        els: els('pop-p', [
          draftShape({ name: 'Círculo', kind: 'circle', fill: 'a2', x: -12, y: 42, w: 124, h: circleHeight(124) }),
          draftImage({ name: 'Logo', src: 'logo', fit: 'cover', radius: CIRCLE_RADIUS, x: 6, y: 4, w: 14, h: 9.9 }),
          draftText({ name: 'Tienda', text: '{tienda}', font: 'body', size: 13, weight: 900, color: 'ink', ls: 2, align: 'left', x: 23, y: 6.5, w: 60, h: 5 }),
          draftText({ name: 'Banner', text: '{banner}', size: 54, color: 'a1', x: 6, y: 17, w: 88, h: 18 }),
          draftImage({ name: 'Collage', src: 'collage', x: 4, y: 40, w: 92, h: 46 }),
          draftText({ name: 'Teléfonos', text: '{telefonos}', font: 'body', size: 15, weight: 700, color: 'ink', x: 8, y: 90, w: 84, h: 5 }),
        ]),
      },
      seccion: {
        bg: solid('a1', 'a2'),
        els: els('pop-s', [
          draftShape({ name: 'Círculo', kind: 'circle', fill: 'a2', x: 15, y: 29, w: 70, h: circleHeight(70) }),
          draftText({ name: 'Nombre de sección', text: '{seccion}', size: 84, color: 'bg', x: 5, y: 42, w: 90, h: 16 }),
          draftIntro({ boxFill: 'paper', textColor: 'bg', x: 14, y: 61, w: 72, h: 20 }),
          draftText({ name: 'Tienda', text: '{tienda}', font: 'body', size: 14, weight: 900, color: 'paper', ls: 3, x: 10, y: 90, w: 80, h: 4 }),
        ]),
      },
      productos: {
        bg: solid('paper', 'a2'),
        els: els('pop-c', [
          draftText({ name: 'Título de sección', text: '{seccion}', size: 48, color: 'a1', x: 10, y: 2.5, w: 80, h: 8 }),
          draftProducts({ cardFill: '#FFFFFF', ring: 'a2', ringW: 5, cardRadius: 28, bubbleFill: '#FFFFFF', textColor: '#2A1258', priceFill: 'a1', priceBorder: 'none', priceText: '#FFFFFF' }),
          draftFooter({ fill: 'bg', line: 'a2' }),
        ]),
      },
      politicas: {
        bg: solid('paper', 'a2'),
        els: els('pop-t', [
          draftText({ name: 'Título', text: 'Políticas de compra', size: 40, color: 'a1', x: 8, y: 4, w: 84, h: 8 }),
          draftTerms({ chipFill: 'a1', chipText: '#FFFFFF', boxFill: '#FFFFFF', textColor: '#2A1258' }),
          draftFooter({ fill: 'bg', line: 'a2' }),
        ]),
      },
    },
  };
}

/** Kawaii pastel: rosa, menta y ámbar con letras Zen Maru Gothic. */
function kawaii(): Template {
  const gradient: Page['bg'] = { type: 'gradient', image: 'marble', color: 'bg', color2: 'paper' };
  return {
    id: 'kawaii',
    name: 'Kawaii pastel',
    base: 'kawaii',
    version: 1,
    palette: { ...PAL.kawaii },
    fonts: { title: 'zen', body: 'zen' },
    pages: {
      portada: {
        bg: gradient,
        els: els('kawaii-p', [
          draftShape({ name: 'Círculo menta', kind: 'circle', fill: 'a2', x: 62, y: -6, w: 50, h: circleHeight(50) }),
          draftShape({ name: 'Círculo ámbar', kind: 'circle', fill: 'a3', x: -10, y: 80, w: 34, h: circleHeight(34) }),
          draftText({ name: 'Banner', text: '{banner}', size: 48, weight: 900, color: 'ink', x: 8, y: 14, w: 84, h: 18 }),
          draftBadge({ name: 'Insignia', text: 'NUEVO', fill: 'a1', x: 70, y: 33, w: 20, h: 4.5, rot: -8 }),
          draftImage({ name: 'Collage', src: 'collage', x: 4, y: 40, w: 92, h: 44 }),
          draftText({ name: 'Teléfonos', text: '{telefonos}', font: 'body', size: 15, weight: 700, color: 'ink', x: 8, y: 89, w: 84, h: 5 }),
        ]),
      },
      seccion: {
        bg: solid('paper', 'bg'),
        els: els('kawaii-s', [
          draftShape({ name: 'Círculo', kind: 'circle', fill: 'bg', x: 10, y: 26, w: 80, h: circleHeight(80) }),
          draftText({ name: 'Nombre de sección', text: '{seccion}', size: 80, weight: 900, color: 'a1', x: 5, y: 42, w: 90, h: 16 }),
          draftIntro({ boxFill: '#FFFFFF', textColor: '#5A2E4A', x: 20, y: 60, w: 60, h: 20 }),
        ]),
      },
      productos: {
        bg: solid('paper', 'bg'),
        els: els('kawaii-c', [
          draftText({ name: 'Título de sección', text: '{seccion}', size: 46, weight: 900, color: 'a1', x: 10, y: 3, w: 80, h: 8 }),
          draftProducts({ layout: 'tarjetas', y: 16, h: 76, cardFill: '#FFFFFF', ring: 'a2', ringW: 3, cardRadius: 24, bubbleFill: '#FFFFFF', bubbleRadius: 18, textColor: '#5A2E4A', priceFill: 'a3', priceBorder: 'none', priceText: '#5A2E4A', sold: 'cinta' }),
          draftFooter({ fill: 'a1', line: 'a2', textColor: '#FFFFFF' }),
        ]),
      },
      politicas: {
        bg: solid('paper', 'bg'),
        els: els('kawaii-t', [
          draftText({ name: 'Título', text: 'Políticas de compra', size: 38, weight: 900, color: 'a1', x: 8, y: 4, w: 84, h: 8 }),
          draftTerms({ chipFill: 'a1', chipText: '#FFFFFF', boxFill: '#FFFFFF', textColor: '#5A2E4A' }),
          draftFooter({ fill: 'a1', line: 'a2', textColor: '#FFFFFF' }),
        ]),
      },
    },
  };
}

/** Kraft minimal: papel kraft, tinta oscura y tipografía serif, alineada a la izquierda. */
function kraft(): Template {
  return {
    id: 'kraft',
    name: 'Kraft minimal',
    base: 'kraft',
    version: 1,
    palette: { ...PAL.kraft },
    fonts: { title: 'serif', body: 'grotesk' },
    pages: {
      portada: {
        bg: solid('paper', 'a1'),
        els: els('kraft-p', [
          draftText({ name: 'Tienda', text: '{tienda}', font: 'body', size: 13, weight: 700, ls: 3, upper: true, align: 'left', x: 8, y: 6, w: 84, h: 4 }),
          draftText({ name: 'Banner', text: '{banner}', size: 58, weight: 400, align: 'left', x: 8, y: 12, w: 84, h: 20 }),
          draftShape({ name: 'Línea', fill: 'ink', radius: 0, x: 8, y: 34, w: 84, h: 0.3 }),
          draftImage({ name: 'Collage', src: 'collage', x: 4, y: 39, w: 92, h: 46 }),
          draftText({ name: 'Teléfonos', text: '{telefonos}', font: 'body', size: 14, weight: 600, align: 'left', x: 8, y: 90, w: 84, h: 4 }),
        ]),
      },
      seccion: {
        bg: solid('bg', 'a1'),
        els: els('kraft-s', [
          draftShape({ name: 'Línea', fill: 'a1', radius: 0, x: 8, y: 59.5, w: 20, h: 0.6 }),
          draftText({ name: 'Nombre de sección', text: '{seccion}', size: 72, weight: 400, color: 'paper', align: 'left', x: 8, y: 39, w: 84, h: 19 }),
          draftIntro({ boxFill: 'transparent', textColor: 'paper', radius: 0, x: 8, y: 62, w: 84, h: 22 }),
        ]),
      },
      productos: {
        bg: solid('paper', 'a1'),
        els: els('kraft-c', [
          draftText({ name: 'Título de sección', text: '{seccion}', size: 44, weight: 400, align: 'left', x: 6, y: 3, w: 88, h: 7 }),
          draftProducts({ layout: 'lista', x: 6, y: 12, w: 88, h: 80, cardFill: '#FFFFFF', ring: 'ink', ringW: 0, cardRadius: 0, bubbleFill: 'transparent', bubbleRadius: 0, textColor: '#1C1A17', priceFill: 'transparent', priceBorder: 'ink', priceText: '#1C1A17', priceShape: 'square', sold: 'gris' }),
          draftFooter({ fill: 'paper', line: 'ink', textColor: '#1C1A17', bw: 1 }),
        ]),
      },
      politicas: {
        bg: solid('paper', 'a1'),
        els: els('kraft-t', [
          draftText({ name: 'Título', text: 'Políticas de compra', size: 38, weight: 400, align: 'left', x: 7, y: 4, w: 86, h: 8 }),
          draftTerms({ chipFill: 'transparent', chipText: 'a1', boxFill: 'transparent', textColor: '#1C1A17' }),
          draftFooter({ fill: 'paper', line: 'ink', textColor: '#1C1A17', bw: 1 }),
        ]),
      },
    },
  };
}

const FACTORIES: Record<BaseId, () => Template> = { neon, pop, kawaii, kraft };

/** Las cuatro plantillas base, en el orden de la galería. */
export const BASE_TEMPLATES: Template[] = [neon(), pop(), kawaii(), kraft()];

/** Una copia independiente de la plantilla base: se puede modificar sin afectar a las demás llamadas. */
export function baseTemplate(id: BaseId): Template {
  return FACTORIES[id]();
}
