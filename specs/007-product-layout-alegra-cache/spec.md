# Feature Specification: Productos del catálogo más claros y datos de Alegra guardados

**Feature Branch**: `007-product-layout-alegra-cache` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`)

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "debe tener la opción de ajustar el ancho y alto donde irá los productos, también el nombre de los productos van separados del diseño como se ve en cat.pdf (está en color neón y fuera del diseño), e intentar dimensionar el texto para que pueda verse todo. En «Artículos de Alegra», debe tener la opción de una pantalla de carga y poder filtrar los artículos por categorías. Debe ajustar un poco el diseño y un botón de consejo para «Apariencia». Cuando se conecte por primera vez a Alegra sería óptimo almacenar su información, para que no tenga que descargar la información cada vez que cargue una pantalla en nuestro sistema."

Esta feature **continúa** `001` a `006`. No cambia reglas de precio, stock, secciones, combos, omisión de artículos ni calidad del PDF, ni escribe nada en Alegra: mejora **cómo se ve cada producto en el catálogo y cómo se ajusta**, **cómo se usa la pantalla Artículos de Alegra** y **cuánto tarda el sistema en mostrar los datos de Alegra**.

## Punto de partida

- **Zona de productos.** En el editor de Apariencia, el bloque de productos se mueve y se redimensiona como un solo rectángulo (X, Y, ancho y alto en % de la página). Dentro de él, el tamaño de la foto, de la burbuja de descripción y del precio sale de proporciones fijas: la persona no puede cambiar de forma independiente el ancho y el alto de la foto de cada producto.
- **Nombre del producto.** Hoy el nombre va **dentro de la burbuja beige**, con el mismo color y la misma letra que la descripción. En `docs/Cat.pdf` el nombre se ve **aparte** de la burbuja de descripción: en color neón, junto a la foto del producto.
- **Texto largo.** La letra de la burbuja se reduce hasta un mínimo legible; si aun así no cabe, el texto se corta con «…» sin avisar (por ejemplo, una opción de precio larga puede verse como «Caja x 6 …»).
- **Artículos de Alegra.** Cada vez que se abre la pantalla se consulta Alegra en vivo (unos 200 artículos) y mientras tanto solo se ve el texto «Cargando…». Existe un selector de sección, pero no una lista de categorías visible con su cantidad de artículos.
- **Datos de Alegra.** Artículos de Alegra, Sin categoría, Combos y la preparación del catálogo consultan Alegra cada vez que se abren o se usan; Inicio recuerda su resumen solo 60 segundos y en memoria, así que al reiniciar el sistema no queda nada guardado. Cada pantalla vuelve a esperar a Alegra.
- **Apariencia.** El editor tiene mucha funcionalidad (elementos, estilo, datos, atajos de teclado) pero no hay ninguna ayuda a la vista que explique cómo sacarle provecho.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ajustar el ancho y el alto de los productos (Priority: P1)

En el editor de Apariencia, la persona responsable cambia el **ancho y el alto de la zona donde van los productos** y también el **ancho y el alto de la foto de cada producto**. La página se redibuja al instante, los productos se reacomodan dentro de la zona y nada se sale de la hoja ni se encima.

**Why this priority**: es lo primero que se pidió. Hoy las proporciones del producto son fijas y, si una foto o un texto no se ven bien, no hay forma de dar más espacio sin cambiar de plantilla.

**Independent Test**: abrir una plantilla en Apariencia, seleccionar la zona de productos, agrandar la foto y reducir la zona; comprobar que la vista se actualiza al instante, que los tres productos siguen dentro de la zona sin encimarse y que el PDF generado muestra los mismos tamaños.

**Acceptance Scenarios**:

1. **Given** una plantilla abierta en Apariencia, **When** la persona selecciona la zona de productos, **Then** ve controles para cambiar el **ancho y el alto de la zona** y el **ancho y el alto de la foto del producto**, tanto arrastrando como escribiendo el valor, y el lienzo refleja el cambio al instante.
2. **Given** la foto del producto agrandada, **When** se mira la página, **Then** la burbuja de descripción, el nombre y el precio se reacomodan junto a la foto sin encimarse con ella ni entre sí, y los tres productos siguen cabiendo dentro de la zona.
3. **Given** un valor que haría que los productos se salgan de la zona o de la hoja, **When** la persona lo aplica, **Then** el sistema lo limita al mayor valor que sí cabe y se lo dice con un mensaje claro, sin dejar la página en un estado roto.
4. **Given** tamaños ajustados y guardados, **When** se prepara y genera el catálogo, **Then** el editor, la vista previa y el PDF muestran exactamente los mismos tamaños.
5. **Given** una plantilla a la que la persona no cambió ningún tamaño, **When** se genera el catálogo, **Then** la zona y las fotos tienen los mismos tamaños que hoy (las plantillas ya guardadas no cambian de aspecto por esta feature, salvo lo descrito en la Historia 2).
6. **Given** tamaños modificados, **When** la persona pulsa «Restaurar tamaños originales», **Then** la zona y las fotos de esa plantilla vuelven a los tamaños con los que se creó.
7. **Given** dos plantillas distintas, **When** se ajusta una, **Then** la otra no cambia (cada plantilla guarda sus propios tamaños).

---

### User Story 2 - El nombre del producto separado, en neón y con el texto completo (Priority: P1)

En el catálogo, el **nombre de cada producto va aparte de la burbuja de descripción**, fuera de ella y fuera del marco de la foto, en color neón como en `docs/Cat.pdf`. La burbuja queda solo para la descripción y los datos extra. Además, el sistema ajusta el tamaño de **todos** los textos del producto (nombre, descripción, opciones, precio) para que se vean completos, y cuando no es posible lo avisa en lugar de cortarlos en silencio.

**Why this priority**: es la diferencia visible más grande entre el catálogo actual y `docs/Cat.pdf` (principio IV), y un nombre cortado o ilegible es un error que llega al cliente final.

**Independent Test**: generar el catálogo con la plantilla Neón Noche usando un producto de Alegra, un producto propio con sabores y opciones largas y un combo; comprobar que el nombre de cada uno va separado y en neón, que la burbuja no repite el nombre, que todo el texto es legible y comparar la página con `docs/Cat.pdf`.

**Acceptance Scenarios**:

1. **Given** la plantilla Neón Noche, **When** se ve un producto con nombre y descripción, **Then** el nombre aparece como un título aparte, junto a la foto, fuera de la burbuja y fuera del marco de la foto, en color neón con su resplandor, y la burbuja contiene solo la descripción y los datos extra.
2. **Given** un producto con un nombre muy largo, **When** se genera la página, **Then** el nombre reduce su letra (y se parte en líneas si hace falta) hasta verse completo, sin tapar la foto, la descripción ni el precio.
3. **Given** un producto propio con sabores y opciones de precio largas, o un combo con varios componentes, **When** se genera la página, **Then** todas las opciones, sabores y componentes se leen completos (sin «…») siempre que quepan con una letra legible.
4. **Given** un producto cuyo texto no cabe completo ni con la letra más pequeña legible, **When** se prepara el catálogo, **Then** la revisión de Generar lista cuáles productos son y qué texto no cabe, y el editor lo avisa en la zona de productos; no se corta un texto sin avisar.
5. **Given** un producto sin descripción ni datos extra, **When** se genera la página, **Then** el nombre y el precio se ven bien y no queda una burbuja vacía.
6. **Given** un producto agotado, **When** se genera la página, **Then** la indicación AGOTADO no oculta el nombre ni el precio.
7. **Given** un producto de Alegra, un producto propio y un combo, **When** se genera la página, **Then** los tres muestran su nombre con el mismo estilo separado.
8. **Given** el editor de Apariencia, **When** la persona selecciona la zona de productos, **Then** puede elegir si el nombre va **separado** o **dentro de la burbuja** y el color del nombre (de la paleta de la plantilla); Neón Noche viene con el nombre separado y en neón.
9. **Given** el editor, la vista previa y el PDF, **When** se comparan, **Then** los tres muestran el nombre y los textos con el mismo tamaño y en el mismo lugar.

---

### User Story 3 - Los datos de Alegra se guardan en el equipo (Priority: P2)

Cuando la persona se conecta a Alegra por primera vez, el sistema **descarga una vez** la información de sus artículos y categorías y la **guarda en el equipo**. Desde ese momento, las pantallas muestran esos datos al instante, sin volver a descargarlos cada vez que se abren. La persona puede actualizarlos cuando quiera, y al preparar el catálogo el sistema los actualiza solo para que el PDF salga con los precios y el inventario de ese momento.

**Why this priority**: hoy cada pantalla espera a Alegra (decenas de segundos y consume las peticiones permitidas por minuto) y, si Alegra falla, la pantalla queda inservible. No cambia lo que sale en el catálogo, pero cambia lo rápido y confiable que se siente todo el sistema.

**Independent Test**: con un Alegra simulado, guardar la conexión por primera vez y comprobar que se descargan los datos una vez; abrir Artículos de Alegra, Sin categoría, Combos e Inicio y comprobar que se muestran al instante y que el simulador no recibe peticiones; reiniciar el sistema y repetirlo.

**Acceptance Scenarios**:

1. **Given** una conexión nueva con Alegra que acaba de guardarse con éxito, **When** termina de guardarse, **Then** el sistema descarga los artículos y categorías una sola vez mostrando el avance, y al terminar avisa que ya están guardados y cuándo.
2. **Given** datos ya guardados, **When** la persona abre Artículos de Alegra, Sin categoría, Combos o Inicio, **Then** la pantalla aparece con los datos en menos de 2 segundos sin consultar Alegra, y muestra su antigüedad («Actualizado hace N min»).
3. **Given** datos guardados, **When** la persona pulsa «Actualizar desde Alegra», **Then** el sistema descarga de nuevo mostrando el avance y reemplaza los datos guardados al terminar; si falla, conserva los anteriores y explica por qué.
4. **Given** datos guardados, **When** la persona pulsa «Preparar y revisar», **Then** el sistema primero los actualiza desde Alegra y luego arma la revisión, de modo que los precios y el inventario del catálogo son los de ese momento; si Alegra no responde, la preparación se detiene con un mensaje claro y no se genera un PDF parcial.
5. **Given** que se reinicia el sistema, **When** se abre cualquier pantalla con datos de Alegra, **Then** los datos guardados siguen ahí sin necesidad de volver a descargarlos.
6. **Given** datos guardados y Alegra sin respuesta, **When** la persona abre Artículos de Alegra, **Then** ve los datos guardados con un aviso de que no se pudieron actualizar y de qué edad son.
7. **Given** que la persona guarda las credenciales de **otra** cuenta de Alegra, **When** se completa el cambio, **Then** los datos guardados de la cuenta anterior se descartan y se descargan los de la nueva; si guarda de nuevo la misma cuenta, no se pierden.
8. **Given** artículos omitidos, secciones asignadas en Sin categoría y combos, **When** se usan los datos guardados, **Then** todas esas decisiones siguen funcionando igual; los cambios hechos en Alegra aparecen al actualizar.
9. **Given** una descarga que se interrumpe (se cierra el sistema o falla la red), **When** se vuelve a abrir, **Then** no queda una copia a medias: se conservan los datos anteriores o se vuelve a descargar desde cero.

---

### User Story 4 - Artículos de Alegra con pantalla de carga y filtro por categorías (Priority: P2)

En **Artículos de Alegra**, mientras se descargan los datos la persona ve una **pantalla de carga** clara, y una vez cargados puede **filtrar por categoría** viendo cuántos artículos tiene cada una.

**Why this priority**: es la pantalla donde se decide qué sale en el catálogo; con 197 artículos, esperar sin saber qué pasa y buscar sin poder acotar por categoría cuesta tiempo y errores.

**Independent Test**: abrir Artículos de Alegra sin datos guardados y comprobar que aparece la pantalla de carga con su mensaje y avance; cuando termina, elegir una categoría y comprobar que la lista, el contador y la combinación con la búsqueda y con «Omitidos» son correctos.

**Acceptance Scenarios**:

1. **Given** que no hay datos guardados o se está actualizando, **When** la persona abre Artículos de Alegra, **Then** ve una pantalla de carga con un mensaje que dice qué se está descargando y un indicador de avance, con el espacio de la pantalla reservado para que el contenido no salte al terminar; con datos guardados la lista aparece sin pantalla de carga.
2. **Given** la lista cargada, **When** la persona mira el filtro, **Then** ve todas las categorías con la cantidad de artículos de cada una, además de «Todas» y «Sin categoría».
3. **Given** una categoría elegida, **When** se actualiza la lista, **Then** muestra solo los artículos de esa categoría, indica cuántos son, y se puede combinar con la búsqueda por nombre y con la vista «Omitidos».
4. **Given** una categoría y una búsqueda sin coincidencias, **When** se actualiza la lista, **Then** se muestra un mensaje claro de que no hay artículos con esos filtros y una forma de limpiarlos con un clic.
5. **Given** que Alegra falla y no hay datos guardados, **When** se abre la pantalla, **Then** se mantiene el mensaje de error vigente con su botón «Reintentar»; la lista de omitidos guardada no se toca.
6. **Given** la pantalla ya existente, **When** la persona omite o vuelve a incluir un artículo, **Then** todo lo de la feature 006 funciona igual (cambio inmediato, aviso de combos, vista «Omitidos»).

---

### User Story 5 - Diseño más cuidado y consejos en Apariencia (Priority: P3)

Se **ajusta un poco el diseño** de las pantallas que esta feature toca (Artículos de Alegra y Apariencia) y Apariencia gana un botón **«Consejos»** que abre ayuda breve para sacarle provecho al editor.

**Why this priority**: mejora la experiencia sin cambiar reglas; depende de que las historias anteriores ya estén para que los consejos describan lo que existe.

**Independent Test**: abrir Apariencia, encontrar el botón «Consejos» sin ayuda, abrirlo, leer los consejos y cerrarlo sin que cambie nada de la plantilla; revisar Artículos de Alegra y Apariencia en una pantalla de 1366 × 768.

**Acceptance Scenarios**:

1. **Given** el editor de Apariencia, **When** la persona lo abre, **Then** ve un botón «Consejos» siempre visible en la barra superior.
2. **Given** el botón «Consejos», **When** lo pulsa, **Then** se abre un panel con consejos cortos y prácticos en español (por ejemplo, cómo ajustar la zona y la foto de los productos, qué hace el nombre en neón, cómo comprobar el contraste, cómo usar la vista previa y cómo guardar) y se puede cerrar con un botón o con la tecla Esc.
3. **Given** cambios sin guardar en una plantilla, **When** se abre y se cierra «Consejos», **Then** los cambios siguen ahí y nada se modifica ni se guarda.
4. **Given** la pantalla de Artículos de Alegra y el editor de Apariencia, **When** se ven en una pantalla de 1366 × 768, **Then** los espacios, alineaciones y jerarquía de títulos y controles son consistentes con el resto del panel y todo lo que existía sigue disponible y a la vista.
5. **Given** el teclado, **When** la persona navega por el panel de consejos, **Then** puede abrirlo, recorrerlo y cerrarlo sin usar el mouse.

---

### Edge Cases

- **Zona de productos muy pequeña**: si la zona no admite tres productos legibles, el sistema limita el tamaño mínimo y avisa; no deja productos encimados ni fuera de la hoja.
- **Foto más grande que la zona**: se limita al máximo que cabe, con mensaje; nunca se recorta una foto sin que la persona lo sepa.
- **Producto con nombre y descripción larguísimos a la vez**: el nombre y la descripción se ajustan por separado; el nombre se prioriza por ser lo que identifica el producto.
- **Producto sin descripción**: no queda una burbuja vacía; si tiene sabores, opciones o componentes, la burbuja existe solo para eso.
- **Plantillas distintas de Neón Noche**: el nombre separado se usa con el color de acento que la persona elija de su paleta; las plantillas ya guardadas conservan su aspecto actual hasta que la persona cambie la opción.
- **Alegra cambia mientras hay datos guardados**: precios o inventario guardados pueden estar desactualizados; por eso se muestra la antigüedad en cada pantalla y el catálogo siempre se prepara con datos recién descargados.
- **Descarga de datos muy grande o lenta**: la persona ve el avance y puede seguir en otra pantalla sin perder la descarga; no se puede lanzar una segunda descarga a la vez.
- **Límite de peticiones de Alegra durante la descarga**: el sistema espera y reintenta como hoy y, si no lo logra, conserva los datos anteriores y explica qué pasó.
- **Conexión borrada o reemplazada**: los datos guardados de la cuenta anterior no se muestran con las credenciales de otra.
- **Primera vez sin conexión configurada**: las pantallas siguen pidiendo configurar la conexión con Alegra; no se muestran datos vacíos como si fueran reales.
- **Conexión que ya existe sin datos guardados** (el caso de hoy, antes de esta feature): la primera vez que se abra una pantalla con datos de Alegra se descargan una vez, con la pantalla de carga; desde ahí funciona como cualquier conexión nueva.
- **Descripción de Alegra muy larga**: se ajusta con la regla del texto completo o se reporta en la revisión, igual que cualquier otro texto.

## Requirements *(mandatory)*

### Functional Requirements

**Tamaño de los productos en el catálogo**

- **FR-001**: El editor de Apariencia MUST permitir cambiar el **ancho y el alto de la zona de productos** de cada página de producto, arrastrando y escribiendo el valor, con el cambio visible al instante en el lienzo.
- **FR-002**: El editor MUST permitir cambiar el **ancho y el alto de la foto del producto** (el mismo tamaño para los tres productos de la página), con el cambio visible al instante.
- **FR-003**: Al cambiar un tamaño, el sistema MUST reacomodar foto, nombre, burbuja y precio dentro de la zona sin que se encimen entre sí ni se salgan de la zona o de la hoja, y MUST mantener un máximo de 3 productos por página.
- **FR-004**: Un valor que no cabe MUST limitarse al mayor valor posible y acompañarse de un mensaje claro; el sistema MUST NOT permitir un estado que deje la página rota.
- **FR-005**: Cada plantilla MUST guardar sus propios tamaños, y MUST existir una acción «Restaurar tamaños originales» por plantilla. Sin cambios de la persona, los tamaños MUST ser los mismos que hoy.
- **FR-006**: Editor, vista previa y PDF MUST mostrar los mismos tamaños y las mismas posiciones (principio IV: un único componente de página).

**Nombre del producto y texto completo**

- **FR-007**: El nombre de cada producto MUST poder dibujarse como un elemento **separado** de la burbuja de descripción, fuera de ella y fuera del marco de la foto, en un color de acento de la plantilla.
- **FR-008**: En la plantilla predeterminada de fábrica (Neón Noche) el nombre MUST venir separado y en color neón con resplandor, en línea con `docs/Cat.pdf` (principio IV). Las demás plantillas, y las ya guardadas, MUST conservar su aspecto hasta que la persona cambie la opción.
- **FR-009**: La persona MUST poder elegir, por plantilla, si el nombre va **separado** o **dentro de la burbuja**, y el color del nombre entre los de la paleta.
- **FR-010**: El nombre separado MUST aplicarse igual a productos de Alegra, productos propios y combos. La burbuja con el nombre separado MUST contener solo descripción, sabores, opciones o componentes, y MUST NOT aparecer vacía.
- **FR-011**: La indicación AGOTADO (en cualquiera de sus estilos) MUST NOT ocultar el nombre ni el precio del producto.
- **FR-012**: El sistema MUST ajustar el tamaño de la letra del nombre, la descripción, los datos extra y el precio para que **todo el texto se vea completo** siempre que quepa con una letra legible; el nombre MUST poder partirse en varias líneas.
- **FR-013**: Cuando un texto no cabe completo ni con la letra legible más pequeña, el sistema MUST NOT cortarlo sin avisar: MUST listar en la revisión de Generar los productos afectados y qué texto no cabe, y MUST avisarlo en el editor sobre la zona de productos.

**Datos de Alegra guardados**

- **FR-014**: Tras guardar con éxito una conexión nueva con Alegra (o, si la conexión ya existía sin datos guardados, la primera vez que se necesiten), el sistema MUST descargar **una vez** los artículos activos y las categorías y guardarlos en el equipo, mostrando el avance y avisando cuándo terminó.
- **FR-015**: Artículos de Alegra, Sin categoría, Combos, Inicio y la alerta y el contador de productos sin categoría MUST leer de los datos guardados al abrirse, sin consultar Alegra, y MUST mostrar su antigüedad.
- **FR-016**: La persona MUST poder actualizar los datos guardados cuando quiera («Actualizar desde Alegra»); si la actualización falla, el sistema MUST conservar los datos anteriores y explicar la causa en español.
- **FR-017**: Preparar el catálogo MUST actualizar antes los datos desde Alegra, de modo que precios e inventario del catálogo sean los del momento de prepararlo; si Alegra falla, la preparación MUST detenerse con un mensaje claro sin entregar un PDF parcial (principio II).
- **FR-018**: Los datos guardados MUST sobrevivir a reinicios, MUST permanecer solo en este equipo, MUST estar separados de los productos propios (principio I) y MUST NOT contener credenciales.
- **FR-019**: Si cambia la cuenta de Alegra de la conexión, el sistema MUST descartar los datos guardados de la cuenta anterior y MUST NOT mostrarlos con las credenciales de otra cuenta.
- **FR-020**: Si Alegra no responde pero hay datos guardados, las pantallas MUST seguir mostrándolos con el aviso de que no se pudieron actualizar y su antigüedad.
- **FR-021**: Una descarga interrumpida MUST NOT dejar datos a medias; el sistema MUST permitir una sola descarga a la vez.
- **FR-022**: Omisiones, secciones asignadas en Sin categoría y combos MUST seguir funcionando igual con los datos guardados. El sistema MUST seguir siendo de solo lectura con Alegra (principio I).

**Artículos de Alegra**

- **FR-023**: Mientras se descargan datos, la pantalla Artículos de Alegra MUST mostrar una pantalla de carga con mensaje y indicador de avance, reservando el espacio para que el contenido no salte; con datos guardados MUST NOT mostrarla.
- **FR-024**: La pantalla MUST permitir **filtrar por categoría** mostrando todas las categorías con su cantidad de artículos, «Todas» y «Sin categoría»; el filtro MUST combinarse con la búsqueda por nombre y con la vista «Omitidos», indicar cuántos artículos resultan y poder limpiarse con un clic.
- **FR-025**: Todo lo de la feature 006 (omitir, volver a incluir, aviso de combos, vista «Omitidos», mensajes de error y «Reintentar») MUST seguir funcionando igual.

**Diseño y consejos**

- **FR-026**: Las pantallas Artículos de Alegra y Apariencia MUST ajustar su diseño (espacios, alineación y jerarquía) para ser consistentes con el resto del panel y usables en 1366 × 768, sin quitar ninguna función existente.
- **FR-027**: El editor de Apariencia MUST mostrar un botón «Consejos» siempre visible que abra un panel con consejos breves en español, cerrable con un botón y con Esc, usable con teclado, que MUST NOT modificar ni guardar la plantilla ni perder cambios sin guardar.

**Pruebas**

- **FR-028**: Las reglas nuevas MUST tener pruebas automatizadas (principio V): límites de tamaño y reacomodo con 0, 1, 2 y 3 productos; nombre separado en los tres tipos de producto; texto completo o aviso en la revisión; datos guardados (descarga única, actualización, falla que conserva lo anterior, cambio de cuenta, reinicio, sin consultas a Alegra al abrir pantallas); pantalla de carga y filtro por categoría; botón «Consejos». Las pruebas con Alegra usan respuestas simuladas, nunca la cuenta real.

### Key Entities *(include if feature involves data)*

- **Tamaños de los productos de una plantilla**: ancho y alto de la zona de productos y de la foto del producto, propios de cada plantilla; con un valor de origen al que se puede restaurar.
- **Estilo del nombre**: si el nombre va separado o dentro de la burbuja, y su color de la paleta; propio de cada plantilla.
- **Datos de Alegra guardados**: copia local de los artículos activos y las categorías de la cuenta conectada, con la fecha de la última descarga y la cuenta a la que pertenecen; se reemplaza al actualizar y se descarta si cambia la cuenta.
- **Estado de la descarga**: sin datos, descargando (con avance), al día, desactualizado o con la última actualización fallida.
- **Consejo**: texto breve de ayuda del editor de Apariencia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La persona cambia el ancho y el alto de la zona de productos y de la foto y ve el resultado en menos de 1 segundo; el 100 % de los tamaños permitidos produce páginas con 0, 1, 2 o 3 productos sin encimarse ni salirse de la hoja.
- **SC-002**: En la plantilla Neón Noche, el 100 % de los productos del catálogo (de Alegra, propios y combos) muestra su nombre separado de la descripción y en neón, y la persona responsable aprueba la página contra `docs/Cat.pdf`.
- **SC-003**: Con los 197 artículos de la cuenta real, el 100 % de los nombres, descripciones y precios se ve completo o queda listado en la revisión de Generar; hay 0 textos cortados sin aviso.
- **SC-004**: Sin cambiar ningún tamaño, el catálogo generado tiene las mismas páginas, productos y posiciones que el de hoy (salvo el estilo del nombre en Neón Noche).
- **SC-005**: Tras la primera conexión, abrir Artículos de Alegra, Sin categoría, Combos o Inicio muestra los datos en menos de 2 segundos, con 0 peticiones a Alegra al abrirlos (hoy cada apertura espera varios segundos).
- **SC-006**: La descarga inicial de unos 200 artículos termina en menos de 1 minuto y la persona ve el avance durante toda la espera.
- **SC-007**: El 100 % de los catálogos preparados usa precios e inventario descargados en esa misma preparación; con Alegra caída, 0 catálogos se generan con datos viejos sin que la persona lo sepa.
- **SC-008**: Cuando hay que esperar, la pantalla de carga con su mensaje aparece en menos de 1 segundo desde que se abre la pantalla, y al terminar la descarga el contenido aparece sin que los elementos de la pantalla cambien de posición.
- **SC-009**: La persona encuentra todos los artículos de una categoría en menos de 5 segundos y en 2 pasos (abrir el filtro y elegir la categoría), y la lista se actualiza en menos de 1 segundo.
- **SC-010**: La persona encuentra el botón «Consejos» sin ayuda en menos de 10 segundos, y abrirlo o cerrarlo deja la plantilla exactamente como estaba.

## Assumptions

- «Productos» en la petición se refiere a los productos del catálogo (Alegra, propios y combos); el ajuste de ancho y alto cubre la **zona** donde van y la **foto** de cada uno, porque ya existe el rectángulo de la zona pero no el control de la foto.
- «Nombre separado del diseño … en neón y fuera del diseño» se interpreta como: título aparte, junto a la foto, **fuera de la burbuja de descripción y del marco de la foto**, en color neón con resplandor (en Neón Noche), tal como se ve en `docs/Cat.pdf`, donde el nombre se lee aparte de la descripción.
- Neón Noche (la plantilla predeterminada) adopta el nombre separado por defecto porque debe seguir `docs/Cat.pdf`; las otras tres plantillas de fábrica y las plantillas ya guardadas no cambian de aspecto salvo que la persona active la opción.
- «Dimensionar el texto para que se vea todo» usa la letra mínima legible que el sistema ya respeta (6 pt); por debajo de ese tamaño no se reduce más, sino que se avisa en la revisión.
- «Categorías» son las categorías de Alegra (en la aplicación, las secciones de Alegra); los artículos sin categoría se agrupan en «Sin categoría». El filtro es de una categoría a la vez.
- «Ajustar un poco el diseño» se limita a las pantallas que esta feature toca (Artículos de Alegra y Apariencia), manteniendo el estilo Pop del panel; no rediseña el resto de la aplicación.
- «Consejos» es una ayuda general del editor (no depende del elemento seleccionado) con unos pocos consejos breves; no es un tutorial paso a paso.
- Los datos guardados incluyen lo que hoy se consulta de Alegra para listar y elegir artículos (nombre, categoría, precio, inventario, descripción) y las categorías. Las fotos se siguen obteniendo al preparar el catálogo, con la caché de fotos que ya existe, para no depender de direcciones que vencen.
- Los datos guardados se actualizan solo cuando la persona lo pide y al preparar el catálogo; no hay actualización automática programada (la generación sigue siendo manual, principio VI).
- Una sola persona usa el sistema en un equipo; no hay datos compartidos entre equipos ni versiones de los datos guardados.
- Fuera de alcance: cambiar reglas de precio, inventario, combos, omisión de artículos o calidad del PDF; crear plantillas nuevas de fábrica; escribir en Alegra; editar fotos o descripciones; rediseñar el resto de pantallas.
- Depende de la conexión con Alegra ya existente (feature 001) y del editor de plantillas (feature 003); las plantillas guardadas y la lista de artículos omitidos (feature 006) se conservan.
