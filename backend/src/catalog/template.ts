/**
 * Plantillas del catálogo: tipos, constantes y reglas puras que comparten el servidor y el editor.
 * Módulo PURO: no debe importar nada de Node, porque el frontend lo usa para dibujar páginas, validar colores
 * y calcular advertencias. La validación con zod vive aparte (`template.schema.ts`, solo servidor).
 */

import { contrastRatio, isHexColor } from './theme';
import type { BusinessInfo, BusinessSettings } from './types';

// ---------------------------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------------------------

/** A4 en puntos (1 pt = 4/3 px CSS): la página se dibuja en px lógicos y se escala. */
export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
/** Tamaño mínimo legible de un texto que se reduce para caber (FR-031). */
export const MIN_FONT_PX = 6;

export const PAGE_KEYS = ['portada', 'seccion', 'productos', 'politicas'] as const;
export const PALETTE_KEYS = ['bg', 'a1', 'a2', 'a3', 'ink', 'paper'] as const;
export const FONT_KEYS = ['fredoka', 'poppins', 'bungee', 'zen', 'grotesk', 'serif'] as const;
export const IMAGE_KEYS = ['logo', 'collage', 'marble', 'coverbg', 'frame', 'sparkle', 'chat'] as const;
export const BASE_IDS = ['neon', 'pop', 'kawaii', 'kraft', 'base'] as const;
export const AUTO_BLOCK_TYPES = ['intro', 'products', 'terms', 'footer'] as const;
export const TOKEN_NAMES = ['banner', 'seccion', 'telefonos', 'direccion', 'tienda'] as const;
export const WEIGHTS = [400, 600, 700, 900] as const;
/**
 * Dónde va el nombre de un producto: en un rótulo aparte de la burbuja o dentro de ella (feature 007) o dentro de la
 * foto-tarjeta generada (feature 010).
 */
export const NAME_STYLES = ['separado', 'burbuja', 'tarjeta'] as const;
/** Cómo se dibuja la foto de un producto: la foto tal cual (`plana`) o la foto-tarjeta generada por el servidor (feature 010). */
export const CARD_STYLES = ['plana', 'tarjeta'] as const;
/** Una imagen subida por la persona responsable se guarda como `upload:<archivo>` (feature 010). */
export const UPLOAD_IMAGE_RE = /^upload:[A-Za-z0-9._-]+$/;

export type PageKey = (typeof PAGE_KEYS)[number];
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type FontKey = (typeof FONT_KEYS)[number];
export type ImageKey = (typeof IMAGE_KEYS)[number];
export type BaseId = (typeof BASE_IDS)[number];
export type AutoBlockType = (typeof AUTO_BLOCK_TYPES)[number];
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Weight = (typeof WEIGHTS)[number];
export type NameStyle = (typeof NAME_STYLES)[number];
export type CardStyle = (typeof CARD_STYLES)[number];
/** Una imagen de la galería fija o una subida por la persona responsable (`upload:<archivo>`). */
export type ImageSrc = ImageKey | `upload:${string}`;

/** Fuente de un texto: la de título, la de cuerpo de la plantilla o una de las seis familias. */
export type FontRef = 'title' | 'body' | FontKey;
/** Clave de paleta, `#RRGGBB`, `none` o `transparent`. */
export type ColorRef = string;

export const PAGE_LABELS: Record<PageKey, string> = {
  portada: 'Portada',
  seccion: 'Portada de sección',
  productos: 'Productos',
  politicas: 'Políticas',
};
export const PALETTE_LABELS: Record<PaletteKey, string> = {
  bg: 'Fondo',
  a1: 'Acento 1',
  a2: 'Acento 2',
  a3: 'Acento 3',
  ink: 'Texto',
  paper: 'Papel',
};
/** Nombre de cada tipo de elemento en el editor (lista de capas, inspector). */
export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: 'Texto',
  badge: 'Insignia',
  shape: 'Forma',
  image: 'Imagen',
  intro: 'Bloque de introducción',
  products: 'Bloque de productos',
  terms: 'Bloque de políticas',
  footer: 'Pie de página',
};
export const FONT_LABELS: Record<FontKey, string> = {
  fredoka: 'Fredoka',
  poppins: 'Poppins',
  bungee: 'Bungee',
  zen: 'Zen Maru Gothic',
  grotesk: 'Space Grotesk',
  serif: 'DM Serif Display',
};

