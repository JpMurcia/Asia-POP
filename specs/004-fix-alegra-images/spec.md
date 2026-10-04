# Feature Specification: Fotos de productos de Alegra en el catálogo

**Feature Branch**: `004-fix-alegra-images` (el proyecto aún no es un repositorio git; el nombre solo identifica la feature)

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Diagnóstico y corrección de imágenes desde la API de Alegra: el sistema sincroniza bien los ítems y los precios, pero ningún producto muestra su imagen en las tarjetas del catálogo. Investigar, documentar e implementar los ajustes necesarios para obtener, transformar y renderizar correctamente las imágenes de los productos provenientes de Alegra en los catálogos PDF: estructura real del arreglo de imágenes, diferencia entre la lista de ítems y el detalle de un ítem, espera de la carga de imágenes en el render, imagen de respaldo para productos sin foto, manejo de errores de carga y producto agotado que conserva su foto." Después se pidió validar con la cuenta real de Alegra los servicios disponibles para extraer la imagen, incluido `/items/{id}/attachment`.

Esta feature **corrige** el comportamiento de fotos de `001-catalog-pdf-generator` y se apoya en el render de `003-catalog-template-editor`. No cambia las reglas de precio, stock, secciones ni combos.

## Clarifications

### Session 2026-10-04

- Q: ¿Qué hacer con un producto de Alegra sin foto utilizable? → A: **Opción A.** Se mantiene la regla vigente (FR-012 de 001, principio II): queda fuera del PDF y se informa. No hay imagen de respaldo y no se enmienda la constitución. El responsable lo decidió después de validar con la cuenta real que las fotos sí se pueden extraer (ver "Verificación con la cuenta real").
- Q: ¿Se usa el servicio `/items/{id}/attachment` de Alegra? → A: No. `POST` y `DELETE` escriben en Alegra (principio I) y `GET` responde con el propio ítem, sin adjuntos aparte.
- Q: ¿La tarjeta de un producto de Alegra con descripción debe mostrar también el nombre? → A: Sí (FR-010 de `001`). Lo pidió el responsable al revisar el catálogo real: 2 de los 181 productos con foto tienen descripción y la tarjeta mostraba solo esa nota, sin nombre. Se añade la Historia 4.

## Verificación con la cuenta real (4-oct-2026)

Se consultó la cuenta real de la tienda solo con peticiones de lectura y con salida sanitizada (sin credenciales, nombres de producto ni direcciones completas). La sonda usada fue desechable y no forma parte del producto.

**Hechos verificados**

- La cuenta tiene **197 productos activos: 181 con foto (92 %) y 16 sin foto**. De los 16 sin foto, 11 son variantes, 2 son productos padre de variantes (que el sistema ya ignora), y hay 1 producto, 1 combo y 1 servicio.
- La consulta general **ya trae las fotos** sin pedir ningún modo especial; con `mode=simple` desaparecen y con `mode=advanced` son idénticas a la consulta normal. El detalle de un ítem trae las mismas fotos, así que **no hace falta consultar el detalle** de cada producto.
- Cada foto llega como `{ id, name, url, favorite }`: `url` es una dirección https firmada del CDN de Alegra y `favorite` es verdadero o falso. **No existe `isPrimary`** ni el campo `attachments` en ningún producto.
- 177 productos tienen una sola foto (siempre `favorite = true`); 4 tienen varias (2 o 3). En esos 4, **la favorita no es la primera**: hoy el sistema elegiría la foto equivocada en todos.
- `GET /items/{id}/attachment` responde 200 pero devuelve el propio ítem (mismas `images`), sin adjuntos adicionales.
- Las 186 fotos son JPG (77) o PNG (109), todas con dirección https. Las 6 descargadas de prueba respondieron 200, pesan entre ~46 KB y ~2 MB, y los enlaces vencen en unos 7 días (la documentación habla de 30 minutos solo para la respuesta de subida).

**Causa raíz confirmada con el código real**: el sistema encuentra la dirección de la foto en 29 de los 30 productos de una página real, pero **descarta las 3 fotos probadas** y no guarda ningún archivo. Alegra sirve **todas** sus fotos declarando el tipo de contenido genérico `binary/octet-stream` (aunque el contenido real es JPG o PNG), y el sistema solo acepta fotos cuyo origen declare un tipo de imagen. Como una descarga descartada se trata en silencio igual que un producto sin foto, ningún producto de Alegra llega al catálogo y el informe solo dice "omitidos por no tener imagen". Causa secundaria: con varias fotos se elige la primera y no la favorita.

## Punto de partida

Resultado de contrastar cada propuesta de la descripción con lo que el sistema hace hoy y con lo verificado:

| Propuesta de la descripción | Estado actual y verificado | Qué hace esta feature |
| --- | --- | --- |
| Leer las fotos del ítem desde su arreglo de imágenes | Ya funciona: la dirección se encuentra en 29 de 30 productos. La estructura real es `{ id, name, url, favorite }` | Nada que cambiar en la lectura |
| Elegir la foto principal (`isPrimary`) y, si no hay, la primera | Hoy solo se usa la primera. La marca real se llama `favorite`, y en los 4 productos con varias fotos la favorita no es la primera | Historia 1 (FR-003) |
| Consultar el detalle del ítem si la lista no trae fotos | Innecesario: la lista ya las trae | Fuera de alcance |
| Usar `/items/{id}/attachment` | `GET` devuelve el ítem sin datos nuevos; `POST` y `DELETE` escriben en Alegra | No se usa (FR-014) |
| Esperar la carga de las fotos antes de imprimir | Ya cubierto: las fotos se descargan antes de dibujar el PDF, la página de impresión espera a que todas las fotos y fuentes estén listas y el render espera a que la red quede inactiva. **No es la causa** | Solo se verifica (FR-012) |
| Convertir las fotos a Base64 en el servidor | No aporta: el navegador que dibuja el PDF solo carga copias locales ya descargadas | Fuera de alcance |
| Imagen de respaldo para productos sin foto | **Descartada** (opción A): se mantiene omitir e informar | FR-009 |
| Manejar el error de carga y mantener la proporción en la tarjeta | La tarjeta la dibuja la plantilla activa (003). Hoy una foto que falla se trata en silencio; ahí está el problema | Historia 2 y FR-011 |
| Producto agotado conserva la foto con la indicación AGOTADO encima | Ya existe en tres estilos (sello, cinta, gris) | Historia 3 (solo se verifica) |
| *(pedido durante la implementación)* Nombre y descripción en la tarjeta | Un producto de Alegra con descripción mostraba **solo la descripción**; sin descripción, solo el nombre. Incumplía FR-010 de `001` | Historia 4 (FR-017) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver en el catálogo la foto de cada producto de Alegra (Priority: P1)

Al preparar y generar un catálogo, cada producto de Alegra que tiene foto en Alegra aparece en el PDF con su foto: la marcada como favorita, o la primera si ninguna está marcada. La foto se acepta aunque el servidor de Alegra la declare con un tipo de archivo genérico, y si la foto elegida no sirve se prueba con las demás fotos del mismo producto.

**Why this priority**: es el problema reportado. Hoy 0 de los 181 productos de Alegra con foto llegan al catálogo.

**Independent Test**: con respuestas simuladas de Alegra que imiten la forma real (fotos con `favorite`, descarga con tipo genérico), preparar un catálogo con un producto de una sola foto, otro con varias fotos donde la favorita no es la primera, otro con la primera foto rota y la segunda válida, y otro con foto en PNG; comprobar que cada uno aparece con la foto esperada.

**Acceptance Scenarios**:

1. **Given** un producto con una foto válida que el servidor de Alegra declara con un tipo de archivo genérico (`binary/octet-stream`), **When** se prepara el catálogo, **Then** la foto se acepta y el producto aparece en el PDF con su foto.
2. **Given** un producto con varias fotos y una marcada como favorita que no es la primera, **When** se genera el catálogo, **Then** el PDF muestra la favorita.
3. **Given** un producto con varias fotos y ninguna marcada como favorita, **When** se genera el catálogo, **Then** el PDF muestra la primera de la lista.
4. **Given** un producto cuya foto elegida tiene un enlace vacío, inválido o que no entrega una imagen, y cuya segunda foto es válida, **When** se genera el catálogo, **Then** el PDF muestra la segunda foto.
5. **Given** un catálogo con productos con foto JPG y con foto PNG, **When** se genera, **Then** todos muestran su foto.
6. **Given** que Alegra no responde o rechaza las credenciales al listar los productos, **When** se prepara el catálogo, **Then** la preparación se aborta con un mensaje claro y no se entrega un PDF parcial (regla vigente).

---

### User Story 2 - Entender por qué falta la foto de un producto (Priority: P2)

En el informe de revisión previo a generar, la persona responsable ve por separado los productos que **no tienen foto en Alegra** y los productos que **sí la tienen pero no se pudo obtener**, cada uno con su motivo en lenguaje claro. Si ninguna de las fotos informadas por Alegra se pudo obtener, el informe lo advierte de forma destacada como un problema general y no como una lista de productos sin foto.

