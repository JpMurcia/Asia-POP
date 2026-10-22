# Research: Ajustes avanzados de texto

No quedó ninguna marca `NEEDS CLARIFICATION`. Estas son las decisiones tomadas al leer el código; REA no hizo falta (los rangos y la organización ya están medidos en la spec).

## R1. El anclaje por defecto es «Centro», no «Arriba»

- **Decisión**: la ausencia de `vAlign` significa `middle` y se dibuja exactamente como hoy; `top` y `bottom` son los valores nuevos.
- **Qué se encontró**: `.tpl-text-box` (`frontend/src/print/template.css`) es una caja flex con `align-items: center`, y todos los textos (con o sin datos insertables) van dentro. Es decir, el editor **ya centra** el texto en vertical. La spec decía «desde arriba».
- **Por qué**: FR-015 exige que ninguna plantilla guardada cambie (PDF idéntico byte a byte). Si el valor por defecto fuera «Arriba», todo texto de una caja más alta que su contenido se movería. Se corrigió la spec (Estado actual, US3, FR-007–FR-009, SC-004, Assumptions).
- **Alternativas**: dejar «Arriba» como defecto y escribir `vAlign: 'middle'` en todas las plantillas existentes con una migración — rechazada: cambia el JSON guardado de todos y arriesga la identidad del PDF por un efecto que no se pidió.

## R2. Nombre y valores de la propiedad

- **Decisión**: `vAlign?: 'top' | 'middle' | 'bottom'`; etiquetas «Arriba», «Centro», «Abajo» (como `align` usa `left | center | right`).
- **Por qué**: nombre corto y en línea con `align`; el valor por defecto vive solo en `TEXT_DEFAULTS` (patrón de la 007 para `lh` y `strike`), de modo que el render, el inspector y las pruebas leen el mismo dato.
- **Alternativas**: `anchor: 'start' | 'center' | 'end'` (vocabulario de Canva «comienzo/medio/final») — rechazada: se confunde con `align` horizontal y con `justify`.

## R3. Cómo se dibuja el anclaje

- **Decisión**: `style={{ alignItems }}` en `.tpl-text-box` (`flex-start | center | flex-end`), puesto **solo** cuando `vAlign` existe y no es `middle`.
- **Por qué**: sin el campo, el marcado y el CSS son idénticos a los de hoy (byte a byte); con el campo, la caja ya es flex. `useFit` mide `.tpl-text` (alto máximo 100 % de la caja), de modo que el ajuste automático no depende del anclaje (el texto cabe igual arriba, al medio o abajo).
- **Alternativas**: cambiar el CSS global a `align-items: var(--v)` — rechazada: toca todos los textos y obliga a revisar la línea base.

## R4. Rangos

- **Decisión**: `RANGES.lh = [0.5, 2.5]` (paso 0,01) y `RANGES.ls = [-10, 60]` (paso 0,1), ambos en píxeles/múltiplos como hoy. Decisión del responsable del 2026-10-22 (FR-004): el interletrado sigue en **píxeles**, sin adoptar la unidad de Canva (milésimas del tamaño).
- **Por qué**: ambos contienen por completo el rango anterior (−2…12 y 0,8…2,5), así que nada guardado queda fuera de rango ni se convierte. El esquema (`num(RANGES.x)`) y `descLh` del bloque de productos leen esas constantes, por lo que se ensanchan solos.
- **Efecto en pruebas**: las pruebas que fijan el máximo anterior (0,8 / −2 / 12 / paso 0,05 / 0,5) se actualizan; ninguna debe depender de rechazar valores que ahora son válidos.

## R5. Campo numérico + deslizador

- **Decisión**: el descriptor `range` gana `numeric?: true`; `FieldRenderer` dibuja, junto al deslizador, un campo de texto con la misma lógica de `NumberField` (coma o punto, vacío o letras restauran el valor, recorte al rango al confirmar con Enter o al salir). El valor se guarda con el paso de redondeo del control (2 decimales en `lh`, 1 en `ls`).
- **Por qué**: ya existe `NumberField` para «Ancho %» y «Alto %»; no se crea otro componente de entrada. El deslizador conserva su `mergeKey`, por lo que un arrastre cuenta como un paso de deshacer (FR-016).
- **Alternativas**: reemplazar el deslizador por un campo — rechazada: la referencia y FR-011 piden ambos sincronizados.

## R6. Recorte y «sin cambio» en el reductor

- **Decisión**: en `case 'patch'` de `useTemplateEditor.ts`, para elementos de texto: (a) recortar `lh` y `ls` a `RANGES` y redondearlos; (b) si, tras recortar, ningún valor del parche difiere del elemento, devolver el estado sin agregar historia.
- **Por qué**: hoy el reductor no recorta (los controles lo hacían con `min`/`max` del deslizador) y registra un paso aunque no cambie nada. Con un campo de texto libre ambos casos se vuelven alcanzables (FR-003, FR-016). Se limita a texto para no alterar el historial de otros elementos.
- **Alternativas**: validar solo en el campo — rechazada: el reductor es el único punto que también cubre atajos y acciones futuras.

## R7. Panel «Configuración avanzada»

- **Decisión**: nuevo descriptor `{ kind: 'section'; id; label; fields: FieldDesc[] }` que `FieldRenderer` dibuja como un `<details>`-estilo (botón con `aria-expanded` + región). Solo el texto lo usa. Cerrado por defecto; el estado abierto/cerrado vive en `Inspector` (no se desmonta al cambiar de elemento, a diferencia de `FieldRenderer`, que lleva `key={el.id}`) y se pierde al salir del editor.
- **Por qué**: cumple FR-010–FR-012 con un descriptor genérico que la 009 (selectores de color y fuente) podrá reutilizar, sin guardar nada en la plantilla. Texto bloqueado: los controles ya se deshabilitan por el estado del elemento, y el panel hereda esa indicación.
- **Alternativas**: guardar el estado del panel en la plantilla — rechazada: no es un dato del diseño. `localStorage` — rechazada: la spec dice «mientras se edita la plantilla».

## R8. Cosas que no cambian

- `descLh` (altura de línea de la descripción de productos) comparte `RANGES.lh`: se ensancha sin tocar su inspector.
- Insignias y otros elementos no tienen estos ajustes; el panel no aparece (FR-012).
- El valor inicial de la referencia (altura 1, anclaje «comienzo») **no** se adopta (FR-002, FR-008): lo decide el responsable.
