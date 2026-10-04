# Feature Specification: Editor visual de plantillas del catálogo

**Feature Branch**: `003-catalog-template-editor` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`)

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "El mockup se actualizó: validar las nuevas funciones y pantallas para diseñarlas y, si hace falta, instalar nuevas librerías para desarrollarlas." Esta feature **extiende** `002-admin-panel-theming` y **reemplaza** su pantalla Apariencia (formulario de cuatro colores) por el editor visual de plantillas del mockup actualizado en `docs/Diseño de catálogo y administración` (`Apariencia Editor.dc.html`, `Pagina Catalogo.dc.html` y `Admin Catalogo.dc.html`). No cambia las reglas de negocio de `001-catalog-pdf-generator`.

## Clarifications

### Session 2026-10-03

Decisiones tomadas al aplicar las recomendaciones de `/speckit-analyze` (no hubo preguntas interactivas):

- Q: ¿Neón Noche reproduce el catálogo actual al píxel? → A: No. Reproduce estructura, colores y tipografías con dos diferencias aceptadas: el bloque «Domicilios» de las portadas muestra los teléfonos como texto, sin los íconos de WhatsApp, y los títulos usan Fredoka en negrita en lugar de Fredoka One. Se validan en la revisión visual (SC-003).
- Q: ¿Cuál es el tamaño mínimo legible de un texto que se reduce para caber? → A: 6 pt; por debajo ya no se reduce más y, en un bloque automático, el editor muestra la advertencia.
- Q: ¿Se evalúa el contraste de los colores personalizados de cada elemento? → A: No; la advertencia de contraste evalúa solo los seis colores de la paleta.
- Q: ¿Qué es una «línea»? → A: un rectángulo delgado (alto desde 0,3 % de la página), no un tipo de forma distinto.
- Q: ¿Qué textos ajustan su tamaño automáticamente? → A: los bloques automáticos y los textos que contienen datos insertables; el resto de textos se muestra tal cual.

## Validación del mockup actualizado

Resultado de comparar el mockup actualizado (03-oct-2026) con lo ya especificado e implementado en las features 001 y 002:

| Pantalla o función del mockup | Estado | Dónde se cubre |
| --- | --- | --- |
| Login, navegación lateral, Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo e Historial (dirección 1b "Pop") | Ya cubierto por 001 y 002 | — |
| Apariencia como **editor visual a pantalla completa** (lienzo, páginas, elementos, inspector, capas, deshacer/rehacer, vista previa) | **Nuevo** (002 lo dejó fuera de alcance) | Historia 1 |
| Piezas de página: texto, insignia, forma, imagen, bloque de productos, bloque de políticas y pie | **Nuevo** | Historia 1 |
| Estilos de agotado (sello, cinta, gris) y distribuciones de productos (alternado, tarjetas, lista) | **Nuevo** | Historias 1 y 2 |
| Paleta de 6 colores, paletas sugeridas, restaurar colores y 5 pares tipográficos | **Nuevo** (amplía el tema de 4 colores de 002) | Historia 3 |
| Varias plantillas: galería, nueva desde estilo base, duplicar, predeterminada, eliminar, y elegir otra al generar | **Nuevo** | Historias 2 y 4 |
| Datos insertables (`{banner}`, `{seccion}`, `{telefonos}`, `{direccion}`, `{tienda}`) y pestaña Datos | **Nuevo** el uso de datos insertables; los textos, el contacto y las políticas ya existían en 002 | Historia 5 |
| Seleccionar o quitar todas las secciones al generar, desglose de precio del combo, nota de sincronización en Inicio e intentos de prueba restantes en Conexión | Faltantes menores | Historia 6 |
| Columna "Origen" (Panel / CLI / API) del Historial | **Fuera de alcance**: la generación sigue siendo solo manual (decisión de 002) | — |
| Selector de dirección visual (1a / 1b / 1c) | **Fuera de alcance**: ya excluido en 002 | — |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar el diseño de las páginas en un editor visual (Priority: P1)

El administrador abre **Apariencia** y entra a un editor a pantalla completa (sin la barra lateral del panel; "← Menú" lo devuelve al panel). Elige una de las cuatro páginas de la plantilla —**Portada**, **Portada de sección**, **Productos** y **Políticas**— y ve la página A4 en el lienzo con datos de muestra. Agrega títulos, textos, insignias, formas e imágenes; los arrastra, les cambia el tamaño y ajusta sus propiedades (colores, fuente, tamaño, contorno, resplandor, rotación, opacidad) en el panel derecho; reordena capas; deshace y rehace; mira la vista previa de las cuatro páginas juntas y guarda con un solo botón. Los bloques de productos, de políticas y de pie de página se llenan solos con los datos reales: no se pueden borrar, pero sí mover, redimensionar y cambiar de estilo.

**Why this priority**: es la funcionalidad nueva central del mockup; sin ella no hay nada que personalizar.

**Independent Test**: abrir el editor; en Portada agregar un título, moverlo, cambiarle color y tamaño, deshacer y rehacer, guardar, recargar la página y comprobar que el cambio persiste; en Productos comprobar que el bloque de productos no se puede eliminar.

**Acceptance Scenarios**:

1. **Given** una sesión iniciada, **When** el usuario abre Apariencia, **Then** ve el editor a pantalla completa con barra superior, panel lateral con cuatro secciones (Plantillas, Elementos, Estilo, Datos), lienzo con la página A4, tira de las cuatro páginas con miniaturas, controles de zoom e inspector; y "← Menú" lo devuelve al panel.
2. **Given** la página Portada, **When** agrega un título desde Elementos, **Then** aparece seleccionado en el lienzo, puede arrastrarlo y cambiar su tamaño desde la esquina, y los valores de posición y tamaño del inspector se actualizan mientras lo mueve.
3. **Given** un elemento que se arrastra cerca del centro de la página, **When** se acerca al centro horizontal o vertical, **Then** se ajusta al centro y se muestra una guía.
4. **Given** un elemento seleccionado, **When** usa las flechas, Supr o Ctrl+D, **Then** el elemento se mueve 0,5 % de la página (2 % con Mayús), se elimina o se duplica; y estos atajos no actúan mientras el usuario escribe en un campo de texto.
5. **Given** varios cambios hechos, **When** pulsa deshacer (botón o Ctrl+Z) y luego rehacer (botón, Ctrl+Mayús+Z o Ctrl+Y), **Then** el diseño retrocede y avanza paso a paso hasta 60 pasos, y arrastrar un elemento o deslizar un control cuenta como un solo paso.
6. **Given** el bloque de productos, de políticas o de pie de página, **When** el usuario intenta eliminarlo, ocultarlo o duplicarlo, **Then** el sistema lo impide con un mensaje que explica por qué; y **When** lo desbloquea, **Then** puede moverlo, redimensionarlo y cambiar su estilo.
7. **Given** el bloque de productos, **When** cambia su distribución (Alternado, Tarjetas o Lista) o el estilo de agotado (Sello, Cinta o Gris), **Then** el lienzo muestra los tres productos de muestra —uno de ellos agotado— con la nueva distribución y estilo.
8. **Given** una página sin elemento seleccionado, **When** el usuario mira el panel derecho, **Then** ve el fondo de la página (color, degradado o imagen) editable y la lista de capas con nombre, tipo, visible/oculto y fijo/libre, desde donde puede seleccionar cualquier elemento, incluso uno oculto.
9. **Given** cambios sin guardar, **When** el usuario mira la barra superior, **Then** un indicador dice "Cambios sin guardar"; y tras guardar dice "Todo guardado" y los cambios se usan en el próximo catálogo.
10. **Given** el botón Vista previa, **When** lo activa, **Then** ve las cuatro páginas lado a lado, sin marcos ni guías de edición, y puede volver a Editar.

---

### User Story 2 - Generar el PDF con la plantilla elegida (Priority: P1)

El PDF se dibuja según una plantilla: la **predeterminada** por defecto, u otra que el usuario elija en **Generar catálogo** solo para esa generación. Cada página del PDF reproduce lo que se ve en el editor. La plantilla inicial "Neón Noche" reproduce el catálogo actual, de modo que quien no use el editor apenas nota cambios (solo las dos diferencias aceptadas de la sección Clarifications).

**Why this priority**: sin esta historia el editor sería solo un dibujo; además protege la identidad de marca ya aprobada.

**Independent Test**: con la plantilla Neón Noche sin modificar, generar y comparar con el PDF de la feature 002 y con `docs/Cat.pdf`; luego guardar una plantilla con un elemento en otra posición, generar con ella y comprobar que el elemento aparece en esa posición.

**Acceptance Scenarios**:

1. **Given** la plantilla Neón Noche sin modificaciones como predeterminada, **When** el usuario genera el catálogo, **Then** el PDF coincide en estructura y estilo con `docs/Cat.pdf` y con el PDF de la feature 002, validado por revisión visual del responsable.
2. **Given** una plantilla editada y guardada, **When** se genera el catálogo, **Then** cada elemento visible aparece en el PDF con la misma posición, tamaño, rotación, opacidad, colores, tipografía y orden de apilado que en el editor, y los elementos ocultos no aparecen.
3. **Given** varias plantillas, **When** el usuario elige otra en Generar catálogo, **Then** ese PDF usa esa plantilla, la predeterminada no cambia y la próxima vez que abra Generar vuelve a aparecer la predeterminada.
4. **Given** una plantilla guardada entre preparar y generar, **When** se genera, **Then** el PDF usa la versión guardada más reciente, sin reiniciar la aplicación.
5. **Given** datos insertables en textos o en el pie, **When** se genera, **Then** cada página muestra el dato real: el nombre de cada sección en sus páginas, el banner de esa generación, los teléfonos, la dirección y el nombre de la tienda.
6. **Given** cualquier plantilla, **When** se genera, **Then** el número de portadas y de páginas coincide con la vista previa de estructura y ninguna página de producto tiene más de 3 productos.
7. **Given** un producto agotado según las reglas de la feature 001, **When** se genera con cada estilo de agotado (Sello, Cinta o Gris), **Then** su tarjeta muestra con claridad la indicación AGOTADO; y los productos propios nunca la muestran.
8. **Given** nombres, descripciones, políticas, banner o direcciones muy largos, **When** se genera con cualquiera de las cuatro plantillas base, **Then** el texto de los bloques automáticos y de los datos insertables no desborda su caja ni la hoja.

---

### User Story 3 - Paleta y tipografía de la plantilla (Priority: P2)

En la sección **Estilo** el usuario ve la paleta de la plantilla (seis colores: Fondo, Acento 1, Acento 2, Acento 3, Texto y Papel), cada uno con la indicación de qué elementos afecta. Cambia un color y todos los elementos que lo usan se actualizan a la vez en las cuatro páginas. Puede aplicar una paleta sugerida, restaurar los colores originales de la plantilla y elegir un par tipográfico (título + cuerpo).

**Why this priority**: permite renovar la imagen completa del catálogo con pocos clics; el catálogo ya es útil con la paleta por defecto.

**Independent Test**: cambiar el color de Acento 1 y comprobar que cambian a la vez todos los elementos que lo usan; aplicar una paleta sugerida; restaurar los colores originales; cambiar el par tipográfico y generar el PDF.

**Acceptance Scenarios**:

1. **Given** la paleta de la plantilla, **When** el usuario cambia un color, **Then** todos los elementos de las cuatro páginas que usan ese color de paleta cambian al instante en el lienzo, y los elementos con un color personalizado no cambian.
2. **Given** las cinco paletas sugeridas (Neón Noche, Pop crema, Kawaii, Kraft y Matcha), **When** el usuario aplica una, **Then** la paleta de la plantilla pasa a esos seis colores con un solo clic y el cambio se puede deshacer.
3. **Given** una paleta modificada, **When** pulsa "Restaurar colores originales", **Then** la paleta vuelve a la del estilo base de esa plantilla (para Neón Noche: fondo `#11052C`, acentos `#FF007A`, `#00FF66` y `#FF9900`).
4. **Given** un valor de color que no tiene el formato `#RRGGBB`, **When** el usuario intenta aplicarlo, **Then** se rechaza con un mensaje claro y se conserva el color anterior.
5. **Given** una combinación con poco contraste (un texto sobre su superficie, o un acento casi igual al fondo), **When** el usuario la aplica, **Then** el sistema advierte que puede no ser legible, pero permite continuar.
6. **Given** los cinco pares tipográficos, **When** el usuario elige uno, **Then** todos los elementos que usan la fuente de título o de cuerpo cambian a la vez, los que tienen una fuente específica no cambian, y el PDF usa las mismas tipografías sin necesidad de conexión a internet.

