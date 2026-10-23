import { useId, type CSSProperties } from 'react';
import { PAGE_H, PAGE_W, resolveColor, type Palette, type Template, type TextEl } from '../../../backend/src/catalog/template';
import { fontFamily, fontKeyOf, weightFor } from './assets';
import { dropShadowFilter, shadowList } from './text-effects';
import { arcPath, decorationLine } from './text-format';

/**
 * Texto curvo (feature 012): la primera línea del texto sobre un arco, dibujada como SVG del tamaño de la caja.
 * Lo comparten el lienzo, las miniaturas, la vista previa y el PDF. No pasa por `FitText`: usa `el.size` tal cual.
 * `text-shadow` no se aplica de forma fiable al texto SVG; las sombras van como `filter: drop-shadow`.
 */
export default function CurvedText({
  el,
  palette,
  fonts,
  content,
}: {
  el: TextEl;
  palette: Palette;
  fonts: Template['fonts'];
  content: string;
}) {
  const pathId = useId();
  const c = (ref: string) => resolveColor(palette, ref);
  const w = Math.round(((el.w / 100) * PAGE_W) * 100) / 100;
  const h = Math.round(((el.h / 100) * PAGE_H) * 100) / 100;
  const line = (content.split('\n')[0] ?? '').trim() === '' ? '' : content.split('\n')[0]!;
  const key = fontKeyOf({ fonts }, el.font);
  const stroke = c(el.stroke);
  const hasStroke = el.strokeW > 0 && stroke !== 'transparent';
  const hollow = el.hollow === true;
  const edge = hasStroke ? stroke : c(el.color);
  const style: CSSProperties = {
    overflow: 'visible',
    display: 'block',
    filter: dropShadowFilter(shadowList(el, palette)),
  };
  return (
    <svg className="tpl-text tpl-text-curve" data-curve={el.curve} viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={style}>
      <defs>
        <path id={pathId} d={arcPath(w, h, el.curve ?? 0)} />
      </defs>
      <text
        fontFamily={fontFamily({ fonts }, el.font)}
        fontSize={el.size}
        fontWeight={weightFor(key, el.weight)}
        fontStyle={el.italic ? 'italic' : undefined}
        letterSpacing={el.ls}
        textDecoration={decorationLine(el)}
        textAnchor="middle"
        dominantBaseline="central"
        fill={hollow ? 'transparent' : c(el.color)}
        stroke={hollow || hasStroke ? edge : undefined}
        strokeWidth={hollow ? (hasStroke ? el.strokeW : 2) : hasStroke ? el.strokeW : undefined}
        paintOrder="stroke fill"
      >
        <textPath href={`#${pathId}`} startOffset="50%">
          {el.upper ? line.toUpperCase() : line}
        </textPath>
      </text>
    </svg>
  );
}
