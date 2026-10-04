# Tasks: Fotos de productos de Alegra en el catálogo

**Input**: Documentos de diseño en `/specs/004-fix-alegra-images/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/alegra-item-photos.md](./contracts/alegra-item-photos.md), [contracts/review-report.md](./contracts/review-report.md), [quickstart.md](./quickstart.md). Requiere las features 001–003 funcionando (`npm test` en verde antes de empezar) y la constitución en v1.1.0 (no hace falta enmendarla).

**Tests**: Incluidos. La constitución (principio V) y FR-016 exigen pruebas para las reglas de este documento, con respuestas simuladas de Alegra que imiten la forma real verificada. Escribe cada prueba **antes** de su implementación y comprueba que falla. Nunca se prueba contra la cuenta real de forma automática.

**Organization**: Tareas agrupadas por historia de usuario. **US1 es el MVP**: por sí sola devuelve las fotos al catálogo. US2 y US3 dependen de US1 (necesitan que las fotos se descarguen) pero son independientes entre sí.

**Sin repositorio git**: el proyecto no es un repositorio. Los cambios son acotados, pero considera `git init` (el `.gitignore` ya protege `data/`, `.env` y credenciales) o copiar el árbol antes de empezar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US3)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)). Los módulos nuevos de lógica (`image-sniff.ts`, `photo-reasons.ts`, `broken-images.ts`) son **puros**: sin red ni acceso al disco, para probarlos sin simuladores.

---

## Phase 1: Setup

**Purpose**: punto de partida verificado, para distinguir fallos previos de regresiones propias.

- [X] T001 Ejecutar `npm test`, `npm run typecheck -w backend` y `npm run lint` en la raíz y anotar en el mensaje de la tarea cualquier fallo previo a esta feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tipos compartidos y el simulador de Alegra con la forma y los fallos reales. Todo es aditivo: nada cambia de comportamiento hasta US1. **Ninguna historia empieza antes de completar esta fase.**

- [X] T002 [P] En `backend/src/alegra/alegra.types.ts` agregar `AlegraImageRaw` (`id?: AlegraId`, `name?: string`, `url?: string`, `link?: string`, `src?: string`, `favorite?: boolean`) y cambiar `AlegraItemRaw.images` a `Array<string | AlegraImageRaw> | null`; actualizar el comentario de cabecera: la forma de las fotos está verificada el 4-oct-2026 (ver [contracts/alegra-item-photos.md](./contracts/alegra-item-photos.md))
- [X] T003 [P] En `backend/src/catalog/types.ts` agregar y exportar `PhotoFailureReason = 'unauthorized' | 'not_found' | 'timeout' | 'not_image' | 'unsupported_format' | 'too_large' | 'unavailable'` (solo el tipo; el informe `photos` se agrega en US2)
- [X] T004 Ampliar el simulador `backend/tests/fixtures/alegra-mock.ts` según [contracts/alegra-item-photos.md](./contracts/alegra-item-photos.md) (depende de T002): exportar `PNG_1X1` y `JPEG_1X1` (un JPEG mínimo cuyos bytes empiecen por `FF D8 FF`; si una prueba de render lo usa, que sea un JPEG 1×1 válido); rutas sin autenticación `/img/generic.png` y `/img/generic.jpg` (200, `Content-Type: binary/octet-stream`, bytes reales), `/img/forbidden` (403), `/img/missing` (404), `/img/html` (200 `text/html`), `/img/svg` (200 `image/svg+xml`), `/img/error` (500), `/img/slow` (responde tras ~1,5 s) y `/img/big` (200 con un cuerpo de 2 KB, para probar con un tope bajo); conservar `/img/ok.png` y que cualquier otra `/img/*` siga dando 404; agregar `search` (la consulta, p. ej. `status=active&mode=advanced&…`) a cada elemento de `AlegraMock.requests`

**Checkpoint**: `npm test -w backend` sigue en verde con el simulador ampliado (no se tocó ningún comportamiento).

---

## Phase 3: User Story 1 - Ver en el catálogo la foto de cada producto de Alegra (Priority: P1) 🎯 MVP

**Goal**: cada producto de Alegra con foto aparece en el PDF con su foto: la favorita, o la primera si no hay marca; reconocida por sus bytes aunque el servidor declare un tipo genérico; con las demás fotos como respaldo.

**Independent Test**: con el simulador (fotos `{ id, name, url, favorite }` servidas como `binary/octet-stream`), preparar un catálogo con un producto de una foto, otro con dos fotos donde la favorita es la segunda, otro con la primera foto prohibida y la segunda válida, y otro sin foto; los tres primeros quedan incluidos con la foto esperada y el último omitido. Corresponde a los escenarios 1–3 de [quickstart.md](./quickstart.md).

### Tests for User Story 1 ⚠️

> **NOTE: escribe estas pruebas primero y comprueba que FALLAN antes de implementar.**

- [X] T005 [P] [US1] Escribir `backend/tests/unit/image-sniff.test.ts`: `sniffImage` reconoce JPEG (`FF D8 FF`), PNG (8 bytes de firma), GIF (`GIF87a` y `GIF89a`) y WebP (`RIFF`…`WEBP`) y devuelve `.jpg`/`.png`/`.gif`/`.webp`; devuelve `null` para HTML (`<!doctype html>`), SVG/XML, un buffer vacío, uno de 1 a 3 bytes y bytes aleatorios; un `RIFF` que no es WebP devuelve `null`
- [X] T006 [P] [US1] Escribir `backend/tests/unit/photo-selection.test.ts` para `extractImageUrls` y `extractImageUrl`: la favorita va primero aunque sea la segunda o tercera (caso real: 4 de 4 productos con varias fotos); varias favoritas conservan su orden relativo; sin ninguna favorita se respeta el orden original; las no favoritas quedan después como candidatas; se descartan enlaces vacíos, `data:`, relativos y no `http(s)`; sin duplicados; se toleran las formas previas (texto suelto, `{ url }`, `{ link }`, `{ src }`); `images` ausente, `null` o `[]` ⇒ `[]` y `extractImageUrl` ⇒ `null`; `mapAlegraItem` fija `remoteImageUrl = imageUrls[0]` y `imageUrls` con todas
- [X] T007 [P] [US1] Escribir `backend/tests/unit/image-cache.test.ts` con el simulador de T004 y un directorio temporal: `/img/generic.png` y `/img/generic.jpg` se aceptan (aunque lleguen como `binary/octet-stream`) y se guardan con la extensión real; `/img/ok.png` sigue funcionando; motivos: `/img/forbidden` ⇒ `unauthorized`, `/img/missing` ⇒ `not_found`, `/img/html` ⇒ `not_image`, `/img/svg` ⇒ `unsupported_format`, `/img/error` ⇒ `unavailable`, `/img/slow` con `timeoutMs` bajo (p. ej. 200) ⇒ `timeout`, `/img/big` con `maxBytes` = 1024 ⇒ `too_large` (comprobando también el rechazo por `content-length` antes de leer el cuerpo), servidor caído ⇒ `unavailable`; ningún fallo deja archivos en el directorio; `fetchFirst([])` ⇒ `{ status: 'none' }`; `fetchFirst([prohibida, válida])` ⇒ `ok` con la segunda; `fetchFirst([prohibida, inexistente])` ⇒ `failed` con el motivo de la **primera** (`unauthorized`); `downloadAll` devuelve un `PhotoOutcome` por producto, respeta el tope de concurrencia y llama a `onProgress` hasta `total`; una segunda descarga de la misma URL dentro de la hora reutiliza el archivo
- [X] T008 [P] [US1] Ampliar `backend/tests/unit/alegra-client.test.ts`: `listActiveItems` envía `status=active` y `mode=advanced` en cada página (usar `search` de `mock.requests`); el test "solo hace peticiones GET" sigue pasando
- [X] T009 [P] [US1] Escribir `backend/tests/integration/catalog-photos.test.ts` (copiar el `setup` y `waitFor` de `catalog-generate.test.ts`) con ítems de forma real `images: [{ id, name, url, favorite }]` servidos con tipo genérico: (a) un producto con una foto ⇒ entra al catálogo; (b) un producto con `[generic.png (favorite:false), generic.jpg (favorite:true)]` ⇒ el `imageUrl` del payload (`GET /api/catalog/payload/:prepareId`) termina en `.jpg` y `GET` de ese `imageUrl` con el agente devuelve 200 con bytes que empiezan por `FF D8 FF`; (c) la favorita prohibida y la otra válida ⇒ usa la válida; (d) `images: []` ⇒ queda en `report.omittedNoImage`; (e) `report.counts.included` coincide con los productos con foto utilizable; (f) todas las peticiones al simulador distintas de `/img/*` son `GET` y las de `/items` incluyen `mode=advanced`

### Implementation for User Story 1

- [X] T010 [P] [US1] Crear el módulo puro `backend/src/pdf/image-sniff.ts` con `sniffImage(bytes: Uint8Array): '.jpg' | '.png' | '.webp' | '.gif' | null` (firmas de [research.md](./research.md) §1; sin importar nada de Node)
- [X] T011 [P] [US1] En `backend/src/alegra/alegra.mapper.ts` agregar `extractImageUrls(raw): string[]` (favoritas primero, luego el resto en orden; solo `http`/`https`; sin duplicados; tolera texto suelto, `url`, `link` y `src`), hacer que `extractImageUrl` devuelva la primera o `null`, agregar `imageUrls?: string[]` a `NormalizedItem` y poblarlo en `mapAlegraItem` junto con `remoteImageUrl` (depende de T002)
- [X] T012 [P] [US1] En `backend/src/alegra/alegra.client.ts` hacer que `listActiveItems` pida `{ status: 'active', mode: 'advanced' }` (comentar por qué: el valor por defecto de `mode` no está documentado; verificado que `advanced` equivale a la respuesta actual)
- [X] T013 [US1] Reescribir `backend/src/pdf/image-cache.ts` (depende de T003 y T010): `download(url)` devuelve `DownloadResult` (`{ ok: true, url }` o `{ ok: false, reason }`); acepta la foto si `sniffImage` la reconoce y fija la extensión con ese resultado (el `Content-Type` declarado solo decide entre `unsupported_format` si empieza por `image/` y `not_image` en los demás casos); mapeo de motivos según [data-model.md](./data-model.md) (401/403 ⇒ `unauthorized`, 404/410 ⇒ `not_found`, tiempo agotado ⇒ `timeout`, cuerpo vacío o no imagen ⇒ `not_image`, `content-length` o cuerpo > `maxBytes` ⇒ `too_large` comprobando la cabecera antes de leer el cuerpo, otro HTTP o error de red ⇒ `unavailable`); constructor `(dir, fetchImpl = fetch, timeoutMs = 10_000, maxBytes = 10 MB)`; el acierto en caché busca las 4 extensiones y se conserva la vigencia de 1 hora; nunca deja archivos a medias; agregar `fetchFirst(urls)` ⇒ `PhotoOutcome` (`none` si no hay URLs; `ok` con la primera que sirva; `failed` con el motivo de la primera candidata) y cambiar `downloadAll(candidates: Map<id, string[]>, concurrency = 6, onProgress)` para devolver `Map<id, PhotoOutcome>`; exportar `DownloadResult` y `PhotoOutcome`; el módulo no debe registrar ni devolver nunca la URL de origen
- [X] T014 [US1] En `backend/src/catalog/catalog.service.ts` (`prepare`, depende de T011 y T013): construir `candidates` desde `item.imageUrls ?? (item.remoteImageUrl ? [item.remoteImageUrl] : [])`, llamar a `imageCache.downloadAll(candidates, 6, …)` conservando el avance de progreso 20→90 %, y derivar `localImages` (`ok` ⇒ URL local; `none` y `failed` ⇒ `null`); los motivos de fallo se guardan aparte para US2 (por ahora basta con `localImages`)
- [X] T015 [US1] Ejecutar `npm test -w backend` (menos `test:pdf`) y `npm run typecheck -w backend`: T005–T009 pasan y las pruebas previas siguen en verde (`catalog-generate`, `custom-sections`, `catalog-builder`, `stock-rules`, etc., que usan `/img/ok.png` y `/img/falla.png`)

**Checkpoint**: US1 completa. Con la cuenta real, los productos con foto ya llegan al catálogo (se comprueba a mano en T040).

---

## Phase 4: User Story 2 - Entender por qué falta la foto de un producto (Priority: P2)

**Goal**: el informe de revisión separa "sin foto en Alegra" de "foto no obtenida" (con motivo en lenguaje claro) y avisa de forma destacada cuando ninguna foto informada se pudo obtener.

**Independent Test**: preparar un catálogo con productos sin foto y con fotos prohibidas, inexistentes, HTML y SVG, y comprobar que el informe y la pantalla Generar los separan y rotulan; con todas las fotos prohibidas, aparece el aviso general. Escenarios 2 y 4 de [quickstart.md](./quickstart.md).

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] Ampliar `backend/tests/unit/catalog-builder.test.ts` (con sus ayudantes actuales) para `report.photos`: `informed`/`obtained` cuentan productos con URLs informadas y con copia local; `notObtained` lleva `{ id, name, reason }` solo de productos con foto informada y sin copia, y solo de las secciones seleccionadas (`sectionKeys`); un producto sin URLs **no** entra en `notObtained`; `allFailed` es `true` solo con `informed > 0` y `obtained === 0` y no depende de las secciones seleccionadas; los padres de variantes (`variantParent`) no cuentan; un producto con foto no obtenida **sigue** en `omittedNoImage` y `counts.omitted` no cambia; sin `photoFailures` en la entrada (como hace el panel de Inicio, que pasa las URLs remotas como si fueran locales) `notObtained` es `[]` y `allFailed` es `false`
- [X] T017 [P] [US2] Escribir `backend/tests/unit/photo-reasons.test.ts`: cada `PhotoFailureReason` tiene texto en español, no vacío, sin códigos HTTP ni jerga (`403`, `404`, `HTTP`, `binary`, `content-type`) y distinto de los demás; los textos coinciden con la tabla de [data-model.md](./data-model.md)
- [X] T018 [P] [US2] En `frontend/tests/generate.test.tsx` agregar `photos` al `report` base (`{ informed: 0, obtained: 0, notObtained: [], allFailed: false }`) y probar: con `notObtained` de dos productos con motivos distintos se muestra el aviso "N producto(s) con foto en Alegra que no se pudo obtener" con `Nombre — motivo` y esos productos **no** se repiten en el aviso "omitidos por no tener imagen"; con `allFailed` aparece el aviso de error "No se pudo obtener ninguna foto de Alegra" con el texto del problema general; sin `notObtained` ni `allFailed` no aparecen esos avisos y el aviso existente de omitidos se ve como antes
- [X] T019 [P] [US2] En `frontend/tests/parity.test.tsx` agregar `photos` al informe de ejemplo (línea del objeto con `omittedNoImage: []`) con el valor neutro de T018
- [X] T020 [US2] Ampliar `backend/tests/integration/catalog-photos.test.ts` (después de T009): con ítems cuyas fotos son `/img/forbidden`, `/img/missing`, `/img/html`, `/img/svg` y `/img/error`, `report.photos.notObtained` trae los motivos `unauthorized`, `not_found`, `not_image`, `unsupported_format` y `unavailable`; el producto con `images: []` no está en `notObtained` pero sí en `omittedNoImage`; con todas las fotos prohibidas `report.photos.allFailed === true`; `PUT /api/catalog/prepare/:prepareId/options` conserva `photos`; **el cuerpo JSON de las respuestas de prepare y options no contiene `Signature=`, `Expires=` ni la URL base del simulador** (principio III)

### Implementation for User Story 2

- [X] T021 [US2] En `backend/src/catalog/types.ts` agregar `PhotoNotObtained` (`{ id: string; name: string; reason: PhotoFailureReason }`), `PhotoReport` (`informed`, `obtained`, `notObtained`, `allFailed`) y el campo `photos: PhotoReport` en `ReviewReport` (según [contracts/review-report.md](./contracts/review-report.md))
- [X] T022 [P] [US2] Crear `backend/src/catalog/photo-reasons.ts` (puro; lo importa el frontend) con `PHOTO_REASON_LABEL: Record<PhotoFailureReason, string>` con los textos de [data-model.md](./data-model.md)
- [X] T023 [US2] En `backend/src/catalog/catalog-builder.ts` (depende de T021): agregar a `BuilderInput` `photoFailures?: Map<string, PhotoFailureReason>`; cuando un producto de Alegra no tiene copia local y `photoFailures` trae su motivo, además de `omittedNoImage` agregarlo a una lista `photoNotObtained` etiquetada con su sección (igual que `omittedNoImage`, para filtrar por `sectionKeys`); calcular `report.photos` (`informed` = productos activos no `variantParent` con alguna URL informada; `obtained` = los que tienen copia local; `allFailed = informed > 0 && obtained === 0`, sobre todos los productos y no solo las secciones seleccionadas); no tocar `omittedNoImage`, `counts` ni el resto del informe
- [X] T024 [US2] En `backend/src/catalog/catalog.service.ts` (`prepare`, después de T014 y T023): derivar `photoFailures` desde los `PhotoOutcome` (`failed` ⇒ su `reason`) y pasarlo a `buildCatalog` junto a `localImages`, de modo que `setOptions` y `generate` (que reutilizan el cierre `build`) conserven los motivos sin consultar Alegra de nuevo
- [X] T025 [US2] En `frontend/src/pages/Generate.tsx` (depende de T021 y T022): importar `PHOTO_REASON_LABEL` desde `../../../backend/src/catalog/photo-reasons` (como ya se importan los tipos de backend), mostrar `Alert tone="error"` "No se pudo obtener ninguna foto de Alegra" si `report.photos.allFailed` (texto: probable problema general de conexión o de enlaces; vuelve a preparar y, si sigue, revisa la conexión con Alegra), un `Alert tone="warning"` "N producto(s) con foto en Alegra que no se pudo obtener" con `Nombre — motivo` (hasta 30) si hay `notObtained`, y dejar el aviso existente "omitidos por no tener imagen" sin los productos de `notObtained`; no mostrar direcciones ni códigos
- [X] T026 [US2] Ejecutar `npm test` (backend y frontend), `npm run typecheck -w backend` y `npm run lint`: T016–T020 pasan, `omittedNoImage` y `counts` no cambiaron en ninguna prueba previa

**Checkpoint**: US1 y US2 funcionan. El responsable ve cuántos productos no muestran foto y por qué (SC-002, SC-003).

---

## Phase 5: User Story 3 - Los agotados conservan su foto y todas las fotos se ven bien (Priority: P3)

**Goal**: ninguna foto rota llega al PDF: si una foto de producto no carga al renderizar, la generación aborta con un mensaje claro; con fotos reales (JPG y PNG, tipo genérico) el PDF se genera y los agotados conservan foto + AGOTADO.

**Independent Test**: preparar con el simulador, borrar un archivo de `data/image-cache/` y generar: falla con mensaje claro y sin PDF nuevo en el historial; con todas las fotos intactas se genera el PDF. Escenario 8 de [quickstart.md](./quickstart.md). La revisión visual de recortes y AGOTADO con fotos reales se hace en T040.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] Escribir `frontend/tests/broken-images.test.ts` para `countBrokenProductImages(root)`: cuenta solo `img.pb-img` con `complete === true` y `naturalWidth === 0` (simular con `Object.defineProperty`); no cuenta las que cargaron, las que aún no terminaron (`complete === false`) ni imágenes sin la clase `pb-img` (p. ej. el sello o imágenes de plantilla); sin imágenes ⇒ 0
- [X] T028 [US3] En `backend/tests/integration/pdf-render.test.ts` cambiar las fotos del fixture de `${mock.url}/img/ok.png` a la forma real de Alegra (`[{ id, name, url: `${mock.url}/img/generic.png`, favorite: true }]`), de modo que el PDF real se genere con fotos servidas como `binary/octet-stream`; el resto de las aserciones no cambia
- [X] T029 [US3] En `backend/tests/integration/pdf-render.test.ts` guardar `ctx` y `agent` a nivel de módulo y agregar la prueba "aborta si una foto de producto no carga al renderizar": preparar, borrar un archivo de `path.join(ctx.config.dataDir, 'image-cache')`, generar y esperar el fin del trabajo; el trabajo termina en fallo (`status` distinto de `done`) con un `error` que coincide con `/No se pudo cargar la foto de 1 producto/` y `GET /api/catalog/history` no gana ninguna entrada

### Implementation for User Story 3

- [X] T030 [P] [US3] Crear el módulo puro `frontend/src/print/broken-images.ts` con `countBrokenProductImages(root: ParentNode = document): number` (selector `img.pb-img`; `complete && naturalWidth === 0`)
- [X] T031 [US3] En `frontend/src/pages/Print.tsx` (depende de T030): declarar `window.__printBrokenImages?: number` en el `declare global` y, dentro de `whenAssetsReady`, después de esperar las imágenes pendientes, calcular `countBrokenProductImages()` y fijarlo en `window.__printBrokenImages` **antes** de que el efecto ponga `window.__printReady = true`
- [X] T032 [US3] En `backend/src/pdf/pdf.service.ts` (`PuppeteerRenderer.render`): tras `waitForFunction('window.__printReady === true')` leer `window.__printBrokenImages` (`?? 0`) y, si es mayor que 0, lanzar `Error` con `No se pudo cargar la foto de ${n} producto(s); no se generó el PDF.`; el `finally` ya cierra la página; sin tocar `networkidle0` ni el resto
- [X] T033 [US3] Reconstruir el frontend con `npm run build -w frontend` (la suite de PDF reutiliza `frontend/dist` si ya existe y solo lo construye cuando falta, así que sin este paso correría con el código anterior de `Print.tsx`)
- [X] T034 [US3] Ejecutar `npm run test:pdf` y `npm test -w frontend`: T027–T029 pasan y el PDF real se genera con fotos de tipo genérico

**Checkpoint**: las tres historias funcionan. Ningún recuadro roto llega al PDF y una copia local dañada aborta en vez de imprimirse.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: simulador manual, documentación, seguridad y validación con la cuenta real.

- [X] T035 [P] Actualizar `backend/tests/fixtures/dev-mock.ts` (simulador manual): servir sus fotos como Alegra (`images: [{ id, name, url, favorite }]` con `/img/generic.png`), incluir un producto con dos fotos donde la favorita es la segunda, uno con foto prohibida (`/img/forbidden`) y el existente sin foto, y una variable de entorno (p. ej. `MOCK_ALL_PHOTOS_FAIL=1`) que haga que todas las fotos sean `/img/forbidden`; actualizar el comentario de cabecera con ese uso
- [X] T036 [P] Actualizar `docs/Alegra integracion.md` (FR-013): en §5.2 y §5.3 reemplazar los "(verificar)" de `images` por la estructura real verificada el 4-oct-2026 (`images[]` con `id`, `name`, `url` firmada, `favorite`; sin `isPrimary` ni `attachments`; presentes en la consulta general con o sin `mode=advanced`; descarga con `binary/octet-stream`; enlaces de ~7 días; `GET /items/{id}/attachment` devuelve el ítem; `POST`/`DELETE` no se usan), retirar "se usa `public/assets/placeholder.png`" y la pregunta 5 de §10.3 (decidido: se omite e informa), con ejemplos de datos ficticios
- [X] T037 [P] Revisión de seguridad (principio III): buscar con `Grep` en `backend/src/pdf/`, `backend/src/catalog/` y `backend/src/alegra/` que ningún `console.*`, mensaje de error ni respuesta incluya la URL de una foto ni el token, y que `ImageCache` pida las fotos **sin** cabecera `Authorization`; anotar el resultado en el mensaje de la tarea
- [X] T038 Ejecutar la verificación completa en la raíz: `npm test`, `npm run test:pdf`, `npm run typecheck -w backend`, `npm run lint` y `npm run build`; todo en verde
- [X] T039 Ejecutar los escenarios 1 a 4 de [quickstart.md](./quickstart.md) con el simulador (`npx tsx backend/tests/fixtures/dev-mock.ts` y la app con `ALEGRA_BASE_URL=http://127.0.0.1:3920`), en el navegador: los productos con foto aparecen incluidos, la favorita es la que se ve, los avisos se separan y con `MOCK_ALL_PHOTOS_FAIL=1` aparece el aviso general
- [X] T040 Ejecutar los escenarios 5 a 8 de [quickstart.md](./quickstart.md) con la **cuenta real** (manual, solo lectura, con la conexión que la app ya tiene guardada; **confirmar antes con el responsable** porque usa sus credenciales y descarga las fotos de su tienda a `data/image-cache/`, carpeta ignorada por git): `photos.obtained` ≥ 95 % de `informed` (SC-001), informe legible en menos de 1 minuto (SC-003), PDF en < 2 min (SC-006), revisión visual de **todas** las páginas con Neón Noche (0 recuadros vacíos, rotos o deformados; agotados con foto y AGOTADO; favorita visible en los 4 productos con varias fotos) y prueba de la foto borrada
- [X] T041 Crear `specs/004-fix-alegra-images/validation.md` con los resultados de T040 **sin datos privados** (sin nombres de productos, direcciones firmadas ni token): conteos de `informed`/`obtained`/`notObtained`, tamaño del PDF en MB, tiempo de generación, resultado de la revisión visual y de la foto borrada; si el PDF pesa decenas de MB que impidan enviarlo, anotar el riesgo de [research.md](./research.md) §9 y proponer una feature aparte (no bloquea esta)

---

## Phase 7: User Story 4 - Cada tarjeta muestra el nombre y la descripción del producto (Priority: P2)

**Origen**: el responsable lo pidió durante la implementación, al revisar el catálogo real: "valida que debe quedar en el diseño el nombre y la descripción del producto". La validación con la cuenta real encontró que 2 de los 181 productos de Alegra tienen descripción y su tarjeta mostraba **solo** una nota sobre el valor de envío, sin nombre; eso incumple FR-010 de `001`. Se escribió la prueba, se corrigió la tarjeta y se volvió a validar.

**Goal**: todo producto muestra su nombre y, si la tiene, su descripción debajo (FR-017).

**Independent Test**: dibujar una página con un producto de Alegra con descripción y otro sin ella; ambos muestran el nombre y solo el primero la descripción.

- [X] T042 [US4] Escribir en `frontend/tests/template-page.test.tsx` las pruebas de la tarjeta: un producto de Alegra con descripción muestra `.pb-name` y `.pb-desc` con el nombre antes que la descripción; sin descripción muestra el nombre y ninguna descripción vacía; un producto propio sigue mostrando ambos; la prueba de tres productos exige nombre y descripción. Comprobado que fallan antes del cambio
- [X] T043 [US4] En `frontend/src/print/blocks/ProductsBlock.tsx` mostrar `<div className="pb-name">{item.name}</div>` para **todos** los tipos y la descripción debajo si existe; eliminar la rama que ocultaba el nombre de los productos de Alegra con descripción y su comentario
- [X] T044 [US4] Reconstruir `frontend/dist` (`npm run build -w frontend`) y ejecutar `npm test -w frontend` (479 pruebas) y `npm run test -w backend` (47 archivos / 600 pruebas, incluidas las de desbordamiento con navegador real): todo en verde
- [X] T045 [US4] Validar con la cuenta real las 182 tarjetas: 179 solo nombre (sin descripción en Alegra), **3 con nombre y descripción** (2 de Alegra y 1 propio), 0 solo descripción, 0 sin texto, 0 textos distintos del dato, 0 burbujas desbordadas, 0 descripciones cortadas; captura de la página de una tarjeta con nombre y descripción
- [X] T046 [US4] Registrar el cambio en [spec.md](./spec.md) (Historia 4, FR-017, SC-008, aclaración y fila de "Punto de partida") y en [plan.md](./plan.md) (estructura de código)

**Checkpoint**: las cuatro historias funcionan. **T041 (validation.md) se escribe después de T046**, con los resultados de todas.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias (T004 usa los tipos de T002).
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de US1 (necesita los `PhotoOutcome` con motivo de T013 y el flujo de T014).
- **US3 (Phase 5)**: depende de US1 (el PDF real necesita fotos aceptadas); **independiente de US2**.
- **Polish (Phase 6)**: depende de las historias deseadas; T040 y T041 al final.

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias.
- **US2 (P2)**: tras US1; reutiliza `catalog.service.ts` (T014 antes de T024) y el archivo `catalog-photos.test.ts` (T009 antes de T020).
- **US3 (P3)**: tras US1; puede avanzar en paralelo con US2 (archivos distintos: `Print.tsx`, `pdf.service.ts`, `pdf-render.test.ts`).

### Within Each User Story

- Las pruebas se escriben primero y deben fallar.
- Módulos puros antes de quienes los usan (T010 → T013; T022 → T025; T030 → T031).
- Tipos antes que constructor y servicio (T021 → T023 → T024).
- `catalog.service.ts` lo tocan T014 (US1) y T024 (US2): en ese orden.
- **T033 (reconstruir `frontend/dist`) antes de T034**.

### Parallel Opportunities

- Foundational: T002 y T003 en paralelo; T004 después de T002.
- US1: T005–T009 en paralelo (archivos distintos); T010, T011 y T012 en paralelo; T013 después de T010 y T003; T014 después de T011 y T013.
- US2: T016–T019 en paralelo; T021 y T022 en paralelo; T020 espera a T009.
- US3: T027 y T030 en paralelo; T028 y T029 son el mismo archivo (en ese orden).
- Polish: T035, T036 y T037 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 juntas (archivos distintos):
Task: "Escribir backend/tests/unit/image-sniff.test.ts"
Task: "Escribir backend/tests/unit/photo-selection.test.ts"
Task: "Escribir backend/tests/unit/image-cache.test.ts"
Task: "Ampliar backend/tests/unit/alegra-client.test.ts"
Task: "Escribir backend/tests/integration/catalog-photos.test.ts"

# Implementación independiente de US1:
Task: "Crear backend/src/pdf/image-sniff.ts"
Task: "Actualizar backend/src/alegra/alegra.mapper.ts"
Task: "Actualizar backend/src/alegra/alegra.client.ts"
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Setup (T001) y Foundational (T002–T004).
2. US1 (T005–T015): las pruebas fallan, se implementa, pasan.
3. **PARAR y validar**: con el simulador (T039, escenarios 2–3) los productos con foto ya aparecen y se ve la favorita. Con esto solo ya se corrige el problema reportado: los 181 productos con foto de la cuenta dejan de salir "omitidos por no tener imagen".

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → probar → **MVP** (las fotos vuelven al catálogo).
3. US2 → probar → el informe explica cada foto que falta (evita volver a quedar a ciegas).
4. US3 → probar → ninguna foto rota llega al PDF y se verifica con fotos reales.
5. Polish → documentación, seguridad y validación con la cuenta real (T040–T041).

### Notas

- [P] = archivos distintos, sin dependencias pendientes.
- La opción A está decidida: **no** se crea imagen de respaldo ni se consulta el detalle de cada producto; si una tarea parece pedirlo, es un error.
- Un fallo de una foto no detiene la preparación; un fallo de Alegra o de render sigue abortando sin PDF parcial.
- Ningún dato real de la tienda (nombres de productos, direcciones firmadas, token) va en commits ni en la documentación; `data/` está en `.gitignore`.
- Confirma que cada prueba falla antes de implementar y que `npm test` queda en verde al cerrar cada historia.
