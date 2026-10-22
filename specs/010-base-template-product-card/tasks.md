# Tasks: Plantilla «Base AsianPop» y foto-tarjeta generada

**Input**: documentos de diseño en `specs/010-base-template-product-card/`
**Requisitos previos**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Pruebas**: se incluyen. La constitución (principio V) exige pruebas sobre las reglas de negocio, y el plan las enumera (quickstart §8). Las pruebas de cada historia se escriben **antes** del código y deben fallar primero.

**Formato**: `- [ ] T### [P] [US#] Descripción con ruta`. `[P]` = se puede hacer en paralelo (archivos distintos, sin depender de una tarea sin terminar).

**Regla transversal**: ningún cambio puede alterar el PDF de las 4 plantillas existentes (FR-022, SC-004). Cada campo nuevo es opcional y su ausencia equivale al comportamiento de hoy.

## Phase 1: Setup (línea base y fotos de prueba)

- [X] T001 Correr `npm test` en `backend/` y `frontend/` y `npm run test:pdf` y anotar en `specs/010-base-template-product-card/quickstart.md` (sección «Estado inicial») qué pruebas ya fallan antes de empezar (hay archivos con conflictos de fusión sin resolver: `frontend/tests/template-editor-inspector.test.tsx`, `frontend/tests/template-editor-reducer.test.ts`) — _hecho: base verde salvo las 2 pruebas del frontend con conflicto de fusión (`MERGE_HEAD` de la persona usuaria, no resueltas); ver «Estado inicial» en quickstart.md_
- [X] T002 Crear en `backend/tests/helpers/card-photos.ts` el generador de fotos sintéticas con `sharp`: vertical, horizontal, cuadrada, con transparencia, diminuta, fondo liso, fondo degradado, producto cortado por el borde, dos productos separados y empaque blanco sobre blanco — _hecho en `backend/tests/fixtures/card-photos.ts` (junto a `photos.ts`; `tests/helpers.ts` ya existe como archivo)_
- [X] T003 [P] Crear `frontend/src/assets/print/sparkle.svg` y `frontend/src/assets/print/chat.svg` (íconos propios simples, sin arte de Canva ni del negocio)

---

## Phase 2: Fundamentos (bloquean todas las historias)

**Objetivo**: ampliar el modelo sin cambiar nada existente y fijar la comprobación de no regresión.

- [X] T004 Escribir `backend/tests/integration/pdf-baseline-010.test.ts`: genera las 4 plantillas base × 8 variantes (corta y larga) y compara byte a byte con `specs/007-editor-align-text-tools/visual/baseline/` (FR-022, SC-004); debe pasar ya, antes de tocar el modelo — _hecho como script, no como prueba de vitest: `backend/tests/fixtures/pdf-baseline.ts capture|compare` (cada PDF tarda ~1 min). La línea base de la 007 ya no coincide con el código actual (anterior a la 005), así que se capturó una nueva con el código previo (ver quickstart §1)_
- [X] T005 Escribir en `backend/tests/unit/template-schema-010.test.ts` las pruebas de esquema: valores nuevos aceptados (`cardStyle`, `priceGlow`, `soldGlow`, `bubbleShadow`, `descLh`, `layout: 'base'`, `nameStyle: 'tarjeta'`, `sold: 'diagonal'`), fuera de rango rechazados, `upload:` con `..`, separadores o nombres peligrosos rechazado
- [X] T006 Ampliar `backend/src/catalog/template.ts` según data-model §1.1–1.2: `BASE_IDS += 'base'`, `NAME_STYLES += 'tarjeta'`, `ProductsLayout += 'base'`, `SoldOutStyle += 'diagonal'`, `IMAGE_KEYS += 'sparkle','chat'`, `ImageKey` acepta `upload:<archivo>`, y los cinco campos opcionales de `ProductsEl` — _`BASE_IDS += 'base'` se difiere a T033: añadirlo antes exige la fábrica `base()`_
- [X] T007 Actualizar `backend/src/catalog/template.schema.ts` con la validación de T005 (expresión `^upload:[A-Za-z0-9._-]+$`, `descLh` dentro de `RANGES.lh`)
- [X] T008 [P] Escribir en `backend/tests/unit/template-normalize-010.test.ts` que `normalizeProductsBlocks` completa los campos nuevos con el valor de hoy, es idempotente y no cambia plantillas existentes
- [X] T009 Ampliar `normalizeProductsBlocks` en `backend/src/catalog/template-presets.ts` (data-model §1.4)
- [X] T010 [P] Repetir en `frontend/src` los tipos espejo del modelo si existen (buscar el uso de `ProductsEl` en `frontend/src/pages/TemplateEditor/` y `frontend/src/print/`) y que `npm run build` en `frontend/` compile
- [X] T011 Volver a correr T004 y las suites existentes: 0 diferencias (punto de control de la fase) — _8 de 8 PDF idénticos (normalizando fecha e identificador)_

