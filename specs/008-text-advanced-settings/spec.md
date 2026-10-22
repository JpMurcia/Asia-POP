# Feature Specification: Ajustes avanzados de texto en el editor de plantillas

**Feature Branch**: `008-text-advanced-settings`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Feature 008: ajustes finos de texto en el editor de plantillas de Asia-POP, basados en mediciones reales de Canva hechas con REA. Interlineado con rango 0,5–2,5 y paso 0,01, manteniendo el valor por defecto actual para no alterar plantillas guardadas; interletrado ampliado (rango −200 a 800); anclaje vertical de la caja de texto (comienzo, medio, final); y un panel «Configuración avanzada» en el inspector de texto que agrupe los tres. Las plantillas existentes deben verse y exportarse a PDF exactamente igual."

## Evidencia de referencia (medida con REA)

Las cifras de esta feature salen de mediciones reales del editor de Canva, hechas con REA sobre una plantilla de prueba el 2026-10-22. Solo se observó la interfaz ya dibujada. De Canva se toman patrones y medidas; **no** se copian assets, íconos ni textos. El detalle y las capturas están en `docs/specs/rea-evidence/README.md`, y la comparación con la feature 007 en `specs/007-editor-align-text-tools/research.md` (sección «Revisión con REA»).

| Ajuste | Valor medido en Canva | Cómo se midió |
| --- | --- | --- |
| Interlineado | Mínimo 0,5, máximo 2,5, paso 0,01; valor inicial 1 | Teclas Inicio y Fin sobre el deslizador, y escribiendo valores en el campo: 1,05 se acepta tal cual y 9 se recorta a 2,5 |
| Interletrado | De −200 a 800, paso 1; valor inicial 0 | Teclas Inicio y Fin sobre el deslizador |
| Anclaje de la caja de texto | Tres botones: comienzo, medio y final | Árbol de accesibilidad del panel «Configuración avanzada» |
| Agrupación | Interletrado, interlineado y anclaje viven juntos en un panel «Configuración avanzada», abierto desde la barra de texto; cada control tiene deslizador y campo numérico | Captura del panel y árbol de accesibilidad |

**No verificado**: la unidad exacta del interletrado de Canva (se infiere que es milésimas del tamaño de la letra) y cualquier medida en píxeles del panel.

## Estado actual del editor

- **Altura de línea** (feature 007): de 0,8 a 2,5, paso 0,05, valor por defecto 1,05. Está dentro de la sección Tipografía del inspector.
- **Espaciado entre letras**: ya existe como «Espaciado», en píxeles, de −2 a 12 con paso 0,5, valor por defecto 0. Las plantillas base lo usan (por ejemplo 0,4; 2 y 3).
- **Anclaje vertical**: no existe como ajuste. Hoy el texto **siempre se centra verticalmente** dentro de su caja (la caja del texto es flexible con centrado vertical, `.tpl-text-box`); no se coloca desde arriba. *Corrección hecha en la planificación (2026-10-22), al leer el código: la primera versión de esta spec decía «desde arriba».*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ajustar la altura de línea con más libertad (Priority: P1)

Quien administra el catálogo quiere apretar mucho un título de varias líneas, o separar mucho un párrafo, más allá de lo que hoy permite el editor. Hoy la altura de línea no baja de 0,8 y avanza de a 0,05. Con esta mejora el control cubre de 0,5 a 2,5 y avanza de a 0,01, como el de la referencia medida.

**Why this priority**: Es el cambio de mayor uso diario, no necesita ningún dato nuevo en las plantillas (la propiedad ya existe) y entrega valor por sí solo.

**Independent Test**: Se prueba completo seleccionando un texto de tres líneas, llevando la altura de línea a 0,5, a 1,37 y a 2,5, y comprobando que el lienzo y el PDF muestran lo mismo.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** la persona lleva la altura de línea al mínimo, **Then** el valor mostrado es 0,5 y las líneas del texto se acercan visiblemente.
2. **Given** un texto seleccionado, **When** escribe 1,37 en el campo numérico, **Then** el valor se acepta con sus dos decimales y el lienzo se actualiza.
3. **Given** un texto seleccionado, **When** escribe un valor fuera de rango (por ejemplo 9 o 0,1), **Then** el valor se ajusta al límite más cercano y la persona ve el valor final.
4. **Given** una plantilla guardada antes de esta feature, **When** se abre y se genera el PDF, **Then** todos sus textos se ven exactamente igual que antes.

