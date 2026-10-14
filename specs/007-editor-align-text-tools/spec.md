# Feature Specification: Alinear a la página, altura de línea y tachado en el editor de plantillas

**Feature Branch**: `007-editor-align-text-tools` (el nombre solo identifica la feature; el trabajo se desarrolla en la rama asignada a la sesión)

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Mejoras del editor de plantillas tomadas del inventario de Canva (docs/specs/canva-fields-inventory.md, sección 6, ítems 1 a 3): (1) altura de línea ajustable en los elementos de texto; (2) alinear el elemento seleccionado a la página con seis acciones: arriba, centro vertical, abajo, izquierda, centro horizontal, derecha; (3) tachado en los elementos de texto, por ejemplo para mostrar un precio anterior en promociones. Lo que se vea en el lienzo debe verse igual en la vista previa y en el PDF; los cambios se pueden deshacer y rehacer; las plantillas guardadas antes de esta feature deben seguir viéndose idénticas."

Esta feature **continúa** la `003` (editor visual de plantillas). No cambia reglas de catálogo, precios, stock, secciones, combos, omisiones ni la generación del PDF: solo agrega tres controles de diseño al editor. Los tres se eligieron en el [inventario de campos de Canva](../../docs/specs/canva-fields-inventory.md) por ser los de mayor valor para el catálogo con menor costo.

## Punto de partida

- Un **texto** del editor tiene fuente, tamaño, peso, alineación, espaciado entre letras, mayúsculas, relleno, contorno y resplandor. Su **altura de línea es fija**: los textos de varias líneas (eslóganes, avisos, condiciones de una promoción) quedan con las líneas muy juntas y no se pueden separar.
- Para **centrar o pegar un elemento a un borde** hay que arrastrarlo. Solo existe el ajuste al centro mientras se arrastra, o escribir a mano la posición en %, que no tiene en cuenta el tamaño del elemento.
- **No hay manera de tachar un texto.** Las promociones necesitan mostrar un precio anterior tachado junto al precio nuevo ("~~$25.000~~ $19.900"), un recurso habitual en catálogos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alinear un elemento a la página (Priority: P1)

El administrador selecciona cualquier elemento de la página (título, texto, insignia, forma, imagen o bloque automático) y, con un solo clic, lo pega al borde superior, inferior, izquierdo o derecho de la hoja, o lo centra horizontal o verticalmente. No necesita arrastrar ni hacer cuentas.

**Why this priority**: Es la acción que más tiempo ahorra en todas las páginas y con todos los tipos de elemento, y da una composición más prolija: los títulos y logos quedan exactamente centrados.

**Independent Test**: en Portada, seleccionar un título y pulsar cada una de las seis acciones; comprobar que el título queda en la posición esperada respecto de la hoja; deshacer y comprobar que vuelve a donde estaba; guardar, recargar y generar el PDF, y comprobar que la posición coincide.

**Acceptance Scenarios**:

1. **Given** un elemento seleccionado y desbloqueado, **When** el usuario pulsa "Centrar horizontalmente", **Then** el centro horizontal del elemento coincide con el centro horizontal de la hoja y su posición vertical no cambia.
2. **Given** un elemento seleccionado y desbloqueado, **When** pulsa "Centrar verticalmente", **Then** el centro vertical del elemento coincide con el centro vertical de la hoja y su posición horizontal no cambia.
3. **Given** un elemento seleccionado y desbloqueado, **When** pulsa "Izquierda", "Derecha", "Arriba" o "Abajo", **Then** el borde correspondiente del elemento queda sobre el borde correspondiente de la hoja y el otro eje no cambia.
4. **Given** un elemento alineado, **When** el usuario pulsa deshacer, **Then** vuelve a la posición anterior en un solo paso; y **When** pulsa rehacer, **Then** vuelve a quedar alineado.
5. **Given** un elemento **bloqueado** (incluidos los bloques automáticos mientras están bloqueados), **When** el usuario mira las acciones de alineación, **Then** aparecen deshabilitadas con una indicación de que el elemento está bloqueado, igual que hoy no se puede arrastrar.
6. **Given** ningún elemento seleccionado, **When** el usuario mira el inspector, **Then** las acciones de alineación no se muestran: el inspector muestra los campos de fondo de página, como hoy.
7. **Given** un elemento alineado y la plantilla guardada, **When** se genera el catálogo, **Then** el elemento ocupa en el PDF la misma posición que en el lienzo.

---

### User Story 2 - Ajustar la altura de línea de un texto (Priority: P2)

El administrador selecciona un texto de varias líneas y, desde el inspector, separa o junta sus líneas con un control deslizante. El cambio se ve al instante en el lienzo y se mantiene en la vista previa y en el PDF.

**Why this priority**: Corrige un problema de legibilidad real en textos de varias líneas, pero afecta a menos elementos que la alineación.