**Why this priority**: hoy ambos casos se ven igual ("omitidos por no tener imagen") y por eso este problema no se pudo diagnosticar desde el panel: los 181 productos con foto se mostraban como "sin imagen". Corregirlo evita volver a quedar a ciegas.

**Independent Test**: preparar un catálogo con respuestas simuladas que incluyan productos sin foto, productos con foto no encontrada, con acceso rechazado, con tiempo agotado y con contenido que no es una imagen, y comprobar que el informe los separa y rotula correctamente.

**Acceptance Scenarios**:

1. **Given** productos sin foto en Alegra y otros con foto que no se pudo obtener, **When** la persona abre el informe de revisión, **Then** ve dos grupos distintos, cada uno con su cantidad y la lista de productos, y cada producto del segundo grupo con su motivo.
2. **Given** que ninguna de las fotos informadas por Alegra se pudo obtener, **When** se abre el informe, **Then** aparece una advertencia destacada que indica que probablemente es un problema general (conexión o enlaces de Alegra) y no de cada producto.
3. **Given** un producto sin foto utilizable (con o sin foto en Alegra), **When** se genera el catálogo, **Then** queda fuera del PDF y figura en el informe; no se dibuja ninguna imagen de respaldo.
4. **Given** el informe, **When** lo lee una persona sin conocimientos técnicos, **Then** los motivos están en español claro, sin códigos ni jerga técnica, y no se muestran direcciones firmadas ni credenciales.

---

### User Story 3 - Los agotados conservan su foto y todas las fotos se ven bien (Priority: P3)

Un producto agotado sigue mostrando su foto con la indicación AGOTADO encima, y todas las fotos llenan su recuadro sin deformarse, sea cual sea su proporción y la plantilla elegida. Esta historia verifica que la corrección no rompe lo que ya funciona, ahora que por primera vez llegarán fotos reales de Alegra.

**Why this priority**: lo cubren las features anteriores con fotos de prueba; aquí solo se evita una regresión al llegar fotos reales (hasta ~2 MB, JPG y PNG, de proporciones variadas).

**Independent Test**: generar un catálogo con productos agotados, disponibles y fotos verticales, horizontales y cuadradas, con cada plantilla base, y revisar visualmente todas las páginas.

**Acceptance Scenarios**:

1. **Given** un producto agotado con foto, **When** se genera el catálogo con cualquiera de los tres estilos de agotado (sello, cinta, gris), **Then** se ve la foto del producto y la indicación AGOTADO visible encima.
2. **Given** fotos verticales, horizontales y cuadradas, **When** se genera el catálogo, **Then** cada foto llena su recuadro sin deformarse y sin dejar zonas vacías.
3. **Given** un catálogo completo generado, **When** se revisan todas sus páginas, **Then** ningún recuadro de producto aparece vacío ni con un ícono de imagen rota.

---

### User Story 4 - Cada tarjeta muestra el nombre y la descripción del producto (Priority: P2)

Cada producto del catálogo muestra su foto, su **nombre** y, si la tiene, su **descripción** (FR-010 de `001`). Hasta ahora, un producto de Alegra con descripción mostraba *solo* la descripción: con las fotos de Alegra llegando por primera vez, esto dejó a los productos con una nota en la descripción (por ejemplo, una nota sobre el valor de envío) sin nombre en la tarjeta.

**Why this priority**: lo pidió el responsable al revisar el catálogo real. Un cliente que ve una foto y una nota de envío, sin nombre, no sabe qué producto es. Antes no se notaba porque ninguna foto de Alegra llegaba al catálogo.

**Independent Test**: dibujar una página con un producto de Alegra con descripción, otro sin descripción, un producto propio y un combo; todos muestran su nombre y los que tienen descripción la muestran debajo del nombre.

**Acceptance Scenarios**:

1. **Given** un producto de Alegra con descripción, **When** se genera el catálogo, **Then** la tarjeta muestra el nombre y, debajo, la descripción.
2. **Given** un producto de Alegra sin descripción, **When** se genera el catálogo, **Then** la tarjeta muestra el nombre y ninguna descripción vacía.
3. **Given** un producto propio o un combo, **When** se genera el catálogo, **Then** sigue mostrando su nombre y, si la tiene, su descripción (sin cambios).
4. **Given** nombre y descripción muy largos, **When** se genera el catálogo, **Then** el texto se ajusta dentro de la tarjeta sin desbordarla (reglas de ajuste existentes de `003`).
5. **Given** un producto agotado con descripción, **When** se genera el catálogo, **Then** la tarjeta conserva la foto, el nombre, la descripción y la indicación AGOTADO.

---

### Edge Cases

