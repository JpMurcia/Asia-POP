# Tasks: PDF del catálogo liviano para enviar

**Input**: Documentos de diseño en `/specs/005-optimize-pdf-size/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/rest-api.md](./contracts/rest-api.md), [contracts/generate-ui.md](./contracts/generate-ui.md), [quickstart.md](./quickstart.md). Requiere las features 001–004 funcionando (`npm test` en verde antes de empezar) y la constitución en v1.1.0 (no hace falta enmendarla).

**Tests**: Incluidos. La constitución (principio V) y FR-015 exigen pruebas para cada regla de la spec, con fotos sintéticas que imiten el catálogo real (JPG y PNG grandes, PNG con transparencia, PNG con canal alfa opaco, foto diminuta, con orientación EXIF y dañada). Escribe cada prueba **antes** de su implementación y comprueba que falla. Nunca se prueba contra la cuenta real de forma automática.

**Organization**: Tareas agrupadas por historia de usuario. **US1 es el MVP**: por sí sola entrega PDF livianos con la opción visible. US2 (tamaño visible) y US3 (Original idéntico y sin regresiones) dependen de US1 pero son independientes entre sí. US3 es sobre todo de **verificación**: casi no agrega código; las pruebas pueden revelar fallos que se corrigen en el módulo dueño.

**Control de versiones**: el proyecto ya es un repositorio git (rama `main`); `data/` (donde viven las copias temporales de fotos) está en `.gitignore`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US3)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)). Los módulos nuevos de lógica `pdf-quality.ts`, `photo-target.ts` y `photo-variants.ts` son **puros** (sin red, sin disco y sin `sharp`): se prueban sin simuladores y los dos que usa el frontend no arrastran nada de Node. **Todo lo que usa `sharp` vive en un solo archivo**: `backend/src/pdf/image-optimizer.ts`.

---

## Phase 1: Setup

**Purpose**: punto de partida verificado y la única dependencia nueva.

- [X] T001 Ejecutar `npm test`, `npm run typecheck -w backend` y `npm run lint` en la raíz y anotar en el mensaje de la tarea cualquier fallo previo a esta feature, para distinguirlo de regresiones propias
- [X] T002 Instalar la dependencia con `npm install sharp@^0.35.5 -w backend` desde la raíz; comprobar que `backend/package.json` la lista en `dependencies`, que `package-lock.json` de la raíz se actualizó y que carga: `node -e "import('sharp').then(m => console.log(m.default.versions.sharp))"` desde `backend/` imprime la versión. La justificación del principio VI está en [plan.md](./plan.md) (Complejidad) y [research.md](./research.md) §2

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el módulo compartido de calidad y los datos de prueba. Todo es aditivo: ningún comportamiento cambia hasta US1. **Ninguna historia empieza antes de completar esta fase.**

- [X] T003 [P] Escribir `backend/tests/unit/pdf-quality.test.ts` para el módulo `catalog/pdf-quality`: `PDF_QUALITIES` es `['optimized', 'original']` y `DEFAULT_PDF_QUALITY` es `'optimized'` (FR-002); `PDF_TARGET_BYTES === 25 * 1024 * 1024`; `formatMegabytes(19_320_118)` ⇒ `'18,4 MB'`, `formatMegabytes(32_700_000)` ⇒ `'31,2 MB'`, `formatMegabytes(1_048_576)` ⇒ `'1,0 MB'`, `formatMegabytes(0)` ⇒ `'0,0 MB'` (coma decimal, un decimal, 1 MB = 1.048.576 bytes); `exceedsTarget(PDF_TARGET_BYTES)` es `false` y `exceedsTarget(PDF_TARGET_BYTES + 1)` es `true`; `PDF_QUALITY_OPTIONS` tiene para cada calidad una `label` y una `hint` en español, la de `optimized` marcada `recommended`, y los textos coinciden con la tabla de [contracts/generate-ui.md](./contracts/generate-ui.md) §1 (la `hint` de `original` menciona que el archivo «puede ser varias veces más grande» y ninguna usa jerga como «ppp», «JPEG» o «compresión»)
- [X] T004 [P] Crear el módulo puro `backend/src/catalog/pdf-quality.ts` (sin imports de Node) con `PDF_QUALITIES`, `type PdfQuality`, `DEFAULT_PDF_QUALITY`, `PDF_TARGET_BYTES`, `PDF_QUALITY_OPTIONS: Record<PdfQuality, { label: string; hint: string; recommended?: boolean }>` con los textos exactos de [contracts/generate-ui.md](./contracts/generate-ui.md) §1, `formatMegabytes(bytes)` (`(bytes / 1_048_576).toFixed(1).replace('.', ',') + ' MB'`, sin depender de `Intl`) y `exceedsTarget(bytes)`; la forma está en [data-model.md](./data-model.md) («Calidad del PDF»)
- [X] T005 [P] Crear `backend/tests/fixtures/photos.ts` con fotos sintéticas hechas con `sharp` y ruido pseudoaleatorio con semilla fija (reproducibles; las de ruido pesan mucho como PNG, igual que las del catálogo real), memoizadas, cada una `Promise<Buffer>` y todas menores de 10 MB (tope de `ImageCache`): `heavyPng()` (opaca, 900 × 1200), `heavyJpeg()` (opaca, 1600 × 1200), `transparentPng()` (RGBA 800 × 1000 con un círculo opaco y el resto de **alfa 0**; el píxel (0,0) es transparente), `opaqueAlphaPng()` (RGBA 800 × 1000 con alfa 255 en todos los píxeles), `tinyPng()` (40 × 40), `lightJpeg()` (JPEG 360 × 474 calidad 40, ya liviano), `exifJpeg()` (1200 × 800 almacenados con orientación EXIF 6, que se muestra de 800 × 1200), `brokenJpeg()` (bytes que empiezan por `FF D8 FF` y siguen con basura: `sniffImage` la acepta pero no se puede decodificar) y `staticGif()` (un cuadro, 600 × 600)
- [X] T006 Ampliar `backend/tests/fixtures/alegra-mock.ts` (depende de T005): rutas públicas `/img/heavy.png`, `/img/heavy.jpg`, `/img/alpha.png`, `/img/opaque-alpha.png`, `/img/tiny.png`, `/img/light.jpg`, `/img/exif.jpg`, `/img/broken.jpg` y `/img/photo.gif`, todas con `Content-Type: binary/octet-stream` como las fotos reales de Alegra y con los bytes de las fotos de T005; conservar sin cambios las rutas actuales (`/img/ok.png`, `/img/generic.*`, fallos) y que cualquier otra `/img/*` siga dando 404
- [X] T007 Ejecutar `npm test -w backend` (menos `test:pdf`): T003 falla hasta T004 y, con T004 hecho, todo pasa; las pruebas previas siguen en verde con el simulador ampliado (no se tocó ningún comportamiento)

**Checkpoint**: módulo de calidad y fotos de prueba listos; el repositorio sigue en verde.

---

## Phase 3: User Story 1 - Generar un PDF liviano que pueda enviar (Priority: P1) 🎯 MVP

**Goal**: al generar con la calidad **Optimizada** (preseleccionada), cada foto se reduce a 150 ppp al tamaño de su recuadro (calculado desde la plantilla), pasa a JPEG o, con transparencia real, a PNG reducido, y el PDF incrusta esas copias temporales; la opción **Calidad del PDF** es visible en Generar.

**Independent Test**: con el simulador y fotos sintéticas pesadas, preparar un catálogo y generarlo: el navegador de la generación recibe direcciones `/media/pdf/…` más livianas que las originales, la foto con transparencia sigue siendo PNG con transparencia, una foto que no se puede reducir conserva su dirección original, y al terminar no queda ninguna copia en disco. Corresponde a los escenarios 1–3 de [quickstart.md](./quickstart.md).

### Tests for User Story 1 ⚠️

> **NOTE: escribe estas pruebas primero y comprueba que FALLAN antes de implementar.**

- [X] T008 [P] [US1] Escribir `backend/tests/unit/photo-target.test.ts` para `photoTarget(template)` y `PDF_PPP` (módulo `pdf/photo-target`): `PDF_PPP === 150`; con `BASE_TEMPLATES` de `backend/src/catalog/template-presets.ts` devuelve `{ w: 360, h: 474 }` para Neón Noche, `{ w: 331, h: 445 }` para Pop crema, `{ w: 350, h: 403 }` para Kawaii y `{ w: 309, h: 309 }` para Kraft minimal (valores calculados con el código real en [research.md](./research.md) §4: píxeles = `ceil(unidades × 150 / 72)` sobre el mayor recuadro de foto de `layoutRows`); con Neón Noche y su bloque de productos agrandado a `w: 100, h: 100` devuelve `{ w: 360, h: 556 }`; con dos bloques de productos en la página `productos` toma el mayor ancho y el mayor alto de **todos**; ignora los bloques con `visible: false`; sin ningún bloque de productos visible devuelve `null`; no muta la plantilla recibida
- [X] T009 [P] [US1] Escribir `backend/tests/unit/photo-variants.test.ts` para `collectPhotoUrls(payload)` y `withPhotoVariants(payload, variants)` (módulo `pdf/photo-variants`, con un `CatalogPayload` armado a mano con ítems `alegra`, `custom` y `bundle`): `collectPhotoUrls` devuelve sin repetir solo las direcciones locales `/media/cache/<archivo>` y `/media/uploads/<archivo>` de todas las secciones y páginas, e ignora `''`, `https://…`, `data:` y rutas como `/assets/x.png`; `withPhotoVariants` reemplaza solo las `imageUrl` presentes en el mapa y deja las demás iguales, **no muta** el payload recibido (congelarlo con `Object.freeze` profundo), devuelve todo lo demás idéntico (`toEqual` sobre plantilla, textos, precios, `soldOut`, `components`, `options`, términos y `generatedAt`), con un mapa vacío devuelve un payload igual al original y trata igual los tres tipos de ítem
- [X] T010 [P] [US1] Escribir `backend/tests/unit/image-optimizer.test.ts` con las fotos de `backend/tests/fixtures/photos.ts` y `sharp` para leer los resultados. **`optimizePhoto(source, target)`** con `target = { w: 360, h: 474 }`: `heavyPng` ⇒ `ext: 'jpg'`, menos bytes que la entrada, dimensiones que **cubren** el objetivo (≥ 360 × 474), sin superar las de la entrada y con la proporción original (900 × 1200 ⇒ 360 × 480); `heavyJpeg` (1600 × 1200) ⇒ `jpg` de 632 × 474; `transparentPng` ⇒ `ext: 'png'`, con canal alfa y el píxel (0,0) todavía transparente (FR-006); `opaqueAlphaPng` ⇒ `jpg` sin canal alfa; `tinyPng` ⇒ `null` (no se agranda y no pesa menos, FR-007); una foto de 300 × 300 pesada ⇒ nunca más grande de 300 × 300 (FR-004: no se agranda); `lightJpeg` ⇒ `null` (recomprimirla la haría más pesada, FR-007); `exifJpeg` ⇒ el resultado ya está girado (más alto que ancho); `brokenJpeg` ⇒ `null` sin lanzar (FR-008); `staticGif` ⇒ no lanza y, si devuelve algo, sus dimensiones no superan las de la entrada; el resultado `jpg` es calidad 88 con submuestreo 4:4:4 (leer `chromaSubsampling` con `metadata()`). **`PhotoOptimizer`** con directorios temporales de `fs.mkdtempSync` (caché, subidas y raíz de copias): `run(runId, urls, target, onProgress)` devuelve un `Map` solo con las fotos que sí se redujeron, con valores `/media/pdf/<runId>/<nombre>` cuyos archivos existen en `<raíz>/<runId>/`; una dirección `/media/uploads/…` también se procesa; direcciones no locales o con nombres no seguros (`/media/cache/../x.png`) se ignoran; una foto cuyo archivo no existe se omite sin lanzar y el resto sigue; `target = null` devuelve un mapa vacío; `onProgress` se llama con `(hechas, total)` hasta `total`; `cleanup(runId)` borra `<raíz>/<runId>`; al **crear** el `PhotoOptimizer` se borra todo lo que hubiera en la raíz (restos de un cierre brusco); `fileFor(runId, nombre)` devuelve la ruta solo para nombres seguros y que existen
- [X] T011 [P] [US1] Escribir `backend/tests/integration/catalog-quality.test.ts` (copiar el `setup` y `waitFor` de `catalog-generate.test.ts`; ítems de Alegra de forma real `images: [{ id, name, url: `${mock.url}/img/heavy.png?i=1`, favorite: true }]`, con `?i=N` distinto por producto para que cada uno tenga su archivo en el caché): (a) `POST /api/catalog/generate` **sin** `quality` ⇒ el trabajo termina y `renderer.calls[0].url` contiene `/print/<prepareId>?quality=optimized`; (b) con una subclase de `FakeRenderer` cuyo `render` pida, con el agente con sesión, `GET /api/catalog/payload/<id>?quality=optimized`: las `imageUrl` de `heavy.png` y `heavy.jpg` apuntan a `/media/pdf/<trabajo>/…`, cada una responde `200` con **menos bytes** que su archivo original en `image-cache`, la de `alpha.png` termina en `.png` y conserva su transparencia, y el mismo `GET` **sin** el parámetro devuelve las direcciones originales y el resto del payload idéntico (FR-005); (c) tras terminar el trabajo `data/pdf-photos/` queda vacía (o sin subcarpetas) y la preparación ya no tiene copias; (d) con `renderer.fail = true` el trabajo falla, no hay entrada de historial y `data/pdf-photos/` queda vacía; (e) fotos `tiny.png`, `light.jpg` y `broken.jpg` conservan su dirección `/media/cache/…` original y la generación **no se detiene** (FR-007, FR-008); (f) una foto de `image-cache` borrada antes de generar no lanza: se omite (la guardia de 004 la detectará al renderizar); (g) un producto propio con imagen subida pesada (crearlo con la API de productos propios, como hacen las pruebas de `custom-product`) también recibe copia reducida; (h) `quality: 'ultra'` ⇒ `422` con `error: 'validation_error'`; (i) `GET /media/pdf/x/y` sin sesión ⇒ `401`, con un nombre no seguro ⇒ `400` y con un archivo que no existe ⇒ `404`; (j) ningún cuerpo de respuesta (`generate`, `jobs/current`, `payload`) contiene `Signature=`, `Expires=` ni la URL base del simulador, y toda petición a Alegra (`mock.requests`) fuera de `/img/*` es `GET`
- [X] T012 [P] [US1] Ampliar `frontend/tests/generate.test.tsx` (con su `mockApi`): **actualizar** las dos aserciones que comparan el cuerpo de `generate` con `toEqual` (las del combo «Omitir» y «Mantener») para que incluyan `quality: 'optimized'`; agregar pruebas: aparece el grupo **Calidad del PDF** con los radios «Optimizada» (marcado, con «Recomendada») y «Original», con el texto de ayuda de cada uno (tomado de `PDF_QUALITY_OPTIONS`) y el pie «Solo cambia esta generación.»; sin tocar la opción `generate` envía `quality: 'optimized'`; elegir «Original» y generar envía `quality: 'original'`; **cambiar la calidad no dispara ninguna petición** (ni `prepare` ni `PUT …/options`; comparar `calls` antes y después); el grupo se deshabilita mientras el trabajo está en curso; al volver a abrir la pantalla vuelve a estar marcada «Optimizada». Verificar que las pruebas existentes de los radios de plantilla (`getAllByRole('radio', { name: /Neón Noche|Pop crema|Kraft minimal/ })`) siguen pasando
- [X] T013 [P] [US1] Escribir `frontend/tests/print-quality.test.tsx`: con `vi.mock('../src/services/api')` que registre las llamadas de `api.get` y devuelva una promesa pendiente, renderizar `Print` dentro de `MemoryRouter` + `Routes` en `/print/p1?quality=optimized` y comprobar que pide `/api/catalog/payload/p1?quality=optimized`; en `/print/p1` pide `/api/catalog/payload/p1` (sin parámetro); en `/print/p1?quality=otro` pide `/api/catalog/payload/p1` (cualquier otro valor se ignora); y la vista previa (`<Print preview />` en `/vista-previa/p1`) pide el payload sin parámetro

### Implementation for User Story 1

- [X] T014 [P] [US1] Crear el módulo puro `backend/src/pdf/photo-target.ts` con `PDF_PPP = 150`, `interface PhotoTarget { w: number; h: number }` y `photoTarget(template: Template): PhotoTarget | null`: recorre los elementos `type: 'products'` y `visible` de `template.pages.productos.els`, calcula `W = (el.w / 100) × PAGE_W` y `H = (el.h / 100) × PAGE_H`, obtiene los recuadros con `layoutRows(el.layout, W, H)` (de `backend/src/catalog/template-layout.ts`), toma el mayor `photo.w` y el mayor `photo.h` de todos los bloques y devuelve `ceil(unidades × PDF_PPP / 72)` para cada uno (1 unidad lógica = 1/72 de pulgada); `null` si no hay bloques; sin mutar la plantilla
- [X] T015 [P] [US1] Crear el módulo puro `backend/src/pdf/photo-variants.ts` con `type PhotoVariants = Map<string, string>`, `collectPhotoUrls(payload)` y `withPhotoVariants(payload, variants)` según [data-model.md](./data-model.md) («Mapa de copias»): recorre `sections[].pages[][]`, solo considera direcciones que empiezan por `/media/cache/` o `/media/uploads/`, y `withPhotoVariants` devuelve un payload nuevo reemplazando únicamente `imageUrl`
- [X] T016 [US1] Crear `backend/src/pdf/image-optimizer.ts` (depende de T002 y T014), único archivo que importa `sharp`: `optimizePhoto(source: Buffer, target: PhotoTarget): Promise<OptimizedPhoto | null>` con `interface OptimizedPhoto { buffer: Buffer; ext: 'jpg' | 'png' }` según las reglas de [data-model.md](./data-model.md) («Copia reducida de una foto»): aplicar la orientación EXIF (`rotate()`), escalar con `fit: 'outside'` y `withoutEnlargement: true` hasta cubrir `target` sin recortar; si la foto tiene canal alfa y `stats().isOpaque` es `false` ⇒ PNG (`compressionLevel: 9`) conservando la transparencia; en otro caso `flatten({ background: '#ffffff' })` y JPEG `quality: 88` con `chromaSubsampling: '4:4:4'` (calidad medida en [research.md](./research.md) §5); devolver `null` si el resultado pesa **igual o más** que la entrada (FR-007) o ante cualquier error (FR-008, nunca lanza). Agregar `class PhotoOptimizer` con `constructor(rootDir, { cacheDir, uploadsDir })` que **borra** `rootDir` al crearse, `run(runId, urls, target, onProgress?)` (concurrencia limitada a 4; resuelve cada dirección local a su archivo con el filtro de nombres seguros `^[A-Za-z0-9._-]+$`, lee, optimiza y escribe en `<rootDir>/<runId>/<hash de la dirección>.<ext>`; devuelve `Map<dirección original, '/media/pdf/<runId>/<archivo>'>` solo con las que se redujeron; omite sin lanzar archivos que faltan, direcciones no locales y `target === null`), `cleanup(runId)` y `fileFor(runId, nombre)`. Sin `console.*` ni registrar direcciones de fotos
- [X] T017 [P] [US1] En `backend/src/catalog/prepare-store.ts` agregar a `PrepareEntry` el campo `variants?: PhotoVariants` (import de tipo desde `../pdf/photo-variants`) y los métodos `setVariants(id, variants)` y `clearVariants(id)` (se usan solo mientras se renderiza)
- [X] T018 [US1] En `backend/src/context.ts` agregar `photoOptimizer: PhotoOptimizer` a `AppContext` y crearlo en `createContext` con `new PhotoOptimizer(path.join(config.dataDir, 'pdf-photos'), { cacheDir: path.join(config.dataDir, 'image-cache'), uploadsDir: path.join(config.dataDir, 'uploads') })` (depende de T016)
- [X] T019 [US1] En `backend/src/catalog/catalog.service.ts` (depende de T004, T014, T015, T016, T017 y T018): `generate(prepareId, decisions, quality: PdfQuality = DEFAULT_PDF_QUALITY)` pasa la calidad, el payload construido y `resolved.template` a `render()` y guarda `quality` dentro de `params` junto a `options`, `decisions` y `pages`. En `render()`, **solo si** `quality === 'optimized'` y `photoTarget(template)` no es `null`: poner el paso «Optimizando fotos» con progreso 5, llamar a `photoOptimizer.run(jobId, collectPhotoUrls(payload), target, …)` mapeando el avance a 5–30 %, y si el mapa no está vacío guardarlo con `prepares.setVariants`; abrir `${runtime.baseUrl}/print/${prepareId}` añadiendo `?quality=optimized` **solo** si hay copias; en el `finally` hacer `prepares.clearVariants(prepareId)` y `photoOptimizer.cleanup(jobId)` además de destruir la sesión. En calidad Original no se llama al optimizador ni se agrega ningún parámetro
- [X] T020 [US1] En `backend/src/api/catalog.routes.ts` (depende de T004, T015, T018 y T019): `generateSchema` gana `quality: z.enum(PDF_QUALITIES).default(DEFAULT_PDF_QUALITY)` y se pasa a `service.generate`; en `GET /catalog/payload/:prepareId`, si `req.query.quality === 'optimized'` y la preparación tiene `variants` no vacías, devolver `withPhotoVariants(payload, entry.variants)` (cualquier otro valor se ignora; sin parámetro, igual que hoy); en `mediaRoutes` agregar `GET /pdf/:run/:file` que valide ambos segmentos con `SAFE_FILE` (`400 invalid_file`), resuelva con `ctx.photoOptimizer.fileFor(run, file)` y responda `404 not_found` si no existe, igual que `/media/cache` ([contracts/rest-api.md](./contracts/rest-api.md))
- [X] T021 [P] [US1] En `frontend/src/pages/Print.tsx` leer `quality` con `useSearchParams` de `react-router-dom` y pedir `/api/catalog/payload/${prepareId}?quality=optimized` solo cuando vale `'optimized'` (cualquier otro valor o ausente ⇒ la URL sin parámetro); sin tocar `CatalogDocument`, `whenAssetsReady` ni la guardia de fotos rotas
- [X] T022 [US1] En `frontend/src/pages/Generate.tsx` (depende de T004): estado `quality` inicial `DEFAULT_PDF_QUALITY`; un grupo `fieldset` con `legend` «Calidad del PDF» de dos radios (`name="quality"`) generados desde `PDF_QUALITY_OPTIONS` importado de `../../../backend/src/catalog/pdf-quality`, con la etiqueta, «Recomendada» en la sugerida y la `hint` **dentro de la misma etiqueta**, y el pie «Solo cambia esta generación.»; ubicado después de «Plantilla del catálogo» y antes de «Secciones a incluir», con el estilo del selector de plantilla ([contracts/generate-ui.md](./contracts/generate-ui.md) §1); deshabilitado mientras `working`; `generate()` envía `quality` en el cuerpo; cambiarlo no llama a ninguna ruta
- [X] T023 [US1] Ejecutar `npm test` (backend y frontend), `npm run typecheck -w backend` y `npm run lint`: T008–T013 pasan y las pruebas previas siguen en verde (`catalog-generate`, `generation-options`, `catalog-photos`, `pdf-render` con fotos de 1 × 1 px que el optimizador rechaza, etc.)

**Checkpoint**: US1 completa. Con la calidad por defecto el catálogo ya se genera con fotos reducidas y la opción es visible; el tamaño todavía no se muestra (US2).

---

## Phase 4: User Story 2 - Saber cuánto pesa cada catálogo (Priority: P2)

**Goal**: al terminar de generar se muestra el tamaño del PDF, el Historial gana la columna **Tamaño**, y si el PDF optimizado supera 25 MB se entrega igual con un aviso que lo explica.

**Independent Test**: generar en ambas calidades (con `FakeRenderer`) y comprobar que el trabajo y el historial informan el tamaño correcto; en la pantalla, un trabajo terminado de 19.320.118 bytes en Optimizada se lee «18,4 MB» sin aviso, y de 32.700.000 bytes avisa con «31,2 MB». Escenario 4 de [quickstart.md](./quickstart.md).

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Escribir `backend/tests/unit/history-size.test.ts` con `openDatabase(':memory:')` y un directorio temporal: `HistoryRepo.add(pdf, …)` devuelve `sizeBytes` igual a `pdf.length`; `list()` informa `sizeBytes` leído del archivo guardado; si se borra el archivo, `list()` no lanza y esa entrada **no** trae `sizeBytes`; una entrada con `params` sin `quality` (de catálogos anteriores) se lista igual; la calidad guardada en `params_json` se conserva al agregar
- [X] T025 [P] [US2] Escribir `backend/tests/unit/job.test.ts` para `JobManager`: `complete(id, catalogId, { sizeBytes, quality })` deja `current()` con `status: 'done'`, `catalogId`, `sizeBytes` y `quality`; `complete(id, catalogId)` sin extras sigue funcionando (sin esos campos); en `idle`, `preparing`, `rendering` y `failed` no aparecen `sizeBytes` ni `quality`; `complete` con un `id` distinto del activo no cambia el estado
- [X] T026 [US2] Ampliar `backend/tests/integration/catalog-quality.test.ts` (después de T011): al terminar, `GET /api/catalog/jobs/current` trae `sizeBytes` igual a la longitud real del PDF que devuelve `GET /api/catalog/history/:id/pdf` (con `FakeRenderer` son los bytes de `%PDF-1.4 fake`) y `quality` con la calidad pedida (también `original`); `GET /api/catalog/history` incluye `sizeBytes` en cada entrada; si se borra el archivo del PDF, esa entrada aparece **sin** `sizeBytes`; la fila de `generated_catalog` guarda `quality` en `params_json`; una generación fallida no deja `sizeBytes` en el trabajo
- [X] T027 [US2] Ampliar `frontend/tests/generate.test.tsx` (después de T012): con `GET /api/catalog/jobs/current` ⇒ `{ status: 'done', catalogId: 'c1', sizeBytes: 19320118, quality: 'optimized' }` se lee «Catálogo generado · 18,4 MB» con el enlace «Descargar PDF» y **no** hay aviso de tamaño; con `sizeBytes: 32700000` y `quality: 'optimized'` aparece el aviso «El PDF pesa 31,2 MB y supera los 25 MB que admite un correo habitual» con la sugerencia de generar con menos secciones; con los mismos bytes y `quality: 'original'` **no** hay aviso; con exactamente `PDF_TARGET_BYTES` y `quality: 'optimized'` no hay aviso; sin `sizeBytes` se ve el texto de antes («Catálogo generado.» y el enlace); durante el trabajo se muestra el paso «Optimizando fotos» cuando el servidor lo informa. La prueba existente del enlace de descarga (`{ status: 'done', catalogId: 'c1' }`) sigue pasando
- [X] T028 [P] [US2] Ampliar la prueba «Historial» de `frontend/tests/screens.test.tsx`: la tabla tiene la columna **Tamaño** entre «Páginas» e «Incluidos»; una entrada con `sizeBytes: 19320118` muestra «18,4 MB» y otra sin `sizeBytes` muestra «—» en esa columna; la prueba actual (páginas, enlaces de descarga y «—» de las páginas) sigue pasando

### Implementation for User Story 2

- [X] T029 [P] [US2] En `backend/src/pdf/job.ts` agregar `sizeBytes?: number` y `quality?: PdfQuality` (import de tipo desde `../catalog/pdf-quality`) a `JobState` y que `complete(id, catalogId, extra?: { sizeBytes?: number; quality?: PdfQuality })` los guarde solo en `done`
- [X] T030 [P] [US2] En `backend/src/pdf/history.repo.ts` agregar `sizeBytes?: number` a `HistoryEntry`: `add` lo devuelve con `pdf.length` y `list` lo lee con `fs.statSync(file).size` dentro de `try/catch` (si el archivo no existe o no se puede leer, el campo se **omite**); sin cambios de esquema ni de las demás claves de `params_json`
- [X] T031 [US2] En `backend/src/catalog/catalog.service.ts` (`render`, después de T019, T029 y T030): al guardar en el historial, llamar `jobs.complete(jobId, entry.id, { sizeBytes: pdf.length, quality })`. Si el PDF supera el objetivo **no** se aborta ni se cambia nada: solo se informa el tamaño (FR-012)
- [X] T032 [US2] En `frontend/src/pages/Generate.tsx` (después de T022 y T004): ampliar la interfaz `Job` con `sizeBytes?` y `quality?`; mostrar «Catálogo generado · {formatMegabytes(sizeBytes)}. Descargar PDF» cuando hay `sizeBytes` (sin él, el texto actual); y, **debajo** de esa alerta, una `Alert tone="warning"` con «El PDF pesa {X} y supera los 25 MB que admite un correo habitual. Para hacerlo más liviano, genera de nuevo con menos secciones.» solo si `quality === 'optimized'` y `exceedsTarget(sizeBytes)` (textos de [contracts/generate-ui.md](./contracts/generate-ui.md) §3)
- [X] T033 [P] [US2] En `frontend/src/pages/History.tsx` agregar `sizeBytes?: number` a `Entry` y la columna **Tamaño** entre «Páginas» e «Incluidos», con `formatMegabytes` o «—» si falta ([contracts/generate-ui.md](./contracts/generate-ui.md) §4)
- [X] T034 [US2] Ejecutar `npm test`, `npm run typecheck -w backend` y `npm run lint`: T024–T028 pasan y las pruebas previas siguen en verde

**Checkpoint**: US1 y US2 funcionan. La persona ve cuánto pesa cada catálogo sin abrir el archivo (SC-005) y se le avisa cuando un catálogo optimizado sigue siendo grande.

---

## Phase 5: User Story 3 - Conservar la calidad original y no romper nada (Priority: P3)

**Goal**: **Original** produce el catálogo de hoy y, en ambas calidades, el contenido y el diseño son los mismos: solo cambia el peso de las fotos. Esta historia es de verificación: no agrega código de producción salvo las correcciones que revelen sus pruebas.

**Independent Test**: generar el mismo catálogo en ambas calidades con las cuatro plantillas base, productos agotados con los tres estilos y fotos de varias proporciones, y comparar páginas, texto y resolución efectiva con Chrome real. Escenarios 3 y 7–8 de [quickstart.md](./quickstart.md).

### Tests for User Story 3 ⚠️

- [X] T035 [US3] Ampliar `backend/tests/integration/catalog-quality.test.ts` (después de T026): con `quality: 'original'` el trabajo termina, `renderer.calls[0].url` **no** contiene `quality`, `data/pdf-photos/` nunca se crea (o queda vacía) y el trabajo informa `quality: 'original'` (FR-009); `GET /api/catalog/payload/<id>?quality=optimized` tras una generación Original devuelve las direcciones originales; el payload que ve el navegador en ambas calidades es **idéntico salvo `imageUrl`** (FR-005: comparar con `toEqual` después de volver a poner las direcciones originales con el mapa inverso); y con fotos que el optimizador rechaza (`tiny.png`, `light.jpg`, `broken.jpg`), Optimizada produce **las mismas** direcciones que Original
- [X] T036 [P] [US3] Ampliar `backend/tests/fixtures/pdf-harness.ts`: `Harness.generate({ prepare, decision, measure, quality })` envía `quality` en el cuerpo de `POST /api/catalog/generate` cuando se indica, y `GenerationResult` gana `pdf: Buffer` (los bytes del PDF) y `sizeBytes: number` (su longitud); el resto del arnés no cambia
- [X] T037 [US3] En `backend/tests/integration/pdf-render.test.ts`, agregar un `describe('calidad del PDF')` con Chrome real y el arnés de T036 (usar `startHarness` con productos que referencian `/img/heavy.png`, `/img/heavy.jpg` y `/img/alpha.png` con `?item=N` distinto, y uno agotado): generar el **mismo** catálogo en `original` y en `optimized` y comprobar que el PDF optimizado pesa **menos de la quinta parte** del original (SC-001 en pequeño), que tienen el **mismo número de páginas** y que `pageTexts` es **idéntico** página por página (SC-003: productos, precios, AGOTADO, secciones y políticas; si algún texto dependiera de la hora, excluirlo en ambos); repetir para las **cuatro plantillas base** (`workspace()`), y para los **tres estilos de agotado** (`sello`, `cinta`, `gris`, guardando una copia de la plantilla con `save` y `copyOf`) comprobando en optimizada que la página del producto agotado contiene «AGOTADO» y que `window.__printBrokenImages` vale 0 (US3, escenarios 3 y 5)
- [X] T038 [US3] En el mismo `backend/tests/integration/pdf-render.test.ts` (después de T037), con un script `measure` que devuelva por cada `img.pb-img` su `naturalWidth`, `naturalHeight`, `getBoundingClientRect()` y el alfa del píxel (0,0) de la imagen dibujada en un `canvas` (mismo origen: no se contamina): para las fotos pesadas en **optimizada**, la resolución efectiva `96 / max(rect.width / naturalWidth, rect.height / naturalHeight)` es **≥ 149 ppp** (FR-004); la proporción natural de cada copia es igual a la de la foto original con un margen del 1 % (no se deforma ni se recorta antes de `object-fit: cover`, con fotos verticales, horizontales y cuadradas); el producto de `alpha.png` tiene el píxel (0,0) con **alfa 0** (FR-006: se ve igual que en Original, sin fondo negro ni blanco); en **original** `naturalWidth` coincide con el ancho de la foto original (control)
- [X] T039 [US3] Reconstruir el frontend con `npm run build -w frontend` (la suite de PDF reutiliza `frontend/dist` si ya existe, así que sin este paso correría con el código anterior de `Print.tsx`) y ejecutar `npm run test:pdf` y `npm test`: T035–T038 pasan; si algún fallo apunta a un módulo de producción, corregirlo ahí y repetir

**Checkpoint**: las tres historias funcionan. Original es el PDF de hoy y Optimizada solo cambia el peso de las fotos.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: simulador manual, documentación, seguridad y validación con la cuenta real.

- [X] T040 [P] Actualizar `backend/tests/fixtures/dev-mock.ts` (simulador manual): que por defecto sirva fotos sintéticas pesadas de `backend/tests/fixtures/photos.ts` (`heavy.png`, `heavy.jpg` y `alpha.png`, incluida una con transparencia) para que la diferencia entre calidades se vea sin `MOCK_IMG`; conservar `MOCK_IMG` y `MOCK_ALL_PHOTOS_FAIL`; actualizar el comentario de cabecera y, en [quickstart.md](./quickstart.md) («Arranque»), quitar la necesidad de `MOCK_IMG` para ver el efecto
- [X] T041 [P] Actualizar `README.md`: en la descripción de la generación, mencionar la opción **Calidad del PDF** (Optimizada por defecto, Original), el tamaño que se muestra al terminar y en el Historial, y el aviso cuando supera 25 MB; sin datos reales de la tienda
- [X] T042 [P] Revisión de seguridad (principio III): buscar con `Grep` en `backend/src/pdf/`, `backend/src/catalog/` y `backend/src/api/` que ningún `console.*`, mensaje de error ni respuesta incluya la dirección de una foto ni credenciales (en particular en `image-optimizer.ts`), que `/media/pdf` esté detrás de la sesión (la prueba de T011 lo cubre) y que las copias temporales nunca queden en disco; anotar el resultado en el mensaje de la tarea
- [X] T043 Ejecutar la verificación completa en la raíz: `npm test`, `npm run test:pdf`, `npm run typecheck -w backend`, `npm run lint` y `npm run build`; todo en verde
- [X] T044 Ejecutar los escenarios 2 a 4 de [quickstart.md](./quickstart.md) con el simulador (`npx tsx backend/tests/fixtures/dev-mock.ts` y la app con `ALEGRA_BASE_URL=http://127.0.0.1:3920`) en el navegador: la opción aparece con Optimizada marcada; cambiarla no dispara peticiones; generar en ambas calidades muestra el paso «Optimizando fotos» solo en Optimizada, un archivo mucho más liviano y el tamaño correcto en la alerta y en el Historial; `data/pdf-photos/` queda vacía
- [ ] T045 Ejecutar los escenarios 5 a 8 de [quickstart.md](./quickstart.md) con la **cuenta real** (manual, solo lectura, con la conexión que la app ya tiene guardada; **confirmar antes con el responsable** porque usa sus credenciales y descarga las fotos de su tienda a `data/image-cache/`, carpeta ignorada por git): generar con **Original** (≈ 156 MB, ±5 %) y con **Optimizada** sobre la misma preparación y Neón Noche; el PDF optimizado debe pesar **≤ 25 MB** (SC-001), preparar y generar en **< 2 min** (SC-004), los 10 catálogos del Historial ≤ 250 MB (SC-006), sin aviso de tamaño; revisar las **66 páginas** de ambos PDF y comparar Neón Noche con `docs/Cat.pdf` (0 fotos con pérdida visible, recortes con transparencia iguales); la persona responsable aprueba el catálogo para enviarlo (SC-002, SC-008). Anotar todos los números (se registran en `specs/005-optimize-pdf-size/validation.md`, T046). Si pesara más de 25 MB, aplicar la palanca de reserva de [research.md](./research.md) §3 o consultar antes de bajar de 150 ppp
- [ ] T046 Crear `specs/005-optimize-pdf-size/validation.md` con los resultados de T045 **sin datos privados** (sin nombres de productos, direcciones firmadas ni credenciales): tabla antes y después (tamaño en MB, tiempos de preparar y generar, páginas), resultado de cada criterio SC-001 a SC-008, la revisión visual y el estado de `data/pdf-photos/`; marcar como cumplidos los 8 escenarios del quickstart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias (T002 necesita red para instalar).
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias (T006 usa las fotos de T005; todo el frontend y el servicio usan T004).
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de US1 (necesita el flujo de `render` de T019 y la pantalla de T022).
- **US3 (Phase 5)**: depende de US1 (necesita las dos calidades funcionando); **independiente de US2**, salvo que comparten `catalog-quality.test.ts`.
- **Polish (Phase 6)**: depende de las historias deseadas; T045 y T046 al final.

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias.
- **US2 (P2)**: tras US1; reutiliza `catalog.service.ts` (T019 antes de T031), `Generate.tsx` (T022 antes de T032), `generate.test.tsx` (T012 antes de T027) y `catalog-quality.test.ts` (T011 antes de T026).
- **US3 (P3)**: tras US1; sus pruebas de Chrome real (T037, T038) no tocan los archivos de US2; solo `catalog-quality.test.ts` (T026 antes de T035) se comparte.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Módulos puros antes de quienes los usan (T004 → T019/T020/T022; T014 → T016; T015 → T019/T020).
- `PhotoOptimizer` (T016) antes del contexto (T018) y este antes del servicio (T019) y de las rutas (T020).
- `catalog.service.ts` lo tocan T019 (US1) y T031 (US2), en ese orden; `Generate.tsx` lo tocan T022 y T032.
- **T039 (reconstruir `frontend/dist`) antes de ejecutar `test:pdf`**.

### Parallel Opportunities

- Foundational: T003, T004 y T005 en paralelo; T006 después de T005.
- US1: T008–T013 en paralelo (archivos distintos); T014, T015, T017 y T021 en paralelo; T016 después de T002 y T014; T018 después de T016; T019 después de T014–T018; T020 después de T019; T022 después de T004.
- US2: T024, T025 y T028 en paralelo; T029, T030 y T033 en paralelo; T026 espera a T011 y T027 a T012.
- US3: T036 en paralelo con T035; T037 y T038 son el mismo archivo (en ese orden).
- Polish: T040, T041 y T042 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 juntas (archivos distintos):
Task: "Escribir backend/tests/unit/photo-target.test.ts"
Task: "Escribir backend/tests/unit/photo-variants.test.ts"
Task: "Escribir backend/tests/unit/image-optimizer.test.ts"
Task: "Escribir backend/tests/integration/catalog-quality.test.ts"
Task: "Ampliar frontend/tests/generate.test.tsx"
Task: "Escribir frontend/tests/print-quality.test.tsx"

# Módulos independientes de US1:
Task: "Crear backend/src/pdf/photo-target.ts"
Task: "Crear backend/src/pdf/photo-variants.ts"
Task: "Actualizar backend/src/catalog/prepare-store.ts"
Task: "Actualizar frontend/src/pages/Print.tsx"
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Setup (T001–T002) y Foundational (T003–T007).
2. US1 (T008–T023): las pruebas fallan, se implementa, pasan.
3. **PARAR y validar**: con el simulador (T044) la opción aparece, Optimizada produce un archivo mucho más liviano que Original y no quedan copias en disco. Con esto solo ya se corrige el problema reportado: el PDF real deja de pesar 156 MB (se mide en T045).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → probar → **MVP** (PDF liviano con la opción visible).
3. US2 → probar → se ve cuánto pesa cada catálogo y se avisa cuando sigue siendo grande.
4. US3 → probar → Original es idéntico a hoy y Optimizada no cambia contenido ni diseño (Chrome real).
5. Polish → documentación, seguridad y validación con la cuenta real (T045–T046).

### Notas

- [P] = archivos distintos, sin dependencias pendientes.
- **Decisiones ya tomadas** (no reabrir sin consultar): 150 ppp calculados desde la plantilla; JPEG calidad 88 con 4:4:4; transparencia real conservada como PNG (no se aplana); copias temporales por generación, sin caché persistente; `sharp` es la única dependencia nueva y se importa de forma estática; la calidad no es una opción de la preparación ni se guarda como ajuste.
- La calidad **Original** no pasa por el optimizador: si una tarea parece pedirlo, es un error.
- Un fallo de una foto no detiene la generación (se usa tal cual); un fallo de render o de una foto que no carga sigue abortando sin PDF parcial (guardia de 004).
- Pasar el tamaño objetivo **no** aborta: solo avisa (FR-012).
- El caché de fotos que nunca se limpia (research §12) está **fuera de alcance**.
- Ningún dato real de la tienda (nombres de productos, direcciones firmadas, token, fotos) va en commits ni en la documentación; `data/` está en `.gitignore`.
- Confirma que cada prueba falla antes de implementar y que `npm test` queda en verde al cerrar cada historia.
