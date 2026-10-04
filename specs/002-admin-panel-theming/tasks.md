# Tasks: Panel de administración y personalización del catálogo

**Input**: Documentos de diseño en `/specs/002-admin-panel-theming/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rest-api.md](./contracts/rest-api.md), [quickstart.md](./quickstart.md). Requiere la feature 001 funcionando (`npm test` en verde antes de empezar).

**Tests**: Incluidos. La constitución (principio V) exige pruebas para las reglas de negocio; el plan define las pruebas nuevas. Las pruebas de Alegra usan el servidor simulado.

**Organization**: Tareas agrupadas por historia de usuario para implementar y probar cada una por separado. Revisado tras `/speckit-analyze` (informe del 2026-10-03).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US4)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)).

---

## Phase 1: Setup

**Purpose**: dependencias y activos del estilo Pop.

- [X] T001 [P] Agregar `@fontsource/fredoka` y `@fontsource/nunito-sans` a `frontend/package.json` y ejecutar `npm install` en la raíz
- [X] T002 [P] Copiar `docs/Diseño de catálogo y administración/assets/logo.jpg` a `frontend/src/assets/logo.jpg`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos, módulo de tema, constructor con opciones y tokens Pop que todas las historias necesitan. Ninguna historia empieza antes de completar esta fase.

- [X] T003 [P] Escribir pruebas del módulo de tema (`isHexColor` acepta `#RRGGBB` y rechaza `#RGB`, nombres y alfa; normalización a mayúsculas; contraste WCAG: negro/blanco = 21, blanco/`#11052C` ≈ 19,4 y acentos por defecto 5,1 / 14,3 / 9,1 contra `#11052C`; advertencias `low_text_contrast` (fondo vs blanco < 4,5) y `low_accent_contrast` (acento vs fondo < 3); sin advertencias con los valores por defecto) en `backend/tests/unit/theme.test.ts`
- [X] T004 [P] Implementar el módulo puro (sin importaciones de Node, lo usará el frontend) con `Theme`, `ThemeWarning`, `DEFAULT_THEME` (`#11052C`, `#FF007A`, `#00FF66`, `#FF9900`), `isHexColor`, `normalizeTheme`, `contrastRatio` y `themeWarnings` en `backend/src/catalog/theme.ts`
- [X] T005 Separar `BusinessInfo` de `CatalogConfig` y agregar `GenerationOptions`, `AvailableSection`, `CatalogStructure` y `PanelSummary` según [data-model.md](./data-model.md) en `backend/src/catalog/types.ts`; ajustar `BusinessSettings extends BusinessInfo` y `DEFAULT_BUSINESS` en `backend/src/catalog/settings.repo.ts`, el tipado de `backend/src/api/business.routes.ts` y los datos de prueba del frontend (agregar `theme` al `config` de `frontend/tests/print.test.tsx` y de cualquier otro fixture de `CatalogPayload`) para que typecheck y pruebas de 001 sigan en verde
- [X] T006 Refactorizar `backend/src/catalog/catalog-builder.ts` para que `buildCatalog` reciba por llamada las opciones (`sectionKeys`, `hideSoldOut`, `bannerText`, con `bannerText` vacío ⇒ `coverTitle`) y el tema, y que `backend/src/catalog/catalog.service.ts` le pase `DEFAULT_THEME` por ahora; sin cambiar aún el cálculo del informe; actualizar `backend/tests/unit/catalog-builder.test.ts` y las pruebas de integración afectadas
- [X] T007 [P] Definir los tokens Pop con `@theme` de Tailwind (valores de [research.md §1](./research.md): fondo, superficies, líneas, tinta, acentos, lateral, semánticos ok/advertencia/error, `inputBg`, etiquetas de origen, radios 14/22 px), importar las fuentes Fredoka y Nunito Sans y crear las utilidades de sombra sólida (`0 6px 0 #2A1258` y `0 4px 0 #8E1553`) en `frontend/src/styles/theme.css`
- [X] T008 [P] Crear las primitivas `Card`, `Button` (principal rosa con sombra sólida, secundario, peligro), `Field`, `Alert` (éxito/advertencia/error), `Badge`, `PageHeader` y `StatusDot` con sus estilos Pop en `frontend/src/components/ui/` (un archivo por componente más `index.ts`)

