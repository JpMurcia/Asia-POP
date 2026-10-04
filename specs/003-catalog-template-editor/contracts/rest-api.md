# Contrato REST: cambios de la feature 003

**Base**: `http://127.0.0.1:<PORT>/api` · Extiende los contratos de [001](../../001-catalog-pdf-generator/contracts/rest-api.md) y [002](../../002-admin-panel-theming/contracts/rest-api.md). Todas las rutas exigen sesión; sin sesión → `401 { "error": "unauthenticated" }`. Errores: `{ error, message, details? }`. El token de Alegra nunca aparece en ninguna respuesta.

Los errores de validación de esta feature usan códigos propios (`invalid_templates`, `invalid_options`, `invalid_business`) con `details: [{ field, message }]`, no el `validation_error` genérico. Los tipos (`Template`, `WorkspaceState`, `TemplateSummary`, `GenerationOptions`) están en [data-model.md](../data-model.md).

## Plantillas y datos del catálogo (FR-001..027)

### `GET /settings/templates`
`200 WorkspaceState` sin `warnings`: todas las plantillas con su documento completo, la predeterminada, los datos del negocio (con políticas) y la `revision`. La primera llamada siembra las 4 plantillas base y migra el tema de 002 (ver data-model).

### `PUT /settings/templates`
Guarda **todo el conjunto en una transacción**.
- Cuerpo: `{ templates: Template[], defaultId: string, business: BusinessSettings, expectedRevision: number }`. El cuerpo admite hasta 2 MB.
- `200 WorkspaceState` con la nueva `revision` y `warnings` (de contraste, no bloquean).
- `422 invalid_templates` con `details: [{ field, message }]` (campo con ruta, por ejemplo `templates[1].pages.productos.els[0].ringW`): color o rango inválido, bloque obligatorio ausente o repetido, nombre vacío o de más de 60 caracteres, predeterminada inexistente, límites excedidos. **No se escribe nada.**
- `422 invalid_business` si los datos del negocio superan los límites (banner 80, políticas 3500). **No se escribe nada.**
- `409 templates_changed` si `expectedRevision` no coincide con la guardada (otra pestaña guardó).

### `GET /settings/templates/summary`
`200 { defaultId, items: TemplateSummary[] }`. Ligero (sin documentos): lo usa el selector de Generar catálogo.

### `GET /settings/business` y `PUT /settings/business` (001, se conservan)
Sin cambios de contrato. El `PUT` ahora también incrementa la `revision` de las plantillas, para que una edición de datos desde otra pestaña se detecte.

### Eliminadas
`GET|PUT|DELETE /settings/theme` (feature 002) ya no existen → `404 not_found`. La tabla `catalog_theme` se conserva solo como origen de la migración.

## Generación (FR-022, FR-028..031)

### `POST /catalog/prepare` (cambia)
- Cuerpo opcional: `{ sectionKeys?, hideSoldOut?, bannerText?, templateId? }`.
- La respuesta mantiene su forma; `options` incluye `templateId` si se indicó.
- `422 invalid_options` si `bannerText` supera 80 caracteres o `templateId` no es texto.

### `PUT /catalog/prepare/:prepareId/options` (cambia)
Acepta además `templateId`. No consulta Alegra. La estructura devuelta no depende de la plantilla.

### `POST /catalog/generate` (cambia la respuesta)
`202 { jobId, template: { id, name, fallback } }`. `fallback = true` indica que la plantilla elegida ya no existe y se usó la predeterminada. Resto de errores sin cambios.

### `GET /catalog/payload/:prepareId` (cambia el contenido)
El `CatalogPayload` ahora trae `template` (la plantilla elegida, resuelta en esta lectura) en lugar de `config.theme`. Lo consumen la vista previa y la vista de impresión.

## Ajustes menores (Historia 6)

### `GET /panel/summary` (cambia)
`alegra` gana `syncedAt?: string` (ISO 8601) con la lectura de Alegra que llenó la caché de 60 s. `null`/ausente si Alegra no respondió o no está configurado.

### `GET /settings/alegra` y `POST /settings/alegra/test` (cambian)
Ambas respuestas (también el `429`, dentro de `details`) incluyen `testAttempts: { limit: 10, remaining: number }`.

## Tipos nuevos

```text
Template         { id, name, base: 'neon'|'pop'|'kawaii'|'kraft', version, palette, fonts, pages }
WorkspaceState   { templates: Template[], defaultId, business: BusinessSettings, revision, warnings? }
TemplateSummary  { id, name, isDefault, palette, fonts }
GenerationOptions{ sectionKeys?, hideSoldOut, bannerText?, templateId? }
```

## Mapa requisito → endpoint

| Requisito | Endpoint |
| --- | --- |
| FR-001..004, FR-018..021 (editor y plantillas) | `/settings/templates` (GET/PUT), módulo compartido de plantillas en el cliente |
| FR-005..014 (elementos e inspector) | solo frontend; se guardan con `PUT /settings/templates` |
| FR-015..017 (paleta y tipografía) | solo frontend; validación en `PUT /settings/templates` |
| FR-022 (plantilla al generar) | `/settings/templates/summary`, `/catalog/prepare`, `…/options`, `/catalog/generate` |
| FR-023..024 (datos y marcadores) | `/settings/templates` (PUT), `/settings/business` |
| FR-025..027 (guardado, aviso, concurrencia) | `PUT /settings/templates` (`422`/`409`), `useUnsavedGuard` |
| FR-028..031 (PDF fiel) | `GET /catalog/payload/:id`; pruebas de PDF y de desbordamiento |
| FR-032, FR-033 | solo frontend |
| FR-034 | `/panel/summary` (`syncedAt`) |
| FR-035 | `/settings/alegra`, `/settings/alegra/test` (`testAttempts`) |
