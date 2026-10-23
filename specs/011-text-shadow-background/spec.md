# Feature Specification: Sombra y fondo del texto, y estilos de texto predeterminados

**Feature Branch**: `011-text-shadow-background`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Sombra y fondo del texto como efectos del editor de plantillas, para que el texto se lea mejor sobre fotos, dibujados igual en el lienzo y en el PDF, sin alterar las plantillas ya guardadas. Como segunda historia, estilos de texto predeterminados (título, subtítulo, cuerpo) para insertar texto ya formateado."

## Evidencia de referencia (medida con REA)

Mediciones hechas con REA sobre el editor de Canva el 2026-10-22, observando solo la interfaz ya dibujada (capturas `docs/specs/rea-evidence/10-panel-efectos.png` y `12-cajon-texto.png`; revisión en `docs/specs/canva-fields-inventory.md`, sección 6 revisada). De Canva se toman patrones y organización; **no** se copian assets, íconos ni textos.

| Observación | Valor medido |
| --- | --- |
| Panel «Efectos» del texto | Cuadrícula de estilos con vista previa («Ag»): Paralela (sombra), Brillo, Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón, Distorsión; sección «Forma» (Curvar) y «Avanzado» |
| Estilo activo | Se marca en la cuadrícula |
| Cajón «Texto» | Ofrece insertar texto ya formateado (título, subtítulo, cuerpo) |

**No verificado**: los rangos numéricos exactos de cada parámetro del efecto (REA pasivo no opera los deslizadores de esos paneles) y las medidas en píxeles del panel. Los valores de esta spec son una elección propia, ajustable en la planificación.

## Estado actual del editor

- El texto tiene **contorno** (color y grosor) y **resplandor neón** (color). No tiene sombra ni fondo propio.
- El panel «Elementos» ya tiene «Agregar título» y «Agregar texto»; no tiene subtítulo (corregido en la planificación).
- Para dar fondo a un texto hoy hay que poner debajo una forma o una insignia y alinearlas a mano.
- El lienzo, las miniaturas, la vista previa y el PDF dibujan el texto con el mismo componente (constitución IV); por eso cada propiedad nueva debe leerse ahí.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dar sombra a un texto para que se lea sobre una foto (Priority: P1)

Quien administra el catálogo pone un título sobre una foto clara y casi no se lee. Selecciona el texto, abre «Efectos», elige «Sombra» y ajusta su desplazamiento, dirección, desenfoque, transparencia y color hasta que se lee bien.

**Why this priority**: Es el problema de legibilidad más común y no exige crear ni alinear elementos extra.

**Independent Test**: Sobre un texto en una foto, aplicar sombra, cambiar cada parámetro, guardar, recargar y generar el PDF; la sombra se ve igual en lienzo y PDF.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado sin efectos, **When** la persona elige «Sombra», **Then** aparece una sombra con valores iniciales razonables y los controles de desplazamiento, dirección, desenfoque, transparencia y color.
2. **Given** un texto con sombra, **When** cambia cualquier parámetro, **Then** el lienzo se actualiza al instante y el cambio cuenta como un paso de deshacer.
3. **Given** un texto con sombra, **When** elige «Ninguno», **Then** el texto vuelve a verse exactamente como antes del efecto.
4. **Given** un texto con sombra, **When** se genera el PDF, **Then** la sombra se ve igual que en el lienzo (misma posición, desenfoque y color).

---

### User Story 2 - Dar un fondo de color al texto (Priority: P2)

La persona quiere un texto «tipo etiqueta» sobre una foto: una banda de color detrás de las letras. Elige «Fondo» y ajusta redondez, separación (espacio entre letras y borde del fondo), transparencia y color.

**Why this priority**: Resuelve la legibilidad de forma más contundente que la sombra y evita apilar una forma debajo, pero se usa menos.

**Independent Test**: Aplicar fondo a un texto de dos líneas, variar redondez y separación, y comprobar que el fondo acompaña al texto si este se mueve o cambia de tamaño, en lienzo y en PDF.

**Acceptance Scenarios**:

1. **Given** un texto seleccionado, **When** elige «Fondo», **Then** aparece un fondo de color detrás de él con sus cuatro controles.
2. **Given** un texto con fondo, **When** se edita el contenido o se cambia el tamaño de letra, **Then** el fondo se ajusta solo al nuevo texto.
3. **Given** un texto con fondo y con sombra, **When** se ven juntos, **Then** conviven sin desalinearse (la sombra sigue las letras).
4. **Given** un texto con fondo, **When** se genera el PDF, **Then** el fondo se ve igual que en el lienzo.

---

### User Story 3 - Insertar texto ya formateado: título, subtítulo y cuerpo (Priority: P3)

El panel «Elementos» ya ofrece «Agregar título» y «Agregar texto», con la fuente de título y de cuerpo de la plantilla. Falta el escalón intermedio: la persona quiere también «Agregar subtítulo», para tener las tres opciones —título, subtítulo, cuerpo— con una jerarquía clara de tamaños.

**Why this priority**: Ahorra tiempo pero no cambia el resultado final; es la menos urgente.

**Independent Test**: Insertar las tres opciones en una página y comprobar que usan la fuente de título/cuerpo de la plantilla y quedan visualmente jerarquizadas.

**Acceptance Scenarios**:

1. **Given** una plantilla con su par tipográfico, **When** inserta «Título», **Then** el texto usa la fuente de títulos, un tamaño grande y peso fuerte.
2. **Given** la misma plantilla, **When** inserta «Subtítulo» y «Cuerpo», **Then** quedan en tamaños decrecientes, el cuerpo con la fuente de cuerpo.
3. **Given** que cambia la tipografía de la plantilla, **When** se inserta un estilo nuevo, **Then** usa la tipografía vigente (los textos ya insertados no cambian).

