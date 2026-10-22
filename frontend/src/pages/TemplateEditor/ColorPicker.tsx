import { useState } from 'react';
import { PALETTE_KEYS, PALETTE_LABELS, isPaletteKey, type Template } from '../../../../backend/src/catalog/template';
import Popover from './Popover';
import { colorOptions, hexOf, normalizeHex, searchColors, type ColorOption } from './template-colors';

/** Indicación de un selector deshabilitado porque el elemento está bloqueado (igual que la de alinear). */
export const LOCKED_HINT = 'Desbloquea el elemento para cambiar este ajuste';

/** Nombre accesible de cada muestra; el de la tinta no puede ser "Texto" porque chocaría con el campo de contenido. */
const SWATCH_LABELS: Record<(typeof PALETTE_KEYS)[number], string> = { ...PALETTE_LABELS, ink: 'Texto de la paleta' };

/** Cuántos colores libres se muestran antes de «Ver todos». */
export const FREE_COLORS_SHOWN = 18;

/** Lo que el navegador ofrece para tomar un color de la pantalla (solo Chromium); si falta, no se muestra el botón. */
interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>;
}
const eyeDropper = (): (new () => EyeDropperLike) | null =>
  typeof window !== 'undefined' && 'EyeDropper' in window ? (window as unknown as { EyeDropper: new () => EyeDropperLike }).EyeDropper : null;

export const INVALID_CODE = 'El código de color no es válido';

export interface ColorPickerProps {
  /** Nombre del campo («Relleno», «Contorno»…): también es el del grupo. */
  label: string;
  /** Propiedad que se escribe en el elemento. */
  field: string;
  value: unknown;
  /** Para calcular «Colores de la plantilla» (paleta y colores libres de cualquier página). */
  template: Pick<Template, 'palette' | 'pages'>;
  none?: 'none' | 'transparent';
  locked?: boolean;
  onChange: (patch: Record<string, unknown>, mergeKey?: string) => void;
}

const nameOf = (o: ColorOption): string => (isPaletteKey(o.value) ? SWATCH_LABELS[o.value] : o.label);

/** El valor de la opción que debe marcarse como activa para lo guardado (la primera que coincide; la paleta va antes). */
function activeValue(options: readonly ColorOption[], template: ColorPickerProps['template'], value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value === 'none' || value === 'transparent' || isPaletteKey(value)) return value;
  const hex = hexOf(template, value);
  return hex ? (options.find((o) => o.hex === hex)?.value ?? hex) : null;
}

/**
 * Selector de color de una propiedad (feature 009). Un botón con el color activo abre un panel con los colores de la
 * plantilla, los básicos y el selector gráfico del navegador. El formato guardado no cambia: una clave de la paleta
 * (que sigue a la paleta si esta cambia) o un `#RRGGBB` en mayúsculas.
 */
