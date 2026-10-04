import { useState } from 'react';
import {
  LIMITS,
  PALETTE_KEYS,
  PALETTE_LABELS,
  isPaletteKey,
  type Palette,
} from '../../../../backend/src/catalog/template';
import { clampBox } from './useTemplateEditor';
import { TOKEN_CHIPS, type FieldDesc } from './inspector-fields';

export interface FieldRendererProps {
  fields: readonly FieldDesc[];
  /** Valores actuales: el elemento seleccionado o el fondo de la página. */
  values: Record<string, unknown>;
  palette: Palette;
  /** `mergeKey` agrupa los cambios seguidos de un mismo campo (deslizar un rango) en un solo paso del historial. */
  onChange: (patch: Record<string, unknown>, mergeKey?: string) => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Nombre accesible de cada muestra; el de la tinta no puede ser "Texto" porque chocaría con el campo de contenido. */
const SWATCH_LABELS: Record<(typeof PALETTE_KEYS)[number], string> = { ...PALETTE_LABELS, ink: 'Texto de la paleta' };

/** El color que muestra el selector nativo para un valor guardado (clave de paleta o `#RRGGBB`). */
function hexOf(value: unknown, palette: Palette): string {
  if (typeof value === 'string') {
    if (isPaletteKey(value)) return palette[value];
    if (HEX.test(value)) return value;
  }
  return '#000000';
}

/** Agrega un dato al final del texto, separado por un espacio si hace falta. */
function appendToken(current: unknown, token: string): string {
  const text = typeof current === 'string' ? current : '';
  return text === '' || /\s$/.test(text) ? `${text}${token}` : `${text} ${token}`;
}

function ColorField({
  desc,
  value,
  palette,
  onChange,
}: {
  desc: Extract<FieldDesc, { kind: 'color' }>;
  value: unknown;
  palette: Palette;
  onChange: FieldRendererProps['onChange'];
}) {
  const pick = (v: string) => onChange({ [desc.key]: v });
  const custom = typeof value === 'string' && HEX.test(value) ? value.toUpperCase() : null;
  return (
    <div className="ed-field" role="group" aria-label={desc.label}>
      <div className="ed-field-label">
        <span>{desc.label}</span>
      </div>
      <div className="ed-swatches">
        {PALETTE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            title={PALETTE_LABELS[k]}
            aria-label={SWATCH_LABELS[k]}
            aria-pressed={value === k}
            className="ed-swatch"
            style={{ background: palette[k] }}
            onClick={() => pick(k)}
          />
        ))}
        {desc.none && (
          <button
            type="button"
            title={desc.none === 'none' ? 'Ninguno' : 'Transparente'}
            aria-label={desc.none === 'none' ? 'Ninguno' : 'Transparente'}
            aria-pressed={value === desc.none}
            className="ed-swatch ed-swatch-none"
            onClick={() => pick(desc.none!)}
          />
        )}
        <input
          type="color"
          aria-label="Color personalizado"
          title="Color personalizado"
          className="ed-swatch ed-swatch-custom"
          data-active={custom ? 'true' : undefined}
          value={hexOf(value, palette)}
          onChange={(e) => onChange({ [desc.key]: e.target.value.toUpperCase() }, desc.key)}
        />
      </div>
    </div>
  );
}

function RangeField({
  desc,
  value,
  onChange,
}: {
  desc: Extract<FieldDesc, { kind: 'range' }>;
  value: unknown;
  onChange: FieldRendererProps['onChange'];
}) {
  const scale = desc.scale ?? 1;
  const stored = typeof value === 'number' ? value : desc.min / scale;
  const shown = Math.round(stored * scale * 100) / 100;
  const isCircle = desc.circleAt !== undefined && shown >= desc.circleAt;
  return (
    <div className="ed-field">
      <div className="ed-field-label">
        <span>{desc.label}</span>
        <span className="ed-field-value">{`${shown}${desc.unit ?? ''}`}</span>
      </div>
      <input
        type="range"
        aria-label={desc.label}
        min={desc.min}
        max={desc.max}
        step={desc.step}
        value={shown}
        onChange={(e) => onChange({ [desc.key]: Math.round((Number(e.target.value) / scale) * 1000) / 1000 }, desc.key)}
      />
      {isCircle && <span className="ed-field-hint">Con este valor la imagen es un círculo.</span>}
    </div>
  );
}

