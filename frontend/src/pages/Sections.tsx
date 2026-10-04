import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Field, PageHeader } from '../components/ui';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';
import CustomProducts from './CustomProducts';

interface Section {
  key: string;
  name: string;
  source: 'alegra' | 'custom';
  introText?: string | null;
}

/** "Contenido propio": secciones y orden, y (en otra pestaña) los productos propios de cada sección. */
export default function Sections() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'productos' ? 'productos' : 'secciones';

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        title="Contenido propio"
        subtitle="Secciones del catálogo y productos que no existen en Alegra (por ejemplo MOCHIS o REGALOS)."
      />
      <div role="tablist" aria-label="Contenido propio" className="flex gap-2">
        {(
          [
            ['secciones', 'Secciones'],
            ['productos', 'Productos propios'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'productos' ? { tab: 'productos' } : {})}
            className={`h-10 px-4 rounded-pop font-bold cursor-pointer border ${
              tab === id
                ? 'bg-pop-ink text-pop-side-text border-pop-ink'
                : 'bg-pop-surface text-pop-ink border-pop-line hover:bg-pop-surface2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === 'productos' ? <CustomProducts /> : <SectionsTab />}</div>
    </section>
  );
}

function SectionsTab() {
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; intro: string } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setSections(await api.get<Section[]>('/api/sections'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron cargar las secciones.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const guard = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await load();
      notifySummaryChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ocurrió un error.');
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSections(next);
    void guard(() => api.put('/api/sections/order', { keys: next.map((s) => s.key) }));
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    void guard(async () => {
      await api.post('/api/sections/custom', { name, introText: intro || null });
      setName('');
      setIntro('');
    });
  };

  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    void guard(async () => {
      await api.put(`/api/sections/custom/${editing.id}`, { name: editing.name, introText: editing.intro || null });
      setEditing(null);
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <p className="text-sm text-pop-muted">
        Define el orden en que aparecen las secciones en el catálogo. Las de Alegra vienen de sus categorías; las
        propias las creas aquí. Una sección sin productos no aparece en el PDF.
      </p>
      {error && <Alert tone="error">{error}</Alert>}

      <Card className="!p-0">
        <ol className="list-none m-0 p-0" aria-label="Orden de secciones">
          {sections.map((s, i) => (
            <li key={s.key} className={`p-3 flex items-center gap-2 flex-wrap ${i % 2 ? 'bg-pop-surface2' : ''}`}>
              <span className="flex-1 min-w-40 font-bold text-sm flex items-center gap-2">
                {s.name}
                <Badge tone={s.source === 'custom' ? 'custom' : 'alegra'}>
                  {s.source === 'custom' ? 'Propia' : 'Alegra'}
                </Badge>
              </span>
              <Button variant="secondary" className="h-9 !px-3" aria-label={`Subir ${s.name}`} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </Button>
              <Button
                variant="secondary"
                className="h-9 !px-3"
                aria-label={`Bajar ${s.name}`}
                disabled={i === sections.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              {s.source === 'custom' && (
                <>
                  <Button
                    variant="secondary"
                    className="h-9"
                    onClick={() => setEditing({ id: s.key.replace('custom:', ''), name: s.name, intro: s.introText ?? '' })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    className="h-9"
                    onClick={() => {
                      if (confirm(`¿Eliminar la sección ${s.name} con todos sus productos?`))
                        void guard(() => api.del(`/api/sections/custom/${s.key.replace('custom:', '')}`));
                    }}
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </li>
          ))}
          {sections.length === 0 && <li className="p-4 text-sm text-pop-muted">Aún no hay secciones.</li>}
        </ol>
      </Card>

      {editing ? (
        <Card>
          <form onSubmit={saveEdit} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Editar sección</h2>
            <Field label="Nombre" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sec-edit-intro" className="font-semibold text-[13px]">
                Texto de introducción
              </label>
              <textarea
                id="sec-edit-intro"
                className="px-3.5 py-2 rounded-pop border border-pop-line bg-pop-input"
                rows={3}
                value={editing.intro}
                onChange={(e) => setEditing({ ...editing, intro: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit">Guardar</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <form onSubmit={create} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Nueva sección propia</h2>
            <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="MOCHIS" required />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sec-new-intro" className="font-semibold text-[13px]">
                Texto de introducción (opcional)
              </label>
              <textarea
                id="sec-new-intro"
                className="px-3.5 py-2 rounded-pop border border-pop-line bg-pop-input"
                rows={3}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
              />
            </div>
            <Button type="submit" className="self-start">
              Crear sección
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