**Checkpoint**: modelo ampliado, nada existente cambió.

---

## Phase 3: User Story 1 — Foto-tarjeta sin trabajo manual (P1) 🎯 MVP

**Objetivo**: cada producto con foto sale como tarjeta oscura con nombre en neón, en los dos modos de fondo.

**Prueba independiente**: con las 5 fotos y los 5 nombres de quickstart §2, las tarjetas tienen la misma proporción, el nombre no se sale, la foto no se deforma y repetir da los mismos bytes.

### Pruebas (primero)

- [X] T012 [P] [US1] `backend/tests/unit/photo-card.test.ts`: determinismo (mismas entradas, mismos bytes), proporción 6,10 × 8,03 cm a 150 ppp, foto horizontal/vertical/cuadrada sin deformar, transparencia, foto diminuta a su tamaño, peso por tarjeta ≤ presupuesto de research R6 — _`backend/tests/unit/photo-card.test.ts`_
- [X] T013 [P] [US1] `backend/tests/unit/photo-card-backdrop.test.ts`: `sin-fondo` acepta fondo liso; rechaza con motivo `border_not_uniform`, `subject_too_small`, `subject_too_large`, `subject_cut`, `multiple_subjects` y cae a `marco` (FR-008a, SC-010)
- [X] T014 [P] [US1] `backend/tests/integration/catalog-cards.test.ts`: el payload trae `imageUrl` = `/media/cards/<sha1>.jpg` solo con `cardStyle: 'tarjeta'`; con otras plantillas es idéntico al de hoy; productos sin foto quedan fuera con aviso; `GET /media/cards/<nombre inseguro>` responde 404 — _T014 y T015 viven en `backend/tests/integration/catalog-cards.test.ts`_
- [X] T015 [P] [US1] `backend/tests/integration/card-preview.test.ts`: `POST /api/catalog/card-preview` (respuesta, `410 prepare_expired`, `404 not_found`, `400` con modo desconocido) y `photoBackdrop` inválido responde `400`
- [X] T016 [P] [US1] `frontend/tests/products-block-card.test.tsx`: con `cardStyle: 'tarjeta'` el nombre se dibuja dentro de la foto (franja superior del 18 %), partido en líneas y reducido, con puntos suspensivos al mínimo; con `plana` el render es idéntico al actual (incluye nombre de una sola palabra de 30 letras y coreano)

### Implementación

- [X] T017 [US1] Crear `backend/src/pdf/card-cache.ts`: caché en disco `data/card-cache/` con clave (foto + modo + tamaño + relleno + versión del algoritmo), vaciada al arrancar como `pdf-photos`, nombre `<sha1>.jpg`
- [X] T018 [US1] Crear `backend/src/pdf/photo-card.ts` con `composeCard(CardSpec): CardResult`: modo `marco` (fondo desenfocado y oscurecido, foto completa con marco claro `#F4EFE6` y esquinas redondeadas, franja libre del 18 %), JPEG q88 4:4:4, determinista (data-model §3.3)
- [X] T019 [US1] Añadir a `photo-card.ts` el modo `sin-fondo`: relleno por inundación desde el borde con las comprobaciones de confianza (borde uniforme ≥ 80 %, sujeto 6–88 %, ≤ 25 % tocando el borde, componente mayor ≥ 85 %) y vuelta a `marco` con `reason`
- [X] T020 [US1] Registrar `cardMaker` y la carpeta de tarjetas en `backend/src/context.ts` y servir `/media/cards/` solo para `^[0-9a-f]{40}\.jpg$` en `backend/src/api/catalog.routes.ts`
- [X] T021 [US1] Opción `photoBackdrop` (`'marco'|'sin-fondo'`, por defecto `marco`) en `backend/src/catalog/catalog.service.ts` y `catalog.routes.ts`, ignorada sin error si la plantilla no usa tarjeta (contracts §1)
- [X] T022 [US1] En el payload (`catalog.routes.ts`) cambiar `imageUrl` por la tarjeta compuesta cuando el bloque de productos tiene `cardStyle: 'tarjeta'`; un fallo de composición usa `marco` y luego la foto original (contracts §2)
- [X] T023 [US1] `JobState.backdropFallbacks` en `backend/src/pdf/job.ts` y su salida en `GET /api/catalog/jobs/current` (solo en `done` y si hay alguno)
- [X] T024 [US1] `POST /api/catalog/card-preview` en `backend/src/api/catalog.routes.ts` (contracts §3)
- [X] T025 [P] [US1] Dibujar la tarjeta en `frontend/src/print/blocks/ProductsBlock.tsx` y `products-block.css`: `cardStyle: 'tarjeta'` y `nameStyle: 'tarjeta'` (nombre vectorial neón en la franja superior, partido y reducido, `nameColor`/`nameGlow` de la paleta, FR-003 y FR-007); sin cambiar el camino de `plana`
- [X] T026 [US1] Opción «Fondo de la foto» (Dejar como está / Quitar el fondo automáticamente) con tarjeta de ejemplo en `frontend/src/pages/Generate.tsx`, aviso «N fotos se dejaron con su fondo original» al terminar (FR-008b, FR-008c, SC-011)
- [X] T027 [US1] Correr T012–T016 y T004: todo pasa, línea base intacta — _backend 65 archivos/1021 pruebas y frontend 545 pruebas en verde (más los 2 archivos con conflicto de fusión ajenos a la 010); 8 de 8 PDF idénticos a la línea base_