export default function ColorPicker({ label, field, value, template, none, locked, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const options = colorOptions(template, { none });
  const active = activeValue(options, template, value);
  const activeOption = options.find((o) => o.value === active);
  const activeName = activeOption ? nameOf(activeOption) : (hexOf(template, value) ?? 'Sin color');
  const activeHex = hexOf(template, value);

  const pick = (o: ColorOption) => onChange({ [field]: o.value });
  const close = () => {
    setOpen(false);
    setShowAll(false);
    setQuery('');
    setError(null);
  };

  // Búsqueda: un código válido se propone para aplicar; el texto también filtra por nombre
  const typedHex = normalizeHex(query);
  const results = query.trim() === '' ? [] : searchColors(options, query);
  const apply = (hex: string) => {
    onChange({ [field]: hex });
    setQuery('');
    setError(null);
  };
  const confirm = () => {
    if (typedHex) return apply(typedHex);
    const first = results[0];
    if (first) {
      pick(first);
      setQuery('');
      setError(null);
    } else if (query.trim() !== '') setError(INVALID_CODE);
  };
  const Dropper = eyeDropper();
  const useDropper = () => {
    if (!Dropper) return;
    // Escape o cualquier rechazo cancela: el color anterior se conserva
    new Dropper()
      .open()
      .then((r) => {
        const hex = normalizeHex(r.sRGBHex);
        if (hex) onChange({ [field]: hex });
      })
      .catch(() => undefined);
  };

  const plantilla = options.filter((o) => o.group === 'plantilla');
  const palette = plantilla.filter((o) => isPaletteKey(o.value));
  const free = plantilla.filter((o) => !isPaletteKey(o.value));
  const shownFree = showAll ? free : free.slice(0, FREE_COLORS_SHOWN);
  const basic = options.filter((o) => o.group === 'basico');
  const special = options.find((o) => o.group === 'especial');

  const swatch = (o: ColorOption) => (
    <button
      key={`${o.group}-${o.value}`}
      type="button"
      title={nameOf(o)}
      aria-label={nameOf(o)}
      aria-pressed={active === o.value}
      className="ed-swatch"
      style={{ background: o.hex ?? undefined }}
      onClick={() => pick(o)}
    />
  );

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
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span
          className="ed-picker-swatch"
          data-none={activeHex === null ? 'true' : undefined}
          style={{ background: activeHex ?? undefined }}
          aria-hidden="true"
        />
        <span className="ed-picker-name">{activeName}</span>
      </button>
      <Popover open={open} anchor={anchor} title={`Color: ${label}`} onClose={close}>
        <input
          type="search"
          data-autofocus
          className="ed-pick-search"
          aria-label="Buscar color por nombre o código"
          placeholder="Nombre o código (#E91E8C)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirm();
            }
          }}
        />
        {typedHex && (
          <button type="button" className="ed-pick-apply" onClick={() => apply(typedHex)}>
            <span className="ed-picker-swatch" style={{ background: typedHex }} aria-hidden="true" />
            {`Aplicar ${typedHex}`}
          </button>
        )}
        {query.trim() !== '' && (results.length > 0 || !typedHex) && (
          <section className="ed-pick-group" aria-label="Resultados de la búsqueda">
            {results.length > 0 ? (
              <div className="ed-swatches">{results.map(swatch)}</div>
            ) : (
              <>
                <p className="ed-pick-empty">No hay colores con ese nombre</p>
                <button type="button" className="ed-pick-more" onClick={() => setQuery('')}>
                  Limpiar búsqueda
                </button>
              </>
            )}
          </section>
        )}
        {query.trim() === '' && (
          <>
        <section className="ed-pick-group" aria-label="Colores de la plantilla">
          <div className="ed-pick-title">Colores de la plantilla</div>
          <div className="ed-swatches">
            {palette.map(swatch)}
            {shownFree.map(swatch)}
          </div>
          {free.length > FREE_COLORS_SHOWN && (
            <button type="button" className="ed-pick-more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Ver menos' : `Ver todos (${free.length})`}
            </button>
          )}
        </section>
        <section className="ed-pick-group" aria-label="Colores básicos">
          <div className="ed-pick-title">Colores básicos</div>
          <div className="ed-swatches">{basic.map(swatch)}</div>
        </section>
        {special && (
          <button
            type="button"
            className="ed-pick-special"
            aria-pressed={active === special.value}
            onClick={() => pick(special)}
          >
            {special.label}
          </button>
        )}
          </>
        )}
        <section className="ed-pick-group" aria-label="Otro color">
          <div className="ed-pick-title">Otro color</div>
          <input
            type="color"
            aria-label="Color personalizado"
            title="Color personalizado"
            className="ed-swatch ed-swatch-custom"
            data-active={active !== null && activeHex !== null && !options.some((o) => o.hex === activeHex) ? 'true' : undefined}
            value={(activeHex ?? '#000000').toLowerCase()}
            onChange={(e) => onChange({ [field]: normalizeHex(e.target.value) ?? e.target.value.toUpperCase() }, field)}
          />
          {Dropper && (
            <button type="button" className="ed-pick-more" onClick={useDropper}>
              Cuentagotas
            </button>
          )}
        </section>
        <p className="ed-pick-status" role="status">
          {error ?? `Color activo: ${activeName}`}
        </p>
      </Popover>
    </div>
  );
}
