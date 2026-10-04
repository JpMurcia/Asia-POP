# Feature Specification: Panel de administración y personalización del catálogo

**Feature Branch**: `002-admin-panel-theming` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`)

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Actualizar el generador y administrador de catálogos PDF para alinearlo con los mockups de `docs/Diseño de catálogo y administración`: sistema de temas neón (fondo #11052C, acentos #FF007A, #00FF66, #FF9900), A4 con 3 productos por página, sello AGOTADO, portada, portadas de sección, página de políticas, credenciales de Alegra sin reiniciar, edición y personalización de tema y plantillas, generador manual con vista previa y un punto de invocación desde n8n." Esta feature **extiende** `001-catalog-pdf-generator` (ya implementada en su mayoría); no reemplaza sus reglas de negocio.

## Clarifications

### Session 2026-10-03

- Q: ¿Se permite que n8n u otra herramienta dispare la generación? → A: No. Queda fuera de esta feature; la generación sigue siendo solo manual y la constitución no cambia.
- Q: ¿Qué dirección visual usa el panel? → A: la 1b "Pop" del mockup; no hay selector de direcciones.
- Q: ¿Qué controla el editor de tema en el PDF? → A: solo los elementos que el PDF dibuja con CSS (títulos, tarjeta de imagen, etiqueta de precio, encabezados de políticas, pie). Las imágenes de portada y el mármol de Cat.pdf no cambian.
- Q: ¿Qué hace "Ocultar agotados" con los combos? → A: también oculta los combos con algún componente agotado y, en ese caso, no se pide decisión por combo.
- Q: ¿El pie con teléfonos y dirección va en todas las páginas? → A: en las páginas de producto y en la de políticas. Las portadas conservan el bloque "Domicilios" con teléfonos de Cat.pdf.
- Q: ¿Cómo se nombra la pantalla de inicio y la navegación? → A: se usan los nombres del mockup: Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo, Historial; más la entrada nueva Apariencia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Panel de administración fiel al mockup (Priority: P1)

El administrador entra al panel y encuentra la experiencia diseñada en el mockup, en su dirección visual **1b "Pop"** (fondo crema, navegación morada, acentos rosa y ámbar, tipografía redondeada): pantalla de login con logo, navegación lateral (Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo, Historial, Apariencia) con contadores de alertas, indicador permanente del estado de conexión con Alegra y botón de cerrar sesión. **Inicio** muestra cuatro indicadores (productos activos en Alegra, agotados, sin categoría, páginas estimadas), la lista de secciones con su cantidad de productos, agotados y origen, el último catálogo generado con su botón de descarga, y una alerta con acceso directo cuando hay ítems sin categoría.

**Why this priority**: es la cara visible del sistema; todas las demás historias se operan desde este panel.

**Independent Test**: iniciar sesión y recorrer cada ítem de la navegación comparando cada pantalla con el mockup; comprobar que el contador de "Sin categoría" y el indicador de conexión reflejan el estado real.

**Acceptance Scenarios**:

1. **Given** una sesión iniciada, **When** el usuario abre Inicio, **Then** ve la navegación lateral, el estado de conexión con Alegra, los cuatro indicadores, las secciones y el último catálogo con opción de descarga.
2. **Given** ítems sin categoría, **When** el usuario abre cualquier pantalla, **Then** el ítem "Sin categoría" de la navegación muestra la cantidad e Inicio ofrece un acceso directo para asignarles sección.
3. **Given** que Alegra no responde o las credenciales fallan, **When** el usuario ve el panel, **Then** el indicador de conexión lo muestra de forma visible, el último catálogo sigue disponible y los indicadores que dependen de Alegra se muestran como no disponibles.
4. **Given** una pantalla de portátil (1366×768 o ancho de 1024 px), **When** el usuario usa el panel, **Then** el contenido sigue siendo legible y operable sin desplazamiento horizontal de la página.
5. **Given** cualquier pantalla ya existente en la feature 001 (conexión con Alegra, ítems sin categoría, contenido propio, combos, historial), **When** el usuario la usa, **Then** conserva todas sus capacidades con el nuevo aspecto.

---

### User Story 2 - Generar con opciones y vista previa de estructura (Priority: P1)

En la pantalla Generar catálogo, el usuario prepara el catálogo (consulta a Alegra una sola vez) y luego elige qué **secciones incluir**, si **oculta los productos agotados** y el **texto del banner de portada**. Ve una **vista previa de la estructura** del catálogo —cuántas portadas, cuántas páginas de productos (máximo 3 por página) y cuánto contenido propio o de políticas tendrá— que se actualiza al cambiar las opciones sin volver a consultar Alegra. Luego genera y descarga el PDF.

**Why this priority**: el mockup lo presenta como el flujo central; permite al usuario saber qué obtendrá antes de esperar la generación.

**Independent Test**: preparar, desmarcar una sección, ocultar agotados y cambiar el texto del banner; comprobar que la vista previa de estructura cambia de acuerdo con las opciones y que el PDF generado coincide con ella.

**Acceptance Scenarios**:

1. **Given** un catálogo preparado con varias secciones, **When** el usuario desmarca una, **Then** la vista previa de estructura la excluye y el PDF no la contiene.
2. **Given** productos de Alegra y combos con componentes agotados, **When** el usuario activa "Ocultar productos agotados", **Then** la vista previa muestra menos páginas, el PDF no incluye productos agotados ni combos con algún componente agotado, y no se pide decisión por esos combos.
3. **Given** un texto de banner personalizado, **When** se genera el catálogo, **Then** la portada muestra ese texto solo en esa generación; la próxima vez el campo vuelve a mostrar el texto guardado en Apariencia.
4. **Given** la vista previa de estructura, **When** el usuario genera el catálogo, **Then** el número de portadas y páginas del PDF coincide con lo mostrado.
5. **Given** una generación en curso, **When** el usuario intenta generar de nuevo, **Then** el sistema lo impide y muestra el estado de la generación activa.
6. **Given** un combo con un componente agotado dentro de una sección desmarcada, **When** el usuario genera, **Then** no se le pide decidir sobre ese combo ni se cuentan sus alertas, porque no estará en el PDF.
7. **Given** todas las secciones desmarcadas, **When** el usuario mira la vista previa, **Then** ve que no hay nada que generar y el botón Generar queda deshabilitado.

---

### User Story 3 - Personalizar el tema del catálogo (Priority: P2)

El usuario abre Apariencia y ajusta el color de fondo y los tres colores de acento de los elementos que el PDF dibuja (por defecto fondo `#11052C`, acentos rosa `#FF007A`, verde `#00FF66` y naranja `#FF9900`), el texto del banner de portada y los datos de contacto del pie (teléfonos y dirección). Cada campo de color indica qué elemento del catálogo cambia. Ve una muestra de página con los cambios antes de guardarlos, puede restaurar los valores originales y el tema guardado se aplica a todos los PDF siguientes.

