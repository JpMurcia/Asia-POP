# Feature Specification: Plantilla «Base AsianPop» y foto-tarjeta generada

**Feature Branch**: `010-base-template-product-card`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Feature 010: plantilla «Base AsianPop» y foto-tarjeta generada para cada producto. Asia-POP debe generar la foto-tarjeta (tarjeta vertical de fondo oscuro con esquinas redondeadas, con el nombre del producto en neón y la foto del producto tomada de Alegra) en vez de usar fotos-tarjeta prediseñadas a mano, y ofrecer una plantilla de fábrica adicional que reproduzca la página de productos medida en la plantilla base de Canva «PRUEBA CATALOGO». Las plantillas existentes y sus PDFs no cambian."

## Evidencia de referencia (medida con REA)

La base de diseño es el catálogo que hoy se arma a mano en Canva. Se midió con REA el 2026-10-22, solo observando la interfaz ya dibujada; de Canva se toman **medidas y criterios**, no assets, textos ni arte. El detalle completo está en `docs/specs/canva-base-template-spec.md` (especificación completa, con exportación e impresión), `docs/specs/canva-base-template-analysis.md` (resumen y brechas) y las capturas en `docs/specs/rea-evidence/` (18 a 22).

| Pieza de la base | Valor medido |
| --- | --- |
| Hoja | A4 vertical, 21 × 29,7 cm; páginas de productos con **3 productos** en zigzag |
| Título «CATÁLOGO <SECCIÓN>» | Poppins 32, negrita, mayúsculas, centrado, negro; a 0,76 cm del borde superior |
| Logo | Cuadrado de 4,06 cm, a 0,3 cm del borde superior y del derecho |
| Foto-tarjeta | Vertical, de 6,10 × 8,03 cm, esquinas redondeadas, fondo oscuro, **nombre del producto dibujado en neón dentro de la imagen** |
| Burbuja de descripción | 10,58 × 5,13 cm, color `#E7DECF`, esquinas de radio 51, sin borde; se mete por detrás de la foto; con sombra suave |
| Descripción | Poppins 14, centrada, negra, interlineado 1,4, interletrado 0, de 2 a 6 líneas |
| Precio | Poppins 21, negrita, `#C04B0F`, centrado, efecto **neón de intensidad 100**, sobre una pastilla `#1F021D` de 3,45 × 1,08 cm |
| Cinta «AGOTADO» | Open Sans 58, negrita, `#FF3131`, **giro de −45°**, efecto **neón de intensidad 50**, por encima de la foto |
| Fondo | Mármol claro; adornos de estrellas de cuatro puntas y manchas |
| Portadas | General y de sección: logo grande, título enorme en mayúsculas, ilustración de la categoría y «Domicilios» con dos números de WhatsApp |

Hallazgos adicionales de la segunda medición (2026-10-22):

- **Estructura**: 42 páginas; portada general, y por sección una portada y sus páginas de 3 productos (ramen, tteokbokki, snacks, dulces y bebidas en las páginas vistas).
- **Todos los textos** de la base usan **interlineado 1,4**, interletrado 0 y anclaje al comienzo.
- **Precios** con formato `$9.000`; existe la variante `$15.000 Und` (precio por unidad).
- **Defectos de la base manual que no deben repetirse**: marcadores de imagen vacíos («Marcador») en productos sin foto, y descripciones repetidas entre páginas vecinas.
- **Títulos de página** sin convención única de mayúsculas en la base («CATÁLOGO RAMEN» frente a «Catálogo Dulces»).
- **Contacto**: en la portada general, los números parecen formar parte del arte (imagen), no ser texto editable.
- **Exportación**: Canva separa el PDF en modo Digital (liviano, comprimible) y modo Impresión (RGB o CMYK, sangrado y marcas de corte). Esta feature **no** cambia la exportación; ese tema queda para una feature propia.

**No verificado** (y no se medirá en esta feature): las páginas 28 a 42 de la base, la tipografía, posición y tamaño del título, del contacto y de los íconos en las portadas, el efecto de sombra exacto de las burbujas, la posición de estrellas y manchas, y la equivalencia en milímetros de los tamaños de letra de Canva.

## Estado actual

