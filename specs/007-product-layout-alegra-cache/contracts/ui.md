# Contrato de interfaz: Productos del catálogo más claros y datos de Alegra guardados

**Feature**: `007-product-layout-alegra-cache` | **Fecha**: 2026-10-10

Textos en español de Colombia, con el estilo Pop del panel. Los textos entre comillas son los que las pruebas comprueban. Los formatos de datos están en [data-model.md](../data-model.md) y las rutas en [rest-api.md](./rest-api.md).

## 1. Apariencia: bloque de productos

El inspector del **bloque de productos** se reordena en secciones con título. La primera es nueva y los campos genéricos de «Posición y tamaño» dejan de repetir el ancho y el alto.

| # | Sección | Campos |
| --- | --- | --- |
| 1 | **Tamaño de los productos** | Zona: «Ancho %» y «Alto %» (los `w` y `h` del bloque) · Foto: «Ancho %» y «Alto %» (`photoW`, `photoH`; 100 = tamaño original) · nota de límite · botón «Restaurar tamaños originales» |
| 2 | **Distribución** | Alternado · Tarjetas · Lista (como hoy) |
| 3 | **Nombre del producto** | «Estilo del nombre»: Separado · Dentro de la burbuja · «Color del nombre» · con *Separado*: «Fondo del rótulo» y el interruptor «Resplandor neón» |
| 4 | **Foto del producto**, **Descripción**, **Precio**, **Agotados** | Los campos de hoy, sin cambios |
| 5 | **Posición** | Solo «X %» y «Y %» |

- Los campos de la sección 1 son los **mismos** controles numéricos de siempre (`NumberField`): se escribe el valor y se confirma con Enter o al salir del campo. No dependen de que el bloque esté desbloqueado.
- Bajo los campos, una nota fija: «Para arrastrar la zona en la página, pulsa Desbloquear.» (el bloque sigue naciendo «Fijo»).
- **Rotulación**: «Ancho %» y «Alto %» se agrupan bajo los subtítulos «Zona de productos» y «Tamaño de la foto» (cada par es un `role="group"` con ese nombre) para que no se confundan con la sección «Foto del producto». El selector del nombre se llama «Estilo del nombre» para no chocar con el «Estilo» de los agotados.

### Límites (FR-004)

Un valor fuera de lo permitido **se recorta al máximo o mínimo que sí cabe** y la página queda bien; el motivo aparece en la nota de la sección y como aviso temporal del editor (el mismo mecanismo de «Este bloque es obligatorio…»):

| Caso | Mensaje |
| --- | --- |
| Zona más pequeña que el mínimo | «La zona de productos debe medir al menos 40 % de ancho y 30 % de alto.» |
| Ancho de la foto sobre el máximo de la zona | «El ancho máximo de la foto en esta zona es N %. Agranda la zona para darle más espacio.» |
| Alto de la foto sobre el máximo de la zona | «El alto máximo de la foto en esta zona es N %. Agranda el alto de la zona para darle más espacio.» |
| Foto bajo 50 % | El campo limita en 50; no hay mensaje (el rango ya lo dice) |

- La nota de límite se muestra mientras el valor guardado esté en su máximo (o lo supere) y, la de la zona, mientras esté en su mínimo; sin nota no se dibuja nada (el aviso temporal ya se anuncia). Cuando está visible, tiene `role="status"`. El máximo de cada escala se recalcula al cambiar la zona o la distribución (`photoScaleLimits`).
- Si el cambio de zona deja una escala por encima de su nuevo máximo, **no se cambia lo guardado**: se dibuja recortada y la nota lo dice. Así deshacer y rehacer devuelven valores exactos.
- «Restaurar tamaños originales»: pone `photoW` y `photoH` en 100 y `w` y `h` del bloque en los de la plantilla de fábrica de la que partió (`template.base`). Es **un solo paso** de deshacer.

### Nombre separado

