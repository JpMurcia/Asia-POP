import { memo, type CSSProperties, type ReactNode } from 'react';
import {
  PAGE_H,
  PAGE_W,
  resolveColor,
  type DataTokens,
  type PageKey,
  type Template,
} from '../../../backend/src/catalog/template';
import type { CatalogItem, Term } from '../../../backend/src/catalog/types';
import { IMAGES } from './assets';
import TemplateElement from './TemplateElement';
import './fonts.css';
import './template.css';

export interface TemplatePageProps {
  template: Template;
  page: PageKey;
  tokens: DataTokens;
  /** Productos del bloque automático (hasta 3). */
  items?: CatalogItem[];
  terms?: Term[];
  /** Texto de introducción de la sección; sin él el bloque de introducción no se pinta. */
  introText?: string;
  /** Escala de pantalla (1 = 595,28 px de ancho). Se ignora en modo impresión. */
  scale?: number;
  /** `print` dibuja una hoja A4 de 210 × 297 mm lista para el PDF. */
  mode?: 'screen' | 'print';
  testId?: string;
  /** Recorte de cada foto de producto (datos de muestra del editor). */
  photoPositions?: string[];
  /** Contenido sobre la hoja, en px lógicos y sin recorte (la capa de selección del editor). Solo en pantalla. */
  overlay?: ReactNode;
}

/** 1 pt = 4/3 px CSS: la hoja lógica escalada así mide exactamente 210 × 297 mm. */
export const PRINT_SCALE = 4 / 3;

/**
 * Una página de la plantilla: fondo y elementos en el orden de apilado. Es el único componente que dibuja páginas:
 * el lienzo del editor, la tira de páginas, las miniaturas, la galería, la vista previa y el PDF lo usan, de modo
 * que el editor y el PDF coinciden por construcción (principio IV).
 */
function TemplatePageImpl({
  template,
  page,
  tokens,
  items,
  terms,
  introText,
  scale = 1,
  mode = 'screen',
  testId,
  photoPositions,
  overlay,
}: TemplatePageProps) {
  const { bg, els } = template.pages[page];
  const { palette, fonts } = template;
  const color = resolveColor(palette, bg.color);

  const pageStyle: CSSProperties = {
    width: `${PAGE_W}px`,
    height: `${PAGE_H}px`,
    transform: `scale(${mode === 'print' ? PRINT_SCALE : scale})`,
    backgroundColor: color,
    ...(bg.type === 'gradient'
      ? { backgroundImage: `linear-gradient(180deg, ${color}, ${resolveColor(palette, bg.color2)})` }
      : {}),
    overflow: 'hidden',
  };

  const inner = (
    <div className="tpl-page" style={pageStyle} data-page={page}>
      {bg.type === 'image' && <img className="tpl-bg" src={IMAGES[bg.image]} alt="" draggable={false} />}
      {els.map((el) =>
        el.visible === false ? null : (
          <TemplateElement
            key={el.id}
            el={el}
            palette={palette}
            fonts={fonts}
            tokens={tokens}
            items={items}
            terms={terms}
            introText={introText}
            photoPositions={photoPositions}
          />
        ),
      )}
    </div>
  );

  if (mode === 'print') {
    return (
      <section className="a4-page tpl-print" data-testid={testId} data-template-id={template.id} style={{ width: '210mm', height: '297mm' }}>
        {inner}
      </section>
    );
  }
  return (
    <div
      className="tpl-page-frame"
      data-testid={testId}
      data-template-id={template.id}
      style={{ width: `${PAGE_W * scale}px`, height: `${PAGE_H * scale}px` }}
    >
      {inner}
      {/* Fuera de la hoja recortada: el contorno y la manija de un elemento que sale de la página siguen a la vista */}
      {overlay && (
        <div className="tpl-overlay" style={{ width: `${PAGE_W}px`, height: `${PAGE_H}px`, transform: `scale(${scale})` }}>
          {overlay}
        </div>
      )}
    </div>
  );
}

const TemplatePage = memo(TemplatePageImpl);
export default TemplatePage;
