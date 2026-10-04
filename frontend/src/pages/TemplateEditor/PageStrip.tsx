import { PAGE_KEYS, PAGE_LABELS, PAGE_W, type PageKey, type Template } from '../../../../backend/src/catalog/template';
import type { BusinessSettings } from '../../../../backend/src/catalog/types';
import TemplatePage from '../../print/TemplatePage';
import { PAGE_NOTES } from './Inspector';
import { pageData } from './sample-data';

export interface PageStripProps {
  template: Template;
  business: BusinessSettings;
  page: PageKey;
  /** En la vista previa ninguna página se marca como activa. */
  preview: boolean;
  onPick: (page: PageKey) => void;
}

const THUMB_W = 56;

/** Las cuatro páginas con su miniatura (la misma `TemplatePage` del lienzo) y una nota. */
export default function PageStrip({ template, business, page, preview, onPick }: PageStripProps) {
  return (
    <div className="ed-strip">
      {PAGE_KEYS.map((key) => {
        const active = key === page && !preview;
        const data = pageData(key, business);
        return (
          <button key={key} type="button" aria-label={PAGE_LABELS[key]} aria-pressed={active} className="ed-strip-item" onClick={() => onPick(key)}>
            <span className="ed-thumb" aria-hidden="true">
              <TemplatePage
                template={template}
                page={key}
                tokens={data.tokens}
                items={data.items}
                terms={data.terms}
                introText={data.introText}
                photoPositions={data.photoPositions}
                scale={THUMB_W / PAGE_W}
                testId={`thumb-${key}`}
              />
            </span>
            <span className="ed-strip-text">
              <strong>{PAGE_LABELS[key]}</strong>
              <span>{PAGE_NOTES[key]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
