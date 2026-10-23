# Feature Specification: Elementos y formas estilo Canva

**Feature Branch**: `013-canva-elements-shapes`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Elementos y formas estilo Canva en el editor de plantillas (segunda de la hoja de ruta `docs/specs/ROADMAP-CANVA.md`): más formas, estilo de borde, elemento Línea con extremos, voltear, bloquear proporción y enlaces clicables. Todo se dibuja igual en el lienzo y en el PDF; las plantillas guardadas no cambian."

## Evidencia de referencia

Observaciones con REA sobre el editor de Canva (2026-10-23). La captura `docs/specs/rea-evidence/25-forma-seleccionada-013.png` muestra el panel «Elementos» abierto (buscador, «Usado recién», «Recomendado para ti» y categorías); **no había una forma seleccionada**, así que no se pudo medir su barra contextual. El resto de la referencia sale de `docs/specs/canva-fields-inventory.md` §3.3 a §3.6 (observado el 2026-10-14). De Canva se toman patrones y organización; **no** se copian assets, íconos ni textos.

| Observación | Fuente |
| --- | --- |
| La forma seleccionada ofrece relleno, estilo de borde (sin borde, sólido, discontinuo, punteado), grosor, color de borde y redondeo de esquinas | Inventario §3.3 |
| La línea ofrece color, grosor, estilo y extremos inicial y final (ninguno, flecha, círculo, cuadrado, rombo) | Inventario §3.4 |
| Voltear horizontal y vertical en imágenes y formas | Inventario §3.5 |
| Biblioteca de formas: rectángulo, círculo, triángulo, estrella, flechas, globos… | Inventario §3.3 |

**No verificado**: la barra contextual de forma y de línea, las medidas en píxeles de sus controles, el grosor mínimo y máximo de la línea y el tamaño de los extremos. Se eligen valores propios al planificar. **Fuera de alcance** (necesitan un modelo de datos nuevo): marcos con forma, agrupar y desagrupar, y selección múltiple. Pasan a una 013b.

## Estado actual del editor

- La forma tiene tres tipos (rectángulo, círculo, píldora), relleno, borde sólido con grosor, esquinas (solo el rectángulo) y resplandor.
- La «Línea» del panel «Elementos» es un rectángulo delgado: no tiene estilo ni extremos.
- Las imágenes y las formas no se voltean; no hay bloqueo de proporción; ningún elemento admite un enlace.
- Las plantillas base usan formas (círculos) y rectángulos delgados como divisores; deben seguir viéndose igual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Más formas (Priority: P1)

Quien edita quiere decorar una portada con una estrella o un estallido para un «PROMO», una flecha que señale un dato o un globo para una nota, igual que en Canva.

**Why this priority**: Es lo más visible y lo que pidió la hoja de ruta («estrella/estallido para PROMO»); no depende del resto.

**Independent Test**: Agregar cada forma nueva desde «Elementos», cambiarle relleno y borde, guardar, recargar y generar el PDF; todo se ve igual.

**Acceptance Scenarios**:

1. **Given** el panel «Elementos», **When** la persona mira «Formas», **Then** ve triángulo, rombo, estrella, estallido, flecha y globo además de rectángulo, círculo y píldora, cada uno con una vista previa.
2. **Given** una forma nueva agregada, **When** se dibuja, **Then** queda visible, dentro de la hoja, con relleno y lista para arrastrar y redimensionar.
3. **Given** una forma seleccionada, **When** cambia su tipo en el inspector, **Then** se redibuja con el nuevo tipo conservando relleno, borde, posición y tamaño.
4. **Given** una forma con relleno, borde y resplandor, **When** se genera el PDF, **Then** se ve igual que en el lienzo.

---

### User Story 2 - Estilo de borde (Priority: P1)

La persona quiere un recuadro con borde discontinuo o punteado, como en Canva, no solo sólido.

