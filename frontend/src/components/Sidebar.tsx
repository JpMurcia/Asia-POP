import { NavLink } from 'react-router-dom';
import type { PanelSummary } from '../../../backend/src/catalog/types';
import logo from '../assets/logo.jpg';
import { confirmLeave } from '../hooks/useUnsavedGuard';
import { Badge, StatusDot, type StatusTone } from './ui';

interface NavItem {
  to: string;
  label: string;
  /** Muestra el contador de ítems sin categoría. */
  counter?: boolean;
}

/**
 * Nombres y orden del mockup 1b (Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos,
 * Generar catálogo, Historial) más la entrada nueva Apariencia, que no tiene pantalla propia en el mockup.
 */
export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio' },
  { to: '/alegra', label: 'Conexión Alegra' },
  { to: '/sin-categoria', label: 'Sin categoría', counter: true },
  { to: '/contenido', label: 'Contenido propio' },
  { to: '/combos', label: 'Combos' },
  { to: '/generar', label: 'Generar catálogo' },
  { to: '/historial', label: 'Historial' },
  { to: '/apariencia', label: 'Apariencia' },
];

function connection(summary: PanelSummary | null): { tone: StatusTone; label: string; detail?: string } {
  if (!summary) return { tone: 'idle', label: 'Comprobando conexión…' };
  switch (summary.alegra.status) {
    case 'ok':
      return { tone: 'ok', label: 'Alegra conectado', detail: summary.alegra.email };
    case 'unreachable':
      return { tone: 'error', label: 'Sin conexión con Alegra', detail: summary.alegra.message };
    case 'not_configured':
      return { tone: 'warn', label: 'Alegra sin configurar' };
  }
}

interface Props {
  summary: PanelSummary | null;
  onLogout: () => void;
}

export default function Sidebar({ summary, onLogout }: Props) {
  const conn = connection(summary);
  const pending = summary?.stats?.uncategorized ?? 0;

  return (
    <aside className="w-60 shrink-0 flex flex-col gap-6 px-3.5 py-5 bg-pop-side text-pop-side-text sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-1.5">
        <img src={logo} alt="" className="w-10 h-10 rounded-full object-cover" />
        <div className="flex flex-col leading-tight">
          <span className="font-display font-semibold text-[15px]">AsianPop</span>
          <span className="text-xs text-pop-side-muted">Catálogo PDF</span>
        </div>
      </div>

      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            onClick={(e) => {
              if (!confirmLeave()) e.preventDefault();
            }}
            className={({ isActive }) =>
              `flex items-center justify-between gap-2 px-3 py-2.5 rounded-pop no-underline ${
                isActive
                  ? 'bg-pop-amber text-pop-ink font-bold'
                  : 'text-pop-side-text font-medium hover:bg-pop-side-card'
              }`
            }
          >
            <span>{n.label}</span>
            {n.counter && pending > 0 && (
              <Badge tone="amber" aria-label={`${pending} pendientes`}>
                {pending}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2.5 p-3 rounded-pop bg-pop-side-card">
        <div className="flex items-start gap-2 text-[13px]" role="status" title={conn.detail}>
          <span className="mt-1.5">
            <StatusDot tone={conn.tone} />
          </span>
          <span className="flex flex-col min-w-0">
            <span>{conn.label}</span>
            {conn.detail && <span className="text-xs text-pop-side-muted truncate">{conn.detail}</span>}
          </span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="bg-transparent border-0 text-pop-side-muted text-[13px] text-left p-0 cursor-pointer hover:text-pop-side-text"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
