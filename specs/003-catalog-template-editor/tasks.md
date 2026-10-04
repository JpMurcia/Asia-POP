# Tasks: Editor visual de plantillas del catálogo

**Input**: Documentos de diseño en `/specs/003-catalog-template-editor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rest-api.md](./contracts/rest-api.md), [quickstart.md](./quickstart.md). Requiere las features 001 y 002 funcionando (`npm test` en verde antes de empezar) y la constitución en v1.1.0. La aprobación visual del responsable de 002 (sus T057 y T062) sigue abierta: se valida junto con SC-003 (T099).

**Tests**: Incluidos. La constitución (principio V) exige pruebas para las reglas de negocio y el plan (research §12) define las pruebas nuevas. Escribe cada prueba **antes** de su implementación y comprueba que falla. Las pruebas de Alegra usan el servidor simulado.

**Organization**: Tareas agrupadas por historia de usuario. **Las fases de US2 y US1 (ambas P1) van en ese orden** porque el editor reutiliza el render de plantillas y el PDF que se construye en US2. Entre el final de US2 y el final de US1 la pantalla Apariencia antigua deja de afectar al PDF: no publicar entre ambas.

**Control de versiones**: el proyecto ya es un repositorio git (rama `main`), pero 003 se implementó antes de que lo fuera y el commit inicial solo contiene el código resultante. Por eso T004 dejó una línea base de 002 en `specs/003-catalog-template-editor/visual/baseline-002/` antes de que T040 y T067 eliminaran código, y esa copia sigue siendo la única referencia de los componentes antiguos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US6)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)). El módulo compartido y puro vive en `backend/src/catalog/` sin importar nada de Node, para que el frontend lo importe.

---

## Phase 1: Setup

**Purpose**: dependencias, punto de partida verificado y línea base del render actual.

- [X] T001 [P] Agregar `@fontsource/bungee`, `@fontsource/zen-maru-gothic`, `@fontsource/space-grotesk` y `@fontsource/dm-serif-display` (v5.3.0) a `frontend/package.json` y ejecutar `npm install` en la raíz
- [X] T002 [P] Crear `frontend/src/print/fonts.css` que importe los pesos necesarios de las seis familias: Poppins 400/500/600/700, Fredoka 400/500/600/700, Zen Maru Gothic 400/500/700/900, Space Grotesk 400/500/700, Bungee 400 y DM Serif Display 400
- [X] T003 Ejecutar `npm test`, `npm run build` y `npm run lint` en la raíz y anotar en el mensaje de la tarea cualquier fallo previo, para distinguirlo de regresiones propias
- [X] T004 Capturar la **línea base del render de 002** antes de tocar el render: con `backend/tests/fixtures/visual-sample.ts` (variables `OUT`, `PDF=ruta` y `LONG=1` para textos máximos) generar el PDF y una captura PNG por página —portada, portada de sección, productos con un producto agotado, una sección propia (introducción, opciones y sabores), políticas— con textos normales y máximos, y guardarlos en `specs/003-catalog-template-editor/visual/baseline-002/`; copiar también `frontend/src/print/` a `specs/003-catalog-template-editor/visual/baseline-002/src-print/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: módulo compartido de plantillas, esquema, plantillas base, migración, repositorio, rutas y componentes de render. **Todo es aditivo**: la aplicación sigue funcionando con el tema de 002 hasta que US2 cambie el payload. Ninguna historia empieza antes de completar esta fase.

### Módulo compartido, esquema y plantillas base

- [X] T005 [P] Escribir pruebas unitarias de `resolveTokens` (los 5 marcadores; `{telefonos}` une teléfonos no vacíos con ` · ` sin separadores sobrantes; marcador de dato vacío no deja residuo; `{seccion}` vacío; marcador desconocido queda tal cual), `resolveColor` (clave de paleta, `#RRGGBB`, `none`/`transparent`), `paletteWarnings` (la paleta de `neon` no da avisos; `Texto`/`Papel` < 4,5; blanco/`Fondo` < 4,5; acento/`Fondo` < 3) y de `REQUIRED_BLOCKS` por página en `backend/tests/unit/template.test.ts`
- [X] T006 [P] Escribir pruebas unitarias de `layoutRows` para las tres distribuciones (`alternado`, `tarjetas`, `lista`): siempre 3 filas; foto, burbuja y precio de cada fila caben dentro de la caja del bloque; sin solapes entre foto, burbuja y precio de una misma fila; `alternado` alterna izquierda y derecha; resultado determinista, en `backend/tests/unit/layout-rows.test.ts`
- [X] T007 [P] Escribir pruebas unitarias del esquema de plantillas (documento válido pasa; `ColorRef` inválido, número fuera de rango, bloque obligatorio ausente o repetido por página, bloque automático en página equivocada, nombre vacío o de más de 60 caracteres, más de 30 plantillas, más de 60 elementos, ids de elemento repetidos, predeterminada inexistente, ninguna plantilla; los errores traen la ruta del campo) en `backend/tests/unit/template-schema.test.ts`
- [X] T008 Implementar el módulo puro (sin importaciones de Node) en `backend/src/catalog/template.ts`: tipos de [data-model.md](./data-model.md) (`Template`, `TemplateDoc`, `Palette`, `Page`, unión `Element` con los nombres de campo `textColor`/`boxFill` de los bloques, `FontKey`, `ImageKey`, `ColorRef`, `WorkspaceState`, `TemplateSummary`), constantes (`PAGE_W = 595.28`, `PAGE_H = 841.89`, `MIN_FONT_PX = 6`, `PAGE_KEYS`, `PALETTE_KEYS`, `FONT_KEYS`, `IMAGE_KEYS`, rangos y límites), `REQUIRED_BLOCKS`, `resolveTokens`, `resolveColor` y `paletteWarnings`; reutiliza `isHexColor` y `contrastRatio` de `backend/src/catalog/theme.ts`
- [X] T009 Implementar `layoutRows(layout, W, H)` (puro) en `backend/src/catalog/template-layout.ts`: devuelve 3 filas `{ photo, bubble, price, align, separatorY? }` en px lógicos; `tarjetas` y `lista` con las fórmulas del mockup (`Apariencia Editor.dc.html`, función `rows`); `alternado` con la fórmula del mockup como primera versión (T039 la calibra)
- [X] T010 Implementar el esquema zod en `backend/src/catalog/template.schema.ts` (solo servidor): `workspaceSchema` con rangos y límites de [data-model.md](./data-model.md), bloques obligatorios por página según `REQUIRED_BLOCKS`, ids únicos por página y predeterminada existente; mensajes en español con ruta del campo
- [X] T011 [P] Escribir pruebas de las plantillas base: las 4 validan contra `workspaceSchema`; paletas de `neon`, `pop`, `kawaii` y `kraft` iguales a las del mockup (`PAL_PRESETS`); 5 paletas sugeridas; 5 pares tipográficos; `baseTemplate(id)` devuelve una copia independiente, en `backend/tests/unit/template-presets.test.ts`
- [X] T012 Implementar en `backend/src/catalog/template-presets.ts` (puro): `BASE_TEMPLATES` con `neon` (primera versión siguiendo el mockup más la imagen `frame` y el bloque `intro`; T038 la calibra), `pop`, `kawaii` y `kraft` (según `makePresets` del mockup, agregando el bloque `intro` en su página `seccion`), `PALETTE_PRESETS` (5), `FONT_PAIRS` (5) y `baseTemplate(id)`