---

### User Story 4 - Gestionar varias plantillas (Priority: P2)

En la vista **Plantillas** (galería) el usuario ve todas las plantillas con miniaturas de su portada y de sus páginas de productos, su paleta y su par tipográfico. Puede crear una nueva a partir de un estilo base, duplicar, editar, elegir cuál se usa al generar y eliminar las que no necesita. Esto le permite tener, por ejemplo, una plantilla para temporada navideña y otra para el catálogo habitual.

**Why this priority**: da flexibilidad para campañas, pero el catálogo funciona con una sola plantilla.

**Independent Test**: crear una plantilla desde un estilo base, duplicarla, marcarla como predeterminada, eliminar la anterior y generar con la nueva.

**Acceptance Scenarios**:

1. **Given** la galería, **When** el usuario la abre, **Then** cada plantilla muestra miniaturas, nombre, cinco puntos con los colores de su paleta, el par tipográfico y la marca "Predeterminada" en la que corresponda, con las acciones Editar, Duplicar, Usar al generar y Eliminar.
2. **Given** los cuatro estilos base (Neón Noche, Pop crema, Kawaii pastel y Kraft minimal), **When** el usuario crea una plantilla nueva desde uno, **Then** se crea con el nombre "Nueva · <estilo>" y se abre en el editor.
3. **Given** una plantilla, **When** pulsa Duplicar, **Then** se crea una copia independiente llamada "<nombre> (copia)" y se abre en el editor.
4. **Given** una plantilla que no es la predeterminada, **When** pulsa "Usar al generar", **Then** pasa a ser la predeterminada y la marca se mueve a ella.
5. **Given** la plantilla predeterminada, **When** el usuario mira sus acciones, **Then** no puede eliminarla; **Given** otra plantilla, **When** pulsa Eliminar, **Then** el sistema pide confirmación y, al aceptar, la elimina.
6. **Given** el nombre de la plantilla en la barra superior del editor, **When** el usuario lo edita, **Then** el nombre se actualiza en la galería y en Generar catálogo; un nombre vacío no se puede guardar.