**Checkpoint**: las pruebas de 001 siguen en verde, el módulo de tema pasa sus pruebas y las primitivas existen.

---

## Phase 3: User Story 1 - Panel de administración fiel al mockup (Priority: P1) 🎯 MVP

**Goal**: login, navegación lateral, Inicio y todas las pantallas existentes con el estilo 1b "Pop", con contadores de alertas y estado de conexión.

**Independent Test**: iniciar sesión y recorrer cada entrada de la navegación comparando con el mockup 1b; comprobar que el contador de "Sin categoría" y el indicador de conexión reflejan el estado real, incluso con Alegra caído (quickstart escenarios 1, 2 y 3).

### Tests for User Story 1

- [X] T009 [P] [US1] Prueba de integración de `GET /api/panel/summary`: `401` sin sesión; `not_configured` sin conexión; `stats` y `sections` con el Alegra simulado; `unreachable` con `stats` y `sections` en `null` si Alegra cae o excede el timeout; caché de 60 s de la parte de Alegra; `?refresh=1` fuerza consulta; invalidación al guardar un override y al crear una sección propia; `lastCatalog` (con `pages`) siempre fresco y sin caché; el token nunca aparece, en `backend/tests/integration/panel-summary.test.ts`
- [X] T010 [P] [US1] Prueba de la barra lateral: muestra las entradas con los nombres del mockup, resalta la activa, muestra el contador de "Sin categoría" y el indicador de conexión según el resumen, en `frontend/tests/sidebar.test.tsx`
- [X] T011 [P] [US1] Actualizar la prueba del login para el diseño Pop (logo, error genérico sin revelar qué dato falló) en `frontend/tests/login.test.tsx`
- [X] T012 [P] [US1] Pruebas de humo de las pantallas reestilizadas (conexión con Alegra, sin categoría, contenido propio con sus dos pestañas, combos e historial: renderizan y ejecutan su acción principal contra la API simulada) en `frontend/tests/screens.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Agregar la opción `timeoutMs` (por defecto sin límite, con `AbortSignal.timeout`) a `backend/src/alegra/alegra.client.ts` y permitir `client({ timeoutMs })` en `backend/src/alegra/connection.repo.ts`; cubrirlo con un caso en `backend/tests/unit/alegra-client.test.ts`
- [X] T014 [US1] Implementar `PanelSummaryService` en `backend/src/catalog/panel-summary.ts`: consulta categorías e ítems de Alegra con timeout de 8 s y sin descargar imágenes, ejecuta `buildCatalog` y `computeStructure` para derivar `stats` (productos activos, agotados, sin categoría, páginas estimadas) y `sections`, cachea 60 s esa parte, expone `invalidate()`, y lee `lastCatalog` (con `pages` de `params_json`) siempre de `HistoryRepo`; estados `ok`/`unreachable`/`not_configured` (depende de T031)
- [X] T015 [US1] Registrar el servicio en `backend/src/context.ts`, crear `backend/src/api/panel.routes.ts` con `GET /panel/summary[?refresh=1]` y montarlo en `backend/src/app.ts` detrás de la sesión
- [X] T016 [US1] Invalidar la caché del resumen tras cualquier escritura exitosa (override, credenciales, secciones, productos propios, combos, preparar...) con un middleware sobre las peticiones no GET en `backend/src/app.ts`, en lugar de editar cada ruta
- [X] T017 [P] [US1] Crear el hook `usePanelSummary` (carga, refresco y estado de error, compartido por barra lateral e Inicio) en `frontend/src/hooks/usePanelSummary.ts`
- [X] T018 [P] [US1] Crear `Sidebar` (fondo `#2A1258`, ítem activo ámbar, contador ámbar en "Sin categoría", tarjeta de conexión con `StatusDot`, botón "Cerrar sesión"; entradas en el orden del mockup: Inicio, Conexión Alegra, Sin categoría, Contenido propio, Combos, Generar catálogo, Historial, más la entrada transitoria "Negocio" hasta US3) en `frontend/src/components/Sidebar.tsx`
- [X] T019 [P] [US1] Crear la pantalla Inicio (cuatro indicadores, filas de secciones con productos, agotados y etiqueta de origen, último catálogo con miniatura, fecha, páginas y botón de descarga, alerta con acceso directo a "Sin categoría", datos de Alegra como "no disponibles" si el resumen los trae en `null`) en `frontend/src/pages/Home.tsx`
- [X] T020 [US1] Crear `AppShell` (barra lateral + contenido con `min-w-0`) en `frontend/src/components/AppShell.tsx` y reescribir `Shell`, la navegación y las rutas en `frontend/src/App.tsx` según [research.md §7](./research.md): `/` Inicio, `/alegra`, `/sin-categoria`, `/contenido`, `/combos`, `/generar`, `/historial`, `/negocio` (transitoria); `/secciones` y `/productos-propios` redirigen a `/contenido` y `/contenido?tab=productos`; conservar la vista de impresión y la vista previa sin menú
- [X] T021 [P] [US1] Rediseñar el login con logo, tarjeta Pop y mensaje de error genérico en `frontend/src/pages/Login.tsx`
- [X] T022 [P] [US1] Reestilizar con las primitivas `ui/` la conexión con Alegra y el historial en `frontend/src/pages/AlegraSettings.tsx` y `frontend/src/pages/History.tsx`
- [X] T023 [P] [US1] Reestilizar la pantalla y la alerta de ítems sin categoría en `frontend/src/pages/Uncategorized.tsx` y `frontend/src/components/UncategorizedAlert.tsx`
- [X] T024 [P] [US1] Reestilizar la pantalla de combos en `frontend/src/pages/Bundles.tsx`
- [X] T025 [P] [US1] Reestilizar "Contenido propio": `frontend/src/pages/Sections.tsx` con las pestañas Secciones y Productos propios (lee `?tab=productos`) y `frontend/src/pages/CustomProducts.tsx` como contenido de la segunda pestaña

