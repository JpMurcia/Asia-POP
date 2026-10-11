import type { Db } from '../db/database';
import type { SnapshotItem } from './alegra.mapper';

/** Versión del contenido de los JSON. Si el guardado no coincide, la copia se trata como ausente y se descarga de nuevo. */
export const SNAPSHOT_FORMAT = 1;

export interface SnapshotCategory {
  id: string;
  name: string;
}

/** La copia local de Alegra tal como se guarda: cuenta, instante de la descarga, artículos y categorías. */
export interface AlegraSnapshot {
  /** Correo de la cuenta de Alegra a la que pertenecen los datos, en minúsculas. */
  accountEmail: string;
  /** Instante (ISO 8601) en que terminó la descarga. */
  syncedAt: string;
  items: SnapshotItem[];
  categories: SnapshotCategory[];
}

interface Row {
  account_email: string;
  synced_at: string;
  format: number;
  items_json: string;
  categories_json: string;
}

/**
 * La copia local de lo que Alegra devuelve (tabla `alegra_snapshot`, una sola fila). No decide cuándo descargar: eso lo
 * hace `AlegraDataService`. Una descarga reemplaza la fila entera en una sentencia, así que nunca queda una copia a
 * medias (FR-021).
 */
export class AlegraDataRepo {
  constructor(private db: Db) {}

  /** La copia, o `null` si no hay, si su formato no es el del código o si su contenido está dañado. */
  read(): AlegraSnapshot | null {
    const row = this.db.prepare('SELECT * FROM alegra_snapshot WHERE id = 1').get() as Row | undefined;
    if (!row || row.format !== SNAPSHOT_FORMAT) return null;
    try {
      return {
        accountEmail: row.account_email,
        syncedAt: row.synced_at,
        items: JSON.parse(row.items_json) as SnapshotItem[],
        categories: JSON.parse(row.categories_json) as SnapshotCategory[],
      };
    } catch {
      return null;
    }
  }

  replace(snapshot: AlegraSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO alegra_snapshot (id, account_email, synced_at, format, items_json, categories_json)
         VALUES (1, @accountEmail, @syncedAt, @format, @items, @categories)
         ON CONFLICT(id) DO UPDATE SET account_email = excluded.account_email, synced_at = excluded.synced_at,
           format = excluded.format, items_json = excluded.items_json, categories_json = excluded.categories_json`,
      )
      .run({
        accountEmail: snapshot.accountEmail,
        syncedAt: snapshot.syncedAt,
        format: SNAPSHOT_FORMAT,
        items: JSON.stringify(snapshot.items),
        categories: JSON.stringify(snapshot.categories),
      });
  }

  clear(): void {
    this.db.prepare('DELETE FROM alegra_snapshot WHERE id = 1').run();
  }
}
