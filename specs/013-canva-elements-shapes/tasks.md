# Tasks: Elementos y formas estilo Canva

**Input**: `specs/013-canva-elements-shapes/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Pruebas incluidas** (constitución V). **Rutas**: `backend/src/catalog/`, `frontend/src/print/`, `frontend/src/pages/TemplateEditor/`, `frontend/tests/`, `backend/tests/`.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: paralelizable. **[Story]**: US1 formas · US2 borde · US3 línea · US4 voltear · US5 proporción · US6 enlace.

---

## Fase 1: Preparación

- [X] T001 (8 PDF capturados el 2026-10-23 con el commit `8eacd38`, en `C:\Users\Usuario\AppData\Local\Temp\asiapop-baseline-013`) Línea base de PDFs **antes de tocar código**: `BASELINE_DIR=<carpeta temporal> npx tsx tests/fixtures/pdf-baseline.ts capture` en `backend/` (8 PDF); anotar carpeta y commit en `specs/013-canva-elements-shapes/quickstart.md` §1

## Fase 2: Fundamentos (bloquea las historias)

- [X] T002 En `backend/src/catalog/template.ts` agregar las constantes `SHAPE_KINDS`, `BORDER_STYLES`, `LINE_CAPS`, `LINK_MAX`, `LINK_RE` y `SHAPE_DEFAULTS`; ampliar `ShapeEl` (`kind` con los seis tipos nuevos y `line`, `bs`, `capStart`, `capEnd`, `flipH`, `flipV`, `lockAspect`, `href`), `ImageEl` (`flipH`, `flipV`, `lockAspect`, `href`), `TextEl` y `BadgeEl` (`href`); todos opcionales
- [X] T003 En `backend/src/catalog/template.schema.ts` declarar los campos nuevos de cada tipo (zod descarta las claves no declaradas), ampliar el enum `kind` y validar `href` (`''` o `LINK_RE`, máximo `LINK_MAX`) con el mensaje «El enlace debe empezar con http:// o https:// y no tener espacios.»
- [X] T004 [P] Prueba `backend/tests/unit/template-schema-013.test.ts`: plantilla sin campos válida; los campos sobreviven a validar (forma, imagen, texto, insignia); cada tipo de forma, `bs` y extremo aceptado; valores fuera de lista rechazados; `href` válido, vacío, con `javascript:`, sin protocolo, con espacios y de más de 2000 caracteres; `flipH`/`lockAspect` no válidos como texto en un texto (se descartan)
- [X] T005 [P] Crear `frontend/src/print/shapes.ts` con funciones puras: `shapePath(kind, w, h)` (contorno `d` de `triangle`, `diamond`, `star`, `burst`, `arrow` y `bubble` dentro de la caja), `insetBox(w, h, bw)` (caja reducida en el grosor y desplazamiento de medio grosor), `dashArray(bs, bw)` (sólido sin guiones, discontinuo `3g 2g`, punteado `0 2g`), `capSize(bw)` (`3g + 4`) y `lineGeometry(w, h, bw, capStart, capEnd)` (extremos de la línea y tramo central dentro de la caja)
- [X] T006 [P] Prueba `frontend/tests/shapes.test.ts` de lo anterior: cada contorno queda entre 0 y `w`/`h`; la estrella tiene 10 vértices y el estallido 24; la flecha apunta a la derecha; la línea sin extremos ocupa todo el ancho; con extremos ocupan `capSize` y la línea recorre el resto; el grosor mínimo es 1
- [X] T007 [P] Crear `frontend/src/pages/TemplateEditor/lock-aspect.ts` con `lockedSize(origin, patch)`: dado un parche con solo `w` o solo `h`, devuelve el par que conserva `origin.h / origin.w`, recortado a `RANGES.w` y `RANGES.h` sin perder la relación; sin uno solo de los dos devuelve el parche tal cual; prueba `frontend/tests/lock-aspect.test.ts` (solo ancho, solo alto, ambos, recorte por arriba y por abajo, relación 1:1 y 3:1)

**Punto de control**: `npx vitest run` sin regresiones en backend y frontend.

---

## Fase 3: US1 — Más formas (P1) 🎯 MVP

**Prueba independiente**: agregar cada forma, cambiarle relleno y borde, guardar, recargar y generar el PDF.

- [X] T008 [P] [US1] Pruebas de render en `frontend/tests/shapes-013.test.tsx` (sección formas): `rect`/`circle`/`pill` sin campos nuevos dan el mismo marcado de siempre (`div.tpl-shape`, sin `<svg>`); cada tipo nuevo se dibuja como `<svg>` con un `<path>` y su relleno; con borde el trazo queda dentro de la caja; el resplandor usa `filter: drop-shadow`
- [X] T009 [US1] Crear `frontend/src/print/ShapeSvg.tsx` (`<svg>` del tamaño de la caja en px con `shapePath`, relleno, trazo y resplandor) y usarlo desde `ShapeBody` en `frontend/src/print/TemplateElement.tsx` para los tipos que no son `rect`, `circle`, `pill`; los tres actuales conservan su CSS exacto
- [X] T010 [US1] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` ampliar el selector de tipo de forma con los tipos nuevos (conserva las etiquetas «Rectángulo», «Círculo», «Píldora»); «Esquinas» solo con `rect`
- [X] T011 [US1] En `frontend/src/pages/TemplateEditor/panels/ElementosPanel.tsx` agregar las formas nuevas (fábricas y vistas previas propias dibujadas con `shapePath`/CSS, sin recursos de Canva) y estilos en `editor.css`
- [X] T012 [P] [US1] Pruebas del inspector y del panel en `frontend/tests/shapes-013.test.tsx`: el panel muestra las nueve formas; agregar una la deja seleccionada y visible; cambiar el tipo conserva relleno, borde, posición y tamaño; un cambio = un paso de deshacer; el bloqueo deshabilita

