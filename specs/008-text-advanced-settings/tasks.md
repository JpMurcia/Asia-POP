# Tasks: Ajustes avanzados de texto en el editor de plantillas

**Input**: Documentos de diseño de `/specs/008-text-advanced-settings/` (plan.md, spec.md, research.md, data-model.md, contracts/editor-ui.md, quickstart.md)

**Prerequisites**: plan.md y spec.md (hechos). Las pruebas **sí** se incluyen: la constitución (V) y el plan piden pruebas escritas junto con el código, y FR-015 exige comparar los PDF con la línea base.

**Formato**: `- [ ] T### [P?] [US?] Descripción con ruta`. `[P]` = se puede hacer en paralelo (archivos distintos, sin depender de una tarea incompleta). `[US#]` = historia de la spec.

**Rutas**: `backend/src/catalog/` (modelo y esquema), `backend/tests/unit/` y `backend/tests/integration/`, `frontend/src/print/` (render), `frontend/src/pages/TemplateEditor/` (editor), `frontend/tests/`.

## Phase 1: Setup (comprobación de partida)

- [ ] T001 Reconstruir `frontend/dist` (`npx vite build` en `frontend/`) y comprobar que la línea base de PDFs de la feature 007 sigue idéntica con `npx tsx tests/fixtures/pdf-baseline.ts` en `backend/` (8 PDF + la plantilla `base`); anotar el resultado como punto de partida en `specs/008-text-advanced-settings/quickstart.md` §1
- [ ] T002 [P] Localizar y listar las pruebas existentes que fijan los rangos viejos (altura de línea 0,8 o paso 0,05; espaciado −2…12 o paso 0,5; control «Espaciado» o «Altura de línea» dentro de «Tipografía») con `grep` en `backend/tests` y `frontend/tests`; dejar la lista en un comentario de la tarea T012 (no tocar aún)

---

## Phase 2: Foundational (bloquea las historias)

**Propósito**: el modelo, el esquema, el reductor y el campo numérico compartido. Ninguna historia puede cerrarse sin esto.

- [ ] T003 En `backend/src/catalog/template.ts`: `RANGES.lh = [0.5, 2.5]`, `RANGES.ls = [-10, 60]`; agregar `vAlign?: 'top' | 'middle' | 'bottom'` a `TextEl` y `vAlign: 'middle'` a `TEXT_DEFAULTS` (con la nota de por qué es «middle»: así se dibuja hoy); actualizar los comentarios de rango
- [ ] T004 En `backend/src/catalog/template.schema.ts`: declarar `vAlign` opcional con `oneOf(['top','middle','bottom'], 'La alineación vertical')` en `textEl` (z.object descarta claves desconocidas); `lh`, `ls` y `descLh` ya leen `RANGES`
- [ ] T005 [P] Prueba nueva `backend/tests/unit/template-schema-008.test.ts`: `lh` acepta 0,5 y 2,5 y rechaza 0,4 y 9; `ls` acepta −10 y 60 y rechaza −11 y 61; `vAlign` acepta los tres valores, rechaza «centro» y se conserva al guardar y leer; una plantilla sin `vAlign` se valida y se lee sin el campo; los valores antiguos (0,8; −2; 12; 3; 0,4) siguen válidos
- [ ] T006 En `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` (`case 'patch'`): para elementos de texto, recortar `lh` y `ls` a `RANGES` y redondearlos (lh a 2 decimales, ls a 1) y, si tras recortar ningún valor del parche difiere del elemento, devolver el estado sin agregar historia (conservar el `mergeKey` del arrastre)
- [ ] T007 [P] Pruebas del reductor en `frontend/tests/template-editor-reducer.test.ts` (bloque nuevo «ajustes avanzados de texto (feature 008)»): recorte de 9→2,5 y 0,1→0,5 en `lh`, de 99→60 y −99→−10 en `ls`; redondeo 1,375→1,38; un parche idéntico no agrega paso ni vacía el rehacer; un arrastre (mismo `key`) sigue siendo un solo paso; un elemento que no es texto no se recorta
- [ ] T008 En `frontend/src/pages/TemplateEditor/inspector-fields.ts` y `FieldRenderer.tsx`: ampliar el descriptor `range` con `numeric?: boolean` y `decimals?: number`; con `numeric` dibujar, junto al deslizador, un campo de texto con la lógica de `NumberField` (coma o punto; vacío o letras restauran el valor; recorte al confirmar con Enter o al salir; `aria-label` «<etiqueta> (valor)»), sincronizado con el deslizador (FR-011, FR-003)

