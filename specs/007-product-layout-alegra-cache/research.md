# Investigación: Productos del catálogo más claros y datos de Alegra guardados

**Feature**: `007-product-layout-alegra-cache` | **Fecha**: 2026-10-10

El Contexto Técnico del plan no dejó ningún `NEEDS CLARIFICATION`: la spec resolvió sus ambigüedades con supuestos documentados. Lo que hacía falta antes de diseñar era **leer cómo se dibuja hoy un producto y cómo llegan los datos de Alegra a cada pantalla**, porque la feature toca tres cosas que ya existen (el bloque de productos, la pantalla Artículos de Alegra y todas las consultas a Alegra). No hay experimentos ni mediciones: todo lo de abajo se verificó leyendo el código y mirando una muestra de Neón Noche contra `docs/Cat.pdf`.

## 0. Lo encontrado en el código

| Hallazgo | Dónde | Consecuencia para el diseño |
| --- | --- | --- |
| El bloque de productos **nace «Fijo»** (`locked: true`): en el lienzo no tiene manijas ni se arrastra hasta pulsar «Desbloquear». Sus campos **Ancho % y Alto %** existen, pero están al final del inspector, tras unos 15 campos de estilo | `template-presets.ts` (`block`), `Canvas.tsx`, `inspector-fields.ts` | Por eso «ajustar el ancho y el alto» parece no existir. Hay que subir esos campos a una sección propia y visible, y no depender de desbloquear |
| El tamaño de la foto, de la burbuja y del precio sale de **proporciones fijas** de la caja del bloque (`layoutRows`): la foto mide el 29 % del ancho en `alternado`, y las tres filas ocupan **exactamente** el alto del bloque (27 % de fila cada 29,1 %, sobre un bloque de 85,2 %) | `template-layout.ts` | Cambiar la zona escala todo junto; no hay forma de cambiar solo la foto. Una foto más alta que hoy no cabe sin agrandar la zona: el límite es natural y hay que decírselo a la persona |
| El nombre del producto se dibuja **dentro de la burbuja** (`.pb-name`, mismo color que la descripción). En `docs/Cat.pdf` el nombre en neón está aparte de la burbuja | `ProductsBlock.tsx`, `products-block.css`; muestra de Neón Noche vs `Cat.pdf` pág. 4 | El nombre necesita su propio rectángulo en `layoutRows` y su propio ajuste de letra |
| En `alternado` la burbuja arranca al 19 % de la altura de la fila (`bubble.y = top + 0.19·rowH`): arriba queda **un hueco libre** de ~43 px junto a la foto | `template-layout.ts` | Es el lugar natural del nombre separado en Neón Noche, sin mover la foto, la burbuja ni el precio |
| Neón Noche usa **mármol claro** de fondo y `a1 = #FF007A` como neón. Texto neón con resplandor sobre mármol casi no se lee | `template-presets.ts` | El nombre separado necesita un **rótulo oscuro** (el color `bg` de la plantilla) detrás del texto neón, como las tarjetas oscuras de `Cat.pdf` |
| `useFit` baja la letra hasta 6 pt y, si aún no cabe, aplica `lastResort` (menos líneas con «…»). Solo marca `data-overflow` si **ni así** cabe | `useFit.ts` | Un texto **cortado con «…» no se marca**: es justo lo que la spec prohíbe hacer sin avisar. Hay que marcar también «se recortó» |
| La etiqueta de una opción de precio es `white-space: nowrap` con `text-overflow: ellipsis`: «Caja x 6 …» | `products-block.css` (`.pb-opt-label`) | `useFit` solo mide la **altura**: una etiqueta larga se corta a lo ancho sin que nada la reduzca. Debe poder partirse en líneas |
| Las medidas de texto solo existen **en el navegador** (fuentes reales); el servidor arma el informe de revisión sin dibujar nada | `catalog-builder.ts`, `Print.tsx`, `pdf.service.ts` | El servidor no puede saber qué texto no cabe al preparar. Solo el navegador que genera el PDF lo sabe (decisión 4) |
| **Seis** lugares consultan Alegra en vivo, cada vez que se abren: `GET /catalog/articles`, `GET /catalog/uncategorized`, `GET /bundles` y `/bundles/component-options`, `listSections` (categorías, usado por Artículos, Sin categoría y Secciones), el resumen de Inicio (con una caché en memoria de 60 s) y `prepare` | `articles.routes.ts`, `uncategorized.routes.ts`, `bundles.routes.ts`, `sections.service.ts`, `panel-summary.ts`, `catalog.service.ts` | Una sola capa nueva (la copia local) cubre los seis. `prepare` necesita además las **direcciones de las fotos**, que se firman y vencen: se queda con su propia descarga |
| Los listados de Alegra devuelven `images` con direcciones firmadas; `mapAlegraItem` las convierte a `imageUrls` | `alegra.mapper.ts`, `specs/004-fix-alegra-images/` | Guardarlas en la copia sería guardar enlaces que vencen. La copia guarda solo **si hay foto**, no la dirección |
| El resumen de Inicio **supone con imagen** todo ítem con dirección de foto (`localImages = remoteImageUrl`) | `panel-summary.ts` | La copia debe conservar `hasPhoto` para que el cálculo de páginas y de «sin foto» de Inicio siga igual |
| `PUT /settings/alegra` valida con `getCompany()` y guarda; no distingue entre «misma cuenta» y «otra cuenta» | `alegra-settings.routes.ts`, `connection.repo.ts` | Hay que comparar el correo anterior con el nuevo para decidir si se conserva o se descarta la copia (FR-019) |
| Hay **15 suites de integración** que usan el Alegra simulado y varias cambian los datos del simulador entre dos llamadas esperando verlos al instante | `backend/tests/integration/*`, `alegra-mock.ts` (`setItems`, `requests`) | Con la copia, esas pruebas deben pedir la actualización explícita antes de leer. Es un cambio de pruebas esperado, no un defecto |
| `PanelSummaryService` ya devuelve `syncedAt` y `Home` pinta «Sincronizado hace N min» | `panel-summary.ts`, `Home.tsx` | La noción de «antigüedad» ya existe en la interfaz; solo cambia de dónde sale (la copia, no la caché de 60 s) |

