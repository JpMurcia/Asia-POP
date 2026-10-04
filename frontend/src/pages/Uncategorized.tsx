import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Card, PageHeader } from '../components/ui';
import { notifySummaryChanged } from '../hooks/usePanelSummary';
import { api, ApiError } from '../services/api';

interface Item {
  itemId: string;
  name: string;
  assignedSectionKey: string | null;
}
interface Section {
  key: string;
  name: string;
  source: 'alegra' | 'custom';
}

export default function Uncategorized() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([
        api.get<{ items: Item[] }>('/api/catalog/uncategorized'),
        api.get<Section[]>('/api/sections'),
      ]);
      setItems(u.items);
      setSections(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo consultar Alegra.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(itemId: string, sectionKey: string) {
    setError('');
    try {
      if (sectionKey) await api.put(`/api/catalog/uncategorized/${encodeURIComponent(itemId)}`, { sectionKey });
      else await api.del(`/api/catalog/uncategorized/${encodeURIComponent(itemId)}`);
      setItems((prev) =>
        prev ? prev.map((i) => (i.itemId === itemId ? { ...i, assignedSectionKey: sectionKey || null } : i)) : prev,
      );
      notifySummaryChanged(); // actualiza el contador de la barra lateral
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la asignación.');
    }
  }

  const pending = items?.filter((i) => !i.assignedSectionKey).length ?? 0;

  return (
    <section className="flex flex-col gap-5 max-w-3xl">
      <PageHeader
        title="Sin categoría"
        subtitle="Productos de Alegra sin categoría. Quedan fuera del PDF hasta que les asignes una sección."
      />
      <p className="text-sm text-pop-muted">
        La asignación solo se guarda aquí: no cambia nada en Alegra, así que conviene corregirlo allá también.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {!items ? (
        !error && <p>Cargando…</p>
      ) : items.length === 0 ? (
        <Alert tone="success">Todos los productos tienen categoría. Puedes generar el catálogo.</Alert>
      ) : (
        <Card className="!p-0">
          <p className="px-4 py-3 text-sm text-pop-muted border-b border-pop-line">
            {pending > 0 ? `${pending} pendientes de asignar` : 'Todos tienen sección asignada'}
          </p>
          <ul className="list-none m-0 p-0">
            {items.map((i, idx) => (
              <li
                key={i.itemId}
                className={`p-3 flex items-center gap-3 flex-wrap ${idx % 2 ? 'bg-pop-surface2' : ''}`}
              >
                <span className="flex-1 min-w-40 text-sm font-semibold">{i.name}</span>
                {i.assignedSectionKey ? <Badge tone="alegra">Asignado</Badge> : <Badge tone="amber">Pendiente</Badge>}
                <select
                  aria-label={`Sección para ${i.name}`}
                  className="h-10 px-2 rounded-pop border border-pop-line bg-pop-input text-sm"
                  value={i.assignedSectionKey ?? ''}
                  onChange={(e) => assign(i.itemId, e.target.value)}
                >
                  <option value="">— Sin sección (fuera del catálogo) —</option>
                  {sections.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                      {s.source === 'custom' ? ' (propia)' : ''}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
