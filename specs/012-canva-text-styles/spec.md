# Feature Specification: Texto estilo Canva (formato, efectos, curvar y copiar estilo)

**Feature Branch**: `012-canva-text-styles`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Texto estilo Canva en el editor de plantillas, para que quien ya usa Canva se sienta en casa: cursiva, subrayado, justificado, listas, panel «Efectos» como cuadrícula de estilos con vista previa (Ninguno, Sombra, Brillo, Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón, Distorsión), «Curvar» y «Copiar estilo». Todo se dibuja igual en el lienzo y en el PDF; las plantillas guardadas no cambian."

## Evidencia de referencia (medida con REA)

Observaciones hechas con REA sobre el editor de Canva (2026-10-14 y 2026-10-22), solo de la interfaz ya dibujada. Capturas en `docs/specs/rea-evidence/`: `02-texto-seleccionado.png`, `03-efectos.png`, `10-panel-efectos.png`, `08-panel-fuente.png`, `03-avanzada.png`; resumen en `docs/specs/canva-fields-inventory.md` §3.2. De Canva se toman patrones y organización; **no** se copian assets, íconos ni textos.

| Observación | Valor medido |
| --- | --- |
| Barra del texto seleccionado, de izquierda a derecha | Fuente · tamaño con − / + · color · **B** negrita · *I* cursiva · U subrayado · S tachado · aA mayúsculas · alineación · lista · espaciado · **Efectos** · Animar · Posición · copiar estilo (brocha) |
| Panel «Efectos» | Cuadrícula de 3 columnas con una vista previa «Ag» por estilo y su nombre debajo: Paralela (sombra), Brillo, Eco · Contorno, Fondo, Desalineado · Sin relleno, Neón, Distorsión; el estilo activo queda resaltado |
| Sección «Forma» del panel | «Curvar» (vista previa «ABCD» en arco) |
| Sección «Avanzado» del panel | Más estilos de la misma cuadrícula |
| Alineación y lista | Cada una es un botón que recorre sus opciones (izquierda → centro → derecha → justificado; viñetas → numerada → sin lista) |

**No verificado**: los rangos de los parámetros de cada efecto, la curvatura (se asume −100 a 100) y cualquier medida en píxeles del panel. Se eligen valores propios, ajustables al planificar.

## Estado actual del editor

- El texto tiene peso (400, 600, 700, 900), mayúsculas, tachado, contorno, resplandor neón, sombra y fondo (feature 011), alineación izquierda, centro y derecha, altura de línea, espaciado y anclaje vertical.
- **No** tiene cursiva, subrayado, justificado, listas, los efectos Brillo, Eco, Desalineado, Sin relleno y Distorsión, ni curvar, ni copiar estilo.
- Las opciones de efecto están dispersas: interruptores y selectores de color sueltos en «Color y efectos».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cursiva, subrayado, justificado y listas (Priority: P1)

Quien edita quiere dar formato a un párrafo como en Canva: poner una palabra clave en cursiva, subrayar un dato, justificar una descripción y armar una lista con viñetas o numerada.

**Why this priority**: Es el formato básico que cualquiera busca primero y no depende de los efectos.

**Independent Test**: Escribir un texto de tres líneas, ponerlo en cursiva, subrayado, justificado, con viñetas y con numeración, y comprobar que el lienzo y el PDF muestran lo mismo.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** activa «Cursiva» o «Subrayado», **Then** el texto completo se ve así y el botón queda marcado; al volver a pulsar, se quita.
2. **Given** un texto de varias líneas, **When** elige «Justificado», **Then** las líneas intermedias se reparten de borde a borde.
3. **Given** un texto con una línea por renglón, **When** elige «Viñetas» o «Numerada», **Then** cada línea lleva su viñeta o su número (1., 2., 3.…) con sangría, y «Sin lista» las quita.
4. **Given** un texto con tachado y subrayado a la vez, **When** se dibuja, **Then** se ven las dos líneas.
5. **Given** una fuente sin variante cursiva, **When** se pone cursiva, **Then** se ve inclinada igual (cursiva sintética) y no falla.

---

### User Story 2 - Panel «Efectos» en cuadrícula (Priority: P1)

La persona abre «Efectos» y ve una cuadrícula de estilos con vista previa, como en Canva. Elige uno, ajusta sus parámetros y lo ve en el texto.

**Why this priority**: Es lo que más reconoce quien viene de Canva y reúne en un solo lugar lo que hoy está disperso.

