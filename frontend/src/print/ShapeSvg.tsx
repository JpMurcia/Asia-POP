import { PAGE_H, PAGE_W, SHAPE_DEFAULTS, resolveColor, type Palette, type ShapeEl } from '../../../backend/src/catalog/template';
import { capPath, dashArray, insetBox, lineGeometry, shapePath, strokeOf } from './shapes';

/**
 * Formas dibujadas con SVG (feature 013): triángulo, rombo, estrella, estallido, flecha, globo y línea. El `viewBox` es
 * el tamaño real de la caja en px, así que el trazo y los extremos no se deforman con la proporción de la caja.
 * Rectángulo, círculo y píldora no pasan por aquí: conservan su CSS de siempre.
 */
export default function ShapeSvg({ el, palette }: { el: ShapeEl; palette: Palette }) {
  const c = (ref: string) => resolveColor(palette, ref);
  const w = (el.w / 100) * PAGE_W;
  const h = (el.h / 100) * PAGE_H;
  const bs = el.bs ?? SHAPE_DEFAULTS.bs;
  const glow = c(el.glow);
  const common = {
    className: 'tpl-shape',
    width: '100%',
    height: '100%',
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: 'none',
    style: { overflow: 'visible', display: 'block', ...(glow !== 'transparent' ? { filter: `drop-shadow(0 0 8px ${glow})` } : {}) },
  } as const;

  if (el.kind === 'line') {
    const g = strokeOf(el.bw);
    const color = c(el.fill);
    const geo = lineGeometry(w, h, el.bw, el.capStart, el.capEnd);
    return (
      <svg {...common}>
        <line
          x1={geo.x1}
          y1={geo.y}
          x2={geo.x2}
          y2={geo.y}
          stroke={color}
          strokeWidth={g}
          strokeDasharray={dashArray(bs, el.bw)}
          strokeLinecap={bs === 'dotted' ? 'round' : 'butt'}
        />
        {geo.caps.map((cap) => (
          <path key={cap.side} d={capPath(cap, geo.y)} fill={color} />
        ))}
      </svg>
    );
  }

  const border = c(el.border);
  const hasBorder = el.bw > 0 && border !== 'transparent' && border !== 'none';
  const box = insetBox(w, h, hasBorder ? el.bw : 0);
  return (
    <svg {...common}>
      <path
        d={shapePath(el.kind, box.w, box.h)}
        transform={`translate(${box.x} ${box.y})`}
        fill={c(el.fill)}
        stroke={hasBorder ? border : 'none'}
        strokeWidth={hasBorder ? el.bw : undefined}
        strokeDasharray={hasBorder ? dashArray(bs, el.bw) : undefined}
        strokeLinecap={hasBorder && bs === 'dotted' ? 'round' : undefined}
        strokeLinejoin="round"
      />
    </svg>
  );
}