---

### User Story 2 - Separar o juntar las letras con un rango más amplio (Priority: P2)

La persona quiere un título con las letras muy separadas (estilo etiqueta o sello) o muy juntas. El «Espaciado» actual llega a 12 píxeles y baja solo a −2, y avanza de a 0,5, lo que se queda corto para títulos grandes. Con esta mejora el control cubre el rango medido en la referencia y avanza en pasos finos, sin romper ningún texto guardado.

**Why this priority**: Amplía una propiedad que ya existe y se usa en las plantillas base; es útil pero menos frecuente que la altura de línea.

**Independent Test**: Se prueba completo con un título grande: separar las letras al máximo, juntarlas al mínimo, guardar, recargar y generar el PDF.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** la persona lleva el espaciado al máximo y luego al mínimo, **Then** el valor mostrado coincide con los límites de la feature y las letras se separan o se superponen de forma visible.
2. **Given** una plantilla base con espaciado 3, **When** se abre después de esta feature, **Then** el texto se ve idéntico a como se veía y el control muestra su valor equivalente.
3. **Given** un texto con espaciado modificado, **When** se genera el PDF, **Then** la separación de las letras y los cortes de línea son los mismos que en el lienzo.

---

### User Story 3 - Anclar el texto arriba, al medio o abajo de su caja (Priority: P2)

Una caja de texto alta, por ejemplo la de un título de varias líneas, hoy siempre deja el texto centrado verticalmente. La persona quiere elegir entre pegarlo arriba, dejarlo centrado o pegarlo abajo, con tres botones, como en la referencia.

**Why this priority**: Resuelve un caso real de diseño (textos centrados en insignias y etiquetas) sin usar cálculos a mano, pero es una propiedad nueva y requiere guardarla.

**Independent Test**: Se prueba completo con una caja de texto alta de una línea: elegir cada uno de los tres anclajes, ver el cambio en el lienzo, guardar, recargar y generar el PDF.

**Acceptance Scenarios**:

1. **Given** un texto en una caja más alta que su contenido, **When** la persona elige «Arriba», **Then** el texto queda pegado al borde superior de la caja, y con «Abajo» queda pegado al borde inferior.
2. **Given** un texto nuevo o uno de una plantilla guardada antes de esta feature, **When** se abre el inspector, **Then** el anclaje activo es «Centro», que es como siempre se dibujó.
3. **Given** un texto con anclaje distinto al de arriba, **When** se guarda, se recarga y se genera el PDF, **Then** el anclaje se conserva y el PDF coincide con el lienzo.

---

### User Story 4 - Encontrar los tres ajustes en un solo panel «Configuración avanzada» (Priority: P3)

Para no recargar el inspector, los ajustes finos (altura de línea, espaciado entre letras y anclaje) se agrupan en un panel plegable «Configuración avanzada» dentro de la sección de texto, como en la referencia. Cada ajuste muestra su deslizador y un campo numérico, y los botones de anclaje.

**Why this priority**: Es orden y descubribilidad; las funciones existen aunque no se agrupen, por eso va después.

**Independent Test**: Se prueba abriendo el inspector con un texto seleccionado, comprobando que los tres ajustes están dentro del panel, que el panel recuerda si estaba abierto o cerrado al cambiar de elemento y que los demás controles de texto no se movieron.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** se abre el inspector, **Then** hay un panel «Configuración avanzada» con altura de línea, espaciado entre letras y anclaje.
2. **Given** el panel cerrado, **When** la persona lo abre, **Then** ve para cada ajuste un deslizador y un campo numérico sincronizados, y los tres botones de anclaje.
3. **Given** un elemento que no es texto, **When** se selecciona, **Then** el panel no aparece.

---

### Edge Cases