- Con **Separado**, cada producto muestra su nombre en un **rótulo** propio: fuera de la burbuja y fuera del marco de la foto, con el color, el fondo y el resplandor elegidos. La burbuja solo trae la descripción y los datos extra; si no hay ninguno, la burbuja no se dibuja.
- Con **Dentro de la burbuja**, el producto se dibuja como hoy y desaparecen «Fondo del rótulo» y «Resplandor neón».
- Neón Noche viene con **Separado**, color 1 de la paleta (acento 1), rótulo oscuro (color «Fondo» de la paleta) y resplandor activado. Las demás plantillas de fábrica vienen con **Dentro de la burbuja**.
- El nombre siempre se ve completo si cabe con letra de 6 pt o más: se reduce y se parte en líneas. Si aun así no cabe, el bloque muestra el aviso que ya existe («Este bloque llegó al tamaño mínimo legible…», `data-testid="overflow-warning"`).

### Opciones de precio

Una opción de precio con etiqueta larga se parte en líneas en lugar de cortarse con «…»; el precio y el máximo de sabores siguen a la vista.

## 2. Apariencia: botón «Consejos»

- En la barra superior, **siempre visible** (en Editor y en Plantillas), entre el estado de guardado y «Vista previa»: botón «Consejos» con `aria-haspopup="dialog"`.
- Al pulsarlo se abre un panel (`role="dialog"`, `aria-labelledby` con el título «Consejos para Apariencia») que **no** cambia el estado del editor: no hay historial, ni «cambios sin guardar», ni se pierde la selección.
- Se cierra con «Cerrar», con **Esc** o pulsando fuera; el foco vuelve al botón «Consejos». Mientras está abierto, el foco no sale del panel (Tab y Mayús+Tab circulan dentro de él).
- Los atajos del editor no actúan mientras el panel está abierto.
- Contenido (7 consejos, en `editor-tips.ts`):

1. «**Más espacio para los productos.** Selecciona el bloque de productos y cambia el ancho y el alto de la zona o de la foto en «Tamaño de los productos».»
2. «**El nombre en neón.** En «Nombre del producto» elige si va separado de la descripción o dentro de la burbuja, y cambia su color y su rótulo.»
3. «**Si un texto no cabe**, el bloque lo avisa. Agranda la zona o la foto, o acorta el texto; el catálogo se genera igual.»
4. «**Contraste.** El editor avisa cuando un color casi no se distingue del fondo. Revísalo antes de guardar.»
5. «**Mover y cambiar el tamaño.** Los bloques automáticos están fijos: pulsa «Desbloquear» para arrastrarlos y usa la esquina para cambiar su tamaño.»
6. «**Vista previa.** Pulsa «Vista previa» para ver la página sin guías ni selección.»
7. «**Guardar.** Un solo «Guardar» aplica todas las plantillas. Usa «Usar» para elegir con cuál se genera.»

## 3. Barra de estado de los datos de Alegra

Componente nuevo `AlegraDataBar`, en **Artículos de Alegra**, **Sin categoría**, **Combos** y **Conexión Alegra**. Inicio conserva su tarjeta «Sincronizado hace N min» y su botón «Actualizar» (ahora actualizan la copia).

| Estado | Texto | Acción |
| --- | --- | --- |
| `ready` | «Datos de Alegra actualizados hace N min.» (el mismo formato de tiempo de Inicio, `timeAgo`: «hace menos de 1 min», «hace 3 min», «hace 2 h», «hace 4 d») | Botón «Actualizar desde Alegra» |
| `syncing` | «Actualizando desde Alegra… N artículos recibidos.» (sin cifra mientras N = 0: «Conectando con Alegra…») | El botón queda deshabilitado, con `aria-busy` |
| `ready` con `lastError` | «No se pudo actualizar desde Alegra: {mensaje}. Estás viendo los datos de hace N min.» | Botón «Reintentar» |
| `none` | La barra no se muestra: aparece la pantalla de carga (§4) o el error de la pantalla | |

- El texto de progreso es una región `aria-live="polite"`. Al terminar una actualización, la pantalla **recarga su lista** sin recargar la página.
- Mientras `syncing`, la pantalla consulta `GET /api/alegra/data` cada ~800 ms; deja de hacerlo al terminar o al salir de la pantalla.

## 4. Artículos de Alegra

### Pantalla de carga (FR-023)

