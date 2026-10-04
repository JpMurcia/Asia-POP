import { useRef } from 'react';
import type { CatalogConfig } from '../../../backend/src/catalog/types';
import collage from '../assets/print/collage.png';
import Contact from './Contact';
import { useFit } from './useFit';

export default function CoverPage({ config }: { config: CatalogConfig }) {
  const title = useRef<HTMLHeadingElement>(null);
  // Un banner largo reduce su letra para no tocar el collage
  useFit(title, [config.coverTitle]);
  return (
    <section className="a4-page page-cover" data-testid="cover-page">
      <div className="frame" />
      <h1 className="cover-title" ref={title}>
        {config.coverTitle}
      </h1>
      <img className="cover-collage" src={collage} alt="" />
      <Contact phone1={config.phone1} phone2={config.phone2} />
    </section>
  );
}