### Migración, repositorio y rutas

- [X] T013 Crear la migración `backend/src/db/migrations/003_templates.sql` con `catalog_template` y `template_workspace` según [data-model.md](./data-model.md) (sin tocar `catalog_theme`)
- [X] T014 [P] Escribir pruebas de siembra y migración: base nueva ⇒ 4 plantillas, predeterminada `neon`, `revision = 1` y paleta de fábrica; con una fila en `catalog_theme` ⇒ la paleta de `neon` toma sus cuatro colores y las otras plantillas no cambian; segunda lectura no vuelve a sembrar; `catalog_theme` queda intacta; **llamar a `resolve()` y a `summary()` sobre una base de 002 sin haber abierto antes `getWorkspace()` siembra por sí solo y devuelve `neon` con los colores del tema guardado** (una generación en una base recién migrada no debe encontrar el repositorio vacío), en `backend/tests/integration/template-migration.test.ts`
- [X] T015 [P] Escribir pruebas de integración de `GET/PUT /api/settings/templates` y `GET /api/settings/templates/summary`: `401` sin sesión; primera lectura siembra; guardado correcto incrementa `revision` y escribe también los datos del negocio; `422 invalid_templates` y `422 invalid_business` no escriben nada (ni plantillas ni negocio); `409 templates_changed` con revisión vieja; `PUT /api/settings/business` también incrementa la revisión; la predeterminada debe existir; cuerpo de ~1,5 MB aceptado; `warnings` de contraste no bloquean; el token de Alegra no aparece, en `backend/tests/integration/templates.test.ts`
- [X] T016 Implementar `TemplateRepo` en `backend/src/catalog/template.repo.ts`: `ensureSeeded()` idempotente (aplica `catalog_theme` a `neon`) **llamado por todos los métodos públicos** (`getWorkspace`, `save`, `touch`, `resolve`, `summary`), `getWorkspace()`, `save(workspace, expectedRevision)` en una transacción (borra ausentes, reemplaza, fija predeterminada, escribe `BusinessSettingsRepo`, incrementa `revision`; `HttpError 409 templates_changed` si no coincide), `touch()`, `resolve(templateId?)` ⇒ `{ template, fallback }` con reemplazo por la predeterminada y `summary()`
- [X] T017 Implementar `backend/src/api/templates.routes.ts` (GET, PUT con `parseOr422` para plantillas y validación aparte del negocio con código `invalid_business`, `warnings` por plantilla desde `paletteWarnings`, y `summary`); exportar el esquema de negocio desde `backend/src/api/business.routes.ts` y hacer que su `PUT` llame a `TemplateRepo.touch()`; montar las rutas en `backend/src/app.ts` con `app.use('/api/settings/templates', express.json({ limit: '2mb' }))` **antes** del `express.json({ limit: '1mb' })` global

### Render de plantillas (frontend, aditivo)

- [X] T018 [P] Implementar `frontend/src/print/assets.ts`: registro `IMAGES` (`logo` ⇒ `assets/print/logo.png`, `collage`, `marble`, `coverbg` ⇒ `cover-bg.jpg`, `frame`), `FONT_STACKS` de las seis familias, `fontFamily(template, ref)` (`'title'`/`'body'`/clave) y `weightFor(fontKey, weight)` que mapea 400/600/700/900 al peso disponible más cercano de cada familia
- [X] T019 Extender `useFit` en `frontend/src/print/useFit.ts`: reducir también por ancho (opción `axis: 'height' | 'width' | 'both'`, por defecto `'height'` para no cambiar a los llamadores actuales); opción `minFontPx` (por defecto 6) que fija el factor mínimo como `máx(MIN_FIT, minFontPx / tamaño base en px del elemento)`; escribir `data-overflow="true"` en el elemento cuando llega a ese mínimo y aún no cabe (y quitarlo si cabe)
- [X] T020 [P] Escribir pruebas del render de plantillas en `frontend/tests/template-page.test.tsx`: `TemplatePage` ubica cada elemento con `left/top/width/height` en % (y `data-el-id`); un elemento oculto no se pinta; los colores de paleta se resuelven y al cambiar la paleta cambian; modo impresión usa contenedor 210×297 mm y escala 4/3; **el contenedor de la página tiene `overflow: hidden` y un elemento colocado parcialmente fuera de la hoja no cambia su tamaño**; los marcadores se reemplazan; los textos con marcadores llevan `data-fit="true"` y los textos libres no; el fondo de imagen usa `<img>`; `ProductsBlock` muestra AGOTADO en los tres estilos solo para ítems agotados y nunca para `custom`, conserva `data-testid="product-card"`/`data-sold-out`, y para productos propios y combos muestra opciones, sabores e "Incluye:"; `IntroBlock` no se pinta sin `introText`; `FooterBlock` resuelve marcadores y conserva `data-testid="page-footer"`
- [X] T021 [P] Implementar `frontend/src/print/blocks/ProductsBlock.tsx` (+ `products-block.css`): usa `layoutRows` con el tamaño lógico de la caja; foto con fondo, anillo y esquinas; burbuja con la lógica de contenido de `frontend/src/print/ProductCard.tsx` (nombre si no hay descripción, opciones y sabores de productos propios, "Incluye:" de combos) con `useFit`; etiqueta de precio con forma y colores; estilos de agotado `sello` (imagen `sold-out.png` + etiqueta invisible buscable), `cinta` y `gris` (con etiqueta AGOTADO visible); solo si `item.kind !== 'custom' && item.soldOut`; marca sus partes con `data-part="photo|bubble|price"`; acepta `photoPositions?` para los datos de muestra del editor
- [X] T022 [P] Implementar `frontend/src/print/blocks/TermsBlock.tsx` (+ `terms-block.css`): título como chip y texto en caja, con `useFit` y `data-overflow`; marca el cuerpo con `data-part="terms-body"`
- [X] T023 [P] Implementar `frontend/src/print/blocks/FooterBlock.tsx` (+ `footer-block.css`): una línea con `resolveTokens(content)`, `useFit` por ancho y puntos suspensivos como último recurso; `data-testid="page-footer"` y `data-part="footer"`
- [X] T024 [P] Implementar `frontend/src/print/blocks/IntroBlock.tsx` (+ `intro-block.css`): caja con `introText` y `useFit`; devuelve `null` si la sección no tiene introducción; `data-part="intro"`
- [X] T025 Implementar `frontend/src/print/TemplateElement.tsx` y `frontend/src/print/template.css`: envoltorio absoluto con `data-el-id`/`data-el-type`, posición en %, rotación, opacidad y `display: none` si está oculto; renderiza texto (flex, fuente, tamaño como `calc(Npx * var(--fit, 1))`, peso con `weightFor`, color, contorno con `-webkit-text-stroke` y `paint-order`, resplandor, espaciado, mayúsculas, `white-space: pre-wrap; overflow-wrap: anywhere`), insignia, forma y imagen (`<img>` con `object-fit`; radio ≥ 300 ⇒ círculo); **los textos e insignias cuyo contenido tiene marcadores `{…}` usan `useFit` por ambos ejes y llevan `data-fit="true"`**; delega en los bloques para `intro`, `products`, `terms` y `footer`
- [X] T026 Implementar `frontend/src/print/TemplatePage.tsx`: props `{ template, page, tokens, items?, terms?, introText?, scale | mode: 'print', testId }`; contenedor de `595,28 × 841,89` px lógicos con `transform: scale(s)` y **`overflow: hidden`** (lo que sale de la hoja se recorta); en modo impresión, contenedor de `210mm × 297mm`, escala 4/3, `break-after: page` y clase `a4-page`; fondo de color, degradado vertical o imagen (con `<img>` absoluto, para que `whenAssetsReady` de `Print.tsx` la espere); elementos en el orden del arreglo; importa `fonts.css` y `template.css`

