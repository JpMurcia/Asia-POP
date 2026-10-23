# Generador de catálogo PDF · ASIANPOP MARKET+

Aplicación web **local** que genera el catálogo PDF de la tienda a partir de los productos de **Alegra** (solo lectura) y de productos propios (mochis, combos de regalo). La plantilla predeterminada, **Neón Noche**, replica [`docs/Cat.pdf`](docs/Cat.pdf); desde **Apariencia** puedes personalizarla o crear otras plantillas con un editor visual.

- **Interfaz:** React + Tailwind, se abre en `http://localhost:3000`.
- **Servidor:** Node.js + Express + SQLite, escucha **solo** en `127.0.0.1`.
- **PDF:** Chrome/Puppeteer imprime la misma vista que ves en la vista previa.

## Requisitos

- Node.js 22 o superior.
- Google Chrome o Microsoft Edge instalados (o el Chrome que descarga Puppeteer).
- Correo y token de la API de Alegra.

## Instalación

```bash
npm install
```

**No necesitas ningún `.env`.** La app arranca sin configurar nada:

- **Acceso:** usuario `admin` y contraseña `AsiaPop2026` (datos semilla fijos; no se cambian desde la aplicación).
- **Token de Alegra:** se ingresa desde la pantalla «Conexión Alegra», no por variables de entorno.
- **Clave de cifrado:** se genera sola la primera vez y se guarda en `data/encryption.key`. No la borres: sin ella habría que volver a guardar el token de Alegra.

Si quieres cambiar algo, crea un `.env` en la raíz (todo opcional):

| Variable | Qué es |
| --- | --- |
| `SEED_USERNAME` / `SEED_PASSWORD` | Reemplazan el usuario y la contraseña por defecto |
| `ENCRYPTION_KEY` | Clave propia de 32 bytes en base64 (si no, se usa `data/encryption.key`) |
| `PORT` | Puerto local (por defecto 3000) |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta a Chrome/Edge si no se encuentra solo |
| `ALEGRA_BASE_URL` | Por defecto `https://api.alegra.com/api/v1` |

## Uso

```bash
npm run build
npm start
```

Abre <http://localhost:3000> e inicia sesión (por defecto `admin` / `AsiaPop2026`).

El panel usa la barra lateral de la izquierda (estilo «Pop» del mockup de administración). Muestra siempre el estado de la conexión con Alegra y un contador de productos sin categoría.

