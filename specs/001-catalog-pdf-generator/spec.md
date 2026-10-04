# Feature Specification: Generador de Catálogo PDF ASIANPOP MARKET+

**Feature Branch**: `001-catalog-pdf-generator` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`)

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Aplicación web local que genera el catálogo PDF de ASIANPOP MARKET+ a partir de los productos de Alegra y de productos propios (mochis, combos de regalo), replicando el diseño de `docs/Cat.pdf`. Documento base: `docs/Alegra integracion.md`. Decisiones adicionales: en combos se permiten precio fijo y descuento, y si un componente está agotado se alerta para mantener el sello de agotado u omitir el combo; los ítems sin imagen no se incluyen en el catálogo; la generación es manual; el servicio es una página web en localhost; el acceso es un login básico con datos semilla que no cambian."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar el catálogo PDF desde Alegra (Priority: P1)

El administrador de la tienda entra a la página web local, conecta su cuenta de Alegra y pulsa "Generar catálogo". El sistema toma los productos activos de Alegra, los agrupa por categoría y produce un PDF con el diseño de `Cat.pdf`: portada, portada por sección, páginas de producto (máximo 3 por página), sello **AGOTADO** en productos sin inventario y página de políticas. El usuario descarga el PDF.

**Why this priority**: es el valor central del sistema; con solo esta historia ya se reemplaza la elaboración manual del catálogo.

**Independent Test**: con credenciales válidas de Alegra y productos en al menos dos categorías, generar el catálogo y comprobar que el PDF tiene portada, una portada por categoría, páginas de máximo 3 productos con foto, nombre, descripción y precio, y la página de políticas.

**Acceptance Scenarios**:

1. **Given** credenciales de Alegra válidas y productos activos en varias categorías, **When** el usuario pulsa "Generar catálogo", **Then** obtiene un PDF A4 con portada, una portada por cada categoría con productos y páginas de máximo 3 productos cada una.
2. **Given** un producto con inventario en cero, **When** se genera el catálogo, **Then** su tarjeta muestra el sello AGOTADO.
3. **Given** un producto sin imagen en Alegra, **When** se genera el catálogo, **Then** ese producto no aparece en el PDF.
4. **Given** una categoría sin productos elegibles, **When** se genera el catálogo, **Then** no se incluye su portada de sección.
5. **Given** un producto que no controla inventario, **When** se genera el catálogo, **Then** se muestra como disponible.
6. **Given** que el usuario elige ocultar agotados, **When** se genera el catálogo, **Then** los productos agotados no aparecen.

---

### User Story 2 - Acceso con login básico (Priority: P1)

El usuario abre la página web en su computador (localhost) y debe iniciar sesión con un usuario y contraseña predefinidos (datos semilla fijos) para acceder a cualquier función.

**Why this priority**: protege las credenciales de Alegra y las funciones de administración desde la primera versión.

**Independent Test**: sin sesión, cualquier pantalla redirige al login; con los datos semilla se accede, y con datos incorrectos se rechaza el ingreso.

**Acceptance Scenarios**:

1. **Given** que no hay sesión iniciada, **When** el usuario intenta abrir cualquier pantalla, **Then** se le muestra el login.
2. **Given** el usuario y la contraseña semilla, **When** los ingresa, **Then** accede al sistema.
3. **Given** credenciales incorrectas, **When** intenta ingresar, **Then** ve un mensaje de error sin revelar cuál dato falló.
4. **Given** una sesión iniciada, **When** pulsa "Cerrar sesión", **Then** vuelve al login.

---

### User Story 3 - Configurar y probar la conexión con Alegra (Priority: P1)

El usuario ingresa o actualiza el correo y el token de Alegra desde la página, prueba la conexión y solo se guardan si la prueba es exitosa. El token nunca se muestra después de guardarlo.

**Why this priority**: sin conexión a Alegra no hay catálogo; debe poder cambiarse sin tocar archivos de configuración.

**Independent Test**: ingresar credenciales válidas y confirmar que se guardan; ingresar inválidas y confirmar que se rechazan sin reemplazar las anteriores.

**Acceptance Scenarios**:

1. **Given** credenciales válidas, **When** el usuario las guarda, **Then** el sistema confirma la conexión y las usa en la siguiente generación.
2. **Given** credenciales inválidas, **When** intenta guardarlas, **Then** se rechazan con un mensaje claro y se conservan las anteriores.
3. **Given** credenciales guardadas, **When** el usuario abre la configuración, **Then** ve el correo y el estado de conexión, pero nunca el token.

---

### User Story 4 - Resolver ítems sin categoría (Priority: P2)

Si algún producto de Alegra no tiene categoría, el sistema muestra una alerta con la lista de esos ítems para que el usuario les asigne una sección. La asignación vale para el catálogo y no modifica Alegra.

**Why this priority**: evita que productos válidos queden fuera del catálogo sin que nadie lo note.

**Independent Test**: con un ítem sin categoría en Alegra, comprobar que aparece la alerta, asignarle una sección y verificar que sale en esa sección del PDF.

**Acceptance Scenarios**:

1. **Given** ítems sin categoría, **When** el usuario entra al panel o intenta generar, **Then** ve una alerta con la cantidad y la lista de ítems.
2. **Given** un ítem sin categoría, **When** el usuario le asigna una sección, **Then** el ítem aparece en esa sección del siguiente catálogo.
3. **Given** ítems aún sin sección, **When** se genera el catálogo, **Then** quedan fuera del PDF y el sistema avisa cuántos se omitieron.

---

### User Story 5 - Gestionar secciones y productos propios (Priority: P2)

El usuario crea, edita y elimina secciones y productos que no existen en Alegra, por ejemplo MOCHIS (elaborados bajo pedido, con sabores y cajas de distinto tamaño y precio) o REGALOS. Estos aparecen en el catálogo junto con los de Alegra.

**Why this priority**: el catálogo actual incluye mochis, que no existen en Alegra; sin esto el PDF generado quedaría incompleto.

**Independent Test**: crear la sección MOCHIS con un producto con sabores y dos cajas, generar el catálogo y comprobar que aparece con sus opciones y precios y sin sello AGOTADO.

**Acceptance Scenarios**:

1. **Given** una sección propia con un producto elaborado, **When** se genera el catálogo, **Then** aparece con sus sabores, opciones de caja y precios.
2. **Given** un producto propio, **When** se genera el catálogo, **Then** nunca muestra sello AGOTADO.
3. **Given** un producto propio sin imagen, **When** se genera el catálogo, **Then** queda fuera del PDF.
4. **Given** una sección propia eliminada, **When** se genera el catálogo, **Then** no aparece.
5. **Given** que se define el orden de las secciones, **When** se genera el catálogo, **Then** las secciones de Alegra y propias aparecen en ese orden.

---

### User Story 6 - Crear combos de regalo con descuento (Priority: P3)

El usuario crea un combo compuesto por varios productos (de Alegra o propios) con cantidades. El precio del combo puede ser un **precio fijo** o un **porcentaje de descuento** sobre la suma de sus componentes.

**Why this priority**: amplía la oferta comercial, pero el catálogo ya es útil sin combos.

**Independent Test**: crear un combo de 3 productos con 10 % de descuento y comprobar que el PDF muestra el precio calculado; repetir con precio fijo.

**Acceptance Scenarios**:

1. **Given** un combo con descuento porcentual, **When** se genera el catálogo, **Then** el precio mostrado es la suma de los componentes menos el porcentaje.
2. **Given** un combo con precio fijo, **When** se genera el catálogo, **Then** se muestra ese precio.
3. **Given** un combo con algún componente agotado, **When** el usuario va a generar el catálogo, **Then** el sistema muestra una alerta por combo y el usuario elige entre **mantener el combo con sello AGOTADO** u **omitirlo del catálogo**.
4. **Given** un combo sin imagen propia, **When** se genera el catálogo, **Then** queda fuera, igual que cualquier ítem sin imagen.

---

### Edge Cases

- Alegra no responde, rechaza las credenciales o limita las peticiones: el usuario ve un mensaje claro y no se genera un PDF parcial.
- Hay más productos que el tamaño de una consulta de Alegra: el catálogo incluye todos, no solo los primeros.
- Una categoría tiene 1, 2, 3 o 4 productos: la última página puede tener menos de 3 sin romper el diseño (`Cat.pdf`, pág. 33).
- Un precio, nombre o descripción es muy largo: no desborda la tarjeta ni la hoja.
- Un combo referencia un producto de Alegra eliminado o inactivo: el sistema alerta y trata el combo como no disponible.
- Se pulsa "Generar" dos veces seguidas: no se producen dos generaciones simultáneas.
- Un ítem de Alegra está sin categoría y sin imagen: se informa por ambas razones.
- Todas las secciones quedan vacías: el sistema informa que no hay nada que generar en vez de producir un PDF vacío.
- Los productos de Alegra con presentaciones distintas (unidad o paquete) se tratan como ítems independientes hasta definir otra cosa.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso**
- **FR-001**: El sistema MUST ser una página web accesible solo desde el computador local del usuario.
- **FR-002**: El sistema MUST exigir inicio de sesión con un usuario y contraseña semilla fijos, y MUST NOT permitir cambiarlos desde la aplicación.
- **FR-003**: El sistema MUST proteger todas las pantallas y acciones detrás del login y permitir cerrar sesión.
- **FR-004**: El mensaje de error del login MUST NOT indicar cuál dato fue incorrecto.

**Conexión con Alegra**
- **FR-005**: El usuario MUST poder ingresar y actualizar el correo y el token de Alegra desde la página, sin reiniciar la aplicación.
- **FR-006**: El sistema MUST validar la conexión antes de guardar nuevas credenciales y MUST conservar las anteriores si la validación falla.
- **FR-007**: El sistema MUST guardar el token de forma protegida y MUST NOT mostrarlo ni registrarlo en bitácoras una vez guardado.
- **FR-008**: El sistema MUST obtener todas las categorías y todos los productos activos de Alegra, aunque excedan el tamaño de una sola consulta.

**Reglas del catálogo**
- **FR-009**: El sistema MUST agrupar los productos por categoría y mostrar como máximo 3 productos por página.
- **FR-010**: Cada producto MUST mostrar imagen, nombre, descripción y precio en formato de pesos colombianos (por ejemplo `$9.000`).
- **FR-011**: El sistema MUST marcar con sello AGOTADO los productos de Alegra con inventario en cero o menor, y MUST tratar como disponibles los que no controlan inventario.
- **FR-012**: El sistema MUST excluir del catálogo los productos (de Alegra, propios o combos) sin imagen e informar cuántos se omitieron y cuáles.
- **FR-013**: El sistema MUST omitir las categorías sin productos elegibles.
- **FR-014**: El usuario MUST poder elegir, por generación, mostrar los agotados con sello o excluirlos.
- **FR-015**: El usuario MUST poder definir el orden de las secciones, por defecto: RAMEN, TTEOKBOKKI, SNACKS, DULCES, BEBIDAS, MOCHIS.

**Ítems sin categoría**
- **FR-016**: El sistema MUST mostrar una alerta con la lista de productos de Alegra sin categoría y permitir asignarles una sección.
- **FR-017**: Las asignaciones MUST guardarse solo en el sistema y MUST NOT modificar Alegra.
- **FR-018**: Los ítems sin sección asignada MUST quedar fuera del PDF, informando cuántos.

**Productos y secciones propios**
- **FR-019**: El usuario MUST poder crear, editar y eliminar secciones propias y productos propios que no existen en Alegra.
- **FR-020**: Un producto propio MUST poder tener nombre, descripción, imagen, un precio o varias opciones con precio (por ejemplo "Caja x 6" y "Caja x 12"), sabores y un máximo de sabores por opción.
- **FR-021**: Los productos propios MUST NOT mostrar sello AGOTADO.
- **FR-022**: Las secciones propias MUST aparecer en el catálogo con el mismo diseño de portada y páginas que las de Alegra.

**Combos**
- **FR-023**: El usuario MUST poder crear combos con varios productos (de Alegra o propios) y cantidades.
- **FR-024**: El precio de un combo MUST poder definirse como precio fijo o como porcentaje de descuento sobre la suma de sus componentes, y el usuario MUST poder elegir cualquiera de los dos.
- **FR-025**: Antes de generar, el sistema MUST alertar por cada combo con algún componente agotado y MUST permitir elegir entre mantener el combo con sello AGOTADO u omitirlo del catálogo.
- **FR-026**: La alerta de FR-025 MUST aparecer cada vez que se genere el catálogo mientras el componente siga agotado.

**Generación**
- **FR-027**: La generación MUST iniciarse solo de forma manual desde la página.
- **FR-028**: El PDF MUST tener formato A4, incluir portada con nombre y teléfonos de la tienda, portada por sección, páginas de producto, y una página final de políticas de compra y conservación.
- **FR-029**: El diseño MUST replicar la identidad visual de `docs/Cat.pdf` (fondo oscuro con acentos neón, sello AGOTADO, pie de página con teléfonos y dirección).
- **FR-030**: El usuario MUST poder descargar el PDF generado y MUST ver el progreso o el estado mientras se genera.
- **FR-031**: El sistema MUST impedir dos generaciones simultáneas.
- **FR-032**: El sistema MUST conservar un historial de los últimos PDF generados con fecha y hora.

### Key Entities

- **Usuario**: cuenta única con credenciales fijas de acceso.
- **Conexión Alegra**: correo, token protegido, estado y fecha de la última prueba.
- **Producto de Alegra**: nombre, descripción, precio, imagen, categoría, inventario y estado (leído de Alegra, no editable aquí).
- **Categoría / Sección**: nombre y orden; puede provenir de Alegra o ser propia.
- **Asignación de sección**: relación local entre un producto de Alegra sin categoría y una sección.
- **Producto propio**: nombre, descripción, imagen, precio u opciones con precio, sabores y máximo de sabores por opción; sin inventario.
- **Combo**: nombre, descripción, imagen, componentes con cantidad y regla de precio (fijo o descuento).
- **Catálogo generado**: archivo PDF, fecha y hora, parámetros usados y cantidad de ítems incluidos y omitidos.
- **Configuración del negocio**: nombre, teléfonos, dirección y texto de políticas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario genera el catálogo completo en menos de 5 clics desde que inicia sesión.
- **SC-002**: Con hasta 200 productos, el PDF está listo en menos de 2 minutos.
- **SC-003**: El 100 % de los productos con inventario en cero muestran el sello AGOTADO, y ningún producto propio lo muestra.
- **SC-004**: Ninguna página de producto tiene más de 3 productos ni contenido cortado o desbordado.
- **SC-005**: El 100 % de los productos sin imagen quedan fuera del PDF y el usuario recibe la lista de omitidos.
- **SC-006**: Un usuario sin conocimientos técnicos crea un producto propio con opciones y lo ve en el catálogo en menos de 5 minutos.
- **SC-007**: Un cambio de credenciales de Alegra se aplica sin reiniciar la aplicación.
- **SC-008**: El PDF generado coincide con `docs/Cat.pdf` en estructura (portada, portadas de sección, páginas de producto, políticas), validado por revisión visual del responsable de la tienda.
- **SC-009**: Sin sesión iniciada, el 100 % de las pantallas y acciones rechazan el acceso.

## Assumptions

- Un único usuario (administrador de la tienda) usa el sistema, en su propio computador; no hay roles ni multiusuario.
- El sistema solo se usa en el equipo local; no se expone a internet.
- El usuario y la contraseña semilla se definen una vez al instalar y no cambian; su valor se documenta fuera de la spec.
- La cuenta de Alegra ya tiene los productos, precios, imágenes y categorías; el sistema los lee pero no los modifica.
- Cada presentación (unidad o paquete) se trata como un ítem independiente de Alegra hasta que se investigue la API y se decida otro tratamiento.
- Actualizar la categoría de un ítem directamente en Alegra queda fuera de esta versión.
- La generación periódica o programada queda fuera de esta versión; se evaluará después.
- Los productos propios (por ejemplo, mochis) se identifican siempre como bajo pedido, sin inventario, y requieren imagen para aparecer.
- El idioma de la interfaz y del catálogo es español, y los precios usan pesos colombianos.
- Los textos de políticas, teléfonos y dirección provienen de `Cat.pdf` y se pueden editar en la configuración del negocio.
- Se necesita conexión a internet para consultar Alegra y descargar imágenes durante la generación.