---

### User Story 5 - Datos del catálogo dentro del editor (Priority: P2)

En la sección **Datos** del editor el usuario edita el nombre de la tienda, el texto del banner de portada, los dos teléfonos, la dirección y las políticas de compra (título y texto de cada una). Estos datos son únicos para todo el catálogo y se insertan en los textos y el pie de cualquier plantilla mediante marcadores (Banner, Sección, Teléfonos, Dirección, Tienda) que se reemplazan por el dato real al generar.

**Why this priority**: evita escribir los teléfonos o el banner en cada plantilla; consolida en el editor los textos que 002 ya permitía editar.

**Independent Test**: cambiar un teléfono en Datos y ver que todos los elementos que lo usan cambian en el lienzo y en la vista previa; guardar y comprobar el PDF.

**Acceptance Scenarios**:

1. **Given** un elemento que usa el marcador de teléfonos, **When** el usuario edita un teléfono en Datos, **Then** el lienzo y la vista previa muestran el cambio al instante.
2. **Given** un texto o el pie seleccionado, **When** el usuario pulsa uno de los marcadores de dato, **Then** el marcador se agrega al texto y el lienzo muestra el dato real (el marcador de sección muestra un nombre de sección de ejemplo).
3. **Given** un segundo teléfono vacío, **When** se muestra el marcador de teléfonos, **Then** aparece solo el teléfono presente, sin separadores sobrantes.
4. **Given** un banner de más de 80 caracteres o políticas con más de 3500 caracteres en total, **When** el usuario intenta guardar, **Then** el contador se muestra en alerta, se explica el motivo y no se guarda hasta corregirlo.
5. **Given** un texto de banner personalizado en Generar catálogo, **When** se genera, **Then** el marcador de banner usa ese texto solo en esa generación y el texto guardado en Datos no cambia.
6. **Given** que se agrega o quita una política, **When** se guarda, **Then** la página de Políticas del PDF la incluye o la omite.