**Checkpoint**: US1 funciona de forma independiente; el panel completo luce Pop (la pantalla Negocio conserva su estilo actual hasta que US3 la reemplace) y el catálogo se sigue generando como en 001.

---

## Phase 4: User Story 2 - Generar con opciones y vista previa de estructura (Priority: P1)

**Goal**: elegir secciones, ocultar agotados y texto de banner; ver la estructura recalculada sin consultar Alegra; generar con esas opciones; que las alertas y decisiones respeten las secciones elegidas.

**Independent Test**: preparar, desmarcar una sección, ocultar agotados y cambiar el banner; la estructura cambia y el PDF generado coincide con ella en portadas y páginas (quickstart escenarios 4, 5, 6 y 7).

### Tests for User Story 2

- [X] T026 [P] [US2] Pruebas unitarias de las opciones del constructor: `sectionKeys` excluye secciones; el informe (`omittedNoImage`, `soldOutBundles`, `counts`) solo cuenta secciones incluidas mientras `uncategorized` y `omittedNoSection` siguen globales; un combo agotado en una sección desmarcada no exige decisión; con `hideSoldOut` los combos con componente agotado se omiten sin decisión; una decisión `omit` no incluye el combo; `availableSections` se calcula antes de `sectionKeys`; `bannerText` vacío usa `coverTitle`; selección vacía ⇒ `emptyCatalog`, en `backend/tests/unit/generation-options.test.ts`
- [X] T027 [P] [US2] Pruebas unitarias de `computeStructure` con secciones de 0, 1, 3, 4 y 7 productos, secciones excluidas, agotados ocultos, productos propios y combos, sin políticas, y selección vacía (`nothingToGenerate` con todo en cero), en `backend/tests/unit/structure.test.ts`
- [X] T028 [P] [US2] Prueba de integración de `PUT /catalog/prepare/:id/options` (recalcula informe, estructura y `availableSections` **sin llamar a Alegra**, `404`, `410`, `409` con un trabajo en estado `rendering`, `422 invalid_options` con `details` si `bannerText` supera 80 caracteres), de `prepare` con opciones iniciales, de que `generate` usa las opciones vigentes, de que una decisión `omit` no reaparece en el payload que lee la vista de impresión, y de que el PDF tiene `structure.totalPages` páginas verificado con `pdf-parse`, en `backend/tests/integration/generation-options.test.ts`
- [X] T029 [P] [US2] Actualizar la prueba de Generar: la lista de secciones sale de `availableSections`, cambiar secciones, ocultar agotados o el banner actualiza la estructura, "todas desmarcadas" deshabilita Generar, el banner parte del texto guardado, y la decisión de combos agotados sigue funcionando, en `frontend/tests/generate.test.tsx`

