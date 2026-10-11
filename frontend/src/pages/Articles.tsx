import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCop } from '../../../backend/src/catalog/price-format';
import AlegraDataBar from '../components/AlegraDataBar';
import { Alert, Badge, Button, Card, Field, LIST_AREA_MIN_HEIGHT, LoadingScreen, PageHeader } from '../components/ui';
import { useLoadingScreen } from '../hooks/useAlegraData';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';

interface Article {
  itemId: string;
  name: string;
  sectionKey: string | null;
  sectionName: string | null;
  price: number;
  soldOut: boolean;
  omitted: boolean;
  /** Nombres de los combos que usan este artículo como componente. */
  bundles?: string[];
}

/** Valores del filtro de categoría que no son una categoría. */
const ALL_CATEGORIES = '';
const NO_CATEGORY = '__none__';

type View = 'all' | 'omitted';
/** Destino del foco cuando una fila sale de la vista y no queda otra a la que enviarlo. */
const VIEWS_TARGET = '__views__';

/** Minúsculas y sin tildes: «jamon» encuentra «Jamón». */
const normalize = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const SAVE_ERROR = 'No se pudo guardar el cambio. Inténtalo de nuevo.';

/** «Está en el combo «A». El combo no cambia.» / «Está en los combos «A» y «B». Los combos no cambian.» */
function bundlesNote(names: string[]): string {
  const quoted = names.map((n) => `«${n}»`);
  if (quoted.length === 1) return `Está en el combo ${quoted[0]}. El combo no cambia.`;
  const last = quoted[quoted.length - 1];
  return `Está en los combos ${quoted.slice(0, -1).join(', ')} y ${last}. Los combos no cambian.`;
}

/**
 * Artículos de Alegra (feature 006): la persona marca los que no quiere en el catálogo. La marca es permanente y solo
 * se guarda aquí; no cambia nada en Alegra. Contrato: specs/006-omit-alegra-articles/contracts/articles-ui.md §2.
 *
 * Feature 007: la lista sale de los datos de Alegra guardados en el equipo (con la barra «Actualizar desde Alegra»),
 * muestra una pantalla de carga si tarda y se filtra por categoría con etiquetas que traen su cantidad. Contrato:
 * specs/007-product-layout-alegra-cache/contracts/ui.md §3 y §4.
 */
