# Tasks: Alinear a la página, altura de línea y tachado en el editor de plantillas

**Input**: Documentos de diseño en `/specs/007-editor-align-text-tools/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/editor-actions.md](./contracts/editor-actions.md), [quickstart.md](./quickstart.md). Requiere las features 001–006 funcionando (`npm test` en verde antes de empezar) y la constitución en v1.1.0 (no hace falta enmendarla).

**Tests**: Incluidos. La constitución (principio V) exige pruebas sobre cada regla, y FR-013/FR-015 solo se pueden asegurar con pruebas de fidelidad y regresión. Escribe cada prueba **antes** de su implementación y comprueba que falla.

**Organization**: Tareas agrupadas por historia de usuario. **US1 (alinear) es el MVP** y no depende de la fase 2. US2 (altura de línea) y US3 (tachado) dependen de la fase 2 y son independientes entre sí, aunque tocan los mismos archivos (`TemplateElement.tsx`, `inspector-fields.ts`); por eso sus tareas de esos archivos no llevan [P] entre historias.

**Dependencias nuevas**: ninguna (plan.md, Technical Context).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1..US3)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

Aplicación web: `backend/src/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (ver [plan.md](./plan.md)). El modelo compartido vive en `backend/src/catalog/template.ts` y el frontend lo importa por ruta relativa. Los valores por defecto de `lh` y `strike` existen en **un solo lugar** (`TEXT_DEFAULTS`); nada más debe escribir `1.05` ni asumir `false`.

---

## Phase 1: Setup

**Purpose**: Dejar la referencia contra la que se comprueba que nada existente cambió (SC-003).

- [X] T001 Capturar la **línea base** antes de tocar el render: con `backend/tests/fixtures/visual-sample.ts` generar el PDF de cada una de las 4 plantillas base (`neon`, `pop`, `kawaii`, `kraft`) con textos normales y con `LONG=1`, y guardarlos en `specs/007-editor-align-text-tools/visual/baseline/` (ver quickstart, Prerrequisitos)
- [X] T002 Ejecutar `npm test` y `npm run lint` en la raíz y anotar en `specs/007-editor-align-text-tools/visual/baseline/README.md` que partían en verde (fecha y conteo de pruebas)

---

## Phase 2: Foundational (Blocking Prerequisites para US2 y US3)

**Purpose**: Las dos propiedades opcionales del texto en el modelo y en la validación del servidor (research §1, data-model.md).

**⚠️ CRITICAL**: US2 y US3 no pueden empezar hasta terminar esta fase. US1 no la necesita.

- [X] T003 [P] En `backend/tests/integration/templates.test.ts` agregar pruebas que fallen: (a) guardar un texto con `lh: 1.4` y `strike: true` y releerlo con `GET /api/settings/templates` devuelve los mismos valores; (b) guardar una plantilla cuyos textos no tienen `lh` ni `strike` no los agrega al releer; (c) `lh: 3`, `lh: 0.5`, `lh: "1.2"` y `strike: "sí"` responden `422 invalid_templates` con `details[].field` terminado en `.lh` o `.strike` y los mensajes de [contracts/editor-actions.md](./contracts/editor-actions.md) §1, sin cambiar plantillas, negocio ni revisión
- [X] T004 En `backend/src/catalog/template.ts` agregar `lh: [0.8, 2.5]` a `RANGES`, los campos opcionales `lh?: number` y `strike?: boolean` a `TextEl` (con comentario JSDoc de su valor por defecto) y exportar `TEXT_DEFAULTS = { lh: 1.05, strike: false } as const`
- [X] T005 En `backend/src/catalog/template.schema.ts` agregar a `textEl`: `lh: num(RANGES.lh, 'La altura de línea').optional()` y `strike: z.boolean({ error: 'Debe ser verdadero o falso.' }).optional()`; comprobar que T003 pasa (sin esto zod borra los campos al guardar, research §1)
- [X] T006 Confirmar que `draftText` en `backend/src/catalog/template-presets.ts` **no** escribe `lh` ni `strike` (data-model.md: los textos nuevos heredan los valores por defecto por el mismo camino que los viejos) y que `npm run typecheck -w backend` y `npm run build -w frontend` compilan

**Checkpoint**: el documento acepta, valida y conserva `lh` y `strike`; nada cambia en pantalla todavía.

---

## Phase 3: User Story 1 - Alinear un elemento a la página (Priority: P1) 🎯 MVP

