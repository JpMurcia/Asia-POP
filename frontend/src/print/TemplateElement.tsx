import { memo, useRef, type CSSProperties } from 'react';
import {
  CIRCLE_RADIUS,
  PAGE_H,
  PAGE_W,
  hasTokens,
  resolveColor,
  resolveTokens,
  type BadgeEl,
  type DataTokens,
  type PageElement,
  type Palette,
  type ShapeEl,
  type Template,
  type TextEl,
} from '../../../backend/src/catalog/template';
import type { CatalogItem, Term } from '../../../backend/src/catalog/types';
import { IMAGES, fontFamily, fontKeyOf, weightFor } from './assets';
import FooterBlock from './blocks/FooterBlock';
import IntroBlock from './blocks/IntroBlock';
import ProductsBlock from './blocks/ProductsBlock';
import TermsBlock from './blocks/TermsBlock';
import { useFit } from './useFit';

export interface ElementContext {
  palette: Palette;
  fonts: Template['fonts'];
  tokens: DataTokens;
  items?: CatalogItem[];
  terms?: Term[];
  introText?: string;
  photoPositions?: string[];
}

interface Props extends ElementContext {
  el: PageElement;
}

const NO_ITEMS: CatalogItem[] = [];
const NO_TERMS: Term[] = [];

/** Resplandor neón: dos sombras del color, una cerrada y otra difusa. */
const glowText = (color: string) => `0 0 10px ${color}, 0 0 24px ${color}`;

function TemplateElementImpl({ el, palette, fonts, tokens, items, terms, introText, photoPositions }: Props) {
  // Un elemento oculto no se pinta; la introducción tampoco si la sección no tiene texto
  if (el.visible === false) return null;
  if (el.type === 'intro' && !introText) return null;

  const wrapper: CSSProperties = {
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
    ...(el.rot ? { transform: `rotate(${el.rot}deg)` } : {}),
    ...(el.opacity !== 1 ? { opacity: el.opacity } : {}),
  };

  let body;
  switch (el.type) {
    case 'text':
      body = <TextBody el={el} palette={palette} fonts={fonts} tokens={tokens} />;
      break;
    case 'badge':
      body = <BadgeBody el={el} palette={palette} fonts={fonts} tokens={tokens} />;
      break;
    case 'shape':
      body = <ShapeBody el={el} palette={palette} />;
      break;
    case 'image':
      body = (
        <img
          className="tpl-image"
          data-src={el.src}
          src={IMAGES[el.src]}
          alt=""
          draggable={false}
          style={{
            objectFit: el.fit,
            borderRadius: el.radius >= CIRCLE_RADIUS ? '50%' : `${el.radius}px`,
          }}
        />
      );
      break;
    case 'intro':
      body = <IntroBlock el={el} palette={palette} fonts={fonts} text={introText} />;
      break;
    case 'products':
      body = <ProductsBlock el={el} palette={palette} fonts={fonts} items={items ?? NO_ITEMS} photoPositions={photoPositions} />;
      break;
    case 'terms':
      body = <TermsBlock el={el} palette={palette} fonts={fonts} terms={terms ?? NO_TERMS} />;
      break;
    case 'footer':
      body = <FooterBlock el={el} palette={palette} fonts={fonts} tokens={tokens} />;
      break;
  }

  return (
    <div
      className="tpl-el"
      data-el-id={el.id}
      data-el-type={el.type}
      data-locked={el.locked ? 'true' : undefined}
      style={wrapper}
    >
      {body}
    </div>
  );
}

/** Un solo elemento cambia durante un arrastre: los demás conservan su identidad y no se vuelven a dibujar. */
const TemplateElement = memo(TemplateElementImpl);
export default TemplateElement;

// ---------------------------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------------------------

