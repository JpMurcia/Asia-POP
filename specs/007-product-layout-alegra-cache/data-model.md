# Modelo de datos: Productos del catálogo más claros y datos de Alegra guardados

**Feature**: `007-product-layout-alegra-cache` | **Fecha**: 2026-10-10

Esta feature agrega **una tabla** (la copia local de Alegra), **seis campos** al bloque de productos de una plantilla y **tres formas** de respuesta (estado de los datos, textos que no caben, aviso de error de la última actualización). No cambia `CatalogDocument`, `CatalogPayload`, `ReviewReport`, el historial, los productos propios, las secciones, los combos ni la lista de omitidos.

## 1. Copia local de los datos de Alegra (tabla nueva)

Migración `backend/src/db/migrations/005_alegra_data.sql`.

```text
alegra_snapshot
  id             INTEGER PRIMARY KEY CHECK (id = 1)   -- una sola fila
  account_email  TEXT    NOT NULL                     -- cuenta a la que pertenecen los datos (minúsculas)
  synced_at      TEXT    NOT NULL                     -- ISO 8601: cuándo terminó la descarga
  format         INTEGER NOT NULL                     -- versión del contenido de los JSON
  items_json     TEXT    NOT NULL                     -- SnapshotItem[]
  categories_json TEXT   NOT NULL                     -- SnapshotCategory[]
```

- Una descarga **reemplaza** la fila entera en una sentencia (`INSERT … ON CONFLICT(id) DO UPDATE`): nunca queda una copia a medias (FR-021).
- No guarda credenciales, direcciones de fotos ni nada de los productos propios (principios I y III). Vive en `data/app.db`, fuera de git.
- **Formato**: `SNAPSHOT_FORMAT = 1`. Si el número guardado no coincide con el del código, la copia se trata como ausente y se descarga de nuevo la próxima vez que se necesite (un cambio futuro de campos no requiere una migración de datos).

### `SnapshotItem`

| Campo | Tipo | Origen (`mapAlegraItem`) |
| --- | --- | --- |
| `id` | texto | `id` |
| `name` | texto | `name` |
| `description` | texto | `description` |
| `price` | número | `price` |
| `soldOut` | booleano | `soldOut` (regla de stock de 001, sin cambios) |
| `categoryId` | texto o `null` | `categoryId` |
| `categoryName` | texto o `null` | `categoryName` |
| `type` | texto | `type` |
| `hasPhoto` | booleano | `imageUrls.length > 0` (la dirección **no** se guarda) |

Al leer, se vuelve a `NormalizedItem` con `remoteImageUrl = hasPhoto ? 'snapshot:photo' : null` y sin `imageUrls`. Esa marca solo la usa el resumen de Inicio, que supone «con foto» a todo ítem con dirección (comportamiento actual) y nunca la dibuja.

### `SnapshotCategory`

| Campo | Tipo |
| --- | --- |
| `id` | texto |
| `name` | texto |

## 2. Estado de los datos (respuesta, no se guarda)

`GET /api/alegra/data` y `POST /api/alegra/data/refresh` devuelven:

```ts
interface AlegraDataStatus {
  /** `none`: sin copia (nunca descargada o descartada); `ready`: hay copia; `syncing`: descargando ahora. */
  state: 'none' | 'ready' | 'syncing';
  /** Instante (ISO 8601) de la copia vigente; `null` si no hay. Durante `syncing` sigue siendo el de la copia anterior. */
  syncedAt: string | null;
  articles: number | null;     // artículos activos de la copia (sin padres de variantes)
  categories: number | null;
  /** Solo con `syncing`: lo recibido hasta ahora. Alegra no informa el total, así que no hay porcentaje. */
  progress: { phase: 'categories' | 'items'; received: number } | null;
  /** Último intento fallido que aún no se superó con una descarga buena (memoria; se pierde al reiniciar). */
  lastError: { message: string; at: string } | null;
}
```

### Transiciones

```text
none ──(PUT /settings/alegra | primera lectura | refresh)──▶ syncing ──ok──▶ ready
                                                                 └─falla, sin copia──▶ none  (+ lastError)
ready ──(refresh | prepare)──▶ syncing ──ok──▶ ready  (copia reemplazada, lastError = null)
                                    └─falla──▶ ready  (copia anterior intacta, + lastError)
ready ──(otra cuenta | formato distinto)──▶ none
```

- Solo hay **una** descarga a la vez: una segunda petición recibe el estado de la primera (FR-021).
- `prepare` hace su propia descarga (necesita las fotos); si termina bien, guarda su resultado con `store()` y el estado pasa a `ready`.
- `lastError` se limpia con cualquier descarga correcta y no se persiste.

## 3. Bloque de productos de una plantilla (campos nuevos)

`ProductsEl` (en `backend/src/catalog/template.ts`) gana **seis** campos. Todos son obligatorios en el documento; las plantillas ya guardadas se completan al leerlas (§4).

| Campo | Tipo | Rango / valores | Neón Noche | Pop crema, Kawaii, Kraft |
| --- | --- | --- | --- | --- |
| `photoW` | número | 50 a 150 (% del ancho original de la foto) | 100 | 100 |
| `photoH` | número | 50 a 150 (% del alto original de la foto) | 100 | 100 |
| `nameStyle` | `'separado'` \| `'burbuja'` | | `separado` | `burbuja` |
| `nameColor` | `ColorRef` | clave de paleta, `#RRGGBB`, `none` o `transparent` | `a1` | `a1` |
| `nameFill` | `ColorRef` | ídem | `bg` (rótulo oscuro) | `transparent` |
| `nameGlow` | booleano | | `true` | `false` |