- **Fotos**: el catálogo usa la foto del producto que entrega Alegra, tal cual (con ajustes de tamaño y calidad del feature 005). No existe una «tarjeta» generada: la foto se muestra dentro de la tarjeta de la plantilla elegida y el nombre del producto es un texto aparte.
- **Descripción**: Alegra entrega una descripción opcional por producto; el catálogo ya la recibe.
- **Plantillas**: hay cuatro plantillas base (entre ellas Neón Noche). El editor tiene texto, formas, imágenes, fondo de imagen, resplandor neón con color, giro, bloque de productos con precio y estado AGOTADO en cinta, portada de sección y pie.
- **Tamaño del PDF**: el PDF optimizado debe seguir quedando bajo **25 MB** (feature 005).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Que cada producto tenga su foto-tarjeta sin trabajo manual (Priority: P1)

La persona responsable genera el catálogo y cada producto aparece como una **foto-tarjeta**: tarjeta vertical de fondo oscuro con esquinas redondeadas, el nombre del producto en neón y la foto de Alegra centrada. Nadie diseña tarjetas a mano en otra herramienta.

**Why this priority**: es la pieza distintiva de la base y la que hoy obliga a un trabajo manual por producto; sin ella el catálogo de Asia-POP no se parece al de referencia.

**Independent Test**: con 5 productos de prueba (nombre corto, nombre largo, foto vertical, foto horizontal y foto cuadrada), generar sus tarjetas y comprobar que todas tienen la misma proporción, que el nombre no se sale, que la foto no se deforma y que repetir la generación da el mismo resultado.

**Acceptance Scenarios**:

1. **Given** un producto con foto en Alegra, **When** se genera el catálogo con la plantilla Base AsianPop, **Then** el producto aparece como tarjeta oscura vertical de 6,10 × 8,03 cm con esquinas redondeadas, su nombre en neón y su foto centrada.
2. **Given** una foto horizontal o muy alargada, **When** se genera la tarjeta, **Then** la foto se recorta o se ajusta sin deformarse y el producto sigue siendo reconocible.
3. **Given** un nombre largo (por ejemplo, 60 caracteres), **When** se genera la tarjeta, **Then** el nombre se reparte en varias líneas y se reduce de tamaño hasta caber, sin salirse de la tarjeta ni quedar ilegible.
4. **Given** el mismo producto y la misma foto, **When** se genera dos veces, **Then** las dos tarjetas son idénticas.
5. **Given** un producto sin foto, **When** se genera el catálogo, **Then** queda fuera del PDF y se informa cuál y cuántos, como hoy (principio II de la constitución).
6. **Given** la opción «Fondo de la foto» en «Dejar como está», **When** se genera la tarjeta, **Then** la foto aparece completa dentro de un marco claro de esquinas redondeadas sobre un fondo oscuro desenfocado.
7. **Given** la opción en «Quitar el fondo automáticamente» y una foto de producto sobre fondo liso, **When** se genera la tarjeta, **Then** el producto aparece sin su fondo, flotando sobre el fondo oscuro de la tarjeta.
8. **Given** la opción en «Quitar el fondo automáticamente» y una foto donde no se puede separar el producto con confianza, **When** se genera el catálogo, **Then** esa foto usa «Dejar como está» y el resumen final indica cuántas y cuáles fotos quedaron así.

---

### User Story 2 - Elegir la plantilla «Base AsianPop» para obtener el catálogo de referencia (Priority: P1)

La persona elige entre las plantillas de fábrica una nueva, **Base AsianPop**, y el catálogo sale con la página de productos de la base: título de sección, logo, tres productos en zigzag, burbuja con la descripción, precio en neón y cinta AGOTADO en diagonal, sobre fondo de mármol.

**Why this priority**: es el pilar pedido por el responsable: que el catálogo automático reproduzca la base hecha a mano.

**Independent Test**: generar una página de 3 productos (uno agotado) con Base AsianPop y compararla lado a lado con la página 3 de la base: las piezas deben estar en las mismas posiciones, con los mismos colores, tipografías y tamaños medidos, con diferencias de posición menores a 2 mm.

**Acceptance Scenarios**:

1. **Given** las plantillas de fábrica, **When** la persona abre la galería, **Then** ve «Base AsianPop» junto a las cuatro existentes, que no cambian.
2. **Given** una sección con 3 productos, **When** se genera con Base AsianPop, **Then** la página tiene título «CATÁLOGO <SECCIÓN>» en mayúsculas, logo arriba a la derecha y los tres productos en zigzag (foto a la izquierda, a la derecha y a la izquierda).
3. **Given** un producto agotado, **When** se genera la página, **Then** la cinta AGOTADO aparece en rojo, girada −45° y por encima de la foto, con la palabra siempre legible.
4. **Given** una sección con 7 productos, **When** se genera, **Then** se crean páginas de 3, 3 y 1 producto con el mismo molde, sin huecos ni marcadores vacíos.
5. **Given** la plantilla Base AsianPop elegida, **When** se abre el editor, **Then** todas las piezas se pueden mover y cambiar como en cualquier plantilla, y el editor, la vista previa y el PDF muestran lo mismo.

---

### User Story 3 - Descripción del producto en la burbuja (Priority: P2)

Cada producto muestra, en la burbuja beige junto a la foto, la descripción que tiene en Alegra, con la tipografía y el interlineado medidos en la base.

**Why this priority**: da el aspecto «informado» de la base, pero depende de que los productos tengan descripción.

**Independent Test**: con tres productos (descripción corta, descripción de 400 caracteres y sin descripción), generar la página y comprobar cómo se ve cada caso.

**Acceptance Scenarios**:

1. **Given** un producto con descripción, **When** se genera, **Then** el texto aparece centrado dentro de la burbuja, en 2 a 6 líneas.
2. **Given** una descripción demasiado larga para la burbuja, **When** se genera, **Then** el texto se reduce hasta un mínimo legible y, si aun así no cabe, se corta con puntos suspensivos sin salirse de la burbuja.
3. **Given** un producto sin descripción, **When** se genera, **Then** no aparece una burbuja vacía: el producto muestra la tarjeta y el precio, y la página queda equilibrada.

---

### User Story 4 - Portada general y portadas de sección con contacto central (Priority: P2)

La plantilla incluye una **portada general** y una **portada por sección** con título enorme en mayúsculas, el logo y los datos de contacto («Domicilios» y dos WhatsApp) tomados de la configuración de la aplicación, no de texto escrito a mano en cada plantilla. Las ilustraciones de portada las sube la persona responsable.

**Why this priority**: completa la identidad de la base, pero el contenido gráfico depende de material que debe aportar el negocio.

**Independent Test**: cambiar un número de WhatsApp en la configuración, generar el catálogo y comprobar que se actualiza en todas las portadas sin editar la plantilla.

**Acceptance Scenarios**:

1. **Given** la configuración con dos números de contacto, **When** se genera el catálogo, **Then** cada portada muestra «Domicilios» y los dos números con su ícono de WhatsApp.
2. **Given** una sección «Ramen», **When** se genera, **Then** su portada muestra «RAMEN» en mayúsculas muy grandes y, si hay ilustración subida para esa sección, la muestra.
3. **Given** que aún no se subió una ilustración, **When** se genera, **Then** la portada se ve completa y equilibrada con el logo y el título, sin marcadores vacíos.
4. **Given** un cambio de logo en la configuración, **When** se genera, **Then** el logo nuevo aparece en todas las páginas.

---

### Edge Cases

- Un nombre de una sola palabra muy larga (sin espacios) no debe salirse de la tarjeta.
- Un nombre con caracteres especiales o en otro alfabeto (por ejemplo coreano) debe mostrarse o, si la tipografía no lo admite, reemplazarse por un carácter visible, nunca por cuadros vacíos.
- Una foto con transparencia o fondo blanco debe verse correcta sobre el fondo oscuro de la tarjeta en ambos modos.
- Una foto con varios productos (por ejemplo, un combo) o con el producto cortado por el borde puede no separarse bien: pasa a «Dejar como está» y se informa.
- Un producto de color casi igual al fondo de su foto (empaque blanco sobre fondo blanco) puede no separarse bien: pasa a «Dejar como está» y se informa.
- Quitar el fondo de unas 180 fotos no debe hacer que la generación se vuelva inaceptablemente lenta; el resultado de cada foto se reutiliza mientras no cambie.
- Una foto muy pequeña no debe verse pixelada de forma evidente al ampliarse a la tarjeta; si es demasiado pequeña, se muestra a su tamaño con el fondo oscuro alrededor.
- Un producto agotado conserva su foto-tarjeta y suma la cinta.
- Las páginas finales con 1 o 2 productos deben verse completas y centradas, sin los huecos que muestra la base en sus páginas 10, 12 y 16.
- Una sección sin portada subida no debe dejar la portada vacía.
- Cambiar el nombre de un producto en Alegra debe reflejarse en su tarjeta en la siguiente generación.
- Un catálogo de 180 productos debe generar sus tarjetas sin que el PDF pase del peso máximo (25 MB) ni la generación se vuelva inaceptablemente lenta.

