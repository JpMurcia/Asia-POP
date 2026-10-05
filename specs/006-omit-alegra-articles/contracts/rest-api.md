# Contrato: cambios en la API REST

**Feature**: `006-omit-alegra-articles` | **Base**: las rutas de [001](../../001-catalog-pdf-generator/), [004](../../004-fix-alegra-images/contracts/review-report.md) y [005](../../005-optimize-pdf-size/contracts/rest-api.md)

Tres rutas nuevas y el resto de cambios **aditivos**: ningún campo existente cambia de forma ni de significado. Todo exige sesión como el resto de `/api` (principio III). Los errores usan el formato de siempre: `{ "error": "<código>", "message": "<texto en español>", "details"? }`.

## `GET /api/catalog/articles` (nuevo)

Consulta Alegra **en vivo** (igual que `GET /catalog/uncategorized`) y devuelve los artículos activos, sin los padres de variantes, ordenados por nombre (`es`, sin distinguir mayúsculas ni tildes):

```json
{
  "items": [
    {
      "itemId": "1042",
      "name": "Ramen picante",
      "sectionKey": "alegra:12",
      "sectionName": "RAMEN",
      "price": 9000,
      "soldOut": false,
      "omitted": true,
      "bundles": ["Combo ramen + bebida"]
    }
  ]
}
```

| Campo | Regla |
| --- | --- |
| `sectionKey` / `sectionName` | La categoría del artículo; si no tiene, la sección asignada en «Sin categoría» (si existe); si no, ambos `null` |
| `omitted` | `true` si el identificador está en la lista de omitidos |
| `bundles` | Nombres de los combos que lo usan como componente (`source: alegra`); `[]` si ninguno |

Errores (los mismos de `GET /catalog/uncategorized`): `422 alegra_not_configured` si no hay conexión guardada; los de `toHttpError` si Alegra rechaza o no responde (`422 alegra_rejected`, `429 alegra_rate_limited`, `502 alegra_unreachable`, `502 alegra_error`). La lista guardada de omitidos **no se toca** en ningún error (FR-015).

No incluye fotos, descripciones, direcciones de imágenes ni credenciales.

## `PUT /api/catalog/omitted/:itemId` (nuevo)

Marca el artículo como omitido. Sin cuerpo.

- `204` siempre que el identificador sea válido; **idempotente** (omitir un omitido no cambia nada).
- `422 invalid_item` si `:itemId` tiene más de 64 caracteres.
- No consulta Alegra y no escribe en Alegra (principio I).

## `DELETE /api/catalog/omitted/:itemId` (nuevo)

Vuelve a incluir el artículo. Sin cuerpo.

- `204` siempre; **idempotente** (incluir un incluido no cambia nada y no falla).
- Mismos límites de identificador que el `PUT`.

## `POST /api/catalog/prepare` y `PUT /api/catalog/prepare/:id/options` (ampliados)

El informe (`report`) gana un campo:

```json
{ "omittedByChoice": [{ "itemId": "1042", "name": "Ramen picante" }] }
```

- Lista **global** de los omitidos activos de Alegra, ordenada por nombre; `[]` si no hay ninguno.
- `report.counts.omitted`, `omittedNoImage`, `omittedNoSection`, `uncategorized` y `photos` **no incluyen** a los omitidos (FR-009). `counts.omitted` conserva su significado: sin foto + sin sección.
- La lista de omitidos se **fija al preparar**; `options` no la cambia.

## `POST /api/catalog/generate` (ampliado)

Nuevo error, antes de crear el trabajo:

```json
{ "error": "omitted_changed", "message": "Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio." }
```

- **`409 omitted_changed`** si la lista de omitidos vigente es distinta de la que tenía la preparación (FR-012). No se crea ningún trabajo ni historial.
- Si es la misma, todo sigue igual que hoy (`202 { jobId, template }`).
- Los demás errores y su orden no cambian (`410 prepare_expired` primero; la comprobación va justo después).

## `GET /api/catalog/uncategorized` (ampliado)

Cada ítem gana `omitted: boolean`:

```json
{ "items": [{ "itemId": "2", "name": "Producto 2", "assignedSectionKey": null, "omitted": false }] }
```

- La asignación de sección de un omitido **se conserva** (`assignedSectionKey` sigue ahí) y vuelve a aplicar si se lo incluye de nuevo.
- Las rutas `PUT`/`DELETE /catalog/uncategorized/:itemId` no cambian.

## `GET /api/panel/summary` (ampliado)

`stats` gana `omitted` y cambia el significado de **un** campo:

```json
{ "stats": { "products": 197, "soldOut": 8, "uncategorized": 3, "estimatedPages": 60, "omitted": 6 } }
```

| Campo | Antes | Ahora |
| --- | --- | --- |
| `products` | activos en Alegra | **igual** |
| `soldOut` | agotados entre los activos | agotados entre los activos **no omitidos** |
| `uncategorized`, `estimatedPages`, `sections` | del constructor | igual (el constructor ya excluye a los omitidos) |
| `omitted` | — | **nuevo**: omitidos activos hoy en Alegra |

Los endpoints no-`GET` nuevos invalidan la caché de este resumen sin código extra (lo hace el middleware de `app.ts`).

## `GET /api/catalog/payload/:prepareId`

Sin cambios de forma. El payload (vista previa y vista de impresión) **no trae** los artículos omitidos de la preparación; con la lista vacía es idéntico al de hoy (FR-014).

## Garantías

| Garantía | Cómo se comprueba |
| --- | --- |
| Alegra solo se consulta con `GET`; omitir/incluir no la consulta | La prueba existente que exige `GET` en todas las peticiones a Alegra cubre también las rutas nuevas; la de `PUT`/`DELETE` no genera ninguna petición |
| Un artículo omitido no está en el payload, ni en una sección, ni en `soldOut` | Pruebas unitarias del constructor y de integración sobre `payload` y `report` |
| Lista vacía = catálogo de hoy | Prueba que compara `buildCatalog` con y sin `omittedIds` vacío |
| Combos no cambian | Prueba con un combo cuyo componente se omite: mismo precio, mismos componentes, y la alerta de agotado depende solo del stock en Alegra (con un componente disponible, omitirlo no la crea; con uno agotado, sigue igual que antes) |
| La lista de omitidos sobrevive al reinicio | Prueba con una segunda aplicación sobre la misma base de datos |
| El PDF usa la lista revisada | Prueba: preparar, cambiar la lista, `generate` → `409 omitted_changed`; sin cambio → `202` |
| Fotos de omitidos no se descargan | El simulador cuenta las peticiones a las fotos |

## Compatibilidad

- Un cliente que ignore los campos nuevos funciona igual; solo `generate` puede devolver un `409` nuevo, y la única interfaz que lo usa (Generar) ya muestra el mensaje de cualquier error.
- Las pantallas de este repositorio son los únicos clientes; se actualizan en la misma entrega.
