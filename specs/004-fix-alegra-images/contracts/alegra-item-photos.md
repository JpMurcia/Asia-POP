# Contrato: fotos de los ítems de Alegra

**Feature**: `004-fix-alegra-images` | **Verificado**: 2026-10-04, cuenta real de la tienda, solo lectura

Este contrato describe lo que Alegra **entrega de verdad** (no lo que dice su documentación) y lo que el servidor de pruebas debe imitar. Los valores de los ejemplos son ficticios.

## Servicios que se usan

| Servicio | Uso |
| --- | --- |
| `GET /items?status=active&mode=advanced&start=<n>&limit=30` | Única fuente de las fotos. Pagina hasta agotar resultados (máx. 30 por página, como hoy) |
| Descarga de la dirección de cada foto (`images[].url`) | Directa, **sin** cabecera `Authorization` (la dirección ya está firmada) |

## Servicios que NO se usan

| Servicio | Por qué |
| --- | --- |
| `POST /items/{id}/attachment`, `DELETE /items/attachment/{idAttachment}` | Escriben en Alegra (principio I) |
| `GET /items/{id}/attachment` | Responde 200 con el propio ítem; no añade datos |
| `GET /items/{id}` | Trae las mismas fotos que la lista |

## Forma real de un ítem con foto

```json
{
  "id": "1042",
  "name": "Producto de ejemplo",
  "type": "product",
  "status": "active",
  "price": [{ "idPriceList": "1", "name": "General", "price": 9000, "main": true }],
  "inventory": { "availableQuantity": 5 },
  "images": [
    { "id": 2201, "name": "foto-1.jpg", "url": "https://cdn3.alegra.com/<ruta>.jpg?Expires=<epoch>&Signature=<firma>&Key-Pair-Id=<id>", "favorite": false },
    { "id": 2202, "name": "foto-2.jpg", "url": "https://cdn3.alegra.com/<ruta>.jpg?Expires=<epoch>&Signature=<firma>&Key-Pair-Id=<id>", "favorite": true }
  ]
}
```

Reglas observadas:

- `images` ausente o vacío = sin foto (16 de 197 productos). No existe `attachments` en ningún ítem.
- Cada foto: `id` numérico, `name`, `url` https del CDN firmada con `Expires`, `Signature` y `Key-Pair-Id`, y `favorite` booleano. **No existe `isPrimary`.**
- 177 productos tienen una foto (siempre `favorite: true`); 4 tienen 2 o 3 y **la favorita no es la primera**.
- Con `mode=simple` desaparece `images`; sin `mode` y con `mode=advanced` la respuesta es idéntica.
- Vencimiento de la dirección: ~7 días (parámetro `Expires`).

## Forma real de la descarga

- HTTP 200 con `Content-Type: binary/octet-stream` **siempre**, aunque el contenido sea JPG o PNG.
- Extensiones vistas en la URL: `.jpg` (77) y `.png` (109). Tamaños vistos: ~46 KB a ~2 MB.
- Es obligatorio reconocer la imagen por su contenido (FR-005).

## Lo que debe imitar el servidor de pruebas (`backend/tests/fixtures/alegra-mock.ts`)

| Ruta del simulador | Respuesta | Caso que cubre |
| --- | --- | --- |
| `/img/ok.png` | 200, `image/png` | Se conserva: pruebas actuales |
| `/img/generic.png` | 200, `binary/octet-stream`, bytes PNG | Comportamiento real de Alegra (FR-005, SC-001) |
| `/img/generic.jpg` | 200, `binary/octet-stream`, bytes JPEG | Idem, formato JPG |
| `/img/forbidden` | 403 | `unauthorized` |
| `/img/missing` | 404 | `not_found` |
| `/img/html` | 200, `text/html` | `not_image` |
| `/img/svg` | 200, `image/svg+xml` | `unsupported_format` |
| `/img/slow` | responde pasado el tiempo límite de la prueba | `timeout` |
| `/img/big` | 200, cuerpo mayor que el tope de la prueba | `too_large` |
| `/img/error` | 500 | `unavailable` |

Además, el simulador:

- sirve ítems con `images: [{ id, name, url, favorite }]` (la forma de arriba);
- registra en `requests` también la consulta (`search`), para comprobar `mode=advanced`;
- sigue sin exigir `Authorization` en `/img/*` (las fotos reales tampoco lo piden).
