# Contrato REST: Generador de Catálogo PDF

**Base**: `http://127.0.0.1:<PORT>/api` · JSON salvo donde se indique · Todas las rutas excepto `POST /auth/login` exigen sesión (cookie `httpOnly`); sin sesión → `401 { "error": "unauthenticated" }`.

Errores: `{ "error": "<codigo>", "message": "<texto en español>", "details"?: [...] }`. El token de Alegra nunca aparece en ninguna respuesta.

## Autenticación (FR-001..004)

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ username, password }` | `204` + cookie · `401 invalid_credentials` (mensaje genérico) · `429` tras 5 intentos/min |
| POST | `/auth/logout` | | `204` |
| GET | `/auth/session` | | `200 { authenticated: true }` |

## Conexión con Alegra (FR-005..008)

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| GET | `/settings/alegra` | | `200 { email, isConfigured, lastTestedAt }` |
| PUT | `/settings/alegra` | `{ email, apiToken }` | Valida contra Alegra y guarda solo si es exitoso → `200 { email, isConfigured: true, lastTestedAt }` · `422 alegra_rejected` (se conservan las anteriores) · `502 alegra_unreachable` |
| POST | `/settings/alegra/test` | `{ email, apiToken }` | `200 { ok: true }` · `422 alegra_rejected`. No guarda nada. Límite 10/min |

## Configuración del negocio

| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| GET | `/settings/business` | | `{ storeName, phone1, phone2, address, coverTitle, terms[{title, body}] }` |
| PUT | `/settings/business` | mismo objeto | `200` objeto guardado |

## Secciones y orden (FR-015, FR-019, FR-022)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/sections` | Lista unificada en orden: `{ key, name, source: 'alegra'|'custom', itemCount?, introText? }[]`. Las de Alegra salen de `/item-categories` en vivo |
| PUT | `/sections/order` | `{ keys: string[] }` define el orden |
| POST | `/sections/custom` | `{ name, introText? }` → `201` · `409 duplicate_name` |
| PUT | `/sections/custom/:id` | edita |
| DELETE | `/sections/custom/:id` | `204` (elimina productos propios y combos de la sección) |

## Productos propios (FR-019..021)

| Método | Ruta | Cuerpo |
| --- | --- | --- |
| GET | `/custom-products?sectionId=` | lista |
| POST | `/custom-products` | `{ sectionId, name, description, price?, options?[{label, price, maxFlavors?}], flavors?[] }` → `201`. `422` si no hay `price` ni `options` |
| PUT | `/custom-products/:id` | edita |
| DELETE | `/custom-products/:id` | `204` · `409 used_in_bundle` si es componente de un combo |
| PUT | `/custom-products/:id/image` | `multipart/form-data` (`image`: png/jpg/webp ≤ 5 MB) → `200 { imagePath }` |

## Combos (FR-023, FR-024)

| Método | Ruta | Cuerpo |
| --- | --- | --- |
| GET | `/bundles` | lista con componentes y precio calculado |
| POST | `/bundles` | `{ sectionId, name, description, pricing: {type:'fixed', price} \| {type:'discount', percent}, components: [{source:'alegra'\|'custom', productId, quantity}] }` → `201` · `422` si no hay componentes o los valores son inválidos |
| PUT | `/bundles/:id` | edita |
| DELETE | `/bundles/:id` | `204` |
| PUT | `/bundles/:id/image` | igual que productos propios |

## Ítems sin categoría (FR-016..018)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/catalog/uncategorized` | `200 { items: [{ itemId, name, assignedSectionKey? }] }` (consulta Alegra en vivo) |
| PUT | `/catalog/uncategorized/:itemId` | `{ sectionKey }` guarda override local · `204`. Nunca escribe en Alegra |
| DELETE | `/catalog/uncategorized/:itemId` | quita el override |

## Generación (FR-009..014, FR-025..032)

### `POST /catalog/prepare`
Consulta Alegra, aplica las reglas y devuelve el informe de revisión. No genera PDF.
- Cuerpo opcional: `{ sectionKeys?: string[], hideSoldOut?: boolean }`
- `200 ReviewReport` (ver [data-model.md](../data-model.md)) con `prepareId` que identifica la instantánea (válido 15 min)
- `409 job_in_progress` si hay una generación activa · `502 alegra_unreachable` · `422 alegra_not_configured`

### `POST /catalog/generate`
- Cuerpo: `{ prepareId, bundleDecisions: { "<bundleId>": "keep" | "omit" } }`. Si falta la decisión de algún combo agotado → `422 bundle_decision_required` con la lista faltante
- `202 { jobId }` · `409 job_in_progress` · `410 prepare_expired` · `422 empty_catalog`

### `GET /catalog/jobs/current`
`200 { id, status, step, progress, error?, catalogId? }` o `{ status: 'idle' }`.

### `GET /catalog/history`
`200 [{ id, createdAt, includedCount, omittedCount }]` (máx. 10).

### `GET /catalog/history/:id/pdf`
`200 application/pdf` con `Content-Disposition: attachment; filename="catalogo-YYYY-MM-DD-HHmm.pdf"`.

## Vista previa y vista de impresión

- `GET /api/catalog/payload/:prepareId` devuelve el `CatalogPayload` de una preparación (`410` si expiró). Lo usan la **vista previa** (`/vista-previa/:prepareId`, abierta por el usuario) y la **vista de impresión** (`/print/:prepareId`).
- *Implementación:* en lugar de un token de un solo uso, el servidor crea una **sesión temporal** para el navegador headless (cookie `sid`) que se destruye al terminar la generación. Así la vista de impresión, el payload y las imágenes usan la misma regla de acceso (sesión) y no hay una segunda vía de autenticación.
- `/print/:prepareId` marca `window.__printReady = true` cuando fuentes e imágenes están cargadas; Puppeteer espera esa señal antes de exportar.

## Imágenes locales

`GET /media/cache/:file` (descargas de Alegra) y `GET /media/uploads/:file` (cargas del usuario). Requieren sesión; los nombres de archivo se validan (`400` si no son seguros, `404` si no existen).

## Rutas adicionales implementadas

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/sections/custom` | Lista solo las secciones propias |
| GET | `/bundles/component-options` | Productos disponibles para armar combos: `{ alegra[], custom[], alegraAvailable }` |

## Mapa requisito → endpoint

| Requisito | Endpoint |
| --- | --- |
| FR-001..004 | `/auth/*` |
| FR-005..008 | `/settings/alegra*` |
| FR-009..015 | `/catalog/prepare`, `/sections*` |
| FR-016..018 | `/catalog/uncategorized*` |
| FR-019..022 | `/sections/custom*`, `/custom-products*` |
| FR-023..026 | `/bundles*`, `bundleDecisions` en `/catalog/generate` |
| FR-027..032 | `/catalog/generate`, `/catalog/jobs/current`, `/catalog/history*` |