**Goal**: Seis botones en el inspector que pegan el elemento seleccionado a un borde de la hoja o lo centran, con un paso de deshacer por clic.

**Independent Test**: en Portada, seleccionar un título y pulsar las seis acciones; la posición cumple la tabla de data-model.md; deshacer vuelve atrás en un paso; un elemento bloqueado tiene los botones deshabilitados; guardar, recargar y generar conserva la posición (quickstart, escenarios 1 y 2).

### Tests for User Story 1 ⚠️

- [ ] T007 [P] [US1] En `frontend/tests/template-editor-reducer.test.ts` agregar pruebas que fallen para `alignBox` (las seis direcciones con un elemento `x 10, y 20, w 30, h 40`; un elemento con `w 120` a la izquierda da `x 0`; resultados acotados por `clampBox`) y para la acción `align`: solo cambia `x` o `y`; bloqueado → mismo objeto de estado; elemento inexistente → mismo objeto; posición ya alineada → mismo objeto y sin paso nuevo; dos alineaciones seguidas → dos pasos en `past`; deshacer y rehacer restauran `x`/`y`; funciona en un bloque automático desbloqueado
- [ ] T008 [P] [US1] En `frontend/tests/template-editor-inspector.test.tsx` agregar pruebas que fallen: con un elemento seleccionado aparece el grupo `role="group"` "Alinear a la página" con los seis botones y los `aria-label` de [contracts/editor-actions.md](./contracts/editor-actions.md) §2 en ese orden; "Centrar horizontalmente" cambia el campo X del inspector a `(100 − Ancho) / 2`; con el elemento bloqueado los seis tienen `disabled` y el `title` "Desbloquea el elemento para alinearlo"; sin selección el grupo no existe

### Implementation for User Story 1

- [ ] T009 [US1] En `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` exportar `type AlignEdge` y la función pura `alignBox(el, edge): { x } | { y }` según la tabla de data-model.md, usando `clampBox` y el mismo redondeo que el resto de posiciones
- [ ] T010 [US1] En `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` agregar `{ type: 'align'; id; edge; now }` a `EditorAction`, su `case 'align'` en `editorReducer` (postcondiciones 1–4 del contrato §3: bloqueado, inexistente o sin cambio devuelven `s`; si no, `record(s, null, action.now)` y parche de `x` o `y` vía `withPage`) y `align: (id, edge) => dispatch({ type: 'align', id, edge, now: Date.now() })` en `actions`; comprobar que T007 pasa
- [ ] T011 [P] [US1] Crear `frontend/src/pages/TemplateEditor/AlignActions.tsx`: recibe `el` y `onAlign(edge)`, dibuja `role="group"` con `aria-label="Alinear a la página"` y seis `<button type="button">` con los `aria-label` del contrato y un ícono SVG en línea (`aria-hidden`, `currentColor`, 16 px) por botón; con `el.locked` todos llevan `disabled` y `title="Desbloquea el elemento para alinearlo"`
- [ ] T012 [P] [US1] En `frontend/src/pages/TemplateEditor/editor.css` agregar `.ed-align` (fila de seis botones cuadrados con `gap: 4px`, borde `var(--ed-line)`, radio 8 px, hover y `:disabled` con opacidad reducida y `cursor: not-allowed`), siguiendo el estilo de `.ed-actions`
- [ ] T013 [US1] En `frontend/src/pages/TemplateEditor/Inspector.tsx` montar `<AlignActions el={el} onAlign={(edge) => actions.align(el.id, edge)} />` justo después de `.ed-actions` y antes del aviso de desbordamiento; comprobar que T008 pasa

**Checkpoint**: US1 funciona y se puede entregar sola (quickstart, escenarios 1 y 2).

---

## Phase 4: User Story 2 - Ajustar la altura de línea de un texto (Priority: P2)

**Goal**: Control "Altura de línea" (0,8–2,5) en la sección Tipografía, visible al instante en lienzo, vista previa y PDF; por defecto 1,05.

**Independent Test**: un texto de tres líneas cambia su separación al deslizar el control; deshacer vuelve en un paso; un texto sin `lh` muestra 1,05 y se dibuja igual que antes (quickstart, escenario 3).

### Tests for User Story 2 ⚠️