## Requirements *(mandatory)*

### Functional Requirements

**Foto-tarjeta**

- **FR-001**: Para cada producto con foto, el sistema MUST generar una **foto-tarjeta** vertical de proporción 6,10 × 8,03 cm, de fondo oscuro, con esquinas redondeadas, que contenga la foto del producto y su nombre en neón.
- **FR-002**: La foto MUST ajustarse a la tarjeta **sin deformarse**, centrada, recortando o dejando fondo oscuro alrededor, y MUST verse correcta con fotos verticales, horizontales, cuadradas, con transparencia o con fondo blanco.
- **FR-003**: El nombre MUST mostrarse en neón dentro de la tarjeta, reduciendo su tamaño y repartiéndolo en líneas hasta caber, y MUST NOT salirse de la tarjeta ni quedar ilegible; un nombre que no cabe ni al mínimo se corta con puntos suspensivos.
- **FR-004**: La generación MUST ser **estable**: mismo producto, misma foto y mismo nombre producen exactamente la misma tarjeta.
- **FR-005**: El nombre MUST tomarse del producto en Alegra y reflejar sus cambios en la siguiente generación; el sistema MUST NOT modificar nada en Alegra (principio I de la constitución).
- **FR-006**: Un producto sin foto MUST seguir quedando fuera del PDF, con el aviso de cuáles y cuántos (principio II).
- **FR-007**: El color del neón del nombre MUST salir de la paleta de la plantilla por defecto, de modo que el catálogo mantenga coherencia de color, sin exigir diseñar cada tarjeta.
- **FR-008**: El sistema MUST ofrecer una opción **«Fondo de la foto»** con dos modos, elegible por la persona responsable (decisión del responsable, 2026-10-22):
  - **Dejar como está** (modo por defecto): la foto se muestra completa, tal cual, dentro de un **marco claro con esquinas redondeadas**, sobre un **fondo oscuro desenfocado** hecho con la propia foto. Se ve bien con cualquier foto.
  - **Quitar el fondo automáticamente**: el sistema intenta separar el producto de su fondo para que flote sobre el fondo oscuro de la tarjeta, como en la base.
- **FR-008a**: Cuando el modo es «Quitar el fondo automáticamente» y el sistema **no logra** separar el producto con confianza suficiente (foto compleja, producto cortado, fondo parecido al producto), MUST usar para esa foto el modo «Dejar como está» y MUST informar cuántas y cuáles fotos quedaron así, sin interrumpir la generación del catálogo.
- **FR-008b**: El modo elegido MUST guardarse con la configuración del catálogo y aplicarse a **todas** las tarjetas; un mismo producto con el mismo modo MUST dar siempre el mismo resultado (FR-004).
- **FR-008c**: Cambiar de modo MUST permitir ver el resultado en una vista previa de una tarjeta antes de generar todo el catálogo.

**Plantilla «Base AsianPop»**