**Checkpoint**: `npm test` y `npm run build` en verde; la base sembrada, el guardado atómico y `TemplatePage` pasan sus pruebas. La aplicación se comporta igual que antes (el PDF aún usa el tema de 002).

---

## Phase 3: User Story 2 - Generar el PDF con la plantilla elegida (Priority: P1) 🎯 MVP

**Goal**: el PDF se dibuja con la plantilla predeterminada (Neón Noche reproduce el catálogo actual con las dos diferencias aceptadas) o con otra elegida solo para esa generación, y coincide con el modelo del editor.

**Independent Test**: con Neón Noche sin tocar, generar y comparar con el PDF de 002 y `docs/Cat.pdf`; guardar una plantilla con un elemento en otra posición y generar con ella (quickstart escenarios 11, 12 y 13).

### Tests for User Story 2

- [X] T027 [P] [US2] Pruebas de integración de plantilla en la generación: `templateId` en `POST /api/catalog/prepare` y `PUT …/options`; `GET /api/catalog/payload/:id` trae `template` refrescada con la guardada tras preparar; un `templateId` inexistente cae a la predeterminada y `POST /api/catalog/generate` responde `202 { jobId, template: { id, name, fallback: true } }`; la estructura no cambia con la plantilla; **generar en una base de 002 recién migrada, sin haber abierto Apariencia, usa `neon` con los colores del tema guardado**, en `backend/tests/integration/generation-template.test.ts`
- [X] T028 [P] [US2] Prueba de fidelidad con Puppeteer en `backend/tests/integration/pdf-template-fidelity.test.ts` (sigue el patrón de `print-overflow.test.ts`): para cada plantilla base y cada tipo de página, abrir la vista de impresión y comprobar contra el documento que cada elemento visible (`[data-el-id]`) cumple: posición y tamaño (`offsetLeft/offsetTop/offsetWidth/offsetHeight`, sin girar) a 1 % o menos de la página; `color`, `font-family` y `opacity` calculados; rotación; y orden en el DOM igual al orden de apilado; los elementos ocultos no existen en el DOM; un elemento colocado parcialmente fuera de la hoja no cambia el número de páginas ni el ancho del documento; páginas del PDF (`pdf-parse`) = `structure.totalPages`; teléfonos y dirección en el pie de cada página de producto y de políticas. **Reemplaza** `backend/tests/integration/pdf-theme.test.ts`, que se elimina
- [X] T029 [P] [US2] Prueba de estilos de agotado en `backend/tests/integration/pdf-sold-out-styles.test.ts`: con `sello`, `cinta` y `gris` el texto AGOTADO aparece en el PDF para el producto agotado de Alegra y no aparece para un producto propio
- [X] T030 [P] [US2] **Reescribir** `backend/tests/integration/print-overflow.test.ts` con los selectores nuevos (`[data-part="bubble"]`, `[data-part="price"]`, `[data-part="photo"]`, `[data-part="terms-body"]`, `[data-part="intro"]`, `[data-part="footer"]` y los textos con `data-fit="true"`) en lugar de las clases antiguas; con textos en el máximo permitido y las cuatro plantillas base: nada desborda su caja ni la hoja, nada pisa el logo, el collage ni el pie, y **ningún elemento lleva `data-overflow="true"`** (el mínimo de 6 pt basta)
- [X] T031 [P] [US2] Prueba de `CatalogDocument` en `frontend/tests/catalog-document.test.tsx`: una portada, una portada por sección, una página de productos por cada bloque de ≤ 3 ítems, y la página de políticas solo si hay políticas; cada página trae su `data-testid` (`cover-page`, `section-cover`, `catalog-page`, `terms-page`); **reemplaza** `frontend/tests/print.test.tsx` y `frontend/tests/print-theme.test.tsx`
- [X] T032 [P] [US2] Actualizar `frontend/tests/generate.test.tsx`: el selector de plantilla parte de la predeterminada, envía `templateId` en `prepare` y `options`, no cambia la predeterminada y muestra un aviso cuando `generate` responde `fallback: true`

### Implementation for User Story 2