---

### User Story 6 - Ajustes menores de paridad con el mockup (Priority: P3)

El mockup actualizado muestra cuatro detalles que las pantallas actuales no tienen: un control para seleccionar o quitar todas las secciones al generar, el desglose del precio de un combo mientras se edita, la antigüedad de la sincronización con Alegra en Inicio y el número de intentos de prueba restantes en Conexión Alegra.

**Why this priority**: son mejoras de comodidad que no cambian ningún resultado del catálogo.

**Independent Test**: comprobar cada detalle en su pantalla.

**Acceptance Scenarios**:

1. **Given** la pantalla Generar catálogo con secciones disponibles, **When** el usuario pulsa "Quitar todas" o "Seleccionar todas", **Then** todas las secciones se desmarcan o se marcan, y la vista previa de estructura se actualiza.
2. **Given** un combo en edición, **When** cambia componentes, cantidades o el precio, **Then** ve al instante la suma de componentes, el ahorro y el precio que tendrá en el catálogo.
3. **Given** que Alegra respondió, **When** el usuario abre Inicio, **Then** el indicador de productos activos muestra hace cuánto tiempo se obtuvieron los datos.
4. **Given** la pantalla Conexión Alegra, **When** el usuario hace pruebas de conexión, **Then** ve cuántos intentos le quedan en el minuto en curso y, al agotarlos, se le pide esperar.

---

### Edge Cases

