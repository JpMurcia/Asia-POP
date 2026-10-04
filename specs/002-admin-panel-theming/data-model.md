# Data Model: Panel de administración y personalización del catálogo

**Feature**: [spec.md](./spec.md) | Extiende el [modelo de 001](../001-catalog-pdf-generator/data-model.md); solo se listan los cambios. Los datos de Alegra siguen sin almacenarse.

## Entidades persistidas

### `catalog_theme` (nueva, una fila; migración `002_theme.sql`)
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `id` | INTEGER PK | `CHECK (id = 1)` |
| `background` | TEXT NOT NULL | `#RRGGBB` en mayúsculas |
| `accent1` | TEXT NOT NULL | `#RRGGBB` (rosa) |
| `accent2` | TEXT NOT NULL | `#RRGGBB` (verde) |
| `accent3` | TEXT NOT NULL | `#RRGGBB` (naranja) |
| `updated_at` | TEXT NOT NULL | ISO 8601; se devuelve como `updatedAt` |

- Sin fila ⇒ se usan los valores por defecto y `updatedAt = null` (no se inserta hasta el primer guardado).
- "Restaurar valores originales" ⇒ `DELETE` de la fila.
- Valores por defecto: `background #11052C`, `accent1 #FF007A`, `accent2 #00FF66`, `accent3 #FF9900`.
- Concurrencia: `PUT` con `expectedUpdatedAt` distinto del guardado ⇒ `409 theme_changed`.

### `business_settings` (sin cambios de esquema; cambia el tipo de TypeScript)
Siguen aquí el texto de banner (`cover_title`), los teléfonos, la dirección, el nombre y las políticas. Se separa el tipo `BusinessInfo { storeName, phone1, phone2, address, coverTitle }` (lo que persiste y edita `/settings/business`) de `CatalogConfig`, que añade el tema. Nuevo límite: el total de caracteres de las políticas (`terms[].body`) ≤ 3500.

### `generated_catalog` (sin cambios de esquema)
`params_json` pasa a incluir `pages` (total de páginas del PDF, de `structure.totalPages`) para mostrarlo en Inicio.

## Estructuras en memoria (no persistidas)

### `Theme`
```text
Theme { background, accent1, accent2, accent3 }   // todos "#RRGGBB"
ThemeWarning { code: 'low_text_contrast' | 'low_accent_contrast', message }
```

### `GenerationOptions` (guardadas en la entrada de preparación)
| Campo | Tipo | Reglas |
| --- | --- | --- |
| `sectionKeys` | string[] \| undefined | `undefined` = todas las secciones disponibles; claves `alegra:<id>` / `custom:<id>`; las que ya no estén disponibles se ignoran |
| `hideSoldOut` | boolean | por defecto `false`; si es `true` también omite, sin pedir decisión, los combos con algún componente agotado |
| `bannerText` | string \| undefined | máx. 80 caracteres; vacío o ausente ⇒ `business_settings.cover_title`; **no se persiste** |

### `CatalogConfig` (cambia)
```text
BusinessInfo  { storeName, phone1, phone2, address, coverTitle }
CatalogConfig = BusinessInfo & { theme: Theme }     // theme obligatorio en el payload
```
`coverTitle` en el payload ya incluye el efecto de `bannerText`. El tema se lee **al construir** el payload (no al preparar). Todas las fuentes de datos de prueba y el repositorio de `business_settings` (`BusinessSettings extends BusinessInfo`) se ajustan al nuevo tipo.

### `ReviewReport` (cambia el cálculo, no la forma)
Cada entrada se etiqueta internamente con su `sectionKey` y el informe se **filtra por las secciones seleccionadas** antes de devolverse: `omittedNoImage`, `soldOutBundles` y `counts` solo reflejan secciones incluidas. `uncategorized` y `omittedNoSection` siguen siendo globales (ítems de Alegra sin sección). Con `hideSoldOut = true`, `soldOutBundles` queda vacío para los combos ocultados.