- Un valor escrito con coma decimal (1,37) o con punto (1.37) debe interpretarse igual.
- Un campo vacío o con letras no cambia el valor y se restaura el valor anterior al salir del campo.
- Un texto bloqueado deja los controles del panel deshabilitados, con la misma indicación que ya usa el editor.
- Un ajuste continuo del deslizador (arrastrar sin soltar) cuenta como un solo paso de deshacer.
- Una altura de línea muy baja con texto de varias líneas puede superponer líneas; es el efecto buscado y el editor no lo corrige.
- Un espaciado muy amplio puede hacer que el texto no quepa en una línea; el ajuste automático de tamaño y los cortes de línea que ya usa el editor se mantienen y el PDF debe cortar igual que el lienzo.
- Un texto con ajuste automático de tamaño y cualquier anclaje debe seguir cabiendo dentro de su caja.
- Una plantilla que trae un valor fuera de los nuevos rangos (por ejemplo, creada a mano) se rechaza al guardar con el mismo tipo de mensaje de validación que ya existe.

## Requirements *(mandatory)*

### Functional Requirements

**Altura de línea**

- **FR-001**: La altura de línea MUST poder fijarse entre **0,5 y 2,5** en pasos de **0,01**, tanto con el deslizador como escribiendo el valor en un campo numérico; el control MUST mostrar siempre el valor actual con sus decimales.
- **FR-002**: El valor por defecto de la altura de línea MUST seguir siendo **1,05** para textos nuevos y para textos de plantillas existentes, de modo que ningún texto guardado cambie su aspecto. La referencia de Canva usa 1 como valor inicial; adoptarlo para textos nuevos queda fuera de esta feature y requiere una decisión explícita del responsable.
- **FR-003**: Un valor escrito fuera de rango MUST ajustarse al límite más cercano y mostrar el valor final; un valor no numérico MUST descartarse y restaurar el anterior.

**Espaciado entre letras (interletrado)**

- **FR-004**: El espaciado entre letras MUST seguir expresándose en **píxeles** (decisión del responsable, 2026-10-22) y MUST ampliarse de −2…12 a **−10…60** en pasos de **0,1**, con campo numérico además del deslizador. El rango nuevo contiene por completo al anterior, de modo que todo valor guardado sigue siendo válido sin conversión. La referencia de Canva usa milésimas del tamaño de la letra (−200 a 800); esa unidad **no** se adopta, y el rango en píxeles es una aproximación pensada para los tamaños de letra del editor (8 a 140).
- **FR-005**: Cualquier texto de una plantilla guardada antes de esta feature MUST verse y generarse exactamente igual, y su control de espaciado MUST mostrar el mismo valor que tenía (no hay conversión de unidad).
- **FR-006**: El valor por defecto del espaciado MUST ser **0** (sin separación adicional), igual que hoy y que en la referencia.

**Anclaje vertical**

- **FR-007**: Todo elemento de texto MUST tener un **anclaje vertical** con tres opciones: **Arriba**, **Centro** y **Abajo**, elegibles con tres botones donde se ve cuál está activo.
- **FR-008**: El anclaje por defecto, en textos nuevos y en textos de plantillas guardadas antes de esta feature, MUST ser **Centro**, que es como el editor siempre dibujó el texto (así ninguna plantilla guardada cambia). La referencia de Canva usa «comienzo» como valor inicial; adoptarlo queda fuera de esta feature.
- **FR-009**: Con anclaje Centro o Abajo, el texto MUST quedar centrado o pegado al borde inferior de su caja, con las mismas reglas de ajuste de tamaño y de corte de líneas que ya usa el editor; con anclaje Centro nada cambia.

**Panel «Configuración avanzada»**

- **FR-010**: El inspector de un elemento de texto MUST incluir un panel plegable **«Configuración avanzada»** que contenga la altura de línea, el espaciado entre letras y el anclaje vertical. Los controles de altura de línea y espaciado MUST dejar de repetirse fuera del panel.
- **FR-011**: Cada control numérico del panel MUST ofrecer deslizador y campo numérico sincronizados. El panel MUST estar cerrado por defecto y recordar su estado abierto o cerrado mientras se edita la plantilla.
- **FR-012**: El panel MUST NOT aparecer para elementos que no son texto, y MUST quedar deshabilitado, con la indicación que ya usa el editor, cuando el elemento está bloqueado.

**Consistencia y compatibilidad**

