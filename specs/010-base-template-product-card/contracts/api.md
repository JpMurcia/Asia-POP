# Contratos de API: foto-tarjeta y plantilla «Base AsianPop»

**Feature**: [../spec.md](../spec.md) · **Datos**: [../data-model.md](../data-model.md)

Todas las rutas exigen sesión (principio III). Los errores usan el formato `HttpError` existente (`{ code, message }`). Solo se listan los cambios; lo demás de `/api` queda igual.

## 1. Opción de generación `photoBackdrop`

Se acepta donde hoy se aceptan las opciones de la corrida (junto a `templateId`) y en `POST /api/catalog/generate` (junto a `quality`).

| Campo | Tipo | Por defecto | Notas |
| --- | --- | --- | --- |
| `photoBackdrop` | `'marco' \| 'sin-fondo'` | `'marco'` | Un valor distinto responde `422` (`invalid_options` en `prepare` y en las opciones; `validation_error` en `generate`), como el resto de las validaciones de la aplicación |

Se ignora (sin error) si la plantilla elegida no tiene un bloque de productos con `cardStyle: 'tarjeta'`.

## 2. `GET /api/catalog/payload/:prepareId` (cambia el contenido, no la forma)

- Si la plantilla vigente tiene un bloque de productos con `cardStyle: 'tarjeta'`, cada ítem con foto local (`/media/cache/…` o `/media/uploads/…`) llega con `imageUrl` = `/media/cards/<sha1>.jpg`, compuesta según `options.photoBackdrop` de la preparación.
- Con `?quality=optimized` el resto de las fotos sigue el flujo de la 005; **las tarjetas no se vuelven a reducir** (su dirección no coincide con el patrón del optimizador).
- Con cualquier otra plantilla el payload es **idéntico al de hoy** (contrato de compatibilidad, FR-022).
- Un fallo al componer una tarjeta **no** devuelve error: ese ítem usa el modo `marco`, y si tampoco es posible conserva la foto original. El informe de respaldos queda disponible para el trabajo (§4).

`/media/cards/<sha1>.jpg` se sirve solo para nombres seguros (`^[0-9a-f]{40}\.jpg$`); cualquier otro nombre responde `404`.

## 3. `POST /api/catalog/card-preview`

Devuelve la tarjeta de ejemplo de la pantalla Generar (FR-008c, SC-011).

Petición:

```json
{ "prepareId": "…", "backdrop": "marco" | "sin-fondo", "itemId": "opcional" }
```

- `itemId` ausente → el **primer producto con foto** del catálogo preparado.
- Usa la plantilla y el tamaño vigentes.

Respuesta `200`:

```json
{
  "url": "/media/cards/<sha1>.jpg",
  "used": "marco" | "sin-fondo",
  "fellBack": false,
  "reason": null,
  "itemName": "Nombre del producto"
}
```

Errores: `410 prepare_expired` (la preparación expiró); `404 not_found` si no hay ningún producto con foto; `422 validation_error` para un `backdrop` desconocido (la aplicación responde 422 a toda validación de cuerpo).

## 4. Estado del trabajo (`GET /api/catalog/jobs/current`)

Se agrega un campo opcional, solo en `status: 'done'` y solo si hay alguno:

```json
{ "backdropFallbacks": [{ "item": "Nombre del producto" }] }
```

La pantalla Generar lo muestra como aviso: «N fotos se dejaron con su fondo original».

## 5. Imágenes de plantilla (nuevo)

| Método y ruta | Descripción |
| --- | --- |
| `POST /api/template-images` | Sube una imagen (`multipart/form-data`, campo `image`). Valida el tipo real por contenido (no por extensión), el tamaño máximo de las subidas de productos y guarda con nombre seguro `tpl-<id>.<ext>`. Responde `201 { file, name, bytes, width, height, src: "upload:<file>" }`; el nombre es `tpl-<nombre-saneado>-<8 hex>.<ext>` |
| `GET /api/template-images` | Lista las imágenes subidas: `{ images: TemplateImage[] }` |
| `DELETE /api/template-images/:file` | Borra una imagen. Solo nombres seguros que empiecen con `tpl-`; otro nombre responde `404`. Responde `204`. Si la usa alguna plantilla guardada responde `409 in_use` con `details: [{ id, name }]` |

Errores de subida (los mismos de las fotos de productos): `422 invalid_image` (no es PNG, JPG ni WEBP por contenido), `422 image_required` (falta el campo `image`), `413 image_too_large` (más de 5 MB).

Las imágenes se sirven por `/media/uploads/<file>` (ruta ya existente).

## 6. Plantillas

- `GET /api/templates` lista **cinco** plantillas de fábrica (`neon`, `pop`, `kawaii`, `kraft`, `base`); el orden de la galería agrega `base` al final.
- `PUT /api/templates/:id` acepta los campos nuevos de `ProductsEl` y `ImageEl.src = "upload:<file>"` (validación en `data-model.md §1.5`).
- Una plantilla guardada antes de esta feature se **devuelve igual** y se normaliza al leerla (`normalizeProductsBlocks`), sin escribir.

## 7. Compatibilidad (contrato de no regresión)

1. Sin `photoBackdrop` y con las cuatro plantillas existentes, los PDF son **idénticos byte a byte** a la línea base de la 007.
2. Todos los campos nuevos de la plantilla son opcionales y su ausencia equivale al comportamiento anterior.
3. Ninguna ruta existente cambia su forma de respuesta.
