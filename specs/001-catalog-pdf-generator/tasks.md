# Tasks: Generador de Catálogo PDF ASIANPOP MARKET+

**Input**: Documentos de diseño en `/specs/001-catalog-pdf-generator/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rest-api.md](./contracts/rest-api.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. La constitución (principio V) exige pruebas automatizadas para las reglas de negocio (stock, imagen, paginación, combos, overrides, cifrado). Las pruebas de Alegra usan un servidor simulado y nunca la cuenta real.

**Organization**: Tareas agrupadas por historia de usuario para implementar y probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US6)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicializar los dos paquetes y las herramientas.

- [X] T001 Crear `package.json` raíz con workspaces `backend` y `frontend`, scripts `build`, `start`, `dev`, `test` y `test:pdf`, y `.gitignore` (incluye `.env`, `data/`, `node_modules/`, `dist/`)
- [X] T002 [P] Inicializar `backend/` (TypeScript estricto, Express, better-sqlite3, Puppeteer, zod, multer, pdf-parse, Vitest, supertest) en `backend/package.json` y `backend/tsconfig.json`
- [X] T003 [P] Inicializar `frontend/` (React 18, Vite, Tailwind CSS, React Router, Vitest, Testing Library) en `frontend/package.json`, `frontend/vite.config.ts` y `frontend/tailwind.config.js`
- [X] T004 [P] Crear `.env.example` con `PORT`, `SEED_USERNAME`, `SEED_PASSWORD`, `ENCRYPTION_KEY` (sin valores reales) y documentar cómo generar la clave
- [X] T005 [P] Configurar ESLint y Prettier compartidos en `eslint.config.js` y `.prettierrc`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestructura que TODAS las historias necesitan. Ninguna historia empieza antes de completar esta fase.

- [X] T006 Implementar la carga y validación de variables de entorno (falla al arrancar si falta alguna) en `backend/src/config/env.ts`
- [X] T007 [P] Escribir pruebas del cifrado AES-256-GCM (ida y vuelta, token alterado falla) en `backend/tests/unit/crypto.test.ts`
- [X] T008 [P] Implementar cifrado y descifrado AES-256-GCM en `backend/src/config/crypto.ts`
- [X] T009 Implementar la conexión SQLite, el ejecutor de migraciones numeradas y el directorio `data/` en `backend/src/db/database.ts`
- [X] T010 Crear la migración inicial con todas las tablas de [data-model.md](./data-model.md) (`alegra_connection`, `business_settings`, `section`, `section_order`, `custom_product`, `product_option`, `bundle`, `bundle_component`, `category_override`, `generated_catalog`) en `backend/src/db/migrations/001_init.sql`
- [X] T011 [P] Implementar el enmascarado de secretos en logs (`Authorization`, `apiToken`) y el manejador de errores común (`{ error, message, details }`) en `backend/src/api/errors.ts`
- [X] T012 Crear el servidor Express que escucha solo en `127.0.0.1`, sirve el frontend compilado y monta las rutas bajo `/api` en `backend/src/server.ts`
- [X] T013 [P] Crear la plantilla de la aplicación React: enrutador, layout con navegación, cliente HTTP con manejo de `401` en `frontend/src/main.tsx`, `frontend/src/App.tsx` y `frontend/src/services/api.ts`
- [X] T014 [P] Definir el tema neón, fuentes locales y reglas globales de página A4 (`@page { size: A4; margin: 0 }`) en `frontend/src/styles/theme.css`

**Checkpoint**: el servidor arranca, la base se crea y la plantilla React carga.

---

## Phase 3: User Story 2 - Acceso con login básico (Priority: P1)

**Goal**: ninguna pantalla ni endpoint funciona sin sesión; ingreso con credenciales semilla.

**Independent Test**: sin sesión todo redirige al login; con los datos semilla se accede; con datos incorrectos hay error genérico; cerrar sesión vuelve al login (quickstart escenario 1).

### Tests for User Story 2

- [X] T015 [P] [US2] Prueba de integración de `/auth/login`, `/auth/logout`, `/auth/session`, error genérico y límite de 5 intentos por minuto en `backend/tests/integration/auth.test.ts`
- [X] T016 [P] [US2] Prueba de que cualquier ruta `/api/*` sin sesión devuelve `401` en `backend/tests/integration/auth-guard.test.ts`

### Implementation for User Story 2

- [X] T017 [US2] Implementar el almacén de sesiones en memoria, la comparación en tiempo constante de credenciales semilla y la cookie `httpOnly`/`sameSite=strict` en `backend/src/auth/session.ts`
- [X] T018 [US2] Implementar el middleware de autenticación y el limitador de intentos de login en `backend/src/auth/middleware.ts`
- [X] T019 [US2] Implementar las rutas `/auth/login`, `/auth/logout`, `/auth/session` y aplicar el middleware a todas las demás rutas en `backend/src/api/auth.routes.ts`
- [X] T020 [P] [US2] Crear la página de login con mensaje de error genérico en `frontend/src/pages/Login.tsx`
- [X] T021 [US2] Agregar la ruta protegida, la redirección al login y el botón "Cerrar sesión" en `frontend/src/App.tsx`

**Checkpoint**: US2 funciona de forma independiente.

---

## Phase 4: User Story 3 - Configurar y probar la conexión con Alegra (Priority: P1)

**Goal**: guardar y validar correo y token de Alegra sin reiniciar; el token jamás se muestra.

**Independent Test**: credenciales inválidas se rechazan y conservan las anteriores; las válidas se guardan y el token no aparece en ninguna respuesta (quickstart escenario 2).

### Tests for User Story 3

- [X] T022 [P] [US3] Crear el servidor simulado de Alegra (company, items, item-categories, paginación de 30, errores 401 y 429) en `backend/tests/fixtures/alegra-mock.ts`
- [X] T023 [P] [US3] Prueba de integración de `GET/PUT /settings/alegra` y `POST /settings/alegra/test`: rechazo conserva las anteriores, el token nunca sale en respuestas ni logs en `backend/tests/integration/alegra-settings.test.ts`
- [X] T024 [P] [US3] Prueba unitaria del cliente de Alegra: paginación hasta agotar resultados, reintento ante 429, manejo de 401 en `backend/tests/unit/alegra-client.test.ts`

### Implementation for User Story 3

- [X] T025 [P] [US3] Definir los tipos crudos de Alegra (`inventory`, `trackInventory`, `images`, `category`, `type`, IDs como texto opaco) en `backend/src/alegra/alegra.types.ts`
- [X] T026 [US3] Implementar el cliente HTTP de Alegra solo con `GET`, autenticación Basic, paginación `start`/`limit=30`, reintentos ante 429 y errores tipados en `backend/src/alegra/alegra.client.ts`
- [X] T027 [US3] Implementar el repositorio de la conexión (guardar cifrado, leer, `last_tested_at`) en `backend/src/alegra/connection.repo.ts`
- [X] T028 [US3] Implementar las rutas `/settings/alegra` (GET, PUT con validación previa) y `/settings/alegra/test` con límite de 10 por minuto en `backend/src/api/alegra-settings.routes.ts`
- [X] T029 [P] [US3] Crear la página de conexión con Alegra (correo, token, probar, guardar, estado) en `frontend/src/pages/AlegraSettings.tsx`

**Checkpoint**: US2 y US3 funcionan; ya se puede leer Alegra.

---

## Phase 5: User Story 1 - Generar el catálogo PDF desde Alegra (Priority: P1) 🎯 MVP

**Goal**: preparar, revisar y generar un PDF A4 fiel a `Cat.pdf` con productos de Alegra.

**Independent Test**: con credenciales válidas, generar el catálogo y comprobar portada, portadas de sección, máx. 3 productos por página, sello AGOTADO, ítems sin imagen omitidos y políticas (quickstart escenarios 3, 4 y 9).

### Tests for User Story 1

- [X] T030 [P] [US1] Pruebas de reglas de stock (`trackInventory` y `availableQuantity`, ítem sin control = disponible) en `backend/tests/unit/stock-rules.test.ts`
- [X] T031 [P] [US1] Pruebas de paginación en bloques de 3 con categorías de 0, 1, 3, 4 y 7 productos, y omisión de categorías vacías en `backend/tests/unit/pagination.test.ts`
- [X] T032 [P] [US1] Pruebas de formato de precio en pesos colombianos (`$9.000`, `$15.000`) en `backend/tests/unit/price-format.test.ts`
- [X] T033 [P] [US1] Pruebas de omisión de ítems sin imagen o con descarga fallida y de ordenamiento de secciones en `backend/tests/unit/catalog-builder.test.ts`
- [X] T034 [P] [US1] Prueba de integración de `prepare` y `generate` (informe, `409` por concurrencia, `410` expirado, `422` catálogo vacío, sin PDF parcial si Alegra falla) en `backend/tests/integration/catalog-generate.test.ts`
- [X] T035 [P] [US1] Prueba de integración que genera un PDF de muestra con datos simulados y verifica A4, número de páginas y texto con `pdf-parse` en `backend/tests/integration/pdf-render.test.ts`

### Implementation for User Story 1

- [X] T036 [P] [US1] Implementar el formateo de precios COP en `backend/src/catalog/price-format.ts`
- [X] T037 [P] [US1] Implementar el normalizador de ítems de Alegra a `AlegraItem` (stock, imagen, precio, categoría) en `backend/src/alegra/alegra.mapper.ts`
- [X] T038 [P] [US1] Implementar la descarga de imágenes con timeout de 10 s, concurrencia 6 y caché local en `backend/src/pdf/image-cache.ts`
- [X] T039 [US1] Implementar el constructor del catálogo (agrupar por categoría, aplicar reglas, ordenar secciones, paginar de a 3, producir `CatalogPayload` y `ReviewReport`) en `backend/src/catalog/catalog-builder.ts`
- [X] T040 [P] [US1] Implementar el repositorio del orden de secciones y la configuración del negocio (con valores iniciales de `Cat.pdf`, incluidas las políticas de la pág. 38) en `backend/src/catalog/settings.repo.ts`
- [X] T041 [US1] Implementar el trabajo único de generación con estados y bloqueo de concurrencia en `backend/src/pdf/job.ts`
- [X] T042 [US1] Implementar el servicio de Puppeteer (navegador reutilizado, página cerrada en `finally`, `printBackground`, `preferCSSPageSize`, espera de fuentes e imágenes) en `backend/src/pdf/pdf.service.ts`
- [X] T043 [US1] Implementar el historial (últimos 10 PDF con limpieza de archivos) en `backend/src/pdf/history.repo.ts`
- [X] T044 [US1] Implementar las rutas `/catalog/prepare`, `/catalog/generate`, `/catalog/jobs/current`, `/catalog/history*` y `/media/*` en `backend/src/api/catalog.routes.ts`
- [X] T045 [US1] Implementar el endpoint interno de datos de impresión con token de un solo uso y restricción a `127.0.0.1` en `backend/src/api/print.routes.ts`
- [X] T046 [P] [US1] Crear el componente de tarjeta de producto con imagen, descripción, precio y sello AGOTADO en `frontend/src/print/ProductCard.tsx`
- [X] T047 [P] [US1] Crear la portada general (logo, título, teléfonos) en `frontend/src/print/CoverPage.tsx`
- [X] T048 [P] [US1] Crear la portada de sección en `frontend/src/print/SectionCover.tsx`
- [X] T049 [P] [US1] Crear la página de políticas en `frontend/src/print/TermsPage.tsx`
- [X] T050 [US1] Crear la página A4 de catálogo con máximo 3 tarjetas, pie con teléfonos y dirección, y componer todo el documento en `frontend/src/print/CatalogPage.tsx` y `frontend/src/print/CatalogDocument.tsx`
- [X] T051 [US1] Crear la ruta de impresión `/print/:prepareId` que carga el payload con el token y marca la página como lista (`window.__printReady`) en `frontend/src/pages/Print.tsx`
- [X] T052 [US1] Crear la pantalla "Generar" con botón Preparar, informe de revisión, opción de ocultar agotados, botón Generar, estado con sondeo cada segundo y descarga en `frontend/src/pages/Generate.tsx`
- [X] T053 [P] [US1] Crear la pantalla de historial con descarga en `frontend/src/pages/History.tsx`
- [X] T054 [US1] Ejecutar `npm run test:pdf` y comparar el PDF resultante con `docs/Cat.pdf` en estructura y estilo; anotar diferencias de diseño y corregirlas en `frontend/src/print/` y `frontend/src/styles/theme.css`

**Checkpoint**: MVP completo. US1, US2 y US3 funcionan juntas.

---

## Phase 6: User Story 4 - Resolver ítems sin categoría (Priority: P2)

**Goal**: alertar los ítems sin categoría y permitir asignarles una sección solo en el sistema.

**Independent Test**: un ítem sin categoría aparece en la alerta, se le asigna una sección, aparece en esa sección del PDF y Alegra no cambia (quickstart escenario 5).

### Tests for User Story 4

- [X] T055 [P] [US4] Pruebas unitarias de overrides (aplicar, quitar, ítem sin sección va a `omittedNoSection`) en `backend/tests/unit/category-override.test.ts`
- [X] T056 [P] [US4] Prueba de integración de `/catalog/uncategorized*`, incluida la verificación de que nunca se hace una petición de escritura a Alegra, en `backend/tests/integration/uncategorized.test.ts`

### Implementation for User Story 4

- [X] T057 [US4] Implementar el repositorio de `category_override` en `backend/src/custom/override.repo.ts`
- [X] T058 [US4] Integrar los overrides en el constructor del catálogo y completar `uncategorized` y `omittedNoSection` del informe en `backend/src/catalog/catalog-builder.ts`
- [X] T059 [US4] Implementar las rutas `/catalog/uncategorized*` en `backend/src/api/uncategorized.routes.ts`
- [X] T060 [P] [US4] Crear la pantalla y la alerta de ítems sin categoría (visible también en el panel y en "Generar") en `frontend/src/pages/Uncategorized.tsx` y `frontend/src/components/UncategorizedAlert.tsx`

**Checkpoint**: US4 funciona de forma independiente sobre US1.

---

## Phase 7: User Story 5 - Gestionar secciones y productos propios (Priority: P2)

**Goal**: crear secciones y productos propios (MOCHIS) con opciones y sabores, incluidos en el catálogo.

**Independent Test**: crear MOCHIS con un producto con sabores y cajas x6/x12 y una imagen; aparece en el PDF sin sello AGOTADO (quickstart escenario 6).

### Tests for User Story 5

- [X] T061 [P] [US5] Pruebas unitarias de validación de productos propios (precio u opciones obligatorios, `maxFlavors`) y de que nunca llevan sello AGOTADO en `backend/tests/unit/custom-product.test.ts`
- [X] T062 [P] [US5] Prueba de integración de CRUD de secciones y productos propios, carga de imagen (tipo y tamaño) y orden de secciones en `backend/tests/integration/custom-sections.test.ts`

### Implementation for User Story 5

- [X] T063 [P] [US5] Implementar los repositorios de `section`, `custom_product`, `product_option` y `section_order` en `backend/src/custom/section.repo.ts` y `backend/src/custom/custom-product.repo.ts`
- [X] T064 [US5] Implementar las rutas `/sections*`, `/custom-products*` y la carga de imágenes con multer (png/jpg/webp ≤ 5 MB) en `backend/src/api/custom.routes.ts`
- [X] T065 [US5] Integrar secciones y productos propios en el constructor del catálogo (mismo orden unificado, sin imagen = omitido) en `backend/src/catalog/catalog-builder.ts`
- [X] T066 [P] [US5] Crear la tarjeta y la página de sección propia (intro, sabores, opciones con precio y máximo de sabores) en `frontend/src/print/CustomSectionPage.tsx`
- [X] T067 [P] [US5] Crear la pantalla de secciones con reordenamiento arrastrable en `frontend/src/pages/Sections.tsx`
- [X] T068 [P] [US5] Crear la pantalla de productos propios con opciones, sabores e imagen en `frontend/src/pages/CustomProducts.tsx`
- [X] T069 [US5] Crear la pantalla de configuración del negocio (nombre, teléfonos, dirección, políticas) en `frontend/src/pages/BusinessSettings.tsx` y las rutas `/settings/business` en `backend/src/api/business.routes.ts`

**Checkpoint**: US5 funciona de forma independiente.

---

## Phase 8: User Story 6 - Crear combos de regalo con descuento (Priority: P3)

**Goal**: combos con componentes de Alegra o propios, precio fijo o descuento, y decisión por generación si un componente está agotado.

**Independent Test**: un combo con 10 % de descuento y otro con precio fijo muestran el precio correcto; un componente agotado dispara la alerta y la decisión mantener u omitir se respeta (quickstart escenarios 7 y 8).

### Tests for User Story 6

- [X] T070 [P] [US6] Pruebas unitarias del precio de combo (fijo, descuento, redondeo a $100, validaciones) en `backend/tests/unit/bundle-pricing.test.ts`
- [X] T071 [P] [US6] Pruebas unitarias de combos con componente agotado, eliminado o inactivo y de decisiones mantener/omitir en `backend/tests/unit/bundle-soldout.test.ts`
- [X] T072 [P] [US6] Prueba de integración de CRUD de combos, `bundle_decision_required` y bloqueo de eliminar un producto usado en un combo en `backend/tests/integration/bundles.test.ts`

### Implementation for User Story 6

- [X] T073 [P] [US6] Implementar el cálculo del precio de combo en `backend/src/catalog/bundle-pricing.ts`
- [X] T074 [US6] Implementar el repositorio de `bundle` y `bundle_component` en `backend/src/custom/bundle.repo.ts`
- [X] T075 [US6] Integrar combos en el constructor del catálogo: componentes agotados en `soldOutBundles`, decisión por combo y combo sin imagen omitido, en `backend/src/catalog/catalog-builder.ts`
- [X] T076 [US6] Implementar las rutas `/bundles*` y exigir `bundleDecisions` en `/catalog/generate` en `backend/src/api/bundles.routes.ts` y `backend/src/api/catalog.routes.ts`
- [X] T077 [P] [US6] Crear la tarjeta de combo con componentes y precio en `frontend/src/print/BundleCard.tsx`
- [X] T078 [P] [US6] Crear la pantalla de combos (componentes de Alegra y propios, precio fijo o descuento) en `frontend/src/pages/Bundles.tsx`
- [X] T079 [US6] Agregar a la pantalla "Generar" el diálogo de decisión por combo agotado (mantener con sello u omitir) en `frontend/src/pages/Generate.tsx`

**Checkpoint**: todas las historias funcionan.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T080 [P] Verificar con la cuenta real las incógnitas de [research.md](./research.md) (URL base, estructura de `images`, precio, comportamiento 429) y ajustar `backend/src/alegra/alegra.types.ts` y `backend/src/alegra/alegra.mapper.ts`
- [X] T081 [P] Prueba de seguridad: el token nunca aparece en respuestas, logs ni errores, y el servidor solo escucha en `127.0.0.1`, en `backend/tests/integration/security.test.ts`
- [X] T082 [P] Pruebas de interfaz de las pantallas críticas (login, generar con alertas, decisión de combos) en `frontend/tests/`
- [X] T083 Revisar casos borde de la spec: textos largos que no desbordan, Alegra caído, catálogo vacío, doble clic en Generar, combo con componente eliminado
- [X] T084 [P] Escribir el `README.md` con instalación, `.env`, ejecución y solución de problemas
- [ ] T085 Ejecutar todos los escenarios de [quickstart.md](./quickstart.md) y la revisión visual final contra `docs/Cat.pdf` (SC-008)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (1)** → **Foundational (2)** → historias de usuario → **Polish (9)**.
- Foundational bloquea todas las historias.

### User Story Dependencies
- **US2 (login)**: depende solo de Foundational.
- **US3 (conexión Alegra)**: requiere US2 (rutas protegidas).
- **US1 (generar, MVP)**: requiere US3 (leer Alegra).
- **US4, US5**: extienden el constructor del catálogo de US1; son independientes entre sí, pero tocan `catalog-builder.ts`, así que se hacen en secuencia (no en paralelo) en esa tarea.
- **US6**: requiere US5 (secciones propias donde vive el combo).

Orden: `Foundational → US2 → US3 → US1 (MVP) → US4 → US5 → US6 → Polish`.

### Within Each User Story
Pruebas primero (deben fallar) → repositorios y reglas → servicios → rutas → pantallas.

### Parallel Opportunities
- Setup: T002-T005 en paralelo.
- Foundational: T007, T008, T011, T013 y T014 en paralelo.
- US1: pruebas T030-T035 en paralelo; mapeo T036-T038 y componentes de impresión T046-T049 en paralelo.
- US4, US5 y US6: pruebas y pantallas en paralelo; las tareas de `catalog-builder.ts` (T058, T065, T075) van en secuencia.

### Parallel Example: User Story 1
```text
Lanzar juntas:  T030 T031 T032 T033 T034 T035        (pruebas)
Luego juntas:   T036 T037 T038 T040                  (reglas y utilidades)
Luego juntas:   T046 T047 T048 T049                  (componentes de impresión)
```

## Implementation Strategy

### MVP First (US2 + US3 + US1)
1. Setup y Foundational.
2. US2 (login), US3 (conexión Alegra) y US1 (generación).
3. **Detenerse y validar**: generar un catálogo real y compararlo con `docs/Cat.pdf`.

### Entrega incremental
MVP → US4 (alerta sin categoría) → US5 (mochis y productos propios) → US6 (combos) → Polish. Cada incremento se valida con su escenario del quickstart sin romper lo anterior.

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes.
- Confirmar que las pruebas fallan antes de implementar.
- Hacer commit por tarea o grupo lógico (el proyecto ya es un repositorio git, rama `main`).
- T080 debe hacerse lo antes posible si hay credenciales disponibles, porque puede cambiar tipos y mapeos de US1; si se dispone de ellas, adelantarla antes de T025.
