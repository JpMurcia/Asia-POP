import EffectsGrid from './EffectsGrid';
import { useState } from 'react';
import { LIMITS, type Palette, type Template } from '../../../../backend/src/catalog/template';
import ColorPicker from './ColorPicker';
import FontPicker from './FontPicker';
import ImagePicker from './ImagePicker';
import { clampBox } from './useTemplateEditor';
import { TOKEN_CHIPS, type FieldAction, type FieldDesc } from './inspector-fields';

export interface FieldRendererProps {
  fields: readonly FieldDesc[];
  /** Valores actuales: el elemento seleccionado o el fondo de la página. */
  values: Record<string, unknown>;
  palette: Palette;
  /** La plantilla: de ella salen «Colores de la plantilla» (paleta y colores libres de cualquier página). */
  template?: Pick<Template, 'palette' | 'pages' | 'fonts'>;
  /** `mergeKey` agrupa los cambios seguidos de un mismo campo (deslizar un rango) en un solo paso del historial. */
  onChange: (patch: Record<string, unknown>, mergeKey?: string) => void;
  /** Acción de un botón del inspector (por ejemplo, «Restaurar tamaños originales»). */
  onAction?: (action: FieldAction) => void;
  /** Paneles plegables abiertos, por `id` (feature 008). El estado lo guarda quien dibuja el inspector. */
  sectionOpen?: Readonly<Record<string, boolean>>;
  onSectionToggle?: (id: string) => void;
  /** Elemento bloqueado: los campos dentro de los paneles quedan deshabilitados. */
  locked?: boolean;
}

export const LOCKED_SECTION_HINT = 'Desbloquea el elemento para cambiar estos ajustes';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Agrega un dato al final del texto, separado por un espacio si hace falta. */
function appendToken(current: unknown, token: string): string {
  const text = typeof current === 'string' ? current : '';
  return text === '' || /\s$/.test(text) ? `${text}${token}` : `${text} ${token}`;
}

function RangeField({
  desc,
  value,
  onChange,
  disabled,
}: {
  desc: Extract<FieldDesc, { kind: 'range' }>;
  value: unknown;
  onChange: FieldRendererProps['onChange'];
  disabled?: boolean;
}) {
  const scale = desc.scale ?? 1;
  const stored = typeof value === 'number' ? value : (desc.fallback ?? desc.min / scale);
  const shown = Math.round(stored * scale * 100) / 100;
  const isCircle = desc.circleAt !== undefined && shown >= desc.circleAt;
  return (
    <div className="ed-field">
      <div className="ed-field-label">
        <span>{desc.label}</span>
        {desc.numeric ? (
          <span className="ed-field-value ed-field-value-input">
            <NumberField
              label={`${desc.label} (valor)`}
              compact
              deferred
              decimals={desc.decimals ?? 2}
              disabled={disabled}
              value={shown}
              onCommit={(n) => onChange({ [desc.key]: Math.round((n / scale) * 1000) / 1000 })}
            />
            {desc.unit}
          </span>
        ) : (
          <span className="ed-field-value">{`${shown}${desc.unit ?? ''}`}</span>
        )}
      </div>
      <input
        type="range"
        aria-label={desc.label}
        min={desc.min}
        max={desc.max}
        step={desc.step}
        value={shown}
        disabled={disabled}
        onChange={(e) => onChange({ [desc.key]: Math.round((Number(e.target.value) / scale) * 1000) / 1000 }, desc.key)}
      />
      {isCircle && <span className="ed-field-hint">Con este valor la imagen es un círculo.</span>}
    </div>
  );
}

/**
 * Campo numérico de texto libre: acepta lo que se escribe a medias y solo guarda números válidos dentro del rango.
 * Con `deferred` el valor se guarda al pulsar Enter o al salir del campo, no a cada tecla: así escribir «60» no pasa
 * por «6» (que se recortaría y avisaría de un mínimo que la persona aún no terminó de teclear).
 */
function NumberField({
  label,
  value,
  onCommit,
  deferred = false,
  decimals = 1,
  compact = false,
  disabled = false,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  deferred?: boolean;
  /** Decimales que se muestran del valor guardado (por defecto 1). */
  decimals?: number;
  /** Sin el rótulo visible: el campo va junto a otro control que ya lo nombra. El nombre accesible se conserva. */
  compact?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (text: string): number | null => {
    const n = Number(text.replace(',', '.'));
    return text.trim() !== '' && Number.isFinite(n) ? n : null;
  };
  /** Guarda lo escrito (si es un número) y vuelve a mostrar el valor guardado, ya recortado. */
  const settle = () => {
    const n = draft === null ? null : parse(draft);
    if (n !== null) onCommit(n);
    setDraft(null);
  };
  return (
    <label className={compact ? 'ed-num ed-num-compact' : 'ed-num'}>
      {!compact && <span>{label}</span>}
      <input
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={draft ?? String(Math.round(value * 10 ** decimals) / 10 ** decimals)}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          if (!deferred) {
            const n = parse(text);
            if (n !== null) onCommit(n);
          }
        }}
        onKeyDown={(e) => {
          if (deferred && e.key === 'Enter') settle();
        }}
        onBlur={() => (deferred ? settle() : setDraft(null))}
      />
    </label>
  );
}