**Checkpoint**: US1 funciona sola (con una plantilla de prueba que active `cardStyle: 'tarjeta'`).

---

## Phase 4: User Story 2 — Plantilla «Base AsianPop» (P1)

**Objetivo**: quinta plantilla de fábrica que reproduce la página de productos de la base.

**Prueba independiente**: página de 3 productos (uno agotado) comparada con la página 3 de la base: piezas a < 2 mm, mismos colores y tipografías.

### Pruebas (primero)

- [X] T028 [P] [US2] `backend/tests/unit/template-layout-base.test.ts`: distribución `base` con 0, 1, 2, 3, 4 y 7 productos (3+3+1), filas centradas, sin huecos ni solapes, rectángulo `name` dentro de la foto
- [X] T029 [P] [US2] `backend/tests/integration/templates.test.ts` (ampliar): `GET /api/templates` lista cinco de fábrica con `base` al final; plantilla guardada anterior se devuelve igual — _cubierto actualizando `templates.test.ts` y `template-migration.test.ts` (cinco plantillas sembradas); en instalaciones ya existentes la quinta no se agrega sola: se crea desde la galería_
- [X] T030 [P] [US2] `frontend/tests/products-block-base.test.tsx`: AGOTADO diagonal −45° como texto real por encima de la foto, neón del precio y de la cinta, sombra de burbuja, interlineado `descLh`; las otras plantillas sin cambio
- [X] T031 [P] [US2] `backend/tests/integration/pdf-template-base.test.ts` (Chrome real): PDF de la plantilla `base`, texto «AGOTADO» buscable, sin imágenes rotas, título en mayúsculas — _`backend/tests/integration/pdf-template-base.test.ts`; con neón cada capa de resplandor es otra copia del texto en el PDF (como ya pasa con el nombre de cada producto), así que se comprueba presencia, no unicidad_

### Implementación

- [X] T032 [US2] Distribución `base` en `backend/src/catalog/template-layout.ts` con las fracciones de data-model §2 y centrado vertical con 1 o 2 productos
- [X] T033 [US2] Fábrica `base()` en `backend/src/catalog/template-presets.ts` con la paleta y el bloque de productos de data-model §1.3 (título `CATÁLOGO {seccion}` en mayúsculas, logo cuadrado 4,06 cm a 0,3 cm, estrellas y manchas, fondo `marble`), y `BASE_TEMPLATES` con cinco — _radio de la burbuja 40 (máximo del esquema; la base mide 51 en la escala de Canva); portadas y políticas con diseño razonable, sin ilustraciones (US4 las afina)_
- [X] T034 [US2] Interlineado 1,4 solo para la plantilla `base`, sin tocar `TEXT_DEFAULTS.lh = 1.05` (FR-013b)
- [X] T035 [P] [US2] AGOTADO `diagonal`, `priceGlow`, `soldGlow`, `bubbleShadow` y `descLh` en `frontend/src/print/blocks/ProductsBlock.tsx` y `products-block.css`, con Poppins 700 para la cinta (Open Sans no existe en el editor)
- [X] T036 [P] [US2] `frontend/src/print/assets.ts` resuelve `sparkle` y `chat`
- [X] T037 [P] [US2] Campos nuevos del bloque de productos en `frontend/src/pages/TemplateEditor/inspector-fields.ts` y quinta plantilla visible en la galería (`panels/PlantillasPanel.tsx`) — _`descLh` no tiene control en el inspector (es opcional y la plantilla lo fija en 1,4)_
- [ ] T038 [US2] **Confirmar con REA** las posiciones estimadas (filas 1 y 2 y lado derecho): en la base de Canva, Posición → Capas → Organizar de las tarjetas 1 y 2 de la página 3; ajustar `layout base` y T028 si difieren más de 2 mm (research R4, quickstart §4.3). Guardar la evidencia en `docs/specs/rea-evidence/README.md` — _**PENDIENTE (REA)**: el puerto 9222 no respondió en esta sesión (Vivaldi sin depuración). Verificación parcial con la captura `rea-evidence/19-…png` (página 3): fila 2 foto X 50,5 %, burbuja X 12,6 %, precio centrado en 33,6 % y foto a 39,9 % de la hoja, todos dentro de ~0,5 % de lo estimado (≈1,5 mm). Falta la medida exacta por Capas → Organizar de las tarjetas 1 y 2; si difiere más de 2 mm, ajustar las constantes `BASE_*` de `template-layout.ts` y `template-layout-base.test.ts`_
- [X] T039 [US2] Comparar lado a lado con `docs/specs/rea-evidence/19-base-pagina-producto-agotado.png` y calibrar `text-shadow` del neón (research R5, quickstart §7.2) — _calibrado contra `rea-evidence/19-…png`: neón del precio a dos capas, cinta AGOTADO a tres_
- [X] T040 [US2] Correr T028–T031 y T004: todo pasa

