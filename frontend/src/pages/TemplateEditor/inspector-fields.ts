import {
  FONT_KEYS,
  FONT_LABELS,
  RANGES,
  WEIGHTS,
  isAutoBlock,
  type PageBg,
  type PageElement,
  type Template,
} from '../../../../backend/src/catalog/template';

/**
 * Descriptores de los campos del inspector: cada tipo de elemento se mapea a una lista de campos con los rangos de
 * FR-011 y FR-012, y `FieldRenderer` los dibuja. Agregar una propiedad es agregar una línea.
 */
export type FieldDesc =
  | { kind: 'heading'; label: string }
  | { kind: 'color'; key: string; label: string; none?: 'none' | 'transparent' }
  | {
      kind: 'range';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      unit?: string;
      /** El valor guardado es el mostrado dividido entre `scale` (la opacidad se guarda de 0 a 1 y se muestra de 0 a 100). */
      scale?: number;
      /** Desde este valor la esquina es un círculo (imágenes). */
      circleAt?: number;
    }
  | { kind: 'segmented'; key: string; label: string; options: readonly (readonly [string | number, string])[] }
  | { kind: 'select'; key: string; label: string; options: readonly (readonly [string, string])[] }
  | { kind: 'textarea'; key: string; label: string; rows?: number }
  | { kind: 'tokens'; key: string; label: string }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'numbers'; items: readonly (readonly [string, string])[] };

type El<T extends PageElement['type']> = Extract<PageElement, { type: T }>;

const heading = (label: string): FieldDesc => ({ kind: 'heading', label });
const color = (key: string, label: string, none?: 'none' | 'transparent'): FieldDesc => ({ kind: 'color', key, label, none });
const range = (key: string, label: string, [min, max]: readonly [number, number], step: number, unit = ' px'): FieldDesc => ({
  kind: 'range',
  key,
  label,
  min,
  max,
  step,
  unit,
});
const seg = (key: string, label: string, options: readonly (readonly [string | number, string])[]): FieldDesc => ({
  kind: 'segmented',
  key,
  label,
  options,
});

/** Etiquetas del selector de fuente: título y cuerpo de la plantilla, y las seis familias. */
export function fontOptions(template: Pick<Template, 'fonts'>): readonly (readonly [string, string])[] {
  return [
    ['title', `Título · ${FONT_LABELS[template.fonts.title]}`],
    ['body', `Cuerpo · ${FONT_LABELS[template.fonts.body]}`],
    ...FONT_KEYS.map((k) => [k, FONT_LABELS[k]] as const),
  ];
}

export const IMAGE_OPTIONS = [
  ['logo', 'Logo'],
  ['collage', 'Collage'],
  ['marble', 'Mármol'],
  ['coverbg', 'Atardecer'],
  ['frame', 'Marco de portada'],
] as const;

const WEIGHT_LABELS: Record<(typeof WEIGHTS)[number], string> = { 400: 'Normal', 600: 'Semi', 700: 'Negrita', 900: 'Black' };

