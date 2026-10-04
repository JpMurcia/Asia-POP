import { useRef } from 'react';
import {
  resolveColor,
  resolveTokens,
  type DataTokens,
  type FooterEl,
  type Palette,
  type Template,
} from '../../../../backend/src/catalog/template';
import { fontFamily } from '../assets';
import { useFit } from '../useFit';
import './footer-block.css';

interface Props {
  el: FooterEl;
  palette: Palette;
  fonts: Template['fonts'];
  tokens: DataTokens;
}

/**
 * Pie de página con los datos insertables: una línea cuando cabe; con una dirección larga pasa a dos líneas y, si
 * aún no cabe, reduce su letra hasta el mínimo de 6 pt (FR-031).
 */
export default function FooterBlock({ el, palette, fonts, tokens }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const content = resolveTokens(el.content, tokens);
  useFit(box, [content, el.w, el.h, el.bw]);
  const c = (ref: string) => resolveColor(palette, ref);
  const line = c(el.line);
  return (
    <div
      className="fb"
      data-testid="page-footer"
      data-part="footer"
      ref={box}
      style={{
        background: c(el.fill),
        borderTop: el.bw > 0 && line !== 'transparent' ? `${el.bw}px solid ${line}` : 'none',
        color: c(el.textColor),
        fontFamily: fontFamily({ fonts }, 'body'),
      }}
    >
      <span className="fb-text">{content}</span>
    </div>
  );
}
