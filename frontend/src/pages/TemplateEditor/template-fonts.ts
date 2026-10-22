import { FONT_KEYS, FONT_LABELS, type FontKey, type FontRef, type Template } from '../../../../backend/src/catalog/template';
import { foldText } from './template-colors';

/** Opciones del selector de fuente (feature 009), calculadas al abrirlo; no se guarda nada. */
export interface FontOption {
  /** Lo que se guardaría: `title`, `body` o la familia. */
  value: FontRef;
  /** «Título · Fredoka», «Cuerpo · Poppins» o el nombre de la familia. */
  label: string;
  /** La familia con que se dibuja el nombre de la opción. */
  family: FontKey;
  group: 'plantilla' | 'todas';
}

/** Las familias que usan los textos y las insignias de cualquier página, sin repetir y en orden de primer uso. */
export function usedFonts(template: Pick<Template, 'pages'>): FontKey[] {
  const found: FontKey[] = [];
  for (const page of Object.values(template.pages)) {
    for (const el of page.els) {
      if ((el.type === 'text' || el.type === 'badge') && (FONT_KEYS as readonly string[]).includes(el.font) && !found.includes(el.font as FontKey)) {
        found.push(el.font as FontKey);
      }
    }
  }
  return found;
}

/** «Fuentes de la plantilla» (título, cuerpo y las usadas) seguidas de «Todas las fuentes» (las seis de siempre). */
export function fontChoices(template: Pick<Template, 'fonts' | 'pages'>): FontOption[] {
  return [
    { value: 'title', label: `Título · ${FONT_LABELS[template.fonts.title]}`, family: template.fonts.title, group: 'plantilla' },
    { value: 'body', label: `Cuerpo · ${FONT_LABELS[template.fonts.body]}`, family: template.fonts.body, group: 'plantilla' },
    ...usedFonts(template).map((k): FontOption => ({ value: k, label: FONT_LABELS[k], family: k, group: 'plantilla' })),
    ...FONT_KEYS.map((k): FontOption => ({ value: k, label: FONT_LABELS[k], family: k, group: 'todas' })),
  ];
}

export function searchFonts(options: readonly FontOption[], query: string): FontOption[] {
  const q = foldText(query);
  return q ? options.filter((o) => foldText(o.label).includes(q)) : [...options];
}
