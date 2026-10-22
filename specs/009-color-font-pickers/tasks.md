# Tasks: Selectores de color y de fuente de la plantilla

**Input**: Documentos de diseño de `/specs/009-color-font-pickers/` (plan.md, spec.md, research.md, data-model.md, contracts/picker-ui.md, quickstart.md)

**Prerequisites**: plan.md y spec.md (hechos). Las pruebas **sí** se incluyen: la constitución (V) y el plan piden pruebas escritas junto con el código. Todo el trabajo vive en `frontend/`; no se toca el backend ni el render.

**Formato**: `- [ ] T### [P?] [US?] Descripción con ruta`. `[P]` = se puede hacer en paralelo (archivos distintos, sin depender de una tarea incompleta). `[US#]` = historia de la spec.

**Rutas**: `frontend/src/pages/TemplateEditor/` (editor), `frontend/tests/`, `backend/tests/fixtures/pdf-baseline.ts` (solo para la comparación de PDFs).

## Phase 1: Setup (comprobación de partida)

- [X] T001 Reconstruir `frontend/dist` (`npx vite build` en `frontend/`) y capturar la línea base de PDFs **antes de tocar código**: `BASELINE_DIR=<carpeta en el directorio temporal de la sesión> npx tsx tests/fixtures/pdf-baseline.ts capture` en `backend/` (8 PDF: 4 plantillas × normal y largo); anotar la carpeta y el commit de partida en `specs/009-color-font-pickers/quickstart.md` §1
- [X] T002 [P] Listar con `grep` las pruebas existentes que dependen de los cuadritos de color o de la lista de fuentes (`Acento 1`, `Texto de la paleta`, `Color personalizado`, `Transparente`, `Ninguno`, `getByLabelText('Fuente')`, grupos `Relleno`, `Contorno`, `Resplandor neón`) en `frontend/tests/template-editor-inspector.test.tsx`, `template-editor-style.test.tsx`, `template-editor-keyboard.test.tsx` y `text-advanced-settings.test.tsx`; dejar la lista como comentario de T012 (no tocarlas aún)

---

## Phase 2: Foundational (bloquea las historias)

**Propósito**: los cálculos puros, el panel anclado y el historial sin cambio. Ninguna historia puede cerrarse sin esto.

- [X] T003 [P] Módulo puro `frontend/src/pages/TemplateEditor/template-colors.ts`: `normalizeHex` (`#` opcional, 3 o 6 dígitos, mayúsculas; `null` si no es válido), `foldText` (minúsculas y sin diacríticos), `BASIC_COLORS` (los diez de `data-model.md`), `usedColors(template)` (recorre `pages[*].bg` y `pages[*].els[*]`, reúne todo valor `#RRGGBB` salvo las claves `text`, `name`, `id` y `src`; normaliza, quita lo que coincide con la paleta y no repite; orden de primer uso), `colorOptions(template, { none })` y `searchColors(options, query)`
- [X] T004 [P] Módulo puro `frontend/src/pages/TemplateEditor/template-fonts.ts`: `usedFonts(template)` (familias de la propiedad `font` de textos e insignias de todas las páginas, sin repetir), `fontChoices(template)` («Título · …», «Cuerpo · …», familias usadas y las seis) y `searchFonts(options, query)` (sin distinguir mayúsculas ni tildes)
- [X] T005 [P] Pruebas nuevas en `frontend/tests/template-colors.test.ts` (las de fuentes viven en el mismo archivo): `e91e8c`, `#E91E8C`, `#e91` ⇒ el mismo `#E91E8C`/`#EE9911`; `#12` y `zzz` ⇒ `null`; `#abc` ≡ `#AABBCC` sin repetir; un libre igual a un color de la paleta no aparece como libre; orden de primer uso; un texto libre que contiene `#E91E8C` no se cuenta; plantilla sin libres ⇒ solo la paleta; búsqueda sin mayúsculas ni tildes («Ámbar» ≡ «ambar»); las fuentes usadas no se repiten y la búsqueda filtra por nombre
- [X] T006 En `frontend/src/pages/TemplateEditor/useTemplateEditor.ts`: generalizar el descarte de parches sin cambio (hoy solo `settleText` para textos) a **todos los elementos** (comparar por valor las claves del parche con el elemento; los textos siguen usando los valores por defecto) y a `patchBg` (un parche idéntico al fondo actual devuelve el mismo estado, sin historial); el parche con `record: false` y los del bloque de productos con aviso no cambian de comportamiento
- [X] T007 [P] Pruebas del reductor en `frontend/tests/template-editor-reducer.test.ts` (bloque nuevo «parche sin cambio (feature 009)»): un parche idéntico en una forma, una insignia, el bloque de productos y el fondo no agrega paso ni vacía el rehacer; uno distinto sí; un arrastre (misma clave) sigue siendo un solo paso
- [X] T008 [P] Componente `frontend/src/pages/TemplateEditor/Popover.tsx` (contrato §2): portal en `document.body`, `role="dialog"` con `aria-label`, `position: fixed` junto al ancla (a la izquierda del inspector, acotado al alto de la ventana), encabezado con título y botón «Cerrar», cierre con Escape y con clic fuera, y al cerrar devuelve el foco al ancla; estilos base en `editor.css`
- [X] T009 [P] Pruebas nuevas `frontend/tests/popover.test.tsx`: se abre junto al ancla, Escape lo cierra y devuelve el foco, el clic fuera lo cierra, el botón «Cerrar» lo cierra, no se cierra al hacer clic dentro