### Implementation for User Story 2

- [X] T030 [US2] Cambiar `buildCatalog` en `backend/src/catalog/catalog-builder.ts`: etiquetar cada entrada del informe con su `sectionKey` y filtrar por las secciones seleccionadas antes de devolver informe y conteos, calcular `availableSections` antes de aplicar `sectionKeys`, y con `hideSoldOut` omitir sin decisión los combos con algún componente agotado
- [X] T031 [US2] Implementar `computeStructure(payload)` (portadas, portadas de sección, páginas de producto, políticas, contenido propio, total, detalle por sección, `nothingToGenerate`) en `backend/src/catalog/structure.ts`
- [X] T032 [US2] Guardar las `GenerationOptions` vigentes en la entrada de preparación (`get`, `setOptions`) en `backend/src/catalog/prepare-store.ts`
- [X] T033 [US2] Hacer que `prepare` acepte `bannerText` y devuelva estructura, `availableSections` y opciones; agregar `setOptions(prepareId, options)` que reconstruye informe, estructura y payload guardado sin red; que `generate` use las opciones vigentes y guarde `pages` (`structure.totalPages`) en `params_json` del historial, en `backend/src/catalog/catalog.service.ts`
- [X] T034 [US2] Agregar `PUT /catalog/prepare/:prepareId/options`, la validación zod de las opciones mapeada a `HttpError(422, 'invalid_options', …, [{field,message}])` (`bannerText` ≤ 80), la regla `409 job_in_progress` si hay un trabajo en estado `rendering`, y los campos nuevos en la respuesta de `prepare`, en `backend/src/api/catalog.routes.ts`
- [X] T035 [P] [US2] Crear `StructurePreview` (portadas, páginas de productos con máximo 3 por página, contenido propio y políticas, total, y mensaje "nada que generar") en `frontend/src/components/StructurePreview.tsx`
- [X] T036 [US2] Rediseñar Generar catálogo en `frontend/src/pages/Generate.tsx`: tras *Preparar*, lista de secciones a incluir (de `availableSections`, todas marcadas), casilla "Ocultar productos agotados", campo "Texto del banner de portada" que parte del `cover_title` guardado (`GET /api/settings/business`) y no lo modifica, `StructurePreview` actualizada con `PUT …/options` (retardo de 300 ms), informe de revisión, decisión de combos agotados, estado con sondeo y descarga, con las primitivas Pop (requiere la ruta `/generar` de T020)