**Independent Test**: agregar un texto de tres líneas, mover el control de altura de línea al mínimo y al máximo, comprobar que las líneas se juntan y se separan; deshacer el ajuste completo en un paso; guardar y comprobar el PDF.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** el usuario abre el inspector, **Then** ve un control "Altura de línea" junto al de espaciado entre letras, con el valor actual del texto.
2. **Given** un texto de varias líneas, **When** el usuario sube o baja la altura de línea, **Then** la distancia entre líneas cambia al instante en el lienzo y el resto de propiedades (tamaño, fuente, alineación) no cambia.
3. **Given** el control deslizado de un extremo al otro en un solo gesto, **When** el usuario pulsa deshacer, **Then** el texto vuelve a su altura de línea anterior en un solo paso.
4. **Given** un texto con altura de línea modificada y la plantilla guardada, **When** se genera el catálogo, **Then** el texto del PDF muestra las líneas con la misma separación y los mismos cortes de línea que el lienzo.
5. **Given** un texto nuevo agregado desde Elementos, **When** aparece en el lienzo, **Then** su altura de línea es la misma que tienen los textos actuales, para que se vea igual que hoy.

---

### User Story 3 - Tachar un texto (Priority: P3)

El administrador marca un texto como **tachado**, por ejemplo un precio anterior, y lo coloca junto al precio de promoción. El tachado respeta el color del texto y se ve igual en el lienzo, en la vista previa y en el PDF.

**Why this priority**: Es valioso para promociones, pero se usa en menos plantillas que los otros dos controles.

**Independent Test**: agregar un texto "$25.000", activar Tachado, comprobar que se dibuja una línea que lo atraviesa del color del texto; desactivarlo; deshacer y rehacer; guardar y comprobar el PDF.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** el usuario activa "Tachado" en el inspector, **Then** todo el texto del elemento queda atravesado por una línea horizontal del mismo color que el texto.
2. **Given** un texto tachado con varias líneas, **When** se muestra, **Then** cada línea queda tachada.
3. **Given** un texto tachado, **When** el usuario lo desactiva o pulsa deshacer, **Then** el texto se muestra sin tachar.
4. **Given** un texto tachado que además tiene contorno, resplandor o mayúsculas, **When** se muestra, **Then** esos efectos se conservan y el tachado sigue siendo visible.
5. **Given** un texto tachado y la plantilla guardada, **When** se genera el catálogo, **Then** el PDF muestra el texto tachado.

---

### Edge Cases

- **Plantillas guardadas antes de esta feature**: se abren y se generan **idénticas** a como se veían: sus textos conservan la altura de línea de siempre y ninguno aparece tachado. No hace falta que el usuario vuelva a guardar nada.
- **Elemento más grande que la hoja**: alinear sigue la misma regla (por ejemplo, "Izquierda" pone su borde izquierdo en el borde de la hoja aunque sobresalga por la derecha). No se cambia su tamaño.
- **Elemento rotado**: la alineación usa la caja del elemento sin rotar (la misma que muestran los números de posición del inspector), así que un elemento rotado puede sobresalir un poco del borde. Se documenta en Supuestos.
- **Elemento ya alineado**: pulsar la misma acción otra vez no cambia nada y no agrega un paso vacío al historial.
- **Elemento oculto**: si está seleccionado, se puede alinear igual que uno visible.
- **Texto con datos insertables** (por ejemplo `{telefonos}`): hoy esos textos reducen su letra para caber en su caja. Al subir la altura de línea, el texto puede reducirse más para seguir cabiendo, con el mismo mínimo legible de 6 pt y la misma advertencia que ya existe.
- **Tachado sobre texto vacío**: no dibuja nada y no produce error.
- **Escribir en un campo**: las acciones de alineación no tienen atajo de teclado en esta feature, así que no interfieren con la escritura (los atajos de la 003 no cambian).

## Requirements *(mandatory)*

### Functional Requirements

#### Alinear a la página

- **FR-001**: Con un elemento seleccionado, el inspector MUST ofrecer seis acciones de alineación respecto de la hoja: Izquierda, Centrar horizontalmente, Derecha, Arriba, Centrar verticalmente y Abajo.
- **FR-002**: Cada acción MUST mover el elemento solo en su eje, sin cambiar su tamaño, rotación ni ninguna otra propiedad: las tres horizontales cambian solo la posición horizontal y las tres verticales solo la vertical.
- **FR-003**: Las acciones MUST estar disponibles para todos los tipos de elemento (texto, insignia, forma, imagen y bloques automáticos), y MUST estar deshabilitadas, con una indicación visible del motivo, mientras el elemento esté bloqueado.
- **FR-004**: Cada acción MUST contar como **un** paso de deshacer y rehacer, y una acción que no cambia la posición MUST NOT agregar un paso.
- **FR-005**: El resultado de una alineación MUST quedar dentro de los rangos de posición que el editor ya admite.

#### Altura de línea

