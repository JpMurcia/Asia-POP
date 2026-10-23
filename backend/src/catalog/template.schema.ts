/**
 * Esquema zod de las plantillas (solo servidor). Valida rangos, colores, bloques obligatorios por página y los
 * límites de `data-model.md`. Los mensajes están en español y cada error trae la ruta del campo.
 */

import { z } from 'zod';
import {
  AUTO_BLOCK_TYPES,
  BASE_IDS,
  CARD_STYLES,
  FONT_KEYS,
  IMAGE_KEYS,
  LIMITS,
  NAME_STYLES,
  PAGE_LABELS,
  PRODUCTS_ZONE_MIN,
  RANGES,
  REQUIRED_BLOCKS,
  UPLOAD_IMAGE_RE,
  WEIGHTS,
  isColorRef,
  type AutoBlockType,
  type PageKey,
  type Template,
} from './template';
import { isHexColor } from './theme';

// ---------------------------------------------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------------------------------------------

const upperHex = (v: string): string => (isHexColor(v) ? v.toUpperCase() : v);

/** Número dentro de un rango (los rangos viven en `template.ts` y los comparte el inspector). */
const num = (range: readonly [number, number], label: string) =>
  z
    .number({ error: `${label} debe ser un número.` })
    .min(range[0], `${label}: el mínimo es ${range[0]}.`)
    .max(range[1], `${label}: el máximo es ${range[1]}.`);

const oneOf = <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `${label}: valor no válido.` });

/** Color de un elemento: clave de paleta, `#RRGGBB`, `none` o `transparent`. */
const colorRef = z
  .string({ error: 'Falta el color.' })
  .refine(isColorRef, 'Debe ser un color de la paleta, un #RRGGBB, "none" o "transparent".')
  .transform(upperHex);

/** Color de la paleta: solo `#RRGGBB`. */
const hex = z
  .string({ error: 'Falta el color.' })
  .refine(isHexColor, 'Debe ser un color en formato #RRGGBB.')
  .transform(upperHex);

const fontKey = oneOf(FONT_KEYS, 'La fuente');
const fontRef = z.enum(['title', 'body', ...FONT_KEYS], { error: 'La fuente: valor no válido.' });
const text500 = (label: string) =>
  z
    .string({ error: `${label} debe ser un texto.` })
    .max(LIMITS.textMax, `${label} admite hasta ${LIMITS.textMax} caracteres.`);

const common = {
  id: z
    .string({ error: 'Falta el id del elemento.' })
    .min(1, 'Falta el id del elemento.')
    .max(LIMITS.idMax, `El id del elemento admite hasta ${LIMITS.idMax} caracteres.`),
  name: z.string().trim().max(LIMITS.nameMax, `El nombre admite hasta ${LIMITS.nameMax} caracteres.`).optional(),
  x: num(RANGES.x, 'La posición X'),
  y: num(RANGES.y, 'La posición Y'),
  w: num(RANGES.w, 'El ancho'),
  h: num(RANGES.h, 'El alto'),
  opacity: num(RANGES.opacity, 'La opacidad'),
  locked: z.boolean({ error: 'Debe ser verdadero o falso.' }),
};
const free = {
  ...common,
  rot: num(RANGES.rot, 'La rotación'),
  visible: z.boolean({ error: 'Debe ser verdadero o falso.' }),
};
/** Un bloque automático no se gira ni se oculta (FR-006, FR-011). */
const auto = {
  ...common,
  rot: z.literal(0, { error: 'Un bloque automático no se puede girar.' }),
  visible: z.literal(true, { error: 'Un bloque automático no se puede ocultar.' }),
};

// ---------------------------------------------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------------------------------------------

const textEl = z.object({
  ...free,
  type: z.literal('text'),
  text: text500('El texto'),
  font: fontRef,
  size: num(RANGES.textSize, 'El tamaño'),
  weight: z
    .number({ error: 'El peso debe ser un número.' })
    .refine((w): w is (typeof WEIGHTS)[number] => (WEIGHTS as readonly number[]).includes(w), {
      error: `El peso debe ser ${WEIGHTS.join(', ')}.`,
    }),
  color: colorRef,
  stroke: colorRef,
  strokeW: num(RANGES.strokeW, 'El grosor del contorno'),
  glow: colorRef,
  align: oneOf(['left', 'center', 'right'], 'La alineación'),
  upper: z.boolean({ error: 'Debe ser verdadero o falso.' }),
  ls: num(RANGES.ls, 'El espaciado'),
  // Opcionales: si faltan, se dibujan con TEXT_DEFAULTS. Hay que declararlos: z.object descarta las claves que no conoce
  lh: num(RANGES.lh, 'La altura de línea').optional(),
  strike: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional(),
  vAlign: oneOf(['top', 'middle', 'bottom'], 'La alineación vertical').optional(),
  // Sombra y fondo (feature 011): opcionales; un parámetro guardado con el interruptor apagado se conserva
  shadow: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional(),
  shDist: num(RANGES.shDist, 'La distancia de la sombra').optional(),
  shAngle: num(RANGES.shAngle, 'La dirección de la sombra').optional(),
  shBlur: num(RANGES.shBlur, 'El desenfoque de la sombra').optional(),
  shAlpha: num(RANGES.alpha, 'La transparencia de la sombra').optional(),
  shColor: colorRef.optional(),
  bg: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional(),
  bgRadius: num(RANGES.bgRadius, 'La redondez del fondo').optional(),
  bgPad: num(RANGES.bgPad, 'La separación del fondo').optional(),
  bgAlpha: num(RANGES.alpha, 'La transparencia del fondo').optional(),
  bgColor: colorRef.optional(),
});

