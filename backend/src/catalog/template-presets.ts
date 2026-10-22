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
  photoW: 100,
  photoH: 100,
  nameStyle: 'burbuja',
  nameColor: 'a1',
  nameFill: 'transparent',
  nameGlow: false,
  cardStyle: 'plana',
  priceGlow: false,
  soldGlow: false,
  bubbleShadow: false,
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
  base: { bg: '#11052C', a1: '#C04B0F', a2: '#FF3131', a3: '#E7DECF', ink: '#000000', paper: '#FAFAFA' },
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
          draftProducts({ x: 0, y: 10.4, w: 100, h: 85.2, ringW: 3, cardRadius: 17, bubbleRadius: 28, nameStyle: 'separado', nameFill: 'bg', nameGlow: true }),
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

/**
 * Base AsianPop (feature 010): reproduce la página de productos medida en la base de Canva «PRUEBA CATALOGO» (A4,
 * Poppins, tarjetas oscuras con el nombre en neón, burbuja beige, precio con neón y cinta AGOTADO diagonal). Medidas
 * de la página 3: título X 5,05 · Y 0,76 cm; logo de 4,06 cm a 0,3 cm del borde superior y derecho; la distribución
 * `base` coloca las tres filas. El tamaño de letra (32, 21, 14, 58) se toma 1:1 en px lógicos, suponiendo que la escala
 * de Canva son puntos de la hoja (595 pt); por confirmar con una prueba de impresión. Todos los textos llevan la altura
 * de línea 1,4 de la base. Las portadas no se midieron: llevan un diseño razonable (título grande en mayúsculas, logo
 * y contacto) y ninguna ilustración, que sube la persona responsable.
 */
function baseAsianPop(): Template {
  const lh = 1.4;
  const contact = [
    draftImage({ name: 'Ícono de contacto', src: 'chat', x: 8.5, y: 83.6, w: 4.6, h: 3.3 }),
    draftText({ name: 'Domicilios', text: 'Domicilios', font: 'body', size: 16, color: 'ink', align: 'left', lh, x: 14, y: 83.4, w: 40, h: 3.4 }),
    draftText({ name: 'Teléfonos', text: '{telefonos}', font: 'body', size: 20, color: 'ink', align: 'left', lh, x: 8.5, y: 87.4, w: 83, h: 4.6 }),
  ];
  const logoCover = draftImage({ name: 'Logo', src: 'logo', x: 33, y: 5, w: 34, h: 24 });
  const logo = draftImage({ name: 'Logo', src: 'logo', x: 79.2, y: 1, w: 19.3, h: 13.7 });
  const footer = draftFooter({ x: 0, y: 96.8, w: 100, h: 3.2, bw: 1.5 });
  const sparkle = (name: string, x: number, y: number, w: number, opacity: number) =>
    draftImage({ name, src: 'sparkle', x, y, w, h: Math.round(((w * PAGE_W) / PAGE_H) * 10) / 10, opacity, locked: true });
  const blob = (name: string, x: number, y: number, w: number) =>
    draftShape({ name, kind: 'circle', fill: 'a3', opacity: 0.45, x, y, w, h: circleHeight(w), locked: true });
  return {
    id: 'base',
    name: 'Base AsianPop',
    base: 'base',
    version: 1,
    palette: { ...PAL.base },
    fonts: { title: 'poppins', body: 'poppins' },
    pages: {
      portada: {
        bg: { ...SUNSET },
        els: els('base-p', [
          logoCover,
          draftText({ name: 'Banner', text: '{banner}', size: 54, color: 'ink', upper: true, lh, x: 6, y: 34, w: 88, h: 24 }),
          draftText({ name: 'Tienda', text: '{tienda}', font: 'body', size: 18, weight: 600, color: 'ink', upper: true, ls: 2, lh, x: 6, y: 62, w: 88, h: 4 }),
          ...contact,
        ]),
      },
      seccion: {
        bg: { ...SUNSET },
        els: els('base-s', [
          logoCover,
          draftText({ name: 'Nombre de sección', text: '{seccion}', size: 80, color: 'ink', upper: true, lh, x: 4, y: 32, w: 92, h: 18 }),
          draftIntro({ x: 14, y: 56, w: 72, h: 22 }),
          ...contact,
        ]),
      },
      productos: {
        bg: { ...MARBLE },
        els: els('base-c', [
          blob('Mancha 1', -6, 60, 28),
          blob('Mancha 2', 82, 30, 26),
          sparkle('Estrella 1', 4, 10, 7, 0.7),
          sparkle('Estrella 2', 88, 54, 6, 0.7),
          draftText({ name: 'Título de sección', text: 'CATÁLOGO {seccion}', size: 32, weight: 700, color: 'ink', upper: true, lh, x: 24.05, y: 2.56, w: 51.95, h: 8.2 }),
          logo,
          draftProducts({
            layout: 'base',
            cardStyle: 'tarjeta',
            nameStyle: 'tarjeta',
            nameColor: 'a1',
            nameGlow: true,
            cardFill: 'bg',
            ring: 'transparent',
            ringW: 0,
            cardRadius: 18,
            bubbleFill: 'a3',
            bubbleRadius: 40,
            bubbleShadow: true,
            textColor: 'ink',
            priceFill: '#1F021D',
            priceBorder: 'transparent',
            priceText: 'a1',
            priceGlow: true,
            priceShape: 'pill',
            sold: 'diagonal',
            soldFill: 'a2',
            soldGlow: true,
            descLh: lh,
            x: 0,
            y: 11,
            w: 100,
            h: 85.4,
          }),
          footer,
        ]),
      },
      politicas: {
        bg: { ...MARBLE },
        els: els('base-t', [
          draftText({ name: 'Título', text: 'Políticas de compra', size: 28, weight: 700, color: 'ink', align: 'left', lh, x: 6, y: 3.6, w: 70, h: 6 }),
          logo,
          draftTerms({ x: 7, y: 15, w: 86, h: 79.6 }),
          footer,
        ]),
      },
    },
  };
}