**Checkpoint**: US2 funciona de forma independiente sobre 001; la vista previa, las alertas y el PDF respetan las secciones elegidas.

---

## Phase 5: User Story 3 - Personalizar el tema del catálogo (Priority: P2)

**Goal**: editar fondo y tres acentos, banner y contacto; ver una muestra; guardar, restaurar, evitar pisar cambios de otra pestaña y que el PDF use el tema guardado.

**Independent Test**: cambiar un acento, ver la muestra, guardar, generar y comprobar el nuevo color; restaurar y volver al tema original (quickstart escenarios 8, 9, 10 y 11).

### Tests for User Story 3

- [X] T037 [P] [US3] Prueba de integración de `GET/PUT/DELETE /api/settings/theme`: valores por defecto con `isDefault` y `updatedAt: null`, guardado con normalización a mayúsculas y `updatedAt`, `422 invalid_theme` con `details` que conserva el anterior, advertencias de contraste sin bloquear, `409 theme_changed` con `expectedUpdatedAt` desactualizado, restaurar, `401` sin sesión, en `backend/tests/integration/theme.test.ts`
- [X] T038 [P] [US3] Prueba del editor de tema: la muestra cambia sin guardar, cada color indica el elemento que modifica, color inválido muestra error, advertencia de contraste, restaurar valores, aviso de cambios sin guardar, aviso ante `409`, y un Guardar único que llama al tema y luego al negocio y muestra qué parte falló si el segundo falla, en `frontend/tests/theme-editor.test.tsx`
- [X] T039 [P] [US3] Prueba de que `CatalogDocument` escribe `--pdf-bg`, `--pdf-accent-1`, `--pdf-accent-2` y `--pdf-accent-3` en `.print-root` y que el CSS usa los valores por defecto del tema como reserva, en `frontend/tests/print-theme.test.tsx`
- [X] T040 [P] [US3] Prueba de integración: un tema guardado **entre** `prepare` y `generate` aparece en `config.theme` del payload (incluido el de `GET /catalog/payload/:id`) y el PDF conserva el mismo número de páginas; tras `DELETE /settings/theme` el payload vuelve a los valores por defecto, en `backend/tests/integration/pdf-theme.test.ts`
- [X] T041 [P] [US3] Prueba de integración del límite de 3500 caracteres en el total de las políticas (`422 invalid_business` con `details`) en `backend/tests/integration/business-terms-limit.test.ts`

### Implementation for User Story 3