const badgeEl = z.object({
  ...free,
  type: z.literal('badge'),
  text: text500('El texto'),
  fill: colorRef,
  color: colorRef,
  font: fontRef,
  size: num(RANGES.badgeSize, 'El tamaño'),
});

const shapeEl = z.object({
  ...free,
  type: z.literal('shape'),
  kind: oneOf(['rect', 'circle', 'pill'], 'La forma'),
  fill: colorRef,
  border: colorRef,
  bw: num(RANGES.shapeBw, 'El grosor del borde'),
  radius: num(RANGES.shapeRadius, 'Las esquinas'),
  glow: colorRef,
});

/** Una imagen de la galería o una subida (`upload:<archivo>`, sin separadores ni `..`). */
const imageSrc = z
  .string({ error: 'La imagen: valor no válido.' })
  .refine(
    (v) => (IMAGE_KEYS as readonly string[]).includes(v) || (UPLOAD_IMAGE_RE.test(v) && !v.includes('..')),
    'La imagen: valor no válido.',
  ) as z.ZodType<(typeof IMAGE_KEYS)[number] | `upload:${string}`>;

const imageEl = z.object({
  ...free,
  type: z.literal('image'),
  src: imageSrc,
  fit: oneOf(['contain', 'cover', 'fill'], 'El ajuste'),
  radius: num(RANGES.imageRadius, 'Las esquinas'),
});

const introEl = z.object({
  ...auto,
  type: z.literal('intro'),
  boxFill: colorRef,
  textColor: colorRef,
  radius: num(RANGES.introRadius, 'Las esquinas'),
});

const ZONE_MIN_MESSAGE = `La zona de productos debe medir al menos ${PRODUCTS_ZONE_MIN.w} % de ancho y ${PRODUCTS_ZONE_MIN.h} % de alto.`;

const productsEl = z.object({
  ...auto,
  type: z.literal('products'),
  layout: oneOf(['alternado', 'tarjetas', 'lista', 'base'], 'La distribución'),
  cardFill: colorRef,
  ring: colorRef,
  ringW: num(RANGES.ringW, 'El grosor del anillo'),
  cardRadius: num(RANGES.cardRadius, 'Las esquinas de la foto'),
  bubbleFill: colorRef,
  bubbleRadius: num(RANGES.bubbleRadius, 'Las esquinas de la burbuja'),
  textColor: colorRef,
  priceFill: colorRef,
  priceBorder: colorRef,
  priceText: colorRef,
  priceShape: oneOf(['pill', 'round', 'square'], 'La forma del precio'),
  sold: oneOf(['sello', 'cinta', 'gris', 'diagonal'], 'El estilo de agotado'),
  soldFill: colorRef,
  photoW: num(RANGES.photoScale, 'El ancho de la foto'),
  photoH: num(RANGES.photoScale, 'El alto de la foto'),
  nameStyle: oneOf(NAME_STYLES, 'El estilo del nombre'),
  nameColor: colorRef,
  nameFill: colorRef,
  nameGlow: z.boolean({ error: 'Debe ser verdadero o falso.' }),
  // Feature 010, opcionales: hay que declararlos porque z.object descarta las claves que no conoce
  cardStyle: oneOf(CARD_STYLES, 'El estilo de la foto').optional(),
  priceGlow: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional(),
  soldGlow: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional(),
  bubbleShadow: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional(),
  descLh: num(RANGES.lh, 'La altura de línea de la descripción').optional(),
})
  // La zona de productos tiene un mínimo propio (el rango genérico dejaría una zona de 3 %); solo aplica a este bloque
  .refine((el) => el.w >= PRODUCTS_ZONE_MIN.w, { path: ['w'], error: ZONE_MIN_MESSAGE })
  .refine((el) => el.h >= PRODUCTS_ZONE_MIN.h, { path: ['h'], error: ZONE_MIN_MESSAGE });

const termsEl = z.object({
  ...auto,
  type: z.literal('terms'),
  chipFill: colorRef,
  chipText: colorRef,
  boxFill: colorRef,
  textColor: colorRef,
});

