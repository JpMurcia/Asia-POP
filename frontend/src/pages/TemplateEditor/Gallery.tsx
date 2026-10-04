import {
  FONT_LABELS,
  PAGE_W,
  type BaseId,
  type PageKey,
  type Template,
} from '../../../../backend/src/catalog/template';
import { BASE_TEMPLATES } from '../../../../backend/src/catalog/template-presets';
import type { BusinessSettings } from '../../../../backend/src/catalog/types';
import TemplatePage from '../../print/TemplatePage';
import { pageData } from './sample-data';
import type { EditorActions } from './useTemplateEditor';

export interface GalleryProps {
  templates: readonly Template[];
  defaultId: string;
  business: BusinessSettings;
  actions: EditorActions;
}

/** Ancho de cada miniatura de la tarjeta, en px de pantalla. */
const THUMB_W = 130;
const PALETTE_DOTS = ['bg', 'a1', 'a2', 'a3', 'paper'] as const;

export function PaletteDots({ template, size = 14 }: { template: Template; size?: number }) {
  return (
    <span className="ed-dots-row" aria-hidden="true">
      {PALETTE_DOTS.map((k) => (
        <i key={k} data-testid="palette-dot" style={{ width: size, height: size, background: template.palette[k] }} />
      ))}
    </span>
  );
}

export const fontPairLabel = (t: Pick<Template, 'fonts'>) => `${FONT_LABELS[t.fonts.title]} + ${FONT_LABELS[t.fonts.body]}`;

function Thumb({ template, page, business }: { template: Template; page: PageKey; business: BusinessSettings }) {
  const data = pageData(page, business);
  return (
    <span className="ed-gallery-thumb" aria-hidden="true">
      <TemplatePage
        template={template}
        page={page}
        tokens={data.tokens}
        items={data.items}
        terms={data.terms}
        introText={data.introText}
        photoPositions={data.photoPositions}
        scale={THUMB_W / PAGE_W}
        testId={`gallery-thumb-${page}`}
      />
    </span>
  );
}

/**
 * Vista Plantillas: una tarjeta por plantilla (portada y productos) con Editar, Duplicar, "Usar al generar" y
 * Eliminar (estas dos no se ofrecen para la predeterminada), y el bloque "Nueva plantilla" con los cuatro estilos base.
 */
export default function Gallery({ templates, defaultId, business, actions }: GalleryProps) {
  function remove(t: Template) {
    if (window.confirm(`¿Eliminar la plantilla «${t.name}»? Se quitará al guardar.`)) actions.deleteTemplate(t.id);
  }

  return (
    <div className="ed-gallery">
      <div className="ed-gallery-head">
        <h1>Plantillas del catálogo</h1>
        <p>
          Cada plantilla define portada, portada de sección, páginas de productos y políticas. La predeterminada se usa al
          generar; puedes guardar varias para temporadas o campañas.
        </p>
      </div>
      <div className="ed-gallery-grid">
        {templates.map((t) => {
          const isDefault = t.id === defaultId;
          return (
            <article key={t.id} className="ed-card" data-testid="gallery-card" aria-label={t.name} data-default={isDefault ? 'true' : undefined}>
              <button type="button" className="ed-card-thumbs" aria-label={`Abrir ${t.name}`} onClick={() => actions.openTemplate(t.id)}>
                <Thumb template={t} page="portada" business={business} />
                <Thumb template={t} page="productos" business={business} />
              </button>
              <div className="ed-card-body">
                <div className="ed-card-title">
                  <strong>{t.name}</strong>
                  {isDefault && <span className="ed-badge-default">Predeterminada</span>}
                </div>
                <div className="ed-card-meta">
                  <PaletteDots template={t} />
                  <span>{fontPairLabel(t)}</span>
                </div>
                <div className="ed-card-actions">
                  <button type="button" className="ed-primary" onClick={() => actions.openTemplate(t.id)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => actions.duplicateTemplate(t.id)}>
                    Duplicar
                  </button>
                  {!isDefault && (
                    <>
                      <button type="button" onClick={() => actions.setDefault(t.id)}>
                        Usar al generar
                      </button>
                      <button type="button" className="ed-danger" onClick={() => remove(t)}>
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        <div className="ed-card ed-card-new">
          <strong>Nueva plantilla</strong>
          <span>Parte de un estilo base y personalízalo.</span>
          {BASE_TEMPLATES.map((b) => (
            <button key={b.id} type="button" aria-label={`Nueva plantilla desde ${b.name}`} onClick={() => actions.createTemplate(b.base as BaseId)}>
              <span aria-hidden="true">{b.name}</span>
              <PaletteDots template={b} size={12} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