- **FR-006**: Todo elemento de texto MUST tener una propiedad **altura de línea** editable desde el inspector con un control deslizante, en la sección Tipografía.
- **FR-007**: La altura de línea MUST expresarse como múltiplo del tamaño de la letra, entre **0,8 y 2,5** con pasos de **0,05**, y el control MUST mostrar el valor actual.
- **FR-008**: El valor por defecto de la altura de línea, tanto en textos nuevos como en textos de plantillas guardadas antes de esta feature, MUST ser el mismo que el editor usa hoy (1,05), de modo que ningún texto existente cambie su aspecto.
- **FR-009**: Un ajuste continuo del control (deslizar sin soltar) MUST contar como un solo paso de deshacer, igual que los demás controles deslizantes del editor.

#### Tachado

- **FR-010**: Todo elemento de texto MUST tener una opción **Tachado** (activado/desactivado) en el inspector, desactivada por defecto en textos nuevos y en textos de plantillas existentes.
- **FR-011**: Con el tachado activado, el sistema MUST dibujar una línea que atraviese todo el texto del elemento, cada línea si son varias, del mismo color que el relleno del texto.
- **FR-012**: El tachado MUST convivir con las demás propiedades del texto (mayúsculas, contorno, resplandor, alineación, espaciado, altura de línea) sin desactivarlas.

#### Comunes

- **FR-013**: La altura de línea y el tachado MUST verse **idénticos** en el lienzo, en las miniaturas, en la vista previa y en el PDF generado, con los mismos cortes de línea.
- **FR-014**: La altura de línea y el tachado MUST guardarse con la plantilla y conservarse al recargar el editor, al duplicar el texto o la plantilla y al cambiar de plantilla y volver.
- **FR-015**: Las plantillas guardadas antes de esta feature MUST abrirse, mostrarse y generarse sin ningún cambio visual y sin requerir una acción del usuario.
- **FR-016**: Al guardar, el sistema MUST rechazar una altura de línea fuera de rango o un valor de tachado que no sea activado/desactivado, con el mismo tipo de mensaje de validación que ya muestra para otras propiedades.

### Key Entities

- **Elemento de texto** (ya existe): suma dos propiedades, **altura de línea** (número, 0,8–2,5, por defecto 1,05) y **tachado** (sí/no, por defecto no). Las demás propiedades no cambian.
- **Elemento de página** (todos los tipos, ya existe): sin propiedades nuevas. La alineación solo modifica su posición horizontal o vertical existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Centrar un elemento en la hoja toma **un clic** después de seleccionarlo (hoy requiere arrastrar hasta la guía o calcular la posición a mano).
- **SC-002**: Tras cada una de las seis acciones, el borde o centro alineado del elemento queda a menos de **0,1 %** del ancho o alto de la hoja de su posición ideal.
- **SC-003**: Las **4 plantillas base** y cualquier plantilla guardada antes de esta feature producen un PDF visualmente idéntico al de antes (comparación página a página sin diferencias).
- **SC-004**: Un texto con altura de línea y tachado modificados muestra **los mismos cortes de línea** y la misma separación en el lienzo y en el PDF, en las cuatro plantillas base.
- **SC-005**: Un cambio de altura de línea o de tachado se ve en el lienzo en **menos de 0,2 segundos**, la misma meta que el resto de controles del editor (SC-008 de la 003).
- **SC-006**: El administrador puede componer un precio anterior tachado junto a un precio de promoción en **menos de 1 minuto** sin herramientas externas.

## Assumptions

- **Referencia de la alineación**: se alinea a la **hoja** completa (no a márgenes ni a otros elementos). Alinear varios elementos entre sí requiere selección múltiple, que el editor no tiene y queda fuera de alcance.
- **Elementos rotados**: la alineación usa la caja sin rotar, la misma que muestran los campos de posición del inspector. Es la regla más predecible para el usuario y no requiere cambiar cómo se guardan las posiciones.
- **Tachado de todo el elemento**: se tacha el texto completo del elemento, no palabras sueltas, porque el editor no tiene formato por fragmentos. Para tachar solo un precio se usa un texto propio para ese precio.
- **Solo elementos de texto**: altura de línea y tachado aplican a los elementos de texto. Insignias, pie y bloques automáticos no cambian en esta feature.
- **Sin atajos de teclado nuevos**: las seis acciones se usan desde el inspector. Agregar atajos se puede evaluar después.
- **Rango de altura de línea**: 0,8–2,5 cubre desde títulos compactos hasta párrafos aireados. Por debajo de 0,8 las líneas se montan entre sí.
- **Sin dependencias nuevas** (constitución VI): son propiedades y acciones sobre el modelo de plantilla y el inspector que ya existen.
- **Fidelidad editor ↔ PDF** (constitución IV): se cumple porque lienzo, vista previa y PDF siguen dibujando con un único componente de página. Las pruebas de fidelidad de la 003 se extienden a las propiedades nuevas.
- **Fuera de alcance**: selección múltiple, alinear entre elementos, distribuir espaciado, alinear a márgenes, subrayado, formato por palabras y el resto de campos del inventario de Canva.
