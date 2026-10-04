import type { ReactNode } from 'react';

/** Layout del panel: barra lateral fija a la izquierda y contenido a la derecha (nunca ensancha la página). */
export default function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-pop-bg text-pop-ink">
      {sidebar}
      <main className="flex-1 min-w-0 px-10 pt-8 pb-20 flex flex-col gap-6 max-[1100px]:px-6">{children}</main>
    </div>
  );
}