- El usuario sale del editor ("← Menú", cierre o recarga de la pestaña) con cambios sin guardar: se le avisa. El botón "Atrás" del navegador no se intercepta (igual que en 002).
- Dos pestañas editan las plantillas a la vez: la segunda que guarda recibe un aviso de que los datos cambiaron y debe recargar, sin pisar el cambio de la primera.
- Se elimina una plantilla que estaba elegida en una preparación de Generar abierta: al generar se usa la predeterminada y se informa al usuario.
- Un elemento queda parcialmente fuera de la hoja: lo que sale se recorta en el PDF; un elemento completamente fuera de la hoja sigue accesible desde la lista de capas.
- Un bloque automático se reduce tanto que su contenido no cabe: el contenido reduce su letra hasta un mínimo legible de 6 pt y el inspector muestra una advertencia; no se bloquea el guardado.
- Se ocultan o eliminan todos los elementos libres de una página: la página sigue siendo válida y conserva su fondo y sus bloques automáticos.
- Un marcador de sección se usa en una página que no pertenece a una sección (portada o políticas): se muestra vacío en el PDF.
- Un marcador desconocido escrito a mano (por ejemplo `{otra}`) se deja tal cual en el texto.
- El usuario cambia de plantilla en el editor: el historial de deshacer y rehacer se reinicia, y los cambios sin guardar de la plantilla anterior no se pierden.
- Una paleta deja un texto ilegible sobre su superficie: se advierte, no se bloquea (igual que en 002). Los colores personalizados de cada elemento no se evalúan.
- Alegra cae mientras el usuario edita: el editor sigue funcionando porque solo usa datos de muestra y datos locales; solo Generar avisa del fallo de conexión.
- Un nombre de plantilla de más de 60 caracteres se rechaza.

## Requirements *(mandatory)*

### Functional Requirements

**Editor: estructura y navegación**
- **FR-001**: Apariencia MUST abrir el editor a pantalla completa, sin la barra lateral del panel, con un botón "← Menú" que devuelve al panel; esto reemplaza el formulario de Apariencia de la feature 002.
- **FR-002**: La barra superior MUST ofrecer el nombre de la plantilla editable, deshacer y rehacer, un indicador de estado (todo guardado / cambios sin guardar), Vista previa, "Usar" (marcar como predeterminada), Guardar y la alternancia entre las vistas Editor y Plantillas.
- **FR-003**: El editor MUST ofrecer cuatro secciones laterales —Plantillas, Elementos, Estilo y Datos—, un lienzo con la página A4 seleccionada, una tira con las cuatro páginas (Portada, Portada de sección, Productos, Políticas) y su miniatura, controles de zoom (acercar, alejar y ajustar, entre 20 % y 200 %) y un inspector a la derecha.
- **FR-004**: El lienzo MUST mostrar la página con proporción A4 usando datos de muestra (tres productos de ejemplo, uno agotado, y una sección de ejemplo) junto con los datos reales del negocio, y Vista previa MUST mostrar las cuatro páginas lado a lado sin ayudas de edición.

**Elementos y manipulación**
- **FR-005**: El usuario MUST poder agregar, en la página seleccionada, títulos, textos, insignias, formas (rectángulo, círculo, píldora y línea, que es un rectángulo delgado) e imágenes (logo y collage), y textos con los datos del catálogo ya insertados.
- **FR-006**: Cada página MUST tener bloques automáticos que se llenan con los datos reales: la página Portada de sección, el bloque de introducción (se muestra solo cuando la sección propia tiene texto de introducción, como hoy); la página Productos, el bloque de productos y el pie; la página Políticas, el bloque de políticas y el pie. Estos bloques MUST NOT poder eliminarse, ocultarse ni duplicarse (con un mensaje que explique por qué), y MUST poder moverse, redimensionarse y cambiar de estilo una vez desbloqueados.
- **FR-007**: El usuario MUST poder seleccionar un elemento haciendo clic y anular la selección con un clic en el fondo o con Esc; arrastrarlo para moverlo; redimensionarlo desde la esquina; y el movimiento MUST ajustarse al centro horizontal y vertical con una guía visual. Un elemento fijo (bloqueado) se puede seleccionar, pero no mover ni redimensionar hasta desbloquearlo.
- **FR-008**: El editor MUST soportar los atajos de teclado: flechas (0,5 % de la página; 2 % con Mayús), Supr para eliminar, Ctrl+D para duplicar, Ctrl+Z para deshacer, Ctrl+Mayús+Z o Ctrl+Y para rehacer y Esc para anular la selección; y MUST NOT activarlos mientras el usuario escribe en un campo de texto.
- **FR-009**: Sobre el elemento seleccionado el usuario MUST poder duplicar, traer al frente, enviar atrás, bloquear o desbloquear, ocultar o mostrar y eliminar. Sin selección, el panel MUST mostrar la lista de capas de la página en orden de apilado, con nombre, tipo, visible/oculto y fijo/libre.
- **FR-010**: El editor MUST permitir deshacer y rehacer al menos 60 pasos por sesión de edición; una acción continua (arrastrar, deslizar un control, escribir en un mismo campo) MUST contar como un solo paso; y cambiar de plantilla MUST reiniciar el historial.