- **FR-009**: El sistema MUST ofrecer entre las plantillas de fábrica una nueva, **«Base AsianPop»**, **adicional** a las cuatro existentes, que MUST NOT cambiar.
- **FR-010**: La página de productos de Base AsianPop MUST reproducir las medidas de la base: hoja A4; título de sección en mayúsculas, Poppins 32 negrita, centrado, a 0,76 cm del borde superior; logo cuadrado de 4,06 cm a 0,3 cm del borde superior y derecho; tres productos por página en zigzag.
- **FR-011**: Cada producto MUST componerse de **foto-tarjeta**, **burbuja** beige `#E7DECF` de esquinas de radio 51 con sombra suave, **descripción** (Poppins 14, centrada, interlineado 1,4) y **precio** (Poppins 21, negrita, `#C04B0F`, neón de intensidad 100 sobre una pastilla `#1F021D`), con la burbuja por detrás de la foto, como en la base.
- **FR-012**: La **cinta AGOTADO** MUST mostrarse por encima de la foto con tipografía Open Sans 58 negrita (o la más cercana disponible), `#FF3131`, girada −45° y con neón de intensidad 50, y la palabra AGOTADO MUST ser siempre legible (principio II).
- **FR-013**: El fondo MUST ser de mármol claro, con adornos de estrellas de cuatro puntas y manchas, y las páginas MUST repetir el mismo encabezado y el mismo molde.
- **FR-013a**: El título de cada página de productos MUST escribirse siempre en **mayúsculas** («CATÁLOGO <SECCIÓN>»), de forma uniforme en todo el catálogo, aunque la base manual no lo haga.
- **FR-013b**: Todos los textos de Base AsianPop (descripción, precio, título) MUST usar el **interlineado 1,4** de la base; el valor por defecto de las plantillas existentes (1,05) MUST NOT cambiar.
- **FR-013c**: El texto de cada página MUST ser el del producto que muestra: el generador MUST NOT repetir descripciones de otro producto ni dejar marcadores de imagen vacíos.
- **FR-014**: Las medidas, colores y tipografías de Base AsianPop MUST coincidir con las medidas de la base con una diferencia de posición menor a **2 mm** y de color idéntica.
- **FR-015**: Cuando una página tiene menos de 3 productos, MUST verse completa y equilibrada, sin marcadores de imagen vacíos ni textos sueltos.
- **FR-016**: Base AsianPop MUST poder editarse con el editor existente como cualquier plantilla, y editor, vista previa y PDF MUST dibujar lo mismo con el mismo componente de página (principio IV).

**Descripción**

- **FR-017**: La burbuja MUST mostrar la descripción del producto que entrega Alegra; si es demasiado larga MUST reducirse hasta un mínimo legible y, si aun así no cabe, cortarse con puntos suspensivos sin salirse de la burbuja.
- **FR-018**: Un producto sin descripción MUST NOT mostrar una burbuja vacía; la página MUST quedar equilibrada con la tarjeta y el precio.

**Portadas y contacto**

- **FR-019**: La plantilla MUST incluir una **portada general** y una **portada por sección** con título en mayúsculas muy grandes y el logo.
- **FR-020**: Los datos de contacto («Domicilios» y dos números de WhatsApp) MUST tomarse de la configuración de la aplicación y mostrarse en todas las portadas, de modo que cambiarlos en un solo lugar los actualice en todo el catálogo.
- **FR-021**: La persona responsable MUST poder subir el **logo** y las **ilustraciones** de portada; mientras no haya ilustración, la portada MUST verse completa con logo, título y contacto. El sistema MUST NOT incluir arte, ilustraciones ni textos de Canva ni del negocio sin que el responsable los suba.

**Compatibilidad y calidad**

- **FR-022**: Las **4 plantillas base** y toda plantilla guardada antes de esta feature MUST producir un PDF **idéntico byte a byte** al de la línea base de la feature 007; esta feature solo suma una plantilla.
- **FR-023**: Con la plantilla Base AsianPop, el PDF completo MUST respetar el peso máximo ya fijado (25 MB, feature 005) para un catálogo de unos 180 productos.
- **FR-024**: Las tarjetas MUST generarse de modo que repetir la generación del catálogo no rehaga innecesariamente las que no cambiaron.

### Key Entities *(include if feature involves data)*

