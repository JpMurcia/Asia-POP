# Feature Specification: Omitir artículos de Alegra del catálogo

**Feature Branch**: `006-omit-alegra-articles` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`)

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "desarrolla una opcion para omitir algunos articulas de alegra para genera el catalogo"

Esta feature **continúa** `001` a `005`. No cambia reglas de precio, stock, secciones, combos, plantillas ni calidad del PDF, ni la forma de obtener las fotos: solo agrega una decisión nueva de la persona responsable, **qué artículos de Alegra se dejan fuera del catálogo**. En esta spec, «artículo» es lo que el resto de la aplicación llama «producto» de Alegra (un producto activo; cada variante cuenta como un artículo propio, igual que hoy).

## Clarifications

### Session 2026-10-05

- Q: ¿Los artículos omitidos quedan así de forma permanente (en todos los catálogos futuros) o solo en la generación en curso? → A: **Permanente** (opción A). La persona marca el artículo una vez en la pantalla Artículos de Alegra y queda fuera de todos los catálogos hasta que lo vuelva a incluir. Se refleja en FR-004, SC-003 y Supuestos.

## Punto de partida

- El catálogo incluye **todos** los productos activos de Alegra que tienen sección (por su categoría o por una asignación local) y foto utilizable. La cuenta real tiene 197 productos activos, 182 con foto, en 66 páginas.
- Hoy solo hay tres maneras de dejar un artículo fuera, y ninguna sirve para «este artículo en particular, solo en el catálogo»: (1) desmarcar su **sección completa** en Generar, lo que saca también todo lo demás de esa sección; (2) dejarlo **sin foto** o **sin sección**, lo que lo deja fuera pero lo reporta como un problema pendiente; (3) inactivarlo o cambiarlo **en Alegra**, algo que este sistema no hace (principio I) y que además altera la contabilidad real de la tienda por una decisión que es solo del catálogo.
- Pueden existir en Alegra artículos que la persona no quiere ofrecer en el catálogo (por ejemplo, uno de uso interno, uno descontinuado o uno que no quiere ofrecer por ahora). No hay manera de indicárselo al sistema.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Omitir artículos puntuales y generar el catálogo sin ellos (Priority: P1)

La persona responsable abre la pantalla **Artículos de Alegra**, busca los artículos que no quiere en el catálogo y los marca como **omitidos**. Al preparar y generar, esos artículos no aparecen ni en la vista previa ni en el PDF; todo lo demás queda igual.

**Why this priority**: es lo pedido. Hoy no existe forma de sacar un artículo puntual del catálogo sin sacar toda su sección ni tocar Alegra.

**Independent Test**: con un Alegra simulado de unos 10 artículos en 3 secciones, omitir 2 artículos de la misma sección, preparar y generar; comprobar que esos 2 no están en la vista previa ni en el PDF, que el resto sí está, y que precios, indicaciones AGOTADO, secciones y páginas del resto no cambian.

**Acceptance Scenarios**:

1. **Given** la conexión con Alegra configurada, **When** la persona abre Artículos de Alegra, **Then** ve la lista de los artículos activos, cada uno con su nombre, su sección (o «Sin categoría»), su precio y si está agotado, y puede buscar por nombre y filtrar por sección.
2. **Given** un artículo incluido, **When** lo marca como omitido, **Then** queda marcado al instante, sin pasos adicionales de guardado, y sigue marcado al recargar la pantalla.
3. **Given** una sección con 5 artículos de los que se omitieron 2, **When** se prepara y se genera el catálogo, **Then** la vista previa y el PDF muestran los otros 3 artículos y ninguno de los omitidos, en ninguna página, tampoco con la indicación AGOTADO.
4. **Given** un artículo omitido, **When** en Alegra cambia su nombre, su precio, su categoría o su disponibilidad, **Then** sigue omitido (la omisión sigue al artículo, no a su nombre).
5. **Given** un artículo creado en Alegra después de omitir otros, **When** se prepara el catálogo, **Then** el artículo nuevo aparece incluido; solo se omite lo que la persona marcó.
6. **Given** que Alegra no responde o no está configurada, **When** se abre Artículos de Alegra, **Then** se muestra un mensaje claro en español de por qué no se puede consultar y qué hacer.

---

### User Story 2 - Saber qué se está omitiendo y volver a incluirlo (Priority: P2)

En la revisión de Generar, la persona ve cuántos artículos y cuáles está omitiendo por decisión propia, con un enlace a Artículos de Alegra para cambiarlo. En esa pantalla puede ver de una vez solo los omitidos y volver a incluir cualquiera.

**Why this priority**: omitir sin ver qué se omitió es peligroso: un artículo que falta en un catálogo que se envía a clientes tiene que ser una decisión visible, no un olvido (principio II). Es el complemento mínimo para poder confiar en la opción.

**Independent Test**: omitir 3 artículos, preparar y comprobar que la revisión de Generar los informa por nombre y por cantidad, separados de los omitidos por falta de foto o de sección; volver a incluir uno y comprobar que aparece en el siguiente catálogo.

**Acceptance Scenarios**:

1. **Given** 3 artículos omitidos, **When** la persona prepara el catálogo, **Then** la revisión muestra «3 artículos omitidos por ti» con sus nombres y un enlace a Artículos de Alegra, aparte de los avisos de productos sin foto o sin sección.
2. **Given** ningún artículo omitido, **When** se prepara el catálogo, **Then** la revisión no muestra ningún aviso de omitidos por decisión propia.
3. **Given** la pantalla Artículos de Alegra, **When** la persona activa el filtro «Omitidos», **Then** ve solo los artículos omitidos y cuántos son, y puede identificarlos en menos de 10 segundos.
4. **Given** un artículo omitido, **When** la persona lo vuelve a incluir, **Then** el siguiente catálogo preparado y generado lo muestra en su sección (si tiene foto y sección, como cualquier otro).
5. **Given** un catálogo ya preparado, **When** la persona cambia la lista de omitidos y vuelve a Generar, **Then** el sistema lo hace evidente: el PDF nunca se genera con una lista distinta a la que aparece en la revisión sin que la persona lo sepa.

---

### User Story 3 - Que omitir sea coherente con las demás reglas del catálogo (Priority: P3)

Un artículo omitido no genera avisos ni pendientes (sin foto, sin sección, agotado), no cambia los combos que lo usan y no deja secciones vacías; los números que muestra el sistema (Inicio, Generar, estructura del PDF) reflejan siempre la misma lista.

**Why this priority**: sin esto, omitir un artículo deja ruido (avisos de algo que la persona ya decidió) o inconsistencias entre pantallas. No es el valor principal, pero sí lo que hace que la opción se sienta terminada y respete las reglas de las features anteriores.

**Independent Test**: con un Alegra simulado que incluya artículos sin categoría, sin foto, agotados y componentes de un combo, omitir uno de cada tipo y revisar la revisión de Generar, el contador de «Sin categoría», los totales de Inicio y el combo.

**Acceptance Scenarios**:

1. **Given** un artículo sin categoría omitido, **When** se ve el contador de «Sin categoría» y la revisión de Generar, **Then** el artículo no cuenta como pendiente de asignar ni aparece en el aviso de productos sin categoría ni sección; en la pantalla Sin categoría se ve marcado como omitido.
2. **Given** un artículo sin foto omitido, **When** se prepara el catálogo, **Then** no aparece en los avisos de productos sin imagen ni de fotos que no se pudieron obtener.
3. **Given** un artículo agotado omitido, **When** se prepara el catálogo, **Then** no cuenta entre los productos con la indicación AGOTADO ni dispara ninguna alerta.
4. **Given** un artículo que es componente de un combo, **When** la persona lo omite, **Then** la pantalla le avisa en qué combos se usa, sin bloquear la acción, y el combo se muestra exactamente igual que antes (nombre de componentes, precio y alerta de agotado calculados con los datos de Alegra).
5. **Given** una sección cuyos artículos se omiten todos, **When** se prepara el catálogo, **Then** la sección no aparece en el PDF (ni portada ni páginas vacías) ni en la lista «Secciones a incluir»; si no queda ninguna sección, se muestra el aviso vigente de que no hay productos para generar.
6. **Given** artículos omitidos, **When** se comparan los productos incluidos, los agotados y las páginas estimadas que muestran Inicio, Generar y la estructura del PDF, **Then** todos reflejan la misma lista y coinciden entre sí; y Inicio informa cuántos artículos se omiten sin cambiar el total de productos activos en Alegra.
7. **Given** ningún artículo omitido, **When** se genera el catálogo, **Then** es idéntico al que el sistema genera hoy (mismas páginas, productos, precios e indicaciones AGOTADO).

---

### Edge Cases

- **Omitir todo lo de una sección**: la sección desaparece del catálogo y de la lista de secciones a incluir; no queda una portada de sección sin productos.
- **Omitir todos los artículos**: el catálogo queda vacío y se muestra el aviso vigente de que no hay productos para generar; no se genera un PDF vacío.
- **Artículo omitido que sale de Alegra** (se inactiva o se elimina allá): deja de listarse y no cuenta entre los omitidos; si vuelve a estar activo en Alegra, sigue omitido.
- **Artículo omitido sin categoría con una sección ya asignada**: queda omitido; la asignación de sección se conserva y vuelve a aplicar si se lo vuelve a incluir.
- **Variantes**: cada variante es un artículo independiente, como en el catálogo de hoy; omitir una no omite las demás ni al producto del que provienen.
- **Artículo omitido y a la vez agotado**: está omitido, nada más; no cuenta como agotado ni dispara la regla de ocultar agotados.
- **Cambios de nombre, precio o categoría en Alegra**: no deshacen la omisión (escenario 4 de la Historia 1).
- **Combo con un componente omitido**: no cambia; el artículo omitido sigue siendo un componente válido del combo.
- **Muchos artículos omitidos** (por ejemplo, más de 100): la pantalla sigue siendo usable con la búsqueda y los filtros.
- **Se cambia la lista de omitidos entre preparar y generar**: el PDF nunca sale con una lista distinta a la de la revisión sin que la persona lo sepa (FR-012).
- **Alegra no responde al abrir la pantalla**: mensaje claro, sin lista; la lista guardada de omitidos sigue vigente para la siguiente generación.
- **Catálogos ya generados antes de esta feature**: no se modifican ni se recalculan.
- **Artículos propios y combos**: no entran en esta opción (ya se gestionan en Contenido propio y Combos).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer una pantalla **Artículos de Alegra** (con entrada en el menú lateral, protegida por sesión como el resto) que liste los artículos activos de Alegra tal como el catálogo los trata, es decir, cada variante como un artículo y sin los padres de variantes. Cada fila MUST mostrar nombre, sección (o «Sin categoría»), precio y si está agotado.
- **FR-002**: La pantalla MUST permitir marcar un artículo como **omitido** y volver a **incluirlo**, con un solo gesto por artículo; el cambio se guarda al instante, sin un paso aparte de «guardar».
- **FR-003**: La pantalla MUST permitir encontrar artículos: búsqueda por nombre sin distinguir mayúsculas ni tildes, filtro por sección y filtro para ver solo los omitidos, mostrando cuántos hay en cada vista.
- **FR-004**: La lista de artículos omitidos MUST ser **permanente**: se conserva entre sesiones y reinicios, y se aplica a todos los catálogos futuros hasta que la persona vuelva a incluir el artículo. No es un ajuste de una sola generación.
- **FR-005**: Un artículo omitido MUST NOT aparecer en el catálogo: ni en la vista previa ni en el PDF, en ninguna sección, ni siquiera con la indicación AGOTADO.
- **FR-006**: La omisión MUST seguir a la identidad del artículo en Alegra y no a sus datos: cambiar su nombre, precio, categoría o disponibilidad en Alegra no la deshace. Un artículo nuevo en Alegra MUST quedar incluido por defecto.
- **FR-007**: La omisión MUST ser solo local: el sistema MUST NOT modificar nada en Alegra (ni el estado, ni el inventario, ni la categoría, ni el precio del artículo) al omitir o volver a incluir (principio I).
- **FR-008**: La revisión de Generar MUST informar cuántos artículos se omiten por decisión de la persona y cuáles son, de forma separada de los omitidos por falta de foto o de sección, con un enlace a Artículos de Alegra para administrarlos. Si no hay ninguno, MUST NOT mostrar ese aviso. Los conteos y avisos vigentes de productos sin foto y sin sección MUST conservar su significado actual.
- **FR-009**: Un artículo omitido MUST NOT generar avisos ni pendientes: no se reporta como sin foto, con foto no obtenida, sin categoría ni sección, ni agotado, y no cuenta como pendiente en el contador de «Sin categoría» (la pantalla Sin categoría lo muestra marcado como omitido).
- **FR-010**: La misma lista de omitidos MUST aplicarse en la vista previa, el PDF y todos los números que muestra el sistema (productos incluidos, agotados que saldrán con la indicación, páginas estimadas y secciones disponibles en Inicio y Generar, y la estructura del catálogo), de modo que coincidan entre sí. El total «Productos activos en Alegra» de Inicio sigue siendo el de Alegra (no baja al omitir) e Inicio MUST informar además cuántos de ellos se omiten.
- **FR-011**: Omitir un artículo que es componente de un combo MUST NOT cambiar el combo (componentes, precio ni alerta de agotado). La pantalla MUST avisar, sin bloquear, en qué combos se usa el artículo al omitirlo.
- **FR-012**: El PDF MUST generarse con la misma lista de omitidos que muestra la revisión de Generar. Si la lista cambia después de preparar, el sistema MUST hacerlo visible (actualizar la revisión o pedir preparar de nuevo) y MUST NOT generar con una lista distinta sin que la persona lo sepa.
- **FR-013**: Una sección que se quede sin artículos por las omisiones MUST NOT aparecer en el catálogo ni en la lista de secciones a incluir; si no queda ningún producto, MUST aplicarse el aviso vigente de que no hay productos para generar.
- **FR-014**: Sin ningún artículo omitido, el catálogo MUST ser idéntico al que se genera hoy.
- **FR-015**: La pantalla MUST mostrar un mensaje claro en español cuando Alegra no responda o no esté configurada, sin tocar la lista guardada de omitidos.
- **FR-016**: Cada regla de este documento (FR-001 a FR-015) MUST tener pruebas automatizadas con respuestas simuladas de Alegra, nunca contra la cuenta real (principio V).

### Key Entities *(include if feature involves data)*

- **Artículo de Alegra**: un producto activo de Alegra tal como el catálogo lo trata (cada variante es un artículo; los padres de variantes no cuentan). Tiene nombre, sección o «Sin categoría», precio y disponibilidad. Alegra es su fuente de verdad y no se modifica.
- **Artículo omitido**: decisión local de la persona de dejar un artículo de Alegra fuera del catálogo. Se asocia a la identidad del artículo en Alegra y no a su nombre; se puede revertir en cualquier momento.
- **Lista de omitidos**: el conjunto de artículos omitidos vigente. La usan la vista previa, el PDF, la revisión de Generar y los totales de Inicio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona sin conocimientos técnicos encuentra por nombre un artículo entre unos 200 y lo omite en menos de 30 segundos.
- **SC-002**: El 100 % de los artículos omitidos está ausente de la vista previa y del PDF (0 apariciones, tampoco con la indicación AGOTADO), verificado con un catálogo simulado de 200 artículos.
- **SC-003**: La lista de omitidos se conserva en el 100 % de los casos tras cerrar la sesión o reiniciar el sistema, y se aplica a la siguiente generación sin repetir ninguna acción.
- **SC-004**: La revisión de Generar informa un número de artículos omitidos por decisión igual al que la persona marcó (100 %), separado de los omitidos por otros motivos, con sus nombres.
- **SC-005**: Con la lista de omitidos vacía, el 100 % del contenido coincide con el catálogo que se genera hoy: mismas páginas, productos, precios e indicaciones AGOTADO.
- **SC-006**: Un artículo que se vuelve a incluir aparece en el siguiente catálogo preparado y generado en el 100 % de los casos (si tiene foto y sección).
- **SC-007**: 0 avisos de problemas (sin foto, sin sección, agotado) por artículos omitidos, y el contador de «Sin categoría» baja exactamente en el número de artículos sin categoría que se omiten.
- **SC-008**: Una persona identifica cuántos y cuáles artículos se están omitiendo en menos de 10 segundos, desde la revisión de Generar o desde el filtro «Omitidos».
- **SC-009**: Con la cuenta real (hasta unos 200 artículos), la lista de Artículos de Alegra aparece en menos de 10 segundos y buscar o filtrar responde en menos de 1 segundo.
- **SC-010**: La persona responsable omite artículos de su cuenta real, genera el catálogo y confirma que ninguno de ellos aparece y que el resto está intacto.

## Assumptions

- **Persistencia**: la lista es **permanente** (decidido en la sesión de aclaraciones): aplica a todos los catálogos hasta volver a incluir el artículo, porque los casos típicos (uso interno, descontinuado, «por ahora no») no cambian de una generación a otra. Omitir solo en una generación queda fuera de alcance; las secciones completas se siguen eligiendo por generación.
- **Granularidad**: la decisión es por artículo individual. Para sacar una sección completa sigue sirviendo «Secciones a incluir» de Generar; esta feature no la reemplaza.
- **Alcance**: solo artículos de Alegra. Los productos propios y los combos se gestionan (y se pueden borrar) en Contenido propio y Combos.
- **Identidad**: «el mismo artículo» es el que tiene el mismo identificador en Alegra; nombre, precio y categoría pueden cambiar.
- **Fuente de la lista**: la pantalla consulta Alegra en vivo, igual que la pantalla Sin categoría. Sin conexión, no se puede mostrar la lista, pero lo omitido sigue aplicando al generar.
- **Términos**: la interfaz usa «artículo» en la nueva pantalla, como lo dice la persona responsable, y mantiene «producto» en el resto, como hasta ahora.
- **Escala de referencia**: hasta unos 200 artículos, como en 001 (la cuenta real tiene 197 activos).
- **Historial**: los catálogos ya generados y las columnas del Historial no cambian; el Historial no registra qué artículos se omitieron en cada uno.
- **Seguridad**: la pantalla y sus datos exigen sesión, como todo el panel (principio III). La omisión no usa ni expone credenciales.
- **Fuera de alcance**: omitir por regla (por nombre, precio o categoría), omisión con fecha de vencimiento, omitir artículos solo para una generación, omitir en bloque desde Generar, importar o exportar la lista, omitir productos propios o combos, y cualquier cambio en Alegra.