## 1. Tamaño de la zona y de la foto

- **Decisión**: la **zona** sigue siendo `w` y `h` del bloque (% de la página); lo nuevo es una sección **«Tamaño de los productos»** al principio del inspector del bloque, con esos dos campos, dos campos nuevos para la **foto** y un botón «Restaurar tamaños originales». La foto se guarda como dos escalas, `photoW` y `photoH`, en **% del tamaño original de la distribución elegida** (100 = como hoy; rango 50 a 150).
- **Por qué escalas y no medidas absolutas**: el tamaño original difiere por distribución (`alternado` 29 % del ancho, `tarjetas` una tercera parte, `lista` un cuadrado). Una escala sobrevive a cambiar de distribución y garantiza que **100 reproduce exactamente la geometría de hoy** (FR-005, SC-004).
- **Límites**: una función pura `photoScaleLimits(layout, W, H, opts)` devuelve el máximo de cada escala para la zona actual (la fila debe seguir dentro de la caja y no encimarse con las otras dos). El editor recorta al máximo y lo dice con el mensaje que ya usa el reductor (`say`); `layoutRows` también recorta, por si llega una plantilla editada a mano. Una **zona mínima** (`PRODUCTS_ZONE_MIN`: 40 % de ancho y 30 % de alto de la página) evita el estado roto de «zona de 3 %» que hoy permite el rango genérico.
- **Alto de la foto**: en `alternado` las tres filas ya ocupan todo el alto de la zona, así que la foto no puede crecer en alto sin agrandar la zona. Es un límite real que el mensaje explica («Para agrandar la foto, aumenta el alto de la zona»). Al **reducir** la foto, las filas se reparten el alto sobrante y la foto queda centrada en su franja; la columna de texto (nombre, burbuja y precio) conserva su tamaño y se centra contra la foto.
- **Alternativas descartadas**: (a) **desbloquear el bloque por defecto** y confiar en las manijas: no da control sobre la foto, y migrar plantillas guardadas para cambiar `locked` toca algo que la persona puede haber decidido. (b) **Medidas absolutas en %** de la zona: cambian de significado al cambiar la distribución y obligan a un valor por distribución. (c) **Ancho y alto por producto**: la spec pide un solo tamaño de foto para los tres.