**Why this priority**: da autonomía para renovar la imagen del catálogo sin depender de un desarrollador, pero el catálogo ya es útil con el tema por defecto.

**Independent Test**: cambiar el color de acento, ver la muestra, guardar, generar el PDF y comprobar que usa el nuevo color; restaurar y comprobar que vuelve al tema original.

**Acceptance Scenarios**:

1. **Given** el tema por defecto, **When** el usuario cambia un color y mira la muestra, **Then** la muestra refleja el cambio sin haber guardado.
2. **Given** un tema modificado y guardado, **When** se genera el catálogo, **Then** el PDF usa los colores y textos guardados.
3. **Given** un tema modificado, **When** el usuario pulsa "Restaurar valores originales", **Then** el tema vuelve a los colores por defecto y el siguiente PDF los usa.
4. **Given** un valor de color inválido, **When** el usuario intenta guardar, **Then** se rechaza con un mensaje claro y se conserva el tema anterior.
5. **Given** una combinación con poco contraste entre un color y el fondo o el texto blanco que se dibuja encima, **When** el usuario la guarda, **Then** el sistema advierte que puede no ser legible, pero permite continuar.
6. **Given** que el tema se cambió y guardó desde otra pestaña, **When** el usuario guarda desde una pestaña con datos viejos, **Then** el sistema se lo avisa y no pisa el cambio sin que el usuario recargue.

---

### User Story 4 - PDF fiel al diseño de los mockups (Priority: P2)

El PDF generado respeta el sistema visual del catálogo: portada, portadas de sección con título destacado, tarjetas con imagen de borde redondeado, sello diagonal **AGOTADO**, precio destacado en una etiqueta, **pie con teléfonos (`310 669 0585` y `318 807 0709`) y dirección (`Cra 10 # 18-15 centro`) en las páginas de producto y de políticas**, y página final de políticas. Las portadas conservan su bloque "Domicilios" con los teléfonos, como en `docs/Cat.pdf`.

