# Data Model: Ajustes avanzados de texto

No hay tablas ni migraciones. Todo vive en el JSON de la plantilla (`catalog_template.doc_json`, `version: 1`) y en el estado del editor.

## TextEl (elemento de texto) — cambios

| Campo | Tipo | Antes | Ahora | Por defecto si falta |
|-------|------|-------|-------|----------------------|
| `lh` | número, opcional | 0,8 – 2,5 | **0,5 – 2,5** (paso de edición 0,01) | `TEXT_DEFAULTS.lh = 1,05` (sin cambio) |
| `ls` | número, **obligatorio** | −2 – 12 | **−10 – 60** (paso de edición 0,1), en **píxeles** | — (las plantillas ya lo traen; 0 en el control nuevo) |
| `vAlign` | `'top' \| 'middle' \| 'bottom'`, opcional | no existía | **nuevo** | `TEXT_DEFAULTS.vAlign = 'middle'` |

Reglas de validación (zod, `template.schema.ts`):

- `lh` y `ls` leen sus rangos de `RANGES`; el mensaje sigue siendo el de hoy («La altura de línea…», «El espaciado…»).
- `vAlign` es un enum opcional con el mismo tipo de mensaje que `align` («La alineación vertical…»). Un valor distinto de los tres se rechaza al guardar (FR-017).
- `z.object` descarta las claves desconocidas: `vAlign` **debe** declararse en el esquema o se perdería al guardar.

Compatibilidad:

- Ningún valor guardado antes queda fuera de los rangos nuevos (los contienen por completo) y ninguno cambia de significado: sin conversión ni migración.
- Una plantilla sin `vAlign` se lee como `middle` y se dibuja igual que antes; la copia o duplicado de un texto conserva `vAlign` (se clona el elemento entero).

## `TEXT_DEFAULTS`

`{ lh: 1.05, strike: false, vAlign: 'middle' }` — único lugar donde viven los valores por defecto de los opcionales de texto.

## `RANGES`

| Clave | Valor nuevo | Observación |
|-------|-------------|-------------|
| `lh` | `[0.5, 2.5]` | Lo comparte `descLh` (descripción del bloque de productos). |
| `ls` | `[-10, 60]` | Solo textos. |

## Estado del editor (no se guarda)

- **Panel «Configuración avanzada» abierto/cerrado**: booleano en el componente `Inspector`, `false` al abrir el editor; sobrevive al cambio de elemento y se pierde al salir (FR-011).
- **Historial**: un parche de texto con valores recortados que no cambian nada no agrega paso (FR-016); un arrastre del deslizador sigue agrupándose por `mergeKey`.

## Transiciones del valor de un control numérico

`escribir texto` → (coma→punto, vacío o no numérico: se descarta y se restaura el valor guardado) → número → **recorte** al rango → **redondeo** (lh a 2 decimales, ls a 1) → parche → (si no difiere del valor actual: sin historia).