Se muestra mientras no hay lista que mostrar **y** (la petición lleva más de ~300 ms o el estado es `syncing`). Con copia vigente, la lista aparece sin ella.

- Título: «Descargando los artículos de Alegra».
- Texto: «Solo pasa la primera vez o cuando actualizas. Puedes ir a otra pantalla: la descarga sigue.»
- Progreso: «N artículos recibidos» (o «Conectando con Alegra…» si N = 0), con un indicador de avance sin porcentaje (`role="progressbar"` con `aria-busy`, sin valor).
- Reserva el **mismo espacio** que la lista (esqueleto de la barra de búsqueda, las etiquetas y ~8 filas): cuando llegan los datos, nada cambia de lugar (SC-008).
- El error de Alegra de hoy («Reintentar», enlace a la conexión) se mantiene, en el mismo lugar.

### Búsqueda, categorías y vista (FR-024)

Una sola **tarjeta de herramientas** con:

1. «Buscar por nombre» (sin distinguir mayúsculas ni tildes, como hoy).
2. Grupo «Categoría» de etiquetas (`aria-pressed`), una a la vez: «Todas (N)», una por categoría con artículos, «{Nombre} (N)» y «Sin categoría (N)» solo si hay. Los N respetan la búsqueda y la vista activas; las categorías sin artículos en ese momento no se ocultan, se muestran atenuadas con «(0)» y siguen siendo elegibles.
3. Vista «Todos (N)» / «Omitidos (N)» (como hoy).
4. «Limpiar filtros» (visible solo con búsqueda o categoría activas).

- La línea «197 artículos · 14 omitidos» queda en el encabezado de la lista, con el número que resulta de los filtros: «Mostrando N de M artículos».
- Sin resultados: «Ningún artículo coincide con los filtros.» y el botón «Limpiar filtros». Con la vista «Omitidos» sin filtros: «No has omitido ningún artículo.» (como hoy).
- Las etiquetas se acomodan en varias filas en pantallas angostas; no hay desbordamiento horizontal a 1366 × 768 ni a 1024 px.
- Todo lo de la feature 006 (omitir, volver a incluir, nota de combos, foco tras sacar una fila de «Omitidos», mensajes de error de guardado) sigue igual.

## 5. Sin categoría, Combos, Conexión Alegra e Inicio

- **Sin categoría** y **Combos**: la barra de datos (§3) bajo el título; mientras se descarga por primera vez, la pantalla de carga (§4). Nada más cambia.
- **Conexión Alegra**: tras «Guardar», la barra muestra el avance de la primera descarga y luego «Datos de Alegra actualizados hace menos de 1 min.»; si la cuenta cambió, se avisa: «Cambiaste de cuenta de Alegra: se descargan los datos de la cuenta nueva.»
- **Inicio**: «Sincronizado hace N min» pasa a ser la antigüedad de la copia. «Actualizar» actualiza la copia. Si falló la última actualización, bajo el aviso de siempre: «No se pudo actualizar desde Alegra: {mensaje}.»

## 6. Generar

- Al terminar una generación con `textOverflow`, bajo el aviso de éxito: aviso `warning` con el título «N producto(s) tienen texto que no cabe completo» y el texto «Aparecen con la letra más pequeña o con el texto cortado: {nombres, hasta 20}. Agranda la zona o la foto de los productos en Apariencia, o acorta el texto, y genera de nuevo.», con un enlace a Apariencia.
- Sin `textOverflow`, no se muestra nada nuevo.
- Todo lo demás de Generar (revisión, avisos de omitidos, calidad, tamaño del PDF, `409 omitted_changed`) no cambia.

## 7. Accesibilidad y diseño

- Foco visible en todos los controles nuevos; las etiquetas, la barra de datos y el panel de consejos se leen con lector de pantalla (`aria-live`, `role="dialog"`, `aria-pressed`).
- Contraste de texto sobre fondo ≥ 4,5:1 en lo nuevo, con los colores del panel Pop.
- Sin desbordamiento horizontal del panel a 1366 × 768 ni a 1024 px, con 20 categorías de nombre largo (`panel-layout.test.ts`).
- Ningún texto nuevo usa solo el color para dar información (los estados llevan texto).
