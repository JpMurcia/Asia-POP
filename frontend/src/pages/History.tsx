import { useEffect, useState } from 'react';
import { Card, PageHeader } from '../components/ui';
import { api } from '../services/api';

interface Entry {
  id: string;
  createdAt: string;
  includedCount: number;
  omittedCount: number;
  pages?: number;
}

export default function History() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    api.get<Entry[]>('/api/catalog/history').then(setEntries);
  }, []);

  if (!entries) return <p>Cargando…</p>;
  return (
    <section className="flex flex-col gap-5 max-w-3xl">
      <PageHeader title="Historial" subtitle="Los catálogos generados. Se conservan los 10 más recientes." />
      {entries.length === 0 ? (
        <p className="text-pop-muted">Aún no has generado ningún catálogo.</p>
      ) : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-pop-muted border-b border-pop-line">
                <th className="p-3 font-semibold">Fecha</th>
                <th className="p-3 font-semibold">Páginas</th>
                <th className="p-3 font-semibold">Incluidos</th>
                <th className="p-3 font-semibold">Omitidos</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} className={i % 2 ? 'bg-pop-surface2' : ''}>
                  <td className="p-3">{new Date(e.createdAt).toLocaleString('es-CO')}</td>
                  <td className="p-3">{e.pages ?? '—'}</td>
                  <td className="p-3">{e.includedCount}</td>
                  <td className="p-3">{e.omittedCount}</td>
                  <td className="p-3 text-right">
                    <a className="font-bold" href={`/api/catalog/history/${e.id}/pdf`}>
                      Descargar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
