import type { CatalogConfig } from '../../../backend/src/catalog/types';

/**
 * Pie de las páginas de producto y de políticas: teléfonos y dirección configurados, en una sola línea
 * (la dirección se corta con puntos suspensivos si es muy larga). Las portadas usan su bloque "Domicilios".
 */
export default function FooterInfo({ config }: { config: Pick<CatalogConfig, 'phone1' | 'phone2' | 'address'> }) {
  const phones = [config.phone1, config.phone2].filter(Boolean);
  return (
    <footer className="page-footer" data-testid="page-footer">
      {phones.length > 0 && (
        <span className="phones">
          {phones.map((p, i) => (
            <span key={p}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              {p}
            </span>
          ))}
        </span>
      )}
      {config.address && <span className="address">{config.address}</span>}
    </footer>
  );
}