const footerEl = z.object({
  ...auto,
  type: z.literal('footer'),
  content: text500('El contenido'),
  fill: colorRef,
  line: colorRef,
  bw: num(RANGES.footerBw, 'El grosor de la línea'),
  textColor: colorRef,
});

const element = z.discriminatedUnion('type', [
  textEl,
  badgeEl,
  shapeEl,
  imageEl,
  introEl,
  productsEl,
  termsEl,
  footerEl,
]);

// ---------------------------------------------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------------------------------------------

const BLOCK_LABELS: Record<AutoBlockType, string> = {
  intro: 'de introducción',
  products: 'de productos',
  terms: 'de políticas',
  footer: 'de pie de página',
};

const pageBg = z.object({
  type: oneOf(['color', 'gradient', 'image'], 'El tipo de fondo'),
  image: oneOf(['marble', 'coverbg'], 'La imagen de fondo'),
  color: colorRef,
  color2: colorRef,
});

/** Una página: ids únicos, hasta 60 elementos y exactamente los bloques automáticos que le corresponden. */
function page(key: PageKey) {
  return z.object({
    bg: pageBg,
    els: z
      .array(element)
      .max(LIMITS.elementsPerPage, `Una página admite hasta ${LIMITS.elementsPerPage} elementos.`)
      .superRefine((els, ctx) => {
        const seen = new Set<string>();
        for (const el of els) {
          if (seen.has(el.id)) {
            ctx.addIssue({ code: 'custom', message: `El id de elemento "${el.id}" está repetido en la página.` });
          }
          seen.add(el.id);
        }
        for (const type of AUTO_BLOCK_TYPES) {
          const count = els.filter((e) => e.type === type).length;
          const required = REQUIRED_BLOCKS[key][type];
          if (required === 0 && count > 0) {
            ctx.addIssue({
              code: 'custom',
              message: `La página "${PAGE_LABELS[key]}" no admite un bloque ${BLOCK_LABELS[type]}.`,
            });
          } else if (required === 1 && count === 0) {
            ctx.addIssue({
              code: 'custom',
              message: `Falta el bloque ${BLOCK_LABELS[type]} de la página "${PAGE_LABELS[key]}".`,
            });
          } else if (count > required) {
            ctx.addIssue({
              code: 'custom',
              message: `Solo puede haber un bloque ${BLOCK_LABELS[type]} por página ("${PAGE_LABELS[key]}").`,
            });
          }
        }
      }),
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Plantilla y conjunto
// ---------------------------------------------------------------------------------------------------------------

export const templateSchema = z.object({
  id: z
    .string({ error: 'Falta el id de la plantilla.' })
    .min(1, 'Falta el id de la plantilla.')
    .max(LIMITS.idMax, `El id de la plantilla admite hasta ${LIMITS.idMax} caracteres.`)
    .regex(/^[A-Za-z0-9_-]+$/, 'El id de la plantilla solo admite letras, números, guion y guion bajo.'),
  name: z
    .string({ error: 'Falta el nombre de la plantilla.' })
    .trim()
    .min(1, 'El nombre de la plantilla no puede estar vacío.')
    .max(LIMITS.nameMax, `El nombre de la plantilla admite hasta ${LIMITS.nameMax} caracteres.`),
  base: oneOf(BASE_IDS, 'El estilo base'),
  version: z.literal(1, { error: 'Versión de plantilla no admitida.' }),
  palette: z.object({ bg: hex, a1: hex, a2: hex, a3: hex, ink: hex, paper: hex }),
  fonts: z.object({ title: fontKey, body: fontKey }),
  pages: z.object({
    portada: page('portada'),
    seccion: page('seccion'),
    productos: page('productos'),
    politicas: page('politicas'),
  }),
});

/** El conjunto completo que guarda el editor: todas las plantillas y cuál es la predeterminada. */
export const workspaceSchema = z
  .object({
    templates: z
      .array(templateSchema)
      .min(1, 'Debe haber al menos una plantilla.')
      .max(LIMITS.templates, `Se admiten hasta ${LIMITS.templates} plantillas.`),
    defaultId: z.string({ error: 'Falta la plantilla predeterminada.' }),
  })
  .superRefine((ws, ctx) => {
    const ids = ws.templates.map((t) => t.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['templates'], message: 'Hay plantillas con el mismo id.' });
    }
    if (!ids.includes(ws.defaultId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultId'],
        message: 'La plantilla predeterminada debe estar entre las plantillas guardadas.',
      });
    }
  });

export type WorkspaceInput = z.output<typeof workspaceSchema>;

// El esquema produce exactamente los tipos que usan el servidor y el editor.
type Assert<T extends true> = T;
export type _SchemaMatchesTemplate = Assert<z.output<typeof templateSchema> extends Template ? true : false>;
