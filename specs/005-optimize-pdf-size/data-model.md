# Modelo de datos: PDF del catálogo liviano para enviar

**Feature**: `005-optimize-pdf-size` | **Fecha**: 2026-10-04

Esta feature **no cambia el esquema de SQLite ni agrega tablas**. Añade un tipo compartido, una carpeta temporal en disco y campos aditivos en estructuras que ya existen. Los tipos se muestran como contrato de forma, no como implementación.

## Calidad del PDF (nuevo, módulo puro `catalog/pdf-quality.ts`)

```ts
type PdfQuality = 'optimized' | 'original';
const DEFAULT_PDF_QUALITY: PdfQuality = 'optimized';        // FR-002
const PDF_TARGET_BYTES = 25 * 1024 * 1024;                  // FR-003: el «tamaño objetivo»
```

| Valor | Etiqueta en pantalla | Qué hace |
| --- | --- | --- |
| `optimized` | Optimizada (recomendada) | Prepara copias reducidas de las fotos y el PDF las incrusta |
| `original` | Original | No toca las fotos: el PDF es el de hoy (FR-009) |

El módulo también exporta los textos de ayuda de cada valor (ver [contracts/generate-ui.md](./contracts/generate-ui.md)), `formatMegabytes(bytes)` (`18,4 MB`) y `exceedsTarget(bytes)`. «MB» son 1.048.576 bytes.

**Validación**: el valor viene de una lista cerrada; cualquier otro se rechaza con el error de validación existente. Si falta, es `optimized`. No se guarda como ajuste del sistema ni de la plantilla: es parámetro de una sola generación.

## Resolución objetivo (nuevo, módulo puro `pdf/photo-target.ts`)

```ts
const PDF_PPP = 150;                                        // FR-004
interface PhotoTarget { w: number; h: number }              // píxeles que debe cubrir la foto

photoTarget(template: Template): PhotoTarget | null         // null si la plantilla no tiene bloque de productos
```

- **Entrada**: la plantilla de la generación. Se recorren los bloques `type: 'products'` de la página `productos`; para cada uno se calculan las medidas de sus tres recuadros de foto con `layoutRows(layout, w, h)` (con `w` y `h` del bloque en unidades lógicas) y se toma el **mayor ancho** y el **mayor alto** de todos.
- **Conversión**: `píxeles = ceil(unidades × PDF_PPP / 72)`, porque 1 unidad lógica = 1/72 de pulgada (595,28 unidades = 210 mm).
- **Valores calculados con el código real** (plantillas base de fábrica, mayor recuadro de foto de cada una): Neón Noche (`alternado`) 172,6 × 227,3 unidades → **360 × 474 px**; Pop crema (`alternado`) 158,8 × 213,4 → **331 × 445 px**; Kawaii (`tarjetas`) 167,9 × 193,1 → **350 × 403 px**; Kraft minimal (`lista`) 148,2 × 148,2 → **309 × 309 px**.
- Con `null` no hay nada que reducir: todas las fotos se usan tal cual.

## Copia reducida de una foto (nuevo, `pdf/image-optimizer.ts`)

Resultado de procesar **una** foto local; vive solo durante la generación.

```ts
interface OptimizedPhoto { buffer: Buffer; ext: 'jpg' | 'png' }
optimizePhoto(source: Buffer, target: PhotoTarget): Promise<OptimizedPhoto | null>   // null = usar el original
```

| Regla | Efecto |
| --- | --- |
| Se aplica la orientación EXIF y se escala hasta **cubrir** `target` sin recortar | Mismo encuadre que Original: el recorte lo sigue haciendo la página |
| **Nunca se agranda** una foto menor que `target` | FR-004 (la propia resolución si es menor) |
| Sin transparencia, o con canal alfa totalmente opaco → **JPEG** calidad 88, submuestreo 4:4:4 | Research §5 |
| Con transparencia real → **PNG** reducido con su transparencia | FR-006 |
| Si el resultado pesa **igual o más** que el original → `null` | FR-007 |
| Cualquier error (archivo dañado, formato no legible) → `null`, sin lanzar | FR-008 |
| GIF animado → su primer cuadro (o `null` si no se puede) | Igual que hoy |