## 2. Nombre separado y en neón

- **Decisión**: cuatro campos nuevos en el bloque de productos: `nameStyle` (`separado` | `burbuja`), `nameColor` y `nameFill` (colores de la paleta, un `#RRGGBB`, `none` o `transparent`) y `nameGlow` (resplandor del mismo color, sí o no). Con `separado`, `layoutRows` entrega un rectángulo `name` por fila y la burbuja ya no repite el nombre; con `burbuja`, todo queda como hoy.
- **Dónde va en cada distribución**: `alternado`, en el hueco libre sobre la burbuja (alineado con ella); `tarjetas`, entre la foto y la burbuja (hay altura de sobra: las tres columnas usan ~464 px de ~640); `lista`, en la parte alta de la columna de texto, con la burbuja debajo. En los tres casos nace de espacio que la distribución ya deja libre, así que **foto, burbuja y precio de Neón Noche no se mueven** (SC-004).
- **Rótulo oscuro**: Neón Noche usa `nameFill: 'bg'` y `nameColor: 'a1'` con resplandor. Sin el rótulo, el neón rosa sobre mármol blanco no pasa el umbral de contraste que la propia aplicación avisa para la paleta. Las demás plantillas quedan con `burbuja`, relleno `transparent` y el color de acento que ya tienen.
- **Qué productos**: el bloque dibuja todos los productos con la misma fila (`ProductRow`), así que Alegra, productos propios y combos reciben el nombre separado sin código por tipo (FR-010). Con `separado`, la burbuja se omite si queda vacía (sin descripción ni extras) y el producto conserva nombre y precio.
- **Plantillas ya guardadas**: se **normalizan al leerlas** (`TemplateRepo` completa los campos que faltan): la plantilla con id `neon` recibe `separado`, `a1`, `bg` y resplandor; **cualquier otra** recibe `burbuja`, para que no cambien de aspecto (FR-008). Así el editor siempre recibe documentos completos y el esquema puede exigir los campos nuevos.
- **Alternativas descartadas**: (a) **un solo campo `nameColor` y el resto fijo**: el neón sin rótulo no se lee sobre mármol. (b) **Colocar el nombre dentro del marco de la foto** como en `Cat.pdf`: allí el nombre es parte de la imagen del producto; la spec pide el nombre «fuera del diseño», y tapar la foto es lo contrario de lo que se quiere ver. (c) **Migración en base de datos** de las plantillas guardadas: normalizar al leer es idempotente y no escribe nada hasta que la persona guarda.

## 3. Texto completo: reducir, partir y avisar

- **Decisión**: (1) el nombre separado usa su propio `useFit` (alto y ancho, hasta 6 pt y partiéndose en líneas); (2) las **opciones de precio** pasan de una línea con «…» a poder **partirse en líneas** (la etiqueta cede el ancho al precio y baja a otra línea), de modo que la reducción por alto las alcance; (3) `useFit` marca `data-clipped="true"` cuando tuvo que recurrir a `lastResort` (texto con «…»), además del `data-overflow` de siempre.
- **Razón**: la spec exige «ver todo» y, cuando no se puede, no cortar en silencio. Hoy el recorte es silencioso (hallazgo 0). Las tres piezas se prueban con el mismo bucle de ajuste, sin una mecánica nueva.
- **Alternativas descartadas**: (a) **dejar crecer la burbuja** más allá de su caja: rompe la regla de «nunca desborda ni agrega páginas» de 001/002. (b) **bajar el mínimo de 6 pt**: la constitución y las pruebas de desbordamiento lo fijan; por debajo no se lee.