---

### Edge Cases

- Sombra con desplazamiento y desenfoque máximos cerca del borde de la página: no debe cortarse de forma distinta en lienzo y PDF.
- Fondo sobre texto de varias líneas y con texto vacío: sin fondo visible cuando no hay texto.
- Texto con contorno o resplandor neón **y** sombra o fondo: los efectos deben poder convivir y verse igual en el PDF.
- Texto tachado, en mayúsculas, con interletrado o interlineado extremos: el fondo y la sombra siguen la forma real del texto.
- Duplicar, copiar y pegar, deshacer/rehacer y cambiar de plantilla y volver: el efecto se conserva.
- Plantilla guardada antes de la feature: se abre sin efectos y sin cambio visual.
- Color con transparencia total: el efecto existe pero no se ve; no debe dar error.

## Requirements *(mandatory)*

### Functional Requirements

**Sombra**

- **FR-001**: El inspector de texto MUST ofrecer un efecto «Sombra» con parámetros de desplazamiento, dirección, desenfoque, transparencia y color, y la opción «Ninguno».
- **FR-002**: Cada parámetro MUST tener rango limitado, deslizador y campo numérico, con valores fuera de rango ajustados al límite más cercano.
- **FR-003**: Al activar la sombra, MUST usar valores iniciales que dejen una sombra visible y discreta, para que la persona vea el efecto de inmediato.

**Fondo**

- **FR-004**: El inspector de texto MUST ofrecer un efecto «Fondo» con parámetros de redondez, separación, transparencia y color.
- **FR-005**: El fondo MUST ajustarse al texto (varias líneas incluidas) y seguirlo al editar contenido, tamaño, interlineado o interletrado.
- **FR-006**: Sombra y fondo MUST poder activarse a la vez, y combinarse con el contorno y el resplandor neón existentes.

**Estilos predeterminados**

- **FR-007**: El editor MUST permitir insertar un texto «Título», «Subtítulo» o «Cuerpo», con fuente, tamaño y peso tomados de la tipografía de la plantilla, y color legible sobre el fondo de la página.
- **FR-008**: Un estilo insertado MUST ser un texto normal y editable; cambiar la tipografía de la plantilla después MUST NOT alterar los textos ya insertados.

**Consistencia y compatibilidad**

- **FR-009**: Sombra y fondo MUST verse idénticos en el lienzo, las miniaturas, la vista previa y el PDF.
- **FR-010**: Los efectos MUST guardarse con la plantilla y conservarse al recargar, duplicar, copiar y pegar, y al cambiar de plantilla y volver.
- **FR-011**: Las plantillas guardadas antes de la feature MUST abrirse y generarse sin cambios. Las **4 plantillas base** MUST producir un PDF **idéntico byte a byte** al de la línea base vigente mientras no usen los efectos nuevos.
- **FR-012**: Cada cambio hecho con un control MUST contar como **un** paso de deshacer y rehacer, y un cambio sin efecto MUST NOT agregar un paso.
- **FR-013**: Al guardar, el sistema MUST rechazar valores fuera de rango o colores inválidos, con el mismo tipo de mensaje de validación del resto de propiedades.
- **FR-014**: La feature MUST NOT incorporar íconos, textos, imágenes ni otros recursos de Canva.

### Key Entities *(include if feature involves data)*

- **Elemento de texto**: se amplía con dos efectos opcionales, **sombra** y **fondo**, cada uno con sus parámetros. Sin ellos, el texto se dibuja como hoy.
- **Estilo de texto predeterminado**: receta (título, subtítulo, cuerpo) que fija fuente, tamaño, peso y color al insertar un texto; no se guarda como entidad propia, solo produce un elemento de texto normal.
- **Plantilla**: las anteriores a esta feature no traen efectos y se leen como «Ninguno».

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las **4 plantillas base** y toda plantilla guardada antes de la feature producen un PDF **idéntico byte a byte** al de antes.
- **SC-002**: Un texto con sombra o fondo se ve **igual** en el lienzo y en el PDF, con la misma posición y los mismos cortes de línea, en las cuatro plantillas base.
- **SC-003**: Hacer legible un texto sobre una foto clara toma **menos de 30 segundos** y **dos clics** hasta ver el efecto, sin crear ni alinear elementos extra.
- **SC-004**: Un cambio en cualquier parámetro se ve en el lienzo en **menos de 0,2 segundos**.
- **SC-005**: Insertar un texto con formato de título, subtítulo o cuerpo toma **un clic** y no requiere ajustes adicionales para quedar jerarquizado.
- **SC-006**: Un texto con efectos sobrevive a guardar, recargar, duplicar y deshacer/rehacer sin perder ningún parámetro.

## Assumptions

- Quien usa el editor es el administrador del catálogo, en un computador con navegador de escritorio.
- Los efectos son propiedades opcionales del texto; su ausencia equivale a «Ninguno», así no cambia el formato de las plantillas existentes.
- Los rangos y valores iniciales (desplazamiento, desenfoque, redondez, separación) se fijan en la planificación; la referencia de Canva no los entrega y no se busca igualar su aspecto ni su marca.
- La línea base de PDFs de la feature 007 (`specs/007-editor-align-text-tools/visual/baseline/`) sigue vigente como comparación.
- Los estilos predeterminados usan la tipografía de la plantilla (feature 009) y no crean tipos de elemento nuevos.
- Quedan fuera: curvar texto, eco, desalineado, hueco, separar, elevar, distorsión, degradados, sombra en formas e imágenes, y cualquier cambio en la tipografía disponible.
