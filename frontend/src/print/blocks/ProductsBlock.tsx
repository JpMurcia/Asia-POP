import { useRef, type CSSProperties } from 'react';
import { PAGE_H, PAGE_W, resolveColor, type Palette, type ProductsEl, type Template } from '../../../../backend/src/catalog/template';
import { layoutRows, type RowLayout } from '../../../../backend/src/catalog/template-layout';
import type { CatalogItem } from '../../../../backend/src/catalog/types';
import { SOLD_OUT_SEAL, fontFamily } from '../assets';
import { useFit } from '../useFit';
import './products-block.css';

interface Props {
  el: ProductsEl;
  palette: Palette;
  fonts: Template['fonts'];
  items: CatalogItem[];
  /** Recorte (`background-position`) de cada foto: los datos de muestra del editor usan el collage como foto. */
  photoPositions?: string[];
}

const PRICE_RADIUS = { pill: '999px', round: '8px', square: '0' } as const;

/**
 * Con la letra ya en su mínimo (6 pt) y el texto aún sin caber, se muestran menos líneas de cada párrafo (con "…"):
 * un texto extremo se corta en lugar de volverse ilegible.
 */
const BUBBLE_LAST_RESORT: Record<string, string>[] = [
  { '--desc-lines': '4' },
  { '--desc-lines': '3', '--extra-lines': '2', '--name-lines': '2' },
  { '--desc-lines': '2', '--extra-lines': '1', '--name-lines': '2' },
  { '--desc-lines': '1', '--extra-lines': '1', '--name-lines': '1' },
];
const px = (n: number) => `${n}px`;

/** Un producto agotado según las reglas de 001: Alegra y combos, nunca un producto propio (principio II). */
const isSoldOut = (item: CatalogItem): boolean => item.kind !== 'custom' && item.soldOut;

/**
 * Bloque automático de productos: hasta 3 filas (foto, burbuja de descripción y etiqueta de precio) dentro de la caja
 * del bloque, con la geometría de `layoutRows`. Es el único bloque que muestra productos, así que el editor, las
 * miniaturas y el PDF dibujan lo mismo.
 */
export default function ProductsBlock({ el, palette, fonts, items, photoPositions }: Props) {
  const W = (el.w / 100) * PAGE_W;
  const H = (el.h / 100) * PAGE_H;
  const rows = layoutRows(el.layout, W, H);
  return (
    <div className="pb" style={{ fontFamily: fontFamily({ fonts }, 'body') }} data-layout={el.layout}>
      {items.slice(0, 3).map((item, i) => (
        <ProductRow
          key={`${item.kind}-${item.id}`}
          el={el}
          palette={palette}
          item={item}
          row={rows[i]!}
          photoPosition={photoPositions?.[i]}
        />
      ))}
      {rows.slice(0, Math.min(items.length, 3)).map((r, i) =>
        r.separatorY !== undefined ? (
          <div
            key={`sep-${i}`}
            className="pb-sep"
            style={{ top: px(r.separatorY), background: resolveColor(palette, el.textColor) }}
          />
        ) : null,
      )}
    </div>
  );
}