- [X] T042 [US3] Crear la migración con la tabla `catalog_theme` (una fila, `CHECK (id = 1)`, cuatro colores y `updated_at`) en `backend/src/db/migrations/002_theme.sql`
- [X] T043 [US3] Implementar `ThemeRepo` (`get` con valores por defecto y `updatedAt: null` si no hay fila, `put` con normalización y verificación de `expectedUpdatedAt`, `reset`) en `backend/src/catalog/theme.repo.ts`
- [X] T044 [US3] Implementar las rutas `/settings/theme` (GET; PUT con zod mapeado a `HttpError(422, 'invalid_theme', …)`, advertencias y `409 theme_changed`; DELETE) en `backend/src/api/theme.routes.ts` y montarlas en `backend/src/app.ts` detrás de la sesión
- [X] T045 [US3] Agregar el límite de 3500 caracteres al total de `terms[].body`, con `422 invalid_business` y `details`, en `backend/src/api/business.routes.ts`
- [X] T046 [US3] Leer el tema de `ThemeRepo` en cada construcción del catálogo (no al preparar) y exponerlo en `config.theme` en `backend/src/catalog/catalog.service.ts`; hacer que `GET /catalog/payload/:prepareId` reemplace `config.theme` por el tema guardado en ese momento en `backend/src/api/catalog.routes.ts`
- [X] T047 [US3] Aplicar el tema como variables CSS en `.print-root` desde `frontend/src/print/CatalogDocument.tsx` y en `frontend/src/print/print.css` aplicar la tabla de [research.md §2](./research.md): recolor de `.cover-title`/`.section-title` (relleno y contorno), `.cover-title` (resplandor), `.image-card` (fondo) y `.price` (fondo); elementos nuevos: anillo de 4 px `accent2` en `.image-card`, borde de 2 px `accent3` en `.price`, y chips de `.terms-block h3` (fondo `--pdf-bg`, texto `--pdf-accent-1`); cada `var(--pdf-…)` con el valor por defecto del tema como reserva
- [X] T048 [P] [US3] Crear `ThemeSample` (una página de muestra con tarjeta de imagen, título de sección, etiqueta de precio y chip de políticas que usan las mismas variables `--pdf-*`) en `frontend/src/components/ThemeSample.tsx`
- [X] T049 [P] [US3] Crear el hook de cambios sin guardar (`beforeunload` y confirmación al navegar desde la barra lateral, porque `BrowserRouter` no admite `useBlocker`; el botón "Atrás" no se intercepta) en `frontend/src/hooks/useUnsavedGuard.ts`
- [X] T050 [US3] Crear Apariencia con selectores de color y campo hex para fondo y tres acentos (cada uno rotulado con el elemento que cambia), advertencias de contraste con `themeWarnings`, `ThemeSample`, botón "Restaurar valores originales", y las secciones de banner, contacto (teléfonos y dirección), nombre y políticas (con contador del límite de 3500) que hoy edita `BusinessSettings`; un único botón Guardar que llama a `PUT /settings/theme` (con `expectedUpdatedAt`) y luego a `PUT /settings/business`, mostrando qué parte falló y manteniendo el estado sucio, y mensaje de recarga ante `409`, en `frontend/src/pages/ThemeEditor.tsx`
- [X] T051 [US3] Reemplazar la entrada "Negocio" por "Apariencia" en `frontend/src/components/Sidebar.tsx`, crear la ruta `/apariencia` y redirigir `/negocio` allí en `frontend/src/App.tsx`, integrar `useUnsavedGuard` y eliminar `frontend/src/pages/BusinessSettings.tsx`

**Checkpoint**: US3 funciona de forma independiente; el tema guardado se refleja en la vista previa y en el PDF.

---

## Phase 6: User Story 4 - PDF fiel al diseño de los mockups (Priority: P2)

**Goal**: que el PDF cumpla el diseño aprobado: máximo 3 tarjetas, sello AGOTADO, precio destacado, **pie con teléfonos y dirección en las páginas de producto y de políticas**, portadas con su bloque "Domicilios", sin texto desbordado.

**Independent Test**: generar con el tema por defecto y comparar página por página con `docs/Cat.pdf` y los mockups; revisar tarjetas, sello, pie y textos largos (quickstart escenario 12).

> Hallazgo de `/speckit-analyze`: hoy solo las portadas muestran teléfonos (`Contact.tsx`); las páginas de producto y la de políticas no tienen pie (FR-020). Además `.a4-page` tiene altura fija con `overflow: hidden`, así que el texto largo se recorta sin aumentar páginas; `pdf-parse` no lo detecta.

### Tests for User Story 4

- [X] T052 [P] [US4] Extender las pruebas de impresión: máximo 3 tarjetas por página, sello AGOTADO solo en productos de Alegra y combos agotados (nunca en propios), pie con teléfonos y dirección en cada página de producto y en la de políticas, y portadas con su bloque "Domicilios" sin pie, en `frontend/tests/print.test.tsx`
- [X] T053 [P] [US4] Extender la prueba de PDF para verificar con `pdf-parse` que los teléfonos y la dirección aparecen en las páginas de producto y de políticas, en `backend/tests/integration/pdf-render.test.ts`
- [X] T054 [P] [US4] Prueba de desbordamiento con Puppeteer sobre un payload de textos extremos (nombre y descripción de Alegra muy largos, producto propio con muchos sabores y opciones, 10 políticas dentro del límite de 3500 caracteres, dirección de 160 caracteres, introducción de sección y banner de 80 caracteres): `scrollHeight ≤ clientHeight` en `.bubble`, `.terms-body`, `.terms-block`, el pie y `.section-intro`, y número de páginas sin cambios, en `backend/tests/integration/print-overflow.test.ts`