**Propiedades de los elementos**
- **FR-011**: El inspector MUST permitir editar en todo elemento la posición (X, Y) y el tamaño (ancho, alto) como porcentaje de la página, la opacidad (0–100 %) y, salvo en los bloques automáticos, la rotación (−180° a 180°).
- **FR-012**: El inspector MUST ofrecer propiedades según el tipo de elemento:
  - **Texto**: contenido, insertar dato, fuente, tamaño (8–140 px), peso (Normal, Semi, Negrita, Black), alineación (izquierda, centro, derecha), espaciado de letras (−2 a 12 px), mayúsculas, color de relleno, contorno (color y grosor de 0 a 8 px) y resplandor neón.
  - **Insignia**: texto, color de fondo, color del texto, fuente y tamaño (8–48 px).
  - **Forma**: tipo (rectángulo, círculo o píldora), relleno, borde (color y grosor de 0 a 12 px), esquinas (0–80 px, en rectángulos) y resplandor neón.
  - **Imagen**: cuál (logo, collage, mármol, atardecer o marco de portada), ajuste (contener o cubrir) y esquinas hasta llegar a círculo.
  - **Bloque de productos**: distribución (Alternado, Tarjetas, Lista); foto (fondo, color y grosor del anillo de 0 a 10 px, esquinas de 0 a 80 px); descripción (color de la burbuja, color del texto, esquinas de 0 a 40 px); precio (fondo, borde, color del texto, forma Píldora, Suave o Recta); y estilo de agotado (Sello, Cinta o Gris, con color propio para la cinta).
  - **Bloque de políticas**: fondo y texto del título, fondo y texto de la caja.
  - **Bloque de introducción**: color de fondo, color del texto y esquinas (0–60 px).
  - **Pie de página**: contenido con datos insertables, fondo, línea superior (color y grosor de 0 a 6 px) y color del texto.
- **FR-013**: Cuando no hay elemento seleccionado, el inspector MUST permitir editar el fondo de la página: color, degradado vertical (color superior e inferior) o imagen (mármol o atardecer) con color de apoyo.
- **FR-014**: Todo color de un elemento MUST poder elegirse entre los seis colores de la paleta de la plantilla, como color personalizado `#RRGGBB` o, donde aplique, "ninguno / transparente". Un color de paleta MUST actualizarse cuando cambie la paleta; uno personalizado queda fijo.

**Estilo: paleta y tipografía**
- **FR-015**: Cada plantilla MUST tener una paleta de seis colores —Fondo, Acento 1, Acento 2, Acento 3, Texto y Papel— y la sección Estilo MUST indicar, para cada uno, qué elementos afecta. El usuario MUST poder editar cada color, restaurar los colores originales del estilo base de la plantilla y aplicar con un clic una de cinco paletas sugeridas (Neón Noche, Pop crema, Kawaii, Kraft y Matcha).
- **FR-016**: El sistema MUST validar los colores `#RRGGBB`, rechazar los inválidos conservando el valor anterior, y advertir —sin bloquear— cuando, entre los seis colores de la paleta, un texto tenga poco contraste con su superficie o un acento casi no se distinga del fondo, con los mismos umbrales de la feature 002. Los colores personalizados de cada elemento no se evalúan.
- **FR-017**: Cada plantilla MUST tener un par tipográfico (título y cuerpo) elegible entre cinco pares: Fredoka + Poppins, Bungee + Poppins, Zen Maru Gothic + Zen Maru Gothic, DM Serif Display + Space Grotesk y Space Grotesk + Space Grotesk. Cada elemento de texto MUST poder usar la fuente de título, la de cuerpo o una de las seis familias. Las seis familias MUST verse igual en el editor y en el PDF sin depender de internet.

**Plantillas**
- **FR-018**: Una plantilla MUST definir las cuatro páginas (portada, portada de sección, productos y políticas), una paleta y un par tipográfico, y MUST tener un nombre de hasta 60 caracteres. Siempre MUST existir al menos una plantilla y exactamente una predeterminada.
- **FR-019**: La vista Plantillas MUST mostrar cada plantilla con las miniaturas de su portada y de sus páginas de productos, su nombre, cinco puntos con los colores de su paleta, su par tipográfico y la marca "Predeterminada"; y MUST permitir Editar, Duplicar, "Usar al generar" y Eliminar (esta última no disponible para la predeterminada y con confirmación).
- **FR-020**: El usuario MUST poder crear una plantilla nueva a partir de uno de cuatro estilos base —Neón Noche, Pop crema, Kawaii pastel y Kraft minimal—, que se crea con el nombre "Nueva · <estilo>"; y duplicar una existente, que se crea como "<nombre> (copia)" e independiente del original.
- **FR-021**: En la primera ejecución MUST existir una plantilla por cada estilo base, con Neón Noche como predeterminada. Neón Noche MUST reproducir el catálogo actual de la feature 002 y `docs/Cat.pdf` en estructura, colores y tipografías, con las dos diferencias aceptadas de la sección Clarifications, y el tema guardado en 002 (fondo y tres acentos) MUST conservarse como paleta de la plantilla predeterminada.
- **FR-022**: Generar catálogo MUST permitir elegir la plantilla para esa generación, partiendo de la predeterminada, sin cambiar la predeterminada. La plantilla MUST leerse al generar, de modo que una plantilla guardada entre preparar y generar se aplique.