- [ ] T014 [P] [US2] En `frontend/tests/template-page.test.tsx` agregar pruebas que fallen: un texto sin `lh` tiene `line-height: 1.05` (igual que hoy); con `lh: 1.6` tiene `line-height: 1.6`; un texto con datos insertables (`{telefonos}`) también recibe `lh`
- [ ] T015 [P] [US2] En `frontend/tests/template-editor-inspector.test.tsx` agregar pruebas que fallen: un texto muestra el control "Altura de línea" después de "Espaciado" con mínimo 0.8, máximo 2.5 y paso 0.05; en un texto sin `lh` el control muestra 1.05; moverlo actualiza el `line-height` del texto en el lienzo; varios cambios del deslizador dentro de 800 ms se deshacen en un solo paso (FR-009)

### Implementation for User Story 2

- [ ] T016 [US2] En `frontend/src/print/TemplateElement.tsx`, en `textStyle`, reemplazar `lineHeight: 1.05` por `lineHeight: el.lh ?? TEXT_DEFAULTS.lh` (importado de `backend/src/catalog/template`) y agregar `el.lh` a la lista de dependencias de `useFit` en `FitText` (research §2); comprobar que T014 pasa
- [ ] T017 [US2] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` agregar al descriptor `range` un campo opcional `fallback?: number` y, en el caso `text` de `ownFields`, `{ ...range('lh', 'Altura de línea', RANGES.lh, 0.05, ''), fallback: TEXT_DEFAULTS.lh }` justo después de `range('ls', …)`
- [ ] T018 [US2] En `frontend/src/pages/TemplateEditor/FieldRenderer.tsx` hacer que `RangeField` use `desc.fallback` cuando `value` es `undefined`, y que el valor mostrado de `lh` tenga dos decimales; comprobar que T015 pasa

**Checkpoint**: US2 funciona sola sobre la fase 2; US1 sigue en verde.

---

## Phase 5: User Story 3 - Tachar un texto (Priority: P3)

**Goal**: Interruptor "Tachado" que atraviesa todo el texto con una línea del color del relleno, compatible con contorno, resplandor y mayúsculas.

**Independent Test**: "$25.000" con Tachado activado muestra la línea, también en cada línea de un texto multilínea; desactivar o deshacer la quita (quickstart, escenario 4).

### Tests for User Story 3 ⚠️

- [ ] T019 [P] [US3] En `frontend/tests/template-page.test.tsx` agregar pruebas que fallen: un texto sin `strike` no tiene `text-decoration-line`; con `strike: true` tiene `line-through`; con `strike: true`, contorno, resplandor y `upper` conserva `-webkit-text-stroke`, `text-shadow` y `text-transform: uppercase`
- [ ] T020 [P] [US3] En `frontend/tests/template-editor-inspector.test.tsx` agregar pruebas que fallen: un texto muestra el interruptor "Tachado" (`role="switch"`) después de "Mayúsculas", apagado si no hay `strike`; activarlo pone `line-through` en el lienzo; deshacer lo quita

### Implementation for User Story 3

- [ ] T021 [US3] En `frontend/src/print/TemplateElement.tsx`, en `textStyle`, agregar `textDecorationLine: (el.strike ?? TEXT_DEFAULTS.strike) ? 'line-through' : undefined` (color por defecto = color del texto, research §3); comprobar que T019 pasa
- [ ] T022 [US3] En `frontend/src/pages/TemplateEditor/inspector-fields.ts`, en el caso `text` de `ownFields`, agregar `{ kind: 'toggle', key: 'strike', label: 'Tachado' }` justo después del toggle de Mayúsculas; comprobar que T020 pasa

**Checkpoint**: las tres historias funcionan juntas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T023 En `backend/tests/integration/pdf-template-fidelity.test.ts` medir en Chrome real, además de lo que ya mide, `lineHeight` y `textDecorationLine` de los textos; agregar un caso con una plantilla que tenga un texto multilínea con `lh: 1.6` y `strike: true` y comprobar que la vista de impresión coincide con el documento, incluidos el alto medido y que hay `line-through` (FR-013, SC-004)
- [ ] T024 Regenerar con `backend/tests/fixtures/visual-sample.ts` los PDF de las 4 plantillas base y compararlos con `specs/007-editor-align-text-tools/visual/baseline/` página a página (texto con `pdf-parse` y captura por página); registrar el resultado en `specs/007-editor-align-text-tools/visual/README.md`: sin diferencias (SC-003, FR-015)
- [ ] T025 [P] Actualizar el texto de ayuda de atajos en `frontend/src/pages/TemplateEditor/Inspector.tsx` (`.ed-tip`) solo si hiciera falta mencionar la alineación; si no aporta, dejarlo como está y anotarlo en la tarea
- [ ] T026 [P] Marcar en `docs/specs/canva-fields-inventory.md` (sección 6) los ítems 1–3 como implementados en la feature 007, y en la tabla de la sección 3 cambiar "Alinear a la página", "Altura de línea" y "Tachado" a ✅
- [ ] T027 Ejecutar `npm test`, `npm run test:pdf`, `npm run lint` y `npm run build` en la raíz; recorrer a mano los escenarios 1–6 de [quickstart.md](./quickstart.md); confirmar que `package.json` no ganó dependencias

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (fase 1)**: sin dependencias. **T001 va antes de cualquier cambio de render** (T016, T021).
- **Foundational (fase 2)**: depende de la fase 1. Bloquea US2 y US3.
- **US1 (fase 3)**: depende solo de la fase 1. Puede ir en paralelo con la fase 2.
- **US2 (fase 4)** y **US3 (fase 5)**: dependen de la fase 2.
- **Polish (fase 6)**: depende de las historias que se entreguen. T023 necesita US2 y US3; T024 necesita todas.

### User Story Dependencies

- **US1**: independiente (no toca el modelo de datos).
- **US2** y **US3**: independientes en comportamiento, pero comparten `TemplateElement.tsx`, `inspector-fields.ts` y los mismos archivos de prueba. Hacerlas en serie (US2 → US3) o coordinar los cambios en esos archivos.

### Within Each User Story

- Pruebas primero (deben fallar), después la implementación, y comprobar que pasan.
- US1: `alignBox` (T009) → acción y hook (T010) → componente y estilos (T011, T012) → montaje (T013).
- US2/US3: render (T016/T021) → inspector (T017–T018/T022).

### Parallel Opportunities

- Fase 2 (T003–T006) en paralelo con US1 (T007–T013): archivos distintos.
- Dentro de US1: T007 ∥ T008; T011 ∥ T012.
- Dentro de US2: T014 ∥ T015. Dentro de US3: T019 ∥ T020.
- Polish: T025 ∥ T026.

---

## Parallel Example: User Story 1

```text
# Pruebas de US1 a la vez (archivos distintos):
T007 frontend/tests/template-editor-reducer.test.ts   (alignBox y acción align)
T008 frontend/tests/template-editor-inspector.test.tsx (botones y deshabilitado)