- **Foto-tarjeta**: imagen vertical generada para un producto a partir de su foto y su nombre. No se guarda como dato de Alegra; se calcula y puede conservarse temporalmente mientras no cambien la foto ni el nombre.
- **Producto**: ítem de Alegra con nombre, precio, descripción opcional, categoría, existencias y foto. Sin cambios.
- **Plantilla «Base AsianPop»**: plantilla de fábrica con la página de productos, la portada general y la portada de sección medidas en la base.
- **Datos de contacto**: «Domicilios» y dos números de WhatsApp guardados en la configuración de la aplicación.
- **Material gráfico del negocio**: logo e ilustraciones de portada que sube la persona responsable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con la plantilla Base AsianPop, una página de 3 productos generada se compara con la página 3 de la base y todas las piezas quedan a **menos de 2 mm** de su posición, con los mismos colores, tipografías y tamaños medidos.
- **SC-002**: **100 %** de los productos con foto salen con foto-tarjeta, y ninguno con nombre cortado fuera de la tarjeta ni foto deformada, comprobado sobre un catálogo de unos 180 productos.
- **SC-003**: Dos generaciones seguidas del mismo catálogo producen tarjetas idénticas.
- **SC-004**: Las **4 plantillas base** y cualquier plantilla guardada antes producen un PDF **idéntico byte a byte** al de antes.
- **SC-005**: El PDF de un catálogo de unos 180 productos con Base AsianPop pesa **menos de 25 MB**.
- **SC-006**: Cambiar un número de contacto en la configuración lo actualiza en **todas** las portadas con una sola edición y sin tocar la plantilla.
- **SC-007**: Una persona obtiene un catálogo con el aspecto de la base en **menos de 5 minutos** desde que elige la plantilla, sin diseñar nada a mano.
- **SC-008**: Ningún producto sale con burbuja vacía ni con marcador de imagen vacío en ninguna página generada.
- **SC-010**: En ambos modos de «Fondo de la foto», **100 %** de las tarjetas salen con el producto completo y reconocible; ninguna foto sale con un recorte roto o con partes del producto borradas, porque ante la duda se usa «Dejar como está».
- **SC-011**: Cambiar entre los dos modos y ver una tarjeta de ejemplo toma **menos de 10 segundos**.
- **SC-009**: Generar el catálogo completo con tarjetas no se vuelve más de **2 veces** más lento que con una plantilla actual en la primera generación, y las generaciones siguientes sin cambios son tan rápidas como hoy.

## Assumptions

- La descripción larga sale del campo **descripción de Alegra**, que ya llega al catálogo; si un producto no la tiene, no se muestra burbuja. Escribir descripciones a mano en Asia-POP queda fuera de esta feature.
- Las ilustraciones y el collage de las portadas los **sube el responsable**; esta feature solo prevé dónde van y cómo se ven sin ellos.
- El color del neón de cada tarjeta sale de la paleta de la plantilla; la base usa colores distintos por producto porque cada imagen se diseñó a mano, y reproducir eso queda como mejora posterior.
- Poppins ya está disponible en el editor; para la cinta se usa Open Sans si está disponible o, si no, la tipografía disponible más cercana, sin que esta feature agregue familias nuevas obligatorias.
- El efecto neón de Asia-POP (resplandor con color) se calibra para parecerse a los niveles 100 y 50 de la base; se validará comparando lado a lado.
- Las páginas 28 a 42 de la base se asumen iguales en estructura a las vistas (portadas de sección y páginas de 3 productos).
- La línea base de PDFs de la feature 007 (`specs/007-editor-align-text-tools/visual/baseline/`) sigue vigente.
- El precio sigue el formato de la constitución (`$9.000`). La variante `$15.000 Und` de la base **queda fuera** de esta feature; solo se incluirá si Alegra o la configuración de combos ya indican que el precio es por unidad.
- La tipografía, posición y tamaño del título, del contacto y de los íconos de las **portadas** no se midieron en la base; se definen en la planificación con un diseño razonable y equilibrado y se ajustan cuando el responsable aporte medidas o material gráfico.
- La exportación (PDF Digital frente a Impresión, CMYK, sangrado y marcas de corte, selección de páginas) **no** forma parte de esta feature; se propone como feature aparte.
- El modo «Dejar como está» es el predeterminado porque siempre da un resultado correcto; «Quitar el fondo automáticamente» es una mejora de aspecto que la persona activa a conciencia.
- Quitar el fondo se hace dentro de la propia aplicación, sin enviar las fotos a servicios externos de pago; si más adelante hiciera falta uno, sería una decisión aparte porque implica sacar datos de la tienda.
- La confianza para dar por buena una separación de fondo se define en la planificación; el criterio de la spec es que, ante la duda, se prefiere «Dejar como está».
- Quedan fuera: fotos-tarjeta personalizadas por producto, edición manual de cada tarjeta, nuevos tipos de página y combos con diseño propio.