- Producto con varias fotos donde la favorita no es la primera (caso real: 4 de 4): se usa la favorita.
- Producto con varias fotos marcadas como favoritas: se usa la primera marcada.
- La foto favorita tiene el enlace vacío o no es una dirección web válida: se prueban las demás fotos en orden.
- El enlace de la foto ya venció o el almacenamiento rechaza el acceso: la foto se considera no obtenible, con motivo "no autorizada o vencida".
- El enlace responde pero lo recibido no es una imagen (por ejemplo, una página de error), está vacío o está corrupto: no se acepta, con motivo "no es una imagen".
- La foto supera el tamaño máximo permitido o tarda más del tiempo límite: no se acepta, con el motivo correspondiente. Las fotos reales llegan hasta ~2 MB.
- La foto tiene un formato fuera de los admitidos (JPG, PNG, WebP, GIF): no se acepta, con motivo "formato no admitido".
- El servidor de la foto responde con error propio o no se puede alcanzar: no se acepta, con motivo "servidor de la foto no disponible".
- Variantes sin foto propia (11 de los 16 productos sin foto): quedan fuera por la regla vigente; no se usa la foto del producto padre. Los dos padres con variantes tampoco tienen foto, así que no hay nada que heredar.
- Un producto agotado sin foto: queda fuera del PDF como cualquier producto sin foto.
- Foto con más de una hora en la copia local: se vuelve a descargar (comportamiento actual, no cambia).
- Alegra responde con límite de peticiones al listar: se espera y se reintenta (comportamiento actual); si no se logra, se aborta sin PDF parcial.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST determinar, para cada producto activo de Alegra, si Alegra informa al menos una foto, y MUST obtener la foto elegida para usarla en el catálogo.
- **FR-002**: El sistema MUST leer las fotos de la propia consulta general de productos, sin consultas adicionales por producto, de modo que preparar el catálogo no agregue esperas relevantes.
- **FR-003**: El sistema MUST elegir la foto de un producto así: la marcada como favorita; si ninguna lo está, la primera de la lista; si hay varias marcadas, la primera marcada.
- **FR-004**: Si la foto elegida no es utilizable (enlace vacío o inválido, descarga fallida, no es una imagen), el sistema MUST probar las demás fotos del mismo producto en orden antes de darlo por "sin foto utilizable".
- **FR-005**: El sistema MUST aceptar una foto válida en formato JPG, PNG, WebP o GIF aunque su origen declare un tipo de archivo genérico o incorrecto, reconociéndola por su contenido. En la cuenta real el 100 % de las fotos llega declarada con un tipo genérico.
- **FR-006**: La descarga de cada foto MUST tener un tiempo límite y un tamaño máximo, y el fallo de una foto MUST NOT detener la preparación del resto de productos.
- **FR-007**: El informe de revisión MUST distinguir y contar por separado (a) los productos sin foto en Alegra y (b) los productos con foto en Alegra que no se pudo obtener, listando los productos de cada grupo y, en el grupo (b), el motivo de cada uno: no autorizada o vencida, no encontrada, tiempo agotado, no es una imagen, demasiado grande, formato no admitido o servidor de la foto no disponible. El informe y los registros MUST NOT mostrar direcciones firmadas de fotos ni credenciales.
- **FR-008**: Cuando ninguna de las fotos informadas por Alegra se pueda obtener, el informe MUST mostrar una advertencia destacada que lo identifique como un probable problema general.
- **FR-009**: Un producto de Alegra sin foto utilizable MUST quedar fuera del PDF y figurar en el informe de revisión con su motivo. El sistema MUST NOT dibujar una imagen de respaldo (regla vigente: FR-012 de 001 y principio II de la constitución).
- **FR-010**: Un producto agotado con foto MUST conservar su foto con la indicación AGOTADO visible encima, en cualquiera de los estilos de agotado de la plantilla.
- **FR-011**: La foto MUST llenar el recuadro del producto sin deformarse (recorte proporcional) en cualquier plantilla y cualquier proporción de foto.
- **FR-012**: El PDF MUST NOT dibujarse hasta que todas las fotos de los productos incluidos estén listas, y ningún recuadro de producto del PDF puede quedar vacío ni mostrar un ícono de imagen rota.
- **FR-013**: La documentación de integración con Alegra MUST actualizarse con la estructura real verificada de las fotos (`id`, `name`, `url`, `favorite`; sin `isPrimary` ni `attachments`; presentes en la consulta general; descarga con tipo genérico; enlaces con vencimiento de unos 7 días), con ejemplos ficticios, y MUST retirar la mención de una imagen de respaldo.
- **FR-014**: El sistema MUST obtener las fotos únicamente con servicios de lectura de Alegra. MUST NOT usar los servicios que suben, editan o eliminan adjuntos o imágenes de un producto (principio I).
- **FR-015**: Los enlaces de las fotos que entrega Alegra son temporales. El sistema MUST descargar cada foto durante la misma preparación en la que obtiene su enlace, y MUST NOT reutilizar enlaces guardados de una preparación anterior.
- **FR-016**: Cada regla de este documento (FR-003 a FR-012, FR-014, FR-015 y FR-017) MUST tener pruebas automatizadas con respuestas simuladas de Alegra que imiten la forma real verificada (fotos con `favorite`, descarga con tipo genérico), nunca contra la cuenta real.