/** Límites defensivos (FR-018). */
export const LIMITS = {
  templates: 30,
  elementsPerPage: 60,
  nameMax: 60,
  textMax: 500,
  idMax: 40,
} as const;

/** Rangos `[mín, máx]` de las propiedades numéricas (FR-011, FR-012); los comparten el esquema y el inspector. */
export const RANGES = {
  x: [-300, 400],
  y: [-300, 400],
  w: [3, 500],
  h: [0.3, 500],
  rot: [-180, 180],
  opacity: [0, 1],
  textSize: [8, 140],
  strokeW: [0, 8],
  /** Espaciado entre letras, en píxeles (feature 008: de −2…12 a −10…60; contiene por completo el rango anterior). */
  ls: [-10, 60],
  /** Altura de línea del texto, como múltiplo del tamaño de la letra (feature 007; 008 baja el mínimo de 0,8 a 0,5). */
  lh: [0.5, 2.5],
  badgeSize: [8, 48],
  shapeBw: [0, 12],
  shapeRadius: [0, 80],
  imageRadius: [0, 300],
  introRadius: [0, 60],
  ringW: [0, 10],
  cardRadius: [0, 80],
  bubbleRadius: [0, 40],
  footerBw: [0, 6],
  /** Tamaño de la foto de un producto, en % de su tamaño original en la distribución elegida (feature 007). */
  photoScale: [50, 150],
  /** Sombra del texto (feature 011): distancia y desenfoque en px, dirección en grados (0 = derecha, 90 = abajo). */
  shDist: [0, 50],
  shAngle: [-180, 180],
  shBlur: [0, 50],
  /** Transparencia de la sombra y del fondo del texto: 0 = invisible, 100 = opaco. */
  alpha: [0, 100],
  /** Fondo del texto (feature 011): esquinas y separación, en px. */
  bgRadius: [0, 50],
  bgPad: [0, 40],
  /** Efectos de texto estilo Canva (feature 012): distancia de las copias (px), intensidad del brillo y curvatura del arco. */
  fxDist: [0, 40],
  fxI: [0, 100],
  curve: [-100, 100],
} as const satisfies Record<string, readonly [number, number]>;

/**
 * Tamaño mínimo de la zona de productos (`w` y `h` del bloque, en % de la página). El rango genérico de `w` y `h`
 * dejaría una zona de 3 %, donde ninguna fila cabe; el esquema lo exige solo al bloque de productos (feature 007).
 */
export const PRODUCTS_ZONE_MIN = { w: 40, h: 30 } as const;

/** `true` si la plantilla dibuja la foto-tarjeta generada: un bloque de productos visible con `cardStyle: 'tarjeta'` (feature 010). */
export function usesPhotoCards(template: Pick<Template, 'pages'>): boolean {
  return template.pages.productos.els.some((el) => el.type === 'products' && el.visible && el.cardStyle === 'tarjeta');
}

/** Un `radius` de imagen en este valor o más es un círculo. */
export const CIRCLE_RADIUS = 300;

