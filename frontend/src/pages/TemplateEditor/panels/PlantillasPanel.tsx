import { PAGE_W } from '../../../../../backend/src/catalog/template';
import TemplatePage from '../../../print/TemplatePage';
import { PaletteDots } from '../Gallery';
import { pageData } from '../sample-data';
import type { PanelProps } from './ElementosPanel';

const THUMB_W = 62;

/** Panel "Plantillas": la lista lateral para cambiar de plantilla sin salir del editor. */
export default function PlantillasPanel({ workspace, activeId, actions }: PanelProps) {
  const data = pageData('portada', workspace.business);
  return (
    <div className="ed-panel-body" data-testid="templates-panel">
      <div className="ed-panel-head">
        <h3 className="ed-panel-title">Plantillas</h3>
        <button type="button" className="ed-link" onClick={() => actions.setView('plantillas')}>
          Ver todas
        </button>
      </div>
      <div className="ed-template-list">
        {workspace.templates.map((t) => {
          const isDefault = t.id === workspace.defaultId;
          return (
            <button
              key={t.id}
              type="button"
              className="ed-template-item"
              data-testid="panel-template"
              aria-current={t.id === activeId ? 'true' : undefined}
              onClick={() => actions.openTemplate(t.id)}
            >
              <span className="ed-template-thumb" aria-hidden="true">
                <TemplatePage template={t} page="portada" tokens={data.tokens} scale={THUMB_W / PAGE_W} />
              </span>
              <span className="ed-template-text">
                <strong>{t.name}</strong>
                <PaletteDots template={t} />
                {isDefault && <span className="ed-badge-default">Predeterminada</span>}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="ed-new-template" onClick={() => actions.setView('plantillas')}>
        Nueva plantilla
      </button>
      <p className="ed-note">La predeterminada se usa en Generar catálogo. Allí puedes elegir otra solo para esa generación.</p>
    </div>
  );
}
