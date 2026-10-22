# Data Model: Alinear a la página, altura de línea y tachado

Cambios sobre el modelo de plantilla de la [003](../003-catalog-template-editor/data-model.md). Todo lo demás queda igual. **Sin cambios en SQLite**: la plantilla se sigue guardando como JSON en `catalog_template.doc_json`, y el documento conserva `version: 1`.

## TextEl (elemento de texto): dos propiedades opcionales nuevas

| Campo | Tipo | Rango / valores | Por defecto si falta | Regla |
| --- | --- | --- | --- | --- |
| `lh` | número | `RANGES.lh = [0.8, 2.5]`, paso 0,05 | `TEXT_DEFAULTS.lh = 1.05` | Múltiplo del tamaño de la letra. Se aplica como `line-height` sin unidad |
| `strike` | booleano | `true` / `false` | `TEXT_DEFAULTS.strike = false` | `true` tacha todo el texto del elemento, del color del relleno |

- **Opcionales a propósito** ([research §1](./research.md#1-compatibilidad-con-plantillas-ya-guardadas)): una plantilla guardada antes de esta feature no las tiene y se dibuja igual que hoy.
- `TEXT_DEFAULTS` se exporta desde `backend/src/catalog/template.ts`. Es la **única** fuente del valor por defecto para el render, el inspector y las pruebas.
- `draftText` (textos nuevos) **no** escribe estos campos: un texto nuevo hereda los valores por defecto por el mismo camino que uno viejo (historia 2, escenario 5).
- Duplicar un texto o una plantilla copia el objeto completo, así que los campos se conservan (FR-014).

### Validación (servidor, `template.schema.ts`)

| Campo | Regla zod | Mensaje |
| --- | --- | --- |
| `lh` | `num(RANGES.lh, 'La altura de línea').optional()` | "La altura de línea: el mínimo es 0.8." / "…el máximo es 2.5." / "La altura de línea debe ser un número." |
| `strike` | `z.boolean({ error: 'Debe ser verdadero o falso.' }).optional()` | "Debe ser verdadero o falso." |

Los errores llevan la ruta del campo, como el resto (por ejemplo `templates[0].pages.portada.els[2].lh`) (FR-016).

## Posición del elemento (todos los tipos): sin campos nuevos

La alineación solo reescribe `x` o `y` (% de la hoja), dentro de `RANGES.x` / `RANGES.y` mediante `clampBox`. Ver la acción `align` en el [contrato del editor](./contracts/editor-actions.md).

| Acción | Nuevo valor | Eje que no cambia |
| --- | --- | --- |
| `left` | `x = 0` | `y` |
| `hcenter` | `x = (100 − w) / 2` | `y` |
| `right` | `x = 100 − w` | `y` |
| `top` | `y = 0` | `x` |
| `vcenter` | `y = (100 − h) / 2` | `x` |
| `bottom` | `y = 100 − h` | `x` |

## Transiciones de estado del editor

```text
elemento seleccionado y desbloqueado ──align(edge)──▶ x|y nuevos ──▶ +1 paso en el historial
                                     └─ x|y iguales ─▶ estado sin cambios (sin paso)
elemento bloqueado ──align(edge)──▶ estado sin cambios (botones deshabilitados en la interfaz)
```
