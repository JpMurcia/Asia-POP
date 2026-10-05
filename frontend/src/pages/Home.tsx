import { Link } from 'react-router-dom';
import type { PanelSummary } from '../../../backend/src/catalog/types';
import { Alert, Badge, Button, Card, PageHeader } from '../components/ui';
import { timeAgo, useNow } from '../hooks/useNow';

interface Props {
  summary: PanelSummary | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

const NA = '—';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Pantalla Inicio: indicadores, secciones y último catálogo (mockup 1b). */
export default function Home({ summary, loading, error, refresh }: Props) {
  const stats = summary?.stats ?? null;
  const status = summary?.alegra.status;
  const pending = stats?.uncategorized ?? 0;
  const omitted = stats?.omitted ?? 0;
  const noteNA = status === 'unreachable' || error ? 'No disponible sin Alegra' : undefined;
  // La lectura de Alegra envejece: "Sincronizado hace N min" (se actualiza solo)
  const now = useNow();
  const ago = summary?.alegra.syncedAt ? timeAgo(summary.alegra.syncedAt, now) : null;

  const cards: { label: string; value: string; note: string; tone?: string }[] = [
    {
      label: 'Productos activos en Alegra',
      value: stats ? String(stats.products) : NA,
      // El valor es el total de Alegra y no baja al omitir; la nota dice cuántos se dejan fuera del catálogo
      note:
        noteNA ??
        [
          omitted > 0 ? `${omitted === 1 ? '1 omitido' : `${omitted} omitidos`} del catálogo` : null,
          ago ? `Sincronizado ${ago}` : 'Leídos de Alegra',
        ]
          .filter(Boolean)
          .join(' · '),
    },
    {
      label: 'Agotados',
      value: stats ? String(stats.soldOut) : NA,
      note: noteNA ?? 'Salen con badge AGOTADO',
      tone: 'text-pop-err-text',
    },
    {
      label: 'Sin categoría',
      value: stats ? String(stats.uncategorized) : NA,
      note: noteNA ?? 'Quedan fuera del PDF',
      tone: pending > 0 ? 'text-pop-warn-text' : undefined,
    },
    {
      label: 'Páginas estimadas',
      value: stats ? String(stats.estimatedPages) : NA,
      note: noteNA ?? 'Con todas las secciones',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inicio"
        subtitle="Resumen del catálogo de ASIANPOP MARKET+"
        actions={
          <Link to="/generar" className="no-underline">
            <span className="inline-flex items-center justify-center h-11 px-5 rounded-pop font-bold bg-pop-accent text-white shadow-pop-button">
              Generar catálogo
            </span>
          </Link>
        }
      />

      {status === 'not_configured' && (
        <Alert tone="warning" title="Alegra aún no está conectado">
          <Link to="/alegra" className="font-bold">
            Configura la conexión con Alegra
          </Link>{' '}
          para ver tus productos y generar el catálogo.
        </Alert>
      )}

      {(status === 'unreachable' || (error && !summary)) && (
        <Alert tone="error" title="No se pudo consultar Alegra">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span>{summary?.alegra.message ?? 'No se pudo cargar el resumen. Revisa tu conexión.'}</span>
            <Button variant="secondary" className="h-9" onClick={() => void refresh()}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {pending > 0 && (
        <Alert tone="warning">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <strong>{pending} productos de Alegra sin categoría</strong>
              <span className="text-[13px]">Quedan fuera del PDF hasta que les asignes una sección.</span>
            </div>
            <Link
              to="/sin-categoria"
              className="inline-flex items-center h-[38px] px-4 rounded-pop border border-current font-bold no-underline text-inherit"
            >
              Asignar secciones
            </Link>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {cards.map((c) => (
          <Card key={c.label} className="flex flex-col gap-1.5 !shadow-none">
            <span className="text-pop-muted text-[13px]">{c.label}</span>
            <span className={`font-display text-[32px] font-semibold ${c.tone ?? ''}`} aria-label={`${c.label}: ${c.value}`}>
              {loading && !summary ? '…' : c.value}
            </span>
            <span className="text-pop-muted text-xs">{c.note}</span>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 [grid-template-columns:minmax(0,1.4fr)_minmax(0,1fr)] max-[1100px]:grid-cols-1">
        <Card className="flex flex-col gap-3.5 !shadow-none" aria-labelledby="home-sections">
          <h2 id="home-sections" className="text-[17px] font-semibold">
            Secciones del catálogo
          </h2>
          {summary?.sections && summary.sections.length > 0 ? (
            <ul className="flex flex-col list-none m-0 p-0">
              {summary.sections.map((s) => (
                <li
                  key={s.key}
                  className="grid items-center gap-2 py-2.5 border-t border-pop-line [grid-template-columns:1fr_90px_100px_80px]"
                >
                  <span className="font-bold tracking-wide">{s.name}</span>
                  <span className="text-pop-muted text-[13px]">{s.items} prod.</span>
                  <span className={`text-[13px] ${s.soldOut > 0 ? 'text-pop-err-text' : 'text-pop-muted'}`}>
                    {s.soldOut > 0 ? `${s.soldOut} agotados` : NA}
                  </span>
                  <Badge tone={s.source === 'alegra' ? 'alegra' : 'custom'} className="justify-self-end">
                    {s.source === 'alegra' ? 'Alegra' : 'Propia'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-pop-muted text-sm">
              {summary?.sections
                ? 'Todavía no hay secciones con productos elegibles.'
                : 'Las secciones aparecen cuando Alegra está disponible.'}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3.5 !shadow-none" aria-labelledby="home-last">
          <h2 id="home-last" className="text-[17px] font-semibold">
            Último catálogo
          </h2>
          {summary?.lastCatalog ? (
            <div className="flex gap-4 items-center">
              <div
                aria-hidden="true"
                className="w-[84px] aspect-[210/297] shrink-0 rounded bg-[#11052c] grid place-items-center shadow-[0_0_0_1px_rgba(255,46,138,.6),0_0_18px_rgba(255,46,138,.35)]"
              >
                <span className="font-display text-[10px] text-white text-center leading-tight px-1">ASIANPOP</span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-bold">{formatDate(summary.lastCatalog.createdAt)}</span>
                <span className="text-pop-muted text-[13px]">
                  {summary.lastCatalog.pages != null ? `${summary.lastCatalog.pages} páginas · ` : ''}
                  {summary.lastCatalog.includedCount} productos
                  {summary.lastCatalog.omittedCount > 0 ? ` · ${summary.lastCatalog.omittedCount} omitidos` : ''}
                </span>
                <a
                  href={`/api/catalog/history/${summary.lastCatalog.id}/pdf`}
                  className="inline-flex items-center justify-center h-10 px-4 mt-1 rounded-pop font-bold bg-pop-accent text-white shadow-pop-button no-underline self-start"
                >
                  Descargar PDF
                </a>
              </div>
            </div>
          ) : (
            <p className="text-pop-muted text-sm">
              Aún no has generado un catálogo.{' '}
              <Link to="/generar" className="font-bold">
                Genera el primero
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