- **FR-017**: Cada tarjeta de producto MUST mostrar el nombre del producto y, si la tiene, su descripción debajo del nombre, para productos de Alegra, propios y combos (FR-010 de `001`). Un producto de Alegra con descripción MUST NOT mostrar solo la descripción.

### Key Entities *(include if feature involves data)*

- **Producto de Alegra**: ítem activo con identificador, nombre, precio, estado de inventario y una lista ordenada de fotos (puede estar vacía).
- **Foto del producto en Alegra**: identificador, nombre, dirección web firmada de la imagen e indicador de favorita.
- **Foto obtenida**: copia local de la foto elegida, lista para dibujarse en el catálogo; está asociada a un único producto.
- **Estado de la foto de un producto**: uno de tres valores: obtenida, sin foto en Alegra, o con foto en Alegra pero no obtenida (con su motivo).
- **Informe de revisión**: resumen previo a generar; se amplía con la separación de productos sin foto y con foto no obtenida, sus motivos y la advertencia general.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al generar con la cuenta real de la tienda, al menos el 95 % de los productos activos con foto en Alegra (hoy 181 de 197) aparecen con su foto en el PDF. Punto de partida: 0.
- **SC-002**: El 100 % de los productos que quedan fuera del PDF por falta de foto aparecen en el informe de revisión con su causa: sin foto en Alegra, o foto no obtenida con su motivo.
- **SC-003**: Un responsable sin conocimientos técnicos identifica en menos de 1 minuto, solo con el informe y sin abrir archivos de registro, cuántos productos no muestran foto y por qué.
- **SC-004**: En la revisión visual de todas las páginas de un catálogo completo, 0 recuadros de producto vacíos, rotos o deformados.
- **SC-005**: El 100 % de los productos agotados con foto muestran la foto y la indicación AGOTADO, con los tres estilos de agotado.
- **SC-006**: Con hasta 200 productos el PDF sigue listo en menos de 2 minutos (meta de `001`).
- **SC-007**: En el 100 % de los productos con varias fotos de la cuenta real, el PDF muestra la foto favorita.
- **SC-008**: El 100 % de las tarjetas del catálogo muestran el nombre del producto, y el 100 % de las que tienen descripción la muestran debajo del nombre, sin texto cortado ni desbordado.

## Assumptions

- Los nombres de módulos y archivos de la descripción no coinciden con los del proyecto actual (que vive bajo `backend/` y `frontend/`); esta spec describe comportamiento y el plan los traducirá a los módulos reales.
- La estructura de las fotos se tomó de la verificación con la cuenta real del 4-oct-2026, no de la documentación oficial de Alegra, que no define la estructura de `images`, no documenta la marca de favorita y habla de enlaces de 30 minutos. Si Alegra cambia la forma, el informe de revisión (Historia 2) lo hará visible como una advertencia general.
- La verificación fue manual, de solo lectura y hecha con la conexión que la app ya tiene guardada (principios I, III y V). La sonda usada es desechable y no forma parte del producto; las pruebas automatizadas nunca tocan la cuenta real.
- Las fotos ya se descargan a una copia local antes de dibujar el PDF; esa arquitectura se conserva. La conversión a Base64 no es necesaria.
- El aspecto de la tarjeta de producto (recuadro, borde, recorte, indicación AGOTADO) lo define la plantilla activa (003). Las clases de estilo propuestas en la descripción no se aplican literalmente; solo se garantiza que la foto llega bien y se ve completa. La única excepción es qué texto lleva la tarjeta: nombre y descripción (Historia 4).
- Los productos propios y los combos ya exigen una imagen subida por la persona; no cambian.
- Los 14 productos reales sin foto (excluidos los 2 padres de variantes) seguirán fuera del PDF; si la tienda quiere mostrarlos, debe cargar la foto en Alegra.
- Escala de referencia: hasta unos 200 productos, como en `001` (la cuenta real tiene 197 activos).
