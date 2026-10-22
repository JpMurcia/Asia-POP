import { useState } from 'react';
import type { FontRef, Template } from '../../../../backend/src/catalog/template';
import { FONT_STACKS } from '../../print/assets';
import { LOCKED_HINT } from './ColorPicker';
import Popover from './Popover';
import { fontChoices, searchFonts, type FontOption } from './template-fonts';

export interface FontPickerProps {
  label: string;
  /** Propiedad que se escribe en el elemento (`font`). */
  field: string;
  value: unknown;
  /** Para calcular «Fuentes de la plantilla» (título, cuerpo y las familias que usan los elementos). */
  template: Pick<Template, 'fonts' | 'pages'>;
  locked?: boolean;
  onChange: (patch: Record<string, unknown>, mergeKey?: string) => void;
}

/**
 * Selector de fuente (feature 009): cada familia se muestra escrita con su propia tipografía, con una marca en la
 * activa. «Título» y «Cuerpo» se guardan como referencias a las fuentes de la plantilla, no como la familia.
 */
export default function FontPicker({ label, field, value, template, locked, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState('');

  const options = fontChoices(template);
  const active = options.find((o) => o.value === (value as FontRef));
  const activeName = active?.label ?? String(value ?? 'Sin fuente');
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (o: FontOption) => onChange({ [field]: o.value });

  const searching = query.trim() !== '';
  const results = searching ? searchFonts(options, query) : [];

  const row = (o: FontOption) => {
    const on = o.value === value;
    return (
      <button
        key={`${o.group}-${o.value}`}
        type="button"
        className="ed-font-opt"
        aria-pressed={on}
        data-check={on ? 'true' : undefined}
        style={{ fontFamily: FONT_STACKS[o.family] }}
        onClick={() => pick(o)}
      >
        <span>{o.label}</span>
        {on && (
          <span className="ed-font-check" aria-hidden="true">
            ✓
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="ed-field" role="group" aria-label={label}>
      <div className="ed-field-label">
        <span>{label}</span>
      </div>
      <button
        ref={setAnchor}
        type="button"
        className="ed-picker-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${activeName}`}
        disabled={locked}
        title={locked ? LOCKED_HINT : undefined}
        style={{ fontFamily: active ? FONT_STACKS[active.family] : undefined }}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="ed-picker-name">{activeName}</span>
      </button>
      <Popover open={open} anchor={anchor} title={label} onClose={close}>
        <input
          type="search"
          data-autofocus
          className="ed-pick-search"
          aria-label="Buscar fuente"
          placeholder="Nombre de la fuente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              e.preventDefault();
              pick(results[0]);
            }
          }}
        />
        {searching ? (
          <section className="ed-pick-group" aria-label="Resultados de la búsqueda">
            {results.length > 0 ? (
              results.map(row)
            ) : (
              <>
                <p className="ed-pick-empty">No hay fuentes con ese nombre</p>
                <button type="button" className="ed-pick-more" onClick={() => setQuery('')}>
                  Limpiar búsqueda
                </button>
              </>
            )}
          </section>
        ) : (
          <>
            <section className="ed-pick-group" aria-label="Fuentes de la plantilla">
              <div className="ed-pick-title">Fuentes de la plantilla</div>
              {options.filter((o) => o.group === 'plantilla').map(row)}
            </section>
            <section className="ed-pick-group" aria-label="Todas las fuentes">
              <div className="ed-pick-title">Todas las fuentes</div>
              {options.filter((o) => o.group === 'todas').map(row)}
            </section>
          </>
        )}
        <p className="ed-pick-status" role="status">
          {`Fuente activa: ${activeName}`}
        </p>
      </Popover>
    </div>
  );
}
