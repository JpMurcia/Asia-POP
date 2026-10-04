import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '../db/database';

export const HISTORY_LIMIT = 10;

export interface HistoryEntry {
  id: string;
  createdAt: string;
  includedCount: number;
  omittedCount: number;
  /** Páginas del PDF (guardadas en `params_json` desde la feature 002); ausente en catálogos anteriores. */
  pages?: number;
}

interface Row {
  id: string;
  created_at: string;
  file_path: string;
  included_count: number;
  omitted_count: number;
  params_json: string;
}

function pagesOf(paramsJson: string): number | undefined {
  try {
    const pages = (JSON.parse(paramsJson) as { pages?: unknown }).pages;
    return typeof pages === 'number' ? pages : undefined;
  } catch {
    return undefined;
  }
}

export class HistoryRepo {
  constructor(
    private db: Db,
    private outputDir: string,
  ) {}

  /** Guarda el PDF en disco y lo registra; conserva solo los más recientes (FR-032). */
  add(pdf: Buffer, included: number, omitted: number, params: unknown, now = new Date()): HistoryEntry {
    fs.mkdirSync(this.outputDir, { recursive: true });
    const id = crypto.randomUUID();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const file = path.join(this.outputDir, `catalogo-${stamp}-${id.slice(0, 8)}.pdf`);
    fs.writeFileSync(file, pdf);
    this.db
      .prepare(
        `INSERT INTO generated_catalog (id, created_at, file_path, included_count, omitted_count, params_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, now.toISOString(), file, included, omitted, JSON.stringify(params));
    this.prune();
    return {
      id,
      createdAt: now.toISOString(),
      includedCount: included,
      omittedCount: omitted,
      pages: pagesOf(JSON.stringify(params)),
    };
  }

  list(): HistoryEntry[] {
    return (
      this.db
        .prepare('SELECT * FROM generated_catalog ORDER BY created_at DESC LIMIT ?')
        .all(HISTORY_LIMIT) as Row[]
    ).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      includedCount: r.included_count,
      omittedCount: r.omitted_count,
      pages: pagesOf(r.params_json),
    }));
  }

  filePath(id: string): string | null {
    const row = this.db.prepare('SELECT file_path FROM generated_catalog WHERE id = ?').get(id) as
      | { file_path: string }
      | undefined;
    return row && fs.existsSync(row.file_path) ? row.file_path : null;
  }

  private prune(): void {
    const old = this.db
      .prepare(
        `SELECT id, file_path FROM generated_catalog WHERE id NOT IN
         (SELECT id FROM generated_catalog ORDER BY created_at DESC LIMIT ?)`,
      )
      .all(HISTORY_LIMIT) as { id: string; file_path: string }[];
    for (const o of old) {
      fs.rmSync(o.file_path, { force: true });
      this.db.prepare('DELETE FROM generated_catalog WHERE id = ?').run(o.id);
    }
  }
}