### Implementation for User Story 4

- [X] T055 [US4] Crear `FooterInfo` (teléfonos y dirección en una línea compacta, fondo `--pdf-bg`, texto blanco, separador `accent3`) en `frontend/src/print/FooterInfo.tsx`, usarlo en `frontend/src/print/CatalogPage.tsx` y `frontend/src/print/TermsPage.tsx` recibiendo `config`, ajustar `frontend/src/print/CatalogDocument.tsx` para pasarlo, y reservar la franja inferior en `frontend/src/print/print.css` sin pisar la tercera fila de producto (termina cerca del 95,6 % de la altura; reducir el espaciado de filas si hace falta)
- [X] T056 [US4] Asegurar que los textos largos no desbordan: recorte de líneas para el nombre del producto, el pie (una línea con puntos suspensivos) y `.section-intro`; escalado del título de portada para banners de hasta 80 caracteres y de `.section-title` largo; niveles de tamaño de letra de las políticas según el total de caracteres (hasta 1800, 2600 y 3500); opciones y sabores de productos propios, en `frontend/src/print/print.css`, `frontend/src/print/TermsPage.tsx`, `frontend/src/print/ProductCard.tsx` y `frontend/src/print/SectionCover.tsx`
- [ ] T057 [US4] **(revisión técnica hecha, falta la aprobación del responsable; ver [visual-review.md](./visual-review.md))** Ejecutar `npm run test:pdf`, comparar el PDF resultante con `docs/Cat.pdf` y con el mockup, verificar contra Cat.pdf si las tarjetas de Alegra deben mostrar nombre además de descripción (hoy solo la descripción, o el nombre si no la hay), anotar las diferencias en `specs/002-admin-panel-theming/visual-review.md`, corregirlas en `frontend/src/print/print.css` y repetir hasta que el responsable apruebe (SC-007)

**Checkpoint**: las cuatro historias funcionan juntas.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T058 [P] Prueba de seguridad: las rutas nuevas (`/api/settings/theme`, `/api/panel/summary`, `/api/catalog/prepare/:id/options`) devuelven `401` sin sesión y el token de Alegra no aparece en ninguna respuesta nueva, en `backend/tests/integration/security.test.ts`
- [X] T059 [P] Actualizar `README.md` con Inicio, Apariencia, las opciones de Generar catálogo, el límite de políticas y las fuentes nuevas
- [X] T060 Revisar que el panel es legible y operable sin desplazamiento horizontal de la página en 1366×768 y 1024 px de ancho (envolver tablas con `overflow-x-auto`, ajustar `AppShell` y `Sidebar`) en `frontend/src/components/AppShell.tsx` y las pantallas con tablas (FR-005)
- [X] T061 Revisar los casos borde de la spec: color inválido, tema sin guardar al cerrar o navegar, todas las secciones desmarcadas, banner vacío o de más de 80 caracteres, `PUT …/options` durante un renderizado (`409`), preparación expirada, Alegra caído mientras se edita el tema, dos pestañas editando el tema, combo agotado con `hideSoldOut`
- [ ] T062 **(escenarios verificados con pruebas automáticas y mediciones; falta la revisión visual del responsable)** Ejecutar los 13 escenarios de [quickstart.md](./quickstart.md) (incluidas las mediciones de rendimiento) y la revisión visual final del panel (contra el mockup 1b, SC-001) y del PDF (contra Cat.pdf, SC-007) con el responsable de la tienda

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (1)** → **Foundational (2)** → historias de usuario → **Polish (7)**.
- Foundational bloquea todas las historias (tipos, módulo de tema, constructor con opciones, tokens y primitivas).