`PhotoOptimizer` (misma carpeta) recibe la lista de direcciones locales de las fotos del payload, procesa en paralelo con concurrencia limitada y devuelve el mapa de abajo. Reporta el avance (`hechas`, `total`) para la barra de progreso.

## Mapa de copias (nuevo, en memoria, módulo puro `pdf/photo-variants.ts`)

```ts
type PhotoVariants = Map<string, string>;   // dirección local original → dirección local de la copia

collectPhotoUrls(payload: CatalogPayload): string[]                       // las imageUrl locales, sin repetir
withPhotoVariants(payload: CatalogPayload, v: PhotoVariants): CatalogPayload   // copia nueva, sin mutar
```

- Las direcciones que **sí** se procesan son las locales: `/media/cache/<archivo>` (fotos de Alegra descargadas) y `/media/uploads/<archivo>` (productos propios y combos). Cualquier otra se deja igual.
- `withPhotoVariants` solo reemplaza `imageUrl` en cada ítem de `sections[].pages[][]`; el resto del payload (plantilla, textos, precios, `soldOut`, secciones, términos) queda idéntico (FR-005).
- La dirección de una copia tiene la forma `/media/pdf/<trabajo>/<nombre>.<jpg|png>`, con un nombre derivado del hash de la dirección original.

## Archivos temporales (nuevo, en disco)

```text
data/pdf-photos/<trabajo>/<hash>.jpg | .png     # copias reducidas de UNA generación
```

- **Ciclo de vida**: se crea al empezar la preparación de copias; se borra en el bloque `finally` del render (éxito o error) y la carpeta raíz se vacía al crear el contexto de la aplicación (restos de un cierre brusco). No hay otra limpieza ni caché entre generaciones (research §6).
- Solo hay un trabajo a la vez (regla de 001), así que no hay carreras entre carpetas.
- `data/` ya está ignorado por git.

## Estructuras existentes que ganan campos (todos opcionales o aditivos)

### Preparación (`PrepareEntry`, en memoria)

| Campo nuevo | Tipo | Detalle |
| --- | --- | --- |
| `variants` | `PhotoVariants \| undefined` | Solo existe mientras se renderiza; lo usa el endpoint de datos con `?quality=optimized`. Se elimina al terminar el trabajo |

### Trabajo (`JobState`, en memoria; lo devuelve `GET /catalog/jobs/current`)

| Campo nuevo | Tipo | Detalle |
| --- | --- | --- |
| `sizeBytes` | `number?` | Solo en `done`: la longitud del PDF generado (FR-011) |
| `quality` | `PdfQuality?` | Solo en `done`: la calidad con la que se generó; la pantalla la usa para decidir si avisa (FR-012) |

**Pasos del trabajo** (`step`): se añade «Optimizando fotos» antes de «Renderizando páginas», solo en calidad Optimizada. El avance de las copias ocupa de 5 a 30 %; el resto de los porcentajes no cambia.

### Entrada del historial (`HistoryEntry`; lo devuelve `GET /catalog/history`)

| Campo nuevo | Tipo | Detalle |
| --- | --- | --- |
| `sizeBytes` | `number?` | Se lee del archivo guardado (`stat`); **ausente** si el archivo ya no existe o no se puede leer (FR-011: se muestra «—») |

- Al agregar una entrada, el tamaño es la longitud del PDF recién guardado.
- La calidad usada se guarda además dentro de `params_json` (junto a `options`, `decisions` y `pages`) para quien la consulte después; **no** se expone en la API (no se pidió mostrarla).

## Lo que NO cambia

- Las tablas `generated_catalog` y demás, y el `params_json` conserva sus claves actuales (solo suma `quality`).
- `GenerationOptions` y `POST /catalog/prepare` / `PUT .../options`: la calidad no es una opción de la preparación (FR-001: no obliga a preparar de nuevo ni cambia la revisión).
- `CatalogPayload`, `ReviewReport`, plantillas y `CatalogDocument`.
- Las copias descargadas de `data/image-cache/` y las subidas de `data/uploads/`: solo se leen (FR-010).