**Checkpoint**: modelo, esquema, reductor y campo numérico listos; `npx vitest run` de T005 y T007 en verde.

---

## Phase 3: User Story 1 - Altura de línea más libre (Priority: P1) 🎯 MVP

**Goal**: la altura de línea cubre 0,5–2,5 en pasos de 0,01, con deslizador y campo numérico, sin cambiar el valor por defecto (1,05).

**Independent Test**: seleccionar un texto de tres líneas, llevar la altura de línea a 0,5, 1,37 y 2,5 y comprobar que lienzo y PDF coinciden; abrir una plantilla antigua y ver que nada cambió.

- [ ] T009 [US1] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` (campos de texto): «Altura de línea» con `RANGES.lh`, paso 0,01, `numeric`, `decimals: 2` y `fallback: TEXT_DEFAULTS.lh` (todavía dentro de «Tipografía»; US4 lo mueve al panel)
- [ ] T010 [P] [US1] Prueba nueva `frontend/tests/text-advanced-settings.test.tsx` (bloque US1): el campo muestra 1,05 en un texto sin `lh`; escribir `1,37` y `1.37` guarda 1,37; `9` ⇒ 2,5 y `0,1` ⇒ 0,5 con el valor final visible; letras o vacío restauran el valor; el deslizador llega a 0,5 y a 2,5; el estilo del texto en el lienzo usa ese `line-height`
- [ ] T011 [P] [US1] Prueba de fidelidad en `backend/tests/integration/pdf-template-fidelity.test.ts`: un título de tres líneas con `lh` 0,5 / 1,37 / 2,5 corta igual en el lienzo y en el PDF de Chrome (SC-003) y cabe en su caja
- [ ] T012 [US1] Actualizar las pruebas existentes de la lista de T002 que fijan la altura de línea 0,8 o el paso 0,05 (por ejemplo en `frontend/tests/template-editor-inspector.test.tsx` y `backend/tests/unit/template-schema.test.ts`) sin debilitar lo que comprueban

**Checkpoint**: US1 completa y probada por sí sola (mínimo entregable).

---

## Phase 4: User Story 2 - Espaciado entre letras más amplio (Priority: P2)

**Goal**: el espaciado cubre −10…60 px en pasos de 0,1, con campo numérico, sin cambiar los textos guardados.

**Independent Test**: con un título grande, separar al máximo, juntar al mínimo, guardar, recargar y generar el PDF; las 4 plantillas base (y `base`) siguen idénticas.

- [ ] T013 [US2] En `inspector-fields.ts`: «Espaciado» con `RANGES.ls`, paso 0,1, `numeric`, `decimals: 1`, unidad « px» (aún en «Tipografía»)
- [ ] T014 [P] [US2] Pruebas en `frontend/tests/text-advanced-settings.test.tsx` (bloque US2): el control muestra el valor guardado sin convertirlo (una plantilla con `ls` 3 muestra 3); −10 y 60 se alcanzan con el deslizador y escribiendo; 99 ⇒ 60 y −99 ⇒ −10; el estilo del texto usa `letter-spacing` en px; un texto con ajuste automático de tamaño sigue cabiendo con `ls` 60
- [ ] T015 [P] [US2] Prueba en `backend/tests/integration/pdf-template-fidelity.test.ts`: espaciado −10, 0 y 60 en un título; mismos cortes de línea en el lienzo y en el PDF
- [ ] T016 [US2] Actualizar las pruebas existentes que fijan el rango −2…12 o el paso 0,5 del espaciado

**Checkpoint**: US1 y US2 funcionan; ninguna plantilla guardada cambió.

---

## Phase 5: User Story 3 - Anclaje vertical (Priority: P2)

**Goal**: elegir Arriba, Centro o Abajo; sin el campo se dibuja como hoy (Centro).

**Independent Test**: caja de texto alta de una línea: elegir cada anclaje, ver el cambio, guardar, recargar y generar el PDF.

- [ ] T017 [US3] En `frontend/src/print/TemplateElement.tsx`: en `TextBody` y `FitText` aplicar `alignItems` (`flex-start` | `flex-end`) al `.tpl-text-box` **solo** cuando `el.vAlign` existe y no es `middle`; sin el campo, el marcado y los estilos quedan idénticos a los actuales (R3)
- [ ] T018 [US3] En `inspector-fields.ts`: campo `segmented` «Anclaje vertical» (`vAlign`; Arriba/Centro/Abajo) en los campos de texto, activo «Centro» si falta (usar `TEXT_DEFAULTS.vAlign`); comprobar en `FieldRenderer.tsx` que `segmented` muestra el valor por defecto cuando la propiedad no existe y escribe el valor elegido
- [ ] T019 [P] [US3] Pruebas en `frontend/tests/text-advanced-settings.test.tsx` (bloque US3): sin `vAlign` el `.tpl-text-box` no lleva `align-items` propio (marcado idéntico al anterior); `top` ⇒ `flex-start`, `bottom` ⇒ `flex-end`, `middle` ⇒ sin estilo extra; el inspector marca «Centro» en un texto antiguo; elegir «Arriba» cambia el lienzo y deshacer lo revierte; duplicar el texto conserva `vAlign`
- [ ] T020 [P] [US3] Prueba en `backend/tests/integration/pdf-template-fidelity.test.ts`: caja alta de una línea con los tres anclajes; el borde del texto queda a < 0,5 % de la altura de la caja del borde correspondiente (SC-004) y el PDF coincide con el lienzo; un texto con ajuste automático sigue cabiendo con cualquier anclaje (`print-overflow`)
- [ ] T021 [US3] Prueba de ida y vuelta en `backend/tests/unit/template-schema-008.test.ts` o la de guardado existente: guardar una plantilla con `vAlign: 'bottom'` por la API y recargarla conserva el valor (FR-014)

**Checkpoint**: las tres propiedades existen y se editan por separado.

---

## Phase 6: User Story 4 - Panel «Configuración avanzada» (Priority: P3)

**Goal**: los tres ajustes viven en un panel plegable del inspector de texto, sin repetirse en «Tipografía».

**Independent Test**: seleccionar un texto, ver el panel cerrado, abrirlo (un clic) con los tres ajustes, seleccionar otro texto y comprobar que sigue abierto; una forma no muestra el panel.

- [ ] T022 [US4] En `inspector-fields.ts`: descriptor `{ kind: 'section'; id; label; fields }`; para texto, mover «Altura de línea», «Espaciado» y «Anclaje vertical» a la sección «Configuración avanzada» (orden de `contracts/editor-ui.md` §2) y quitarlos de «Tipografía»
- [ ] T023 [US4] En `FieldRenderer.tsx`: dibujar `section` como cabecera `button` con nombre y `aria-expanded` más la región plegable (cerrada por defecto), pasando `open` y `onToggle` desde `Inspector.tsx`; en `Inspector.tsx` guardar el abierto/cerrado en `useState` del propio `Inspector` (no del `FieldRenderer`, que lleva `key={el.id}`); estilos en `editor.css`
- [ ] T024 [P] [US4] Pruebas en `frontend/tests/text-advanced-settings.test.tsx` (bloque US4): el panel existe y está cerrado; abrirlo muestra los tres ajustes (deslizador + campo numérico + tres botones); ninguno de los tres aparece fuera del panel; seleccionar otro texto conserva el estado abierto; una forma, imagen o insignia no muestra el panel; un texto bloqueado deja los controles deshabilitados con la indicación existente; el resto de controles de texto conserva su orden
- [ ] T025 [US4] Actualizar las pruebas existentes que buscaban «Altura de línea» y «Espaciado» fuera de un panel (por ejemplo en `frontend/tests/template-editor-inspector.test.tsx` y `template-editor-style.test.tsx`): abrir antes el panel

**Checkpoint**: las cuatro historias funcionan.

---

## Phase 7: Polish y verificación final

- [ ] T026 [P] Revisar la tolerancia de rendimiento: cambiar cada ajuste en el editor no vuelve a dibujar otros elementos (`TemplateElement` memorizado) y se ve en < 0,2 s (SC-005); anotar el resultado en `quickstart.md`
- [ ] T027 Ejecutar la línea base byte a byte (`npx tsx tests/fixtures/pdf-baseline.ts`) y `npx vite build`; las 4 plantillas base y `base` deben salir idénticas (SC-001, SC-007, FR-015)
- [ ] T028 Ejecutar los conjuntos completos `npx vitest run` en `backend/` y `frontend/` (los archivos de Chrome que fallen por carga se repiten solos con `--fileParallelism=false`) y `npx tsc --noEmit` en ambos
- [ ] T029 [P] Revisión manual de `quickstart.md` §6 (≈ 3 min) y marcar los resultados en su sección de validación
- [ ] T030 [P] Actualizar el README (editor de plantillas: Configuración avanzada) y `specs/003-catalog-template-editor/spec.md` con una nota breve; marcar lo confirmado y lo no medido (unidad del interletrado de Canva) en `docs/specs/PENDIENTES-REA.md`

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (T003 → T004 → T005; T006 → T007; T008 puede ir en paralelo con T006) → historias.
- **US1 (P1)** depende solo de Phase 2: es el **MVP**.
- **US2** y **US3** dependen de Phase 2 y son independientes entre sí (US2 toca `ls`, US3 toca `vAlign` y `TemplateElement.tsx`); comparten `inspector-fields.ts` y `text-advanced-settings.test.tsx`, así que sus tareas de esos archivos van en orden aunque las historias se puedan probar por separado.
- **US4** depende de US1, US2 y US3 (agrupa sus tres controles).
- **Polish** al final.

## Parallel Opportunities

- T002 con T001; T005 con T006/T008 (archivos distintos).
- Dentro de cada historia, las pruebas de lienzo (`frontend/tests`) y las de Chrome (`backend/tests/integration`) son archivos distintos: T010‖T011, T014‖T015, T019‖T020.
- T026, T029 y T030 en paralelo.

## Implementation Strategy

1. **MVP**: Phase 1 + Phase 2 + US1 (T001–T012): altura de línea libre, la propiedad más usada, sin dato nuevo.
2. **Incremento**: US2 (espaciado) y US3 (anclaje), en cualquier orden.
3. **Cierre**: US4 (panel) reubica los tres controles; luego Polish con la comparación byte a byte.
4. Parar tras cada historia: ejecutar su prueba independiente y `npx vitest run` del paquete tocado.

## Notes

- Ninguna tarea cambia el valor por defecto de la altura de línea (1,05) ni el anclaje por defecto (Centro) (FR-002, FR-008).
- Nunca se copian recursos de Canva (FR-018); solo se usan sus rangos y su organización.
- Resumen: 30 tareas — Setup 2, Foundational 6, US1 4, US2 4, US3 5, US4 4, Polish 5.