## 4. Dónde se avisa de un texto que no cabe

- **Decisión**: el navegador que genera el PDF (la misma vista `Print`) reúne, antes de marcarse como lista, los productos con `data-clipped` o `data-overflow` y los deja en `window.__printTextOverflow` (nombre del producto y qué texto: `name` o `bubble`). `PuppeteerRenderer.render` los lee junto a las fotos rotas y los devuelve por un parámetro de salida opcional; el trabajo los guarda como `textOverflow` y `GET /api/catalog/jobs/current` los entrega. **Generar los muestra al terminar** («N productos tienen texto que no cabe completo»), con los nombres, y el editor sigue avisando por bloque (`data-overflow` ya existe).
- **Razón**: las medidas dependen de las fuentes reales y solo el navegador las tiene. No impide generar (no es un fallo de Alegra ni de renderizado: el principio II no obliga a abortar), pero la persona se entera y puede agrandar la zona o la foto y generar de nuevo.
- **Cambio respecto a la spec**: FR-013, el escenario 4 de la Historia 2 y SC-003 decían «en la revisión de Generar» (antes de generar). **La revisión no puede saberlo**; se ajustaron a «al terminar la generación». Es la única diferencia entre spec y plan.
- **Alternativas descartadas**: (a) **estimar el texto en el servidor** con métricas aproximadas: falsos positivos y negativos con fuentes que no se miden igual. (b) **Un render de prueba en `prepare`**: duplica el trabajo de Chrome (~tiempo de una generación) y queda obsoleto en cuanto se cambia plantilla o secciones. (c) **Abortar la generación**: el catálogo seguiría siendo correcto en precios y estados; abortar por un texto recortado castiga sin necesidad.
- **Compatibilidad**: el parámetro de salida es opcional, así que `FakeRenderer` y las pruebas de integración no cambian.

## 5. La copia local de los datos de Alegra

- **Decisión**: una tabla `alegra_snapshot` de **una sola fila** (migración `005_alegra_data.sql`) con el correo de la cuenta, el instante de la descarga, un número de formato, y los artículos y categorías como JSON. Un `AlegraDataRepo` la lee y la reemplaza en una sola sentencia; un `AlegraDataService` decide **cuándo** descargar:
  - `get()` devuelve la copia; si **no hay**, descarga una vez (las llamadas simultáneas esperan la misma descarga) y la guarda. Nunca consulta Alegra si ya hay copia.
  - `refresh()` descarga de nuevo y **reemplaza** la copia solo si todo terminó bien; si falla, conserva la anterior y recuerda el error (en memoria) para mostrarlo.
  - `store()` lo usa `prepare`, que ya descarga todo (con las fotos): guarda ese resultado como copia nueva, sin pedirlo dos veces.
  - `discard()` borra la copia al cambiar de cuenta.
- **Qué se guarda**: por artículo, `id, name, description, price, soldOut, categoryId, categoryName, type` y `hasPhoto`; por categoría, `id` y `name`. **No** se guardan direcciones de fotos (vencen), ni credenciales, ni nada de los productos propios (principios I y III). Al arrancar con otro número de formato, la copia se considera ausente y se vuelve a descargar.
- **Quién la lee**: los seis lugares del hallazgo 0, vía `ctx.alegraData`. `prepare` y su descarga de fotos no cambian de comportamiento, y por eso el catálogo siempre se arma con datos recién descargados (FR-017, principio II).
- **Resumen de Inicio**: pierde su caché de 60 s (leer la copia es una consulta local y calcular el resumen es barato); `?refresh=1` pasa a significar «actualizar la copia ahora».
- **Alternativas descartadas**: (a) **caché en memoria con una vida más larga**: no sobrevive a un reinicio, que es justo lo que pide la persona. (b) **Una tabla por artículo y por categoría**: más migraciones y repositorios para un dato que siempre se lee y se reemplaza completo (~200 filas, decenas de KB). (c) **Guardar la respuesta cruda de Alegra**: arrastra `images` con direcciones firmadas que vencen y datos que no se usan. (d) **Actualizar en segundo plano de forma programada**: la spec lo deja fuera (VI) y tampoco hace falta, porque preparar ya actualiza.