export default function Articles() {
  const [items, setItems] = useState<Article[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [view, setView] = useState<View>('all');
  /** Fila (o `VIEWS_TARGET`) que debe recibir el foco tras el próximo cambio de la lista. */
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const omittedViewRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError('');
    setItems(null);
    try {
      const res = await api.get<{ items: Article[] }>('/api/catalog/articles');
      setItems(res.items);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'No se pudo consultar Alegra.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Categorías que tienen artículos, por nombre; «Sin categoría» aparte solo si hay artículos sin categoría. */
  const categories = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const a of items ?? []) if (a.sectionKey) byKey.set(a.sectionKey, a.sectionName ?? a.sectionKey);
    return [...byKey].sort((x, y) => x[1].localeCompare(y[1], 'es', { sensitivity: 'base' }));
  }, [items]);
  const hasUnsectioned = items?.some((a) => !a.sectionKey) ?? false;

  const q = normalize(query.trim());
  const matchesQuery = (a: Article) => !q || normalize(a.name).includes(q);
  const inCategory = (a: Article, key: string) =>
    key === ALL_CATEGORIES || (key === NO_CATEGORY ? !a.sectionKey : a.sectionKey === key);

  /** Lo que coincide con la búsqueda y la categoría: de aquí salen los conteos de las dos vistas (FR-003). */
  const matching = useMemo(
    () => (items ?? []).filter((a) => matchesQuery(a) && inCategory(a, category)),
    [items, q, category],
  );
  const matchingOmitted = matching.filter((a) => a.omitted).length;
  const visible = view === 'omitted' ? matching.filter((a) => a.omitted) : matching;

  /** Cuántos artículos tendría cada etiqueta de categoría: respeta la búsqueda y la vista activas (FR-024). */
  const chipCount = (key: string): number =>
    (items ?? []).filter((a) => matchesQuery(a) && (view === 'all' || a.omitted) && inCategory(a, key)).length;

  const totalOmitted = items?.filter((a) => a.omitted).length ?? 0;
  const noFilters = !query.trim() && category === ALL_CATEGORIES;
  const clearFilters = () => {
    setQuery('');
    setCategory(ALL_CATEGORIES);
  };

  /** Etiquetas: «Todas», cada categoría y, al final, «Sin categoría». */
  const chipList: { key: string; label: string }[] = [
    { key: ALL_CATEGORIES, label: 'Todas' },
    ...categories.map(([key, name]) => ({ key, label: name })),
    ...(hasUnsectioned ? [{ key: NO_CATEGORY, label: 'Sin categoría' }] : []),
  ];

  const pendingList = !items && !loadError;
  const { show: showLoading, status: loadingStatus } = useLoadingScreen(pendingList);

  // Tras sacar una fila de la vista «Omitidos», el foco pasa a la fila siguiente o a las vistas
  useEffect(() => {
    if (!focusTarget) return;
    (focusTarget === VIEWS_TARGET ? omittedViewRef.current : buttonRefs.current.get(focusTarget))?.focus();
    setFocusTarget(null);
  }, [focusTarget, items]);

  /** Cambia la fila al instante y guarda; si falla, la devuelve a como estaba (FR-002: sin botón de guardar). */
  async function toggle(article: Article) {
    const next = !article.omitted;
    const setOmitted = (omitted: boolean) =>
      setItems((prev) => prev?.map((i) => (i.itemId === article.itemId ? { ...i, omitted } : i)) ?? prev);
    setSaveError('');
    // En la vista «Omitidos», volver a incluir saca la fila de la lista: el foco pasa a la siguiente (o a las vistas)
    if (view === 'omitted' && article.omitted) {
      const at = visible.findIndex((v) => v.itemId === article.itemId);
      setFocusTarget(visible[at + 1]?.itemId ?? VIEWS_TARGET);
    }
    setOmitted(next);
    try {
      const url = `/api/catalog/omitted/${encodeURIComponent(article.itemId)}`;
      if (next) await api.put(url);
      else await api.del(url);
      notifySummaryChanged(); // Inicio y la barra lateral reflejan la nueva lista
    } catch {
      setOmitted(article.omitted);
      setSaveError(SAVE_ERROR);
    }
  }

  return (
    <section className="flex flex-col gap-5 max-w-3xl">
      <PageHeader title="Artículos de Alegra" subtitle="Elige los artículos de Alegra que no quieres en el catálogo." />
      <p className="text-sm text-pop-muted">
        Omitir un artículo solo se guarda aquí: no cambia nada en Alegra. Los artículos omitidos quedan fuera de todos
        los catálogos hasta que los vuelvas a incluir.
      </p>
      <AlegraDataBar onRefreshed={() => void load()} />

      {loadError ? (
        <Alert tone="error">
          <p className="font-bold">{loadError}</p>
          <div className="flex items-center gap-4 flex-wrap mt-2">
            <Link to="/alegra" className="font-bold">
              Revisa la conexión con Alegra
            </Link>
            <Button variant="secondary" className="h-9" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        </Alert>
      ) : !items ? (
        showLoading ? (
          <LoadingScreen status={loadingStatus} />
        ) : (
          // Mismo espacio que la pantalla de carga y que la lista: al llegar los datos nada cambia de lugar
          <div style={{ minHeight: LIST_AREA_MIN_HEIGHT }}>
            <p>Cargando…</p>
          </div>
        )
      ) : items.length === 0 ? (
        <p className="text-sm text-pop-muted">Alegra no tiene artículos activos.</p>
      ) : (
        <div className="flex flex-col gap-4" style={{ minHeight: LIST_AREA_MIN_HEIGHT }}>
          {saveError && <Alert tone="error">{saveError}</Alert>}

          <p className="text-sm font-semibold" aria-live="polite">
            {`${items.length === 1 ? '1 artículo' : `${items.length} artículos`} · ${totalOmitted === 1 ? '1 omitido' : `${totalOmitted} omitidos`}`}
          </p>

          <Card className="flex flex-col gap-4 !shadow-none">
            <Field
              label="Buscar por nombre"
              type="search"
              placeholder="Escribe parte del nombre"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <fieldset className="flex flex-col gap-2 min-w-0 m-0 p-0 border-0">
              <legend className="font-semibold text-[13px] mb-2">Categoría</legend>
              <div data-testid="category-chips" className="flex flex-wrap gap-2">
                {chipList.map(({ key, label }) => {
                  const count = chipCount(key);
                  const selected = category === key;
                  return (
                    <button
                      key={key || '__all__'}
                      type="button"
                      aria-pressed={selected}
                      data-empty={count === 0 ? 'true' : undefined}
                      onClick={() => setCategory(key)}
                      className={`max-w-full min-h-9 px-3 py-1.5 rounded-full border text-sm font-semibold text-left break-words transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pop-accent ${
                        selected
                          ? 'border-pop-accent bg-pop-accent text-white'
                          : `border-pop-line bg-pop-surface2 text-pop-ink hover:border-pop-accent ${count === 0 ? 'opacity-50' : ''}`
                      }`}
                    >
                      {`${label} (${count})`}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <fieldset className="flex gap-2 flex-wrap min-w-0 m-0 p-0 border-0">
                <legend className="sr-only">Vista</legend>
                {(
                  [
                    ['all', `Todos (${matching.length})`],
                    ['omitted', `Omitidos (${matchingOmitted})`],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-pop border cursor-pointer ${
                      view === value ? 'border-pop-accent bg-pop-stripe' : 'border-pop-line bg-pop-surface2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="articles-view"
                      ref={value === 'omitted' ? omittedViewRef : undefined}
                      checked={view === value}
                      onChange={() => setView(value)}
                    />
                    <span className="font-bold">{label}</span>
                  </label>
                ))}
              </fieldset>
              {!noFilters && (
                <Button variant="secondary" className="h-9" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </Card>

          <p className="text-[13px] text-pop-muted" aria-live="polite">
            {`Mostrando ${visible.length} de ${items.length} ${items.length === 1 ? 'artículo' : 'artículos'}`}
          </p>

          {visible.length === 0 ? (
            <p className="text-sm text-pop-muted">
              {view === 'omitted' && noFilters
                ? 'No has omitido ningún artículo.'
                : 'Ningún artículo coincide con los filtros.'}
            </p>
          ) : (
            <Card className="!p-0">
              <ul className="list-none m-0 p-0">
                {visible.map((a, idx) => (
                  <li key={a.itemId} className={`p-3 flex flex-col gap-1 ${idx % 2 ? 'bg-pop-surface2' : ''}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-40">
                        <p className={`text-sm font-semibold ${a.omitted ? 'text-pop-muted' : ''}`}>{a.name}</p>
                        <p className="text-xs text-pop-muted">
                          {a.sectionName ?? 'Sin categoría'} · {formatCop(a.price)}
                        </p>
                      </div>
                      {a.soldOut && (
                        <Badge tone="neutral" className="!text-pop-err-text">
                          Agotado
                        </Badge>
                      )}
                      {a.omitted && <Badge tone="neutral">Omitido</Badge>}
                      <Button
                        variant="secondary"
                        className="h-10"
                        ref={(el: HTMLButtonElement | null) => {
                          if (el) buttonRefs.current.set(a.itemId, el);
                          else buttonRefs.current.delete(a.itemId);
                        }}
                        aria-label={`${a.omitted ? 'Volver a incluir' : 'Omitir'} ${a.name}`}
                        aria-describedby={a.omitted && a.bundles?.length ? `article-${a.itemId}-bundles` : undefined}
                        onClick={() => void toggle(a)}
                      >
                        {a.omitted ? 'Volver a incluir' : 'Omitir'}
                      </Button>
                    </div>
                    {a.omitted && a.bundles && a.bundles.length > 0 && (
                      <p id={`article-${a.itemId}-bundles`} className="text-xs text-pop-muted">
                        {bundlesNote(a.bundles)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