/** Tipos de forma (feature 013 suma los seis últimos; `line` es la línea con extremos). */
export const SHAPE_KINDS = ['rect', 'circle', 'pill', 'triangle', 'diamond', 'star', 'burst', 'arrow', 'bubble', 'line'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];
/** Estilos de borde y de línea. */
export const BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];
/** Extremos de una línea. */
export const LINE_CAPS = ['none', 'arrow', 'circle', 'square', 'diamond'] as const;
export type LineCap = (typeof LINE_CAPS)[number];
/** Valores de `bs`, `capStart` y `capEnd` cuando una forma no los trae (feature 013). Único lugar donde viven. */
export const SHAPE_DEFAULTS = { bs: 'solid', capStart: 'none', capEnd: 'none' } as const satisfies { bs: BorderStyle; capStart: LineCap; capEnd: LineCap };
/** Enlace de un elemento: solo http(s), sin espacios, hasta `LINK_MAX` caracteres; `''` = sin enlace. */
export const LINK_MAX = 2000;
export const LINK_RE = /^https?:\/\/\S+$/i;
export const isValidLink = (v: string): boolean => v === '' || (v.length <= LINK_MAX && LINK_RE.test(v));

// ---------------------------------------------------------------------------------------------------------------
// Tipos del documento de plantilla (data-model.md)
// ---------------------------------------------------------------------------------------------------------------

export type Palette = Record<PaletteKey, string>;

export interface PageBg {
  type: 'color' | 'gradient' | 'image';
  /** Imagen de fondo cuando `type` es `image`. */
  image: 'marble' | 'coverbg';
  color: ColorRef;
  color2: ColorRef;
}

