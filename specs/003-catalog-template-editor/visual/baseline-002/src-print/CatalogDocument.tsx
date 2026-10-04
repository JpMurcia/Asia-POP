import type { CatalogPayload } from '../../../backend/src/catalog/types';
import CatalogPage from './CatalogPage';
import CoverPage from './CoverPage';
import SectionCover from './SectionCover';
import TermsPage from './TermsPage';
import { themeCssVars } from './theme-vars';
import './print.css';

/** Documento completo: se usa igual en la vista previa y en la página que imprime Puppeteer. */
export default function CatalogDocument({ payload }: { payload: CatalogPayload }) {
  return (
    <div className="print-root" style={themeCssVars(payload.config.theme)} data-testid="catalog-document">
      <CoverPage config={payload.config} />
      {payload.sections.map((section) => (
        <SectionGroup key={section.key} section={section} config={payload.config} />
      ))}
      <TermsPage terms={payload.terms} config={payload.config} />
    </div>
  );
}

function SectionGroup({
  section,
  config,
}: {
  section: CatalogPayload['sections'][number];
  config: CatalogPayload['config'];
}) {
  return (
    <>
      <SectionCover section={section} config={config} />
      {section.pages.map((items, i) => (
        <CatalogPage key={i} title={section.name} items={items} config={config} />
      ))}
    </>
  );
}