/** Campo numérico de texto libre: acepta lo que se escribe a medias y solo guarda números válidos dentro del rango. */
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="ed-num">
      <span>{label}</span>
      <input
        inputMode="decimal"
        aria-label={label}
        value={draft ?? String(round1(value))}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text.replace(',', '.'));
          if (text.trim() !== '' && Number.isFinite(n)) onCommit(n);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

/** Dibuja la lista de descriptores de `inspector-fields.ts`: una línea por propiedad. */
export default function FieldRenderer({ fields, values, palette, onChange }: FieldRendererProps) {
  return (
    <>
      {fields.map((f, i) => {
        switch (f.kind) {
          case 'heading':
            return (
              <div key={`h${i}`} className="ed-heading">
                {f.label}
              </div>
            );

          case 'color':
            return <ColorField key={f.key} desc={f} value={values[f.key]} palette={palette} onChange={onChange} />;

          case 'range':
            return <RangeField key={f.key} desc={f} value={values[f.key]} onChange={onChange} />;

          case 'segmented':
            return (
              <div key={f.key} className="ed-field" role="group" aria-label={f.label}>
                <div className="ed-field-label">
                  <span>{f.label}</span>
                </div>
                <div className="ed-seg">
                  {f.options.map(([v, text]) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={values[f.key] === v}
                      onClick={() => onChange({ [f.key]: v })}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            );

          case 'select':
            return (
              <div key={f.key} className="ed-field">
                <div className="ed-field-label">
                  <span>{f.label}</span>
                </div>
                <select aria-label={f.label} value={String(values[f.key] ?? '')} onChange={(e) => onChange({ [f.key]: e.target.value })}>
                  {f.options.map(([v, text]) => (
                    <option key={v} value={v}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>
            );

          case 'textarea':
            return (
              <div key={`${f.key}-area`} className="ed-field">
                <div className="ed-field-label">
                  <span>{f.label}</span>
                </div>
                <textarea
                  aria-label={f.label}
                  rows={f.rows ?? 2}
                  maxLength={LIMITS.textMax}
                  value={String(values[f.key] ?? '')}
                  onChange={(e) => onChange({ [f.key]: e.target.value }, f.key)}
                />
              </div>
            );

          case 'tokens':
            return (
              <div key={`${f.key}-tokens`} className="ed-field" role="group" aria-label={f.label}>
                <div className="ed-tokens">
                  {TOKEN_CHIPS.map(([token, text]) => (
                    <button key={token} type="button" onClick={() => onChange({ [f.key]: appendToken(values[f.key], token) })}>
                      {text}
                    </button>
                  ))}
                </div>
                <span className="ed-field-hint">Se reemplazan por el dato real al generar.</span>
              </div>
            );

          case 'toggle': {
            const on = values[f.key] === true;
            return (
              <button
                key={f.key}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={f.label}
                className="ed-toggle"
                onClick={() => onChange({ [f.key]: !on })}
              >
                <span>{f.label}</span>
                <span className="ed-toggle-track" data-on={on}>
                  <span className="ed-toggle-knob" />
                </span>
              </button>
            );
          }

          case 'numbers':
            return (
              <div key={`nums${i}`} className="ed-nums">
                {f.items.map(([key, label]) => (
                  <NumberField
                    key={key}
                    label={label}
                    value={Number(values[key] ?? 0)}
                    onCommit={(n) => onChange({ [key]: clampBox[key as keyof typeof clampBox](n) }, key)}
                  />
                ))}
              </div>
            );
        }
      })}
    </>
  );
}
