# Tasks: Omitir artículos de Alegra del catálogo

**Input**: Documentos de diseño en `/specs/006-omit-alegra-articles/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rest-api.md](./contracts/rest-api.md), [contracts/articles-ui.md](./contracts/articles-ui.md), [quickstart.md](./quickstart.md). Requiere las features 001–005 funcionando (`npm test` en verde antes de empezar) y la constitución en v1.1.0 (no hace falta enmendarla).

**Tests**: Incluidos. La constitución (principio V) y FR-016 exigen pruebas para cada regla de la spec, con respuestas simuladas de Alegra y nunca contra la cuenta real. Escribe cada prueba **antes** de su implementación y comprueba que falla.

**Organization**: Tareas agrupadas por historia de usuario. **US1 es el MVP**: por sí sola entrega la pantalla para omitir artículos y un catálogo (vista previa y PDF) que no los trae. US2 (ver qué se omite, volver a incluir y no generar con una lista distinta de la revisada) y US3 (coherencia con avisos, agotados, combos, Sin categoría e Inicio) dependen de US1 pero son independientes entre sí, salvo por archivos compartidos que se indican.

**Control de versiones**: el proyecto ya es un repositorio git (rama `main`); no hay rama propia para esta feature. `data/` está en `.gitignore`.

**Dependencias nuevas**: ninguna (plan.md, Technical Context).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US3)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)). La regla de omitir vive en **un solo lugar** (`backend/src/catalog/catalog-builder.ts`): nada más decide qué artículo entra al catálogo. Las pruebas de la regla se concentran en `backend/tests/unit/omitted-items.test.ts` y las de las rutas en `backend/tests/integration/omitted-articles.test.ts`; cada historia agrega sus casos a esos archivos.

---

## Phase 1: Setup

**Purpose**: punto de partida verificado.

- [X] T001 Ejecutar `npm test`, `npm run typecheck -w backend` y `npm run lint` en la raíz y anotar en el mensaje de la tarea cualquier fallo previo a esta feature, para distinguirlo de regresiones propias. El repositorio está en una ruta sin carpetas ocultas, así que las pruebas con Chrome real deben pasar; si el repositorio se mueve a una carpeta como `.claude/worktrees/`, fallarán con «Not Found» (ver [quickstart.md](./quickstart.md))

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la persistencia de la lista y su entrada al constructor. Todo es aditivo: con la lista vacía ningún comportamiento cambia. **Ninguna historia empieza antes de completar esta fase.**

- [X] T002 [P] Escribir `backend/tests/unit/omitted-item-repo.test.ts` para `OmittedItemRepo` y `omittedSignature` (módulo `custom/omitted-item.repo`) con `openDatabase(':memory:')`: `all()` es un `Set` vacío al empezar; `add('10')` lo incluye; `add` dos veces el mismo no falla y el conjunto sigue con un elemento (idempotente); `remove('10')` lo quita y `remove` de uno que no está no falla; los identificadores son texto (`'10'` ≠ `10` no se mezclan: siempre se guarda y se lee como `string`); **persistencia (FR-004, SC-003)**: con un archivo de `fs.mkdtempSync` y `openDatabase(archivo)`, agregar, `db.close()`, volver a abrir con `openDatabase(archivo)` y comprobar que sigue ahí (la migración se aplica una sola vez); `omittedSignature` devuelve la misma cadena para la misma lista sin importar el orden ni los duplicados (`['2','1','1']` = `['1','2']`), cadenas distintas para listas distintas (`['1']` ≠ `['1','2']`) y una cadena estable para la lista vacía
- [X] T003 [P] Crear `backend/src/db/migrations/004_omitted_items.sql` con la tabla `omitted_item (alegra_item_id TEXT PRIMARY KEY)` y su comentario de feature 006 (solo local, la clave es el identificador del artículo en Alegra), exactamente como en [data-model.md](./data-model.md) («Artículo omitido»); sin más columnas ni claves foráneas
- [X] T004 Crear `backend/src/custom/omitted-item.repo.ts` (depende de T003, molde: `backend/src/custom/override.repo.ts`) con `class OmittedItemRepo { constructor(db: Db); all(): Set<string>; add(itemId: string): void /* INSERT OR IGNORE */; remove(itemId: string): void }` y `function omittedSignature(ids: Iterable<string>): string` = `JSON.stringify([...new Set(ids)].sort())`; comentar que nunca escribe en Alegra (principio I). T002 debe pasar
- [X] T005 En `backend/src/catalog/catalog-inputs.ts` (depende de T004): `LocalCatalogInputs` gana `omittedIds: Set<string>` y `loadLocalInputs` lo llena con `new OmittedItemRepo(ctx.db).all()`; así `prepare` y el resumen de Inicio lo reciben sin cambios propios (research §1)
- [X] T006 [P] En `backend/src/catalog/catalog-builder.ts` agregar a `BuilderInput` el campo `omittedIds?: Set<string>` con su comentario («Artículos de Alegra que la persona omitió. Ausente o vacío = el comportamiento de siempre.»); **solo el campo**, la regla se implementa en T013
- [X] T007 Ejecutar `npm test -w backend` y `npm run typecheck -w backend`: T002 pasa y todo lo demás sigue en verde (con la lista vacía nada cambia)

**Checkpoint**: la lista se guarda y llega al constructor; el repositorio sigue en verde.

---

## Phase 3: User Story 1 - Omitir artículos puntuales y generar el catálogo sin ellos (Priority: P1) 🎯 MVP

**Goal**: la persona abre **Artículos de Alegra**, busca artículos y los marca como omitidos; al preparar y generar, esos artículos no aparecen ni en la vista previa ni en el PDF y todo lo demás queda igual. La lista es permanente, solo local y sigue al identificador del artículo en Alegra.

**Independent Test**: con el simulador de Alegra (~10 artículos en 3 secciones), omitir 2 de la misma sección desde la pantalla, preparar y generar: la vista previa y el payload del PDF no los traen, el resto sigue con sus precios, AGOTADO y secciones, las páginas se reagrupan de a 3, y la lista sigue ahí tras recargar o reiniciar. Corresponde a los escenarios 1–4 de [quickstart.md](./quickstart.md).

### Tests for User Story 1 ⚠️

> **NOTE: escribe estas pruebas primero y comprueba que FALLAN antes de implementar.**

- [X] T008 [P] [US1] Escribir `backend/tests/unit/omitted-items.test.ts` para la regla de `buildCatalog` (copiar los ayudantes `config`, `item(id, over)` e `input(items, over)` de `backend/tests/unit/catalog-builder.test.ts` y pasar `generatedAt` fijo): (a) con 5 artículos de `c1` y `omittedIds: new Set(['2','4'])`, `payload.sections[0].pages` trae solo los artículos `1`, `3` y `5` en una página y `report.counts.included === 3`; (b) con 4 artículos, omitir uno deja `pages.map(p => p.length)` en `[3]` (antes `[3, 1]`: las páginas se reagrupan); (c) un artículo agotado y omitido no aparece (ni con la indicación AGOTADO); (d) una sección cuyos artículos se omiten todos desaparece de `payload.sections` y de `availableSections`, sin portada; omitir todos deja `payload.sections` vacío y `report.emptyCatalog === true`; (e) un `sectionKeys` que apunta a una sección que quedó vacía se ignora sin error; (f) **FR-014**: con `omittedIds` ausente, con `new Set()` y con un conjunto de identificadores que no existen entre los ítems, `payload` y `report` son `toEqual` a los de la misma entrada sin el campo; (g) **FR-006**: el mismo identificador sigue omitido aunque el ítem cambie de nombre, precio o categoría, y otro ítem con el mismo nombre pero distinto identificador sí aparece; (h) un ítem `variantParent` en el conjunto no cambia nada
- [X] T009 [P] [US1] Escribir `backend/tests/integration/omitted-articles.test.ts` (copiar `item`, `setup` y las credenciales de `backend/tests/integration/uncategorized.test.ts`: simulador con categorías `c1` RAMEN y `c2` SNACKS, `loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }))`, `PUT /api/settings/alegra`; nombres `Zeta`, `Álamo`, `alfa`, un ítem `type: 'variantParent'`, uno agotado y uno sin categoría). **`GET /api/catalog/articles`**: devuelve `{ items }` sin los padres de variantes, ordenados por nombre sin distinguir tildes ni mayúsculas (`Álamo`, `alfa`, `Zeta`), cada uno con `itemId`, `name`, `sectionKey`/`sectionName` (`alegra:c1`/`RAMEN`), `price` numérico, `soldOut` y `omitted: false`; un ítem sin categoría trae `sectionKey: null` y `sectionName: null`, y con una asignación hecha en `PUT /api/catalog/uncategorized/:id` trae la sección asignada; sin conexión configurada ⇒ `422 alegra_not_configured` y con el simulador caído ⇒ `502 alegra_unreachable`, sin tocar `omitted_item`. **`PUT /api/catalog/omitted/:itemId`**: `204`, el siguiente `GET` trae `omitted: true`; repetirlo da `204` y no duplica; **`DELETE`**: `204` y vuelve a `false`; borrar uno que no estaba omitido da `204`; un identificador de 65 caracteres ⇒ `422 invalid_item` en ambos; ni `PUT` ni `DELETE` generan peticiones a Alegra (comparar `mock.requests.length` antes y después). **Persistencia**: tras `PUT`, una segunda aplicación creada con `createApp(testContext({ config, db: ctx.db }))` (misma base, sesiones nuevas) ve el artículo omitido. **Catálogo**: tras omitir dos artículos de `c1`, `POST /api/catalog/prepare` y `GET /api/catalog/payload/:prepareId` no traen esos artículos, `report.counts.included` baja en 2 y la vista de impresión que abre el `FakeRenderer` tras `generate` usa ese mismo payload; **principio I**: toda petición a Alegra (`mock.requests`) es `GET`
- [X] T010 [P] [US1] En `backend/tests/integration/auth-guard.test.ts` agregar a `routes` `['get', '/api/catalog/articles']`, `['put', '/api/catalog/omitted/1']` y `['delete', '/api/catalog/omitted/1']`: sin sesión responden `401` con `error: 'unauthenticated'`
- [X] T011 [P] [US1] Escribir `frontend/tests/articles.test.tsx` (copiar los ayudantes `json`, `mockApi` y `renderAt` de `frontend/tests/screens.test.tsx`; fixture con tres filas: `Ramen picante` en RAMEN a 9000, `Jamón serrano` en SNACKS a 15000 agotado y `Palillos` sin sección a 800, todas con `omitted: false` y `bundles: []`). Casos de [contracts/articles-ui.md](./contracts/articles-ui.md) §2 propios de US1: se ven el título «Artículos de Alegra», el subtítulo y la nota «Omitir un artículo solo se guarda aquí…»; cada fila muestra nombre, sección o «Sin categoría», precio con formato (`$9.000`) y «Agotado» solo en el agotado; «Cargando…» antes de la respuesta; buscar `jamon` encuentra `Jamón serrano` (sin distinguir tildes ni mayúsculas) y ocultar las demás; el selector «Sección» ofrece «Todas las secciones», `RAMEN`, `SNACKS` y «Sin categoría» (esta última solo si hay artículos sin sección) y filtra; sin coincidencias aparece «Ningún artículo coincide con la búsqueda.»; pulsar **«Omitir Ramen picante»** envía `PUT /api/catalog/omitted/1` y la fila pasa **al instante** (con la petición pendiente, usar una promesa diferida) a mostrar la etiqueta «Omitido» y el botón «Volver a incluir Ramen picante»; ese botón envía `DELETE`; si el `PUT` responde `500` la fila vuelve a su estado y se ve «No se pudo guardar el cambio. Inténtalo de nuevo.»; tras un cambio exitoso se avisa al resumen de Inicio (`vi.mock('../src/hooks/usePanelSummary')` y comprobar que `notifySummaryChanged` se llamó); con `422 alegra_not_configured` se ve una alerta con «Primero configura la conexión con Alegra.», el enlace «Revisa la conexión con Alegra» a `/alegra` y el botón «Reintentar» que vuelve a pedir la lista, sin lista; con `502` se ve el mensaje del servidor; con `{ items: [] }` se ve «Alegra no tiene artículos activos.»
- [X] T012 [P] [US1] En `frontend/tests/sidebar.test.tsx` actualizar la lista esperada de «muestra las entradas con los nombres del mockup, en orden» insertando `'Artículos de Alegra'` justo después de `'Sin categoría'` (el orden queda: Inicio, Conexión Alegra, Sin categoría, Artículos de Alegra, Contenido propio, Combos, Generar catálogo, Historial, Apariencia)

### Implementation for User Story 1

- [X] T013 [US1] En `backend/src/catalog/catalog-builder.ts` (depende de T006): `const omitted = input.omittedIds ?? new Set<string>()` y, en el bucle de ítems, **justo después** de `if (it.type === 'variantParent') continue;`, `if (omitted.has(it.id)) continue;` con un comentario que remita a la spec (FR-005, FR-006). **No** filtrar `input.items` ni `alegraById`: los combos deben seguir resolviendo todos sus componentes (FR-011, research §1). T008 debe pasar
- [X] T014 [US1] Crear `backend/src/api/articles.routes.ts` con `articlesRoutes(ctx: AppContext): Router` (molde: `backend/src/api/uncategorized.routes.ts`). **`GET /catalog/articles`**: sin cliente (`ConnectionRepo.client()` nulo) ⇒ `HttpError(422, 'alegra_not_configured', 'Primero configura la conexión con Alegra.')`; pedir en paralelo `client.listActiveItems()` y `listSections(ctx)` (de `catalog/sections.service`) con los errores pasados por `toHttpError`; mapear con `mapAlegraItem`, descartar `variantParent`, y devolver `{ items }` ordenados por nombre con `localeCompare(…, 'es', { sensitivity: 'base' })`, cada uno `{ itemId, name, sectionKey, sectionName, price, soldOut, omitted }` donde la sección es `alegra:<categoryId>` con `categoryName` si tiene categoría; si no, la asignación de `OverrideRepo.all()` cuando esa clave existe en `listSections` (con su nombre); si no, ambos `null`; `omitted` sale de `OmittedItemRepo.all()`. **`PUT` y `DELETE /catalog/omitted/:itemId`**: validar el identificador con zod (`z.string().min(1).max(64)`; si no, `HttpError(422, 'invalid_item', 'Ese artículo no es válido.')`), llamar `add`/`remove` y responder `204`; **sin consultar Alegra**. Forma exacta en [contracts/rest-api.md](./contracts/rest-api.md)
- [X] T015 [US1] En `backend/src/app.ts` importar `articlesRoutes` y registrarlo con `api.use(articlesRoutes(ctx))` justo después de `uncategorizedRoutes(ctx)` (queda detrás de la sesión y del middleware que invalida el resumen de Inicio). T009 y T010 deben pasar
- [X] T016 [US1] Crear `frontend/src/pages/Articles.tsx` según [contracts/articles-ui.md](./contracts/articles-ui.md) §2, **sin** el resumen ni las vistas «Todos/Omitidos» (llegan en US2) ni la nota de combos (US3): `PageHeader`, nota atenuada, campo «Buscar por nombre» (marcador «Escribe parte del nombre»), selector «Sección» derivado de las filas (ordenado por nombre; «Sin categoría» solo si hay), lista de filas (`ul`) con nombre, sección, precio con `formatCop` (importado de `../../../backend/src/catalog/price-format`), etiqueta «Agotado» y botón «Omitir»/«Volver a incluir» con nombre accesible `Omitir {nombre}` / `Volver a incluir {nombre}`; comparar sin tildes ni mayúsculas con `normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()`; el botón cambia la fila **de inmediato** (actualización optimista), envía `api.put`/`api.del` a `/api/catalog/omitted/${encodeURIComponent(id)}`, **revierte** y muestra «No se pudo guardar el cambio. Inténtalo de nuevo.» si falla y llama `notifySummaryChanged()` al terminar bien; estados «Cargando…», «Ningún artículo coincide con la búsqueda.», «Alegra no tiene artículos activos.» y el de error de Alegra (alerta con el mensaje del servidor, enlace «Revisa la conexión con Alegra» a `/alegra` y botón «Reintentar»); interfaz local `Article` con `bundles?: string[]`. Componentes de `../components/ui`; T011 debe pasar
- [X] T017 [P] [US1] En `frontend/src/App.tsx` importar `Articles` y agregar `<Route path="/articulos" element={<Articles />} />` dentro de `Shell`, después de `/sin-categoria`
- [X] T018 [P] [US1] En `frontend/src/components/Sidebar.tsx` agregar a `NAV` `{ to: '/articulos', label: 'Artículos de Alegra' }` justo después de «Sin categoría» (sin `counter`) y actualizar el comentario de `NAV` para que mencione la entrada nueva. T012 debe pasar
- [X] T019 [US1] Ejecutar `npm test` (backend y frontend), `npm run typecheck -w backend` y `npm run lint`: T008–T012 pasan y las pruebas previas siguen en verde

**Checkpoint**: US1 completa y utilizable por sí sola. Se pueden omitir artículos desde la pantalla, la lista persiste, y la vista previa y el PDF no los traen. Todavía no se muestra en Generar qué se omite (US2) y los demás números no los excluyen (US3).

---

## Phase 4: User Story 2 - Saber qué se está omitiendo y volver a incluirlo (Priority: P2)

**Goal**: la revisión de Generar informa cuántos artículos y cuáles se omiten por decisión propia (aparte de los omitidos por falta de foto o sección), con un enlace para administrarlos; la pantalla Artículos de Alegra muestra el resumen, las vistas «Todos/Omitidos» con sus conteos y permite volver a incluir; y el PDF nunca se genera con una lista distinta de la revisada.

**Independent Test**: omitir 3 artículos, preparar y ver en la revisión «3 artículos omitidos por ti» con sus nombres; en Artículos de Alegra, la vista «Omitidos» los muestra con su número y «Volver a incluir» uno hace que aparezca en el siguiente catálogo; cambiar la lista después de preparar y pulsar «Generar PDF» muestra el aviso y no genera nada. Escenarios 4 y 7 de [quickstart.md](./quickstart.md).

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Ampliar `backend/tests/unit/omitted-items.test.ts` (después de T008) con `report.omittedByChoice` (FR-008, SC-004): lista `{ itemId, name }` de los omitidos activos, **ordenada por nombre** sin distinguir tildes; incluye a un omitido que no está en las secciones elegidas (`sectionKeys: ['alegra:c2']` con el omitido en `c1`) y a uno sin categoría ni asignación; es `[]` sin omitidos; ignora identificadores que no corresponden a ningún ítem y a los `variantParent`; `report.counts.omitted` **no** cambia de significado (un omitido no suma, uno sin foto sí)
- [X] T021 [US2] Ampliar `backend/tests/integration/omitted-articles.test.ts` (después de T009): `POST /api/catalog/prepare` devuelve `report.omittedByChoice` con los nombres omitidos y `counts.omitted` solo cuenta sin foto/sin sección (ítems: uno normal, uno omitido, uno sin foto ⇒ `counts` con `included: 1`, `omitted: 1`); `POST /api/catalog/generate` con la lista sin cambios ⇒ `202`; si después de preparar se hace `PUT /api/catalog/omitted/<otro>` (o un `DELETE`), `generate` responde **`409`** con `error: 'omitted_changed'` y el mensaje «Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio.», no se crea ningún trabajo (`GET /api/catalog/jobs/current` sigue `idle`), el `FakeRenderer` no recibe llamadas y el historial queda vacío; volver a preparar y generar sí funciona (`202`) y el payload coincide con la nueva lista; un `prepareId` desconocido sigue dando `410 prepare_expired` (tiene prioridad sobre el 409); `PUT /api/catalog/prepare/:id/options` después de cambiar la lista conserva la instantánea (el payload sigue con la lista de la preparación) y no falla; volver a incluir un artículo (`DELETE`) hace que el **siguiente** `prepare` lo traiga (SC-006)
- [X] T022 [P] [US2] Ampliar `frontend/tests/generate.test.tsx` (agregar `omittedByChoice: []` al `report` base del archivo): con tres omitidos aparece, **debajo de la línea de conteos** y con rol `status`, el aviso «3 artículos omitidos por ti» con sus nombres, el texto «No saldrán en el catálogo.» y el enlace «Administrar artículos» a `/articulos`; con uno, «1 artículo omitido por ti»; sin omitidos (o sin el campo) no aparece ningún aviso; con 35 nombres se listan 30 y una línea «y 5 más»; la línea «N productos incluidos · M omitidos · K con badge AGOTADO» no cambia; los omitidos no aparecen en los avisos de sin categoría ni sin imagen; una respuesta `409 omitted_changed` de `POST /api/catalog/generate` muestra su mensaje en la alerta de error y no inicia el seguimiento del trabajo ([contracts/articles-ui.md](./contracts/articles-ui.md) §3)
- [X] T023 [P] [US2] Ampliar `frontend/tests/articles.test.tsx` (después de T011) con las vistas y el resumen de §2: el resumen «3 artículos · 0 omitidos» (y «1 artículo · 1 omitido» en singular) se actualiza al omitir o incluir; las vistas «Todos ({n})» (marcada al abrir) y «Omitidos ({m})» son radios de una sola selección y sus conteos siguen la búsqueda y la sección elegidas; «Omitidos» muestra solo los omitidos; sin omitidos y sin búsqueda ni sección la vista dice «No has omitido ningún artículo.», y con una búsqueda sin coincidencias dice «Ningún artículo coincide con la búsqueda.»; al volver a incluir un artículo en la vista «Omitidos», su fila sale de la vista y el foco pasa al botón de la fila siguiente o, si no hay, al grupo de vistas

### Implementation for User Story 2

- [X] T024 [US2] En `backend/src/catalog/types.ts` agregar a `ReviewReport` el campo `omittedByChoice: { itemId: string; name: string }[]` (con su comentario: global, no suma a `counts.omitted`) y en `backend/src/catalog/catalog-builder.ts` hacer que la rama de T013 haga `omittedByChoice.push({ itemId: it.id, name: it.name })` antes del `continue`, ordenar la lista por nombre con `localeCompare(…, 'es', { sensitivity: 'base' })` y ponerla en el `report` devuelto. Ejecutar `npm run typecheck -w backend` y corregir cualquier literal de `ReviewReport` en `backend/tests/` que ahora falte el campo. T020 debe pasar
- [X] T025 [P] [US2] En `backend/src/catalog/prepare-store.ts` agregar a `PrepareEntry` el campo `omittedSignature: string` (comentario: firma de la lista con la que se construyó la revisión, FR-012)
- [X] T026 [US2] En `backend/src/catalog/catalog.service.ts` (depende de T025 y T004): en `prepare`, pasar `omittedSignature: omittedSignature(input.omittedIds)` a `this.ctx.prepares.add(…)`; en `generate`, justo después de la comprobación de `prepare_expired` (410), `if (omittedSignature(new OmittedItemRepo(this.ctx.db).all()) !== entry.omittedSignature) throw new HttpError(409, 'omitted_changed', 'Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio.')`, antes de adquirir el trabajo. `setOptions` no cambia. T021 debe pasar
- [X] T027 [P] [US2] En `frontend/src/components/ui/Alert.tsx` agregar el tono `info` a `AlertTone` y `TONES` (colores neutros del tema: `bg-pop-surface2 text-pop-ink border-pop-line`) y que `role` sea `'status'` para `success` e `info` y `'alert'` para los demás (research §10)
- [X] T028 [US2] En `frontend/src/pages/Generate.tsx` (depende de T027), dentro de la tarjeta **Revisión**, justo debajo de la línea de conteos y antes del aviso de «Sin categoría», mostrar una `Alert tone="info"` solo si `report.omittedByChoice?.length` (leer con `?? []`: los informes sin el campo no deben romper): título «1 artículo omitido por ti» / «{n} artículos omitidos por ti», lista de hasta 30 nombres con «y {k} más» si hay más, y el texto «No saldrán en el catálogo.» seguido del enlace «Administrar artículos» (`Link` a `/articulos`). El `409` no necesita código nuevo: `generate()` ya muestra `e.message` en la alerta de error. T022 debe pasar
- [X] T029 [US2] En `frontend/src/pages/Articles.tsx` (después de T016) agregar el resumen con `aria-live="polite"` («{total} artículos · {omitidos} omitidos», con singulares), las vistas «Todos ({n})» / «Omitidos ({m})» como grupo de radios con conteos calculados con la búsqueda y la sección elegidas, los estados vacíos «No has omitido ningún artículo.» y «Ningún artículo coincide con la búsqueda.», y el manejo del foco cuando una fila sale de la vista ([contracts/articles-ui.md](./contracts/articles-ui.md) §2). T023 debe pasar
- [X] T030 [US2] Ejecutar `npm test`, `npm run typecheck -w backend` y `npm run lint`: T020–T023 pasan y las pruebas previas siguen en verde

**Checkpoint**: US1 y US2 funcionan. La persona ve qué omite, lo recupera con un gesto y el sistema no genera algo distinto de lo revisado (principio II).

---

## Phase 5: User Story 3 - Que omitir sea coherente con las demás reglas del catálogo (Priority: P3)

**Goal**: un artículo omitido no genera avisos ni pendientes (sin foto, sin sección, agotado), no cambia los combos que lo usan, no se descarga su foto y no cuenta en los números de Inicio, Sin categoría y Generar; Inicio informa además cuántos se omiten.

**Independent Test**: con un simulador que tenga artículos sin categoría, sin foto, agotados y componentes de un combo, omitir uno de cada tipo y revisar la revisión de Generar, el contador de Sin categoría, los totales de Inicio y el combo. Escenarios 5 y 6 de [quickstart.md](./quickstart.md).

### Tests for User Story 3 ⚠️

- [X] T031 [P] [US3] Ampliar `backend/tests/unit/omitted-items.test.ts` (después de T020) con la coherencia del constructor (FR-009, FR-011): (a) un omitido sin categoría ni asignación **no** aparece en `report.uncategorized` ni en `omittedNoSection`, y con una asignación tampoco; (b) un omitido sin foto (`localImages` sin su entrada) no aparece en `omittedNoImage` ni en `photos.notObtained`; (c) `photos.informed` no cuenta a los omitidos: con todos los ítems con foto informada omitidos y fallos de descarga, `photos.allFailed` es `false`; (d) un omitido agotado no suma en `counts.soldOut`; (e) **combos**: un combo con un componente omitido produce el mismo ítem de combo (`toEqual`: nombre, componentes, `priceLabel`, `soldOut`) que la misma entrada sin la omisión, sin entrada nueva en `soldOutBundles` si el componente está disponible, y con un componente agotado en Alegra `report.soldOutBundles` es idéntico con y sin la omisión (omitir no cambia el stock); (f) un componente que ya no existe en Alegra sigue resolviéndose como «Producto no disponible», igual que antes
- [X] T032 [US3] Ampliar `backend/tests/integration/omitted-articles.test.ts` (después de T021; para los combos crear una sección propia, un combo con un componente de Alegra y su imagen subida con `POST /api/sections/custom`, `POST /api/bundles` y `PUT /api/bundles/:id/image`, como en `backend/tests/integration/bundles.test.ts`): `GET /api/catalog/articles` trae `bundles` con los **nombres** de los combos que usan el artículo como componente de Alegra y `[]` en los demás; `GET /api/catalog/uncategorized` trae `omitted` en cada ítem y conserva `assignedSectionKey` de un omitido; `prepare` **no pide la foto** de un omitido (`mock.requests` de `/img/*` no incluye la consulta de ese ítem, usando una URL distinta por ítem como `…/img/ok.png?i=N`) pero sí las de los demás; un omitido cuya foto falla (`/img/falla.png`) no aparece en `photos.notObtained` ni dispara `photos.allFailed`; un omitido sin categoría no aparece en `report.omittedNoSection` ni en `report.uncategorized`; un combo cuyo componente se omite sigue en el payload con los mismos componentes y precio
- [X] T033 [P] [US3] En `backend/tests/integration/panel-summary.test.ts` agregar `omitted: 0` al `toEqual` de `stats` de los casos existentes y nuevos casos con el `setup()` del archivo (RAMEN con 3 productos, uno agotado, y uno sin categoría): tras `PUT /api/catalog/omitted/2` (el agotado) `stats` es `{ products: 4, soldOut: 0, uncategorized: 1, estimatedPages: 4, omitted: 1 }` y `sections` trae RAMEN con `items: 2` y `soldOut: 0` (**`products` no baja**: es el total de Alegra); omitir el sin categoría baja `uncategorized` a 0 y `omitted` sube; para la sección que se vacía, agregar a ese `setup` la categoría `c2` SNACKS con un único artículo: omitirlo hace que SNACKS desaparezca de `sections` y baje `estimatedPages` (portada de sección y página menos); el resumen se actualiza sin esperar a la caché (llamar a `summary`, hacer el `PUT` y volver a llamar **sin** `?refresh=1`); un identificador omitido que no corresponde a ningún artículo activo (`PUT /api/catalog/omitted/999`) no suma a `stats.omitted`
- [X] T034 [P] [US3] Ampliar `frontend/tests/screens.test.tsx` («Sin categoría»; agregar `omitted: false` a los ítems existentes): un ítem sin asignar y `omitted: true` muestra la etiqueta «Omitido» en lugar de «Pendiente», su selector de sección sigue disponible y **no** cuenta en «N pendientes de asignar» (con dos sin asignar, uno omitido: «1 pendientes de asignar»); si todos los que quedan sin asignar están omitidos el resumen dice «No quedan pendientes de asignar», y sin omitidos sigue diciendo «Todos tienen sección asignada»; solo si hay algún omitido aparece «Los artículos omitidos no necesitan sección: no saldrán en el catálogo.»; `UncategorizedAlert` no cuenta a los omitidos (con un único ítem sin asignar y omitido no muestra ninguna alerta)
- [X] T035 [P] [US3] En `frontend/tests/home.test.tsx` agregar `omitted: 0` al `stats` de `base` y casos: con `omitted: 3` la nota de «Productos activos en Alegra» dice «3 omitidos del catálogo · Sincronizado hace …» (con `omitted: 1`, «1 omitido del catálogo · …»), el valor de la tarjeta **no cambia** (`aria-label` «Productos activos en Alegra: 40») y con `omitted: 0` la nota es la de hoy; sin conexión con Alegra la nota sigue siendo «No disponible sin Alegra»
- [X] T036 [P] [US3] Agregar `omitted: 0` al literal `stats` de `frontend/tests/sidebar.test.tsx` (las tres apariciones: `summary()` y las dos de «no muestra contador…») y de `frontend/tests/parity.test.tsx` (la de `base`), para que sigan compilando con el tipo nuevo
- [X] T037 [P] [US3] Ampliar `frontend/tests/articles.test.tsx` (después de T023) con la nota de combos de §2: una fila **omitida** con `bundles: ['Combo regalo']` muestra «Está en el combo «Combo regalo». El combo no cambia.»; con dos, «Está en los combos «A» y «B». Los combos no cambian.»; una fila omitida sin combos y una fila **no** omitida con combos no muestran nota; la nota aparece al omitir la fila sin recargar la lista

### Implementation for User Story 3

- [X] T038 [US3] En `backend/src/catalog/catalog-builder.ts` excluir a los omitidos del cálculo de `informed` (el de `photos.informed` y `allFailed`): `input.items.filter((i) => i.type !== 'variantParent' && !omitted.has(i.id) && …)`. `alegraById` y el resto de `input.items` quedan **sin filtrar** (los combos los necesitan). T031 debe pasar
- [X] T039 [US3] En `backend/src/catalog/catalog.service.ts` (`prepare`, después de T026): llamar `loadLocalInputs(this.ctx)` **una sola vez**, antes de descargar imágenes, guardar el resultado en una constante y reutilizarlo en `input` (en lugar de la llamada actual); construir `candidates` solo con los ítems cuyo `id` no esté en `local.omittedIds`, para no descargar fotos de omitidos (research §6). La firma de T026 se calcula con esa misma constante. T032 debe pasar en lo de las fotos
- [X] T040 [US3] En `backend/src/catalog/types.ts` agregar `omitted: number` a `PanelSummary.stats` y en `backend/src/catalog/panel-summary.ts` (`queryAlegra`): guardar `const local = loadLocalInputs(this.ctx)` y usarlo en `buildCatalog({ ...local, … })`; `soldOut: real.filter((i) => i.soldOut && !local.omittedIds.has(i.id)).length`; `omitted: real.filter((i) => local.omittedIds.has(i.id)).length`; `products` **no cambia** (data-model «Resumen de Inicio»). Ejecutar `npm run typecheck -w backend` y corregir los literales de `PanelSummary` que falten el campo. T033 debe pasar
- [X] T041 [P] [US3] En `backend/src/api/uncategorized.routes.ts` agregar `omitted: omittedIds.has(i.id)` a cada ítem del `GET /catalog/uncategorized` (con `const omittedIds = new OmittedItemRepo(ctx.db).all()` dentro del manejador); `assignedSectionKey` y los `PUT`/`DELETE` no cambian
- [X] T042 [US3] En `backend/src/api/articles.routes.ts` (después de T014) agregar `bundles` a cada fila: con `new BundleRepo(ctx.db, ctx.uploadsDir).list()` armar un mapa `productId → nombres de combos` solo para los componentes `source === 'alegra'`, ordenados por nombre y sin repetir; `[]` si ninguno. T032 debe pasar
- [X] T043 [P] [US3] En `frontend/src/pages/Uncategorized.tsx` agregar `omitted?: boolean` a `Item` y aplicar [contracts/articles-ui.md](./contracts/articles-ui.md) §4: etiqueta `Badge` neutral «Omitido» en lugar de «Pendiente» para los omitidos sin asignar, `pending` solo cuenta los no omitidos, el texto de resumen «No quedan pendientes de asignar» cuando solo quedan omitidos sin asignar (los demás textos no cambian) y la nota «Los artículos omitidos no necesitan sección: no saldrán en el catálogo.» solo si hay algún omitido. T034 debe pasar
- [X] T044 [P] [US3] En `frontend/src/components/UncategorizedAlert.tsx` filtrar también `!i.omitted` al contar (el tipo de respuesta gana `omitted?: boolean`)
- [X] T045 [P] [US3] En `frontend/src/pages/Home.tsx` hacer que la nota de la tarjeta «Productos activos en Alegra» incluya «{n} omitidos del catálogo · » (singular «1 omitido del catálogo · ») delante de la nota actual cuando `stats.omitted > 0`; sin omitidos o sin Alegra la nota no cambia; el valor no cambia. T035 y T036 deben pasar
- [X] T046 [US3] En `frontend/src/pages/Articles.tsx` (después de T029 y T042) mostrar bajo las filas **omitidas** con `bundles` la nota de combos con el texto exacto de [contracts/articles-ui.md](./contracts/articles-ui.md) §2 (singular y plural), asociada a la fila para el lector de pantalla. T037 debe pasar
- [X] T047 [US3] Ejecutar `npm test`, `npm run typecheck -w backend` y `npm run lint`: T031–T037 pasan y las pruebas previas siguen en verde

**Checkpoint**: las tres historias funcionan. Un artículo omitido no deja ruido en ningún aviso ni contador y los combos siguen siendo los de siempre.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: comprobación con Chrome real, documentación, seguridad y validación manual.

- [X] T048 [P] En `backend/tests/integration/pdf-render.test.ts` agregar un `describe('artículos omitidos con Chrome real')` con `startHarness` de `backend/tests/fixtures/pdf-harness.ts` (categorías `c1` RAMEN y `c2` SNACKS; cinco artículos con nombres únicos y fáciles de buscar, entre ellos uno agotado y uno de `c2`, con fotos de `/img/generic.png?item=N` como el `item()` del archivo) y `afterAll(() => h.close())`: omitir con `h.agent.put('/api/catalog/omitted/<id>').expect(204)` el agotado y otro de `c1`, generar con `h.generate({ quality: 'original' })` y comprobar sobre `text` / `pageTexts` que ninguno de los dos nombres aparece, que **no** aparece «AGOTADO», que los demás nombres sí, y que `pdfPages === structure.totalPages`; luego `DELETE` de ambos, generar otra vez y comprobar que los nombres y «AGOTADO» **vuelven** (SC-002, SC-006). Correr con `npm run build -w frontend` previo para que la vista de impresión sea la vigente
- [X] T049 [P] Actualizar `README.md`: en la lista del panel agregar el punto **Artículos de Alegra** (omitir artículos de forma permanente, solo se guarda aquí y no cambia nada en Alegra, buscar por nombre, filtrar por sección, vista «Omitidos», volver a incluir) y renumerar; en **Sin categoría** decir que los omitidos no cuentan como pendientes; en **Generar catálogo** mencionar el aviso «N artículos omitidos por ti» y que, si cambias la lista después de preparar, hay que preparar de nuevo; en «Reglas del catálogo» una línea sobre los artículos omitidos (no salen aunque estén agotados, no afectan a los combos que los usan); la fila «Un producto no sale en el catálogo» de la tabla de problemas gana «o lo omitiste en Artículos de Alegra»; y `specs/006-omit-alegra-articles/` en «Documentación del diseño». Sin datos reales de la tienda
- [X] T050 [P] Revisión de seguridad (principio III): buscar con `Grep` en `backend/src/api/articles.routes.ts`, `backend/src/custom/omitted-item.repo.ts` y `backend/src/catalog/` que no haya `console.*`, que ningún mensaje de error ni respuesta incluya credenciales ni direcciones de fotos, que el identificador se valide (≤ 64 caracteres) antes de tocar la base y que las consultas usen parámetros (`?`), no texto concatenado; confirmar que las tres rutas están en la prueba de guardia (T010). Anotar el resultado en el mensaje de la tarea
- [ ] T051 Ejecutar la verificación completa en la raíz: `npm run build -w frontend` (la suite de PDF reutiliza `frontend/dist`; sin esto correría con el código anterior), `npm test`, `npm run test:pdf`, `npm run typecheck -w backend`, `npm run lint` y `npm run build`; todo en verde. **Parcial (2026-10-05)**: las 772 pruebas de backend, las 546 de frontend, `test:pdf` (18/18), typecheck, lint y build pasan; pero con la suite de backend completa en paralelo, el `afterAll` de la suite «calidad del PDF con Chrome real» (feature 005) agota los 120 s de forma intermitente al cerrar Chrome (a veces también `panel-layout`, `editor-browser` o una prueba de `templates`). Con el commit base y con estos cambios, las mismas suites pasan en ~55 s en otros momentos; no se identificó la causa. Esas suites pasan siempre que se ejecutan solas o de a dos
- [ ] T052 **(Pendiente)** Ejecutar los escenarios 2 a 7 y 9 de [quickstart.md](./quickstart.md) con el simulador (`APP_URL=http://127.0.0.1:3000 npx tsx backend/tests/fixtures/dev-mock.ts` y la app con `ALEGRA_BASE_URL=http://127.0.0.1:3920`) en el navegador del panel: pantalla nueva, búsqueda sin tildes, filtro por sección, omitir y que persista (recargar, cerrar sesión, reiniciar el servidor), aviso en Generar con nombres y enlace, vista previa y PDF sin los omitidos, coherencia con «Palillos», «Sin foto» y «Champong» (componente del «Combo regalo»), sección que se vacía, cambio desde otra pestaña (`409`) y Alegra caída. **Reiniciar el servidor** antes de empezar (en 004 el puerto seguía con el código anterior). Anotar cualquier desvío
- [ ] T053 **(Pendiente: requiere confirmar con el responsable el uso de la cuenta real)** Ejecutar el escenario 8 de [quickstart.md](./quickstart.md) con la **cuenta real** (manual, solo lectura, con la conexión que la app ya tiene guardada; **confirmar antes con el responsable** porque usa sus credenciales y descarga las fotos de su tienda a `data/image-cache/`, ignorada por git): medir cuánto tarda en aparecer la lista de Artículos de Alegra (< 10 s, SC-009), omitir 2 o 3 artículos que la persona responsable elija, preparar y generar con Neón Noche, comprobar que ninguno aparece (buscar sus nombres en el PDF), que el resto está intacto y que Neón Noche conserva el aspecto de `docs/Cat.pdf`; volver a incluirlos y comprobar que reaparecen; la persona responsable lo aprueba (SC-010)
- [ ] T054 **(Pendiente: depende de T052 y T053)** Crear `specs/006-omit-alegra-articles/validation.md` con los resultados de T052 y T053 **sin datos privados** (sin nombres de productos reales, direcciones firmadas ni credenciales): qué escenarios pasaron, tiempos medidos, el número de páginas antes y después de omitir, la revisión contra `docs/Cat.pdf` y las decisiones de la persona responsable; marcar como cumplidos los 9 escenarios del quickstart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias (T004 antes de T005, T014, T026 y T041; T006 antes de T013).
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de US1 (necesita la regla del constructor T013, las rutas T014 y la pantalla T016).
- **US3 (Phase 5)**: depende de US1; **independiente de US2** salvo por los archivos compartidos que se indican abajo.
- **Polish (Phase 6)**: depende de las historias deseadas; T052–T054 al final.

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias.
- **US2 (P2)**: tras US1. Comparte archivos con US1 y US3: `omitted-items.test.ts` (T008 → T020 → T031), `omitted-articles.test.ts` (T009 → T021 → T032), `articles.test.tsx` (T011 → T023 → T037), `Articles.tsx` (T016 → T029 → T046), `catalog-builder.ts` (T006 → T013 → T024 → T038), `types.ts` (T024 → T040) y `catalog.service.ts` (T026 → T039).
- **US3 (P3)**: tras US1. Si se hace antes que US2, las tareas T031 y T032 dependen de T013 y T014 (no de T024/T026) y solo cambia el orden de los archivos compartidos de arriba.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Repositorio y entrada al constructor (Foundational) → regla del constructor → rutas → pantalla.
- La regla vive solo en `catalog-builder.ts`; ninguna ruta ni pantalla vuelve a decidir qué entra al catálogo.
- **T051 reconstruye `frontend/dist` antes de `test:pdf`** y T048 se ejecuta con ese `dist` vigente.

### Parallel Opportunities

- Foundational: T002, T003 y T006 en paralelo; T004 después de T003; T005 después de T004.
- US1: T008, T009, T010, T011 y T012 en paralelo (archivos distintos); T017 y T018 en paralelo; T014 → T015 → T016.
- US2: T020, T022 y T023 en paralelo (T021 espera a T009, mismo archivo); T025 y T027 en paralelo; T026 después de T025; T028 después de T027.
- US3: T031, T033, T034, T035, T036 y T037 en paralelo (archivos distintos); T041, T043, T044 y T045 en paralelo; T042 después de T014; T046 después de T029 y T042.
- Polish: T048, T049 y T050 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 juntas (archivos distintos):
Task: "Escribir backend/tests/unit/omitted-items.test.ts"
Task: "Escribir backend/tests/integration/omitted-articles.test.ts"
Task: "Ampliar backend/tests/integration/auth-guard.test.ts"
Task: "Escribir frontend/tests/articles.test.tsx"
Task: "Actualizar frontend/tests/sidebar.test.tsx"

# Piezas independientes de US1 una vez hecha la regla y las rutas:
Task: "Registrar la ruta /articulos en frontend/src/App.tsx"
Task: "Agregar la entrada al menú en frontend/src/components/Sidebar.tsx"
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Setup (T001) y Foundational (T002–T007).
2. US1 (T008–T019): las pruebas fallan, se implementa, pasan.
3. **PARAR y validar**: con el simulador, abrir Artículos de Alegra, omitir dos artículos, recargar y reiniciar el servidor (siguen omitidos), preparar y mirar la vista previa y el payload del PDF: sin los omitidos y con el resto igual. Con esto solo ya se resuelve lo pedido.

### Incremental Delivery

1. Setup + Foundational → la lista se guarda y llega al constructor.
2. US1 → probar → **MVP** (omitir y generar sin esos artículos).
3. US2 → probar → se ve qué se omite, se recupera con un gesto y el PDF no sale con una lista distinta de la revisada.
4. US3 → probar → sin ruido en avisos ni contadores, combos intactos, Inicio coherente.
5. Polish → texto del PDF real, documentación, seguridad y validación con la cuenta real (T053–T054).

### Notas

- **Decisiones ya tomadas** (no reabrir sin consultar): la lista es **permanente** (Clarifications de la spec); la regla vive en el constructor y se aplica dentro del bucle de ítems, **sin filtrar** `alegraById`; la clave es el identificador de Alegra; `counts.omitted` conserva su significado (sin foto + sin sección) y los omitidos por decisión van aparte en `omittedByChoice`; la firma y el `409 omitted_changed` se limitan a la lista de omitidos (las asignaciones de «Sin categoría» conservan su comportamiento); «Productos activos en Alegra» no baja al omitir; el Historial no registra los omitidos.
- Esta feature **no toca** `CatalogDocument`, las plantillas, los combos, la calidad del PDF de 005 ni la forma de obtener las fotos.
- Alegra solo se consulta con `GET`; omitir e incluir no la consultan (principio I).
- Ningún dato real de la tienda (nombres de productos, direcciones firmadas, token, fotos) va en commits ni en la documentación; `data/` está en `.gitignore`.
- Confirma que cada prueba falla antes de implementar y que `npm test` queda en verde al cerrar cada historia.

---

## Cobertura de requisitos

| Requisito | Tareas |
| --- | --- |
| FR-001, FR-003 | T009, T011, T014, T016, T023, T029 |
| FR-002 | T009, T011, T014, T016 |
| FR-004, SC-003 | T002, T003, T004, T009, T052 |
| FR-005, FR-013, FR-014, SC-002, SC-005 | T008, T013, T048 |
| FR-006 | T008, T013 |
| FR-007 | T004, T009, T050 |
| FR-008, SC-004, SC-008 | T020, T021, T022, T024, T028 |
| FR-009, SC-007 | T031, T032, T034, T038, T039, T041, T043, T044 |
| FR-010 | T005, T033, T035, T040, T045 |
| FR-011 | T031, T032, T037, T042, T046 |
| FR-012 | T021, T022, T025, T026 |
| FR-015 | T009, T011, T016 |
| FR-016 | todas las tareas de pruebas (T002, T008–T012, T020–T023, T031–T037, T048) |
| SC-001, SC-009, SC-010 | T052, T053 |
| SC-006 | T021, T048, T053 |