**Why this priority**: la identidad de marca ya está aprobada; esta historia garantiza que la generación personalizable no la degrade y completa el pie que hoy falta en las páginas de producto.

**Independent Test**: generar un catálogo con el tema por defecto y compararlo página por página con `docs/Cat.pdf` y los mockups; revisar que ninguna página de producto tenga más de 3 tarjetas ni contenido cortado.

**Acceptance Scenarios**:

1. **Given** el tema por defecto, **When** se genera el catálogo, **Then** cada página de producto es A4, tiene como máximo 3 tarjetas y muestra imagen, descripción (o el nombre si no hay descripción) y precio.
2. **Given** un producto agotado, **When** se genera el catálogo, **Then** su tarjeta muestra el sello AGOTADO diagonal.
3. **Given** cualquier página de producto o la de políticas, **When** se revisa el pie, **Then** muestra los teléfonos y la dirección configurados.
4. **Given** nombres, descripciones, textos de políticas, dirección del pie, introducciones de sección o banner muy largos, **When** se genera el catálogo, **Then** el texto no desborda su tarjeta, su bloque ni la hoja.

---

### Edge Cases

- El usuario cambia el tema pero no guarda y cierra la pestaña o navega desde la barra lateral: se le avisa de los cambios sin guardar. El botón "Atrás" del navegador no se intercepta en esta versión.
- El tema guardado deja texto ilegible sobre una superficie del catálogo: se advierte, no se bloquea.
- Se desmarcan todas las secciones: el sistema informa que no hay nada que generar en lugar de producir un PDF vacío; la vista previa muestra la estructura vacía.
- El texto del banner está vacío o es muy largo: vacío usa el texto guardado en Apariencia; más de 80 caracteres se rechaza.
- Pasan más de 15 minutos desde que se preparó el catálogo: la preparación expira y el usuario debe prepararla de nuevo; el PDF siempre se genera con los datos de la preparación vigente.
- Alegra cae mientras el usuario edita opciones o el tema: la edición sigue funcionando; solo preparar y los indicadores de Inicio avisan del fallo de conexión.
- Dos pestañas editan el tema a la vez: la segunda que guarda recibe un aviso de que el tema cambió y debe recargar.
- Un combo tiene un componente agotado y el usuario oculta agotados: el combo se omite sin preguntar.
- Los textos de políticas son más largos de lo que cabe en una página: el sistema limita el total permitido y reduce el tamaño del texto de forma gradual, sin desbordar.

## Requirements *(mandatory)*

### Functional Requirements

**Panel de administración** *(extiende 001; las pantallas existentes conservan sus capacidades)*
- **FR-001**: El panel MUST ofrecer login con logo, navegación lateral con las entradas Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo, Historial y Apariencia, y botón de cerrar sesión, conforme al mockup en su dirección 1b "Pop".
- **FR-002**: La navegación MUST mostrar un contador de ítems sin categoría y un indicador permanente del estado de conexión con Alegra.
- **FR-003**: Inicio MUST mostrar cuatro indicadores (productos activos en Alegra, agotados, sin categoría, páginas estimadas), la lista de secciones con cantidad de productos, agotados y origen (Alegra o propia), el último catálogo generado con su fecha, su número de páginas y un botón de descarga, y un acceso directo a resolver los ítems sin categoría cuando existan.
- **FR-004**: Las pantallas de conexión con Alegra, contenido propio (secciones y productos propios), combos, ítems sin categoría e historial MUST conservar todas las capacidades definidas en la feature 001 con el aspecto del mockup.
- **FR-005**: El panel MUST ser legible y operable sin desplazamiento horizontal de la página con ventanas de 1366×768 y de 1024 px de ancho.
- **FR-029**: Si Alegra no responde, Inicio y la navegación MUST seguir cargando y mostrar los datos que dependen de Alegra como no disponibles; el último catálogo se obtiene siempre del historial local.

