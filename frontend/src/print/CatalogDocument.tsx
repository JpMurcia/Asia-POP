import { useMemo } from 'react';
import { tokensFrom } from '../../../backend/src/catalog/template';
import type { CatalogPayload } from '../../../backend/src/catalog/types';
import TemplatePage from './TemplatePage';
import './print.css';

/**
 * Documento completo: se usa igual en la vista previa y en la página que imprime Puppeteer. Cada página se dibuja
 * con `TemplatePage` a partir de la plantilla del payload: portada → por sección (portada de sección y una página
 * de productos por cada bloque de hasta 3 ítems) → políticas (solo si hay políticas). La estructura no depende de
 * la plantilla (FR-029).
 */
export default function CatalogDocument({ payload }: { payload: CatalogPayload }) {
  const { template, config, sections, terms } = payload;
  // `banner` ya incluye el texto de la generación (el servidor lo aplica a `coverTitle`)
  const base = useMemo(() => tokensFrom(config), [config]);
  const perSection = useMemo(() => sections.map((s) => tokensFrom(config, s.name)), [sections, config]);

  return (
    <div className="print-root" data-testid="catalog-document">
      <TemplatePage template={template} page="portada" tokens={base} mode="print" testId="cover-page" />
      {sections.map((section, i) => (
        <SectionPages key={section.key} section={section} tokens={perSection[i]!} template={template} />
      ))}
      {terms.length > 0 && (
        <TemplatePage template={template} page="politicas" tokens={base} terms={terms} mode="print" testId="terms-page" />
      )}
    </div>
  );
}

function SectionPages({
  section,
  tokens,
  template,
}: {
  section: CatalogPayload['sections'][number];
  tokens: ReturnType<typeof tokensFrom>;
  template: CatalogPayload['template'];
}) {
  return (
    <>
      <TemplatePage template={template} page="seccion" tokens={tokens} introText={section.introText} mode="print" testId="section-cover" />
      {section.pages.map((items, i) => (
        <TemplatePage key={i} template={template} page="productos" tokens={tokens} items={items} mode="print" testId="catalog-page" />
      ))}
    </>
  );
}
