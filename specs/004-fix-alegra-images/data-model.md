# Data Model: Fotos de productos de Alegra en el catálogo

**Feature**: `004-fix-alegra-images` | **Date**: 2026-10-04

Sin tablas ni migraciones nuevas. Todo es forma de datos en memoria, más los archivos de `data/image-cache/`. Los tipos viven en `backend/src/` y el frontend importa los puros, como en 003.

## Entidades

### AlegraImageRaw (respuesta de Alegra, `backend/src/alegra/alegra.types.ts`)

Elemento del arreglo `images` de un ítem. Forma real verificada el 4-oct-2026; ver [contracts/alegra-item-photos.md](./contracts/alegra-item-photos.md).

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | número o texto, opcional | Identificador de la foto |
| `name` | texto, opcional | Nombre del archivo |
| `url` | texto, opcional | Dirección https firmada del CDN. Se aceptan también `link` y `src` (tolerancia previa) |
| `favorite` | booleano, opcional | Marca de foto principal. **No existe `isPrimary`** |

`AlegraItemRaw.images` pasa a `Array<string | AlegraImageRaw> | null`: un texto suelto sigue siendo válido (lo usan las pruebas actuales).

### NormalizedItem (`backend/src/alegra/alegra.mapper.ts`) — campo nuevo

| Campo | Tipo | Notas |
| --- | --- | --- |
| `remoteImageUrl` | texto o `null` | **Sin cambios**: la foto elegida (la primera candidata) |
| `imageUrls` | lista de texto, opcional | **Nuevo.** Todas las candidatas en orden de preferencia: favoritas primero, luego el resto; solo `http`/`https`; sin duplicados. Ausente = solo `remoteImageUrl` |

Es opcional para no romper los ítems armados a mano en las pruebas existentes.

### PhotoFailureReason (`backend/src/catalog/types.ts`)

`'unauthorized' | 'not_found' | 'timeout' | 'not_image' | 'unsupported_format' | 'too_large' | 'unavailable'`

| Código | Cuándo | Texto para el responsable (`photo-reasons.ts`) |
| --- | --- | --- |
| `unauthorized` | HTTP 401 o 403 | Alegra rechazó el acceso a la foto o su enlace venció |
| `not_found` | HTTP 404 o 410 | La foto ya no existe en Alegra |
| `timeout` | Pasaron 10 s sin terminar la descarga | La foto tardó demasiado en descargarse |
| `not_image` | Los bytes no son una imagen, o el cuerpo está vacío | El archivo de la foto no es una imagen |
| `unsupported_format` | Declara `image/*` pero no es JPG, PNG, WebP ni GIF | Formato de foto no admitido (usa JPG, PNG, WebP o GIF) |
| `too_large` | `content-length` o cuerpo > 10 MB | La foto pesa más de 10 MB |
| `unavailable` | Otro HTTP no exitoso (p. ej. 5xx) o error de red | El servidor de la foto no respondió |

### DownloadResult y PhotoOutcome (`backend/src/pdf/image-cache.ts`)

```text
DownloadResult = { ok: true,  url: string }                 // url local: /media/cache/<hash>.<jpg|png|webp|gif>
               | { ok: false, reason: PhotoFailureReason }

PhotoOutcome   = { status: 'ok',     url: string }          // alguna candidata sirvió
               | { status: 'none' }                         // el producto no trae ninguna dirección de foto
               | { status: 'failed', reason: PhotoFailureReason } // trae fotos, ninguna sirvió; motivo de la primera candidata
```

### Entrada nueva del constructor (`BuilderInput`)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `photoFailures` | `Map<itemId, PhotoFailureReason>`, opcional | Productos con foto informada que no se obtuvo. Ausente = ninguno (el panel de Inicio y las pruebas actuales no lo pasan) |

`localImages` conserva su forma (`Map<itemId, string | null>`): `ok` → URL local, `none` y `failed` → `null`.

### ReviewReport.photos (`backend/src/catalog/types.ts`) — campo nuevo

| Campo | Tipo | Significado |
| --- | --- | --- |
| `informed` | entero | Productos activos (sin padres de variantes) para los que Alegra informó al menos una foto |
| `obtained` | entero | De esos, los que tienen una copia local utilizable |
| `notObtained` | lista de `{ id, name, reason }` | Productos con foto informada y no obtenida, **solo de las secciones seleccionadas** (igual que `omittedNoImage`) |
| `allFailed` | booleano | `informed > 0` y `obtained === 0` (FR-008); se calcula sobre todos los productos, no solo los de las secciones seleccionadas |

`ReviewReport.omittedNoImage`, `counts` y el resto **no cambian**.

## Reglas de validación y de negocio

1. **Candidatas** (FR-003, FR-004): `favorite === true` primero, luego el resto, cada grupo en su orden; solo `http`/`https`; sin duplicados. Se prueban en orden hasta que una sirva.
2. **Foto aceptada** (FR-005, FR-006): los primeros bytes la identifican como JPG, PNG, WebP o GIF; pesa entre 1 byte y 10 MB; la descarga termina en 10 s. El tipo `Content-Type` declarado no cuenta.
3. **Foto sin servir**: se descarta sin dejar archivos a medias en `data/image-cache/` y no detiene el resto de las descargas.
4. **Producto sin foto utilizable** (FR-009): queda fuera del PDF y en `omittedNoImage`, con o sin motivo; **nunca** se dibuja una imagen de respaldo.
5. **Motivo de un producto**: el de su primera candidata (la favorita).
6. **Variantes**: los padres (`variantParent`) se siguen ignorando y no cuentan en `informed`; una variante sin foto propia no hereda la del padre (fuera de alcance).
7. **Sin credenciales ni URLs firmadas** (FR-007): el informe lleva el nombre del producto y el código de motivo; nunca la dirección de la foto.
8. **Nombre y vida de la copia local** (`data/image-cache/`): `<sha1>.<ext>`, donde el hash es el de la dirección **sin** `Expires`, `Signature` ni `Key-Pair-Id` (cambian en cada listado); el resto de la consulta cuenta. Se reutiliza si tiene menos de 1 h; al terminar `downloadAll`, `prune()` borra las copias y `.part` con más de 24 h sin renovarse y no toca archivos con otro nombre. Un fallo al borrar no afecta a la preparación. Ver [research.md](./research.md) §10.

## Estados de la foto de un producto

```text
sin direcciones ───────────────────────────────▶ none    ─▶ omittedNoImage
con direcciones ─▶ probar candidata 1..n ─┬─ alguna sirve ─▶ ok      ─▶ entra al catálogo
                                          └─ ninguna sirve ─▶ failed ─▶ omittedNoImage + photos.notObtained
```

Invariantes:

- `photos.notObtained ⊆ omittedNoImage` (origen `alegra`); por eso `counts.omitted` no cambia.
- `0 ≤ obtained ≤ informed`.
- `allFailed ⇔ informed > 0 ∧ obtained = 0`.

## Señal de la página de impresión (frontend → renderer)

| Variable | Tipo | Significado |
| --- | --- | --- |
| `window.__printReady` | booleano | Ya existe: la página terminó de cargar fotos y fuentes |
| `window.__printBrokenImages` | entero | **Nuevo.** Cantidad de `img.pb-img` que terminaron sin cargar (`complete && naturalWidth === 0`). Si es > 0, el renderer aborta la generación |