function textStyle(el: TextEl, palette: Palette, fonts: Template['fonts']): CSSProperties {
  const c = (ref: string) => resolveColor(palette, ref);
  const stroke = c(el.stroke);
  const glow = c(el.glow);
  const key = fontKeyOf({ fonts }, el.font);
  return {
    fontFamily: fontFamily({ fonts }, el.font),
    // `--fit` lo escribe useFit en los textos con datos insertables; los demás lo dejan en 1
    fontSize: `calc(${el.size}px * var(--fit, 1))`,
    fontWeight: weightFor(key, el.weight),
    lineHeight: 1.05,
    color: c(el.color),
    textAlign: el.align,
    letterSpacing: `${el.ls}px`,
    textTransform: el.upper ? 'uppercase' : 'none',
    WebkitTextStroke: el.strokeW > 0 && stroke !== 'transparent' ? `calc(${el.strokeW}px * var(--fit, 1)) ${stroke}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: glow !== 'transparent' ? glowText(glow) : undefined,
    whiteSpace: 'pre-wrap',
  };
}

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

function TextBody({ el, palette, fonts, tokens }: { el: TextEl; palette: Palette; fonts: Template['fonts']; tokens: DataTokens }) {
  const content = resolveTokens(el.text, tokens);
  const style = textStyle(el, palette, fonts);
  const box = { justifyContent: JUSTIFY[el.align] };
  // El largo de un texto con datos insertables depende de los datos: se ajusta. Los textos libres se muestran tal cual.
  return hasTokens(el.text) ? (
    <FitText box={box} style={style} content={content} el={el} fonts={fonts} />
  ) : (
    <div className="tpl-text-box" style={box}>
      <div className="tpl-text" style={{ ...style, overflowWrap: 'anywhere' }}>
        {content}
      </div>
    </div>
  );
}

function FitText({
  box,
  style,
  content,
  el,
  fonts,
}: {
  box: CSSProperties;
  style: CSSProperties;
  content: string;
  el: TextEl;
  fonts: Template['fonts'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFit(ref, [content, el.size, el.weight, el.ls, el.strokeW, el.upper, el.font, fonts.title, fonts.body, el.w, el.h], {
    axis: 'both',
  });
  return (
    <div className="tpl-text-box" style={box}>
      {/* Las palabras no se parten: una palabra larguísima reduce la letra en vez de cortarse a media palabra */}
      <div className="tpl-text" data-fit="true" ref={ref} style={{ ...style, overflowWrap: 'normal' }}>
        {content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Insignia
// ---------------------------------------------------------------------------------------------------------------

function BadgeBody({ el, palette, fonts, tokens }: { el: BadgeEl; palette: Palette; fonts: Template['fonts']; tokens: DataTokens }) {
  const c = (ref: string) => resolveColor(palette, ref);
  const content = resolveTokens(el.text, tokens);
  const ref = useRef<HTMLSpanElement>(null);
  const fit = hasTokens(el.text);
  const style: CSSProperties = {
    fontFamily: fontFamily({ fonts }, el.font),
    fontSize: `calc(${el.size}px * var(--fit, 1))`,
    color: c(el.color),
  };
  return (
    <div className="tpl-badge" style={{ background: c(el.fill) }}>
      {fit ? (
        <FitBadgeText content={content} style={style} el={el} fonts={fonts} innerRef={ref} />
      ) : (
        <span className="tpl-badge-text" style={style}>
          {content}
        </span>
      )}
    </div>
  );
}

function FitBadgeText({
  content,
  style,
  el,
  fonts,
  innerRef,
}: {
  content: string;
  style: CSSProperties;
  el: BadgeEl;
  fonts: Template['fonts'];
  innerRef: React.RefObject<HTMLSpanElement | null>;
}) {
  useFit(innerRef, [content, el.size, el.font, fonts.title, fonts.body, el.w, el.h], { axis: 'both' });
  return (
    <span className="tpl-badge-text" data-fit="true" ref={innerRef} style={style}>
      {content}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Forma
// ---------------------------------------------------------------------------------------------------------------

function ShapeBody({ el, palette }: { el: ShapeEl; palette: Palette }) {
  const c = (ref: string) => resolveColor(palette, ref);
  const border = c(el.border);
  const glow = c(el.glow);
  return (
    <div
      className="tpl-shape"
      style={{
        backgroundColor: c(el.fill),
        border: el.bw > 0 && border !== 'transparent' ? `${el.bw}px solid ${border}` : 'none',
        borderRadius: el.kind === 'circle' ? '50%' : el.kind === 'pill' ? '999px' : `${el.radius}px`,
        boxShadow: glow !== 'transparent' ? `0 0 16px ${glow}, inset 0 0 12px ${glow}` : undefined,
      }}
    />
  );
}

/** Tamaño lógico de un elemento en px (para quien necesite las medidas reales de su caja). */
export const elementSize = (el: { w: number; h: number }) => ({ w: (el.w / 100) * PAGE_W, h: (el.h / 100) * PAGE_H });