## 6. Primera descarga, progreso y pantalla de carga

- **Decisión**: dos rutas nuevas, `GET /api/alegra/data` (estado: sin datos, descargando, al día; antigüedad; cuántos artículos; cuántos recibidos y en qué fase; último error) y `POST /api/alegra/data/refresh` (inicia la actualización y responde `202` con el estado; si ya hay una en curso, responde con ese mismo estado). El cliente de Alegra recibe un `onProgress` opcional que informa cuántos registros llevan recibidos.
- **Cuándo se descarga por primera vez**: (a) al **guardar la conexión** (`PUT /settings/alegra`), en segundo plano, si no hay copia o si la cuenta es otra; (b) **perezosamente**, la primera vez que se lee (el caso de la conexión que ya existe hoy). En (b) la petición de la pantalla espera la descarga, y la pantalla muestra el progreso consultando `GET /api/alegra/data` mientras tanto: el cliente no necesita saber si hace falta descargar.
- **Pantalla de carga**: un componente `LoadingScreen` con un esqueleto que **reserva el espacio** de la pantalla (SC-008), un mensaje, un indicador de avance y el conteo de artículos recibidos (Alegra no informa el total, así que el indicador no promete un porcentaje). Se muestra solo si la petición tarda más de unos 300 ms o el estado dice «descargando»; con copia, la pantalla aparece sin ella.
- **Alternativas descartadas**: (a) **Responder `409 sin datos` desde cada ruta y obligar al cliente a orquestar descarga y reintentos**: seis pantallas con la misma lógica. (b) **Eventos enviados por el servidor o WebSocket** para el avance: una consulta cada ~800 ms al estado basta para una descarga de menos de un minuto (VI). (c) **Bloquear toda la aplicación** durante la primera descarga: la persona puede seguir en otra pantalla; la descarga es del servidor.

## 7. Cambio de cuenta y reemplazo de credenciales

- **Decisión**: `PUT /settings/alegra`, tras validar y guardar, compara el correo anterior con el nuevo (sin distinguir mayúsculas). Si **cambia**, descarta la copia y descarga la nueva; si es el **mismo** y hay copia, no hace nada; si es el mismo y no hay copia, descarga. La descarga no bloquea la respuesta.
- **Razón**: FR-019 prohíbe mostrar datos de una cuenta con credenciales de otra. El correo es lo único que la aplicación sabe de la identidad sin pedir más a Alegra (la forma de `getCompany` no está documentada en la integración).
- **Alternativa descartada**: **identificar la cuenta por el id de la empresa** de `/company`: su forma no se verificó en `specs/001-…` y no vale arriesgar la feature por ella.

## 8. Filtro por categorías en Artículos de Alegra

- **Decisión**: se reemplaza el selector de sección por un **grupo de etiquetas** con la cantidad de artículos de cada categoría, más «Todas» y «Sin categoría». Una categoría a la vez. Los conteos se calculan en el navegador y **respetan la búsqueda y la vista** (Todos/Omitidos), de modo que la persona ve cuántos hay antes de elegir. Un botón «Limpiar filtros» aparece cuando hay alguno activo.
- **Razón**: hoy el filtro existe pero está escondido en un selector sin cantidades; FR-024 pide verlas. 197 artículos en unas 20 categorías caben en etiquetas que se acomodan en varias filas, y todo ocurre en memoria (< 1 s).
- **Alternativas descartadas**: (a) **un panel lateral de categorías**: la pantalla mide 768 px de ancho útil (`max-w-3xl`) y no hay sitio sin rediseñarla. (b) **Selección múltiple**: la spec pide una categoría a la vez y la vista «Omitidos» ya cubre «varios a la vez».