- [X] T033 [US2] Actualizar `backend/src/catalog/types.ts`: quitar `theme` de `CatalogConfig`, agregar `template: Template` a `CatalogPayload` y `templateId?: string` a `GenerationOptions`
- [X] T034 [US2] Cambiar `buildCatalog` en `backend/src/catalog/catalog-builder.ts` para recibir `template` en lugar de `theme` y devolverla en el payload; actualizar `backend/tests/unit/catalog-builder.test.ts`, `backend/tests/unit/generation-options.test.ts` y `backend/tests/integration/generation-options.test.ts`
- [X] T035 [US2] Actualizar `backend/src/catalog/catalog.service.ts`: `templateId` en `PrepareParams` y `GenerationOptions`; la plantilla se resuelve al construir con `TemplateRepo.resolve(options.templateId)` (reemplazando `currentTheme()`); `generate` devuelve `{ jobId, template: { id, name, fallback } }`
- [X] T036 [US2] Actualizar `backend/src/api/catalog.routes.ts`: `templateId` (texto ≤ 80) en `prepareSchema` y `optionsSchema`; `GET /catalog/payload/:id` refresca `template` con la guardada (en lugar de `config.theme`); `POST /catalog/generate` responde `202 { jobId, template }`
- [X] T037 [US2] Reescribir `frontend/src/print/CatalogDocument.tsx` con `TemplatePage` en modo impresión: portada → por sección (portada de sección + páginas de productos) → políticas (solo si hay políticas); contexto de marcadores con `config` (el banner ya incluye `bannerText`), nombre de cada sección e `introText`

### Calibración de Neón Noche (antes de eliminar el render antiguo)

- [X] T038 [US2] Calibrar `neon` en `backend/src/catalog/template-presets.ts` contra el render de 002 (valores de `frontend/src/print/print.css`, que sigue disponible hasta T040 y copiado en `visual/baseline-002/src-print/`; **multiplicar los px por 0,75** porque la hoja actual mide 794 px y la lógica 595,28): portada y sección sobre `coverbg` con imagen `frame` (inset horizontal 1,4 %); título `{banner}` en y 29,5 %, alto 8,2 %, 30 px lógicos, color `bg`, resplandor `a1`; collage en x 14,9 %, y 37,9 %, ancho 78,8 %, alto 41 %; título `{seccion}` en x 4 %, y 36 %, ancho 92 %, alto 18 %, 88 px, contorno `a1` de 3 px; bloque `intro` en x 14 %, y 56 %, ancho 72 %, alto 26 %; textos "Domicilios" + `{telefonos}` abajo a la derecha (sin íconos: diferencia aceptada); productos con "Catálogo {seccion}" en mayúsculas `#111111`, imagen `logo` arriba a la derecha, bloque de productos y pie `bg` con línea `a3`; políticas con título, logo, bloque `terms` (chips `bg`/`a1`, caja `#E8DFD0`) y pie
- [X] T039 [US2] Calibrar `alternado` en `backend/src/catalog/template-layout.ts` con la geometría de 002 (fila de 27 % de alto cada 29,1 %, primera fila al 10,4 %; foto del 29 % de ancho con `left` 14,7 % / `right` 20,5 %; burbuja del 40 % con `left` 40 % / 12,5 %, alto máximo 61 %; precio al 82 % de la fila y centrado en 56 % / 32,5 %), con bloque de `neon` x 0, y 10,4, ancho 100, alto 85,2; agregar valores de referencia a `backend/tests/unit/layout-rows.test.ts`
- [X] T040 [US2] Eliminar los componentes fijos reemplazados, **después de T038 y T039** (`frontend/src/print/CatalogPage.tsx`, `CoverPage.tsx`, `SectionCover.tsx`, `TermsPage.tsx`, `ProductCard.tsx`, `FooterInfo.tsx`, `Contact.tsx`) y reducir `frontend/src/print/print.css` a `@page`, `.print-root` y la hoja A4; conservar `frontend/src/print/theme-vars.ts`, que aún usa la pantalla antigua hasta T067

### Resto de US2 y revisión visual

- [X] T041 [US2] Hacer que `frontend/src/pages/Print.tsx` espere también las imágenes de fondo y de elementos de la plantilla antes de marcar `window.__printReady` (precargar cada URL de `IMAGES` usada por el payload), además de `document.fonts.ready`
- [X] T042 [US2] Agregar a `frontend/src/pages/Generate.tsx` el selector de plantilla (nombre, marca "Predeterminada" y puntos de paleta) alimentado por `GET /api/settings/templates/summary`; enviar `templateId` en `prepare` y `options`; mostrar el aviso cuando `generate` responde `fallback: true`
- [X] T043 [US2] Actualizar `backend/tests/fixtures/visual-sample.ts` para elegir plantilla con la variable `TEMPLATE=neon|pop|kawaii|kraft` (reemplaza `THEME=custom`) y guardar una captura por página
- [X] T044 [US2] Generar capturas de `neon` (catálogo normal y con textos máximos) y de las otras tres bases en `specs/003-catalog-template-editor/visual/`, y escribir `specs/003-catalog-template-editor/visual-review.md` comparando `neon` con `visual/baseline-002/` y con `docs/Cat.pdf`: confirmar que las únicas diferencias son las dos aceptadas (íconos de WhatsApp y Fredoka 700 en lugar de Fredoka One), listar cualquier otra y dejar las casillas de aprobación del responsable (SC-003)

**Checkpoint**: el PDF de cada plantilla base se genera, las pruebas de fidelidad, agotado y desbordamiento pasan y Generar permite elegir plantilla. User Story 2 funciona sola (el editor aún no existe).

---

## Phase 4: User Story 1 - Editar el diseño de las páginas en un editor visual (Priority: P1)

**Goal**: editor a pantalla completa con lienzo, elementos, inspector, capas, deshacer/rehacer, vista previa y guardado atómico.

**Independent Test**: abrir el editor, en Portada agregar un título, moverlo, cambiar su color y tamaño, deshacer y rehacer, guardar, recargar y comprobar que persiste; en Productos comprobar que el bloque de productos no se puede eliminar (quickstart escenarios 2 a 6 y 10).

### Tests for User Story 1

