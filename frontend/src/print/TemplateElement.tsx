import { memo, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  CIRCLE_RADIUS,
  PAGE_H,
  PAGE_W,
  TEXT_DEFAULTS,
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
import { fontFamily, fontKeyOf, imageSrc, weightFor } from './assets';
import FooterBlock from './blocks/FooterBlock';
import IntroBlock from './blocks/IntroBlock';
import ProductsBlock from './blocks/ProductsBlock';
import TermsBlock from './blocks/TermsBlock';
import CurvedText from './CurvedText';
import ShapeSvg from './ShapeSvg';
import { bgStyle, hollowStyle, textShadowOf } from './text-effects';
import { LIST_INDENT, decorationLine, listLines } from './text-format';
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

function TemplateElementImpl({ el, palette, fonts, tokens, items, terms, introText, photoPositions }: Props) {
  // Un elemento oculto no se pinta; la introducción tampoco si la sección no tiene texto
  if (el.visible === false) return null;
  if (el.type === 'intro' && !introText) return null;

  // Voltear (feature 013, solo formas e imágenes): se compone con el giro; sin volteo el transform es el de siempre
  const flip = el.type === 'shape' || el.type === 'image' ? { h: el.flipH === true, v: el.flipV === true } : { h: false, v: false };
  const transform = [el.rot ? `rotate(${el.rot}deg)` : '', flip.h || flip.v ? `scale(${flip.h ? -1 : 1}, ${flip.v ? -1 : 1})` : '']
    .filter(Boolean)
    .join(' ');
  const wrapper: CSSProperties = {
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
    ...(transform ? { transform } : {}),
    ...(el.opacity !== 1 ? { opacity: el.opacity } : {}),
  };

  // Enlace (feature 013): solo texto, insignia, forma e imagen; vacío = sin enlace
  const href = el.type === 'text' || el.type === 'badge' || el.type === 'shape' || el.type === 'image' ? el.href || undefined : undefined;

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
          src={imageSrc(el.src)}
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
      {href ? (
        <a className="tpl-link" href={href} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

/** Un solo elemento cambia durante un arrastre: los demás conservan su identidad y no se vuelven a dibujar. */
const TemplateElement = memo(TemplateElementImpl);
export default TemplateElement;

// ---------------------------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------------------------

/** Estilo del texto; lo usan también las vistas previas «Ag» del panel de efectos, para que nunca diverjan. */
export function textStyle(el: TextEl, palette: Palette, fonts: Template['fonts']): CSSProperties {
  const c = (ref: string) => resolveColor(palette, ref);
  const stroke = c(el.stroke);
  const key = fontKeyOf({ fonts }, el.font);
  return {
    fontFamily: fontFamily({ fonts }, el.font),
    // `--fit` lo escribe useFit en los textos con datos insertables; los demás lo dejan en 1
    fontSize: `calc(${el.size}px * var(--fit, 1))`,
    fontWeight: weightFor(key, el.weight),
    lineHeight: el.lh ?? TEXT_DEFAULTS.lh,
    color: c(el.color),
    textAlign: el.align,
    letterSpacing: `${el.ls}px`,
    textTransform: el.upper ? 'uppercase' : 'none',
    // Del color del texto (currentColor); CSS tacha cada línea de un texto de varias
    fontStyle: el.italic ? 'italic' : undefined,
    // Subrayado (feature 012) y tachado se combinan
    textDecorationLine: decorationLine(el),
    WebkitTextStroke: el.strokeW > 0 && stroke !== 'transparent' ? `calc(${el.strokeW}px * var(--fit, 1)) ${stroke}` : undefined,
    paintOrder: 'stroke fill',
    // Capas de sombra en orden fijo: neón → brillo → eco → desalineado → distorsión → sombra (features 011 y 012)
    textShadow: textShadowOf(el, palette),
    whiteSpace: 'pre-wrap',
    // «Sin relleno»: relleno transparente y borde de las letras
    ...hollowStyle(el, palette),
  };
}

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'flex-start' } as const;

/** El contenido del texto: tal cual, con fondo (feature 011) o como lista con sangría francesa (feature 012). */
function textBody(content: string, el: TextEl, bg: CSSProperties | undefined): ReactNode {
  if (el.list === 'bullet' || el.list === 'number') {
    return listLines(content, el.list).map((l, i) => (
      <div key={i} style={{ paddingLeft: LIST_INDENT, textIndent: `-${LIST_INDENT}` }}>
        {l.marker ? `${l.marker}\u00a0` : null}
        {l.text === '' ? '\u00a0' : bg && l.text.trim() !== '' ? <span style={bg}>{l.text}</span> : l.text}
      </div>
    ));
  }
  return bg ? <span style={bg}>{content}</span> : content;
}

/** Anclaje vertical (feature 008). Sin el campo, o con `middle`, no se agrega nada: la caja ya centra, como siempre. */
const ANCHOR = { top: 'flex-start', bottom: 'flex-end' } as const;

function TextBody({ el, palette, fonts, tokens }: { el: TextEl; palette: Palette; fonts: Template['fonts']; tokens: DataTokens }) {
  const content = resolveTokens(el.text, tokens);
  const style = textStyle(el, palette, fonts);
  // Texto curvo (feature 012): un SVG del tamaño de la caja; con 0 o sin el campo, el texto de siempre
  if (el.curve) return <CurvedText el={el} palette={palette} fonts={fonts} content={content} />;
  const box: CSSProperties = { justifyContent: JUSTIFY[el.align] };
  // Justificado: el texto ocupa todo el ancho de la caja para poder repartirse de borde a borde
  if (el.align === 'justify') style.width = '100%';
  // Fondo del texto (feature 011): un <span> solo si está activo y hay texto; sin él, el HTML es el de siempre
  const bg = content ? bgStyle(el, palette) : undefined;
  const body = textBody(content, el, bg);
  if (el.vAlign === 'top' || el.vAlign === 'bottom') box.alignItems = ANCHOR[el.vAlign];
  // El largo de un texto con datos insertables depende de los datos: se ajusta. Los textos libres se muestran tal cual.
  return hasTokens(el.text) ? (
    <FitText box={box} style={style} body={body} content={content} el={el} fonts={fonts} />
  ) : (
    <div className="tpl-text-box" style={box}>
      <div className="tpl-text" style={{ ...style, overflowWrap: 'anywhere' }}>
        {body}
      </div>
    </div>
  );
}

function FitText({
  box,
  style,
  body,
  content,
  el,
  fonts,
}: {
  box: CSSProperties;
  style: CSSProperties;
  /** El contenido ya armado (con fondo o como lista); `content` queda para las dependencias del ajuste. */
  body: ReactNode;
  content: string;
  el: TextEl;
  fonts: Template['fonts'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFit(ref, [content, el.size, el.weight, el.ls, el.lh, el.strokeW, el.upper, el.font, fonts.title, fonts.body, el.w, el.h, el.bg, el.bgPad, el.list, el.italic, el.underline, el.align], {
    axis: 'both',
  });
  return (
    <div className="tpl-text-box" style={box}>
      {/* Las palabras no se parten: una palabra larguísima reduce la letra en vez de cortarse a media palabra */}
      <div className="tpl-text" data-fit="true" ref={ref} style={{ ...style, overflowWrap: 'normal' }}>
        {body}
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
  // Las figuras de la feature 013 y la línea se dibujan en SVG; rectángulo, círculo y píldora conservan su CSS
  if (el.kind !== 'rect' && el.kind !== 'circle' && el.kind !== 'pill') return <ShapeSvg el={el} palette={palette} />;
  const c = (ref: string) => resolveColor(palette, ref);
  const border = c(el.border);
  const glow = c(el.glow);
  return (
    <div
      className="tpl-shape"
      style={{
        backgroundColor: c(el.fill),
        border: el.bw > 0 && border !== 'transparent' ? `${el.bw}px ${el.bs ?? 'solid'} ${border}` : 'none',
        borderRadius: el.kind === 'circle' ? '50%' : el.kind === 'pill' ? '999px' : `${el.radius}px`,
        boxShadow: glow !== 'transparent' ? `0 0 16px ${glow}, inset 0 0 12px ${glow}` : undefined,
      }}
    />
  );
}

/** Tamaño lógico de un elemento en px (para quien necesite las medidas reales de su caja). */
export const elementSize = (el: { w: number; h: number }) => ({ w: (el.w / 100) * PAGE_W, h: (el.h / 100) * PAGE_H });
