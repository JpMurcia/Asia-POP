import { useEffect } from 'react';

/**
 * Aviso de cambios sin guardar. `BrowserRouter` no admite `useBlocker`, así que se cubre:
 *  - cerrar o recargar la pestaña (`beforeunload`);
 *  - navegar desde la barra lateral (`confirmLeave`, que consulta la barra antes de cambiar de pantalla).
 * El botón "Atrás" del navegador no se intercepta en esta versión.
 */
let dirty = false;

export const LEAVE_MESSAGE = 'Tienes cambios sin guardar. ¿Salir de todos modos?';

export function isDirty(): boolean {
  return dirty;
}

/** `true` si se puede salir: no hay cambios pendientes o el usuario confirma descartarlos. */
export function confirmLeave(): boolean {
  if (!dirty) return true;
  const leave = window.confirm(LEAVE_MESSAGE);
  if (leave) dirty = false;
  return leave;
}

export function useUnsavedGuard(isDirtyNow: boolean): void {
  useEffect(() => {
    dirty = isDirtyNow;
    return () => {
      dirty = false;
    };
  }, [isDirtyNow]);

  useEffect(() => {
    if (!isDirtyNow) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirtyNow]);
}