### `AvailableSection`
```text
AvailableSection { key, name, source: 'alegra' | 'custom', items }   // items = ítems elegibles hoy
```
Calculada **antes** de aplicar `sectionKeys` y con el `hideSoldOut` vigente; solo secciones con `items ≥ 1`. Alimenta la lista de casillas de Generar.

### `CatalogStructure` (resultado de `structure.ts`)
```text
CatalogStructure
├── coverPages: 1 | 0
├── sectionCoverPages: number            // una por sección incluida
├── productPages: number                 // Σ pages de las secciones incluidas (máx. 3 ítems por página)
├── termsPages: 0 | 1
├── ownItems: number                     // productos propios + combos incluidos
├── totalPages: number                   // suma de los anteriores
├── nothingToGenerate: boolean           // true si no hay secciones incluidas; entonces todo lo demás es 0
└── sections: { key, name, source, items, pages }[]   // detalle de lo incluido
```
Invariante (SC-003): `totalPages` = número de páginas del PDF generado con las mismas opciones y datos.

### `PrepareEntry` (cambia)
`{ build(decisions, options, theme), payload, params, options: GenerationOptions }`. Expira a los 15 min como hoy. `PUT /catalog/prepare/:id/options` reemplaza `options`, reconstruye y actualiza el payload guardado; `GET …/payload/:id` entrega ese payload con `config.theme` actualizado al tema guardado; `generate` reconstruye con las `bundleDecisions` del cuerpo y el tema vigente.

### `PanelSummary` (respuesta de `GET /panel/summary`)
```text
PanelSummary
├── alegra: { status: 'ok' | 'unreachable' | 'not_configured', email?, lastTestedAt?, message? }   // message explica por qué no está disponible
├── stats: { products, soldOut, uncategorized, estimatedPages } | null     // null si Alegra no respondió
├── sections: { key, name, source, items, soldOut }[] | null               // idem
├── lastCatalog: { id, createdAt, includedCount, omittedCount, pages? } | null   // siempre del historial local, sin caché
└── generatedAt
```
La parte que depende de Alegra se cachea 60 s; `lastCatalog` no. `estimatedPages` y las filas de secciones salen de ejecutar `buildCatalog` y `computeStructure` sin descargar imágenes (se asume con imagen todo ítem con URL remota).

## Reglas de validación y transformación

| Regla | Origen |
| --- | --- |
| Color válido = `^#[0-9A-Fa-f]{6}$`, se normaliza a mayúsculas; si alguno es inválido se rechaza todo el `PUT` con `422 invalid_theme` y se conserva el tema anterior | FR-014 |
| Advertencia `low_text_contrast`: contraste WCAG(`background`, `#FFFFFF`) < 4,5. Advertencia `low_accent_contrast`: contraste(acento, `background`) < 3 (los acentos se dibujan pegados al fondo). No bloquean el guardado | FR-014 |
| Restaurar ⇒ `DELETE` de la fila; la respuesta devuelve los valores por defecto y `updatedAt = null` | FR-015 |
| `PUT` del tema con `expectedUpdatedAt` distinto del guardado ⇒ `409 theme_changed` | FR-028 |
| `bannerText` > 80 caracteres ⇒ `422 invalid_options`; vacío ⇒ valor de `cover_title` | FR-007 |
| `sectionKeys` vacío (`[]`) ⇒ `emptyCatalog = true`, `nothingToGenerate = true`; no se puede generar | FR-009 |
| `hideSoldOut = true` ⇒ combos con algún componente agotado se omiten sin decisión | FR-007 |
| Informe, alertas y decisiones de combos solo cuentan secciones incluidas | FR-010 |
| Cada `PUT …/options` recalcula `report`, `structure` y `availableSections` sin llamar a Alegra | FR-006, FR-008 |
| `structure.totalPages` = páginas del PDF para las mismas opciones | SC-003 |
| Total de caracteres de las políticas ≤ 3500 (`422` si se excede) | FR-022 |

## Transiciones de estado

`GenerationJob` (001) no cambia. Las opciones solo se pueden editar mientras la preparación sea válida; si hay un trabajo en estado `rendering` (regla global, el `JobManager` no conoce el `prepareId`), `PUT …/options` devuelve `409 job_in_progress`.
