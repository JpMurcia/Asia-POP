import { useRef } from 'react';
import type { CatalogConfig, Term } from '../../../backend/src/catalog/types';
import logo from '../assets/print/logo.png';
import FooterInfo from './FooterInfo';
import { useFit } from './useFit';

export default function TermsPage({ terms, config }: { terms: Term[]; config: CatalogConfig }) {
  const body = useRef<HTMLDivElement>(null);
  // Las políticas largas reducen su letra hasta caber entre el título y el pie
  useFit(body, [terms]);
  if (terms.length === 0) return null;
  return (
    <section className="a4-page page-marble" data-testid="terms-page">
      <h2 className="terms-heading">Políticas de compra</h2>
      <img className="page-logo" src={logo} alt="" />
      <div className="terms-body" ref={body}>
        {terms.map((t) => (
          <div className="terms-block" key={t.title}>
            <h3>{t.title}</h3>
            {t.body.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ))}
      </div>
      <FooterInfo config={config} />
    </section>
  );
}
