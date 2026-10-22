# Feature Specification: Selectores de color y de fuente de la plantilla

**Feature Branch**: `009-color-font-pickers`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Feature 009: selectores de color y de fuente del editor de plantillas de Asia-POP, basados en mediciones reales de Canva hechas con REA. Selector de color que ofrece primero los colores que ya usa la plantilla, con buscador por nombre o código hexadecimal y cuentagotas si el navegador lo permite, sin cambiar cómo se guardan los colores; selector de fuente en el que cada nombre se muestra escrito con su propia tipografía, con buscador y con las fuentes ya usadas primero, manteniendo las seis familias y las fuentes de título y cuerpo de la plantilla. Las plantillas existentes deben verse y exportarse a PDF exactamente igual: esta feature no cambia el render, solo cómo se eligen color y fuente."

## Evidencia de referencia (medida con REA)

Los patrones de esta feature salen de mediciones reales del editor de Canva, hechas con REA sobre una plantilla de prueba el 2026-10-22. Solo se observó la interfaz ya dibujada. De Canva se toman **patrones y medidas**; **no** se copian assets, íconos, textos ni su Kit de Marca de pago. El detalle y las capturas están en `docs/specs/rea-evidence/README.md` (rondas tercera y cuarta, capturas `08-panel-fuente.png` y `09-panel-color.png`) y la decisión de qué traer en `docs/specs/canva-fields-inventory.md` (sección 6 revisada).

| Tema | Lo medido en Canva | Cómo se midió |
| --- | --- | --- |
| Forma del selector | Cada botón de la barra contextual (fuente, color) abre un **panel lateral de 360 px** con título a la izquierda y botón de cierre (X) a la derecha, que reemplaza al panel anterior | Capturas de los paneles abiertos; el ancho sale del cajón (de x = 72 a x = 432) |
| Color | Buscador por nombre o código hexadecimal; fila con «agregar color» y **cuentagotas**; «Colores del texto» y **«Colores del diseño»** (los que el diseño ya usa) antes que cualquier paleta general; paleta tomada de las fotos; colores sólidos predeterminados; Kit de Marca | Captura y árbol de accesibilidad |
| Fuente | Dos pestañas (Fuente, Estilo); buscador con filtros; **«Fuentes del documento»** (las ya usadas) antes que **«Fuentes recomendadas»**; **cada fuente se muestra con su nombre dibujado en esa misma fuente**; marca de verificación en la activa; «Subir fuente» al pie | Captura |
| Cierre | Los ajustes grandes viven en panel; los pequeños (transparencia, configuración avanzada) en una tarjeta flotante bajo el botón | Capturas |

**No verificado**: medidas en píxeles de los controles dentro de cada panel, y el panel «Estilo» de la fuente.

## Estado actual del editor

- **Color**: cada propiedad de color del inspector (relleno, contorno, resplandor, fondo, texto…) muestra **seis cuadritos fijos** con los colores de la paleta de la plantilla (Fondo, Acento 1, Acento 2, Acento 3, Texto y Papel), un cuadrito opcional «Ninguno» o «Transparente», y un **selector de color del navegador** para elegir un color libre. Un color se guarda como el nombre de un color de la paleta (y entonces sigue a la paleta si esta cambia) o como un código hexadecimal.
- **Fuente**: el inspector de textos y de otros elementos con texto muestra una **lista desplegable de texto plano** con «Título · (fuente del título)», «Cuerpo · (fuente del cuerpo)» y las seis familias disponibles: Fredoka, Poppins, Bungee, Zen Maru Gothic, Space Grotesk y DM Serif Display. No muestra cómo se ve cada una ni cuáles ya se usan.
- El editor no permite ver de un vistazo qué colores personalizados ya usa la plantilla fuera de los seis de la paleta, ni buscar un color por código.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reutilizar los colores que la plantilla ya usa (Priority: P1)

Quien diseña la plantilla quiere que un texto nuevo tenga el mismo tono rosado de un fondo que eligió hace un rato. Hoy tiene que recordar el código o abrir el selector del navegador y adivinar. Con esta mejora, al abrir el selector de color ve primero, en un grupo propio, **los colores que la plantilla ya usa** (los de la paleta y cualquier color libre usado en cualquier página) y elige uno con un clic.

**Why this priority**: Es la mayor ganancia de coherencia visual y de velocidad, y la idea medida en Canva con más valor para una plantilla de marca; no cambia ningún dato guardado.

**Independent Test**: Se prueba completo en una plantilla con dos colores libres usados en distintos elementos: abrir el selector de color de un tercer elemento, ver ambos colores en «Colores de la plantilla» y aplicar uno con un clic.

