# Research: Plantilla «Base AsianPop» y foto-tarjeta generada

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Fecha**: 2026-10-22

Se resuelven las decisiones de diseño antes de escribir tareas. No quedan `NEEDS CLARIFICATION`. Las medidas de la base salen de `docs/specs/canva-base-template-spec.md`; todo lo que allí figura como «no verificado» se trata aquí como supuesto explícito.

## R1. Qué es la foto-tarjeta y qué se dibuja dónde

**Decision**: la tarjeta es **una imagen JPEG por producto** compuesta en el servidor con `sharp`, y **el nombre se dibuja en neón como texto vectorial por encima** (en el componente `ProductsBlock`), nunca dentro de la imagen. La imagen reserva una **franja superior libre del 18 % del alto** donde va el nombre; el producto ocupa el resto.

**Rationale**:
- Un nombre horneado en el JPEG se vería borroso al imprimir, no sería buscable y obligaría a regenerar la imagen con cada cambio de fuente o color; como texto vectorial hereda `useFit` (reduce hasta 6 pt y parte en líneas) y sale nítido en el PDF.
- Una sola imagen por producto mantiene el peso bajo (R6) y el mecanismo igual al de la feature 005 (el payload cambia `imageUrl`).
- La franja reservada evita que el nombre tape el producto, cualquiera sea la foto.

**Alternatives considered**: hornear el nombre en la imagen (como la base de Canva) → texto no buscable, caché que depende del nombre, peor calidad impresa. Componer todo con CSS en el navegador (desenfoque con `filter: blur`) → Chrome rasteriza los filtros al imprimir y el PDF engorda; además el fondo desenfocado necesita la foto dos veces.

## R2. Quitar el fondo sin servicios externos (FR-008, FR-008a)

**Decision**: algoritmo propio sobre `sharp`, pensado para las fotos de producto de Alegra (fondo casi liso):

1. Trabajar en una copia reducida (lado mayor ≤ 320 px).
2. Tomar el **color modal del borde** (anillo de 3 px, cuantizado a 16 niveles por canal).
3. Aceptar solo si **≥ 80 %** del borde está a distancia RGB ≤ 28 de ese color (fondo liso).
4. **Rellenar desde el borde** (4-conexo) todo lo que esté a distancia ≤ 34: eso es el fondo.
5. Verificar la **confianza**: el producto ocupa entre **6 % y 88 %** de la imagen; **≤ 5 %** del anillo exterior pertenece al producto (si no, está cortado por el borde; con 25 % una lata cortada por abajo que ocupa el 43 % del ancho pasaba como entera, así que en la implementación el umbral es 5 %: ante la duda, marco); el componente conexo mayor del producto reúne **≥ 85 %** del total (si no, hay varios productos o un combo).
6. Suavizar el borde (la máscara se escala a la foto original con interpolación cúbica, se desenfoca 1 px y se aprieta con un umbral de 0,4–0,8 para quitar el halo blanco del borde) y recortar al contorno del producto.
7. Si **cualquier** comprobación falla, esa foto usa el modo «Dejar como está» y se anota para el informe (FR-008a).

**Rationale**: las fotos de Alegra son de empaque sobre fondo blanco o liso en su mayoría; el relleno desde el borde acierta en esos casos y las comprobaciones convierten los casos difíciles (combos, empaque blanco sobre blanco, producto cortado) en «modo seguro» en lugar de un recorte roto (SC-010). Es determinista (FR-004) y sin dependencias nuevas.

**Alternatives considered**: modelo de segmentación (U²-Net por ONNX o `@imgly/background-removal-node`) → ~40–170 MB, binario nativo y descarga de pesos, y resultados no siempre idénticos entre versiones; queda como **mejora futura** detrás de la misma función `composeCard`. Servicios de pago → fuera de alcance por el supuesto de privacidad. Pedir un recorte manual por producto → contradice «sin trabajo manual».

**Riesgo conocido**: umbrales calibrados con fotos sintéticas; se ajustan en la validación con fotos reales sin guardar datos privados (quickstart §6). Una foto con sombra proyectada oscura puede quedar con un halo gris: aceptable porque el fondo de la tarjeta es oscuro.

## R3. Dónde y cuándo se componen las tarjetas

**Decision**: **de forma perezosa en el endpoint del payload** (`GET /catalog/payload/:prepareId`), con una **caché en disco** (`data/card-cache/<sha1>.jpg`) que se vacía al arrancar el servidor, y solo cuando la plantilla elegida tiene un bloque de productos con `cardStyle: 'tarjeta'`. Clave de caché: foto (contenido), modo, tamaño del recuadro en píxeles, color de fondo de la tarjeta y versión del algoritmo. Concurrencia 4, igual que `PhotoOptimizer`.