/** Texto de una línea: guarda al pulsar Enter o al salir del campo (un solo paso del historial), no a cada tecla. */
function TextInputField({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
    setDraft(null);
  };
  return (
    <div className="ed-field">
      <div className="ed-field-label">
        <span>{label}</span>
      </div>
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') settle();
          if (e.key === 'Escape') setDraft(null);
        }}
        onBlur={settle}
      />
    </div>
  );
}

/** Dibuja la lista de descriptores de `inspector-fields.ts`: una línea por propiedad. */
export default function FieldRenderer({ fields, values, palette, template, onChange, onAction, sectionOpen, onSectionToggle, locked }: FieldRendererProps) {
  const colorSource = template ?? { palette, pages: {} as Template['pages'], fonts: { title: 'fredoka', body: 'poppins' } as Template['fonts'] };
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

          case 'section': {
            const open = sectionOpen?.[f.id] === true;
            return (
              <div key={`section-${f.id}`} className="ed-section" data-open={open ? 'true' : undefined}>
                <button
                  type="button"
                  className="ed-section-head"
                  aria-expanded={open}
                  aria-controls={`ed-section-${f.id}`}
                  onClick={() => onSectionToggle?.(f.id)}
                >
                  <span>{f.label}</span>
                  <span aria-hidden="true" className="ed-section-chevron" />
                </button>
                {open && (
                  <fieldset id={`ed-section-${f.id}`} className="ed-section-body" disabled={locked} title={locked ? LOCKED_SECTION_HINT : undefined}>
                    <FieldRenderer
                      fields={f.fields}
                      values={values}
                      palette={palette}
                      template={template}
                      onChange={onChange}
                      onAction={onAction}
                      sectionOpen={sectionOpen}
                      onSectionToggle={onSectionToggle}
                      locked={locked}
                    />
                  </fieldset>
                )}
              </div>
            );
          }

          case 'color':
            return (
              <ColorPicker
                key={f.key}
                label={f.label}
                field={f.key}
                value={values[f.key] ?? f.fallback}
                template={colorSource}
                none={f.none}
                locked={locked}
                onChange={onChange}
              />
            );

          case 'range':
            return <RangeField key={f.key} desc={f} value={values[f.key]} onChange={onChange} disabled={locked && f.lockable} />;

          case 'segmented':
            return (
              <div key={f.key} className="ed-field" role="group" aria-label={f.label}>
                <div className="ed-field-label">
                  <span>{f.label}</span>
                </div>
                <div className={f.wrap ? 'ed-seg ed-seg-wrap' : 'ed-seg'}>
                  {f.options.map(([v, text]) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={(values[f.key] ?? f.fallback) === v}
                      onClick={() => onChange({ [f.key]: v })}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            );

          case 'font':
            return <FontPicker key={f.key} label={f.label} field={f.key} value={values[f.key]} template={colorSource} locked={locked} onChange={onChange} />;

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

          case 'input':
            return (
              <TextInputField
                key={`${f.key}-input`}
                label={f.label}
                placeholder={f.placeholder}
                value={typeof values[f.key] === 'string' ? (values[f.key] as string) : ''}
                disabled={locked && f.lockable}
                onCommit={(text) => onChange({ [f.key]: text })}
              />
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

          case 'effects':
            return (
              <EffectsGrid
                key={f.id}
                values={values}
                palette={palette}
                fonts={colorSource.fonts}
                locked={locked}
                onChange={(patch) => onChange(patch as Record<string, unknown>)}
              />
            );

          case 'imagePicker':
            return <ImagePicker key={`${f.key}-picker`} value={values[f.key]} label={f.label} onPick={(src) => onChange({ [f.key]: src })} />;

          case 'toggle': {
            const on = values[f.key] === true;
            return (
              <button
                key={f.key}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={f.label}
                disabled={locked && f.lockable}
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

          case 'numbers': {
            const grid = (
              <div key={`nums${i}`} className="ed-nums" style={{ gridTemplateColumns: `repeat(${f.items.length}, 1fr)` }}>
                {f.items.map(([key, label]) => (
                  <NumberField
                    key={key}
                    label={label}
                    value={Number(values[key] ?? 0)}
                    deferred={f.confirm === 'blur'}
                    onCommit={(n) => onChange({ [key]: clampBox[key as keyof typeof clampBox](n) }, key)}
                  />
                ))}
              </div>
            );
            // Con nombre de grupo (los dos pares de ancho y alto de los productos) se rotula para quien no ve la pantalla
            return f.group ? (
              <div key={`numgroup${i}`} className="ed-numgroup" role="group" aria-label={f.group}>
                <span className="ed-subhead" aria-hidden="true">
                  {f.group}
                </span>
                {grid}
              </div>
            ) : (
              grid
            );
          }

          case 'note':
            // Sin texto no se dibuja nada (el aviso temporal del editor ya se anuncia al cambiar)
            return f.text ? (
              <p key={f.id} id={f.id} role="status" className="ed-limit-note">
                {f.text}
              </p>
            ) : null;

          case 'button':
            return (
              <button key={f.action} type="button" className="ed-action-btn" onClick={() => onAction?.(f.action)}>
                {f.label}
              </button>
            );
        }
      })}
    </>
  );
}