1. **Inicio:** resumen con productos activos (con «Sincronizado hace N min»: la antigüedad de los datos de Alegra guardados en el equipo), agotados, sin categoría y páginas estimadas; las secciones con su cantidad de productos; y el último catálogo con su botón de descarga. Si Alegra no responde, los indicadores aparecen como no disponibles y el último catálogo sigue descargable.
2. **Conexión Alegra:** ingresa el correo y el token, prueba la conexión y guarda. El token nunca se vuelve a mostrar. Ves cuántos intentos de prueba te quedan por minuto (10); al agotarlos te pide esperar. Al guardar por primera vez, la aplicación **descarga una sola vez** los artículos y las categorías de Alegra y los guarda en el equipo (ves el avance «N artículos recibidos»). Si guardas **otra cuenta** de Alegra, los datos de la anterior se descartan y se descargan los de la nueva; si guardas la misma, no se descarga nada.
3. **Sin categoría:** si hay productos de Alegra sin categoría, aparece una alerta; asígnales una sección (solo se guarda aquí, no cambia Alegra). Los artículos que omitiste (ver el punto siguiente) no cuentan como pendientes: aparecen marcados como «Omitido».
4. **Artículos de Alegra:** elige los artículos que **no** quieres en el catálogo (por ejemplo, uno de uso interno o descontinuado). La primera vez (o si pulsas **Actualizar desde Alegra**) ves una pantalla de carga con el avance; después la lista aparece al instante. Busca por nombre (sin distinguir mayúsculas ni tildes), filtra por **categoría** con las etiquetas (cada una dice cuántos artículos tiene y los números siguen la búsqueda y la vista; **Limpiar filtros** vuelve a todo), pulsa **Omitir** y listo: el cambio se guarda al instante, es **permanente** (vale para todos los catálogos hasta que pulses **Volver a incluir**) y solo se guarda aquí: no cambia nada en Alegra. La vista **Omitidos** muestra de una vez todo lo que dejaste fuera. Si un artículo omitido es componente de un combo, te avisa en cuál; el combo no cambia.
5. **Contenido propio:** en la pestaña **Secciones** creas secciones como MOCHIS o REGALOS y defines el orden; en **Productos propios** agregas sus productos (con opciones de precio y sabores). Todo producto necesita **imagen** para salir en el catálogo.
6. **Combos:** combos con precio fijo o descuento, con productos de Alegra o propios. Mientras editas ves la suma de los componentes, el ahorro y el precio en el catálogo.
7. **Apariencia:** el editor de plantillas, a pantalla completa (ver [Plantillas y editor](#plantillas-y-editor-de-apariencia)). Un solo botón **Guardar** aplica todo.
   **Datos de Alegra guardados:** Artículos, Sin categoría, Combos, Secciones e Inicio leen una copia local de lo que Alegra devuelve, así que abren sin esperar a Alegra. Una barra («Datos de Alegra actualizados hace N min») muestra su antigüedad y el botón **Actualizar desde Alegra**; si una actualización falla, sigues viendo los datos guardados con el aviso del motivo y puedes reintentar. La copia se renueva a pedido y cada vez que pulsas **Preparar y revisar**.
8. **Generar catálogo:** pulsa **Preparar y revisar** (ves ítems omitidos y alertas; los artículos que omitiste aparecen aparte, en un aviso «N artículos omitidos por ti» con un enlace para administrarlos). Si cambias esa lista después de preparar, el sistema no genera con una lista distinta de la que revisaste: te pide preparar de nuevo. Luego eliges la **plantilla** (parte de la predeterminada y solo cambia esa generación), las **secciones a incluir** (con **Seleccionar todas / Quitar todas**), si **ocultas los agotados** y el **texto del banner** de esa generación; la **vista previa de estructura** (portadas, páginas de productos, contenido propio y total) se actualiza al instante, sin volver a consultar Alegra. Elige también la **calidad del PDF**: **Optimizada** (viene marcada) reduce las fotos al tamaño con el que se imprimen y el archivo queda mucho más liviano, ideal para enviarlo por correo o mensajería; **Original** conserva las fotos tal como están en Alegra y el archivo puede ser varias veces más grande. Cambiar la calidad no cambia nada más: el catálogo es el mismo. Decide qué hacer con los combos que tengan productos agotados y pulsa **Generar PDF**. Al terminar ves cuánto pesa el archivo (con un aviso si un PDF optimizado supera los 25 MB, el límite habitual de un adjunto de correo) y, si algún producto tiene un texto que no cupo completo (letra más pequeña o texto cortado con «…»), un aviso con sus nombres para agrandar la zona o la foto en Apariencia, o acortar el texto y puedes descargarlo desde la misma pantalla o desde **Historial**, que muestra el tamaño de cada catálogo (se guardan los 10 más recientes).

### Plantillas y editor de Apariencia

Una **plantilla** define cómo se ve el catálogo: cuatro páginas (portada, portada de sección, productos y políticas), una paleta de seis colores y un par tipográfico. La aplicación trae cinco de fábrica —**Neón Noche** (la predeterminada, igual al catálogo de siempre), **Pop crema**, **Kawaii pastel**, **Kraft minimal** y **Base AsianPop**— y puedes crear hasta 30. En una instalación anterior la quinta no se agrega sola: se crea desde la galería con «Nueva plantilla desde Base AsianPop».

- **Editor:** barra superior (← Menú, nombre de la plantilla, deshacer y rehacer, estado de guardado, Vista previa, «Usar» como predeterminada y Guardar), un riel con cuatro secciones, el lienzo con la página A4, la tira de las cuatro páginas con zoom (20 %–200 %) y el inspector.
  - **Plantillas:** la lista de plantillas y la galería (Editar, Duplicar, «Usar al generar», Eliminar; la predeterminada no se elimina).
  - **Elementos:** agrega títulos, textos, insignias, formas (rectángulo, círculo, píldora, línea), imágenes (logo, collage) y datos del catálogo.
  - **Estilo:** los seis colores (selector o `#RRGGBB`), cinco paletas sugeridas, «Restaurar colores originales», cinco pares tipográficos y un aviso si el contraste es bajo (no bloquea el guardado).
  - **Datos:** nombre de la tienda, banner (80 caracteres), teléfonos, dirección y políticas (3500 caracteres en total). Son únicos para todo el catálogo, no por plantilla.
- **Tamaño de los productos:** al seleccionar el bloque de productos, la primera sección del inspector es **Tamaño de los productos**: el ancho y el alto de la **zona** (mínimo 40 % × 30 % de la página) y el ancho y el alto de la **foto** (de 50 % a 150 % de su tamaño original, con el máximo que cabe según la distribución y la zona; si pides más, se recorta y una nota explica por qué). **Restaurar tamaños originales** vuelve a los de fábrica en un solo paso. El bloque nace «Fijo»: para arrastrarlo en la página pulsa **Desbloquear**.
- **Nombre del producto:** con el estilo **Separado**, el nombre de cada producto (de Alegra, propio o combo) va en su propio **rótulo**, fuera de la burbuja y de la foto, con el color, el fondo y el resplandor neón que elijas; Neón Noche lo trae así, como `docs/Cat.pdf`, con un rótulo oscuro y el nombre en neón. Con **Dentro de la burbuja** se ve como siempre.
- **Base AsianPop y foto-tarjeta:** esta plantilla reproduce la página de productos de la base hecha en Canva: título «CATÁLOGO <SECCIÓN>» en mayúsculas, tres productos en zigzag, burbuja beige con la descripción, precio con neón y cinta AGOTADO diagonal. Cada producto sale como una **foto-tarjeta** que la aplicación genera sola: tarjeta oscura con el nombre en neón y la foto de Alegra. En **Generar** aparece **Fondo de la foto** con una tarjeta de ejemplo: **Dejar como está** (marco claro sobre fondo oscuro desenfocado; el modo seguro y el predeterminado) o **Quitar el fondo automáticamente** (el producto flota sobre el fondo oscuro; si una foto no se puede separar con seguridad, esa foto se deja como está y el resumen final dice cuáles). Las tarjetas se guardan en una caché temporal (`data/card-cache/`), así que la segunda generación es más rápida.
- **Mis imágenes:** en el inspector de una imagen puedes subir tu propio logo o ilustraciones (PNG, JPG o WEBP, hasta 5 MB), elegirlas y borrarlas; una imagen que usa alguna plantilla no se puede borrar. Se guardan junto a las fotos de productos con el prefijo `tpl-`.
- **Consejos:** el botón **Consejos** de la barra superior abre una ayuda breve con lo anterior y los atajos; no cambia nada de la plantilla.
- **Mover y cambiar elementos:** arrastra para mover, usa la esquina para cambiar el tamaño (se ajusta al centro con una guía), o escribe los valores en el inspector. Atajos: flechas (0,5 %; 2 % con Mayús), `Supr`, `Ctrl+D` duplicar, `Ctrl+Z` / `Ctrl+Mayús+Z` deshacer y rehacer, `Esc` quitar la selección; no actúan mientras escribes en un campo. Los elementos pueden ocultarse, bloquearse y reordenarse desde la lista de capas.
- **Configuración avanzada del texto:** al seleccionar un texto, el inspector trae un panel plegable **Configuración avanzada** (cerrado por defecto; recuerda si lo abriste al cambiar de elemento) con tres ajustes, cada número con deslizador y campo para escribirlo: **Altura de línea** (0,5 a 2,5, pasos de 0,01; por defecto 1,05), **Espaciado** entre letras (−10 a 60 px, pasos de 0,1) y **Anclaje vertical** (Arriba, Centro o Abajo; por defecto Centro, que es como siempre se dibujó el texto). Un valor fuera de rango se ajusta al límite y uno no numérico se descarta. Con el texto bloqueado el panel se abre pero sus controles quedan deshabilitados. Las plantillas anteriores se ven y se exportan igual.
- **Selectores de color y de fuente:** cada propiedad de color del inspector (relleno, contorno, resplandor, fondo, texto…) es un botón que muestra el color activo y abre un panel junto al control (se cierra con Escape, «Cerrar» o un clic fuera, y devuelve el foco al botón). El panel ofrece primero **Colores de la plantilla** (los seis de la paleta y los colores libres que ya usa cualquier página, sin repetir; hasta 18 y «Ver todos»), después diez **colores básicos**, «Ninguno» o «Transparente» donde existen, el selector gráfico del navegador de siempre y, si el navegador lo permite, un **cuentagotas**. Un buscador acepta un código (`e91e8c`, `#E91E8C` o `#e91`) o parte del nombre sin importar mayúsculas ni tildes; un código inválido no cambia nada. Una clave de la paleta se guarda como clave (sigue a la paleta si cambia) y un color libre como `#RRGGBB` en mayúsculas. La **fuente** se elige en un panel donde cada familia se escribe con su propia tipografía y la activa lleva una marca; «Fuentes de la plantilla» (Título, Cuerpo y las que ya usan los elementos) va antes de «Todas las fuentes» (las seis de siempre), con buscador. Elegir lo que ya está activo no agrega un paso de deshacer. Con el elemento bloqueado ambos selectores quedan deshabilitados. Los formatos guardados y el PDF no cambian.
- **Bloques automáticos:** productos, políticas, introducción de sección y pie se llenan solos con los datos de Alegra y de Contenido propio. No se eliminan, ocultan ni duplican, pero sí se mueven, se redimensionan y cambian de estilo (distribución, estilo de agotado…). Si uno llega al tamaño mínimo legible (6 pt) y aun así no cabe, el inspector lo avisa; al generar, Generar también lista los productos con texto que no cupo completo.
- **Datos insertables:** `{banner}`, `{seccion}`, `{telefonos}`, `{direccion}` y `{tienda}` en un texto, una insignia o el pie se reemplazan por el dato real en el lienzo, la vista previa y el PDF. El banner de una generación (`Generar catálogo`) reemplaza a `{banner}` solo en esa vez.
- **Guardar:** una sola acción guarda todas las plantillas, la predeterminada y los datos. Si algo no es válido no se guarda nada; si guardas desde otra pestaña antes, recibes «cambió, recarga» y no se pisa nada. Salir o cerrar la pestaña con cambios pendientes pide confirmación.
- **Fidelidad:** el lienzo, las miniaturas, la vista previa y el PDF usan el mismo componente, así que el PDF muestra lo mismo que ves. La plantilla solo cambia la apariencia: la estructura (páginas, máximo 3 productos por hoja, precios, agotados, combos) no cambia.
- Las **tipografías** (Fredoka, Poppins, Bungee, Zen Maru Gothic, Space Grotesk y DM Serif Display) se instalan en local; el PDF no necesita internet.

### Reglas del catálogo

- Máximo 3 productos por página; categorías vacías no generan portada.
- Productos con inventario en 0 muestran el sello **AGOTADO** (puedes ocultarlos al preparar). Ocultar agotados también oculta, sin preguntar, los combos que tengan un componente agotado.
- Productos y combos **sin imagen** no se incluyen; se listan en la revisión.
- Los **artículos omitidos** (pantalla Artículos de Alegra) no salen en la vista previa ni en el PDF, aunque estén agotados, y no generan avisos de sin foto, sin sección ni agotado. Un combo que usa un artículo omitido no cambia. La omisión sigue al artículo de Alegra, no a su nombre: si le cambias el nombre o el precio en Alegra, sigue omitido; un artículo nuevo entra incluido.
- Los combos con un componente agotado piden una decisión: mantener con sello u omitir. Solo se piden para las secciones que vas a incluir.
- Las páginas de producto y la de políticas llevan un **pie con teléfonos y dirección**; las portadas conservan su bloque «Domicilios».
- Los textos largos (nombres, descripciones, opciones de precio, políticas, dirección, banner) reducen su letra y se parten en líneas para verse completos (hasta 6 pt); solo si ni así caben se muestran con «…», y Generar lo avisa al terminar. Nunca desbordan ni agregan páginas.
- **Nombre separado:** con el estilo Separado el nombre de cada producto va en un rótulo propio y la burbuja solo trae la descripción y los datos extra (si no tiene ninguno, no se dibuja). El sello AGOTADO nunca oculta el nombre ni el precio.
- **El PDF siempre sale de datos recién descargados:** **Preparar y revisar** consulta Alegra en ese momento (precios, inventario y fotos) y deja esa descarga como la copia guardada; la copia local solo alimenta las pantallas de consulta. Si Alegra no responde al preparar, no se genera ningún PDF.
- Las **políticas de compra** admiten hasta **3500 caracteres en total** (más no caben en una página).
- La plantilla cambia solo la apariencia (colores, tipografías, fondos, posición y estilo de los elementos); las imágenes de portada y el mármol de `docs/Cat.pdf` siguen disponibles como imágenes y fondos de cualquier plantilla.
- La generación es **manual**.

## Desarrollo

```bash
npm run dev          # servidor con recarga (API en :3000)
npm run dev -w frontend   # interfaz con Vite (proxy a :3000)
npm test             # pruebas de backend y frontend
npm run test:pdf     # genera un PDF de muestra con datos simulados y lo verifica
npm run lint
```

Las pruebas con Alegra usan un servidor simulado; nunca consultan la cuenta real.

Con la suite de backend completa en paralelo, el cierre de Chrome en alguna prueba con navegador real (`pdf-render`, `panel-layout`, `editor-browser`) puede agotar el tiempo de forma intermitente en Windows. No es un fallo del código: esas suites pasan siempre que se ejecutan solas, por ejemplo `npm run test:pdf` o `npx vitest run tests/integration/panel-layout.test.ts` dentro de `backend/`. Corre las pruebas desde una ruta sin carpetas ocultas (con punto, como `.claude/`); si no, Chrome responde «Not Found».

Revisión visual (herramientas manuales, no forman parte de `npm test`):

```bash
# Capturas PNG de cada página de un catálogo de muestra (LONG=1 usa textos en el máximo permitido, TEMPLATE=neon|pop|kawaii|kraft|base la plantilla)
OUT=capturas npx tsx backend/tests/fixtures/visual-sample.ts
# Páginas concretas de un PDF, por ejemplo de docs/Cat.pdf, para compararlas
PDF=docs/Cat.pdf PAGES=1,4,38 OUT=capturas npx tsx backend/tests/fixtures/pdf-pages.ts
# Comprobar que las plantillas anteriores no cambian (8 PDF byte a byte): capturar con el código de antes y comparar con el de ahora
BASELINE_DIR=carpeta npx tsx backend/tests/fixtures/pdf-baseline.ts capture
BASELINE_DIR=carpeta npx tsx backend/tests/fixtures/pdf-baseline.ts compare
# Peso y tiempos de un catálogo sintético de ~180 productos con Base AsianPop (BACKDROP=marco|sin-fondo)
PRODUCTS=180 npx tsx backend/tests/fixtures/card-perf.ts
```

Para probar a mano el editor con datos de muestra, usa una carpeta de datos temporal y un Alegra simulado (con una sección propia con introducción, un producto agotado y un combo con un componente agotado):

```bash
DATA_DIR=/tmp/asiapop-prueba PORT=3955 ALEGRA_BASE_URL=http://127.0.0.1:3920 npm start
APP_URL=http://127.0.0.1:3955 npx tsx backend/tests/fixtures/dev-mock.ts
# Capturas del editor y de las pantallas (OUT=carpeta) y medición de tiempos con 60 elementos
APP_URL=http://127.0.0.1:3955 OUT=capturas-editor npx tsx backend/tests/fixtures/editor-shots.ts
APP_URL=http://127.0.0.1:3955 npx tsx backend/tests/fixtures/editor-perf.ts
```

Las pruebas de `backend/tests/integration/editor-browser.test.ts` y `panel-layout.test.ts` usan `frontend/dist`: corre `npm run build` antes de `npm test` si cambiaste el frontend.

Las fuentes del panel y del catálogo se instalan en local (`@fontsource`); la aplicación no carga nada de internet salvo Alegra.

## Datos y seguridad

- Los datos locales viven en `data/` (base SQLite, imágenes, caché de fotos de Alegra en `data/image-cache/`, PDF generados); está fuera de git.
- Los **datos de Alegra guardados** (artículos y categorías, sin credenciales ni direcciones de fotos) viven en `data/app.db`. Se actualizan a pedido y al preparar el catálogo, sobreviven a un reinicio y no se muestran con otra cuenta de Alegra. Alegra sigue siendo de solo lectura: todas las descargas son `GET`.
- El token de Alegra se guarda cifrado (AES-256-GCM) y no aparece en respuestas ni en logs.
- La aplicación solo atiende desde `localhost`; todas las rutas exigen sesión.

## Solución de problemas

| Síntoma | Qué hacer |
| --- | --- |
| «El archivo data/encryption.key está dañado» | Bórralo y vuelve a guardar el token en «Conexión Alegra» |
| «Could not find Chrome» al generar | Instala Chrome o Edge, o define `PUPPETEER_EXECUTABLE_PATH` |
| «Alegra rechazó las credenciales» | Revisa el correo y el token en la configuración de Alegra |
| «Alegra limitó las peticiones» | Espera un minuto y vuelve a preparar |
| Un producto no sale en el catálogo | Revisa el informe: puede no tener imagen, categoría o sección, o lo omitiste en **Artículos de Alegra** (vista «Omitidos») |
| Los precios o el inventario de una pantalla no coinciden con Alegra | Pulsa **Actualizar desde Alegra** en la barra de la pantalla. El catálogo siempre se prepara con datos recién descargados |
| «No se pudo actualizar desde Alegra» | Sigues viendo los datos guardados (con su antigüedad); revisa la conexión y pulsa **Reintentar** |
| «Cambiaste los artículos omitidos después de preparar» | Pulsa **Preparar y revisar** otra vez y genera de nuevo |

## Documentación del diseño

- [`specs/001-catalog-pdf-generator/`](specs/001-catalog-pdf-generator/): el generador de catálogo (conexión con Alegra, productos propios, combos, PDF).
- [`specs/002-admin-panel-theming/`](specs/002-admin-panel-theming/): el panel de administración con estilo Pop, las opciones de generación, la vista previa de estructura y el editor de tema (reemplazado por el editor de plantillas de la feature 003).
- [`specs/010-base-template-product-card/`](specs/010-base-template-product-card/): la plantilla Base AsianPop y la foto-tarjeta generada (con quitar el fondo y respaldo seguro), las imágenes de plantilla subidas y su validación (peso, tiempos y comparación byte a byte con las plantillas anteriores).
- [`specs/003-catalog-template-editor/`](specs/003-catalog-template-editor/): el editor visual de plantillas del catálogo, las cuatro plantillas base, la plantilla por generación y los ajustes de paridad con el mockup. Su revisión visual está en [`visual-review.md`](specs/003-catalog-template-editor/visual-review.md).
- [`specs/004-fix-alegra-images/`](specs/004-fix-alegra-images/): las fotos reales de Alegra y el informe de las que no se pueden obtener.
- [`specs/005-optimize-pdf-size/`](specs/005-optimize-pdf-size/): la calidad del PDF (Optimizada u Original) y el tamaño de cada catálogo.
- [`specs/006-omit-alegra-articles/`](specs/006-omit-alegra-articles/): omitir artículos de Alegra del catálogo, de forma permanente y solo local.
- [`specs/007-product-layout-alegra-cache/`](specs/007-product-layout-alegra-cache/): el tamaño de la zona y de la foto de los productos, el nombre separado en neón, los datos de Alegra guardados en el equipo, la pantalla de carga y el filtro por categorías de Artículos, y el botón Consejos de Apariencia.
- [`specs/008-text-advanced-settings/`](specs/008-text-advanced-settings/): la configuración avanzada del texto (altura de línea, espaciado entre letras, tachado y anclaje vertical) y su revisión manual.
- [`specs/009-color-font-pickers/`](specs/009-color-font-pickers/): los selectores de color (con colores de la plantilla, buscador y cuentagotas) y de fuente del inspector, y su revisión manual.
- [`specs/011-text-shadow-background/`](specs/011-text-shadow-background/): la sombra y el fondo del texto, y «Agregar subtítulo».
- [`specs/012-canva-text-styles/`](specs/012-canva-text-styles/): texto estilo Canva (cursiva, subrayado, justificado, listas, panel de efectos en cuadrícula, curvar y copiar estilo).
- [`specs/013-canva-elements-shapes/`](specs/013-canva-elements-shapes/): elementos y formas estilo Canva (formas nuevas, estilo de borde, línea con extremos, voltear, bloquear proporción y enlaces clicables).

Cada carpeta tiene especificación, plan, modelo de datos, contrato REST y tareas. El proyecto sigue [Spec Kit](https://github.com/github/spec-kit).