### User Story Dependencies
- **US1 (Inicio y panel Pop)**: depende de Foundational. T014 usa `computeStructure` (T031, de US2), así que T031 va antes de T014; el resto de US1 no depende de US2.
- **US2 (opciones y estructura)**: depende de Foundational; T036 requiere la ruta `/generar` creada por T020 (US1).
- **US3 (tema)**: depende de Foundational (T004, T006); T051 modifica `Sidebar.tsx` y `App.tsx` (T018, T020), así que va después de US1. T046 toca `catalog.service.ts` y `catalog.routes.ts`, también usados por US2.
- **US4 (fidelidad del PDF)**: T055 y T056 comparten `print.css` con T047 (US3); T057 va al final.

Orden: `Setup → Foundational → US2 (T030–T035) → US1 → US2 (T036) → US3 → US4 → Polish`; en la práctica US1 y US2 avanzan en paralelo por personas distintas, coordinando T020 → T036 y T031 → T014.

### Within Each User Story
Pruebas primero (deben fallar) → servicios y reglas → rutas → pantallas.

### Archivos compartidos (hacer en secuencia, no en paralelo)
- `backend/src/catalog/catalog-builder.ts`: T006 → T030
- `backend/src/catalog/catalog.service.ts`: T006 → T016 → T033 → T046
- `backend/src/api/catalog.routes.ts`: T034 → T046
- `backend/src/app.ts`: T015 → T044
- `frontend/src/App.tsx` y `frontend/src/components/Sidebar.tsx`: T018/T020 → T051
- `frontend/src/print/print.css`: T047 → T055 → T056 → T057
- `frontend/src/pages/Generate.tsx`: solo T036

### Parallel Opportunities
- Foundational: T003, T004, T007 y T008 en paralelo (T005 y T006 en secuencia).
- US1: pruebas T009–T012; frontend T017, T018, T019 y los reestilos T021–T025 en paralelo.
- US2: pruebas T026–T029 en paralelo; T035 en paralelo con T030–T034.
- US3: pruebas T037–T041; T048 y T049 en paralelo con el backend T042–T046.
- US4: pruebas T052–T054 en paralelo.

### Parallel Example: User Story 1
```text
Lanzar juntas:  T009 T010 T011 T012                    (pruebas)
Luego juntas:   T017 T018 T019 T021 T022 T023 T024 T025   (piezas de interfaz)
```

## Implementation Strategy

### MVP First (Foundational + US2 + US1)
1. Setup y Foundational.
2. US2 (opciones y estructura, que corrige además el informe por secciones) y US1 (panel Pop): ya dan un panel nuevo y una generación más controlable.
3. **Detenerse y validar**: recorrer el panel contra el mockup 1b y comprobar que estructura y PDF coinciden.

### Entrega incremental
MVP → US3 (tema editable) → US4 (fidelidad del PDF con pie y textos largos) → Polish. Cada incremento se valida con su escenario del quickstart sin romper 001.

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes.
- Confirmar que las pruebas fallan antes de implementar.
- Las tareas T080 (cuenta real de Alegra) y T085 (escenarios y revisión visual final) de la feature 001 siguen abiertas; esta feature no las reemplaza.
- El cambio de aspecto del PDF por defecto (elementos nuevos pintados con `#11052C`/`#FF007A`/`#00FF66`/`#FF9900`) se valida con el responsable en T057 y T062; si no le gusta, se cambia solo `backend/src/catalog/theme.ts`.
- La pantalla Negocio de 001 conserva su estilo actual durante US1 y se reemplaza por Apariencia en US3 (T050–T051).
- Hacer commit por tarea o grupo lógico (el proyecto ya es un repositorio git, rama `main`).
