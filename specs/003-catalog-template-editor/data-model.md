# Data Model: Editor visual de plantillas del catálogo

**Feature**: [spec.md](./spec.md) | Extiende los modelos de [001](../001-catalog-pdf-generator/data-model.md) y [002](../002-admin-panel-theming/data-model.md); solo se listan los cambios. Los datos de Alegra siguen sin almacenarse.

## Entidades persistidas

### `catalog_template` (nueva; migración `003_templates.sql`)
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | TEXT PK | Estilos base: `neon`, `pop`, `kawaii`, `kraft`. Creadas por el usuario: `t` + base 36 generado en el cliente (único) |
| `name` | TEXT NOT NULL | 1 a 60 caracteres tras recortar espacios |
| `base` | TEXT NOT NULL | `neon` \| `pop` \| `kawaii` \| `kraft`: estilo del que partió; define a qué paleta vuelve "Restaurar colores originales" |
| `position` | INTEGER NOT NULL | Orden en la galería |
| `doc_json` | TEXT NOT NULL | `TemplateDoc` serializado (abajo) |

### `template_workspace` (nueva, una fila)
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | INTEGER PK | `CHECK (id = 1)` |
| `default_template_id` | TEXT NOT NULL | Debe existir en `catalog_template` (se verifica en la transacción de guardado) |
| `revision` | INTEGER NOT NULL | Se incrementa en cada guardado de plantillas **y** en cada `PUT /settings/business`; es la marca de concurrencia (FR-027) |

- **Siembra**: sin fila en `template_workspace`, la primera lectura inserta las 4 plantillas base, `default_template_id = 'neon'` y `revision = 1`. Si `catalog_theme` tiene fila, sus colores sustituyen `bg`, `a1`, `a2`, `a3` de la paleta de `neon` (FR-021). `catalog_theme` no se modifica ni se elimina.
- Siempre existe al menos una plantilla y la predeterminada existe; no se puede borrar la predeterminada.

### `business_settings` (sin cambios de esquema)
Siguen aquí nombre de la tienda, banner (`cover_title`), teléfonos, dirección y políticas. Sin cambios de validación: banner ≤ 80, políticas ≤ 3500 caracteres en total (`invalid_business`). Ahora se escriben también desde `PUT /settings/templates`, en la misma transacción.

### `generated_catalog` (sin cambios de esquema)
`params_json` ya incluye `options`; ahora `options.templateId` queda registrado en cada generación.

## Documento de plantilla

```text
TemplateDoc  (versión 1)
├── version: 1
├── palette: Palette
├── fonts:   { title: FontKey, body: FontKey }
└── pages:   { portada: Page, seccion: Page, productos: Page, politicas: Page }

Template = { id, name, base } & TemplateDoc            // lo que ve la API

Palette  = { bg, a1, a2, a3, ink, paper }               // cada uno '#RRGGBB' (mayúsculas)
FontKey  = 'fredoka' | 'poppins' | 'bungee' | 'zen' | 'grotesk' | 'serif'
ColorRef = 'bg'|'a1'|'a2'|'a3'|'ink'|'paper' | '#RRGGBB' | 'none' | 'transparent'
ImageKey = 'logo' | 'collage' | 'marble' | 'coverbg' | 'frame'
           // etiquetas de la interfaz: Logo, Collage, Mármol, Atardecer, Marco de portada

Page = { bg: PageBg, els: Element[] }                   // els en orden de apilado (el último queda al frente)
PageBg = { type: 'color'|'gradient'|'image', image: 'marble'|'coverbg', color: ColorRef, color2: ColorRef }
```

`gradient` es vertical (de `color` arriba a `color2` abajo). `image` usa `color` como color de apoyo.

### Elemento (unión por `type`)

Campos comunes a todo elemento:

| Campo | Tipo | Rango |
| --- | --- | --- |
| `id` | string | único dentro de la página |
| `name` | string? | ≤ 60 caracteres; por defecto el nombre del tipo |
| `x`, `y`, `w`, `h` | number | % de la página; `w ≥ 3`, `h ≥ 0,3`; un elemento puede salir parcialmente de la hoja |
| `rot` | number | −180 a 180 (0 y no editable en bloques automáticos) |
| `opacity` | number | 0 a 1 |
| `visible` | boolean | los bloques automáticos siempre `true` |
| `locked` | boolean | los bloques automáticos nacen `true` |

| `type` | Campos propios |
| --- | --- |
| `text` | `text` (≤ 500), `font` (`'title'`\|`'body'`\|FontKey), `size` 8–140, `weight` 400\|600\|700\|900, `color`, `stroke` (ColorRef), `strokeW` 0–8, `glow` (ColorRef), `align` left\|center\|right, `upper`, `ls` −2 a 12 |
| `badge` | `text` (≤ 500), `fill`, `color`, `font`, `size` 8–48 |
| `shape` | `kind` rect\|circle\|pill, `fill`, `border`, `bw` 0–12, `radius` 0–80 (solo `rect`), `glow`. La «línea» de la interfaz es un `rect` con `h` de 0,3–0,6 y `radius` 0 |
| `image` | `src` ImageKey, `fit` contain\|cover, `radius` 0–300 (≥ 300 = círculo) |
| `intro` | `boxFill`, `textColor`, `radius` 0–60 · se pinta solo si la sección tiene `introText` |
| `products` | `layout` alternado\|tarjetas\|lista, `cardFill`, `ring`, `ringW` 0–10, `cardRadius` 0–80, `bubbleFill`, `bubbleRadius` 0–40, `textColor`, `priceFill`, `priceBorder`, `priceText`, `priceShape` pill\|round\|square, `sold` sello\|cinta\|gris, `soldFill` (solo `cinta`) |
| `terms` | `chipFill`, `chipText`, `boxFill`, `textColor` |
| `footer` | `content` (≤ 500, admite marcadores), `fill`, `line`, `bw` 0–6, `textColor` |

