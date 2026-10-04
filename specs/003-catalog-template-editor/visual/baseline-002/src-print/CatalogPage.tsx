import { useRef } from 'react';
import type { CatalogConfig, CatalogItem } from '../../../backend/src/catalog/types';
import logo from '../assets/print/logo.png';
import FooterInfo from './FooterInfo';
import ProductCard from './ProductCard';
import { useFit } from './useFit';

/** Página A4 con máximo 3 productos sobre fondo de mármol y el pie con teléfonos y dirección. */
export default function CatalogPage({
  title,
  items,
  config,
}: {
  title: string;
  items: CatalogItem[];
  config: CatalogConfig;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Un nombre de sección largo reduce la letra del título para no pisar el logo ni la primera tarjeta
  useFit(heading, [title]);
  return (
    <section className="a4-page page-marble" data-testid="catalog-page">
      <h2 className="page-heading" ref={heading}>
        Catálogo {title}
      </h2>
      <img className="page-logo" src={logo} alt="" />
      {items.slice(0, 3).map((item, i) => (
        <ProductCard key={`${item.kind}-${item.id}`} item={item} index={i} side={i % 2 === 0 ? 'left' : 'right'} />
      ))}
      <FooterInfo config={config} />
    </section>
  );
}