**Rationale**: el payload ya es el único canal que llega a la vista previa, al editor y al PDF (comentario de `catalog.routes.ts`), y la plantilla se **refresca** en cada petición (puede cambiar el tamaño o el color después de preparar), así que la tarjeta tiene que depender de la plantilla vigente y no de la preparación. La caché hace que solo la primera apertura pague.

**Alternatives considered**: componer al preparar → la plantilla puede cambiar después y las tarjetas quedarían viejas. Componer solo en el trabajo de PDF → la vista previa mostraría fotos sin tarjeta y violaría la constitución IV (editor, vista previa y PDF deben coincidir).

## R4. Geometría de la distribución `base`

**Decision**: nueva distribución `base` en `layoutRows`, expresada como fracción de la **hoja** (el bloque de productos de la plantilla Base AsianPop abarca toda la hoja útil, de modo que W = 21 cm y H = 29,7 cm):

| Pieza | Fila izquierda (1 y 3) | Fila derecha (2) | Origen |
| --- | --- | --- | --- |
| Foto-tarjeta (ancho × alto) | 6,10 × 8,03 cm (29,05 % × 27,04 %) | igual | medido |
| Foto, X | 3,14 cm (14,95 %) | ≈ 10,60 cm (50,5 %) | izquierda medido; derecha estimado de captura |
| Foto, Y | 3,3 · — · 20,37 cm | ≈ 11,8 cm | fila 3 medida; filas 1 y 2 estimadas de captura (paso ≈ 8,5 cm) |
| Burbuja (ancho × alto) | 10,58 × 5,13 cm (50,4 % × 17,3 %) | igual | medido |
| Burbuja, X | 6,55 cm | ≈ 2,70 cm | izquierda medido; derecha por simetría de solape (2,69 cm bajo la foto) |
| Burbuja, Y | foto Y + 1,55 cm | igual | medido (fila 3) |
| Pastilla de precio (ancho × alto) | 3,45 × 1,08 cm, justo bajo la burbuja (Y = burbuja Y + 5,13) | igual | medido |
| Pastilla, centro X | 12,63 cm | ≈ 7,0 cm | izquierda medido; derecha estimado de captura |

**Rationale**: SC-001 pide 2 mm de tolerancia solo para la página medida; las posiciones estimadas (marcadas) se **confirman con REA** (Posición → Capas → Organizar de las tarjetas 1 y 2 de la página 3) antes de dar la tarea por terminada, una medición breve y repetible. Con 0, 1 o 2 productos, las filas se **centran verticalmente** en la hoja útil (FR-015) en lugar de dejar huecos.

**Alternatives considered**: reutilizar `alternado` con `photoW`/`photoH` → cambiaría Neón Noche. Posicionar cada elemento como elemento libre → rompe «bloque automático» y la paginación por producto.

## R5. Neón del precio y de la cinta; sombra y contorno

**Decision**: el neón de Canva (intensidad 100 y 50) se aproxima con `text-shadow` apilado y se **calibra mirando lado a lado** con las capturas de la base (no hay equivalencia numérica):

| Elemento | Intensidad Canva | `text-shadow` inicial (se ajusta en la validación) |
| --- | --- | --- |
| Precio | 100 | `0 0 4px c, 0 0 10px c, 0 0 20px c` |
| Cinta AGOTADO | 50 | `0 0 3px c, 0 0 8px c` |
| Nombre en la tarjeta | (ya existe `nameGlow`) | `glowName` actual |

Nuevos campos opcionales del bloque: `priceGlow`, `soldGlow` (booleanos) y `bubbleShadow` (sombra suave bajo la burbuja, en lugar de la **imagen** «Circular Blur Shadow» de la base).

**Rationale**: las sombras de texto se rasterizan en trozos pequeños y no inflan el PDF; una imagen de sombra por burbuja (como hace la base) sumaría ~180 imágenes. La sombra como `box-shadow` da el mismo efecto sin peso.

**Alternatives considered**: imagen de sombra aparte como en Canva → peso y ~180 recursos. Filtro `drop-shadow` en el contenedor → Chrome rasteriza el filtro sobre áreas grandes al imprimir.

## R6. Presupuesto de peso del PDF (FR-023, SC-005)