**Acceptance Scenarios**:

1. **Given** una plantilla que usa los seis colores de su paleta y dos colores libres, **When** la persona abre el selector de color de un elemento, **Then** ve un grupo «Colores de la plantilla» con esos colores, sin repetir ninguno.
2. **Given** el selector abierto, **When** elige un color de ese grupo, **Then** el elemento adopta el color, el cambio cuenta como un paso de deshacer y el selector muestra cuál está activo.
3. **Given** el selector abierto, **When** elige uno de los seis colores de la paleta, **Then** se guarda como color de la paleta (y sigue a la paleta si esta cambia), como hoy.
4. **Given** una plantilla guardada antes de esta feature, **When** se abre y se genera el PDF, **Then** se ve y se exporta exactamente igual que antes.

---

### User Story 2 - Buscar un color por nombre o por código (Priority: P2)

La persona recibió de la marca el código `#E91E8C` y quiere aplicarlo a un título. Hoy debe usar el selector gráfico del navegador. Con esta mejora escribe el código (con o sin `#`, en mayúsculas o minúsculas) o el nombre de un color de la paleta o uno básico («acento 2», «azul»), y el color queda aplicado o propuesto.

**Why this priority**: Resuelve un caso muy frecuente de trabajo con una marca, aunque se puede suplir con el selector actual.

**Independent Test**: Se prueba completo escribiendo un código hexadecimal válido, uno inválido y un nombre, y comprobando el resultado de cada caso.

**Acceptance Scenarios**:

1. **Given** el selector abierto, **When** escribe `e91e8c`, `#E91E8C` o `#e91`, **Then** se propone ese color con una muestra y se aplica al confirmar.
2. **Given** el selector abierto, **When** escribe un código incompleto o inválido (`#12`, `zzz`), **Then** no se aplica nada, se indica que el código no es válido y el color anterior se conserva.
3. **Given** el selector abierto, **When** escribe parte del nombre de un color de la paleta o de un color básico, **Then** ve solo los colores cuyo nombre coincide, sin importar mayúsculas ni tildes.
4. **Given** una búsqueda sin coincidencias, **When** se muestra el resultado, **Then** hay un mensaje claro y un modo de limpiar la búsqueda.

---

### User Story 3 - Elegir la fuente viéndola (Priority: P2)

Hoy la lista de fuentes muestra solo nombres en texto plano y la persona debe probar una por una. Con esta mejora cada fuente aparece **escrita con su propia tipografía**, con una marca en la que está activa, y con un grupo inicial «Fuentes de la plantilla» (título, cuerpo y las que ya usan los elementos).

**Why this priority**: Mejora clara y de bajo costo; las seis familias ya existen, solo cambia cómo se eligen.

**Independent Test**: Se prueba completo abriendo el selector de fuente de un texto, comprobando que cada nombre se ve en su tipografía, que la activa tiene marca y que se puede cambiar con un clic.

**Acceptance Scenarios**:

1. **Given** un elemento con texto, **When** la persona abre el selector de fuente, **Then** cada una de las seis familias se muestra con su nombre escrito en esa misma tipografía, y la activa lleva una marca de verificación.
2. **Given** el selector abierto, **When** mira el principio de la lista, **Then** ve un grupo «Fuentes de la plantilla» con «Título», «Cuerpo» y las familias que los elementos ya usan, y debajo «Todas las fuentes».
3. **Given** un elemento que usa «Título» o «Cuerpo», **When** abre el selector, **Then** esa opción está marcada como activa, y al elegirla el elemento sigue las fuentes de la plantilla como hoy.
4. **Given** el selector abierto, **When** escribe parte del nombre de una fuente, **Then** la lista se reduce a las coincidencias, sin importar mayúsculas ni tildes.

---

### User Story 4 - Cuentagotas para tomar un color de la hoja (Priority: P3)

Cuando el navegador lo permite, la persona puede usar un cuentagotas para tomar un color de cualquier punto visible de la pantalla (por ejemplo, de una foto del producto) y aplicarlo.

**Why this priority**: Es cómodo pero depende del navegador, y las demás historias ya cubren la elección de colores.

**Independent Test**: Se prueba completo en un navegador compatible tomando un color de una imagen y comprobando que se aplica; y en uno no compatible, comprobando que el botón no aparece.

**Acceptance Scenarios**:

1. **Given** un navegador compatible, **When** la persona usa el cuentagotas y hace clic en un punto de la pantalla, **Then** el color tomado se aplica al elemento como color libre.
2. **Given** un navegador que no lo permite, **When** abre el selector, **Then** el cuentagotas no se muestra y nada más cambia.
3. **Given** el cuentagotas activo, **When** la persona cancela (tecla Escape), **Then** el color anterior se conserva.

---

### Edge Cases

- Un color libre que aparece en varios elementos se muestra **una sola vez** en «Colores de la plantilla».
- Dos escrituras del mismo código (`#abc` y `#AABBCC`) cuentan como el **mismo** color.
- Una plantilla sin colores libres muestra solo los seis de la paleta.
- Una plantilla muy cargada con muchos colores libres limita el grupo y ofrece «Ver todos», sin que el selector se vuelva inmanejable.
- Elementos bloqueados dejan los selectores deshabilitados, con la misma indicación que ya usa el editor.
- Si el elemento tiene un color «Ninguno» o «Transparente», esa opción sigue disponible y marcada cuando corresponde.
- El selector se cierra con la tecla Escape y devuelve el foco al control que lo abrió; todas las opciones se pueden usar con teclado.
- Una fuente cuya tipografía aún no terminó de cargar muestra su nombre en una fuente de reemplazo sin bloquear la lista, y se corrige sola al cargar.
- Cambiar la paleta de la plantilla actualiza de inmediato los cuadritos de los colores de la paleta en «Colores de la plantilla».

## Requirements *(mandatory)*

### Functional Requirements

**Selector de color**

- **FR-001**: Cada propiedad de color del inspector MUST abrir un **selector de color** en un panel anclado junto al control, con título, botón de cierre y cierre con la tecla Escape, que reemplaza a los cuadritos fijos actuales dentro del inspector.
- **FR-002**: El selector MUST mostrar primero un grupo **«Colores de la plantilla»** con los seis colores de la paleta y todos los colores libres que la plantilla usa en cualquier página, **sin repetir** ninguno (dos escrituras del mismo código cuentan como el mismo color).
- **FR-003**: El selector MUST marcar de forma visible el color activo del elemento y MUST mantener las opciones «Ninguno» o «Transparente» donde hoy existen.
- **FR-004**: Elegir un color de la paleta MUST seguir guardándose como color de la paleta (siguiendo a la paleta si cambia) y elegir un color libre MUST guardarse como código hexadecimal, **sin cambiar el formato de guardado** de ningún color.
- **FR-005**: El selector MUST incluir un **buscador** que acepte un código hexadecimal (con o sin `#`, de 3 o 6 dígitos, sin distinguir mayúsculas) y que filtre por **nombre** los colores de la paleta y un conjunto corto de colores básicos, sin distinguir mayúsculas ni tildes.
- **FR-006**: Un código escrito que no sea válido MUST NOT aplicar nada, MUST indicarlo con un mensaje y MUST conservar el color anterior.
- **FR-007**: El selector MUST ofrecer un modo de elegir cualquier otro color libre (el selector gráfico que el editor ya usa), de modo que ninguna capacidad actual se pierda.
- **FR-008**: Cuando el navegador lo permita, el selector MUST ofrecer un **cuentagotas** para tomar un color de la pantalla; cuando no lo permita, MUST ocultarlo sin otros cambios.
- **FR-009**: Cada elección de color, venga de la paleta, de un color de la plantilla, de la búsqueda, del selector gráfico o del cuentagotas, MUST contar como **un** paso de deshacer y rehacer, y elegir el color que ya está activo MUST NOT agregar un paso.

**Selector de fuente**

- **FR-010**: Cada propiedad de fuente del inspector MUST abrir un **selector de fuente** en un panel anclado junto al control, con título, botón de cierre y cierre con la tecla Escape, que reemplaza a la lista desplegable de texto plano.
- **FR-011**: En el selector, **cada familia MUST mostrarse con su nombre escrito en su propia tipografía**, y la familia activa MUST llevar una marca de verificación.
- **FR-012**: El selector MUST mostrar primero un grupo **«Fuentes de la plantilla»** con «Título», «Cuerpo» y las familias que los elementos ya usan, y después un grupo «Todas las fuentes» con las **seis familias actuales**; no se agregan ni se quitan familias.
- **FR-013**: Elegir «Título» o «Cuerpo» MUST seguir guardándose como referencia a la fuente de la plantilla (y seguir sus cambios), y elegir una familia MUST guardarse como esa familia, **sin cambiar el formato de guardado**.
- **FR-014**: El selector MUST incluir un **buscador** que filtre las fuentes por nombre, sin distinguir mayúsculas ni tildes, con un mensaje claro cuando no haya coincidencias.
- **FR-015**: Cada elección de fuente MUST contar como **un** paso de deshacer y rehacer, y elegir la que ya está activa MUST NOT agregar un paso.

