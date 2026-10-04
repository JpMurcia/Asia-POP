import type { ComponentType } from 'react';
import ElementosPanel, { type PanelProps } from './panels/ElementosPanel';
import DatosPanel from './panels/DatosPanel';
import EstiloPanel from './panels/EstiloPanel';
import PlantillasPanel from './panels/PlantillasPanel';
import type { EditorTab } from './useTemplateEditor';

interface PanelDef {
  label: string;
  /** Forma del icono del riel (una figura de CSS, sin imágenes). */
  glyph: 'square' | 'circle' | 'diamond' | 'ring';
  Component: ComponentType<PanelProps>;
}

/**
 * Registro de paneles del riel. Cada historia agrega el suyo aquí: Elementos (esta), y después Plantillas, Estilo y
 * Datos. El riel solo muestra los paneles registrados.
 */
export const PANELS: Partial<Record<EditorTab, PanelDef>> = {
  plantillas: { label: 'Plantillas', glyph: 'circle', Component: PlantillasPanel },
  elementos: { label: 'Elementos', glyph: 'square', Component: ElementosPanel },
  estilo: { label: 'Estilo', glyph: 'diamond', Component: EstiloPanel },
  datos: { label: 'Datos', glyph: 'ring', Component: DatosPanel },
};

const ORDER: EditorTab[] = ['plantillas', 'elementos', 'estilo', 'datos'];

const GLYPH_STYLE = {
  square: { borderRadius: 5, transform: 'none' },
  circle: { borderRadius: '50%', transform: 'none' },
  diamond: { borderRadius: 4, transform: 'rotate(45deg) scale(.8)' },
  ring: { borderRadius: '50%', transform: 'scale(.85)', borderStyle: 'dashed' },
} as const;

export interface SideRailProps extends PanelProps {
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
}

export default function SideRail({ tab, onTab, ...panelProps }: SideRailProps) {
  const registered = ORDER.filter((t) => PANELS[t]);
  const active = PANELS[tab] ? tab : registered[0];
  const Panel = active ? PANELS[active]!.Component : null;

  return (
    <>
      <nav className="ed-rail" aria-label="Secciones del editor">
        {registered.map((t) => {
          const def = PANELS[t]!;
          return (
            <button key={t} type="button" aria-pressed={t === active} onClick={() => onTab(t)}>
              <span className="ed-glyph" aria-hidden="true" style={GLYPH_STYLE[def.glyph]} />
              {def.label}
            </button>
          );
        })}
      </nav>
      <aside className="ed-panel">{Panel && <Panel {...panelProps} />}</aside>
    </>
  );
}