- [X] T045 [P] [US1] Pruebas del reductor del editor en `frontend/tests/template-editor-reducer.test.ts`: agregar, mover, redimensionar, cambiar propiedad, eliminar, duplicar (copia desplazada 3 %/2 % y nombre "… copia"), al frente/atrás, bloquear, ocultar; los bloques automáticos rechazan eliminar, ocultar y duplicar con mensaje; historial de 60 pasos que guarda la plantilla activa, la predeterminada y los datos; una acción continua con la misma clave en < 800 ms es un solo paso; cambiar de plantilla reinicia el historial; las plantillas no tocadas conservan su identidad tras editar otra y `dirty` compara con lo guardado
- [X] T046 [P] [US1] Pruebas del lienzo en `frontend/tests/template-editor-canvas.test.tsx`: arrastrar mueve en % según el rectángulo de la página; ajuste al centro con tolerancia de 1,2 % (horizontal) y 0,9 % (vertical) y guía visible; redimensionar desde la esquina con mínimos (ancho 3 %, alto 0,3 %); un elemento bloqueado se selecciona pero no se mueve; clic en el fondo y Esc anulan la selección; cada elemento se pinta en el mismo % que su documento (parte editor de SC-002)
- [X] T047 [P] [US1] Pruebas de atajos en `frontend/tests/template-editor-keyboard.test.tsx`: flechas (0,5 %; 2 % con Mayús), Supr, Ctrl+D, Ctrl+Z, Ctrl+Mayús+Z, Ctrl+Y y Esc; ninguno actúa cuando el foco está en `input`, `textarea` o `select`
- [X] T048 [P] [US1] Pruebas del inspector y las capas en `frontend/tests/template-editor-inspector.test.tsx`: cada tipo de elemento muestra sus campos con los rangos de FR-012; cambiar un campo actualiza el lienzo; sin selección se edita el fondo de la página (color, degradado, imagen); la lista de capas muestra nombre, tipo, visible/oculto y fijo/libre y permite seleccionar un elemento oculto; los bloques automáticos muestran la advertencia cuando marcan `data-overflow`
- [X] T049 [P] [US1] Pruebas de pantalla y guardado en `frontend/tests/template-editor-save.test.tsx`: carga el conjunto con `GET /api/settings/templates`; el indicador alterna "Cambios sin guardar" y "Todo guardado"; Guardar envía `expectedRevision`; `422` muestra los errores y mantiene los cambios; `409` pide recargar sin pisar; "← Menú" con cambios pendientes pide confirmación; `beforeunload` se registra con cambios; Vista previa muestra las cuatro páginas sin marcos y se puede volver a Editar

### Implementation for User Story 1

- [X] T050 [US1] Implementar el reductor y el historial en `frontend/src/pages/TemplateEditor/useTemplateEditor.ts`: estado `{ workspace, saved, activeId, page, selId, tab, view, preview, zoom, past, future }`, acciones de elementos (agregar, parchear con clave de fusión, eliminar, duplicar, orden, bloquear, ocultar), guardas de los bloques automáticos, deshacer/rehacer con `structuredClone` de la plantilla activa más `defaultId` y datos (tope 60) y `dirty` por referencia para las plantillas no tocadas
- [X] T051 [P] [US1] Implementar `frontend/src/pages/TemplateEditor/usePointerDrag.ts`: Pointer Events con captura, conversión de píxeles a % del rectángulo de la página, ajuste al centro con guías y mínimos de tamaño; una entrada de historial por gesto
- [X] T052 [P] [US1] Crear los datos de muestra del editor en `frontend/src/pages/TemplateEditor/sample-data.ts`: 3 `CatalogItem` (uno agotado) con la imagen `collage` y `photoPositions` para recortar cada producto, y nombre de sección de ejemplo "RAMEN"
- [X] T053 [US1] Definir en `frontend/src/pages/TemplateEditor/inspector-fields.ts` los descriptores de campos por tipo de elemento (color, rango, segmentado, selector, área de texto, interruptor, números) con los rangos y etiquetas de FR-011 y FR-012, los campos del fondo de página de FR-013, el selector de fuente (Título · <familia>, Cuerpo · <familia> y las seis familias) y las etiquetas de imagen (`logo` Logo, `collage` Collage, `marble` Mármol, `coverbg` Atardecer, `frame` Marco de portada)
- [X] T054 [US1] Implementar `frontend/src/pages/TemplateEditor/FieldRenderer.tsx`: dibuja cada descriptor; los colores muestran los seis colores de la paleta, "ninguno" donde aplique y un `<input type="color">` para un `#RRGGBB` personalizado
- [X] T055 [US1] Implementar `frontend/src/pages/TemplateEditor/Inspector.tsx`: encabezado con tipo y nombre, acciones (Duplicar, Al frente, Atrás, Bloquear, Mostrar/Ocultar, Eliminar), campos del elemento o del fondo de la página, posición y tamaño en %, rotación (no en bloques automáticos) y opacidad, y la advertencia de bloque reducido (`data-overflow`)
- [X] T056 [P] [US1] Implementar `frontend/src/pages/TemplateEditor/Layers.tsx`: capas de la página en orden de apilado con nombre, tipo, visible/oculto y fijo/libre
- [X] T057 [US1] Implementar `frontend/src/pages/TemplateEditor/Canvas.tsx`: `TemplatePage` a escala con capa de selección (contorno, manija de esquina, guías), usando `usePointerDrag`
- [X] T058 [P] [US1] Implementar `frontend/src/pages/TemplateEditor/PageStrip.tsx`: las cuatro páginas con miniatura y nota (Portada, Portada de sección, Productos, Políticas)
- [X] T059 [P] [US1] Implementar `frontend/src/pages/TemplateEditor/ZoomControls.tsx`: acercar, alejar y Ajustar entre 20 % y 200 %
- [X] T060 [P] [US1] Implementar `frontend/src/pages/TemplateEditor/PreviewPages.tsx`: las cuatro páginas lado a lado sin ayudas de edición
- [X] T061 [US1] Implementar `frontend/src/pages/TemplateEditor/panels/ElementosPanel.tsx`: agregar título, texto, insignia, formas (rectángulo, círculo, píldora y línea, que se agrega como un rectángulo de alto 0,4 % y esquinas 0) e imágenes (logo y collage); nota sobre los bloques automáticos
- [X] T062 [US1] Implementar `frontend/src/pages/TemplateEditor/SideRail.tsx`: riel de pestañas con un registro de paneles; en esta historia solo registra Elementos (US3, US4 y US5 registran los suyos)
- [X] T063 [US1] Implementar `frontend/src/pages/TemplateEditor/TopBar.tsx`: "← Menú" (con `confirmLeave()`), título, nombre de la plantilla editable, deshacer/rehacer, indicador de estado, Vista previa y Guardar
- [X] T064 [US1] Ensamblar `frontend/src/pages/TemplateEditor/index.tsx`: carga de `GET /api/settings/templates`, ajuste del lienzo al espacio disponible (`ResizeObserver`), un solo listener de atajos que ignora campos de texto, guardado con `expectedRevision` y manejo de `422` y `409`, `useUnsavedGuard`, modo Vista previa y estado de carga y error
- [X] T065 [US1] Montar `/apariencia` fuera de `AppShell` en `frontend/src/App.tsx` (como `/print/:id`); conservar la entrada "Apariencia" de `frontend/src/components/Sidebar.tsx` y la redirección de `/negocio`
- [X] T066 [US1] Adaptar `backend/tests/integration/panel-layout.test.ts` a la pantalla completa del editor: `/apariencia` ya no tiene `main` ni barra lateral, así que a 1366×768 y a 1024×768 comprobar que `document.documentElement.scrollWidth <= clientWidth`, que todos los botones de la barra superior quedan dentro de la ventana (`getBoundingClientRect`) y que el lienzo y el inspector son visibles; mantener los otros ocho recorridos sin cambios (cumple la parte automática de FR-005 para el editor)
- [X] T067 [US1] Retirar el código de 002 que este editor reemplaza: eliminar `frontend/src/pages/ThemeEditor.tsx`, `frontend/src/components/ThemeSample.tsx`, `frontend/src/print/theme-vars.ts`, `frontend/tests/theme-editor.test.tsx`, `backend/src/api/theme.routes.ts`, `backend/src/catalog/theme.repo.ts` y `backend/tests/integration/theme.test.ts`; desmontar `themeRoutes` en `backend/src/app.ts`; reducir `backend/src/catalog/theme.ts` a `isHexColor` y `contrastRatio` (quitar `Theme`, `themeWarnings`, `DEFAULT_THEME`, `normalizeTheme`) y recortar `backend/tests/unit/theme.test.ts`; cambiar en `backend/tests/integration/security.test.ts` las rutas de tema por `/api/settings/templates` (y comprobar que `/api/settings/theme` responde `404`)
- [X] T068 [US1] Ejecutar `npm run build` y `npm test` y corregir importaciones rotas por T067; comprobar a mano el quickstart escenarios 2 a 6 y 10

