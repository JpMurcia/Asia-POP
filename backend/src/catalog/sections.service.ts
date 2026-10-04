import { ConnectionRepo } from '../alegra/connection.repo';
import { toHttpError } from '../api/alegra-settings.routes';
import type { AppContext } from '../context';
import { SectionOrderRepo } from './settings.repo';

export interface SectionInfo {
  key: string;
  name: string;
  source: 'alegra' | 'custom';
  introText?: string | null;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

/** Lista unificada de secciones (categorías de Alegra en vivo + secciones propias) en el orden definido. */
export async function listSections(ctx: AppContext): Promise<SectionInfo[]> {
  const sections: SectionInfo[] = [];

  const client = new ConnectionRepo(ctx.db, ctx.config).client();
  if (client) {
    try {
      for (const c of await client.listCategories()) {
        sections.push({ key: `alegra:${c.id}`, name: c.name, source: 'alegra' });
      }
    } catch (e) {
      throw toHttpError(e);
    }
  }

  const custom = ctx.db.prepare('SELECT id, name, intro_text FROM section').all() as {
    id: string;
    name: string;
    intro_text: string | null;
  }[];
  for (const s of custom) {
    sections.push({ key: `custom:${s.id}`, name: s.name, source: 'custom', introText: s.intro_text });
  }

  const position = new Map(new SectionOrderRepo(ctx.db).get().map((k, i) => [k, i]));
  return sections.sort((a, b) => {
    const pa = position.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const pb = position.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    return pa !== pb ? pa - pb : byName(a, b);
  });
}