**Checkpoint**: cálculos, historial y `Popover` listos; T005, T007 y T009 en verde.

---

## Phase 3: User Story 1 - Reutilizar los colores que la plantilla ya usa (Priority: P1) 🎯 MVP

**Goal**: cada propiedad de color abre un selector con «Colores de la plantilla» (paleta + libres usados, sin repetir) y se elige con un clic, sin cambiar el formato guardado.

**Independent Test**: en una plantilla con dos colores libres en distintos elementos, abrir el selector de color de un tercer elemento, ver ambos en «Colores de la plantilla» y aplicar uno con un clic.

- [X] T010 [US1] Componente `frontend/src/pages/TemplateEditor/ColorPicker.tsx` (contrato §3, sin buscador ni cuentagotas todavía): contenedor `role="group"` con la etiqueta del campo, botón-muestra (`aria-haspopup="dialog"`, `aria-expanded`, nombre «\<campo\>: \<color activo\>»), panel con el grupo «Colores de la plantilla» (botones con `aria-pressed`; hasta 18 libres y «Ver todos (N)»), grupo «Colores básicos», botón «Ninguno» o «Transparente» solo si el campo lo tiene, el `input type="color"` «Color personalizado» (con `mergeKey = key`) y región `role="status"` «Color activo: …»; elegir una clave de la paleta guarda la clave, cualquier otro guarda `#RRGGBB` en mayúsculas
- [X] T011 [US1] Cablear en `frontend/src/pages/TemplateEditor/FieldRenderer.tsx` y `Inspector.tsx`: `ColorField` pasa a usar `ColorPicker` (recibe la plantilla para `colorOptions`; el fondo de la página también), se retira el bloque de cuadritos, y con `locked` el botón queda deshabilitado con el título «Desbloquea el elemento para cambiar este ajuste» (FR-019); estilos en `editor.css`
- [X] T012 [P] [US1] Pruebas nuevas `frontend/tests/color-picker.test.tsx` (bloque US1): plantilla con dos libres ⇒ «Colores de la plantilla» muestra la paleta y ambos sin repetir; elegir uno de la paleta guarda la clave; elegir un libre guarda `#RRGGBB` mayúsculas con un paso de deshacer; elegir el activo no agrega paso; el activo lleva `aria-pressed`; «Ninguno»/«Transparente» siguen y se marcan; el selector gráfico sigue disponible y arrastrar es un solo paso; más de 18 libres ⇒ «Ver todos (N)»; elemento bloqueado ⇒ botón deshabilitado; cambiar la paleta actualiza la muestra
- [X] T013 [US1] Actualizar las pruebas existentes de la lista de T002 que buscaban cuadritos o `Color personalizado` dentro de un grupo (`template-editor-inspector`, `template-editor-style`, `template-editor-keyboard`, `text-advanced-settings`): abrir antes el selector con el botón del grupo, sin debilitar lo que comprueban; revisar `frontend/src/pages/TemplateEditor/panels/EstiloPanel.tsx` (la paleta de la plantilla conserva sus campos hexadecimales, no se toca)

**Checkpoint**: US1 completa y probada por sí sola (mínimo entregable).

---

## Phase 4: User Story 2 - Buscar un color por nombre o por código (Priority: P2)

**Goal**: un buscador acepta código hexadecimal o parte del nombre, y un código inválido nunca cambia el color.

**Independent Test**: escribir `e91e8c`, `#E91E8C`, `#e91`, `#12`, `zzz` y «acento», y comprobar el resultado de cada caso.

