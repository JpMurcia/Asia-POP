import { useRef } from 'react';
import type { CatalogConfig, CatalogSectionPayload } from '../../../backend/src/catalog/types';
import Contact from './Contact';
import { useFit } from './useFit';

export default function SectionCover({
  section,
  config,
}: {
  section: CatalogSectionPayload;
  config: CatalogConfig;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  // Nombres de sección e introducciones largas reducen su letra para no pisarse entre sí ni con el contacto
  useFit(title, [section.name]);
  useFit(intro, [section.introText]);
  const long = section.name.length > 9;
  return (
    <section className="a4-page page-cover" data-testid="section-cover">
      <div className="frame" />
      <h1 className={`section-title${long ? ' long' : ''}`} ref={title}>
        {section.name}
      </h1>
      {section.introText && (
        <div className="section-intro" ref={intro}>
          {section.introText}
        </div>
      )}
      <Contact phone1={config.phone1} phone2={config.phone2} />
    </section>
  );
}