---

## Fase 4: US2 — Estilo de borde (P1)

- [X] T013 [P] [US2] Pruebas en `frontend/tests/shapes-013.test.tsx` (sección borde): `bs` ausente o `solid` en `rect` da `Npx solid color` como antes; `dashed`/`dotted` en `rect`, `circle` y `pill` cambian `border-style`; en las formas SVG aparece `stroke-dasharray` (y `stroke-linecap: round` en punteado)
- [X] T014 [US2] En `frontend/src/print/TemplateElement.tsx` (`ShapeBody`) y `ShapeSvg.tsx` aplicar `bs`; en `inspector-fields.ts` agregar «Estilo del borde» (Sólido · Discontinuo · Punteado) visible solo con borde
- [X] T015 [P] [US2] Pruebas del inspector: el control aparece solo con borde, un cambio = un paso, el bloqueo lo deshabilita

---

## Fase 5: US3 — Línea con estilo y extremos (P1)

- [X] T016 [P] [US3] Pruebas en `frontend/tests/shapes-013.test.tsx` (sección línea): `kind: 'line'` se dibuja como `<svg>` con una línea del color `fill` y el grosor `bw`; estilo con guiones; extremos inicial y final con su figura; la línea sin extremos no deja figuras; una forma `rect` delgada existente sigue siendo un `div` sin `<svg>`
- [X] T017 [US3] En `ShapeSvg.tsx` dibujar `kind: 'line'` con `lineGeometry`: línea con `stroke-dasharray`, y por extremo flecha (triángulo relleno con la punta en el borde), círculo, cuadrado o rombo
- [X] T018 [US3] En `inspector-fields.ts` dar a la línea su propio juego de campos: «Color» (`fill`), «Grosor» (1 a 12), «Estilo», «Extremo inicial» y «Extremo final»; sin selector de tipo, relleno ni borde
- [X] T019 [US3] En `ElementosPanel.tsx` la fábrica `line` agrega `kind: 'line'` (centrada, horizontal, tinta de la plantilla, grosor 3, sin extremos)
- [X] T020 [P] [US3] Pruebas del inspector y del panel: agregar una línea; cambiar color, grosor, estilo y cada extremo; un cambio = un paso; el bloqueo lo deshabilita

---

## Fase 6: US4 — Voltear (P2)

- [X] T021 [P] [US4] Pruebas en `frontend/tests/shapes-013.test.tsx` (sección voltear): sin `flipH`/`flipV` y sin giro no hay `transform`; con giro solo `rotate(...)` como antes; `flipH` da `scale(-1, 1)`, `flipV` `scale(1, -1)`, ambos `scale(-1, -1)`; con giro `rotate(r) scale(...)`; texto e insignia no los ofrecen
- [X] T022 [US4] En `TemplateElement.tsx` componer el `transform` del contenedor con el volteo de formas e imágenes
- [X] T023 [US4] En `inspector-fields.ts` agregar los interruptores «Voltear horizontal» y «Voltear vertical» a formas, líneas e imágenes (con `lockable`)
- [X] T024 [P] [US4] Pruebas del inspector: cada interruptor refleja y deshace en un paso; no aparecen en texto, insignia ni bloques

---

## Fase 7: US5 — Bloquear proporción (P2)

