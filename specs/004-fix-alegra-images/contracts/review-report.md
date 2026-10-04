# Contrato: informe de revisión con estado de las fotos

**Feature**: `004-fix-alegra-images` | **Cambio**: aditivo; ningún campo existente cambia ni se elimina

## Dónde aparece

Toda respuesta que incluye `report`:

- `POST /api/catalog/prepare` → `{ prepareId, report, structure, availableSections, options }`
- `PUT /api/catalog/prepare/:prepareId/options` → igual (recalcula sin consultar Alegra; conserva los motivos de la preparación)

Ambas exigen sesión, como todas las rutas.

## Forma

```jsonc
{
  "report": {
    "uncategorized": [],
    "omittedNoImage": [
      { "source": "alegra", "id": "1042", "name": "Producto sin foto en Alegra" },
      { "source": "alegra", "id": "1043", "name": "Producto con foto no obtenida" }
    ],
    "omittedNoSection": [],
    "soldOutBundles": [],
    "counts": { "included": 180, "omitted": 2, "soldOut": 3 },
    "emptyCatalog": false,

    // NUEVO
    "photos": {
      "informed": 181,
      "obtained": 180,
      "notObtained": [
        { "id": "1043", "name": "Producto con foto no obtenida", "reason": "unauthorized" }
      ],
      "allFailed": false
    }
  }
}
```

## Campos nuevos

| Campo | Tipo | Regla |
| --- | --- | --- |
| `photos.informed` | entero ≥ 0 | Productos activos (sin padres de variantes) con alguna foto informada por Alegra |
| `photos.obtained` | entero ≥ 0, ≤ `informed` | Los de ese grupo con foto utilizable |
| `photos.notObtained[]` | `{ id: string, name: string, reason: PhotoFailureReason }` | Solo productos de Alegra de las secciones seleccionadas; cada uno **también** está en `omittedNoImage` |
| `photos.allFailed` | booleano | `informed > 0 && obtained === 0` |

`reason` toma uno de: `unauthorized`, `not_found`, `timeout`, `not_image`, `unsupported_format`, `too_large`, `unavailable` (textos en [data-model.md](../data-model.md)).

## Garantías

- `omittedNoImage` y `counts.omitted` **no cambian de valor**: los productos con foto no obtenida siguen contando como omitidos.
- Los productos "sin foto en Alegra" = elementos de `omittedNoImage` con `source: "alegra"` cuyo `id` **no** está en `photos.notObtained`.
- **Nunca** aparece la dirección de una foto, ni firmada ni sin firmar, ni credenciales, en el informe ni en ningún otro campo de estas respuestas (principio III). Lo verifica una prueba de integración que busca `Signature=` y la URL de origen en el cuerpo.
- Un fallo de Alegra al listar sigue devolviendo el error actual (401/429/inalcanzable) sin informe.

## Comportamiento de la pantalla Generar (frontend)

| Condición | Aviso |
| --- | --- |
| `photos.allFailed` | **Error** destacado: "No se pudo obtener ninguna foto de Alegra". Texto: es probable que sea un problema general (la conexión o los enlaces de las fotos) y no de cada producto; vuelve a preparar el catálogo y, si sigue igual, revisa la conexión con Alegra |
| `photos.notObtained.length > 0` | **Advertencia**: "N producto(s) con foto en Alegra que no se pudo obtener", con una lista `Nombre — motivo` (hasta 30, como las demás listas) |
| `omittedNoImage` sin los de `notObtained` | **Advertencia** existente: "N producto(s) omitidos por no tener imagen" (incluye productos de Alegra sin foto, productos propios y combos sin imagen) |

Los textos de los motivos salen de `backend/src/catalog/photo-reasons.ts`, que el frontend importa; sin códigos HTTP ni jerga.

## Compatibilidad

- Los clientes que ignoren `photos` siguen funcionando igual que antes.
- Las pruebas del frontend que construyen un `report` a mano (`generate.test.tsx`, `parity.test.tsx`) deben añadir `photos` porque el tipo lo exige.
