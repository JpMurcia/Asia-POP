import type { CSSProperties } from 'react';
import { FONT_LABELS, type PageElement, type Template } from '../../../../../backend/src/catalog/template';
import { circleHeight, draftBadge, draftImage, draftShape, draftText } from '../../../../../backend/src/catalog/template-presets';
import { IMAGES } from '../../../print/assets';
import { newElementId, type EditorActions, type EditorWorkspace } from '../useTemplateEditor';

/** Lo que recibe cada panel del riel: la plantilla abierta, todo el conjunto en edición y las acciones. */
export interface PanelProps {
  template: Template;
  workspace: EditorWorkspace;
  activeId: string;
  actions: EditorActions;
}

/** Elementos nuevos: cada fábrica deja el elemento visible y dentro de la hoja, listo para arrastrar. */
const FACTORIES = {
  title: () => draftText({ name: 'Título', text: 'Nuevo título', color: 'a1', x: 15, y: 44, w: 70, h: 9 }),
  body: () => draftText({ name: 'Texto', text: 'Escribe aquí', font: 'body', size: 16, weight: 400, x: 15, y: 54, w: 70, h: 6 }),
  badge: () => draftBadge({ name: 'Insignia' }),
  // Datos del catálogo: un texto con el marcador, que se reemplaza por el dato real al dibujar y al generar
  banner: () => draftText({ name: 'Banner', text: '{banner}', size: 32, x: 6, y: 20, w: 88, h: 10 }),
  seccion: () => draftText({ name: 'Sección', text: '{seccion}', size: 32, x: 6, y: 20, w: 88, h: 10 }),
  telefonos: () => draftText({ name: 'Teléfonos', text: '{telefonos}', font: 'body', size: 18, weight: 700, x: 10, y: 88, w: 80, h: 5 }),
  direccion: () => draftText({ name: 'Dirección', text: '{direccion}', font: 'body', size: 14, weight: 400, x: 10, y: 93, w: 80, h: 4 }),
  tienda: () => draftText({ name: 'Tienda', text: '{tienda}', font: 'body', size: 14, weight: 900, ls: 2, x: 10, y: 4, w: 80, h: 4 }),
  rect: () => draftShape({ name: 'Rectángulo' }),
  circle: () => draftShape({ name: 'Círculo', kind: 'circle', x: 35, y: 38, w: 30, h: circleHeight(30) }),
  pill: () => draftShape({ name: 'Píldora', kind: 'pill', x: 25, y: 46, w: 50, h: 7 }),
  line: () => draftShape({ name: 'Línea', kind: 'rect', fill: 'ink', radius: 0, x: 15, y: 50, w: 70, h: 0.4 }),
  logo: () => draftImage({ name: 'Logo', src: 'logo', x: 36, y: 40, w: 28, h: 20 }),
  collage: () => draftImage({ name: 'Collage', src: 'collage' }),
} as const;

type FactoryKey = keyof typeof FACTORIES;

const DATA_CHIPS: { key: FactoryKey; label: string }[] = [
  { key: 'banner', label: 'Banner' },
  { key: 'seccion', label: 'Sección' },
  { key: 'telefonos', label: 'Teléfonos' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'tienda', label: 'Tienda' },
];

const SHAPES: { key: FactoryKey; label: string; style: CSSProperties }[] = [
  { key: 'rect', label: 'Rectángulo', style: { width: 24, height: 18, borderRadius: 4 } },
  { key: 'circle', label: 'Círculo', style: { width: 22, height: 22, borderRadius: '50%' } },
  { key: 'pill', label: 'Píldora', style: { width: 26, height: 12, borderRadius: 999 } },
  { key: 'line', label: 'Línea', style: { width: 26, height: 3, borderRadius: 0 } },
];

const IMAGE_BUTTONS: { key: FactoryKey; label: string; src: string }[] = [
  { key: 'logo', label: 'Logo', src: IMAGES.logo },
  { key: 'collage', label: 'Collage', src: IMAGES.collage },
];

/** Panel "Elementos": agrega texto, insignias, formas e imágenes a la página activa. */
export default function ElementosPanel({ template, actions }: PanelProps) {
  const add = (key: FactoryKey) => actions.addElement({ ...FACTORIES[key](), id: newElementId() } as PageElement);
  const titleFont = FONT_LABELS[template.fonts.title];
  const bodyFont = FONT_LABELS[template.fonts.body];

  return (
    <div className="ed-panel-body">
      <section>
        <h3 className="ed-heading">Texto</h3>
        <button type="button" className="ed-add ed-add-title" title={titleFont} onClick={() => add('title')}>
          Agregar título
        </button>
        <button type="button" className="ed-add" title={bodyFont} onClick={() => add('body')}>
          Agregar texto
        </button>
        <button type="button" className="ed-add ed-add-badge" aria-label="Insignia" onClick={() => add('badge')}>
          <span className="ed-badge-sample" aria-hidden="true">
            NUEVO
          </span>
          Insignia
        </button>
      </section>

      <section>
        <h3 className="ed-heading">Datos del catálogo</h3>
        <div className="ed-tokens" role="group" aria-label="Datos del catálogo">
          {DATA_CHIPS.map((c) => (
            <button key={c.key} type="button" onClick={() => add(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="ed-note">Se reemplazan por el dato real al generar.</p>
      </section>

      <section>
        <h3 className="ed-heading">Formas</h3>
        <div className="ed-shapes">
          {SHAPES.map((s) => (
            <button key={s.key} type="button" title={s.label} aria-label={s.label} onClick={() => add(s.key)}>
              <span style={s.style} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="ed-heading">Imágenes</h3>
        <div className="ed-images">
          {IMAGE_BUTTONS.map((b) => (
            <button key={b.key} type="button" aria-label={b.label} onClick={() => add(b.key)}>
              <span className="ed-image-sample" aria-hidden="true" style={{ backgroundImage: `url(${b.src})` }} />
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <p className="ed-note">
        Los bloques de productos, políticas y pie de página se llenan solos con los datos de Alegra y de Contenido propio.
      </p>
    </div>
  );
}
