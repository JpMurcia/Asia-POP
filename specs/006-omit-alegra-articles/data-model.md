# Modelo de datos: Omitir artículos de Alegra del catálogo

**Feature**: `006-omit-alegra-articles` | **Fecha**: 2026-10-05

Esta feature agrega **una tabla** (la única persistencia nueva) y campos aditivos en estructuras que ya existen. Los tipos se muestran como contrato de forma, no como implementación.

## Artículo omitido (nuevo, SQLite)

Migración `backend/src/db/migrations/004_omitted_items.sql`:

```sql
-- Feature 006: artículos de Alegra que la persona decidió dejar fuera del catálogo.
-- Solo local: nunca se escribe en Alegra. La clave es el identificador del artículo en Alegra.
CREATE TABLE omitted_item (
  alegra_item_id TEXT PRIMARY KEY
);
```

| Campo | Significado |
| --- | --- |
| `alegra_item_id` | Identificador del artículo en Alegra, como texto (el que ya usa `NormalizedItem.id`) |

- **Sin más columnas**: ni nombre (Alegra es la fuente de verdad del nombre), ni fecha (la spec no la usa). Ver [research.md](./research.md) §2.
- **Sin clave foránea**: un artículo de Alegra no es una fila local. Una fila cuyo artículo ya no está activo se conserva, no se muestra y no cuenta (research §3).
- **Estados**: un artículo está **incluido** (sin fila) u **omitido** (con fila). Las dos transiciones son idempotentes: omitir un omitido o incluir un incluido no cambia nada y no falla.

### `OmittedItemRepo` (`backend/src/custom/omitted-item.repo.ts`, junto a `OverrideRepo`)

```ts
class OmittedItemRepo {
  all(): Set<string>;          // todos los identificadores omitidos
  add(itemId: string): void;   // INSERT OR IGNORE
  remove(itemId: string): void;
}

// Firma estable de una lista, para detectar que cambió (FR-012): ids ordenados y unidos.
function omittedSignature(ids: Iterable<string>): string;
```

`omittedSignature` no depende del orden de inserción ni de duplicados: la misma lista da siempre la misma firma.

**Validación del identificador** (rutas): texto de 1 a 64 caracteres; otro valor responde `422 invalid_item`. No se comprueba contra Alegra (la ruta no debe depender de la conexión, y una fila de más es inofensiva).

## Entrada del constructor (`BuilderInput`, aditivo)

```ts
interface BuilderInput {
  // …lo existente…
  /** Artículos de Alegra que la persona omitió. Ausente o vacío = el comportamiento de siempre. */
  omittedIds?: Set<string>;
}
```

`LocalCatalogInputs` (de `loadLocalInputs`) gana `omittedIds: Set<string>`, así que `prepare` y el resumen de Inicio lo reciben sin cambios propios.

### Orden de las reglas por ítem en `buildCatalog`

1. Es padre de variantes → se ignora (como hoy).
2. **Está en `omittedIds` → se anota en `omittedByChoice` y se termina.** No se clasifica ni se reporta de ninguna otra forma (sin categoría, sin sección, sin foto, foto no obtenida, agotado).
3. Se resuelve su sección (categoría o asignación local) → si no tiene, `omittedNoSection`.
4. Si no tiene foto utilizable → `omittedNoImage` / `photoNotObtained`.
5. Si está agotado y se ocultan agotados → no entra; si no, entra con su indicación.

**Qué NO se filtra**: `alegraById` (los combos siguen viendo todos los ítems: un componente omitido se resuelve con su nombre y precio de Alegra, y omitirlo no lo vuelve «no disponible» ni agotado: la alerta del combo sigue dependiendo solo del stock en Alegra). Una sección que se queda sin ítems desaparece sola, porque `availableSections` ya descarta las vacías.

**Excluidos de las cuentas de fotos**: los omitidos no cuentan en `photos.informed` (y, por tanto, tampoco en `allFailed`).

## Informe de revisión (`ReviewReport`, aditivo)

```ts
interface ReviewReport {
  // …lo existente (counts.omitted conserva su significado: sin foto + sin sección)…
  /** Omitidos por decisión de la persona: todos los activos de Alegra marcados, estén o no en las secciones elegidas. */
  omittedByChoice: { itemId: string; name: string }[];
}
```

- Ordenados por nombre (misma regla `es` del resto de listas).
- Vacío cuando no hay omitidos → la pantalla no muestra el aviso (FR-008).
- **No** se suma a `counts.omitted` (research §5): el Historial y la tarjeta «Último catálogo» siguen contando solo problemas.

## Preparación (`PrepareEntry`, aditivo)

```ts
interface PrepareEntry {
  // …lo existente…
  /** Firma de la lista de omitidos con la que se construyó la revisión (FR-012). */
  omittedSignature: string;
}
```

- Se fija en `prepare` desde `omittedSignature(input.omittedIds)`.
- `generate` la compara con la firma vigente; si difieren responde `409 omitted_changed` antes de crear el trabajo.
- `setOptions` conserva la firma (las opciones se recalculan sobre la misma instantánea).

## Resumen de Inicio (`PanelSummary.stats`, aditivo)

```ts
stats: {
  products: number;       // «Productos activos en Alegra»: NO cambia al omitir
  soldOut: number;        // agotados NO omitidos
  uncategorized: number;  // omittedNoSection (ya excluye a los omitidos)
  estimatedPages: number; // del constructor
  omitted: number;        // NUEVO: omitidos que hoy están activos en Alegra
}
```

`omitted` cuenta solo artículos reales activos (sin padres de variantes) cuyo identificador está en la lista; una fila obsoleta no suma.

## Vista de la lista (`GET /api/catalog/articles`, nueva)

Un registro por artículo activo (sin padres de variantes), ordenado por nombre:

```ts
interface ArticleRow {
  itemId: string;
  name: string;
  /** `alegra:<categoría>` o la sección asignada en «Sin categoría»; null = sin sección. */
  sectionKey: string | null;
  /** Nombre de esa sección; null = «Sin categoría» en pantalla. */
  sectionName: string | null;
  price: number;          // la pantalla lo muestra con el formato de pesos ($9.000)
  soldOut: boolean;
  omitted: boolean;
  /** Nombres de los combos que usan este artículo como componente (puede estar vacío). */
  bundles: string[];
}
```

La respuesta es `{ items: ArticleRow[] }`. No incluye fotos, descripciones, direcciones de imágenes ni credenciales.

## Vista de «Sin categoría» (`GET /api/catalog/uncategorized`, aditivo)

Cada ítem gana `omitted: boolean`. `assignedSectionKey` sigue igual (la asignación de un omitido se conserva).

## Lo que no cambia

`generated_catalog` / Historial, plantillas, `CatalogDocument`, payload de la vista previa y de la vista de impresión (solo cambia **qué** artículos trae), combos, productos propios, secciones, caché de fotos y optimización del PDF de 005.