- [X] T014 [US2] En `frontend/src/pages/TemplateEditor/ColorPicker.tsx`: buscador `input type="search"` «Buscar color por nombre o código»; un código válido muestra la muestra y el botón «Aplicar \<código\>» (Enter lo aplica y cierra el panel); un código inválido muestra «El código de color no es válido» en la región `role="status"` y no cambia nada; un nombre filtra los colores de la paleta y los básicos (sin mayúsculas ni tildes); sin coincidencias ⇒ «No hay colores con ese nombre» y «Limpiar búsqueda»; el texto se limpia al cerrar
- [X] T015 [P] [US2] Pruebas en `frontend/tests/color-picker.test.tsx` (bloque US2): `e91e8c`, `#E91E8C` y `#e91` + Enter aplican el color (un paso); `#12` y `zzz` + Enter muestran el mensaje y conservan el color; «acento» y «azul» filtran; «Ámbar»/«AMBAR» sin tildes ni mayúsculas; búsqueda sin resultados ⇒ mensaje y «Limpiar búsqueda» restaura la lista; cerrar y reabrir limpia el buscador

**Checkpoint**: US1 y US2 funcionan; el formato guardado no cambió.

---

## Phase 5: User Story 3 - Elegir la fuente viéndola (Priority: P2)

**Goal**: cada familia se muestra con su propia tipografía, con marca en la activa, buscador y «Fuentes de la plantilla» primero.

**Independent Test**: abrir el selector de fuente de un texto, ver las seis familias en su tipografía, la activa con marca, y cambiar con un clic.

- [X] T016 [US3] Componente `frontend/src/pages/TemplateEditor/FontPicker.tsx` (contrato §4): botón «Fuente: \<activa\>» escrito en su tipografía (`FONT_STACKS`), panel con buscador «Buscar fuente», grupo «Fuentes de la plantilla» («Título · …», «Cuerpo · …» y las usadas) y «Todas las fuentes» (las seis); cada opción es un botón con `aria-pressed`, el nombre con `style.fontFamily` de su pila y `data-check` en la activa; «Título»/«Cuerpo» se marcan solo si el elemento guarda esa referencia y guardan `title`/`body`; sin resultados ⇒ «No hay fuentes con ese nombre» y «Limpiar búsqueda»
- [X] T017 [US3] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` y `FieldRenderer.tsx`: nuevo descriptor `{ kind: 'font'; key; label }` que reemplaza los dos `select` de fuente (texto e insignia) y se dibuja con `FontPicker` (con `locked` deshabilitado, igual que el color); retirar `fontOptions` de `inspector-fields.ts` si queda sin uso (mantener `FONT_LABELS`); estilos en `editor.css`
- [X] T018 [P] [US3] Pruebas nuevas `frontend/tests/font-picker.test.tsx`: las seis familias con su `fontFamily`, la activa con marca; orden «Fuentes de la plantilla» antes de «Todas las fuentes»; elegir «Título»/«Cuerpo» guarda `title`/`body`; elegir una familia la guarda; elegir la activa no agrega paso; «zen» y «DM» filtran sin mayúsculas ni tildes y sin resultados ⇒ mensaje; las insignias usan el mismo selector; bloqueado ⇒ deshabilitado
- [X] T019 [US3] Actualizar las pruebas existentes que usaban `getByLabelText('Fuente')` como `<select>` (por ejemplo la que lista las opciones «Título · Fredoka»… en `frontend/tests/template-editor-inspector.test.tsx`): abrir el selector y comprobar las mismas opciones por botones

**Checkpoint**: US1, US2 y US3 funcionan.

---

## Phase 6: User Story 4 - Cuentagotas (Priority: P3)

**Goal**: cuando el navegador lo permite, tomar un color de la pantalla y aplicarlo; si no, el botón no aparece.

**Independent Test**: con `window.EyeDropper` simulado, tomar un color y comprobar que se aplica; sin él, comprobar que no hay botón.

- [X] T020 [US4] En `frontend/src/pages/TemplateEditor/ColorPicker.tsx`: botón «Cuentagotas» solo si `'EyeDropper' in window`; `new EyeDropper().open()` devuelve `{ sRGBHex }`, que se normaliza y se aplica como color libre (un paso); un rechazo o `AbortError` (Escape) se ignora y conserva el color anterior
- [X] T021 [P] [US4] Pruebas en `frontend/tests/color-picker.test.tsx` (bloque US4) con un `EyeDropper` simulado: sin él no hay botón y nada más cambia; con él, el color tomado se guarda en mayúsculas como `#RRGGBB`; si el doble rechaza con `AbortError` el color anterior se conserva y no hay paso nuevo

**Checkpoint**: las cuatro historias funcionan.

---

## Phase 7: Polish y verificación final