**Datos del catálogo**
- **FR-023**: La sección Datos MUST permitir editar el nombre de la tienda, el texto del banner de portada (hasta 80 caracteres), los dos teléfonos, la dirección y las políticas de compra (título y texto, con opción de agregar y quitar), con un contador del total de caracteres de las políticas (máximo 3500). Estos datos son únicos para todo el catálogo, no por plantilla, y se guardan junto con las plantillas.
- **FR-024**: Los textos, las insignias y el pie MUST aceptar los marcadores `{banner}`, `{seccion}`, `{telefonos}`, `{direccion}` y `{tienda}`, que el editor y el PDF reemplazan por el dato real. `{telefonos}` MUST unir los teléfonos no vacíos con " · " sin separadores sobrantes; `{seccion}` MUST mostrar el nombre de cada sección en sus páginas y vacío donde no hay sección; un marcador desconocido MUST dejarse tal cual. El texto del banner de una generación específica (feature 002) MUST seguir reemplazando a `{banner}` solo en esa generación.

**Guardado**
- **FR-025**: Guardar MUST persistir en una sola acción todas las plantillas modificadas, cuál es la predeterminada y los datos del catálogo. El resultado MUST aplicarse a los PDF siguientes sin reiniciar la aplicación; si alguna validación falla, MUST NOT guardarse nada y se conserva lo anterior.
- **FR-026**: El editor MUST avisar si el usuario sale ("← Menú", cierre o recarga de la pestaña) con cambios sin guardar, e indicar permanentemente si hay cambios pendientes.
- **FR-027**: Si las plantillas o los datos fueron modificados desde otra pestaña, el sistema MUST rechazar el guardado con datos desactualizados y avisar al usuario para que recargue (como en la feature 002).

**PDF fiel a la plantilla**
- **FR-028**: El PDF MUST dibujar cada página según la plantilla elegida, con los mismos elementos visibles, posición, tamaño, rotación, opacidad, colores, tipografías, fondo y orden de apilado que muestra el editor.
- **FR-029**: La plantilla MUST cambiar solo la apariencia, no el contenido: el PDF MUST seguir siendo A4 con un máximo de 3 productos por página, precios en pesos colombianos, y las reglas de omisión, agotados, combos y secciones de las features 001 y 002 no cambian. Las secciones propias y los combos MUST usar la página Productos de la plantilla. La estructura (número de portadas y de páginas) MUST ser la misma con cualquier plantilla.
- **FR-030**: Cada estilo de agotado (Sello, Cinta y Gris) MUST mostrar con claridad la palabra AGOTADO, solo en los productos que según la feature 001 están agotados y nunca en productos propios.
- **FR-031**: Los bloques automáticos y los textos con datos insertables MUST reducir su letra, hasta un mínimo de 6 pt, para caber en su caja sin desbordarla, y nada MUST dibujarse fuera de la hoja.

**Paridad menor con el mockup**
- **FR-032**: Generar catálogo MUST ofrecer un control para seleccionar o quitar todas las secciones, que actualiza la vista previa de estructura.
- **FR-033**: Combos MUST mostrar, mientras se edita, la suma de los componentes, el ahorro y el precio resultante en el catálogo.
- **FR-034**: Inicio MUST indicar hace cuánto tiempo se obtuvieron los datos de Alegra.
- **FR-035**: Conexión Alegra MUST mostrar cuántos intentos de prueba quedan en el minuto en curso.

### Key Entities