**Independent Test**: Poner a una forma borde sólido, discontinuo y punteado con distintos grosores y comprobar lienzo y PDF.

**Acceptance Scenarios**:

1. **Given** una forma con borde, **When** elige «Sólido», «Discontinuo» o «Punteado», **Then** el borde se dibuja con ese estilo y el botón queda marcado.
2. **Given** una forma sin borde, **When** se mira el inspector, **Then** no se muestran el estilo ni el grosor.
3. **Given** cualquier tipo de forma (también estrella o flecha), **When** se aplica un estilo, **Then** el contorno sigue la figura.

---

### User Story 3 - Línea con estilo y extremos (Priority: P1)

La persona agrega una línea y la configura: color, grosor, sólida, discontinua o punteada, con flecha, círculo, cuadrado o rombo en uno o en los dos extremos.

**Why this priority**: Es el reclamo más claro del inventario («divisores», flechas de señalización).

**Independent Test**: Agregar una línea, cambiar cada propiedad, girarla, guardar, recargar y generar el PDF.

**Acceptance Scenarios**:

1. **Given** el panel «Elementos», **When** agrega «Línea», **Then** aparece una línea horizontal sin extremos, centrada, con el color de tinta de la plantilla.
2. **Given** una línea seleccionada, **When** cambia grosor, color o estilo, **Then** se redibuja al instante y se conserva el largo.
3. **Given** una línea, **When** elige un extremo inicial y otro final, **Then** cada extremo se dibuja con su forma, proporcional al grosor.
4. **Given** una línea girada, **When** se genera el PDF, **Then** se ve con el mismo ángulo y extremos que en el lienzo.
5. **Given** una plantilla guardada con una «línea» hecha como rectángulo delgado, **When** se abre y se genera, **Then** se ve y se imprime exactamente igual.

---

### User Story 4 - Voltear (Priority: P2)

La persona voltea una flecha, un globo o una imagen en horizontal o en vertical.

**Independent Test**: Voltear una flecha y una imagen en cada eje, girar, guardar, recargar y generar el PDF.

**Acceptance Scenarios**:

1. **Given** una forma o una imagen seleccionada, **When** pulsa «Voltear horizontal» o «Voltear vertical», **Then** se refleja respecto al eje y el botón queda marcado; al pulsar de nuevo vuelve.
2. **Given** un elemento girado y volteado, **When** se dibuja en el PDF, **Then** coincide con el lienzo.
3. **Given** un texto, una insignia o un bloque automático, **When** se selecciona, **Then** no se ofrece voltear.

---

### User Story 5 - Bloquear proporción (Priority: P2)

La persona quiere agrandar un logo o una forma sin deformarla.

**Independent Test**: Activar «Bloquear proporción», redimensionar con la manija y con los campos Ancho y Alto, y comprobar que la relación se conserva.

**Acceptance Scenarios**:

1. **Given** una forma o una imagen con la proporción bloqueada, **When** arrastra la manija de la esquina, **Then** ancho y alto cambian juntos y la relación visual se mantiene.
2. **Given** la proporción bloqueada, **When** cambia solo «Ancho %» (o «Alto %») en el inspector, **Then** el otro se ajusta para conservar la relación.
3. **Given** la proporción bloqueada, **When** el resultado se saldría de los límites de tamaño, **Then** se recorta al límite y la relación se conserva.
4. **Given** la proporción sin bloquear, **When** se redimensiona, **Then** funciona como hoy.

---

### User Story 6 - Enlace clicable (Priority: P3)

La persona hace que un texto, una insignia, una forma o una imagen abra una página web (WhatsApp, Instagram, la tienda) al pulsarla en el PDF.

**Independent Test**: Poner un enlace a una imagen y a un texto, generar el PDF y comprobar que el área responde al clic; en el editor, el clic solo selecciona.

**Acceptance Scenarios**:

1. **Given** un elemento seleccionado, **When** escribe una dirección que empieza con `http://` o `https://` en «Enlace», **Then** el valor se guarda y el elemento queda enlazado.
2. **Given** una dirección no válida (otro protocolo, sin protocolo, con espacios), **When** se guarda, **Then** se rechaza con un mensaje claro y no se guarda.
3. **Given** un elemento enlazado, **When** se genera el PDF, **Then** su área es clicable y abre la dirección.
4. **Given** el editor, **When** se hace clic en un elemento enlazado, **Then** solo se selecciona; no se abre la dirección.
5. **Given** un elemento con enlace, **When** se borra el contenido del campo, **Then** el elemento deja de estar enlazado.

---

### Edge Cases

- Una forma muy delgada (alto 0,3 %) o muy estrecha con borde discontinuo no debe romper el dibujo.
- Un borde grueso en una forma pequeña no debe salirse del elemento de forma distinta en el lienzo y en el PDF.
- Una línea de largo mínimo con extremos grandes: los extremos se dibujan completos y no se deforman.
- Voltear con rotación y con proporción bloqueada a la vez.
- Una forma ya existente de tipo rectángulo, círculo o píldora no cambia al agregarse los tipos nuevos.
- Un enlace muy largo (más de 2000 caracteres) se rechaza.
- Un elemento oculto o bloqueado conserva su enlace, su volteo y su proporción bloqueada.
- Duplicar, mover entre páginas y deshacer/rehacer conservan todos los campos nuevos.

## Requirements *(mandatory)*

### Functional Requirements

**Formas**

- **FR-001**: El panel «Elementos» MUST ofrecer, además de rectángulo, círculo y píldora, las formas triángulo, rombo, estrella, estallido, flecha y globo, cada una con una vista previa propia dibujada por Asia-POP.
- **FR-002**: El inspector de una forma MUST permitir cambiar su tipo entre todos los disponibles sin perder relleno, borde, posición ni tamaño.
- **FR-003**: Las formas nuevas MUST aceptar relleno (sólido o transparente), borde, grosor de borde y resplandor igual que las actuales; «Esquinas» solo se ofrece donde tiene sentido (rectángulo).

**Estilo de borde**

- **FR-004**: El inspector MUST ofrecer «Estilo del borde» con **Sólido**, **Discontinuo** y **Punteado** cuando la forma tiene borde, junto a su color y grosor.
- **FR-005**: El estilo de borde MUST aplicarse a todos los tipos de forma y seguir su contorno.

**Línea**

- **FR-006**: El panel «Elementos» MUST agregar la «Línea» como un elemento de línea propio y no como un rectángulo delgado.
- **FR-007**: El inspector de una línea MUST ofrecer color, grosor, estilo (sólido, discontinuo, punteado) y extremo inicial y final (ninguno, flecha, círculo, cuadrado, rombo), cada uno con rango limitado.
- **FR-008**: El tamaño de un extremo MUST ser proporcional al grosor de la línea y dibujarse completo.
- **FR-009**: Las líneas existentes hechas con rectángulos delgados MUST conservar su aspecto y su tipo sin migración.

**Voltear y proporción**

- **FR-010**: El inspector de formas, líneas e imágenes MUST ofrecer «Voltear horizontal» y «Voltear vertical» como interruptores; no se ofrecen en texto, insignia ni bloques automáticos.
- **FR-011**: El volteo MUST combinarse correctamente con la rotación.
- **FR-012**: El inspector de formas, líneas e imágenes MUST ofrecer «Bloquear proporción»; con él, la manija de la esquina y los campos «Ancho %» y «Alto %» MUST conservar la relación ancho/alto del elemento.
- **FR-013**: El bloqueo de proporción solo afecta al editor; MUST NOT cambiar cómo se dibuja ni se imprime.

**Enlace**

