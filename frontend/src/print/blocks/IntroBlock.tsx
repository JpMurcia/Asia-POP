import { useRef } from 'react';
import { resolveColor, type IntroEl, type Palette, type Template } from '../../../../backend/src/catalog/template';
import { fontFamily } from '../assets';
import { useFit } from '../useFit';
import './intro-block.css';

interface Props {
  el: IntroEl;
  palette: Palette;
  fonts: Template['fonts'];
  /** Texto de introducción de la sección; sin él el bloque no se pinta. */
  text?: string;
}

/**
 * Introducción de una sección propia. La caja crece con su texto hasta el alto del bloque (como en 002: un texto
 * corto da una caja baja) y, si no cabe, reduce su letra.
 */
export default function IntroBlock({ el, palette, fonts, text }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useFit(box, [text, el.w, el.h]);
  if (!text) return null;
  return (
    <div
      className="ib"
      data-part="intro"
      ref={box}
      style={{
        background: resolveColor(palette, el.boxFill),
        color: resolveColor(palette, el.textColor),
        borderRadius: `${el.radius}px`,
        fontFamily: fontFamily({ fonts }, 'body'),
        whiteSpace: 'pre-line',
      }}
    >
      {text}
    </div>
  );
}