**Generación con opciones y vista previa**
- **FR-006**: Después de preparar el catálogo, la pantalla Generar catálogo MUST listar las secciones con contenido elegible y su cantidad de productos, todas marcadas por defecto, y permitir elegir cuáles incluir en el PDF.
- **FR-007**: La pantalla MUST permitir ocultar o mostrar los productos agotados y definir el texto del banner de portada para esa generación, que parte del texto guardado en Apariencia y no lo modifica. "Ocultar agotados" MUST ocultar también los combos con algún componente agotado y, en ese caso, MUST NOT pedir decisión por combo.
- **FR-008**: Tras preparar, el sistema MUST mostrar una vista previa de estructura con número de portadas, número de páginas de productos (máximo 3 por página) y cantidad de contenido propio o de políticas, y MUST recalcularla al cambiar las opciones sin volver a consultar Alegra.
- **FR-009**: La vista previa de estructura MUST coincidir con el PDF generado con los mismos datos y opciones; si no hay secciones seleccionadas MUST indicar que no hay nada que generar.
- **FR-010**: El sistema MUST seguir aplicando las reglas de la feature 001 (alerta de ítems sin categoría, omisión de ítems sin imagen, alerta de combos agotados y bloqueo de generaciones simultáneas) **solo sobre las secciones incluidas**: las alertas, omisiones y decisiones de combos de secciones desmarcadas no se muestran ni se exigen.

**Tema del catálogo**
- **FR-011**: El usuario MUST poder editar el color de fondo, los tres colores de acento, el texto del banner de portada y los datos de contacto del pie (teléfonos y dirección) que usa el catálogo. El color de fondo y los acentos se aplican a los elementos que el PDF dibuja (títulos de portada y de sección, tarjeta de imagen, etiqueta de precio, encabezados de políticas y pie); las imágenes de portada y el mármol de `docs/Cat.pdf` no cambian. Cada campo de color MUST indicar qué elemento modifica.
- **FR-012**: Los valores por defecto del tema MUST ser: fondo `#11052C`, acentos `#FF007A`, `#00FF66` y `#FF9900`.
- **FR-013**: El editor MUST mostrar una muestra del catálogo con los cambios antes de guardarlos.
- **FR-014**: El sistema MUST validar los valores de color, rechazar los inválidos conservando el tema anterior, y advertir —sin bloquear el guardado— cuando un color tenga poco contraste con la superficie sobre la que se dibuja (el fondo para los acentos, el texto blanco para el fondo).
- **FR-015**: El usuario MUST poder restaurar los valores originales del tema.
- **FR-016**: El tema guardado MUST aplicarse a todos los PDF generados después de guardarlo, sin reiniciar la aplicación, aunque se haya guardado entre preparar y generar.
- **FR-017**: El editor MUST avisar si el usuario cierra la pestaña o navega desde la barra lateral con cambios sin guardar.
- **FR-028**: Si el tema fue modificado desde otra pestaña, el sistema MUST rechazar el guardado con datos desactualizados y avisar al usuario para que recargue.

**Fidelidad del PDF** *(en gran parte ya cubierta por 001; aquí se verifica y se completa)*
- **FR-018**: El PDF MUST ser A4, con como máximo 3 productos por página, y cada tarjeta MUST mostrar imagen con borde redondeado, el texto del producto (la descripción; el nombre si no hay descripción, como en 001) y el precio destacado en pesos colombianos.
- **FR-019**: El PDF MUST incluir portada con logo y teléfonos, portada de cada sección con contenido, y página final de políticas de compra y conservación.
- **FR-020**: Cada página de producto y la de políticas MUST mostrar un pie con los teléfonos y la dirección configurados; las portadas conservan su bloque "Domicilios" con los teléfonos.
- **FR-021**: El sello AGOTADO MUST seguir las reglas de la feature 001 (productos de Alegra con inventario controlado y en cero o menos; los que no controlan inventario y los productos propios nunca lo muestran).
- **FR-022**: Los textos largos (nombres, descripciones, políticas, dirección del pie, introducciones de sección y banner) MUST NOT desbordar su tarjeta, su bloque ni la hoja.

**Estilo visual del panel (dirección 1b "Pop")**
- **FR-023**: El panel MUST usar la dirección visual "Pop" del mockup: fondo crema `#FFF7EC`, superficies blancas con borde `#F0DFC8`, texto morado oscuro `#2A1258`, acento principal rosa `#E5368C` y acento secundario ámbar `#FFB800`.
- **FR-024**: La navegación lateral MUST tener fondo morado oscuro `#2A1258`, texto crema y el ítem activo resaltado en ámbar `#FFB800`; los contadores de alerta MUST usar el acento ámbar.
- **FR-025**: Los títulos MUST usar la tipografía redondeada "Fredoka" y el texto corrido "Nunito Sans"; los botones y campos MUST tener esquinas redondeadas de 14 px, las tarjetas de 22 px, y las tarjetas y los botones principales MUST tener sombra sólida desplazada, como en el mockup.
- **FR-026**: Los mensajes de éxito, advertencia y error MUST usar los colores semánticos del mockup 1b y los botones principales MUST usar el acento rosa con sombra sólida.
- **FR-027**: El panel MUST NOT incluir el selector de dirección visual del mockup; solo existe la dirección Pop.

