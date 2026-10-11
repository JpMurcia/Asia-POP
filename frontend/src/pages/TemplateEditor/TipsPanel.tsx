import { useEffect, useRef } from 'react';
import { EDITOR_TIPS } from './editor-tips';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Panel de consejos de Apariencia (feature 007): un diálogo con el foco contenido que se cierra con «Cerrar», con Esc o
 * pulsando fuera. No usa el reductor del editor: abrirlo y cerrarlo no deja pasos en el historial, ni «cambios sin
 * guardar», ni cambia la selección. Quien lo abre devuelve el foco a su botón en `onClose`.
 */
export default function TipsPanel({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  // Esc cierra desde cualquier parte; el evento no llega a los atajos del editor
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Tab y Mayús+Tab circulan dentro del panel. */
  function trapFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (!dialog.current?.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="ed-tips-backdrop"
      data-testid="tips-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="ed-tips"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-tips-title"
        onKeyDown={trapFocus}
      >
        <div className="ed-tips-head">
          <h2 id="ed-tips-title">Consejos para Apariencia</h2>
          <button ref={closeButton} type="button" className="ed-tips-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <ol className="ed-tips-list" tabIndex={0} aria-label="Lista de consejos">
          {EDITOR_TIPS.map((tip) => (
            <li key={tip.title}>
              <strong>{tip.title}</strong> {tip.body}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