interface ElementBase {
  /** Único dentro de la página. */
  id: string;
  name?: string;
  /** Posición y tamaño en % de la página. */
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

/** Anclaje vertical de un texto: arriba, al centro (como se dibujó siempre) o abajo. */
export type VAlign = 'top' | 'middle' | 'bottom';

export interface TextEl extends ElementBase {
  type: 'text';
  text: string;
  font: FontRef;
  size: number;
  weight: Weight;
  color: ColorRef;
  stroke: ColorRef;
  strokeW: number;
  glow: ColorRef;
  align: 'left' | 'center' | 'right' | 'justify';
  upper: boolean;
  ls: number;
  /** Altura de línea (múltiplo del tamaño). Opcional: las plantillas anteriores a 007 no la tienen; ver `TEXT_DEFAULTS`. */
  lh?: number;
  /** Tachado de todo el texto, del color del relleno. Opcional, como `lh`. */
  strike?: boolean;
  /** Anclaje vertical del texto en su caja (feature 008). Opcional: si falta se dibuja centrado, como siempre; ver `TEXT_DEFAULTS`. */
  vAlign?: VAlign;
  /** Sombra del texto (feature 011). Opcional: sin `shadow` no se dibuja; los parámetros faltantes salen de `TEXT_EFFECT_DEFAULTS`. */
  shadow?: boolean;
  shDist?: number;
  shAngle?: number;
  shBlur?: number;
  shAlpha?: number;
  shColor?: ColorRef;
  /** Fondo del texto (feature 011): igual que la sombra, sin `bg` no se dibuja. */
  bg?: boolean;
  bgRadius?: number;
  bgPad?: number;
  bgAlpha?: number;
  bgColor?: ColorRef;
  /** Formato (feature 012). Todo opcional: sin estos campos el texto se dibuja como siempre. */
  italic?: boolean;
  underline?: boolean;
  list?: TextList;
  /** Efectos nuevos: Brillo, Eco, Desalineado, Distorsión y Sin relleno; se combinan y se dibujan en un orden fijo. */
  bright?: boolean;
  echo?: boolean;
  misalign?: boolean;
  glitch?: boolean;
  hollow?: boolean;
  /** Parámetros compartidos entre los efectos que los usan (ver `TEXT_EFFECT_DEFAULTS`). */
  fxColor?: ColorRef;
  fxColor2?: ColorRef;
  fxDist?: number;
  fxI?: number;
  /** Curvatura del texto: −100 a 100, 0 = recto. Solo la primera línea. */
  curve?: number;
  /** Enlace (feature 013). */
  href?: string;
}

/** Lista de un texto: sin lista, con viñetas o numerada. */
export type TextList = 'none' | 'bullet' | 'number';

/** Valores de los parámetros de sombra y fondo cuando un texto no los trae (feature 011). Único lugar donde viven. */
export const TEXT_EFFECT_DEFAULTS = {
  shDist: 6,
  shAngle: 45,
  shBlur: 6,
  shAlpha: 50,
  shColor: '#000000',
  bgRadius: 8,
  bgPad: 8,
  bgAlpha: 100,
  bgColor: 'bg',
  /** Feature 012 */
  fxColor: 'a1',
  fxColor2: 'a2',
  fxDist: 6,
  fxI: 50,
} as const satisfies Pick<Required<TextEl>, 'shDist' | 'shAngle' | 'shBlur' | 'shAlpha' | 'shColor' | 'bgRadius' | 'bgPad' | 'bgAlpha' | 'bgColor' | 'fxColor' | 'fxColor2' | 'fxDist' | 'fxI'>;

/**
 * Valores de `lh` y `strike` cuando un texto no los trae: los del render anterior a la feature 007, para que las
 * plantillas ya guardadas se vean idénticas sin migrarlas. Es el único lugar donde viven.
 */
export const TEXT_DEFAULTS = { lh: 1.05, strike: false, vAlign: 'middle' } as const satisfies { lh: number; strike: boolean; vAlign: VAlign };

export interface BadgeEl extends ElementBase {
  type: 'badge';
  text: string;
  fill: ColorRef;
  color: ColorRef;
  font: FontRef;
  size: number;
  href?: string;
}

export interface ShapeEl extends ElementBase {
  type: 'shape';
  kind: ShapeKind;
  /** En `kind: 'line'`, el color de la línea. */
  fill: ColorRef;
  border: ColorRef;
  /** En `kind: 'line'`, el grosor de la línea (se dibuja con mínimo 1). */
  bw: number;
  radius: number;
  glow: ColorRef;
  /** Feature 013, todos opcionales: su ausencia equivale al comportamiento anterior (ver `SHAPE_DEFAULTS`). */
  bs?: BorderStyle;
  capStart?: LineCap;
  capEnd?: LineCap;
  flipH?: boolean;
  flipV?: boolean;
  /** Solo del editor: al redimensionar se conserva la relación ancho/alto. */
  lockAspect?: boolean;
  href?: string;
}

export interface ImageEl extends ElementBase {
  type: 'image';
  src: ImageSrc;
  /** `fill` estira la imagen a la caja (como el marco de portada de 002); el editor ofrece los tres. */
  fit: 'contain' | 'cover' | 'fill';
  radius: number;
  /** Feature 013, opcionales. */
  flipH?: boolean;
  flipV?: boolean;
  lockAspect?: boolean;
  href?: string;
}

/** Introducción de una sección propia: se pinta solo si la sección tiene `introText`. */
export interface IntroEl extends ElementBase {
  type: 'intro';
  boxFill: ColorRef;
  textColor: ColorRef;
  radius: number;
}

export type ProductsLayout = 'alternado' | 'tarjetas' | 'lista' | 'base';
export type SoldOutStyle = 'sello' | 'cinta' | 'gris' | 'diagonal';
export type PriceShape = 'pill' | 'round' | 'square';

export interface ProductsEl extends ElementBase {
  type: 'products';
  layout: ProductsLayout;
  cardFill: ColorRef;
  ring: ColorRef;
  ringW: number;
  cardRadius: number;
  bubbleFill: ColorRef;
  bubbleRadius: number;
  textColor: ColorRef;
  priceFill: ColorRef;
  priceBorder: ColorRef;
  priceText: ColorRef;
  priceShape: PriceShape;
  sold: SoldOutStyle;
  /** Solo con `sold: 'cinta'`. */
  soldFill: ColorRef;
  /** % del ancho original de la foto en la distribución elegida (100 = como siempre; 50 a 150). */
  photoW: number;
  /** % del alto original de la foto en la distribución elegida (100 = como siempre; 50 a 150). */
  photoH: number;
  /** `separado`: el nombre va en su propio rótulo, fuera de la burbuja; `burbuja`: dentro de ella, como antes. */
  nameStyle: NameStyle;
  nameColor: ColorRef;
  /** Fondo del rótulo del nombre. Solo con `nameStyle: 'separado'`. */
  nameFill: ColorRef;
  /** Resplandor del color del nombre. Solo con `nameStyle: 'separado'`. */
  nameGlow: boolean;
  /**
   * Feature 010, todos opcionales: su ausencia equivale al comportamiento anterior (ver `CARD_PRODUCT_DEFAULTS` en
   * `template-presets.ts`). `tarjeta`: la foto es la foto-tarjeta generada y el nombre se dibuja dentro de ella.
   */
  cardStyle?: CardStyle;
  /** Resplandor neón del precio. */
  priceGlow?: boolean;
  /** Resplandor neón de la cinta AGOTADO. Solo con `sold: 'diagonal'`. */
  soldGlow?: boolean;
  /** Sombra suave bajo la burbuja. */
  bubbleShadow?: boolean;
  /** Altura de línea de la descripción; ausente = la de la burbuja de siempre. */
  descLh?: number;
}

export interface TermsEl extends ElementBase {
  type: 'terms';
  chipFill: ColorRef;
  chipText: ColorRef;
  boxFill: ColorRef;
  textColor: ColorRef;
}

export interface FooterEl extends ElementBase {
  type: 'footer';
  /** Admite marcadores. */
  content: string;
  fill: ColorRef;
  line: ColorRef;
  bw: number;
  textColor: ColorRef;
}

/** Elemento de una página (el nombre `Element` chocaría con el del DOM en el frontend). */
export type PageElement = TextEl | BadgeEl | ShapeEl | ImageEl | IntroEl | ProductsEl | TermsEl | FooterEl;
export type AutoBlock = IntroEl | ProductsEl | TermsEl | FooterEl;
export type ElementType = PageElement['type'];

export interface Page {
  bg: PageBg;
  /** En orden de apilado: el último queda al frente. */
  els: PageElement[];
}

export interface TemplateDoc {
  version: 1;
  palette: Palette;
  fonts: { title: FontKey; body: FontKey };
  pages: Record<PageKey, Page>;
}

export interface Template extends TemplateDoc {
  id: string;
  name: string;
  /** Estilo base del que partió: define a qué paleta vuelve "Restaurar colores originales". */
  base: BaseId;
}

export interface TemplateSummary {
  id: string;
  name: string;
  isDefault: boolean;
  palette: Palette;
  fonts: TemplateDoc['fonts'];
  /** Solo si es `true`: la plantilla dibuja la foto-tarjeta generada (feature 010) y Generar ofrece «Fondo de la foto». */
  photoCards?: true;
}

export type PaletteWarningCode = 'low_text_contrast' | 'low_accent_contrast';

export interface PaletteWarning {
  code: PaletteWarningCode;
  message: string;
}

export interface TemplateWarning extends PaletteWarning {
  templateId: string;
}

/** Respuesta de `GET`/`PUT /settings/templates`; `warnings` solo viene en la del `PUT`. */
export interface WorkspaceState {
  templates: Template[];
  defaultId: string;
  business: BusinessSettings;
  revision: number;
  warnings?: TemplateWarning[];
}

// ---------------------------------------------------------------------------------------------------------------
// Bloques automáticos
// ---------------------------------------------------------------------------------------------------------------

/** Cuántos bloques automáticos de cada tipo exige cada página (el servidor lo comprueba al guardar). */
export const REQUIRED_BLOCKS: Record<PageKey, Record<AutoBlockType, 0 | 1>> = {
  portada: { intro: 0, products: 0, terms: 0, footer: 0 },
  seccion: { intro: 1, products: 0, terms: 0, footer: 0 },
  productos: { intro: 0, products: 1, terms: 0, footer: 1 },
  politicas: { intro: 0, products: 0, terms: 1, footer: 1 },
};

export function isAutoBlock(el: { type: string }): el is AutoBlock {
  return (AUTO_BLOCK_TYPES as readonly string[]).includes(el.type);
}

// ---------------------------------------------------------------------------------------------------------------
// Marcadores de datos (FR-024)
// ---------------------------------------------------------------------------------------------------------------

export type DataTokens = Record<TokenName, string>;

const TOKEN_RE = /\{(\w+)\}/g;
const KNOWN_TOKEN_RE = new RegExp(`\\{(?:${TOKEN_NAMES.join('|')})\\}`);

function isTokenName(name: string): name is TokenName {
  return (TOKEN_NAMES as readonly string[]).includes(name);
}

/** Contexto de marcadores: `banner` ya trae el efecto de `bannerText` porque el servidor lo aplica a `coverTitle`. */
export function tokensFrom(business: BusinessInfo, seccion = ''): DataTokens {
  return {
    banner: business.coverTitle,
    seccion,
    telefonos: [business.phone1, business.phone2].filter((p) => p.trim() !== '').join(' · '),
    direccion: business.address,
    tienda: business.storeName,
  };
}

/** `true` si el texto contiene algún marcador conocido (su largo depende de los datos, así que se ajusta). */
export function hasTokens(text: string): boolean {
  return KNOWN_TOKEN_RE.test(text);
}

/** Quita separadores `·` que quedan colgando al vaciarse un dato. */
const tidy = (s: string): string => s.replace(/(?:\s*·\s*){2,}/g, ' · ').replace(/^[\s·]+|[\s·]+$/g, '');

/**
 * Reemplaza los marcadores por su dato. Un marcador desconocido queda tal cual; si algún dato está vacío no deja
 * residuo (ni el marcador ni un separador `·` sobrante).
 */
export function resolveTokens(text: string, tokens: DataTokens): string {
  let blanked = false;
  const out = text.replace(TOKEN_RE, (match, name: string) => {
    if (!isTokenName(name)) return match;
    const value = tokens[name];
    if (value === '') blanked = true;
    return value;
  });
  return blanked ? tidy(out) : out;
}

// ---------------------------------------------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------------------------------------------

export function isPaletteKey(value: unknown): value is PaletteKey {
  return typeof value === 'string' && (PALETTE_KEYS as readonly string[]).includes(value);
}

/** Clave de paleta, `#RRGGBB`, `none` o `transparent`. */
export function isColorRef(value: unknown): value is ColorRef {
  return isPaletteKey(value) || isHexColor(value) || value === 'none' || value === 'transparent';
}

/** Color CSS de una referencia. Un valor desconocido se trata como transparente en lugar de romper el dibujo. */
export function resolveColor(palette: Palette, ref: ColorRef): string {
  if (isPaletteKey(ref)) return palette[ref];
  return isHexColor(ref) ? ref : 'transparent';
}

const ACCENT_LABELS = { a1: 'acento 1', a2: 'acento 2', a3: 'acento 3' } as const;

/**
 * Advertencias de contraste de la paleta (no bloquean el guardado, FR-016). Solo evalúa los seis colores de la
 * paleta, no los colores personalizados de cada elemento. Umbrales de la feature 002.
 */
export function paletteWarnings(palette: Palette): PaletteWarning[] {
  const out: PaletteWarning[] = [];
  if (contrastRatio(palette.ink, palette.paper) < 4.5) {
    out.push({
      code: 'low_text_contrast',
      message: 'El color de texto casi no se distingue del color de papel; el texto puede no leerse.',
    });
  }
  // El precio y el pie dibujan texto blanco sobre el color de fondo
  if (contrastRatio('#FFFFFF', palette.bg) < 4.5) {
    out.push({
      code: 'low_text_contrast',
      message: 'El texto blanco puede no leerse sobre el color de fondo elegido.',
    });
  }
  for (const key of ['a1', 'a2', 'a3'] as const) {
    if (contrastRatio(palette[key], palette.bg) < 3) {
      out.push({
        code: 'low_accent_contrast',
        message: `El ${ACCENT_LABELS[key]} casi no se distingue del color de fondo.`,
      });
    }
  }
  return out;
}
