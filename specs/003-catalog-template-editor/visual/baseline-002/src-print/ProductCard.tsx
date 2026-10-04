import { useRef } from 'react';
import type { CatalogItem } from '../../../backend/src/catalog/types';
import soldOutSeal from '../assets/print/sold-out.png';
import { useFit } from './useFit';

/**
 * Fila de producto (imagen + burbuja de texto + precio). `side` alterna izquierda/derecha como en Cat.pdf.
 * `index` fija la posición vertical (0, 1, 2) dentro de la página.
 */
export default function ProductCard({
  item,
  index,
  side,
}: {
  item: CatalogItem;
  index: number;
  side: 'left' | 'right';
}) {
  const soldOut = item.kind !== 'custom' && item.soldOut;
  const priceLabel = item.priceLabel;
  const bubble = useRef<HTMLDivElement>(null);
  // Textos largos: la burbuja reduce su letra hasta caber (la descripción además se corta a 5 líneas)
  useFit(bubble, [item]);

  const hasExtra =
    (item.kind === 'custom' && ((item.flavors?.length ?? 0) > 0 || (item.options?.length ?? 0) > 0)) ||
    item.kind === 'bundle';

  return (
    <div
      className={`product-row ${side}`}
      style={{ top: `${10.4 + index * 29.1}%` }}
      data-testid="product-card"
      data-sold-out={soldOut ? 'true' : 'false'}
    >
      <div className="image-card">
        <img className="photo" src={item.imageUrl} alt={item.name} />
        {soldOut && (
          <>
            <img className="sold-out" src={soldOutSeal} alt="" />
            <span className="sold-out-label">AGOTADO</span>
          </>
        )}
      </div>

      <div className={`bubble${hasExtra ? ' has-extra' : ''}`} ref={bubble}>
        {(item.kind === 'custom' || item.kind === 'bundle') && <div className="name">{item.name}</div>}
        {item.description && <div className="desc">{item.description}</div>}

        {item.kind === 'alegra' && !item.description && <div className="name">{item.name}</div>}

        {item.kind === 'custom' && item.flavors && item.flavors.length > 0 && (
          <div className="extra">Sabores: {item.flavors.join(', ')}</div>
        )}
        {item.kind === 'custom' && item.options && item.options.length > 0 && (
          <ul>
            {item.options.map((o) => (
              <li key={o.label}>
                {/* Si la etiqueta es muy larga se corta ella; el precio y el máximo de sabores siempre se ven */}
                <span className="opt-label">{o.label}</span>
                <span className="opt-price">
                  : {o.priceLabel}
                  {o.maxFlavors ? ` · máx. ${o.maxFlavors} sabores` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {item.kind === 'bundle' && (
          <div className="extra">
            Incluye: {item.components.map((c) => `${c.quantity} × ${c.name}`).join(' + ')}
          </div>
        )}
      </div>

      {priceLabel && <div className="price">{priceLabel}</div>}
    </div>
  );
}