Convención: `text` es siempre un **contenido** (en `text` e `badge`); los colores de texto se llaman `color` en `text`/`badge` y `textColor` en los bloques automáticos.

### Bloques obligatorios por página (el servidor los exige al guardar)

| Página | `intro` | `products` | `terms` | `footer` |
| --- | --- | --- | --- | --- |
| `portada` | 0 | 0 | 0 | 0 |
| `seccion` | 1 | 0 | 0 | 0 |
| `productos` | 0 | 1 | 0 | 1 |
| `politicas` | 0 | 0 | 1 | 1 |

## Estructuras en memoria y de transporte

### `DataTokens` (marcadores)
`{banner}` · `{seccion}` · `{telefonos}` · `{direccion}` · `{tienda}`. Contexto de resolución: `{ banner: config.coverTitle, seccion: nombre de la sección o '', telefonos: [phone1, phone2] sin vacíos unidos con ' · ', direccion: address, tienda: storeName }`. Un marcador desconocido queda sin cambios.

### `WorkspaceState` (respuesta de `GET`/`PUT /settings/templates`)
```text
WorkspaceState
├── templates: Template[]               // en orden de galería
├── defaultId: string
├── business: BusinessSettings          // storeName, phone1, phone2, address, coverTitle, terms[]
├── revision: number
└── warnings?: { templateId, code: 'low_text_contrast' | 'low_accent_contrast', message }[]   // solo en la respuesta del PUT
```

### `TemplateSummary` (respuesta de `GET /settings/templates/summary`)
`{ id, name, isDefault, palette, fonts }[]`, para el selector de Generar y la marca de predeterminada.

### `GenerationOptions` (cambia)
```text
GenerationOptions { sectionKeys?, hideSoldOut, bannerText?, templateId? }
```
`templateId` ausente = predeterminada. Un id que ya no existe se reemplaza por la predeterminada al construir (Edge Case).

### `CatalogConfig` y `CatalogPayload` (cambian)
```text
CatalogConfig  = BusinessInfo                          // se elimina `theme`; coverTitle ya incluye bannerText
CatalogPayload = { config, template: Template, sections, terms, generatedAt }
```
`template` es la plantilla resuelta **al construir**; `GET /catalog/payload/:id` la refresca con la guardada en ese momento.

### `PanelSummary` (cambia)
`alegra` gana `syncedAt?: string` (instante de la lectura de Alegra que llenó la caché).

### Intentos de prueba de Alegra (nuevo)
`testAttempts: { limit: number, remaining: number }` en `GET /settings/alegra` y en las respuestas de `POST /settings/alegra/test`.

### Estado del editor (solo cliente, no persistido)
```text
EditorState
├── workspace: { templates, defaultId, business }     // lo que se edita
├── saved: string                                     // JSON de lo último guardado → dirty
├── activeId, page ('portada'|'seccion'|'productos'|'politicas'), selId?
├── tab ('plantillas'|'elementos'|'estilo'|'datos'), view ('editor'|'plantillas'), preview, zoom (null = ajustar)
└── past: Snapshot[] (≤ 60), future: Snapshot[]    // Snapshot = { plantilla activa, defaultId, business }; cambiar de plantilla o usar la galería (crear, duplicar, eliminar) la reinicia
```

## Reglas de validación

| Regla | Origen |
| --- | --- |
| Color de paleta y `#RRGGBB` de elementos válidos (`^#[0-9A-Fa-f]{6}$`, se normaliza a mayúsculas); `ColorRef` debe ser clave de paleta, `#RRGGBB`, `none` o `transparent`; cualquier otro valor → `422 invalid_templates` y no se escribe nada | FR-014, FR-016, FR-025 |
| Advertencias (no bloquean): `Texto`/`Papel` < 4,5; blanco/`Fondo` < 4,5; acento/`Fondo` < 3 | FR-016 |
| Rangos numéricos de las tablas anteriores; `locked`/`visible`/`rot` de bloques automáticos | FR-009, FR-011, FR-012 |
| Bloques obligatorios por página (tabla anterior); ningún bloque automático fuera de su página | FR-006 |
| Nombre de plantilla 1–60 caracteres; ≤ 30 plantillas; ≤ 60 elementos por página; textos ≤ 500 | FR-018 |
| Existe la predeterminada y está entre las plantillas guardadas; hay al menos una | FR-018 |
| `expectedRevision` distinto de `revision` guardada → `409 templates_changed` | FR-027 |
| `business`: banner 1–80, políticas ≤ 3500 caracteres en total (`422 invalid_business`) | FR-023 |
| `bannerText` > 80 → `422 invalid_options` (sin cambios) | 002 FR-007 |
| `structure.totalPages` no depende de la plantilla | FR-029, SC-010 |
| Sello/cinta/gris solo con `item.kind !== 'custom' && item.soldOut` | FR-030 |

## Transiciones de estado

- **Plantilla**: creada (desde un estilo base o duplicando) → editada (cambios locales) → guardada (con el conjunto) → predeterminada / elegida para una generación → eliminada (si no es la predeterminada).
- **Predeterminada**: cambia con "Usar al generar" o "Usar"; se guarda con el conjunto.
- **Revisión**: cada guardado correcto de plantillas o de datos del negocio la incrementa; una pestaña con una revisión anterior no puede guardar hasta recargar.
- **Generación**: `prepare` y `PUT …/options` guardan `templateId`; `generate` y `GET payload` resuelven la plantilla vigente en ese momento. `GenerationJob` (001) no cambia.