- [X] T025 [P] [US5] Pruebas en `frontend/tests/shapes-013.test.tsx` y `frontend/tests/lock-aspect.test.ts` (sección editor): `computeDrag` con `lockAspect` conserva la relación al redimensionar; sin bloqueo funciona como siempre; el reductor deriva el alto al cambiar solo «Ancho %» (y al revés); recorte a los límites sin perder la relación; un cambio = un paso
- [X] T026 [US5] En `frontend/src/pages/TemplateEditor/usePointerDrag.ts` pasar `lockAspect` a `computeDrag`, y en `Canvas.tsx` entregarlo desde el elemento seleccionado
- [X] T027 [US5] En `useTemplateEditor.ts` aplicar `lockedSize` cuando un parche de un elemento con `lockAspect` trae solo `w` o solo `h`
- [X] T028 [US5] En `inspector-fields.ts` agregar el interruptor «Bloquear proporción» a formas, líneas e imágenes

---

## Fase 8: US6 — Enlace clicable (P3)

- [X] T029 [P] [US6] Pruebas en `frontend/tests/shapes-013.test.tsx` (sección enlace): sin `href` el DOM es el de siempre; con `href` el cuerpo va en un `<a href target="_blank" rel="noopener noreferrer">` de caja completa, en texto, insignia, forma e imagen; el inspector escribe y quita el enlace (campo vacío = sin `href`, sin paso extra); un valor inválido no se guarda
- [X] T030 [US6] En `TemplateElement.tsx` envolver el cuerpo en `<a>` solo con `href`; en `editor.css` `.ed-canvas a { pointer-events: none }` para que el clic solo seleccione
- [X] T031 [US6] En `inspector-fields.ts` y `FieldRenderer.tsx` agregar el tipo de campo `input` (una línea, confirma con Enter o al salir) y el campo «Enlace» en texto, insignia, forma, línea e imagen
- [X] T032 [US6] En `useTemplateEditor.ts` tratar `href: ''` como ausente (no agrega paso de deshacer ni deja la clave)
- [X] T033 [P] [US6] Pruebas del inspector: un cambio = un paso; el bloqueo deshabilita el campo

---

## Fase 9: Cierre y compatibilidad

- [X] T034 (21 casos «feature 013» en Chrome real, incluida la anotación `/URI` del PDF) Pruebas de fidelidad en Chrome real en `backend/tests/integration/pdf-template-fidelity.test.ts` («feature 013»): cada forma nueva con relleno y borde, bordes discontinuo y punteado, línea con cada extremo, volteo con giro y un enlace (el PDF contiene la anotación de enlace con la dirección) se ven igual en el lienzo y en el PDF
- [X] T035 (8 de 8 PDF idénticos byte a byte, 2026-10-23) Reconstruir `frontend/dist` y comparar byte a byte: `BASELINE_DIR=<carpeta de T001> npx tsx tests/fixtures/pdf-baseline.ts compare` en `backend/`; las 8 salidas **idénticas** (SC-001)
- [X] T036 (frontend 1081/1081; backend 1207/1207; `tsc` limpio en ambos; `eslint` solo marca `round1` sin usar en `FieldRenderer.tsx`, anterior a esta feature) [P] Suites completas (`npx vitest run` en `frontend/` y `backend/`), `tsc --noEmit` en ambos y `eslint` de lo tocado; corregir regresiones
- [X] T037 (23-oct-2026, app con `DATA_DIR` temporal y simulador: panel con las diez formas, estrella con inspector completo, línea discontinua con círculo y flecha, enlace; guardar y recargar conservan figuras y enlace, y el `<a>` no recibe clics en el editor; volteo y proporción solo con pruebas automáticas) Revisión manual en el navegador con datos temporales (`quickstart.md` §6) y anotar el resultado
- [X] T038 [P] Actualizar documentación: `docs/specs/ROADMAP-CANVA.md` (013 hecha; 013b pendiente), `docs/specs/canva-fields-inventory.md` §3.3 a §3.6, `docs/specs/PENDIENTES-REA.md` y `README.md`

---

## Dependencias y orden

- **T001** primero. **Fase 2** bloquea las historias (T002 → T003; T004–T007 [P]).
- **US1 → US2 → US3** tocan los mismos archivos (`TemplateElement.tsx`, `ShapeSvg.tsx`, `inspector-fields.ts`): hacer en orden. **US4** depende del render de US1; **US5** de T007 y es independiente de US3; **US6** toca `TemplateElement.tsx` y `FieldRenderer.tsx`: va después de US4.
- **Cierre** al final.

## Resumen

- **Total**: 38 tareas · Preparación 1 · Fundamentos 6 · US1 5 · US2 3 · US3 5 · US4 4 · US5 4 · US6 5 · Cierre 5.
- **MVP**: T001 a T012 (formas nuevas).