**Checkpoint**: US1 y US2 juntas dan la página de productos de la base.

---

## Phase 5: User Story 3 — Descripción en la burbuja (P2)

**Objetivo**: descripción de Alegra centrada en la burbuja, sin burbujas vacías.

**Prueba independiente**: productos con descripción corta, de 400 caracteres y sin descripción (quickstart §5.1).

- [X] T041 [P] [US3] `frontend/tests/products-block-description.test.tsx`: corta centrada (2–6 líneas); larga reducida hasta el mínimo y cortada con «…»; sin descripción no hay burbuja vacía y la fila queda equilibrada; nunca se repite la descripción de otro producto (FR-013c, FR-017, FR-018, SC-008) — _`frontend/tests/products-block-description.test.tsx` más una prueba en Chrome (`pdf-template-base.test.ts`) con 400 caracteres: sin desbordes ni marcas_
- [X] T042 [US3] Ajuste automático de tamaño y corte con «…» de la descripción en `frontend/src/print/blocks/ProductsBlock.tsx` — _ya lo hacían `useFit` y `--desc-lines` del bloque (letra hasta 6 pt y luego «…»); no hizo falta código nuevo_
- [X] T043 [US3] Sin descripción: omitir la burbuja y recentrar tarjeta y precio en `ProductsBlock.tsx` y `template-layout.ts`, comprobando que las otras plantillas no cambian (T004) — _hecho en US2 (burbuja omitida y filas centradas)_
- [X] T044 [US3] Confirmar que la descripción de Alegra llega al ítem del payload (`backend/src/catalog/catalog.service.ts`); si no, mapearla sin tocar Alegra — _comprobado: la descripción de Alegra ya llega al ítem del payload (`catalog-builder.ts`); sin cambios_

**Checkpoint**: US3 completa.

---

## Phase 6: User Story 4 — Portadas y contacto (P2)

**Objetivo**: portada general y de sección con contacto desde la configuración y logo/ilustraciones subidos por el responsable.

**Prueba independiente**: cambiar un teléfono en la configuración y ver el cambio en todas las portadas sin editar la plantilla (SC-006).

### Pruebas (primero)

- [X] T045 [P] [US4] `backend/tests/integration/template-images.test.ts`: `POST` (tipo real por contenido, `400 invalid_image`, `413 too_large`, nombre `tpl-<id>.<ext>`), `GET`, `DELETE` (`404` nombres ajenos, `409 in_use` con plantillas) — _`template-images.test.ts` (10 pruebas); errores alineados con los de las fotos de productos: 422/413, borrado 204_
- [X] T046 [P] [US4] `frontend/tests/cover-contact.test.tsx`: la portada muestra «Domicilios» y los dos teléfonos desde `{telefonos}`; sin ilustración se ve completa; con `upload:` muestra la imagen — _`cover-contact.test.tsx` e `image-picker.test.tsx`_

### Implementación