**Decision**: tarjeta a **150 ppp** del recuadro (≈ 360 × 474 px), JPEG calidad 88 y submuestreo 4:4:4 (los mismos parámetros medidos en la 005). Estimado ≈ **40–60 KB por tarjeta** (fondo desenfocado oscuro comprime muy bien) → 180 tarjetas ≈ **8–11 MB**, más el resto del catálogo (portadas, mármol, texto) ≈ 3–6 MB: **< 25 MB**. Se **mide** en la validación con fotos sintéticas del mismo tamaño que las reales; si superara el objetivo, la calidad baja a 82 antes de tocar nada más.

**Rationale**: el cuello de botella del PDF son los píxeles de las fotos (research de la 005 §0); una tarjeta ya viene del tamaño exacto, así que `image-optimizer` no necesita tocarla (su patrón solo reconoce `/media/cache` y `/media/uploads`, y las tarjetas viven en `/media/cards`).

**Alternatives considered**: PNG con transparencia para el modo «sin fondo» → 3–5 veces más pesado. Por eso el recorte se **aplana sobre el color oscuro de la tarjeta** y se guarda como JPEG.

## R7. Dónde vive la preferencia «Fondo de la foto» (FR-008b)

**Decision**: es una **opción de la generación**, junto a la calidad del PDF: `photoBackdrop: 'marco' | 'sin-fondo'` (por defecto `marco`, que equivale a «Dejar como está»). Se envía al preparar/generar, se guarda con las opciones de la generación y se recuerda la última elección (misma persistencia que ya usa la elección de plantilla). Solo se muestra en la pantalla **Generar** cuando la plantilla elegida tiene `cardStyle: 'tarjeta'`.

**Rationale**: no es propiedad de la plantilla (un mismo diseño puede salir con cualquiera de los dos fondos) y debe verse antes de generar con una **tarjeta de ejemplo** (FR-008c) que usa el primer producto con foto del catálogo preparado.

**Alternatives considered**: guardarla en la plantilla → cambiar de modo obligaría a editar y guardar la plantilla; mezclaría diseño con preferencia de la corrida.

## R8. Tipografías

**Decision**: título, descripción y precio en **Poppins** (pesos 400–700 ya incluidos en `fonts.css`; la base usa negrita = 700). La cinta AGOTADO usa **Poppins 700** en lugar de Open Sans, porque Open Sans **no está** entre las seis familias del editor y la spec permite «la más cercana disponible» sin agregar familias.

**Rationale**: agregar una séptima familia exige archivos de fuente, el selector del editor y pruebas; el aspecto de una cinta en negrita rotada es prácticamente el mismo.

## R9. Contacto, logo e ilustraciones de portada (FR-019 a FR-021)

**Decision**:
- El contacto usa el marcador **`{telefonos}`** (ya existe entre los marcadores de la 003: `banner`, `seccion`, `telefonos`, `direccion`, `tienda`) y el texto «Domicilios»; cambiar los teléfonos en la configuración del negocio los actualiza en todas las portadas.
- Íconos propios nuevos en `frontend/src/assets/print/`: `chat.svg` (ícono de contacto, **dibujado aquí, no copiado de Canva ni de WhatsApp**) y `sparkle.svg` (estrella de cuatro puntas).
- Las **manchas** del fondo se dibujan con formas circulares de la 003 con baja opacidad.
- Logo e ilustraciones los **sube el responsable**: `ImageEl.src` acepta `upload:<archivo>` además de las claves incluidas; mientras no haya, la portada se ve completa con el logo incluido por defecto de las otras plantillas, el título y el contacto.
- La tipografía y posición de las portadas **no se midieron**: se fijan con un diseño razonable (título centrado en mayúsculas muy grandes, logo arriba, ilustración al centro, contacto abajo sobre la franja de color) y se afinan cuando el responsable aporte medidas o arte.

**Rationale**: reutiliza los marcadores y formas existentes; la única capacidad nueva es la subida (R10).

## R10. Subir imágenes de plantilla (FR-021)

**Decision**: ruta nueva `template-images.routes.ts` (`POST`, `GET`, `DELETE`) que **reutiliza `saveUploadedImage`** (la misma validación de tipo real, tamaño y nombre seguro que usa la foto de un producto propio) y guarda en `data/uploads/` con prefijo `tpl-`. `ImageEl.src` válido: una clave incluida **o** `upload:<nombre>` con `^[A-Za-z0-9._-]+$`. Si el archivo ya no existe, el elemento se dibuja vacío y el editor avisa; el PDF **no aborta** por un adorno faltante, pero sí por una foto de producto (comportamiento actual).