## 9. Ajuste de diseño (Artículos de Alegra y Apariencia)

- **Decisión** (sin rediseñar; consistente con el estilo Pop):
  - **Artículos de Alegra**: una **barra de estado de los datos** («Datos de Alegra actualizados hace N min · Actualizar desde Alegra») reutilizable en las otras pantallas; búsqueda, etiquetas de categoría y vista **agrupadas en una sola tarjeta**; contador y vistas en la misma línea; filas con nombre, categoría y precio mejor alineados; estado vacío y de carga con el mismo espacio que la lista (sin saltos).
  - **Apariencia**: el inspector del bloque de productos se ordena en secciones con títulos («Tamaño de los productos», «Nombre», «Foto», «Descripción», «Precio», «Agotados») y el botón **Consejos** entra en la barra superior junto a la vista previa, con el mismo estilo de los demás botones.
- **Razón**: la spec acota «ajustar un poco el diseño» a las dos pantallas que la feature toca. Mover lo que ya existe es más barato y menos arriesgado que crear componentes nuevos.
- **Se verifica**: a 1366 × 768 y con `panel-layout.test.ts` (sin desbordes horizontales), y a mano en el quickstart.

## 10. Consejos de Apariencia

- **Decisión**: un panel `TipsPanel` (rol de diálogo, se cierra con un botón y con Esc, el foco vuelve al botón) que se abre desde un botón «Consejos» de la barra superior. El contenido son 7 consejos cortos en un módulo de datos (`editor-tips.ts`), no en el componente, para poder cambiarlos sin tocar la interfaz. Abrirlo o cerrarlo **no toca** el estado del editor (no pasa por el reductor), así que no hay historial, ni cambios sin guardar, ni dependencia de la selección.
- **Consejos iniciales** (se afinan al implementar): ajustar la zona y la foto de los productos; qué hace el nombre en neón y cómo cambiarlo; cómo comprobar el contraste del texto; arrastrar y desbloquear un bloque; vista previa; atajos de teclado; guardar y «Usar al generar».
- **Alternativas descartadas**: (a) **Un tutorial paso a paso** con globos: la spec lo deja fuera y es mucho más código. (b) **Un texto fijo siempre visible en el inspector** (ya existe el recuadro «Atajos»): ocupa espacio y se ignora. (c) **Consejos según el elemento seleccionado**: más contenido que mantener; la spec pide ayuda general.

## 11. Pruebas que cambian

- Las suites de integración que **cambian los datos del simulador entre dos lecturas** (`omitted-articles`, `uncategorized`, `panel-summary`, `bundles`) pedirán la actualización explícita (`POST /api/alegra/data/refresh`) antes de leer. Un ayudante en `backend/tests/helpers.ts` evita repetirlo.
- `panel-summary.test.ts` deja de probar la caché de 60 s y prueba, en su lugar, que leer no consulta Alegra y que `?refresh=1` sí.
- Nuevas: ver el plan (sección «Estructura»).

## 12. Qué no se hace (principio VI)

- Sin actualización programada, sin «sincronización» entre equipos, sin historial de copias, sin estado de la descarga persistido (el último error vive en memoria).
- Sin selección de varias categorías, sin ordenar la lista por columnas, sin paginación.
- Sin medidas absolutas ni por producto para la foto, sin tutorial, sin migración de plantillas en la base (se normaliza al leer).
- Sin cambiar `CatalogDocument`, las portadas, el pie, la página de políticas ni la calidad del PDF.