**Checkpoint**: User Stories 1 y 2 funcionan juntas: se edita en el lienzo, se guarda y el PDF refleja los cambios.

---

## Phase 5: User Story 3 - Paleta y tipografía de la plantilla (Priority: P2)

**Goal**: la sección Estilo con la paleta de seis colores, paletas sugeridas, restaurar colores y cinco pares tipográficos.

**Independent Test**: cambiar Acento 1 y ver cambiar todos los elementos que lo usan; aplicar una paleta sugerida; restaurar; cambiar el par tipográfico y generar el PDF (quickstart escenario 7).

### Tests for User Story 3

- [X] T069 [P] [US3] Pruebas de Estilo en `frontend/tests/template-editor-style.test.tsx`: cambiar un color de paleta recolorea todos los elementos que lo referencian y no los de color personalizado; una paleta sugerida reemplaza los seis colores y se deshace; "Restaurar colores originales" vuelve a la paleta del estilo base de la plantilla (para `neon`: `#11052C`, `#FF007A`, `#00FF66`, `#FF9900`); un valor que no es `#RRGGBB` se rechaza y conserva el anterior; las advertencias de contraste aparecen sin bloquear Guardar y evalúan solo la paleta; elegir un par tipográfico cambia títulos y cuerpo y no los elementos con fuente específica
- [X] T070 [P] [US3] Prueba de PDF por familia en `backend/tests/integration/pdf-fonts.test.ts`: para cada una de las seis familias, generar con una plantilla que la use y comprobar con Puppeteer (`document.fonts.check`) que la fuente quedó cargada antes de exportar, sin acceso a internet

### Implementation for User Story 3

- [X] T071 [US3] Agregar al reductor de `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` las acciones de paleta (cambiar un color, aplicar paleta sugerida, restaurar desde `baseTemplate(base).palette`) y de tipografía (cambiar el par)
- [X] T072 [US3] Implementar `frontend/src/pages/TemplateEditor/panels/EstiloPanel.tsx`: seis filas (selector de color, campo hexadecimal con validación y qué elementos afecta), "Restaurar colores originales", las cinco paletas sugeridas, los cinco pares tipográficos con vista de muestra y las advertencias de `paletteWarnings`
- [X] T073 [US3] Registrar Estilo en `frontend/src/pages/TemplateEditor/SideRail.tsx` y mostrar en `frontend/src/pages/TemplateEditor/index.tsx` las advertencias que devuelve el `PUT`

**Checkpoint**: la paleta y la tipografía recolorean el lienzo y el PDF de punta a punta.

---

## Phase 6: User Story 4 - Gestionar varias plantillas (Priority: P2)

**Goal**: vista Plantillas (galería) y panel de plantillas para crear, duplicar, elegir la predeterminada y eliminar.

**Independent Test**: crear una plantilla desde un estilo base, duplicarla, marcarla predeterminada, eliminar otra y generar con la nueva (quickstart escenario 8).

### Tests for User Story 4

- [X] T074 [P] [US4] Pruebas de la galería en `frontend/tests/template-editor-gallery.test.tsx`: tarjetas con miniaturas, nombre, cinco puntos de paleta, par tipográfico y marca "Predeterminada"; "Nueva plantilla" desde cada estilo base crea "Nueva · <estilo>" y la abre; Duplicar crea "<nombre> (copia)" independiente; "Usar al generar" mueve la marca; la predeterminada no ofrece Eliminar; Eliminar pide confirmación; siempre queda al menos una; crear, duplicar y eliminar reinician el historial; renombrar desde la barra superior actualiza la galería y un nombre vacío no se puede guardar; alternar Editor/Plantillas conserva los cambios

### Implementation for User Story 4

- [X] T075 [US4] Agregar al reductor de `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` las acciones: crear desde estilo base (`t` + base 36), duplicar, eliminar (no la predeterminada, nunca la última), fijar predeterminada y renombrar (1–60 caracteres); crear, duplicar y eliminar reinician el historial
- [X] T076 [P] [US4] Implementar `frontend/src/pages/TemplateEditor/Gallery.tsx`: tarjetas con miniaturas de portada y productos (`TemplatePage` a escala ≈ 0,22) y las acciones Editar, Duplicar, "Usar al generar" y Eliminar con confirmación; bloque "Nueva plantilla" con los cuatro estilos base
- [X] T077 [P] [US4] Implementar `frontend/src/pages/TemplateEditor/panels/PlantillasPanel.tsx`: lista lateral con miniatura, nombre, puntos y marca, "Ver todas" y "Nueva plantilla"
- [X] T078 [US4] Agregar a `frontend/src/pages/TemplateEditor/TopBar.tsx` el botón "Usar"/"Predeterminada" y las pestañas Editor/Plantillas; registrar Plantillas en `SideRail.tsx` y cablear en `index.tsx` el cambio de vista, abrir una plantilla y el aviso si la plantilla en edición se elimina

**Checkpoint**: varias plantillas se crean, se eligen y se usan al generar (con el reemplazo de T027 si se eliminan).