### Key Entities

- **Tema del catálogo**: color de fondo, tres colores de acento, texto del banner de portada y datos de contacto del pie; tiene valores por defecto restaurables y una marca de última modificación.
- **Opciones de generación**: secciones incluidas, ocultar agotados y texto del banner para una generación específica.
- **Vista previa de estructura**: resumen calculado de portadas, páginas de productos y contenido propio o de políticas que tendrá el PDF, más la lista de secciones disponibles.
- **Resumen de Inicio**: estado de conexión, indicadores, secciones y último catálogo.
- **Entidades existentes** (feature 001): Usuario, Conexión Alegra, Producto de Alegra, Sección, Producto propio, Combo, Asignación de sección, Catálogo generado, Configuración del negocio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las pantallas que existen en el mockup (Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo e Historial) coinciden en estructura, navegación y estilo con el mockup en su dirección 1b "Pop"; Apariencia, que no tiene pantalla propia en el mockup, usa los mismos componentes y estilo Pop. Validado por revisión visual del responsable de la tienda.
- **SC-002**: Un usuario cambia un color del catálogo y obtiene un PDF con el nuevo color en menos de 3 minutos.
- **SC-003**: La vista previa de estructura coincide con el PDF generado en número de portadas y de páginas en el 100 % de los casos.
- **SC-004**: Restaurar el tema original devuelve el PDF a los colores por defecto en un solo paso.
- **SC-005**: Ninguna página de producto tiene más de 3 productos ni contenido cortado o desbordado, con el tema por defecto y con cualquier tema válido.
- **SC-006**: El 100 % de los productos agotados muestran el sello AGOTADO y ningún producto propio lo muestra.
- **SC-007**: El PDF con el tema por defecto coincide con `docs/Cat.pdf` y los mockups en estructura y estilo, validado por revisión visual del responsable de la tienda.

## Assumptions

- Esta feature extiende `001-catalog-pdf-generator`; las reglas de Alegra solo lectura, seguridad del token, login semilla, omisión de ítems sin imagen, combos, paginación de 3 y generación manual siguen vigentes salvo lo que esta spec modifique.
- "Personalizar plantillas" se entiende como ajustar colores, banner y contacto del tema; un editor libre de maquetación (mover o redimensionar elementos) queda fuera de esta versión.
- El tema es único y se aplica a todo el catálogo; no hay varios temas guardados ni temas por sección.
- El panel sigue la dirección visual **1b "Pop"** del mockup `docs/Diseño de catálogo y administración/Admin Catalogo.dc.html`, elegida por el responsable; las direcciones 1a "Neón" y 1c "Sobrio" no se implementan y no hay selector de dirección en el producto. El estilo Pop aplica solo al panel; el PDF del catálogo conserva su diseño sobre las imágenes de `docs/Cat.pdf`.
- Con el tema por defecto (`#11052C`, `#FF007A`, `#00FF66`, `#FF9900`) el PDF se verá algo distinto del actual de la feature 001, porque el tema pinta elementos nuevos (anillo de la tarjeta de imagen, borde de la etiqueta de precio, encabezados de políticas y pie). El responsable lo valida en la revisión visual (SC-007) y puede cambiar los valores por defecto.
- La regla de AGOTADO sigue la feature 001 (inventario controlado y en cero o menos); es equivalente a la mencionada en la solicitud para los productos que controlan inventario.
- Los textos de políticas tienen un máximo total (3500 caracteres) para que quepan en una página.
- La estructura de archivos y las rutas técnicas propuestas en la solicitud original se resuelven en el plan y no forman parte de esta spec.
- La invocación de la generación desde herramientas externas (n8n u otras) queda fuera de esta feature, por decisión del responsable; la generación sigue siendo solo manual y la constitución no se modifica.
- La preparación del catálogo dura 15 minutos; el PDF se genera con los datos de esa preparación, sin volver a consultar Alegra.
- Un solo usuario administrador en su equipo local; el idioma es español y los precios son pesos colombianos.
