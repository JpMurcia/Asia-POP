# Research: Alinear a la página, altura de línea y tachado

Resuelve las decisiones técnicas del [plan](./plan.md). Parte de la [research de 003](../003-catalog-template-editor/research.md), que sigue vigente.

## 1. Compatibilidad con plantillas ya guardadas

**Hallazgo**: `template.repo.ts` lee cada plantilla con `JSON.parse(row.doc_json)` **sin validar ni migrar**, y el esquema zod (`template.schema.ts`) usa `z.object`, que **descarta en silencio las claves no declaradas**. El documento tiene `version: 1`.

- **Decisión**: las dos propiedades nuevas son **opcionales** en el documento (`lh?: number`, `strike?: boolean`). Su valor por defecto vive en **un solo lugar**, `TEXT_DEFAULTS` en `backend/src/catalog/template.ts`, y lo usan el render, el inspector y las pruebas. El esquema las declara con `.optional()` y sus rangos. El documento sigue en `version: 1`.
- **Por qué**: una plantilla vieja sin `lh` ni `strike` se dibuja con `1.05` y sin tachado, que son exactamente los valores de hoy (FR-008, FR-015, SC-003). No hace falta migración de datos ni que el usuario vuelva a guardar. Guardar una plantilla vieja sin tocar esos campos tampoco los agrega.
- **Riesgo que se cubre**: si se agregan al tipo pero no al esquema, zod los borra al guardar y el cambio "desaparece" al recargar. Una prueba de integración guarda y relee una plantilla con `lh` y `strike` (FR-014).
- **Alternativas descartadas**:
  - *Campos obligatorios + migración SQL que reescriba `doc_json`*: más código y un riesgo de corromper plantillas guardadas para obtener el mismo resultado visual.
  - *Subir a `version: 2`*: no hay cambio incompatible; una versión nueva obligaría a mantener dos lectores.
  - *Normalizar al cargar en el editor*: haría que cada plantilla vieja apareciera "con cambios sin guardar" o escribiría valores por defecto en todos los documentos sin que el usuario cambiara nada.

## 2. Altura de línea: unidad, rango y render

- **Decisión**: múltiplo sin unidad del tamaño de la letra (`line-height: 1.05`), con `RANGES.lh = [0.8, 2.5]` y paso `0.05`. En `TemplateElement.tsx`, `textStyle` cambia el `1.05` fijo por `el.lh ?? TEXT_DEFAULTS.lh`.
- **Por qué**: un valor sin unidad escala con `--fit` (el factor con que `useFit` reduce los textos con datos insertables), así que el ajuste automático sigue funcionando sin cambios en su fórmula. `lh` se agrega a las dependencias de `useFit` para que vuelva a medir al cambiarlo (caso borde de la spec).
- **Alternativas**: px fijos (no escalarían con `--fit` ni con el tamaño); porcentaje (equivalente, pero menos legible en el inspector).

## 3. Tachado: cómo se dibuja

- **Decisión**: `textDecorationLine: 'line-through'` en el mismo estilo del texto, con `textDecorationColor` por defecto (`currentColor`), es decir, el color del relleno (FR-011).
- **Por qué**: CSS tacha cada línea de un texto multilínea (spec, historia 3, escenario 2), Chrome lo exporta al PDF como un trazo vectorial y convive con `-webkit-text-stroke`, `text-shadow` (resplandor) y `text-transform` (FR-012). Como lienzo y PDF usan `TemplateElement`, la fidelidad es automática (constitución IV).
- **Por verificar en el quickstart**: con un resplandor intenso, `text-shadow` también proyecta la sombra de la línea del tachado. Es el comportamiento esperado de un texto tachado con brillo y no requiere tratamiento especial.
- **Alternativa descartada**: un `<span>` o pseudo-elemento con una línea absoluta. Más código, no sigue las líneas de un texto multilínea y rompería la paridad con el ajuste de `useFit`.

## 4. Alinear a la página: dónde vive la lógica