---

## Phase 7: User Story 5 - Datos del catálogo dentro del editor (Priority: P2)

**Goal**: sección Datos (tienda, banner, teléfonos, dirección, políticas) y datos insertables en textos, insignias y pie.

**Independent Test**: cambiar un teléfono y ver el cambio en lienzo y vista previa; guardar y comprobar el PDF (quickstart escenario 9).

### Tests for User Story 5

- [X] T079 [P] [US5] Pruebas de Datos en `frontend/tests/template-editor-data.test.tsx`: editar un teléfono actualiza lienzo y vista previa al instante; con el segundo teléfono vacío `{telefonos}` muestra uno solo; un banner de 81 caracteres o políticas de más de 3500 ponen el contador en alerta y deshabilitan Guardar; agregar y quitar políticas; los chips insertan el marcador en el texto, la insignia y el pie seleccionados, y "Datos del catálogo" crea un texto con el marcador
- [X] T080 [P] [US5] Prueba de PDF de marcadores en `backend/tests/integration/pdf-tokens.test.ts` (con `pdf-parse`): `{banner}` usa el `bannerText` de esa generación y no cambia el guardado; `{seccion}` muestra el nombre de cada sección en sus páginas y vacío en portada y políticas; `{telefonos}`, `{direccion}` y `{tienda}` salen con el dato real; un marcador desconocido queda literal

### Implementation for User Story 5

- [X] T081 [US5] Agregar al reductor de `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` la acción de cambiar los datos del negocio y la validación de límites (banner 1–80, políticas ≤ 3500 en total) que deshabilita Guardar
- [X] T082 [US5] Implementar `frontend/src/pages/TemplateEditor/panels/DatosPanel.tsx`: nombre de la tienda, banner con contador, teléfonos, dirección y políticas (título y texto, agregar y quitar) con contador de caracteres
- [X] T083 [US5] Agregar a `frontend/src/pages/TemplateEditor/panels/ElementosPanel.tsx` la sección "Datos del catálogo" (chips Banner, Sección, Teléfonos, Dirección y Tienda que crean un texto con el marcador) y el campo `tokens` ("Insertar dato") en `inspector-fields.ts` y `FieldRenderer.tsx` para textos, insignias y pie
- [X] T084 [US5] Registrar Datos en `frontend/src/pages/TemplateEditor/SideRail.tsx` y pasar los datos del negocio editados como contexto de marcadores al lienzo, las miniaturas y la vista previa desde `index.tsx`

**Checkpoint**: los datos del catálogo se editan en el editor y se reflejan en el lienzo y en el PDF.

---

## Phase 8: User Story 6 - Ajustes menores de paridad con el mockup (Priority: P3)

**Goal**: seleccionar o quitar todas las secciones, desglose del combo, "hace N min" en Inicio e intentos de prueba restantes.

**Independent Test**: comprobar cada detalle en su pantalla (quickstart escenario 14).

### Tests for User Story 6

- [X] T085 [P] [US6] Pruebas de pantallas en `frontend/tests/parity.test.tsx`: "Quitar todas/Seleccionar todas" en Generar actualiza la selección y la vista previa de estructura; Combos muestra suma, ahorro y precio resultante al editar; Inicio muestra "hace N min" a partir de `alegra.syncedAt`; Conexión Alegra muestra los intentos restantes y el aviso de espera al agotarlos
- [X] T086 [P] [US6] Pruebas de backend: `syncedAt` en `GET /api/panel/summary` (presente con Alegra disponible y estable mientras dura la caché; ausente si no responde o no está configurado) en `backend/tests/integration/panel-summary.test.ts`; `testAttempts` en `GET /api/settings/alegra` y en las respuestas de `POST /api/settings/alegra/test`, incluido el `429`, en `backend/tests/integration/alegra-settings.test.ts`; y `rateLimit(...).remaining(req)` en `backend/tests/unit/rate-limit.test.ts`

### Implementation for User Story 6

- [X] T087 [US6] Hacer que `rateLimit` de `backend/src/auth/middleware.ts` exponga los intentos restantes por IP (`remaining(req)`) sin cambiar su comportamiento actual
- [X] T088 [US6] Devolver `testAttempts: { limit, remaining }` desde `backend/src/api/alegra-settings.routes.ts` (GET, test correcto, errores y `429` en `details`) usando una única instancia del limitador, y mostrarlo en `frontend/src/pages/AlegraSettings.tsx`
- [X] T089 [US6] Agregar `syncedAt` a `PanelSummary` en `backend/src/catalog/types.ts` y a `backend/src/catalog/panel-summary.ts` (instante de la lectura que llenó la caché), y mostrar "hace N min" en el indicador de productos activos de `frontend/src/pages/Home.tsx`
- [X] T090 [P] [US6] Agregar el control "Seleccionar todas / Quitar todas" a `frontend/src/pages/Generate.tsx`
- [X] T091 [P] [US6] Mostrar en `frontend/src/pages/Bundles.tsx` la suma de los componentes, el ahorro (máx(0, suma − precio)) y el precio en el catálogo mientras se edita; confirmar que el selector de componentes entrega `unitPrice` para productos aún no guardados y, si no, agregarlo en `backend/src/api/bundles.routes.ts`