- [X] T047 [US4] Crear `backend/src/api/template-images.routes.ts` (sesión obligatoria, validación reutilizada de las fotos de productos) y registrarla en el servidor
- [X] T048 [P] [US4] `IMAGES` en `frontend/src/print/assets.ts` y `frontend/src/print/TemplateElement.tsx` resuelven `upload:<archivo>` hacia `/media/uploads/<archivo>`
- [X] T049 [US4] Selector de imagen subida (subir, listar, borrar) en el inspector, `frontend/src/pages/TemplateEditor/inspector-fields.ts` y `panels/` — _componente `ImagePicker.tsx` («Mis imágenes») en el inspector de imágenes; `api.postForm`_
- [X] T050 [US4] Páginas «Portada» y «Portada de sección» de la plantilla `base` en `backend/src/catalog/template-presets.ts`: título enorme en mayúsculas (`{banner}`/`{seccion}`), logo, contacto «Domicilios» + `{telefonos}` con ícono `chat`, diseño razonable equilibrado sin ilustración (portadas no medidas, research R9); página «Políticas» con la paleta de `base` — _ya hecho en T033; sin ilustración la portada queda con logo, título y contacto. La ilustración se sube con «Mis imágenes» y se agrega como imagen_
- [X] T051 [US4] Comprobar que cambiar el logo en la configuración se refleja en todas las páginas (US4 escenario 4) — _**desviación**: no existe un logo en la configuración del negocio; el logo es un elemento de imagen de cada plantilla. Cambiarlo = elegir otra imagen subida en «Mis imágenes» (por página). Un logo global en la configuración queda como mejora aparte_

**Checkpoint**: las cuatro historias funcionan.

---

## Phase 7: Pulido y validación final

- [X] T052 Recorrer `quickstart.md` §2–§7 con datos temporales (`DATA_DIR` temporal, servidor aparte, sin Alegra real) y anotar resultados — _resultados en quickstart §9; lo que no se pudo (fotos reales, medida con REA) queda anotado_
- [X] T053 Medir peso y tiempos con ~180 productos sintéticos (SC-005, SC-009): PDF < 25 MB, primera vs. segunda generación; si pasa de 25 MB bajar la calidad de la tarjeta a 82 (research R6) — _herramienta `backend/tests/fixtures/card-perf.ts`; 15,9 MB y 9,1 s / 4,6 s con marco; no hizo falta bajar la calidad a 82_
- [X] T054 Suite completa (`npm test` en `backend/` y `frontend/`, `npm run test:pdf`): ninguna prueba existente cambia de resultado; repetir T004 — _backend 1072 y frontend 575 pruebas en verde; 8 de 8 PDF idénticos_
- [X] T055 [P] Actualizar `README.md` y `docs/specs/canva-base-template-spec.md` (estado de la 010, subida de imágenes de plantilla reemplaza la restricción de la 003)
- [X] T056 [P] Marcar en `docs/specs/PENDIENTES-REA.md` lo confirmado en T038 y dejar anotado lo que sigue sin medir (portadas, páginas 28–42)

---

## Dependencias y orden

- **Setup (Fase 1)** → **Fundamentos (Fase 2)** → historias.
- **US1** y **US2** son P1; US2 usa el dibujo de tarjeta de US1 (T025) para ver la plantilla completa, pero cada una se prueba sola (US1 con una plantilla de prueba, US2 con fotos planas).
- **US3** depende de `ProductsBlock` y la distribución de US2 (T032, T035). **US4** es independiente de US1–US3 salvo por la fábrica `base` (T033).
- Dentro de cada historia: pruebas → backend → frontend → punto de control.

## Oportunidades de paralelismo

- Fase 1: T003 en paralelo con T001–T002.
- Fase 2: T008 y T010 en paralelo con T005–T007.
- US1: pruebas T012–T016 en paralelo; T025 (frontend) en paralelo con T017–T024 (backend).
- US2: pruebas T028–T031 en paralelo; T035–T037 en paralelo entre sí.
- US4: T045 y T046 en paralelo; T048 en paralelo con T047.
- Con dos personas: una toma US1 (backend de tarjetas) y otra US2 (plantilla y `ProductsBlock`) tras la Fase 2, cuidando que `ProductsBlock.tsx` lo edita T025, T035, T042, T043 en ese orden.

## Estrategia de implementación

1. **MVP = Fase 1 + 2 + US1**: ya se generan las tarjetas en ambos modos con una plantilla que active `cardStyle: 'tarjeta'`.
2. Añadir **US2** → catálogo con el aspecto de la base (el hito principal).
3. **US3** y **US4** completan el contenido; pueden salir después.
4. Detener y validar en cada punto de control con T004 (línea base de la 007).
5. Todo cambio al render, al modelo o al bloque de productos obliga a repetir T004 antes de cerrar la tarea.
