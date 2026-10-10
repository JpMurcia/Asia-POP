# Contrato REST: Productos del catálogo más claros y datos de Alegra guardados

**Feature**: `007-product-layout-alegra-cache` | **Fecha**: 2026-10-10

Dos rutas nuevas y cambios **aditivos** en las existentes. Todas exigen sesión (`401` sin ella, principio III). Ninguna escribe en Alegra: las descargas usan solo `GET` (principio I). Los formatos de `AlegraDataStatus`, `TextOverflow` y los campos de plantilla están en [data-model.md](../data-model.md).

## 1. Rutas nuevas

### `GET /api/alegra/data`

Estado de los datos de Alegra guardados en el equipo. **Nunca consulta Alegra** y responde al instante, también mientras hay una descarga en curso (es lo que consulta la pantalla de carga para mostrar el avance).

- `200`: `AlegraDataStatus`.

```json
{
  "state": "syncing",
  "syncedAt": "2026-10-10T14:02:11.000Z",
  "articles": 197,
  "categories": 21,
  "progress": { "phase": "items", "received": 90 },
  "lastError": null
}
```

- `state: "none"` → `syncedAt`, `articles` y `categories` son `null`.
- Sin conexión configurada: `200` con `state: "none"` (no es un error; la pantalla que necesite datos recibirá `422 alegra_not_configured` al pedirlos).

### `POST /api/alegra/data/refresh`

Inicia una actualización desde Alegra. **No espera** a que termine.

- `202`: `AlegraDataStatus` con `state: "syncing"`. Si ya había una descarga en curso (de esta ruta, de la primera lectura o del guardado de la conexión), no inicia otra y devuelve el estado de esa.
- `422 alegra_not_configured` si no hay conexión guardada.
- Un fallo de Alegra durante la descarga **no** es un error de esta ruta: queda en `lastError` del estado, y la copia anterior sigue intacta. Los códigos de Alegra son los de siempre (`alegra_rejected`, `alegra_rate_limited`, `alegra_unreachable`, `alegra_error`), con el mismo mensaje en español.
- Al terminar bien: `state: "ready"`, `syncedAt` nuevo y `lastError: null`.

## 2. Rutas existentes con cambios

### `PUT /api/settings/alegra` (guardar la conexión)

Sin cambios en la petición. Después de validar y guardar las credenciales:

- Si el **correo cambió** (sin distinguir mayúsculas) respecto de la conexión anterior, la copia se **descarta**.
- Si no hay copia, inicia la descarga **en segundo plano** (no retrasa la respuesta).
- Si el correo es el mismo y hay copia, no hace nada.
- Respuesta: la de siempre más un campo aditivo `data: AlegraDataStatus`.
- Si la validación falla se conservan las credenciales y la copia anteriores (FR-006 de 001).

### Rutas que ahora leen la copia (formas de respuesta **sin cambios**)

`GET /api/catalog/articles` · `GET /api/catalog/uncategorized` · `GET /api/bundles` · `GET /api/bundles/component-options` · `GET /api/sections` (la lista de secciones, que usan Artículos, Sin categoría y Secciones; las categorías salen de la copia) · `PUT /api/catalog/uncategorized/:itemId` (valida la sección contra las categorías de la copia).

- **Con copia**: responden sin consultar Alegra y **no pueden fallar por Alegra** (SC-005).
- **Sin copia** (conexión existente que nunca descargó, o cambio de cuenta): la primera petición **espera** la descarga única y la guarda. Si falla, devuelve el error de Alegra de siempre (`422 alegra_not_configured`, `422 alegra_rejected`, `429 alegra_rate_limited`, `502 alegra_unreachable`, `502 alegra_error`).
- `GET /api/bundles`: `computedPrice` se calcula con la copia; solo es `null` cuando no hay copia y la descarga falló (comportamiento de hoy, «mejor esfuerzo»). `alegraAvailable` de `component-options` sigue ese mismo criterio.
- Las marcas de omitido, las asignaciones de sección y los combos se siguen leyendo en cada petición: una decisión local se ve al instante sin tocar la copia.

### `GET /api/panel/summary`

- Se calcula con la copia y las entradas locales, sin consultar Alegra, y **ya no se cachea 60 s**.
- `?refresh=1`: **espera** una actualización desde Alegra y responde con el resultado. Si falla y hay copia, responde `200` con los datos guardados y `alegra.syncError` (texto); si falla y no hay copia, `alegra.status: "unreachable"` con `message`, como hoy.
- `alegra.syncedAt` es el instante de la **copia**. Los demás campos no cambian.

### `POST /api/catalog/prepare`

Sin cambios en la petición ni en la respuesta. Sigue descargando categorías, artículos y fotos en vivo (las direcciones de las fotos vencen) y, **al terminar bien**, guarda ese resultado como la copia vigente (`syncedAt` nuevo). Si falla, no toca la copia. Es lo que garantiza que el catálogo se arma con precios e inventario del momento (FR-017, principio II).

### `GET /api/catalog/jobs/current`

Aditivo: en `status: "done"`, `textOverflow?: TextOverflow[]` con los productos cuyo texto no cupo completo en el PDF generado (ausente si no hay ninguno). No cambia ningún otro campo; la generación termina igual (no aborta).

### `GET /api/settings/templates` y `PUT /api/settings/templates`

- Los bloques de productos traen los seis campos nuevos (`photoW`, `photoH`, `nameStyle`, `nameColor`, `nameFill`, `nameGlow`). `GET` completa los que falten en plantillas guardadas antes de esta feature (ver [data-model.md §4](../data-model.md)).
- `PUT` exige los seis campos. Respuestas `422 invalid_templates` nuevas, con la ruta del campo en `details`:

| Condición | Mensaje |
| --- | --- |
| `photoW` o `photoH` fuera de 50 a 150 | «El ancho de la foto: el mínimo es 50.» / «…el máximo es 150.» (idem «El alto de la foto») |
| `nameStyle` distinto de `separado` o `burbuja` | «El estilo del nombre: valor no válido.» |
| `nameColor` o `nameFill` no es color válido | «Debe ser un color de la paleta, un #RRGGBB, "none" o "transparent".» |
| Zona de productos con `w < 40` o `h < 30` | «La zona de productos debe medir al menos 40 % de ancho y 30 % de alto.» |

- La revisión (`revision`), el `409 templates_changed` y los demás errores no cambian.

## 3. Códigos y mensajes

| Código | HTTP | Mensaje | Dónde |
| --- | --- | --- | --- |
| `alegra_not_configured` | 422 | Primero configura la conexión con Alegra. | `refresh` y rutas que leen la copia sin copia |
| `alegra_rejected` | 422 | Alegra rechazó el correo o el token. | idem, y en `lastError` |
| `alegra_rate_limited` | 429 | Alegra limitó las peticiones. Intenta de nuevo en un momento. | idem |
| `alegra_unreachable` | 502 | No se pudo conectar con Alegra. | idem |
| `alegra_error` | 502 | Alegra respondió con error N. | idem |
| `invalid_templates` | 422 | (tabla de §2) | `PUT /api/settings/templates` |

No se agregan códigos nuevos.

## 4. Seguridad y pruebas del contrato

- Las dos rutas nuevas entran en la prueba de guardia (`auth-guard.test.ts`): sin sesión → `401`.
- Ninguna respuesta lleva el token, direcciones de fotos ni direcciones firmadas.
- La prueba que exige `GET` en toda petición a Alegra (`mock.requests`) cubre las descargas de la copia.
- Abrir las rutas de §2 con copia vigente debe dejar `mock.requests` **sin cambios** (SC-005): se comprueba por cada ruta.