**Independent Test**: Abrir «Efectos» en un texto, elegir cada estilo, ajustar un parámetro, quitar el efecto con «Ninguno», guardar, recargar y generar el PDF.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** abre «Efectos», **Then** ve una cuadrícula con **Ninguno, Sombra, Brillo, Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón y Distorsión**, cada uno con una vista previa del texto «Ag» y su nombre.
2. **Given** la cuadrícula, **When** elige un estilo, **Then** queda resaltado, el texto lo muestra y aparecen sus parámetros debajo.
3. **Given** un texto con efecto, **When** elige «Ninguno», **Then** se quitan todos los efectos y el texto vuelve a verse como un texto sin efectos.
4. **Given** un texto con Sombra y Fondo (feature 011), **When** abre el panel, **Then** ambos aparecen activos y se pueden combinar con otros.
5. **Given** cada estilo nuevo —**Brillo** (resplandor suave), **Eco** (copias escalonadas), **Desalineado** (dos copias de color desplazadas), **Sin relleno** (solo el borde de las letras) y **Distorsión** (copias de dos colores en sentidos opuestos)—, **When** se activa, **Then** se dibuja igual en el lienzo y en el PDF.
6. **Given** un efecto con color, **When** abre su selector, **Then** usa el selector de color de la feature 009 (colores de la plantilla, buscador, cuentagotas).

---

### User Story 3 - Curvar el texto (Priority: P2)

La persona quiere un título en arco, como un sello o una etiqueta. En «Forma», elige «Curvar» y ajusta la curvatura de −100 a 100.

**Why this priority**: Es vistoso y está en el panel de Canva, pero se usa menos que el formato y los efectos.

**Independent Test**: Curvar un título corto a +60 y a −60, guardar, recargar y generar el PDF; el arco coincide.

**Acceptance Scenarios**:

1. **Given** un texto de una línea, **When** elige «Curvar» con curvatura positiva, **Then** el texto sigue un arco hacia arriba; con negativa, hacia abajo; con 0 queda recto como un texto normal.
2. **Given** un texto curvo, **When** cambia el tamaño de la caja, **Then** el arco se ajusta al ancho de la caja.
3. **Given** un texto curvo, **When** se combina con color, contorno o sombra, **Then** esos ajustes se ven también.
4. **Given** un texto de varias líneas, **When** se curva, **Then** se curva solo la primera línea y la persona ve un aviso breve de que Curvar admite una línea.

---

### User Story 4 - Copiar estilo (Priority: P3)

La persona da formato a un texto y quiere dejar otro igual: pulsa la brocha, hace clic en el otro texto y le pasa el formato sin cambiar su contenido.

**Why this priority**: Ahorra repetir ajustes, pero no cambia lo que se puede lograr.

**Independent Test**: Dar formato completo a un texto, copiarlo, pegarlo en otro de contenido distinto y comprobar que cambió el formato y no el contenido.

**Acceptance Scenarios**:

1. **Given** un texto con formato, **When** pulsa la brocha y luego hace clic en otro texto, **Then** el segundo recibe fuente, tamaño, peso, cursiva, subrayado, tachado, mayúsculas, color, alineación, lista, espaciados, efectos y curvatura, pero conserva su contenido, su posición, su tamaño de caja y su nombre.
2. **Given** el modo copiar estilo activo, **When** pulsa Escape o hace clic en un lugar vacío, **Then** el modo se cancela sin cambiar nada.
3. **Given** un pegado de estilo, **When** pulsa deshacer, **Then** el texto vuelve a como estaba en un solo paso.

---

### Edge Cases

- Texto vacío con cualquier formato: no falla ni deja marcas.
- Lista con líneas en blanco: las líneas en blanco no llevan viñeta ni número, y la numeración no las cuenta.
- Texto con datos insertables (`{banner}`…) con lista, cursiva o efectos: el ajuste de tamaño sigue funcionando.
- Subrayado con tachado, contorno y sombra a la vez: se ven todos.
- Efectos combinados que se pisan (por ejemplo Distorsión con Desalineado): se dibujan sin error en un orden fijo y documentado.
- Curvar con curvatura 0: se dibuja como un texto recto normal, sin cambiar sus cortes de línea ni su posición.
- Elemento bloqueado: los controles nuevos quedan deshabilitados.
- Plantilla guardada antes de la feature: se abre sin ninguno de los formatos nuevos y se ve idéntica.

## Requirements *(mandatory)*

### Functional Requirements

**Formato**

- **FR-001**: El inspector de texto MUST ofrecer **Cursiva** y **Subrayado** como interruptores, que pueden combinarse con tachado, negrita y mayúsculas.
- **FR-002**: La alineación MUST incluir **Justificado**, además de izquierda, centro y derecha.
- **FR-003**: El inspector MUST ofrecer **Lista** con tres estados: sin lista, viñetas y numerada; cada línea no vacía es un elemento de la lista.
- **FR-004**: Una lista numerada MUST contar solo las líneas no vacías, empezando en 1.

**Efectos**