- **Plantilla**: nombre, estilo base del que partió, paleta de seis colores, par tipográfico y las cuatro páginas; puede ser la predeterminada; tiene una marca de última modificación para detectar ediciones simultáneas.
- **Página de plantilla**: uno de cuatro tipos (portada, portada de sección, productos, políticas), con su fondo (color, degradado o imagen) y su lista ordenada de elementos.
- **Elemento**: texto, insignia, forma, imagen o bloque automático (introducción, productos, políticas, pie); con posición y tamaño relativos a la página, rotación, opacidad, visibilidad, bloqueo y las propiedades propias de su tipo.
- **Paleta**: seis colores con nombre (Fondo, Acento 1, Acento 2, Acento 3, Texto, Papel) a los que los elementos hacen referencia.
- **Par tipográfico**: fuente de títulos y fuente de cuerpo.
- **Datos del catálogo**: nombre de la tienda, banner, dos teléfonos, dirección y políticas; únicos para todo el catálogo.
- **Opciones de generación** *(extiende 002)*: añade la plantilla elegida para esa generación.
- **Entidades existentes** (features 001 y 002): Usuario, Conexión Alegra, Producto de Alegra, Sección, Producto propio, Combo, Asignación de sección, Catálogo generado, Tema del catálogo (se conserva como paleta de la plantilla predeterminada), Configuración del negocio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario cambia un color de la paleta, genera el catálogo y obtiene un PDF con el nuevo color en menos de 3 minutos.
- **SC-002**: En el 100 % de los elementos visibles de las cuatro páginas de las cuatro plantillas base, la posición y el tamaño en el PDF difieren de los del editor en 1 % o menos de la página, y los colores y las tipografías coinciden.
- **SC-003**: Con la plantilla Neón Noche sin modificar, el PDF coincide con `docs/Cat.pdf` y con el PDF de la feature 002 en estructura y estilo, salvo las dos diferencias aceptadas de la sección Clarifications, validado por revisión visual del responsable de la tienda.
- **SC-004**: Un usuario sin ayuda crea una plantilla desde un estilo base, cambia un color, mueve un elemento, la marca como predeterminada y genera un PDF con ella en menos de 10 minutos.
- **SC-005**: El 100 % de las acciones de edición (agregar, mover, redimensionar, cambiar una propiedad, eliminar, duplicar, reordenar) se deshacen y rehacen devolviendo el diseño exactamente al estado anterior, hasta 60 pasos.
- **SC-006**: Ninguna página de producto tiene más de 3 productos ni contenido cortado o desbordado con cada una de las cuatro plantillas base y con textos de longitud máxima.
- **SC-007**: El 100 % de los cambios guardados (plantillas, predeterminada y datos) persisten tras recargar la página, y el aviso de cambios sin guardar aparece en el 100 % de las salidas con cambios pendientes.
- **SC-008**: Al arrastrar o redimensionar un elemento en una pantalla de 1366×768, el elemento acompaña al puntero con un retraso menor a 100 ms, y cualquier cambio de propiedad se ve en el lienzo en menos de 0,2 segundos.
- **SC-009**: El 100 % de los productos agotados muestran la indicación AGOTADO con cualquiera de los tres estilos, y ningún producto propio la muestra.
- **SC-010**: El número de portadas y de páginas de la vista previa de estructura coincide con el del PDF en el 100 % de los casos, con cualquier plantilla.

## Assumptions

- Esta feature extiende `002-admin-panel-theming` y reemplaza su pantalla Apariencia. La suposición de 002 de que un editor libre de maquetación quedaba fuera de alcance queda superada por esta feature. Las reglas de las features 001 y 002 que esta spec no menciona siguen vigentes.
- Los mockups de referencia son los tres archivos de `docs/Diseño de catálogo y administración`. El panel conserva la dirección visual 1b "Pop" y no incluye selector de direcciones.
- El editor está pensado para pantallas de escritorio o portátil: debe ser legible y operable en 1366×768 y a 1024 px de ancho; por debajo de eso no se garantiza.
- Las imágenes disponibles en el editor son las cinco incluidas con el catálogo (logo, collage, mármol, atardecer y el marco de portada que usa hoy el PDF); subir imágenes propias queda fuera de esta versión.
- Una plantilla se aplica a todo el catálogo; no hay plantillas distintas por sección. Los productos propios y los combos se dibujan en la página Productos de la plantilla.
- La plantilla cambia cómo se ve el catálogo, no qué contiene: las reglas de inclusión, agotados, precios y paginación no dependen de la plantilla.
- Los datos del catálogo (tienda, banner, teléfonos, dirección y políticas) son únicos y compartidos por todas las plantillas.
- Las plantillas "Pop crema", "Kawaii pastel" y "Kraft minimal" tienen fondos claros. La constitución v1.1.0 (principio IV) exige que la plantilla predeterminada de fábrica (Neón Noche) siga `docs/Cat.pdf`; las demás son alternativas que elige el responsable y no se comparan con Cat.pdf.
- La generación sigue siendo solo manual; por eso no se incorpora la columna "Origen" del Historial del mockup.
- La aprobación visual del responsable de la feature 002 (sus SC-001 y SC-007) sigue pendiente. El PDF actual se toma como línea base de SC-003 y se valida junto con esa aprobación.
- Las cuatro tipografías que hoy no están en el proyecto (Bungee, Zen Maru Gothic, Space Grotesk y DM Serif Display) deben quedar disponibles sin conexión. Qué librerías, si alguna, hacen falta además para el editor se decide y justifica en el plan; el mockup resuelve el arrastre, el redimensionado y la selección de color sin librerías externas.
- El historial de deshacer y rehacer vive solo durante la sesión de edición; no se guarda.
- Un solo usuario administrador en su equipo local; el idioma es español y los precios son pesos colombianos.