# Tras T010, componente y estilos a la vez:
T011 frontend/src/pages/TemplateEditor/AlignActions.tsx
T012 frontend/src/pages/TemplateEditor/editor.css
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Fase 1 (línea base).
2. Fase 3 (US1) completa.
3. **Parar y validar**: quickstart escenarios 1 y 2, `npm test`. Se puede entregar: no toca el modelo de datos ni el render.

### Incremental Delivery

1. Línea base → US1 (MVP).
2. Fase 2 → US2 → validar escenario 3 y la regresión de las 4 plantillas base.
3. US3 → validar escenario 4.
4. Polish: fidelidad en Chrome real (T023), regresión visual (T024) y quickstart completo (T027).

### Notas

- Un commit por tarea o por grupo lógico.
- No escribir `1.05` ni asumir `false` fuera de `TEXT_DEFAULTS` (T004).
- Si una prueba de regresión visual (T024) muestra cualquier diferencia, es un error: los valores por defecto deben reproducir el render actual.

---

## Cobertura de requisitos

| Requisito | Tareas |
| --- | --- |
| FR-001, FR-002 | T007, T009, T011, T013 |
| FR-003 | T007, T008, T010, T011 |
| FR-004 | T007, T010 |
| FR-005 | T007, T009 |
| FR-006, FR-007 | T004, T015, T017, T018 |
| FR-008 | T004, T006, T014, T016 |
| FR-009 | T015 |
| FR-010 | T004, T020, T022 |
| FR-011, FR-012 | T019, T021 |
| FR-013 | T016, T021, T023 |
| FR-014 | T003, T005 |
| FR-015 | T001, T003, T024 |
| FR-016 | T003, T005 |
| SC-001, SC-002 | T007, T008, T027 |
| SC-003 | T001, T024 |
| SC-004 | T023 |
| SC-005, SC-006 | T027 (quickstart escenarios 3 y 4) |
