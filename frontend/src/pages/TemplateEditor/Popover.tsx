import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PopoverProps {
  open: boolean;
  /** El control que abre el panel: el panel se coloca junto a él y recupera el foco al cerrarse. */
  anchor: HTMLElement | null;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const WIDTH = 300;
const GAP = 8;
const MARGIN = 8;

/**
 * Panel anclado junto a un control del inspector (feature 009). Va en un portal con posición fija porque el
 * inspector tiene scroll y recortaría un panel interno. Se cierra con Escape, con el botón «Cerrar» o al hacer clic
 * fuera, y devuelve el foco al control que lo abrió si el foco estaba dentro del panel.
 */
export default function Popover(props: PopoverProps) {
  return props.open && props.anchor ? <PopoverPanel {...props} anchor={props.anchor} /> : null;
}

function place(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  // El inspector está pegado al borde derecho: el panel se abre a su izquierda; si no cabe, debajo del control
  const fitsLeft = rect.left - GAP - WIDTH >= MARGIN;
  const left = fitsLeft ? rect.left - GAP - WIDTH : Math.max(MARGIN, Math.min(rect.left, window.innerWidth - WIDTH - MARGIN));
  const top = fitsLeft ? rect.top : rect.bottom + GAP;
  const clamped = Math.max(MARGIN, Math.min(top, window.innerHeight - 220));
  return { left, top: clamped, width: WIDTH, maxHeight: window.innerHeight - clamped - MARGIN };
}

function PopoverPanel({ anchor, title, onClose, children }: PopoverProps & { anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>(() => place(anchor));

  // Al abrir: el foco va al campo marcado con `data-autofocus` (el buscador) o, si no hay, al propio panel
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return undefined;
    (panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel).focus({ preventScroll: true });
    return () => {
      // Al cerrar: si el foco estaba dentro del panel, vuelve al control que lo abrió
      const active = document.activeElement;
      if (!active || active === document.body || panel.contains(active)) anchor.focus({ preventScroll: true });
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Antes que los atajos del editor (Esc quita la selección): este Esc solo cierra el panel
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    const onDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node | null;
      if (target && !ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onResize = () => setStyle(place(anchor));
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={ref} className="ed-popover" role="dialog" aria-label={title} tabIndex={-1} style={style}>
      <div className="ed-popover-head">
        <strong>{title}</strong>
        <button type="button" className="ed-popover-close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ed-popover-body">{children}</div>
    </div>,
    document.body,
  );
}