**Consistencia y compatibilidad**

- **FR-016**: Esta feature MUST NOT cambiar el render: lienzo, miniaturas, vista previa y PDF MUST dibujar los mismos colores y fuentes que antes para los mismos datos guardados.
- **FR-017**: Las plantillas guardadas antes de esta feature MUST abrirse, mostrarse y generarse sin ningún cambio visual y sin que la persona deba hacer nada. Las **4 plantillas base** MUST producir un PDF **idéntico byte a byte** al de la línea base guardada en la feature 007.
- **FR-018**: Ambos selectores MUST poder usarse solo con teclado, MUST devolver el foco al control que los abrió al cerrarse y MUST anunciar a las tecnologías de apoyo el color o la fuente activos.
- **FR-019**: Ambos selectores MUST quedar deshabilitados, con la indicación que ya usa el editor, cuando el elemento esté bloqueado.
- **FR-020**: Las medidas tomadas de Canva MUST usarse solo como referencia de organización y de tamaño; la feature MUST NOT incorporar íconos, textos, imágenes, Kit de Marca ni otros recursos de Canva.

### Key Entities *(include if feature involves data)*

- **Color de la plantilla**: cada color distinto que aparece en la plantilla; son los seis de la paleta más los colores libres usados por cualquier elemento de cualquier página. Se calcula al abrir el selector y **no se guarda**.
- **Fuente de la plantilla**: cada familia que la plantilla usa (título, cuerpo y las de los elementos). Se calcula al abrir el selector y no se guarda.
- **Selector**: panel anclado junto al control del inspector que muestra grupos, buscador y la opción activa. No guarda datos propios.
- **Elemento**: sus propiedades de color y de fuente conservan exactamente el formato actual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las **4 plantillas base** y cualquier plantilla guardada antes de esta feature producen un PDF **idéntico byte a byte** al de antes en todas sus páginas.
- **SC-002**: Aplicar a un elemento un color que la plantilla ya usa toma **dos clics** (abrir el selector y elegirlo), sin escribir nada y sin recordar códigos.
- **SC-003**: Aplicar un código de color conocido toma **menos de 10 segundos** desde que se abre el selector, y un código inválido nunca cambia el color.
- **SC-004**: Una persona elige una fuente comparando **todas las familias a la vez**, sin probarlas una por una: las seis se ven con su propia tipografía en la misma pantalla.
- **SC-005**: Todos los colores y fuentes que se podían elegir antes se siguen pudiendo elegir (**ninguna capacidad se pierde**), comprobado recorriendo cada propiedad de cada tipo de elemento.
- **SC-006**: Abrir cualquiera de los dos selectores y ver su contenido toma **menos de 0,2 segundos**, la misma meta que el resto de controles del editor.
- **SC-007**: Ambos selectores se pueden abrir, recorrer, elegir y cerrar **solo con teclado**, comprobado en cada tipo de elemento.
- **SC-008**: Ningún color ni fuente de plantillas existentes cambia al abrir y guardar de nuevo, comprobado comparando los datos guardados antes y después.

## Assumptions

- Quien usa el editor es el administrador del catálogo, en un computador con navegador de escritorio; el uso en móvil no se considera.
- El selector aparece como un panel anclado junto al control (no ocupa todo el cajón lateral); el ancho de referencia de Canva (360 px) orienta su tamaño, pero el inspector de Asia-POP puede usar un ancho menor.
- Los «colores básicos» son un conjunto corto y fijo (por ejemplo, rojo, naranja, amarillo, verde, azul, morado, rosado, negro, gris y blanco) con nombres en español; no se busca cubrir un diccionario completo de colores.
- Las seis familias de fuente actuales siguen siendo las únicas; subir fuentes propias queda fuera.
- Ningún dato nuevo se guarda: «Colores de la plantilla» y «Fuentes de la plantilla» se calculan a partir de lo que la plantilla ya contiene.
- El cuentagotas depende de la compatibilidad del navegador y se oculta si no está disponible.
- La línea base de PDFs de la feature 007 (`specs/007-editor-align-text-tools/visual/baseline/`) sigue vigente como comparación de referencia.
- Quedan fuera: Kit de Marca, paleta tomada de las fotos, colores sólidos extensos, pestaña «Estilo» de la fuente, filtros de fuentes, subir fuentes, degradados y cambios en el render.