/** Campos propios del tipo de elemento (sin posición, rotación ni opacidad). */
function ownFields(el: PageElement, template: Template): FieldDesc[] {
  switch (el.type) {
    case 'text': {
      const t = el as El<'text'>;
      return [
        { kind: 'textarea', key: 'text', label: 'Texto' },
        { kind: 'tokens', key: 'text', label: 'Insertar dato' },
        heading('Tipografía'),
        { kind: 'select', key: 'font', label: 'Fuente', options: fontOptions(template) },
        range('size', 'Tamaño', RANGES.textSize, 1),
        seg('weight', 'Peso', WEIGHTS.map((w) => [w, WEIGHT_LABELS[w]] as const)),
        seg('align', 'Alineación', [['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']]),
        range('ls', 'Espaciado', RANGES.ls, 0.5),
        { kind: 'toggle', key: 'upper', label: 'Mayúsculas' },
        heading('Color y efectos'),
        color('color', 'Relleno'),
        color('stroke', 'Contorno', 'none'),
        ...(t.stroke !== 'none' ? [range('strokeW', 'Grosor del contorno', RANGES.strokeW, 0.5)] : []),
        color('glow', 'Resplandor neón', 'none'),
      ];
    }
    case 'badge':
      return [
        { kind: 'textarea', key: 'text', label: 'Texto' },
        { kind: 'tokens', key: 'text', label: 'Insertar dato' },
        color('fill', 'Fondo'),
        color('color', 'Color del texto'),
        { kind: 'select', key: 'font', label: 'Fuente', options: fontOptions(template) },
        range('size', 'Tamaño', RANGES.badgeSize, 1),
      ];
    case 'shape': {
      const s = el as El<'shape'>;
      return [
        seg('kind', 'Forma', [['rect', 'Rectángulo'], ['circle', 'Círculo'], ['pill', 'Píldora']]),
        color('fill', 'Relleno', 'transparent'),
        color('border', 'Borde', 'none'),
        ...(s.border !== 'none' ? [range('bw', 'Grosor del borde', RANGES.shapeBw, 1)] : []),
        ...(s.kind === 'rect' ? [range('radius', 'Esquinas', RANGES.shapeRadius, 1)] : []),
        color('glow', 'Resplandor neón', 'none'),
      ];
    }
    case 'image':
      return [
        seg('src', 'Imagen', IMAGE_OPTIONS),
        seg('fit', 'Ajuste', [['contain', 'Contener'], ['cover', 'Cubrir'], ['fill', 'Estirar']]),
        { ...(range('radius', 'Esquinas', RANGES.imageRadius, 2) as Extract<FieldDesc, { kind: 'range' }>), circleAt: RANGES.imageRadius[1] },
      ];
    case 'intro':
      return [
        color('boxFill', 'Fondo', 'transparent'),
        color('textColor', 'Color del texto'),
        range('radius', 'Esquinas', RANGES.introRadius, 1),
      ];
    case 'products': {
      const p = el as El<'products'>;
      return [
        seg('layout', 'Distribución', [['alternado', 'Alternado'], ['tarjetas', 'Tarjetas'], ['lista', 'Lista']]),
        heading('Foto del producto'),
        color('cardFill', 'Fondo de la foto', 'transparent'),
        color('ring', 'Anillo'),
        range('ringW', 'Grosor del anillo', RANGES.ringW, 1),
        range('cardRadius', 'Esquinas', RANGES.cardRadius, 1),
        heading('Descripción'),
        color('bubbleFill', 'Burbuja', 'transparent'),
        color('textColor', 'Texto'),
        range('bubbleRadius', 'Esquinas de la burbuja', RANGES.bubbleRadius, 1),
        heading('Precio'),
        color('priceFill', 'Fondo', 'transparent'),
        color('priceBorder', 'Borde', 'none'),
        color('priceText', 'Texto del precio'),
        seg('priceShape', 'Forma', [['pill', 'Píldora'], ['round', 'Suave'], ['square', 'Recta']]),
        heading('Agotados'),
        seg('sold', 'Estilo', [['sello', 'Sello'], ['cinta', 'Cinta'], ['gris', 'Gris']]),
        ...(p.sold === 'cinta' ? [color('soldFill', 'Color de la cinta')] : []),
      ];
    }
    case 'terms':
      return [
        color('chipFill', 'Fondo del título', 'transparent'),
        color('chipText', 'Texto del título'),
        color('boxFill', 'Fondo de la caja', 'transparent'),
        color('textColor', 'Texto'),
      ];
    case 'footer':
      return [
        { kind: 'textarea', key: 'content', label: 'Contenido' },
        { kind: 'tokens', key: 'content', label: 'Insertar dato' },
        color('fill', 'Fondo', 'transparent'),
        color('line', 'Línea superior'),
        range('bw', 'Grosor de la línea', RANGES.footerBw, 1),
        color('textColor', 'Texto'),
      ];
  }
}

/** Todos los campos de un elemento: los suyos más posición, tamaño, rotación (no en bloques) y opacidad. */
export function fieldsFor(el: PageElement, template: Template): FieldDesc[] {
  return [
    ...ownFields(el, template),
    heading('Posición y tamaño'),
    { kind: 'numbers', items: [['x', 'X %'], ['y', 'Y %'], ['w', 'Ancho %'], ['h', 'Alto %']] },
    ...(isAutoBlock(el) ? [] : [range('rot', 'Rotación', RANGES.rot, 1, '°')]),
    { kind: 'range', key: 'opacity', label: 'Opacidad', min: 0, max: 100, step: 1, unit: ' %', scale: 100 },
  ];
}

/** Campos del fondo de la página (sin elemento seleccionado, FR-013). */
export function pageFields(bg: PageBg): FieldDesc[] {
  return [
    seg('type', 'Fondo', [['color', 'Color'], ['gradient', 'Degradado'], ['image', 'Imagen']]),
    ...(bg.type === 'image' ? [seg('image', 'Imagen de fondo', [['marble', 'Mármol'], ['coverbg', 'Atardecer']])] : []),
    color('color', bg.type === 'gradient' ? 'Color superior' : 'Color'),
    ...(bg.type === 'gradient' ? [color('color2', 'Color inferior')] : []),
  ];
}

/** Datos que se pueden insertar en un texto, una insignia o el pie. */
export const TOKEN_CHIPS = [
  ['{banner}', 'Banner'],
  ['{seccion}', 'Sección'],
  ['{telefonos}', 'Teléfonos'],
  ['{direccion}', 'Dirección'],
  ['{tienda}', 'Tienda'],
] as const;