- **FR-013**: Los tres ajustes MUST verse idénticos en el lienzo, las miniaturas, la vista previa y el PDF, con los mismos cortes de línea, como el resto de las propiedades de texto.
- **FR-014**: Los tres ajustes MUST guardarse con la plantilla y conservarse al recargar el editor, al duplicar el texto o la plantilla y al cambiar de plantilla y volver.
- **FR-015**: Las plantillas guardadas antes de esta feature MUST abrirse, mostrarse y generarse sin ningún cambio visual y sin que la persona deba hacer nada. Las **4 plantillas base** MUST producir un PDF **idéntico byte a byte** al de la línea base guardada en la feature 007.
- **FR-016**: Cada cambio hecho con un control del panel MUST contar como **un** paso de deshacer y rehacer (un ajuste continuo del deslizador cuenta como uno), y un cambio que no modifica el valor MUST NOT agregar un paso.
- **FR-017**: Al guardar, el sistema MUST rechazar valores fuera de los nuevos rangos o un anclaje que no sea uno de los tres, con el mismo tipo de mensaje de validación que ya muestra para otras propiedades.
- **FR-018**: Las medidas tomadas de Canva MUST usarse solo como referencia de rangos y de organización; la feature MUST NOT incorporar íconos, textos, imágenes ni otros recursos de Canva.

### Key Entities *(include if feature involves data)*

- **Elemento de texto**: pieza de texto de una plantilla. Se amplía con un **anclaje vertical** (arriba, centro, abajo) y con rangos nuevos para altura de línea y espaciado entre letras. Mantiene todas sus demás propiedades.
- **Plantilla**: conjunto de páginas y elementos que se guarda para generar el catálogo. Las plantillas anteriores a esta feature no traen el anclaje y se leen como «Centro».
- **Panel «Configuración avanzada»**: agrupación de controles dentro del inspector de texto; no guarda datos propios salvo si está abierto o cerrado durante la edición.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las **4 plantillas base** y cualquier plantilla guardada antes de esta feature producen un PDF **idéntico byte a byte** al de antes en todas sus páginas.
- **SC-002**: La altura de línea puede fijarse en cualquier valor de 0,5 a 2,5 con dos decimales, y un valor como 1,37 se guarda y se muestra exactamente así tras recargar.
- **SC-003**: Un texto con altura de línea, espaciado o anclaje modificados muestra **los mismos cortes de línea** y la misma posición en el lienzo y en el PDF, en las cuatro plantillas base.
- **SC-004**: Pegar un texto arriba o abajo de su caja toma **un clic** (hoy requiere calcular la posición a mano), y su borde queda a menos de **0,5 %** de la altura de la caja del borde de ésta.
- **SC-005**: Un cambio en cualquiera de los tres ajustes se ve en el lienzo en **menos de 0,2 segundos**, la misma meta que el resto de controles del editor.
- **SC-006**: La persona encuentra los tres ajustes en un solo lugar, sin repetirlos en otra sección del inspector, y los abre con **un clic**.
- **SC-007**: Ningún texto de las plantillas existentes cambia al ampliar el rango del espaciado, comprobado comparando cada plantilla antes y después.

## Assumptions

- Quien usa el editor es el administrador del catálogo, en un computador con navegador de escritorio; no se considera uso en móvil.
- La altura de línea ya es una propiedad opcional y guardada (feature 007), por eso ampliar su rango no cambia el formato de las plantillas.
- El espaciado entre letras ya es una propiedad guardada de todos los textos, en píxeles; ampliar su rango no cambia el formato de guardado ni cómo se ven los textos existentes. El rango −10…60 px con paso 0,1 es una elección razonable por defecto y se puede afinar en la planificación.
- El anclaje vertical es una propiedad nueva y opcional: si falta, se entiende como «Centro», que es como el editor dibuja hoy todos los textos.
- La línea base de PDFs de la feature 007 (`specs/007-editor-align-text-tools/visual/baseline/`) sigue vigente como comparación de referencia.
- La referencia de Canva se usó solo para medir rangos, pasos y organización; no se busca igualar su aspecto visual ni su marca.
- Quedan fuera: cambiar el valor por defecto de la altura de línea, nuevos tipos de elemento, sangrías, listas, efectos de texto y cualquier cambio en la tipografía disponible.