function ProductRow({
  el,
  palette,
  item,
  row,
  photoPosition,
}: {
  el: ProductsEl;
  palette: Palette;
  item: CatalogItem;
  row: RowLayout;
  photoPosition?: string;
}) {
  const c = (ref: string) => resolveColor(palette, ref);
  const soldOut = isSoldOut(item);
  const bubble = useRef<HTMLDivElement>(null);
  // Textos largos: la burbuja reduce su letra hasta caber (la descripción además se corta a 5 líneas)
  useFit(bubble, [item, el.layout, row.bubble.h, row.bubble.w], { lastResort: BUBBLE_LAST_RESORT });

  const hasPrice = !!item.priceLabel;
  const ring = el.ringW > 0 && c(el.ring) !== 'transparent' ? `${el.ringW}px solid ${c(el.ring)}` : 'none';
  const innerRadius = Math.max(0, el.cardRadius - el.ringW);
  const photoStyle: CSSProperties = {
    left: px(row.photo.x),
    top: px(row.photo.y),
    width: px(row.photo.w),
    height: px(row.photo.h),
    background: c(el.cardFill),
    border: ring,
    borderRadius: px(el.cardRadius),
    // El sello de Cat.pdf se extiende más allá de la tarjeta; la cinta y el gris quedan recortados en ella
    overflow: el.sold === 'sello' ? 'visible' : 'hidden',
  };
  const imgStyle: CSSProperties = {
    borderRadius: px(innerRadius),
    filter: soldOut && el.sold === 'gris' ? 'grayscale(1)' : undefined,
  };

  const extras =
    (item.kind === 'custom' && ((item.flavors?.length ?? 0) > 0 || (item.options?.length ?? 0) > 0)) ||
    item.kind === 'bundle';
  const left = row.align === 'left';

  return (
    <div className="pb-row" data-testid="product-card" data-sold-out={soldOut ? 'true' : 'false'}>
      <div className="pb-photo" data-part="photo" style={photoStyle}>
        {photoPosition ? (
          <div
            className="pb-img"
            role="img"
            aria-label={item.name}
            style={{ ...imgStyle, backgroundImage: `url(${item.imageUrl})`, backgroundSize: '300% auto', backgroundPosition: photoPosition }}
          />
        ) : (
          <img className="pb-img" src={item.imageUrl} alt={item.name} style={imgStyle} />
        )}
        {soldOut && el.sold === 'sello' && (
          <>
            <img className="pb-seal" src={SOLD_OUT_SEAL} alt="" />
            {/* Texto real (invisible) para que el PDF sea buscable y accesible */}
            <span className="pb-sold-label">AGOTADO</span>
          </>
        )}
        {soldOut && el.sold === 'cinta' && (
          <div className="pb-ribbon" style={{ background: c(el.soldFill) }}>
            AGOTADO
          </div>
        )}
        {soldOut && el.sold === 'gris' && (
          <div className="pb-gray-tag" style={{ background: c(el.textColor) }}>
            AGOTADO
          </div>
        )}
      </div>

      <div
        className={`pb-bubble${extras ? ' has-extra' : ''}`}
        data-part="bubble"
        ref={bubble}
        style={{
          left: px(row.bubble.x),
          top: px(row.bubble.y),
          width: px(row.bubble.w),
          minHeight: px(row.bubble.minH ?? row.bubble.h),
          maxHeight: px(row.bubble.h),
          background: c(el.bubbleFill),
          borderRadius: px(el.bubbleRadius),
          color: c(el.textColor),
          alignItems: left ? 'flex-start' : 'center',
          textAlign: left ? 'left' : 'center',
        }}
      >
        {/* Todo producto muestra su nombre y, si la tiene, su descripción (FR-010 de 001). Antes un producto de Alegra
            con descripción mostraba solo esta, y una nota de envío lo dejaba sin nombre. */}
        <div className="pb-name">{item.name}</div>
        {item.description && <div className="pb-desc">{item.description}</div>}

        {item.kind === 'custom' && item.flavors && item.flavors.length > 0 && (
          <div className="pb-extra">Sabores: {item.flavors.join(', ')}</div>
        )}
        {item.kind === 'custom' && item.options && item.options.length > 0 && (
          <ul className="pb-options">
            {item.options.map((o) => (
              <li key={o.label} style={{ justifyContent: left ? 'flex-start' : 'center' }}>
                {/* Si la etiqueta es muy larga se corta ella; el precio y el máximo de sabores siempre se ven */}
                <span className="pb-opt-label">{o.label}</span>
                <span className="pb-opt-price">
                  : {o.priceLabel}
                  {o.maxFlavors ? ` · máx. ${o.maxFlavors} sabores` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {item.kind === 'bundle' && (
          <div className="pb-extra">Incluye: {item.components.map((cmp) => `${cmp.quantity} × ${cmp.name}`).join(' + ')}</div>
        )}
      </div>

      {hasPrice && (
        <div
          className="pb-price"
          data-part="price"
          style={{
            left: px(row.price.x + row.price.w / 2),
            top: px(row.price.y),
            minWidth: px(row.price.w),
            height: px(row.price.h),
            background: c(el.priceFill),
            border: c(el.priceBorder) === 'transparent' ? 'none' : `1.5px solid ${c(el.priceBorder)}`,
            borderRadius: PRICE_RADIUS[el.priceShape],
            color: c(el.priceText),
          }}
        >
          {item.priceLabel}
        </div>
      )}
    </div>
  );
}
