import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { DataTokens, PageElement, PageKey, Template } from '../../../../backend/src/catalog/template';
import type { CatalogItem, Term } from '../../../../backend/src/catalog/types';
import TemplatePage from '../../print/TemplatePage';
import './editor.css';
import { usePointerDrag } from './usePointerDrag';

export interface CanvasProps {
  template: Template;
  page: PageKey;
  tokens: DataTokens;
  items?: CatalogItem[];
  terms?: Term[];
  introText?: string;
  photoPositions?: string[];
  /** Escala de pantalla de la hoja (1 = 595,28 px de ancho). */
  scale: number;
  selId: string | null;
  onSelect: (id: string | null) => void;
  /** Una vez por gesto, antes del primer movimiento. */
  onCheckpoint: () => void;
  onPatch: (id: string, patch: Partial<PageElement>) => void;
  testId?: string;
}

const SELECTION = '#6D4AFF';

/**
 * Lienzo del editor: la página dibujada con `TemplatePage` (la misma que usa el PDF) y, encima, la capa de selección
 * con su contorno, la manija de esquina y las guías de centro. Un solo oyente de `pointerdown` en la hoja resuelve el
 * elemento tocado con `closest('[data-el-id]')`, de modo que siempre se elige el de más arriba.
 */
export default function Canvas({
  template,
  page,
  tokens,
  items,
  terms,
  introText,
  photoPositions,
  scale,
  selId,
  onSelect,
  onCheckpoint,
  onPatch,
  testId,
}: CanvasProps) {
  const frame = useRef<HTMLDivElement>(null);
  const { begin, guides } = usePointerDrag(frame, { onCheckpoint, onPatch });
  const els = template.pages[page].els;
  const selected = els.find((e) => e.id === selId && e.visible !== false);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-el-id]');
    const el = target ? els.find((x) => x.id === target.getAttribute('data-el-id')) : undefined;
    if (!el) {
      onSelect(null);
      return;
    }
    e.preventDefault();
    onSelect(el.id);
    // Un elemento fijo se selecciona, pero no se mueve hasta desbloquearlo
    if (!el.locked) begin(e, el.id, 'move', el);
  }

  function onHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !selected || selected.locked) return;
    e.stopPropagation();
    e.preventDefault();
    begin(e, selected.id, 'resize', selected);
  }

  const px = (n: number) => `${n / scale}px`;
  const overlay = (
    <>
      {selected && (
        <div
          data-testid="selection"
          className="ed-selection"
          style={{
            left: `${selected.x}%`,
            top: `${selected.y}%`,
            width: `${selected.w}%`,
            height: `${selected.h}%`,
            transform: selected.rot ? `rotate(${selected.rot}deg)` : undefined,
            outlineWidth: px(2),
            outlineStyle: selected.locked ? 'dashed' : 'solid',
            outlineColor: SELECTION,
          }}
        >
          {!selected.locked && (
            <div
              data-testid="resize-handle"
              className="ed-handle"
              onPointerDown={onHandleDown}
              style={{ width: px(12), height: px(12), right: px(-6), bottom: px(-6), borderWidth: px(2), borderColor: SELECTION }}
            />
          )}
        </div>
      )}
      {guides.v && <div data-testid="guide-v" className="ed-guide ed-guide-v" style={{ width: px(1) }} />}
      {guides.h && <div data-testid="guide-h" className="ed-guide ed-guide-h" style={{ height: px(1) }} />}
    </>
  );

  return (
    <div ref={frame} className="ed-canvas" onPointerDown={onPointerDown} data-page={page}>
      <TemplatePage
        template={template}
        page={page}
        tokens={tokens}
        items={items}
        terms={terms}
        introText={introText}
        photoPositions={photoPositions}
        scale={scale}
        testId={testId}
        overlay={overlay}
      />
    </div>
  );
}