Constantes nuevas en `template.ts`:

- `RANGES.photoScale = [50, 150]`.
- `PRODUCTS_ZONE_MIN = { w: 40, h: 30 }` (% de la página): tamaño mínimo de **la zona** (`w`, `h` del bloque de productos); el esquema lo exige solo a `products`. El rango genérico de `w`/`h` de los demás elementos no cambia.

### Reglas de validación (servidor, `PUT /api/settings/templates`)

- `photoW` y `photoH` dentro de `RANGES.photoScale`, con mensaje «El ancho de la foto: el mínimo es 50.» (mismo formato que los demás).
- `nameStyle` en los dos valores; `nameColor` y `nameFill` con `isColorRef`; `nameGlow` booleano.
- Un bloque de productos con `w < 40` o `h < 30` se rechaza con «La zona de productos debe medir al menos 40 % de ancho y 30 % de alto.»
- El resto del esquema (bloques obligatorios por página, límites, colores) no cambia. `_SchemaMatchesTemplate` (la comprobación de que el esquema produce el tipo `Template`) sigue vigente.

### Geometría (`template-layout.ts`, módulo puro)

```ts
interface RowLayout {
  photo: Rect; bubble: Rect; price: Rect;
  /** Rótulo del nombre; ausente con `nameStyle: 'burbuja'`. */
  name?: Rect;
  align: 'center' | 'left';
  separatorY?: number;
}

interface RowOptions { photoW?: number; photoH?: number; nameStyle?: 'separado' | 'burbuja' }   // valores por defecto 100, 100, 'burbuja'

layoutRows(layout, W, H, opts?: RowOptions): RowLayout[]                         // opts ausente = la geometría de hoy
photoScaleLimits(layout, W, H, opts?: RowOptions): { w: [number, number]; h: [number, number] }
```

- Con `opts` ausente o `{ photoW: 100, photoH: 100, nameStyle: 'burbuja' }`, el resultado es **idéntico** al actual (la prueba `layout-rows.test.ts` existente lo exige).
- `layoutRows` recorta las escalas a `photoScaleLimits`; las filas siempre quedan dentro de la caja y sin encimarse (con 1, 2 y 3 productos).
- Con la foto más pequeña, las tres filas se reparten el alto de la zona y cada foto queda centrada en su franja; la columna de texto conserva su tamaño y se centra contra la foto.
- `photoScaleLimits(...).w[0]` y `.h[0]` valen siempre 50; el máximo depende de la distribución y de la zona (en `alternado` con la zona de hoy, el alto máximo es ≈ 100 %).

## 4. Normalización de plantillas ya guardadas

`TemplateRepo.toTemplate` (lectura) completa los campos que falten en cada bloque de productos:

| Plantilla | `photoW` / `photoH` | `nameStyle` | `nameColor` | `nameFill` | `nameGlow` |
| --- | --- | --- | --- | --- | --- |
| id `neon` | 100 / 100 | `separado` | `a1` | `bg` | `true` |
| cualquier otra | 100 / 100 | `burbuja` | `a1` | `transparent` | `false` |

- Es **idempotente** y no escribe: lo guardado cambia solo cuando la persona pulsa Guardar en Apariencia (la plantilla ya completa pasa la validación nueva).
- Los campos presentes **no se tocan** (una plantilla ya guardada con la feature no se vuelve a normalizar).
- Una plantilla nueva creada desde un estilo base toma los valores de ese estilo en `template-presets.ts` (Neón Noche: `separado`; las demás: `burbuja`).

## 5. Textos que no caben (respuesta del trabajo, no se guarda)

```ts
interface TextOverflow {
  /** Nombre del producto afectado (ya está en el catálogo que se generó). */
  item: string;
  /** Qué texto no cupo completo. */
  part: 'name' | 'bubble';
}
```

- La vista `Print` llena `window.__printTextOverflow: TextOverflow[]` (sin repetir un mismo producto y parte) con todo lo marcado `data-clipped` o `data-overflow`.
- `JobState` gana `textOverflow?: TextOverflow[]`, **solo** en `done` y solo si hay alguno. El historial no lo guarda.

## 6. Resumen de Inicio (cambios aditivos)

`PanelSummary.alegra` gana un campo opcional:

| Campo | Cuándo |
| --- | --- |
| `syncError?: string` | Con `status: 'ok'`, si la última actualización falló y se muestran los datos guardados |

- `syncedAt` pasa a ser el de la **copia** (cuándo se descargó), no el de una caché de 60 s.
- `status: 'unreachable'` solo ocurre ahora si **no hay copia** y Alegra no responde al descargarla.
- Los demás campos (`stats`, `sections`, `lastCatalog`, `generatedAt`) no cambian.

## 7. Lo que no cambia

`generated_catalog` y el historial · `category_override` · `omitted_item` · secciones, productos propios y combos · `alegra_connection` (solo se lee el correo anterior para decidir si se descarta la copia) · `CatalogDocument`, portadas, pie, políticas · calidad del PDF y fotos reducidas · caché de fotos (`data/image-cache/`).
