import { PAGE_KEYS, PAGE_LABELS, type Template } from '../../../../backend/src/catalog/template';
import type { BusinessSettings } from '../../../../backend/src/catalog/types';
import TemplatePage from '../../print/TemplatePage';
import { pageData } from './sample-data';

export interface PreviewPagesProps {
  template: Template;
  business: BusinessSettings;
  scale: number;
}

/** Las cuatro páginas lado a lado, tal como saldrán en el PDF: sin selección, manijas ni guías. */
export default function PreviewPages({ template, business, scale }: PreviewPagesProps) {
  return (
    <div className="ed-preview" data-testid="preview-pages">
      {PAGE_KEYS.map((key) => {
        const data = pageData(key, business);
        return (
          <figure key={key} className="ed-preview-page">
            <TemplatePage
              template={template}
              page={key}
              tokens={data.tokens}
              items={data.items}
              terms={data.terms}
              introText={data.introText}
              photoPositions={data.photoPositions}
              scale={scale}
              testId={`preview-${key}`}
            />
            <figcaption>{PAGE_LABELS[key]}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
