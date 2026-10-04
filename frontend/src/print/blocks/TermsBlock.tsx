import { useRef } from 'react';
import { resolveColor, type Palette, type TermsEl, type Template } from '../../../../backend/src/catalog/template';
import type { Term } from '../../../../backend/src/catalog/types';
import { fontFamily, fontKeyOf, weightFor } from '../assets';
import { useFit } from '../useFit';
import './terms-block.css';

/** Con la letra en su mínimo (6 pt) y el texto aún sin caber: espacios e interlineado más apretados. */
const TERMS_LAST_RESORT: Record<string, string>[] = [
  { '--tb-space': '0.6', '--tb-lh': '1.3' },
  { '--tb-space': '0.3', '--tb-lh': '1.2' },
];

interface Props {
  el: TermsEl;
  palette: Palette;
  fonts: Template['fonts'];
  terms: Term[];
}

/**
 * Bloque automático de políticas: cada política es una caja con su título como chip y su texto por líneas. Las
 * políticas largas reducen su letra hasta caber en la caja del bloque.
 */
export default function TermsBlock({ el, palette, fonts, terms }: Props) {
  const body = useRef<HTMLDivElement>(null);
  useFit(body, [terms, el.w, el.h], { lastResort: TERMS_LAST_RESORT });
  const c = (ref: string) => resolveColor(palette, ref);
  // Los títulos (chips) van con la tipografía de título, como los demás encabezados
  const chipFont = { fontFamily: fontFamily({ fonts }, 'title'), fontWeight: weightFor(fontKeyOf({ fonts }, 'title'), 700) };
  return (
    <div className="tb" data-part="terms-body" ref={body} style={{ fontFamily: fontFamily({ fonts }, 'body') }}>
      {terms.map((t, i) => (
        <div className="tb-item" key={`${i}-${t.title}`} style={{ background: c(el.boxFill), color: c(el.textColor) }}>
          <h3 className="tb-chip" style={{ ...chipFont, background: c(el.chipFill), color: c(el.chipText) }}>
            {t.title}
          </h3>
          {t.body.split('\n').map((line, j) => (
            <p key={j}>{line}</p>
          ))}
        </div>
      ))}
    </div>
  );
}
