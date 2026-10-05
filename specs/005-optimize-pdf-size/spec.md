# Feature Specification: PDF del catálogo liviano para enviar

**Feature Branch**: `005-optimize-pdf-size` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`)

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Optimizar el tamaño del PDF del catálogo. Con la cuenta real el PDF pesa 156,4 MB para 182 fotos (106 PNG y 76 JPG, la mayor de ~2 MB) porque las fotos se incrustan casi sin comprimir. Un archivo así es muy difícil de enviar por correo o mensajería, que es para lo que se usa el catálogo. Se quiere un PDF mucho más liviano sin que se note pérdida de calidad en las tarjetas de producto, conservando intactas las reglas existentes (agotados, precios, productos sin foto fuera del PDF, fidelidad visual de Neón Noche con `docs/Cat.pdf`, un solo componente de página para editor, vista previa y PDF, Alegra solo lectura). El responsable aún no definió el tamaño objetivo: debe quedar como decisión a clarificar (referencia sugerida: menos de 25 MB para poder enviarlo por correo). Debe haber una opción visible para elegir la calidad (por ejemplo, original u optimizada), informar el tamaño final, medirse antes y después con la cuenta real (solo lectura) y mantener el tiempo de generación dentro de la meta de 001 (menos de 2 minutos con hasta 200 productos)."

Esta feature **continúa** `004-fix-alegra-images`: 004 hizo llegar por primera vez las fotos reales de Alegra al catálogo y dejó este problema anotado como riesgo abierto (ver `specs/004-fix-alegra-images/validation.md`, "Riesgo materializado: tamaño del PDF"). No cambia reglas de precio, stock, secciones, combos ni plantillas, ni la forma de obtener las fotos.

## Clarifications

### Session 2026-10-04

- Q: ¿Cuál es el tamaño máximo aceptable del PDF optimizado? → A: **25 MB** (opción A), pensado para que el catálogo quepa en un adjunto de correo. Se toma como «tamaño objetivo» en FR-003, FR-012, SC-001 y SC-006. El plan debe confirmar con una medición real que 25 MB se alcanza sin bajar de la resolución mínima de FR-004; si no se pudiera, se vuelve a consultar al responsable antes de bajar la calidad.

## Punto de partida

Medido en la validación de 004 con la cuenta real de la tienda (solo lectura, sin datos privados):

- El catálogo completo tiene **66 páginas** (62 de producto) y **182 fotos** (106 PNG y 76 JPG de las elegidas, la mayor de ~2 MB). El PDF pesa **156,4 MB**: unos **0,86 MB por foto** en promedio, es decir, las fotos entran casi tal como las entrega Alegra, con una resolución muy superior a la que se imprime en una tarjeta de pocos centímetros.
- Preparar el catálogo tarda 20,8 s y generar el PDF 16,2 s.
- La pantalla **Generar** no ofrece ninguna opción sobre el tamaño. El **Historial** muestra fecha, páginas, incluidos y omitidos, pero **no cuánto pesa** cada PDF, y conserva los 10 más recientes: con el peso actual serían más de 1,5 GB en disco.
- El catálogo se usa para **enviarlo a clientes** por correo o mensajería; un archivo de 156 MB no cabe en un adjunto de correo y es lento de descargar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar un PDF liviano que pueda enviar (Priority: P1)

Al generar un catálogo, la persona responsable ve en la pantalla Generar una opción **Calidad del PDF** con dos valores: **Optimizada** (preseleccionada) y **Original**. Con Optimizada, el PDF resultante pesa una fracción del actual y se puede adjuntar a un correo, y a simple vista las fotos de las tarjetas se ven igual de bien.

**Why this priority**: es el problema reportado. Hoy el PDF real es inviable para el uso principal del catálogo (enviarlo).

**Independent Test**: con fotos simuladas que imiten el catálogo real (JPG y PNG grandes, un PNG con transparencia, una foto diminuta y una panorámica), generar el mismo catálogo en calidad Original y en Optimizada; comprobar que el optimizado pesa mucho menos, que tiene las mismas páginas y productos, y que las fotos conservan su calidad.

**Acceptance Scenarios**:

1. **Given** la pantalla Generar, **When** la persona la abre, **Then** ve la opción Calidad del PDF con Optimizada preseleccionada y una explicación breve de cada valor, en español y sin términos técnicos.
2. **Given** el catálogo completo de la tienda real en calidad Optimizada, **When** se genera, **Then** el PDF pesa como máximo el tamaño objetivo (FR-003).
3. **Given** un catálogo generado en Optimizada y el mismo en Original, **When** se comparan página por página a tamaño normal de pantalla y en una impresión A4, **Then** la persona no distingue diferencias de calidad en las fotos.
4. **Given** un producto cuya foto es un PNG con fondo transparente, **When** se genera en Optimizada, **Then** la foto se ve igual que en Original (sin fondo negro ni de otro color).
5. **Given** una foto pequeña (menor de lo que pide la tarjeta), **When** se genera en Optimizada, **Then** no se agranda ni se vuelve más pesada.
6. **Given** que la persona cambia la calidad en la pantalla Generar, **When** lo hace, **Then** no tiene que volver a preparar el catálogo ni cambia la revisión, las secciones elegidas ni la vista previa.

---

### User Story 2 - Saber cuánto pesa cada catálogo (Priority: P2)

Al terminar de generar, la pantalla muestra cuánto pesa el PDF (por ejemplo, «Catálogo generado · 18,4 MB»), y el Historial gana una columna **Tamaño** para cada catálogo. Si el PDF optimizado aun así supera el tamaño objetivo, se entrega igual y se avisa con el tamaño real y una sugerencia.

**Why this priority**: sin el dato, la persona descubre que el archivo es demasiado grande solo al intentar enviarlo. Hoy este problema pasó desapercibido hasta que se midió a mano.

**Independent Test**: generar catálogos en ambas calidades (con fotos simuladas) y comprobar que el aviso final y el Historial muestran el tamaño correcto; generar uno que supere el objetivo y comprobar el aviso.

**Acceptance Scenarios**:

1. **Given** un catálogo recién generado, **When** termina, **Then** la pantalla muestra su tamaño en MB con un decimal junto al enlace de descarga.
2. **Given** el Historial, **When** la persona lo abre, **Then** cada catálogo con archivo disponible muestra su tamaño; si el archivo ya no existe, muestra «—».
3. **Given** un catálogo en calidad Optimizada que aun así supera el tamaño objetivo (por ejemplo, un catálogo con muchos más productos), **When** termina de generarse, **Then** se entrega completo y se muestra un aviso con el tamaño real y la sugerencia de incluir menos secciones; no se aborta ni se entrega un PDF parcial.
4. **Given** el Historial, **When** la persona lo lee, **Then** identifica cuánto pesa cada catálogo en menos de 10 segundos, sin abrir los archivos.

---

### User Story 3 - Conservar la calidad original cuando hace falta y no romper nada (Priority: P3)

Cuando la persona necesita el catálogo con las fotos exactamente como están en Alegra (por ejemplo, para llevarlo a una imprenta), elige **Original** y obtiene el mismo PDF que hoy. En ambas calidades el contenido y el diseño del catálogo son los mismos: solo cambia el peso de las fotos.

**Why this priority**: es la salida de seguridad de la optimización y la garantía de que no se rompen las reglas de las features anteriores (agotados, precios, secciones, combos, plantillas).

**Independent Test**: generar el mismo catálogo en ambas calidades con cada plantilla base, productos agotados y de varias proporciones de foto, y comparar el contenido de las páginas.

**Acceptance Scenarios**:

1. **Given** la opción Original, **When** se genera un catálogo, **Then** el PDF es equivalente al que el sistema genera hoy (mismo contenido y peso comparable).
2. **Given** el mismo catálogo en ambas calidades, **When** se comparan, **Then** tienen las mismas páginas, productos, precios, indicaciones AGOTADO, secciones y textos.
3. **Given** cualquiera de las plantillas base, **When** se genera en Optimizada, **Then** el diseño es el de la plantilla; con Neón Noche, el catálogo conserva el aspecto de `docs/Cat.pdf`.
4. **Given** fotos verticales, horizontales, cuadradas y panorámicas, **When** se genera en Optimizada, **Then** cada una llena su recuadro sin deformarse, con el mismo recorte que en Original.
5. **Given** productos agotados, **When** se genera en Optimizada con cualquiera de los tres estilos de agotado, **Then** se ve la foto y la indicación AGOTADO, igual que en Original.

---

### Edge Cases

- Foto PNG con transparencia: debe verse igual que en Original, sin fondo negro ni otro color (FR-006).
- Foto ya liviana o menor de lo necesario: no se agranda y nunca queda más pesada que la original (FR-004, FR-007).
- Foto con proporciones extremas (panorámica muy ancha o muy alta): se conserva el recorte proporcional actual; la optimización no recorta ni deforma por su cuenta.
- Foto en WebP o GIF (formatos ya admitidos): se ve igual que hoy; un GIF animado muestra su primer cuadro, como ahora.
- Una foto no se puede optimizar (archivo dañado de forma parcial, formato raro): se usa tal cual y la generación sigue (FR-008). Una foto que no se puede usar en absoluto sigue la regla vigente de 004: la generación se aborta con mensaje claro, sin PDF parcial.
- La foto de un producto cambia en Alegra entre una generación y otra: el PDF muestra la foto nueva, nunca una copia optimizada de la anterior (FR-014).
- Se genera dos veces seguidas el mismo catálogo: el resultado es equivalente y la segunda vez no tarda más que la primera.
- Fotos de productos propios y de combos (cargadas por la persona): también se optimizan.
- Catálogo pequeño (una sola sección, pocos productos): funciona igual; el PDF es proporcionalmente pequeño y no se muestra aviso.
- El PDF optimizado supera el tamaño objetivo (por ejemplo, más de 200 productos): se entrega completo con aviso (FR-012).
- Catálogos ya generados antes de esta feature: no se modifican; el Historial muestra su tamaño real si el archivo existe.
- Si tras optimizar las fotos otros elementos (fondos, portadas, tipografías) resultan pesar más de lo previsto: se informa en el plan y se evalúa; ver Supuestos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla Generar MUST mostrar una opción visible **Calidad del PDF** con los valores **Optimizada** y **Original**, cada uno con una explicación corta en español claro (Optimizada: archivo mucho más liviano, ideal para enviar, las fotos se ven igual a tamaño normal; Original: conserva las fotos tal como están en Alegra y el archivo puede ser varias veces más grande). La opción afecta solo a esa generación y MUST NOT obligar a preparar de nuevo el catálogo ni cambiar la revisión, la estructura ni la vista previa.
- **FR-002**: La calidad Optimizada MUST venir preseleccionada en cada generación.
- **FR-003**: El PDF en calidad Optimizada del catálogo completo de la tienda real (hasta unos 200 productos, 182 con foto) MUST pesar como máximo **25 MB**, el límite habitual de los adjuntos de correo (en adelante, «tamaño objetivo»). Punto de partida: 156,4 MB.
- **FR-004**: En calidad Optimizada, cada foto MUST conservar, al tamaño impreso en su tarjeta, una resolución efectiva de al menos 150 puntos por pulgada, o la que ya tenga si es menor. MUST NOT agrandarse, deformarse ni recortarse de manera distinta a la de Original, y no deben verse bandas, manchas ni cambios de color.
- **FR-005**: Optimizar MUST NOT cambiar el contenido ni el diseño del catálogo: mismas páginas, productos, precios, indicaciones AGOTADO, secciones, combos, textos y plantilla. Se conservan las reglas del principio II de la constitución y la fidelidad visual del principio IV (Neón Noche con `docs/Cat.pdf`; editor, vista previa y PDF siguen dibujando con el mismo componente de página).
- **FR-006**: Una foto con transparencia MUST verse en Optimizada igual que en Original; MUST NOT aparecer con un fondo distinto (por ejemplo, negro).
- **FR-007**: Una foto en calidad Optimizada MUST NOT pesar más que la original; si optimizarla no la hace más liviana, se usa tal cual.
- **FR-008**: El fallo de optimizar una foto MUST NOT detener la generación: esa foto se usa sin optimizar y el resto sigue. Una foto que no se puede usar en absoluto sigue la regla vigente de 004 (aborto con mensaje claro, sin PDF parcial).
- **FR-009**: La calidad Original MUST producir el mismo catálogo que el sistema genera hoy.
- **FR-010**: La optimización MUST NOT modificar las fotos en Alegra, las fotos de productos propios ni las copias descargadas; solo afecta a lo que se incrusta en el PDF. Alegra se consulta únicamente en modo lectura (principio I).
- **FR-011**: Al terminar de generar, la pantalla MUST mostrar el tamaño del PDF, y el Historial MUST mostrar el tamaño de cada catálogo cuyo archivo exista (en MB con un decimal; «—» si el archivo ya no existe).
- **FR-012**: Si el PDF en calidad Optimizada supera el tamaño objetivo, el sistema MUST entregarlo completo y mostrar un aviso con el tamaño real y una sugerencia (incluir menos secciones). MUST NOT abortar ni entregar un PDF parcial por esa causa.
- **FR-013**: Preparar y generar un catálogo de hasta 200 productos en calidad Optimizada MUST tardar menos de 2 minutos en total (meta de 001).
- **FR-014**: El PDF en calidad Optimizada MUST reflejar siempre la foto vigente de cada producto: si la foto cambia, se ve la nueva, nunca una versión optimizada de la anterior.
- **FR-015**: Cada regla de este documento (FR-001 a FR-014) MUST tener pruebas automatizadas con fotos simuladas que imiten el catálogo real (JPG y PNG grandes, PNG con transparencia, foto diminuta, panorámica, foto dañada), nunca contra la cuenta real (principio V).

### Key Entities *(include if feature involves data)*

- **Calidad del PDF**: opción de una generación con dos valores: Optimizada u Original. No se guarda como ajuste del sistema.
- **Tamaño objetivo**: peso máximo esperado del PDF optimizado, 25 MB (FR-003); a partir de él se decide cuándo avisar.
- **Foto del catálogo**: la foto elegida de un producto (de Alegra, propio o combo). La versión que se incrusta en el PDF depende de la calidad elegida; la original no se toca.
- **Catálogo generado**: entrada del Historial; gana su tamaño en MB.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con el catálogo real de la tienda, generado en calidad Optimizada, el PDF pesa como máximo el tamaño objetivo. Punto de partida: 156,4 MB.
- **SC-002**: En la revisión de las 66 páginas del catálogo real, comparando Original y Optimizada a tamaño normal de pantalla y en una impresión A4, 0 fotos con pérdida de calidad visible; y el 100 % de las fotos con resolución efectiva de al menos 150 puntos por pulgada al tamaño impreso (o la propia de la foto si es menor).
- **SC-003**: El 100 % del contenido coincide entre Original y Optimizada para el mismo catálogo: mismo número de páginas, productos, precios e indicaciones AGOTADO.
- **SC-004**: Preparar y generar con hasta 200 productos tarda menos de 2 minutos en calidad Optimizada (hoy 20,8 s para preparar y 16,2 s para generar, con 182 productos).
- **SC-005**: Una persona sin conocimientos técnicos identifica cuánto pesa un catálogo en menos de 10 segundos, sin abrir el archivo; el 100 % de los catálogos del Historial con archivo disponible muestra su tamaño.
- **SC-006**: Con los 10 catálogos que conserva el Historial, todos en calidad Optimizada, el espacio en disco ocupado por ellos no supera 250 MB, es decir, 10 veces el tamaño objetivo (hoy superaría 1,5 GB).
- **SC-007**: En calidad Original, el catálogo real conserva su contenido y un peso comparable al actual (dentro de ±5 % de 156,4 MB).
- **SC-008**: La persona responsable aprueba, al revisarlo, que el catálogo optimizado es apto para enviarlo a clientes por correo o mensajería.

## Assumptions

- **Alcance**: solo cambia lo que se incrusta en el PDF. Las copias de fotos descargadas y las cargadas por la persona no se modifican, así que Original sigue disponible en cualquier momento. La vista previa del navegador no cambia.
- **Valores por defecto**: Optimizada preseleccionada en cada generación; la opción no se guarda como ajuste global (principio VI). Si más adelante se quiere recordarla, sería otra feature.
- **Calidad mínima**: 150 puntos por pulgada se toma como estándar razonable para un catálogo que se ve en pantalla o se imprime en una impresora de oficina. Para una imprenta existe la calidad Original.
- **De dónde viene el peso**: se atribuye a las fotos (unos 0,86 MB por foto en promedio, con un PDF de 66 páginas mayormente de texto y fondos). El plan debe **medir la composición real del archivo** (fotos, fondos, portadas, tipografías) antes de dar por alcanzable el tamaño objetivo de 25 MB, por si algún otro elemento pesara de forma relevante.
- **Cómo se logra** se decide en el plan, no aquí. Las dos direcciones que se evaluarán son reducir y recomprimir cada foto al prepararla (lo que exigiría una dependencia de procesamiento de imágenes) o procesar el PDF ya generado con una herramienta externa; cualquier dependencia nueva debe justificarse por escrito en el plan (principio VI).
- **Medición real**: antes y después con la cuenta real de la tienda, de forma manual, solo lectura y sin datos privados en la documentación (principios I y III y regla de datos reales de la constitución). Las pruebas automatizadas usan fotos simuladas y nunca la cuenta real (principio V).
- **Catálogos anteriores**: los PDF ya generados no se recalculan ni se reducen; el Historial muestra el tamaño que ya tienen.
- **Escala de referencia**: hasta unos 200 productos, como en 001 (la cuenta real tiene 197 activos y 182 con foto en el catálogo).
- **Fuera de alcance**: cambiar el diseño de las plantillas, reducir la cantidad de páginas, comprimir fuentes o cambiar la forma de obtener las fotos de Alegra.
