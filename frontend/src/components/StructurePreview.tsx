import type { CatalogStructure } from '../../../backend/src/catalog/types';
import { Card } from './ui';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Vista previa de estructura del PDF: portadas, páginas de productos (máx. 3 por página) y contenido propio. */
export default function StructurePreview({ structure }: { structure: CatalogStructure }) {
  if (structure.nothingToGenerate) {
    return (
      <Card className="!shadow-none" data-testid="structure-preview" aria-labelledby="structure-title">
        <h2 id="structure-title" className="text-[17px] font-semibold mb-2">
          Vista previa de estructura
        </h2>
        <p className="text-sm text-pop-muted">No hay nada que generar con estas opciones: marca al menos una sección.</p>
      </Card>
    );
  }

  const rows: { label: string; value: string; note?: string }[] = [
    {
      label: 'Portadas',
      value: plural(structure.coverPages + structure.sectionCoverPages, 'página', 'páginas'),
      note: `1 general + ${structure.sectionCoverPages} de sección`,
    },
    {
      label: 'Productos (máx. 3)',
      value: plural(structure.productPages, 'página', 'páginas'),
    },
    {
      label: 'Contenido propio / políticas',
      value: `${plural(structure.ownItems, 'producto propio', 'productos propios')} · ${structure.termsPages} de políticas`,
    },
  ];

  return (
    <Card className="!shadow-none flex flex-col gap-3" data-testid="structure-preview" aria-labelledby="structure-title">
      <h2 id="structure-title" className="text-[17px] font-semibold">
        Vista previa de estructura
      </h2>
      <dl className="flex flex-col m-0">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2 border-t border-pop-line">
            <dt className="text-pop-muted text-sm">
              {r.label}
              {r.note && <span className="block text-xs">{r.note}</span>}
            </dt>
            <dd className="m-0 font-bold text-sm text-right">{r.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 py-2 border-t-2 border-pop-ink">
          <dt className="font-bold">Total</dt>
          <dd className="m-0 font-display text-xl font-semibold" data-testid="structure-total">
            {plural(structure.totalPages, 'página', 'páginas')}
          </dd>
        </div>
      </dl>
      <ul className="list-none m-0 p-0 text-xs text-pop-muted flex flex-col gap-0.5" aria-label="Detalle por sección">
        {structure.sections.map((s) => (
          <li key={s.key} className="flex justify-between gap-2">
            <span>{s.name}</span>
            <span>
              {plural(s.items, 'producto', 'productos')} · {plural(s.pages, 'página', 'páginas')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