const FACTORIES: Record<BaseId, () => Template> = { neon, pop, kawaii, kraft, base: baseAsianPop };

/** Las plantillas base, en el orden de la galería (Base AsianPop, de la feature 010, al final). */
export const BASE_TEMPLATES: Template[] = [neon(), pop(), kawaii(), kraft(), baseAsianPop()];

/** Una copia independiente de la plantilla base: se puede modificar sin afectar a las demás llamadas. */
export function baseTemplate(id: BaseId): Template {
  return FACTORIES[id]();
}

/** Los seis campos que la feature 007 agregó al bloque de productos, con su valor de fábrica por plantilla. */
const NEON_PRODUCT_DEFAULTS = {
  photoW: 100,
  photoH: 100,
  nameStyle: 'separado',
  nameColor: 'a1',
  nameFill: 'bg',
  nameGlow: true,
} as const satisfies Partial<ProductsEl>;
const OTHER_PRODUCT_DEFAULTS = {
  photoW: 100,
  photoH: 100,
  nameStyle: 'burbuja',
  nameColor: 'a1',
  nameFill: 'transparent',
  nameGlow: false,
} as const satisfies Partial<ProductsEl>;

/** Los campos que la feature 010 agregó al bloque de productos: su valor de fábrica es el comportamiento anterior. */
const CARD_PRODUCT_DEFAULTS = {
  cardStyle: 'plana',
  priceGlow: false,
  soldGlow: false,
  bubbleShadow: false,
} as const satisfies Partial<ProductsEl>;

/**
 * Completa los campos del bloque de productos que falten en una plantilla guardada antes de la feature 007: la de
 * id `neon` recibe el nombre separado en neón de Neón Noche y cualquier otra el nombre dentro de la burbuja, de modo
 * que solo Neón Noche cambia de aspecto. Los campos de la feature 010 (`cardStyle`, `priceGlow`, `soldGlow`,
 * `bubbleShadow`) se completan con su valor anterior; `descLh` queda ausente a propósito. Pura e idempotente: devuelve una copia, no toca los campos presentes y no
 * escribe en ninguna parte (lo guardado cambia cuando la persona pulsa Guardar en Apariencia).
 */
export function normalizeProductsBlocks(template: Template): Template {
  const defaults = template.id === 'neon' ? NEON_PRODUCT_DEFAULTS : OTHER_PRODUCT_DEFAULTS;
  const out = structuredClone(template);
  for (const page of Object.values(out.pages)) {
    page.els = page.els.map((el) => {
      if (el.type !== 'products') return el;
      const present = Object.fromEntries(Object.entries(el).filter(([, v]) => v !== undefined));
      return { ...CARD_PRODUCT_DEFAULTS, ...defaults, ...present } as ProductsEl;
    });
  }
  return out;
}