- **FR-005**: El inspector MUST mostrar un panel «Efectos» con una cuadrícula de estilos con vista previa: Ninguno, Sombra, Brillo, Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón y Distorsión, con el activo resaltado.
- **FR-006**: Sombra, Contorno, Fondo y Neón MUST conservar sus parámetros y su aspecto actuales (features anteriores) y pasar a elegirse desde la cuadrícula.
- **FR-007**: Brillo, Eco, Desalineado, Sin relleno y Distorsión MUST ser efectos nuevos con color propio (cuando aplique) y al menos un parámetro de intensidad, cada uno con rango limitado, deslizador y campo numérico.
- **FR-008**: Los efectos MUST poder combinarse, salvo «Ninguno», que los quita todos; el orden de dibujo MUST ser fijo.
- **FR-009**: Cada estilo con color MUST usar el selector de color de la feature 009.

**Forma**

- **FR-010**: El panel MUST ofrecer «Curvar» con curvatura de −100 a 100 (0 = recto) y su control correspondiente.
- **FR-011**: El texto curvo MUST ajustarse al ancho de su caja y conservar color, contorno y sombra. Curvar MUST aplicarse solo a la primera línea de un texto de varias.

**Copiar estilo**

- **FR-012**: El editor MUST ofrecer un botón «Copiar estilo» que copia el formato del texto seleccionado y lo pega con un clic en otro texto, sin tocar su contenido, posición, tamaño de caja ni nombre.
- **FR-013**: Pegar un estilo MUST ser **un** paso de deshacer; Escape o clic en vacío MUST cancelar el modo.

**Consistencia y compatibilidad**

- **FR-014**: Todos los formatos y efectos MUST verse idénticos en el lienzo, las miniaturas, la vista previa y el PDF, con los mismos cortes de línea.
- **FR-015**: Todo MUST guardarse con la plantilla y conservarse al recargar, duplicar y al cambiar de plantilla y volver.
- **FR-016**: Las plantillas guardadas antes de la feature MUST abrirse y generarse sin cambios. Las **4 plantillas base** MUST producir un PDF **idéntico byte a byte** al de la línea base vigente.
- **FR-017**: Cada cambio con un control MUST ser **un** paso de deshacer y un cambio sin efecto MUST NOT agregar paso.
- **FR-018**: Al guardar, el sistema MUST rechazar valores fuera de rango o colores inválidos con el mismo tipo de mensaje de las demás propiedades.
- **FR-019**: Con el elemento bloqueado, los controles nuevos MUST quedar deshabilitados.
- **FR-020**: La feature MUST NOT incorporar íconos, textos, imágenes ni otros recursos de Canva; las vistas previas «Ag» se dibujan con el propio texto y la propia marca de Asia-POP.

### Key Entities *(include if feature involves data)*

- **Elemento de texto**: se amplía con cursiva, subrayado, alineación «justificado», lista (ninguna, viñetas, numerada), cinco efectos nuevos con sus parámetros y la curvatura. Todo opcional; sin ellos se dibuja como hoy.
- **Estilo copiado**: conjunto de propiedades de formato guardado solo durante la edición (no se guarda con la plantilla).
- **Plantilla**: las anteriores no traen estos campos y se leen como «sin formato nuevo».

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las **4 plantillas base** y toda plantilla guardada antes de la feature producen un PDF **idéntico byte a byte** al de antes.
- **SC-002**: Cada formato y efecto nuevo se ve **igual** en el lienzo y en el PDF, con la misma posición y los mismos cortes de línea.
- **SC-003**: Una persona que usa Canva encuentra cursiva, subrayado, justificado, lista y cada efecto **sin instrucciones**, en menos de **10 segundos** cada uno.
- **SC-004**: Aplicar un estilo de la cuadrícula toma **un clic**; cambiarlo por otro, un clic; quitarlo, un clic en «Ninguno».
- **SC-005**: Copiar el formato de un texto a otro toma **dos clics** y deja el contenido intacto.
- **SC-006**: Un cambio en cualquier control se ve en el lienzo en **menos de 0,2 segundos**.
- **SC-007**: Un texto con formato y efectos sobrevive a guardar, recargar, duplicar y deshacer/rehacer sin perder ningún parámetro.

## Assumptions

- Quien usa el editor es el administrador del catálogo, en un computador con navegador de escritorio.
- Todo lo nuevo es opcional en el texto; su ausencia equivale a «sin formato», así no cambia el formato de las plantillas existentes.
- Los rangos y valores iniciales de cada efecto y la curvatura −100…100 son elecciones propias (no medidas con REA) y se fijan al planificar.
- La cursiva usa la variante de la fuente si existe y, si no, una inclinación sintética.
- La línea base de PDFs vigente (capturada al empezar esta feature) sirve de comparación.
- «Copiar estilo» vive en la sesión de edición; no se guarda y no se comparte entre plantillas.
- Quedan fuera: Animar, texto con degradado, listas anidadas, sangría configurable, curvar varias líneas, y cualquier cambio en las fuentes disponibles.
