import { useState } from 'react';
import {
  FONT_LABELS,
  PALETTE_KEYS,
  PALETTE_LABELS,
  paletteWarnings,
  type PaletteKey,
} from '../../../../../backend/src/catalog/template';
import { FONT_PAIRS, PALETTE_PRESETS } from '../../../../../backend/src/catalog/template-presets';
import { FONT_STACKS } from '../../../print/assets';
import type { PanelProps } from './ElementosPanel';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Qué parte del catálogo usa cada color de la paleta. */
const USES: Record<PaletteKey, string> = {
  bg: 'Tarjetas, precios, pie',
  a1: 'Contornos y resplandor',
  a2: 'Anillo de las fotos',
  a3: 'Bordes de precio y pie',
  ink: 'Textos principales',
  paper: 'Fondo de las páginas',
};

/** Una fila de la paleta: selector nativo y campo hexadecimal. Solo se guarda un `#RRGGBB` completo. */
function PaletteRow({ colorKey, value, onChange }: { colorKey: PaletteKey; value: string; onChange: (hex: string) => void }) {
  const label = PALETTE_LABELS[colorKey];
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !HEX.test(draft);
  return (
    <div className="ed-pal-row">
      <input
        type="color"
        className="ed-pal-color"
        aria-label={`Color ${label}`}
        value={value.toLowerCase()}
        onChange={(e) => {
          setDraft(null);
          onChange(e.target.value);
        }}
      />
      <div className="ed-pal-text">
        <strong>{label}</strong>
        <span>{USES[colorKey]}</span>
      </div>
      <input
        className="ed-hex"
        aria-label={`${label} hexadecimal`}
        aria-invalid={invalid}
        maxLength={7}
        spellCheck={false}
        value={draft ?? value}
        onChange={(e) => {
          const text = e.target.value.trim();
          if (HEX.test(text)) {
            setDraft(null);
            onChange(text);
          } else {
            setDraft(text); // se sigue escribiendo; el valor guardado no cambia hasta que sea un color completo
          }
        }}
        onBlur={() => setDraft(null)}
      />
      {invalid && (
        <span className="ed-pal-error" role="alert">
          Debe ser un color en formato #RRGGBB.
        </span>
      )}
    </div>
  );
}

/** Panel "Estilo": paleta de seis colores, paletas sugeridas y el par tipográfico de la plantilla. */
export default function EstiloPanel({ template, actions }: PanelProps) {
  const warnings = paletteWarnings(template.palette);
  const { title, body } = template.fonts;

  return (
    <div className="ed-panel-body">
      <section>
        <h3 className="ed-panel-title">Paleta de la plantilla</h3>
        <p className="ed-note">Cada elemento que usa un color de la paleta cambia a la vez.</p>
        {PALETTE_KEYS.map((key) => (
          <PaletteRow key={key} colorKey={key} value={template.palette[key]} onChange={(hex) => actions.setPaletteColor(key, hex)} />
        ))}
        <button type="button" className="ed-link" onClick={actions.restorePalette}>
          Restaurar colores originales
        </button>
        {warnings.length > 0 && (
          <ul className="ed-pal-warnings" data-testid="palette-warnings">
            {warnings.map((w) => (
              <li key={w.message}>{w.message}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="ed-heading">Paletas sugeridas</h3>
        {PALETTE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="ed-preset"
            aria-label={`Aplicar paleta ${preset.name}`}
            onClick={() => actions.applyPalette(preset.palette)}
          >
            <span aria-hidden="true">{preset.name}</span>
            <span className="ed-dots" aria-hidden="true">
              {(['bg', 'a1', 'a2', 'a3', 'paper'] as const).map((k) => (
                <i key={k} style={{ background: preset.palette[k] }} />
              ))}
            </span>
          </button>
        ))}
      </section>

      <section>
        <h3 className="ed-heading">Tipografía</h3>
        {FONT_PAIRS.map((pair) => {
          const active = pair.title === title && pair.body === body;
          return (
            <button
              key={`${pair.title}-${pair.body}`}
              type="button"
              className="ed-pair"
              aria-pressed={active}
              aria-label={`Tipografía ${FONT_LABELS[pair.title]} + ${FONT_LABELS[pair.body]}`}
              onClick={() => actions.setFonts(pair)}
            >
              <span aria-hidden="true" className="ed-pair-title" style={{ fontFamily: FONT_STACKS[pair.title] }}>
                {FONT_LABELS[pair.title]}
              </span>
              <span aria-hidden="true" className="ed-pair-body" style={{ fontFamily: FONT_STACKS[pair.body] }}>
                Texto con {FONT_LABELS[pair.body]}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
