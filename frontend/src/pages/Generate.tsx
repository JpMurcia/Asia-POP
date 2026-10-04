import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PHOTO_REASON_LABEL } from '../../../backend/src/catalog/photo-reasons';
import type { TemplateSummary } from '../../../backend/src/catalog/template';
import type {
  AvailableSection,
  BundleDecision,
  CatalogStructure,
  GenerationOptions,
  ReviewReport,
} from '../../../backend/src/catalog/types';
import StructurePreview from '../components/StructurePreview';
import { Alert, Button, Card, Field, PageHeader } from '../components/ui';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';

interface Job {
  status: 'idle' | 'preparing' | 'rendering' | 'done' | 'failed';
  step?: string;
  progress?: number;
  error?: string;
  catalogId?: string;
}

interface Prepared {
  prepareId: string;
  report: ReviewReport;
  structure?: CatalogStructure;
  availableSections?: AvailableSection[];
  options?: GenerationOptions;
}

/** Lo que responde `generate` sobre la plantilla usada. */
interface UsedTemplate {
  id: string;
  name: string;
  /** `true` si la plantilla elegida ya no existe y se usó la predeterminada. */
  fallback: boolean;
}

/** Retardo antes de recalcular informe y estructura tras un cambio de opciones. */
const SYNC_DELAY_MS = 300;

