import type { CSSProperties } from 'react';
import type { Palette, Template, TextEl } from '../../../../backend/src/catalog/template';
import { draftText } from '../../../../backend/src/catalog/template-presets';
import { bgStyle } from '../../print/text-effects';
import { textStyle } from '../../print/TemplateElement';

/**
 * Panel «Efectos» del texto (feature 012): una cuadrícula de estilos con vista previa «Ag», como la de Canva. Cada
 * celda enciende o apaga un efecto del texto; se pueden combinar y «Ninguno» los apaga todos. Las vistas previas se
 * dibujan con la misma función de estilos que el texto real, así que no pueden divergir de lo que se verá.
 */

type Values = Record<string, unknown>;

export interface EffectDef {
  id: string;
  label: string;
  /** Campos del texto que dibujan la vista previa de esta celda. */
  preview: Partial<TextEl>;
  active: (v: Values) => boolean;
  /** Parche que lo enciende (`on`) o lo apaga. */
  patch: (v: Values, on: boolean) => Partial<TextEl>;
}

const flag = (key: keyof TextEl, label: string, id: string): EffectDef => ({
  id,
  label,
  preview: { [key]: true } as Partial<TextEl>,
  active: (v) => v[key] === true,
  patch: (_v, on) => ({ [key]: on }) as Partial<TextEl>,
});

/** Orden de la cuadrícula: de izquierda a derecha y de arriba abajo, tres columnas. */
export const EFFECTS: readonly EffectDef[] = [
  { id: 'none', label: 'Ninguno', preview: {}, active: () => false, patch: () => ({}) },
  flag('shadow', 'Sombra', 'shadow'),
  flag('bright', 'Brillo', 'bright'),
  flag('echo', 'Eco', 'echo'),
  {
    id: 'outline',
    label: 'Contorno',
    preview: { stroke: 'a1', strokeW: 1.5 },
    active: (v) => v.stroke !== undefined && v.stroke !== 'none',
    patch: (v, on) => (on ? { stroke: 'ink', strokeW: Number(v.strokeW) > 0 ? Number(v.strokeW) : 2 } : { stroke: 'none' }),
  },
  flag('bg', 'Fondo', 'bg'),
  flag('misalign', 'Desalineado', 'misalign'),
  flag('hollow', 'Sin relleno', 'hollow'),
  {
    id: 'neon',
    label: 'Neón',
    preview: { glow: 'a1' },
    active: (v) => v.glow !== undefined && v.glow !== 'none',
    patch: (_v, on) => ({ glow: on ? 'a1' : 'none' }),
  },
  flag('glitch', 'Distorsión', 'glitch'),
];

/** Parche que apaga todos los efectos: «Ninguno». */
export const NO_EFFECTS: Partial<TextEl> = {
  shadow: false,
  bright: false,
  echo: false,
  bg: false,
  misalign: false,
  hollow: false,
  glitch: false,
  stroke: 'none',
  glow: 'none',
};

/** ¿Hay algún efecto activo? («Ninguno» se marca cuando no hay ninguno.) */
export const anyEffect = (v: Values): boolean => EFFECTS.some((e) => e.id !== 'none' && e.active(v));

function Preview({ def, palette, fonts }: { def: EffectDef; palette: Palette; fonts: Template['fonts'] }) {
  const el = { id: 'preview', ...draftText({ text: 'Ag', color: 'ink', ...def.preview }) } as TextEl;
  const style: CSSProperties = { ...textStyle(el, palette, fonts), fontSize: 26, lineHeight: 1, whiteSpace: 'nowrap', letterSpacing: 0 };
  const bg = bgStyle(el, palette);
  return <span style={style}>{bg ? <span style={bg}>Ag</span> : 'Ag'}</span>;
}

export default function EffectsGrid({
  values,
  palette,
  fonts,
  locked,
  onChange,
}: {
  values: Values;
  palette: Palette;
  fonts: Template['fonts'];
  locked?: boolean;
  onChange: (patch: Partial<TextEl>) => void;
}) {
  const none = !anyEffect(values);
  return (
    <div className="ed-field" role="group" aria-label="Efectos">
      <div className="ed-fx-grid">
        {EFFECTS.map((def) => {
          const on = def.id === 'none' ? none : def.active(values);
          return (
            <button
              key={def.id}
              type="button"
              className="ed-fx-cell"
              aria-pressed={on}
              aria-label={def.label}
              disabled={locked}
              onClick={() => onChange(def.id === 'none' ? NO_EFFECTS : def.patch(values, !on))}
            >
              <span className="ed-fx-preview" aria-hidden="true">
                <Preview def={def} palette={palette} fonts={fonts} />
              </span>
              <span className="ed-fx-name">{def.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
