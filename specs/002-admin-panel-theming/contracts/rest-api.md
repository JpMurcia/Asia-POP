# Contrato REST: cambios de la feature 002

**Base**: `http://127.0.0.1:<PORT>/api` · Extiende el [contrato de 001](../../001-catalog-pdf-generator/contracts/rest-api.md). Todas las rutas siguientes exigen sesión; sin sesión → `401 { "error": "unauthenticated" }`. Errores: `{ error, message, details? }`. El token de Alegra nunca aparece en ninguna respuesta.

Los errores de validación de esta feature se devuelven con código propio (`invalid_theme`, `invalid_options`, `invalid_business`) y `details: [{ field, message }]`, no con el `validation_error` genérico.

## Tema del catálogo (FR-011..017, FR-028)

### `GET /settings/theme`
`200 { theme: Theme, isDefault: boolean, defaults: Theme, updatedAt: string | null }`

### `PUT /settings/theme`
- Cuerpo: `{ background, accent1, accent2, accent3, expectedUpdatedAt?: string | null }` (colores `#RRGGBB`)
- `200 { theme, isDefault: false, updatedAt, warnings: ThemeWarning[] }`
- `422 invalid_theme` con `details: [{ field, message }]`; el tema anterior se conserva
- `409 theme_changed` si `expectedUpdatedAt` no coincide con el valor guardado (otra pestaña lo modificó)

### `DELETE /settings/theme`
Restaura los valores originales. `200 { theme: <defaults>, isDefault: true, updatedAt: null }`

El texto de banner, el nombre, las políticas y el contacto del pie siguen en `GET/PUT /settings/business` (001). El `PUT` añade el límite de 3500 caracteres en total para `terms[].body` (`422 invalid_business`). La pantalla Apariencia llama primero a `/settings/theme` y luego a `/settings/business`.

## Resumen de Inicio (FR-002, FR-003, FR-029)

### `GET /panel/summary[?refresh=1]`
`200 PanelSummary` (ver [data-model.md](../data-model.md)). La parte que depende de Alegra se cachea 60 s; `refresh=1` fuerza una nueva consulta. `lastCatalog` se lee siempre del historial local, sin caché. Si Alegra no responde (timeout de 8 s) o falla, `alegra.status = 'unreachable'` y `stats` y `sections` quedan en `null` (no es un error HTTP). Sin conexión configurada: `alegra.status = 'not_configured'`.

## Generación con opciones (FR-006..010)

### `POST /catalog/prepare` (cambia)
- Cuerpo opcional: `{ sectionKeys?: string[], hideSoldOut?: boolean, bannerText?: string }`
- `200 { prepareId, report: ReviewReport, structure: CatalogStructure, availableSections: AvailableSection[], options: GenerationOptions }`
- Errores sin cambios (`409 job_in_progress`, `502 alegra_unreachable`, `422 alegra_not_configured`); `422 invalid_options` si `bannerText` supera 80 caracteres.
- `report` ya viene filtrado por las secciones incluidas.

### `PUT /catalog/prepare/:prepareId/options` (nuevo)
Guarda las opciones y recalcula **sin consultar Alegra**.
- Cuerpo: `{ sectionKeys?: string[], hideSoldOut?: boolean, bannerText?: string, bundleDecisions?: { [bundleId]: 'keep' | 'omit' } }`. Las decisiones permiten que la estructura coincida con el PDF final (omitir un combo puede dejar una sección sin contenido).
- `200 { prepareId, report: ReviewReport, structure: CatalogStructure, availableSections: AvailableSection[], options: GenerationOptions }`
- `410 prepare_expired` (preparación inexistente o vencida) · `409 job_in_progress` (si hay un trabajo en estado `rendering`) · `422 invalid_options`

### `POST /catalog/generate` (sin cambios de contrato)
Usa las opciones vigentes de la preparación, el tema guardado en ese momento y las `bundleDecisions` del cuerpo (solo se exigen para combos agotados de secciones incluidas y con `hideSoldOut = false`). `422 empty_catalog` si las opciones dejan el catálogo vacío. Al terminar guarda `pages` en el historial.

### `GET /catalog/payload/:prepareId` (cambia el contenido)
Devuelve el `CatalogPayload` guardado en la preparación (el de la última preparación, cambio de opciones o generación), con `config.theme` sustituido por el tema guardado en este momento. Lo consumen la vista previa y la vista de impresión.

## Tipos nuevos

```text
Theme            { background, accent1, accent2, accent3 }        // "#RRGGBB"
ThemeWarning     { code: 'low_text_contrast' | 'low_accent_contrast', message }
GenerationOptions{ sectionKeys?: string[], hideSoldOut: boolean, bannerText?: string }
AvailableSection { key, name, source: 'alegra' | 'custom', items }
CatalogStructure { coverPages, sectionCoverPages, productPages, termsPages, ownItems,
                   totalPages, nothingToGenerate, sections: { key, name, source, items, pages }[] }
```

## Mapa requisito → endpoint

| Requisito | Endpoint |
| --- | --- |
| FR-001..005, FR-029 (panel) | `/panel/summary`, rutas de 001 |
| FR-006..010 (generar) | `/catalog/prepare`, `/catalog/prepare/:id/options`, `/catalog/generate`, `/catalog/payload/:id` |
| FR-011..017, FR-028 (tema) | `/settings/theme`, `/settings/business` |
| FR-018..022 (fidelidad del PDF) | sin endpoint nuevo; pruebas de PDF, prueba de desbordamiento y revisión visual |
| FR-023..027 (estilo Pop) | solo frontend; sin endpoint |