- [X] T022 [P] Teclado y accesibilidad (FR-018, SC-007): pruebas en `frontend/tests/color-picker.test.tsx` y `font-picker.test.tsx` de abrir con Enter o Espacio (el foco va al buscador), recorrer con Tab, aplicar con Enter, cerrar con Escape y que el foco vuelva al botón; el nombre del botón y la región `role="status"` anuncian el valor activo; recorrer cada tipo de elemento (texto, insignia, forma, imagen no tiene color, introducción, productos, políticas, pie)
- [X] T023 [P] Recorrer **cada propiedad de color y de fuente de cada tipo de elemento** (SC-005) con una prueba que, para cada descriptor `color` y `font` de `fieldsFor`, comprueba que el selector ofrece los colores y fuentes de antes (seis de la paleta, libre, «Ninguno»/«Transparente» donde el descriptor las trae, las seis familias) en `frontend/tests/color-picker.test.tsx`
- [X] T024 Ejecutar la línea base byte a byte: `BASELINE_DIR=<carpeta de T001> npx tsx tests/fixtures/pdf-baseline.ts compare` tras `npx vite build`; las 8 salidas deben ser **idénticas** (SC-001, FR-017); comprobar además que abrir y guardar de nuevo una plantilla no cambia ningún color ni fuente guardados (SC-008) con una prueba de ida y vuelta en `frontend/tests/template-editor-save.test.tsx`
- [X] T025 Ejecutar los conjuntos completos `npx vitest run` en `frontend/` y `backend/` (los archivos de Chrome que fallen por carga se repiten solos con `--fileParallelism=false`) y `npx tsc --noEmit` en ambos
- [X] T026 [P] Medir que abrir cada selector con una plantilla cargada tarda < 0,2 s (SC-006) con una prueba que mide el cálculo de `usedColors` sobre una plantilla de 200 elementos; anotar el resultado en `quickstart.md`
- [ ] T027 [P] Revisión manual de `quickstart.md` §7 (≈ 5 min) si hay una persona disponible, y marcar los resultados en su sección de validación
- [X] T028 [P] Actualizar el README (editor de plantillas: selectores de color y de fuente, cuentagotas, y que un elemento bloqueado deshabilita los selectores), la nota en `specs/003-catalog-template-editor/spec.md` y `docs/specs/PENDIENTES-REA.md` (lo cerrado por la 009 y lo no medido: medidas en píxeles de los controles y la pestaña «Estilo» de la fuente)

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (T003 ‖ T004 ‖ T008; T005 tras T003 y T004; T006 → T007; T009 tras T008) → historias.
- **US1 (P1)** depende solo de Phase 2: es el **MVP**. T010 → T011 → T012/T013.
- **US2** depende de US1 (el buscador vive en `ColorPicker`).
- **US3** depende de Phase 2 y es independiente de US1 y US2 (otro componente), pero comparte `FieldRenderer.tsx`, `inspector-fields.ts` y `editor.css` con US1, así que esas tareas van en orden.
- **US4** depende de US1 (añade un botón a `ColorPicker`) y comparte archivo con US2: va después de T014.
- **Polish** al final; T024 necesita la línea base de T001.

## Parallel Opportunities

- T002 con T001; T003 ‖ T004 ‖ T008 (archivos distintos); T005 ‖ T007 ‖ T009.
- US1 y US3 pueden avanzar a la vez en sus componentes (`ColorPicker.tsx` y `FontPicker.tsx`); las pruebas `color-picker.test.tsx` y `font-picker.test.tsx` son archivos distintos: T012 ‖ T018.
- T022, T023, T026, T027 y T028 en paralelo.

## Implementation Strategy

1. **MVP**: Phase 1 + Phase 2 + US1 (T001–T013): reutilizar los colores de la plantilla, la mayor ganancia de coherencia, sin dato nuevo.
2. **Incrementos**: US2 (buscador de color) y US3 (selector de fuente), en cualquier orden; US4 (cuentagotas) al final.
3. **Cierre**: Polish con la comparación byte a byte y el recorrido de todas las propiedades.
4. Parar tras cada historia: ejecutar su prueba independiente y `npx vitest run` del frontend.

## Notes

- Ninguna tarea cambia el formato guardado de `ColorRef` ni de `FontRef`, ni el render (FR-004, FR-013, FR-016).
- Los selectores se deshabilitan con el elemento bloqueado (FR-019); hoy esos campos sí se pueden editar con el elemento bloqueado, así que es un cambio de comportamiento pedido por la spec.
- Nunca se copian recursos de Canva (FR-020); solo se usan sus patrones y medidas de organización.
- Resumen: 28 tareas — Setup 2, Foundational 7, US1 4, US2 2, US3 4, US4 2, Polish 7.