**Rationale**: es lo mínimo que cumple FR-021 sin construir una biblioteca de medios. Las subidas pasan por el mismo `broken-images`/precarga que ya valida las imágenes del PDF.

**Alternatives considered**: guardar el arte dentro de `frontend/src/assets` → mete material del negocio al repositorio (prohibido por FR-021).

## R11. Compatibilidad con plantillas guardadas (FR-015, FR-022)

**Decision**: todos los campos nuevos son **opcionales**; `normalizeProductsBlocks` los completa con el valor de hoy (`cardStyle: 'plana'`, `priceGlow: false`, `soldGlow: false`, `bubbleShadow: false`, `descLh` ausente = el interlineado actual de la burbuja). La plantilla `base` los trae explícitos. Los valores nuevos de las listas (`'base'` en `BASE_IDS` y distribuciones, `'tarjeta'` en nombres, `'diagonal'` en AGOTADO) solo los usa la plantilla nueva. La prueba de **línea base de la 007** debe seguir pasando sin cambiar un byte.

**Rationale**: es el patrón que ya funcionó en las features 003 y 007 (campos opcionales + valor por defecto en un solo sitio, sin migración ni escritura en la base de datos).

## R12. Interlineado 1,4 de la descripción

**Decision**: campo opcional `descLh` del bloque de productos (solo la plantilla `base` lo fija en 1,4); sin él, la burbuja conserva el interlineado actual del CSS. No se toca `TEXT_DEFAULTS.lh` (1,05) ni el rango de la altura de línea de la 007.

**Rationale**: la descripción es texto **dentro del bloque automático**, no un elemento de texto, así que el control de altura de línea de la 007 no la alcanza.

## R13. Pruebas y datos de prueba

**Decision**: fotos de prueba **sintetizadas con `sharp`** al iniciar la prueba (fondo blanco liso, fondo degradado, producto cortado, dos productos separados, PNG con transparencia, panorámica, diminuta, empaque blanco sobre blanco). Pruebas unitarias del algoritmo de fondo (acepta / rechaza con su motivo), determinismo (misma entrada → mismos bytes) y la distribución `base` (posiciones y 0/1/2/3 productos). Integración: payload con tarjetas, modo de respaldo e informe, subidas de imagen, PDF de la plantilla `base` (peso y texto buscable «AGOTADO»), y la línea base de la 007.

**Rationale**: constitución V (pruebas sobre las reglas) y la restricción de no usar datos reales de la tienda.

## Resumen de decisiones

| # | Decisión |
| --- | --- |
| R1 | Tarjeta = un JPEG por producto; nombre en neón como texto vectorial; franja superior libre del 18 % |
| R2 | Quitar fondo propio sobre `sharp` con comprobaciones de confianza; si falla, modo seguro e informe |
| R3 | Composición perezosa en el payload con caché en disco; depende de la plantilla vigente |
| R4 | Distribución `base` con geometría medida; filas 1 y 2 y lado derecho estimados y a confirmar con REA |
| R5 | Neón con `text-shadow`; sombra de burbuja con `box-shadow`; calibrar lado a lado |
| R6 | 150 ppp, JPEG 88; ≈ 8–11 MB para 180 tarjetas; medir en validación |
| R7 | `photoBackdrop` es opción de la generación, con tarjeta de ejemplo en Generar |
| R8 | Poppins 400–700; la cinta usa Poppins 700 (Open Sans no está disponible) |
| R9 | Contacto con `{telefonos}`; íconos propios `chat.svg` y `sparkle.svg`; portadas con diseño razonable |
| R10 | Subidas de imagen de plantilla mínimas (`upload:`), reutilizando `saveUploadedImage` |
| R11 | Campos opcionales + `normalizeProductsBlocks`; línea base de la 007 intacta |
| R12 | `descLh` opcional en el bloque; no se toca `TEXT_DEFAULTS.lh` |
| R13 | Fotos de prueba sintéticas; pruebas unitarias e integración |


**Notas de implementación (feature 010, T018–T019)**: el color del borde es la **mediana** por canal del anillo (1 % del lado menor); la distancia de fondo es 34 (RGB euclidiana) y el trabajo se hace a ≤ 640 px por lado; se descartan las motas de menos del 0,05 % de la imagen. `extract` de sharp se aplica antes que `joinChannel`, por eso la máscara se une a la foto en un paso y se recorta en otro.