**Checkpoint**: las cuatro mejoras funcionan sin cambiar ningún resultado del catálogo.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T092 [P] Actualizar `README.md` con la sección de plantillas (editor, plantillas base, plantilla predeterminada, elegir al generar) y las nuevas tipografías
- [X] T093 [P] Quitar `@fontsource/fredoka-one` de `frontend/package.json` si ya nada lo referencia tras T040, y comprobar con `npm run build` que el tamaño del paquete es razonable con las seis familias
- [X] T094 [P] Asegurar en `backend/tests/fixtures/dev-mock.ts` datos para el quickstart: una sección propia con texto de introducción, un producto agotado y un combo con componente agotado
- [X] T095 Revisión visual del editor contra `Apariencia Editor.dc.html` a 1366×768 y a 1024 px de ancho, y de las cuatro bases × cuatro páginas contra el mockup; guardar capturas en `specs/003-catalog-template-editor/visual/` y completar `visual-review.md`
- [X] T096 Barrido de seguridad: `backend/tests/integration/security.test.ts` cubre `401` en `GET/PUT /api/settings/templates` y `GET /api/settings/templates/summary`, y que ninguna respuesta nueva contiene el token de Alegra
- [ ] T097 Medir a mano (quickstart escenarios 8 y 15): **cronometrar SC-004** (crear plantilla, cambiar un color, mover un elemento, marcarla predeterminada y generar < 10 min sin ayuda); arrastre con retraso < 100 ms con 60 elementos a 1366×768; propiedad → lienzo < 0,2 s; guardar < 1 s; cambio de color a PDF < 3 min; anotar los resultados en `visual-review.md` **Hecho (automatizado con `backend/tests/fixtures/editor-perf.ts`, resultados en `visual-review.md`): arrastre, propiedad → lienzo, guardar y color → PDF cumplen con margen. Pendiente: el cronometraje de SC-004 por una persona sin ayuda (< 10 min), que no puede hacer el asistente.**
- [X] T098 Ejecutar los quince escenarios de [quickstart.md](./quickstart.md) y `npm run lint && npm run build && npm test && npm run test:pdf`
- [ ] T099 Pedir al responsable la aprobación de `visual-review.md` (Neón Noche contra `docs/Cat.pdf` y el PDF de 002, con las dos diferencias aceptadas; las otras tres bases contra el mockup) junto con la aprobación pendiente de 002 (sus T057 y T062) y dejar constancia en el archivo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T004 debe correr con el render de 002 intacto, es decir, antes de T040.
- **Foundational (Phase 2)**: depende de Setup; **bloquea todas las historias**.
- **US2 (Phase 3)** depende de Foundational. **US1 (Phase 4)** depende de Foundational y de US2 (reutiliza el payload con plantilla, `CatalogDocument` y las pruebas de fidelidad), y su T067 retira el código de 002.
- **US3, US4 y US5 (Phases 5 a 7)** dependen de US1 (editan el mismo reductor y pantalla); entre sí son independientes salvo por los archivos compartidos.
- **US6 (Phase 8)** solo depende de Foundational; T090 toca `Generate.tsx` después de T042, y T087 a T089 tocan archivos que ninguna otra historia usa.
- **Polish (Phase 9)** depende de las historias deseadas.

### Archivos compartidos entre historias (integrar de una en una)

`frontend/src/pages/TemplateEditor/useTemplateEditor.ts` (T050, T071, T075, T081), `SideRail.tsx` (T062, T073, T078, T084), `index.tsx` (T064, T073, T078, T084), `TopBar.tsx` (T063, T078), `inspector-fields.ts` y `FieldRenderer.tsx` (T053, T054, T083), `ElementosPanel.tsx` (T061, T083) y `frontend/src/pages/Generate.tsx` (T042, T090).

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de la implementación.
- Módulo puro → esquema → repositorio → rutas → frontend.
- Reductor y hooks → componentes → pantalla ensamblada.

### Dependencias entre tareas clave

- T008 → T009, T010, T012 (tipos y constantes); T010 → T012 (validación de plantillas base); T012 + T013 → T016 → T017.
- T018, T019 → T021–T024 (bloques) → T025 (`TemplateElement`) → T026 (`TemplatePage`).
- US2: T033 → T034 → T035 → T036; T026 + T036 → T037; T037 → T038, T039 → T040 (eliminar lo antiguo solo después de calibrar); T038 y T039 → T044.
- US1: T050 → T051–T064; T053 → T054 → T055; T057 → T064; T064 → T065 → T066 → T067 → T068.
- US3: T071 → T072 → T073. US4: T075 → T076, T077 → T078. US5: T081 → T082, T083 → T084.

### Parallel Opportunities

- Setup: T001 y T002.
- Foundational: T005, T006 y T007 juntas; T011, T014 y T015 juntas; T018 y T020; los cuatro bloques T021 a T024.
- US2: todas las pruebas T027 a T032 juntas.
- US1: las cinco pruebas T045 a T049 juntas; T051, T052, T056, T058, T059 y T060 juntas.
- US3, US4, US5 y US6 pueden avanzar en paralelo entre sí una vez cerrada US1 (con cuidado en los archivos compartidos).

---

## Parallel Example: User Story 2

```bash
# Pruebas de US2 (archivos distintos):
Task: "Pruebas de integración de plantilla en la generación en backend/tests/integration/generation-template.test.ts"
Task: "Prueba de fidelidad con Puppeteer en backend/tests/integration/pdf-template-fidelity.test.ts"
Task: "Prueba de estilos de agotado en backend/tests/integration/pdf-sold-out-styles.test.ts"
Task: "Prueba de CatalogDocument en frontend/tests/catalog-document.test.tsx"
```

## Parallel Example: Foundational (render)

```bash
# Los cuatro bloques automáticos, una vez hechos T018 y T019:
Task: "ProductsBlock en frontend/src/print/blocks/ProductsBlock.tsx"
Task: "TermsBlock en frontend/src/print/blocks/TermsBlock.tsx"
Task: "FooterBlock en frontend/src/print/blocks/FooterBlock.tsx"
Task: "IntroBlock en frontend/src/print/blocks/IntroBlock.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 2)

1. Fase 1 (Setup, incluida la línea base de 002 en T004) y Fase 2 (Foundational).
2. Fase 3 (US2): el PDF sale de la plantilla Neón Noche, igual que el catálogo actual salvo las dos diferencias aceptadas, y se puede elegir otra plantilla al generar.
3. **Parar y validar**: quickstart escenarios 1, 11, 12 y 13 y la revisión visual de Neón Noche (T044).

### Entrega incremental

1. Foundational + US2 → catálogo con plantillas (sin editor). *No publicar aquí: la pantalla Apariencia antigua ya no afecta al PDF.*
2. + US1 → editor completo (retira el código de 002). Primera versión publicable.
3. + US3 (paleta y tipografía) → + US4 (galería) → + US5 (datos) → + US6 (ajustes menores). Cada historia agrega valor sin romper las anteriores.
4. Polish: revisión visual, rendimiento, seguridad y aprobación del responsable.

### Riesgos a vigilar durante la implementación

- Calibración de `neon` (T038, T039): validar con capturas lado a lado contra `visual/baseline-002/` antes de seguir con el editor, y antes de T040.
- Fuentes sin cargar a tiempo en la impresión (T041, T070): `document.fonts.ready` más precarga de imágenes.
- Los archivos compartidos del editor concentran los conflictos entre US3, US4 y US5: integrar las historias de una en una.

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- La etiqueta [Story] enlaza cada tarea con su historia de la spec.
- Cada historia debe poder completarse y probarse por separado.
- Comprobar que las pruebas fallan antes de implementar.
- Guardar el progreso después de cada tarea o grupo lógico (hacer commit en `main`). T040 y T067 eliminan código: la copia de línea base de T004 conserva el original.
- Evitar: tareas vagas, conflictos en un mismo archivo y dependencias entre historias que rompan su independencia.