- **Decisión**: una acción nueva del reductor, `align`, con `edge: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'`, implementada con una función pura `alignBox(el, edge)` exportada para pruebas:
  - `left → x = 0`, `hcenter → x = (100 − w) / 2`, `right → x = 100 − w`
  - `top → y = 0`, `vcenter → y = (100 − h) / 2`, `bottom → y = 100 − h`
  - El resultado pasa por `clampBox` (FR-005) y se redondea como el resto de posiciones del editor.
- **Por qué**: las posiciones ya están en **% de la hoja** (`x, y, w, h`), así que alinear es aritmética sobre la caja sin rotar, la misma que muestran los campos del inspector (supuesto de la spec). No depende del zoom ni del DOM y se puede probar sin navegador.
- **Historial (FR-004)**: la acción registra un paso con `record(s, null, now)` (sin clave de fusión: dos clics seguidos son dos pasos). Si `x`/`y` no cambian, el reductor devuelve el **mismo estado** y no agrega un paso vacío.
- **Bloqueados (FR-003)**: el reductor ignora `align` sobre un elemento bloqueado (defensa en profundidad), y el inspector deshabilita los botones con un `title` que explica el motivo, el mismo criterio que ya aplican las flechas del teclado (`index.tsx`).
- **Alternativa descartada**: reutilizar `patch` desde el inspector calculando `x`/`y` en el componente. Funciona, pero dispersa la regla, no evita el paso vacío y no se puede probar como función pura.

## 5. Interfaz del inspector

- **Altura de línea**: un descriptor `range` más en `inspector-fields.ts`, en la sección Tipografía, después de "Espaciado". El descriptor `range` gana un campo opcional `fallback` para mostrar el valor por defecto cuando la propiedad no existe. Hereda la fusión de un deslizamiento en un solo paso (FR-009).
- **Tachado**: un descriptor `toggle` después de "Mayúsculas". `FieldRenderer` ya trata `undefined` como apagado.
- **Alinear**: una fila de seis botones de ícono con `aria-label` en español, en un componente pequeño `AlignActions`, colocado en `Inspector.tsx` bajo las acciones del elemento. No es un campo: no escribe una propiedad, despacha `align`. Íconos en SVG en línea (seis trazos simples) para no sumar dependencias (constitución VI). Lucide se evaluará cuando se rediseñe el riel completo.

## 6. Pruebas

| Nivel | Qué | Dónde |
| --- | --- | --- |
| Unidad (reductor) | `alignBox` en las seis direcciones, con elementos más grandes que la hoja, `clampBox`, bloqueado ignorado, paso vacío no registrado, deshacer y rehacer | `frontend/tests/template-editor-reducer.test.ts` |
| Componente | Inspector: control de altura de línea (rango, valor por defecto 1,05 en un texto sin `lh`), interruptor de tachado, seis botones y deshabilitados si está bloqueado; el lienzo refleja `line-height` y `line-through` | `frontend/tests/template-editor-inspector.test.tsx`, `template-page.test.tsx` |
| Integración (API) | Guardar y releer `lh`/`strike`; rechazar `lh` fuera de rango o `strike` no booleano con la ruta del campo (FR-016); una plantilla sin los campos se guarda sin agregarlos | `backend/tests/integration/templates.test.ts` |
| Chrome real | Fidelidad editor ↔ PDF de `line-height` y `text-decoration` (FR-013, SC-004) | `backend/tests/integration/pdf-template-fidelity.test.ts` |
| Regresión visual | Las 4 plantillas base generan el mismo PDF que antes (SC-003) | quickstart, escenario 6 |

## Resumen de incógnitas

| Incógnita | Resolución |
| --- | --- |
| ¿Migrar plantillas guardadas? | No: campos opcionales con valores por defecto centralizados (§1) |
| Unidad y rango de altura de línea | Múltiplo sin unidad, 0,8–2,5, paso 0,05, por defecto 1,05 (§2) |
| ¿Tachado compatible con contorno, resplandor y ajuste? | Sí, con `text-decoration` CSS (§3) |
| ¿Alinear considerando la rotación? | No: caja sin rotar, como el inspector (§4) |
| ¿Librerías nuevas? | Ninguna (§5) |