- **FR-014**: El inspector de texto, insignia, forma, línea e imagen MUST ofrecer un campo «Enlace»; vacío significa sin enlace.
- **FR-015**: El sistema MUST aceptar solo direcciones `http://` o `https://` de hasta 2000 caracteres, sin espacios, y rechazar las demás al guardar con un mensaje en español.
- **FR-016**: Un elemento con enlace MUST ser clicable en el PDF y MUST NOT abrir la dirección dentro del editor.

**Consistencia y compatibilidad**

- **FR-017**: Todo lo nuevo MUST verse idéntico en el lienzo, las miniaturas, la vista previa y el PDF.
- **FR-018**: Todo MUST guardarse con la plantilla y conservarse al recargar, duplicar y cambiar de plantilla y volver.
- **FR-019**: Las plantillas guardadas antes de la feature MUST abrirse y generarse sin cambios. Las **4 plantillas base** MUST producir un PDF **idéntico byte a byte** al de la línea base vigente.
- **FR-020**: Cada cambio con un control MUST ser **un** paso de deshacer y un cambio sin efecto MUST NOT agregar paso.
- **FR-021**: Con el elemento bloqueado, los controles nuevos MUST quedar deshabilitados.
- **FR-022**: La feature MUST NOT incorporar íconos, textos, imágenes ni otros recursos de Canva.

### Key Entities *(include if feature involves data)*

- **Forma**: gana nuevos tipos (triángulo, rombo, estrella, estallido, flecha, globo), estilo de borde, volteo, proporción bloqueada y enlace. Todo opcional.
- **Línea**: elemento nuevo con color, grosor, estilo y dos extremos; se puede girar, voltear y enlazar.
- **Imagen**: gana volteo, proporción bloqueada y enlace.
- **Texto e insignia**: ganan solo enlace.
- **Plantilla**: las anteriores no traen estos campos y se leen como «sin cambios».

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las **4 plantillas base** y toda plantilla guardada antes de la feature producen un PDF **idéntico byte a byte** al de antes.
- **SC-002**: Cada forma, estilo de borde, extremo de línea y volteo se ve **igual** en el lienzo y en el PDF.
- **SC-003**: Una persona que usa Canva agrega una forma nueva, una línea con flecha y voltea una imagen **sin instrucciones**, en menos de **10 segundos** cada una.
- **SC-004**: Agregar una forma o una línea toma **un clic**; cambiar su estilo de borde, un clic.
- **SC-005**: Con la proporción bloqueada, el redimensionado conserva la relación con un error visible de **menos de 1 %**.
- **SC-006**: Un enlace puesto en el editor responde al clic en el PDF generado en **100 %** de los casos probados.
- **SC-007**: Un cambio en cualquier control se ve en el lienzo en **menos de 0,2 segundos**.
- **SC-008**: Todo lo nuevo sobrevive a guardar, recargar, duplicar y deshacer/rehacer sin perder ningún parámetro.

## Assumptions

- Quien usa el editor es el administrador del catálogo, en un computador con navegador de escritorio.
- Todo lo nuevo es opcional; su ausencia equivale al comportamiento anterior, así las plantillas guardadas y los PDF de la línea base no cambian.
- Las formas nuevas son figuras propias de Asia-POP (no copias de las de Canva), pensadas para decorar; sus proporciones y los valores de grosor y extremos son elecciones propias (no medidas con REA) y se fijan al planificar.
- La línea es recta; el giro se hace con la rotación existente. Quedan fuera las líneas en codo y curvas.
- «Voltear» no se ofrece en texto (Canva tampoco lo permite) ni en bloques automáticos.
- «Bloquear proporción» es solo del editor y se guarda con el elemento para que no se pierda al recargar.
- Línea base de PDFs: capturada el 2026-10-23 con el commit `8eacd38` en una carpeta temporal.
- Quedan fuera (013b): marcos con forma, agrupar y desagrupar, selección múltiple; también degradado de relleno, líneas en codo o curvas y cualquier cambio en las imágenes disponibles (feature 014).
