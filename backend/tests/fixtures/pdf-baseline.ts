/**
 * Comprobación de no regresión de las plantillas base (feature 010, FR-022, SC-004): los PDF de las 4 plantillas
 * existentes, con textos normales y máximos (8 PDF), deben ser idénticos byte a byte a los de antes de la feature.
 * No es una prueba automática (cada PDF tarda ~1 min); se corre a mano:
 *
 *   # 1. Con el código de ANTES (p. ej. `git worktree add <ruta> <commit>` + `npm run build -w frontend`):
 *   BASELINE_DIR=<carpeta> npx tsx backend/tests/fixtures/pdf-baseline.ts capture
 *   # 2. Con el código de AHORA (frontend compilado):
 *   BASELINE_DIR=<carpeta> npx tsx backend/tests/fixtures/pdf-baseline.ts compare
 *
 * Los PDF de Chrome traen fecha de creación y un identificador distintos en cada corrida; se anulan antes de comparar
 * (dos corridas del mismo código difieren solo en esos bytes). La línea base de la feature 007 ya no sirve para esto:
 * es anterior a la feature 005 y sus tamaños no coinciden con el código actual.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMPLATES = ['neon', 'pop', 'kawaii', 'kraft'] as const;
const mode = process.argv[2];
const dir = process.env.BASELINE_DIR ?? path.join(os.tmpdir(), 'asiapop-baseline-010');
if (mode !== 'capture' && mode !== 'compare') throw new Error('Uso: pdf-baseline.ts capture|compare');
fs.mkdirSync(dir, { recursive: true });

/** Anula los metadatos que cambian en cada corrida, conservando el largo del archivo. */
function normalize(pdf: Buffer): Buffer {
  const blank = (m: string) => m.replace(/[^()[\]<>/ ]/g, '0');
  const text = pdf
    .toString('latin1')
    .replace(/\/(?:CreationDate|ModDate) ?\([^)]*\)/g, blank)
    .replace(/\/ID ?\[[^\]]*\]/g, blank);
  return Buffer.from(text, 'latin1');
}

const sample = path.join(import.meta.dirname, 'visual-sample.ts');
let differences = 0;
for (const template of TEMPLATES) {
  for (const long of [0, 1]) {
    const name = long ? `${template}-long` : template;
    const target = path.join(dir, `${name}.pdf`);
    const file = mode === 'capture' ? target : path.join(dir, `${name}.actual.pdf`);
    execSync(`npx tsx "${sample}"`, {
      stdio: 'pipe',
      env: { ...process.env, OUT: path.join(os.tmpdir(), `asiapop-baseline-png-${name}`), PDF: file, TEMPLATE: template, LONG: String(long) },
    });
    if (mode === 'compare') {
      const same = normalize(fs.readFileSync(file)).equals(normalize(fs.readFileSync(target)));
      if (!same) differences++;
      console.log(`${same ? 'idéntico ' : 'DIFERENTE'} ${name}`);
    } else {
      console.log(`guardado  ${name} (${fs.statSync(file).size} bytes)`);
    }
  }
}
if (mode === 'compare') {
  console.log(differences === 0 ? 'Sin diferencias.' : `${differences} PDF difieren de la línea base.`);
  process.exit(differences === 0 ? 0 : 1);
}