export default function Generate() {
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [banner, setBanner] = useState('');
  /** `null` = todas las secciones disponibles. */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  /** Plantillas disponibles; vacío si no se pudieron cargar (entonces se usa la predeterminada del servidor). */
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  /** Plantilla de ESTA generación: parte de la predeterminada y no la cambia. `null` = sin elegir. */
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState('');
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [decisions, setDecisions] = useState<Record<string, BundleDecision>>({});
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const lastSent = useRef('');

  // El campo de banner parte del texto guardado en Apariencia; cambiarlo aquí solo afecta esta generación.
  useEffect(() => {
    api
      .get<{ coverTitle: string }>('/api/settings/business')
      .then((b) => setBanner((cur) => cur || b.coverTitle))
      .catch(() => undefined);
  }, []);

  // El selector parte siempre de la plantilla predeterminada; elegir otra solo afecta a esta generación
  useEffect(() => {
    api
      .get<{ defaultId: string; items: TemplateSummary[] }>('/api/settings/templates/summary')
      .then((res) => {
        setTemplates(res.items);
        setTemplateId((cur) => cur ?? res.defaultId);
      })
      .catch(() => undefined);
  }, []);

  const poll = useCallback(async () => {
    try {
      const j = await api.get<Job>('/api/catalog/jobs/current');
      setJob(j);
      return j;
    } catch {
      return undefined;
    }
  }, []);

  const startPolling = useCallback(() => {
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const j = await poll();
      if (j && j.status !== 'preparing' && j.status !== 'rendering') {
        clearInterval(timer.current);
        if (j.status === 'done') notifySummaryChanged(); // Inicio muestra el catálogo recién generado
      }
    }, 1000);
  }, [poll]);

  useEffect(() => {
    void poll().then((j) => {
      if (j && (j.status === 'preparing' || j.status === 'rendering')) startPolling();
    });
    return () => clearInterval(timer.current);
  }, [poll, startPolling]);

  const optionsBody = useMemo(
    () => ({
      sectionKeys: selected ? [...selected].sort() : undefined,
      hideSoldOut,
      bannerText: banner.trim() || undefined,
      bundleDecisions: decisions,
      templateId: templateId ?? undefined,
    }),
    [selected, hideSoldOut, banner, decisions, templateId],
  );

  // Cambiar opciones recalcula informe y estructura en el servidor, sin volver a consultar Alegra
  const prepareId = prepared?.prepareId;
  useEffect(() => {
    if (!prepareId) return undefined;
    const signature = JSON.stringify(optionsBody);
    if (signature === lastSent.current) return undefined;
    const t = setTimeout(async () => {
      setSyncing(true);
      try {
        const res = await api.put<Prepared>(`/api/catalog/prepare/${prepareId}/options`, optionsBody);
        lastSent.current = signature;
        setPrepared((p) => (p && p.prepareId === prepareId ? { ...p, ...res } : p));
        setError('');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'No se pudieron aplicar las opciones.');
      } finally {
        setSyncing(false);
      }
    }, SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, [prepareId, optionsBody]);

  async function prepare() {
    setError('');
    setFallbackNotice('');
    setPrepared(null);
    setDecisions({});
    setSelected(null);
    setBusy(true);
    startPolling();
    try {
      const res = await api.post<Prepared>('/api/catalog/prepare', {
        hideSoldOut,
        bannerText: banner.trim() || undefined,
        templateId: templateId ?? undefined,
      });
      lastSent.current = JSON.stringify({
        sectionKeys: undefined,
        hideSoldOut,
        bannerText: banner.trim() || undefined,
        bundleDecisions: {},
        templateId: templateId ?? undefined,
      });
      setPrepared(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo preparar el catálogo.');
    } finally {
      setBusy(false);
      await poll();
    }
  }

  async function generate() {
    if (!prepared) return;
    setError('');
    setFallbackNotice('');
    try {
      const res = await api.post<{ jobId: string; template?: UsedTemplate }>('/api/catalog/generate', {
        prepareId: prepared.prepareId,
        bundleDecisions: decisions,
      });
      // La plantilla elegida se pudo eliminar (p. ej. desde otra pestaña): se usó la predeterminada
      if (res.template?.fallback) {
        setFallbackNotice(`La plantilla elegida ya no existe; se usó «${res.template.name}», la predeterminada.`);
      }
      setJob({ status: 'rendering', step: 'Generando PDF', progress: 0 });
      startPolling();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo generar el catálogo.');
    }
  }

  const available = prepared?.availableSections ?? [];
  const isChecked = (key: string) => !selected || selected.has(key);
  const allChecked = !selected || available.every((s) => selected.has(s.key));
  /** `null` = todas (sin filtro); un conjunto vacío = ninguna. */
  const toggleAll = () => setSelected(allChecked ? new Set() : null);
  function toggleSection(key: string) {
    const base = selected ?? new Set(available.map((s) => s.key));
    const next = new Set(base);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(available.every((s) => next.has(s.key)) ? null : next);
  }

  const report = prepared?.report;
  const structure = prepared?.structure;
  const pendingBundles = report?.soldOutBundles.filter((b) => !decisions[b.bundleId]) ?? [];
  // Omitidos por no tener foto, sin los que Alegra sí informa pero no se pudieron obtener (esos van en su propio aviso)
  const failedPhotoIds = new Set(report?.photos.notObtained.map((p) => p.id));
  const noPhoto = (report?.omittedNoImage ?? []).filter((o) => !(o.source === 'alegra' && failedPhotoIds.has(o.id)));
  const working = job.status === 'preparing' || job.status === 'rendering';
  const nothing = !!report?.emptyCatalog || !!structure?.nothingToGenerate;
  const canGenerate = !!report && !nothing && pendingBundles.length === 0 && !working && !syncing;

  return (
    <section className="flex flex-col gap-5 max-w-3xl">
      <PageHeader
        title="Generar catálogo"
        subtitle="Prepara el catálogo, revisa las alertas, elige qué incluir y genera el PDF."
      />

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Opciones</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideSoldOut} onChange={(e) => setHideSoldOut(e.target.checked)} />
          Ocultar los productos agotados (si no, se muestran con el badge AGOTADO)
        </label>
        <Field
          label="Texto del banner de portada"
          maxLength={80}
          value={banner}
          onChange={(e) => setBanner(e.target.value)}
          hint="Solo cambia esta generación; el texto guardado se edita en Apariencia."
        />

        {templates.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold mb-1">Plantilla del catálogo</legend>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
              {templates.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-pop border cursor-pointer ${
                    templateId === t.id ? 'border-pop-accent bg-pop-stripe' : 'border-pop-line bg-pop-surface2'
                  }`}
                >
                  <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} />
                  <span className="flex-1 min-w-0">
                    <span className="font-bold block truncate">{t.name}</span>
                    {t.isDefault && (
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-pop-warn-bg text-pop-warn-text">
                        Predeterminada
                      </span>
                    )}
                  </span>
                  <span className="flex gap-0.5" aria-hidden="true">
                    {(['bg', 'a1', 'a2', 'a3', 'paper'] as const).map((k) => (
                      <span
                        key={k}
                        data-testid="palette-dot"
                        className="w-3.5 h-3.5 rounded-full shadow-[inset_0_0_0_1px_rgba(42,18,88,.15)]"
                        style={{ background: t.palette[k] }}
                      />
                    ))}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-pop-muted">
              Solo cambia esta generación; la predeterminada se elige en Apariencia.
            </p>
          </fieldset>
        )}

        {prepared && available.length > 0 && (
          <fieldset className="relative flex flex-col gap-2">
            <legend className="text-[13px] font-semibold mb-1">Secciones a incluir</legend>
            <button
              type="button"
              onClick={toggleAll}
              className="absolute right-0 top-0 text-[13px] font-semibold text-pop-accent bg-transparent border-0 cursor-pointer p-0"
            >
              {allChecked ? 'Quitar todas' : 'Seleccionar todas'}
            </button>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
              {available.map((s) => (
                <label
                  key={s.key}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-pop border border-pop-line bg-pop-surface2"
                >
                  <input type="checkbox" checked={isChecked(s.key)} onChange={() => toggleSection(s.key)} />
                  <span className="flex-1 font-bold">{s.name}</span>
                  <span className="text-xs text-pop-muted">{s.items} prod.</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Button onClick={prepare} disabled={busy || working} className="self-start">
          1. Preparar y revisar
        </Button>
      </Card>

      {working && (
        <Card role="status" aria-live="polite">
          <p className="text-sm font-semibold">{job.step ?? 'Trabajando…'}</p>
          <div className="h-2 bg-pop-surface2 rounded mt-2 overflow-hidden">
            <div className="h-full bg-pop-accent transition-all" style={{ width: `${job.progress ?? 0}%` }} />
          </div>
        </Card>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      {fallbackNotice && <Alert tone="warning">{fallbackNotice}</Alert>}

      {structure && <StructurePreview structure={structure} />}

      {report && (
        <Card className="flex flex-col gap-4" data-testid="review-report">
          <h2 className="text-lg font-semibold">Revisión</h2>
          <p className="text-sm">
            <b>{report.counts.included}</b> productos incluidos · <b>{report.counts.omitted}</b> omitidos ·{' '}
            <b>{report.counts.soldOut}</b> con badge AGOTADO
          </p>

          {report.emptyCatalog && <Alert tone="warning">No hay productos para generar el catálogo.</Alert>}

          {report.omittedNoSection.length > 0 && (
            <Alert tone="warning" title={`${report.omittedNoSection.length} producto(s) sin categoría ni sección asignada`}>
              <ul className="list-disc ml-5">
                {report.omittedNoSection.slice(0, 20).map((u) => (
                  <li key={u.itemId}>{u.name}</li>
                ))}
              </ul>
              <Link to="/sin-categoria" className="font-bold">
                Asignarles una sección
              </Link>
              . Hasta entonces quedan fuera del PDF.
            </Alert>
          )}

          {report.photos.allFailed && (
            <Alert tone="error" title="No se pudo obtener ninguna foto de Alegra">
              Alegra informó fotos para {report.photos.informed} producto(s) y no se pudo descargar ninguna. Es probable
              que sea un problema general (la conexión o los enlaces de las fotos) y no de cada producto. Vuelve a
              preparar el catálogo y, si sigue igual, revisa la{' '}
              <Link to="/alegra" className="font-bold">
                conexión con Alegra
              </Link>
              .
            </Alert>
          )}

          {!report.photos.allFailed && report.photos.notObtained.length > 0 && (
            <Alert
              tone="warning"
              title={`${report.photos.notObtained.length} producto(s) con foto en Alegra que no se pudo obtener`}
            >
              <ul className="list-disc ml-5">
                {report.photos.notObtained.slice(0, 30).map((p) => (
                  <li key={p.id}>{`${p.name} — ${PHOTO_REASON_LABEL[p.reason]}`}</li>
                ))}
              </ul>
            </Alert>
          )}

          {noPhoto.length > 0 && (
            <Alert tone="warning" title={`${noPhoto.length} producto(s) omitidos por no tener imagen`}>
              <ul className="list-disc ml-5">
                {noPhoto.slice(0, 30).map((o) => (
                  <li key={`${o.source}-${o.id}`}>{o.name}</li>
                ))}
              </ul>
            </Alert>
          )}

          {report.soldOutBundles.length > 0 && (
            <Alert tone="error" title="Combos con productos agotados">
              <p className="mb-2">Elige qué hacer con cada combo:</p>
              {report.soldOutBundles.map((b) => (
                <fieldset key={b.bundleId} className="border border-pop-err-text/30 rounded-pop p-3 mb-2 bg-pop-surface text-pop-ink">
                  <legend className="text-sm font-bold px-1">{b.name}</legend>
                  <p className="text-xs text-pop-muted mb-2">Agotado: {b.soldOutComponents.join(', ')}</p>
                  {(['keep', 'omit'] as const).map((d) => (
                    <label key={d} className="mr-4 text-sm">
                      <input
                        type="radio"
                        name={`bundle-${b.bundleId}`}
                        checked={decisions[b.bundleId] === d}
                        onChange={() => setDecisions({ ...decisions, [b.bundleId]: d })}
                      />{' '}
                      {d === 'keep' ? 'Mantener con badge AGOTADO' : 'Omitir del catálogo'}
                    </label>
                  ))}
                </fieldset>
              ))}
            </Alert>
          )}

          <div className="flex gap-4 items-center flex-wrap">
            <Button onClick={generate} disabled={!canGenerate}>
              2. Generar PDF
            </Button>
            <Link to={`/vista-previa/${prepared!.prepareId}`} target="_blank" className="text-sm font-bold">
              Ver vista previa
            </Link>
            {syncing && <span className="text-xs text-pop-muted">Actualizando…</span>}
          </div>
        </Card>
      )}

      {job.status === 'done' && job.catalogId && (
        <Alert tone="success">
          Catálogo generado.{' '}
          <a className="font-bold" href={`/api/catalog/history/${job.catalogId}/pdf`}>
            Descargar PDF
          </a>
        </Alert>
      )}
      {job.status === 'failed' && <Alert tone="error">No se pudo generar el PDF: {job.error}</Alert>}
    </section>
  );
}
