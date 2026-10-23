# Tasks: Sombra y fondo del texto, y estilos de texto predeterminados

**Input**: `specs/011-text-shadow-background/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Prerrequisitos**: plan.md y spec.md. Pruebas incluidas (constitución V: reglas probadas junto con el código).

**Rutas**: `backend/src/catalog/` (modelo y esquema), `frontend/src/print/` (render), `frontend/src/pages/TemplateEditor/` (editor), `frontend/tests/` y `backend/tests/`.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencia pendiente)
- **[Story]**: historia de usuario a la que sirve (US1 sombra, US2 fondo, US3 subtítulo)

---

## Fase 1: Preparación

- [X] T001 Reconstruir `frontend/dist` (`npx vite build` en `frontend/`) y capturar la línea base de PDFs **antes de tocar código**: `BASELINE_DIR=<carpeta en el directorio temporal de la sesión> npx tsx tests/fixtures/pdf-baseline.ts capture` en `backend/` (8 PDF: 4 plantillas × normal y largo); anotar la carpeta y el commit de partida en `specs/011-text-shadow-background/quickstart.md` §1 (hecho: 8 PDF capturados el 2026-10-22 con el commit `98fd89a`)

---

## Fase 2: Fundamentos (bloquea las tres historias)

**Meta**: el modelo acepta, guarda y valida los campos nuevos y existen los cálculos puros del render.

- [X] T002 En `backend/src/catalog/template.ts` agregar a `TextEl` los once campos opcionales de `data-model.md` (`shadow`, `shDist`, `shAngle`, `shBlur`, `shAlpha`, `shColor`, `bg`, `bgRadius`, `bgPad`, `bgAlpha`, `bgColor`), los rangos nuevos en `RANGES` (`shDist`, `shAngle`, `shBlur`, `alpha`, `bgRadius`, `bgPad`) y la constante `TEXT_EFFECT_DEFAULTS` con los valores por defecto
- [X] T003 En `backend/src/catalog/template.schema.ts` declarar los once campos como `.optional()` con `num(RANGES.x, 'El …')` y `colorRef`, con mensajes en el mismo estilo que `lh` y `vAlign` (si no se declaran, `z.object` los descarta al guardar)
- [X] T004 [P] Prueba `backend/tests/unit/template-schema-011.test.ts`: una plantilla sin los campos se acepta; los once campos sobreviven a validar y leer; valores fuera de rango (`shBlur: 99`, `bgAlpha: -1`, `shAngle: 200`) y colores inválidos se rechazan con su mensaje; un parámetro guardado con el interruptor apagado se conserva
- [X] T005 [P] Crear `frontend/src/print/text-effects.ts` con funciones puras: `withAlpha(color, pct)` (`#RRGGBB` → `rgba(...)`; `transparent`, `#RGB` e inválidos devuelven `transparent` sin fallar), `shadowCss(el, palette)` (ángulo y distancia → `dx dy blur color`, medidas escaladas con `--fit`) y `bgStyle(el, palette)` (fondo, relleno, esquinas y `box-decoration-break: clone`); ambas leen `TEXT_EFFECT_DEFAULTS` para lo que falte
- [X] T006 [P] Prueba `frontend/tests/text-effects.test.ts`: `withAlpha('#FF0000', 50)` da `rgba(255,0,0,0.5)`; ángulo 0 → `dx = dist, dy = 0`, ángulo 90 → `dx ≈ 0, dy = dist`; sin `shadow` ni `bg` las funciones devuelven `undefined`; valores por defecto aplicados cuando falta un parámetro

**Punto de control**: `npx vitest run` en backend y frontend sin regresiones.

---

## Fase 3: Historia 1 — Sombra del texto (P1) 🎯 MVP

**Meta**: dar sombra a un texto, ajustarla y verla igual en lienzo y PDF.

**Prueba independiente**: texto sobre una foto → «Sombra» → cambiar cada parámetro → guardar, recargar, generar el PDF.

- [X] T007 [P] [US1] Prueba `frontend/tests/text-shadow-background.test.tsx` (sección sombra): sin `shadow` el estilo del texto no cambia (mismo `textShadow` que hoy, con y sin resplandor); con `shadow` aparece la sombra después del resplandor; con el color transparente o `shAlpha` 0 no falla
- [X] T008 [US1] En `frontend/src/print/TemplateElement.tsx` (`textStyle`) combinar el resplandor y la sombra en un único `textShadow` usando `shadowCss`; sin `shadow` el valor debe ser idéntico al actual (depende de T005)
- [X] T009 [US1] En `frontend/src/pages/TemplateEditor/inspector-fields.ts`, sección «Color y efectos» del texto: interruptor «Sombra» y, si está activo, deslizador + campo numérico para distancia, ángulo, desenfoque y transparencia, y selector de color; los valores faltantes se muestran con `TEXT_EFFECT_DEFAULTS` (como `lh`); deshabilitados si el elemento está bloqueado
- [X] T010 [P] [US1] Prueba del inspector en `frontend/tests/text-shadow-background.test.tsx`: encender «Sombra» muestra los cinco controles; un cambio es **un** paso de deshacer; un valor que no cambia no agrega paso; fuera de rango se recorta; con el texto bloqueado todo está deshabilitado; apagar y volver a encender conserva los ajustes
- [X] T011 (no hizo falta: la sombra no cambia el tamaño del texto, así que `useFit` no depende de ella; el fondo sí, y quedó en T014) [US1] En `frontend/src/print/TemplateElement.tsx` (`FitText`) agregar `shadow`, `shDist`, `shBlur` a las dependencias de `useFit` para que el ajuste de los textos con datos insertables se recalcule

**Punto de control**: con T001–T011 la sombra se edita, se guarda y se dibuja; el resto de la plantilla no cambia.

---

## Fase 4: Historia 2 — Fondo del texto (P2)

**Meta**: dar un fondo de color que acompaña al texto, de una o varias líneas.

**Prueba independiente**: texto de dos líneas con fondo → variar redondez y separación → el fondo sigue cada línea, en lienzo y PDF.

- [X] T012 [P] [US2] Prueba en `frontend/tests/text-shadow-background.test.tsx` (sección fondo): sin `bg` **no existe** el `<span>` de fondo (HTML idéntico al de hoy); con `bg` el `<span>` lleva color con transparencia, relleno, esquinas y `box-decoration-break: clone`; texto vacío no deja fondo visible; sombra y fondo a la vez, y con contorno y resplandor, no se pisan
- [X] T013 [US2] En `frontend/src/print/TemplateElement.tsx` (`TextBody` y `FitText`) envolver el contenido en un `<span>` con `bgStyle` **solo** cuando `bg` esté activo y el texto no esté vacío; sin `bg` no se agrega ningún nodo
- [X] T014 [US2] En `frontend/src/print/TemplateElement.tsx` (`FitText`) agregar `bg`, `bgPad` a las dependencias de `useFit` y comprobar que el relleno lateral no desborda la caja (riesgo R1 de `research.md`); si desborda, descontar el relleno del ancho disponible
- [X] T015 [US2] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` agregar el interruptor «Fondo» y, si está activo, redondez, separación, transparencia y selector de color, con el mismo patrón y bloqueo que la sombra
- [X] T016 [P] [US2] Prueba del inspector en `frontend/tests/text-shadow-background.test.tsx`: los cuatro controles aparecen al encender «Fondo»; un cambio es un paso de deshacer; bloqueo; duplicar un texto con fondo y con sombra conserva todos los campos
- [X] T017 [P] [US2] Prueba de ida y vuelta en `frontend/tests/template-editor-save.test.tsx`: guardar, recargar y cambiar de plantilla y volver conserva sombra y fondo sin cambiar ningún otro valor (SC-006)

---

## Fase 5: Historia 3 — Agregar subtítulo (P3)

**Meta**: completar la jerarquía título / subtítulo / texto en el panel «Elementos».

**Prueba independiente**: insertar las tres opciones en una página y comprobar sus tamaños 40 / 24 / 16 y sus fuentes.

- [X] T018 [P] [US3] Prueba en `frontend/tests/text-shadow-background.test.tsx` (o en la del panel de elementos existente): «Agregar subtítulo» agrega un texto con fuente de cuerpo, 24 px y peso 700; título y texto siguen igual (40 px fuente de título; 16 px fuente de cuerpo); el texto insertado es un texto normal editable
- [X] T019 [US3] En `frontend/src/pages/TemplateEditor/panels/ElementosPanel.tsx` agregar la fábrica `subtitle` (`draftText({ name: 'Subtítulo', text: 'Nuevo subtítulo', font: 'body', size: 24, weight: 700, x: 15, y: 50, w: 70, h: 7 })`) y el botón «Agregar subtítulo» entre «Agregar título» y «Agregar texto»

---

## Fase 6: Cierre y compatibilidad

- [X] T020 Prueba de fidelidad en Chrome real en `backend/tests/integration/pdf-template-fidelity.test.ts`: un texto con sombra y fondo (uno de una línea, uno de dos líneas y uno con datos insertables largo) se ve igual en el lienzo y en el PDF (posición y cortes de línea); sombra cerca del borde de la página sin cortarse distinto (riesgo R2)
- [X] T021 (8 de 8 PDF idénticos byte a byte, 2026-10-22) Reconstruir `frontend/dist` y ejecutar la comparación byte a byte: `BASELINE_DIR=<carpeta de T001> npx tsx tests/fixtures/pdf-baseline.ts compare` en `backend/`; las 8 salidas deben ser **idénticas** (SC-001, FR-011)
- [X] T022 (frontend 921/921 y backend 1125/1125; `tsc` limpio; `eslint` solo marca `round1` sin usar en `FieldRenderer.tsx`, anterior a esta feature) [P] Ejecutar las suites completas (`npx vitest run` en `frontend/` y en `backend/`) y `tsc --noEmit` en ambos; corregir regresiones, en particular las pruebas del inspector que cuentan campos del texto
- [X] T023 (hecho en el navegador con datos temporales: sombra y fondo se dibujan sobre el Banner, con resplandor primero y sombra después; el cronometraje de SC-003 queda para una persona) Revisión manual en el navegador con datos temporales (servidor aparte y `DATA_DIR` temporal, sin leer `.env`): `quickstart.md` §6; anotar el resultado y el cronometraje de SC-003 (< 30 s para dejar legible un texto sobre foto clara)
- [X] T024 [P] Actualizar la documentación: marcar esta feature en `docs/specs/PENDIENTES-REA.md` y en `docs/specs/canva-fields-inventory.md` §6 (sombra, fondo y subtítulo: hechos), y enlazar la spec 011 en el `README.md`

---

## Dependencias y orden

- **T001** primero, siempre (la línea base debe ser de antes de tocar código).
- **Fase 2** bloquea las historias. Dentro de ella: T002 → T003; T005 puede ir en paralelo con T002 y T003 si lee los tipos ya definidos; T004 y T006 son pruebas [P].
- **US1** (Fase 3) no depende de las demás y es el MVP.
- **US2** (Fase 4) reutiliza `bgStyle` de T005 y toca los mismos archivos que US1 (`TemplateElement.tsx`, `inspector-fields.ts`): hacerla **después** de US1 para no pisar cambios.
- **US3** (Fase 5) es independiente de US1 y US2 (solo `ElementosPanel.tsx`); se puede hacer en paralelo con ellas.
- **Cierre** (Fase 6) al final: T020 y T021 requieren las tres historias y `frontend/dist` reconstruido.

## Ejecución en paralelo

```text
Tras T002–T003:   T004 (esquema)  ‖  T005 (cálculos)  →  T006
En US1:           T007 (prueba)  ‖  T010 (prueba inspector)   [antes de T008–T009]
En US2:           T012  ‖  T016  ‖  T017
Ya aparte:        US3 (T018–T019)  ‖  US1/US2
```

## Estrategia de implementación

1. **MVP**: T001 → Fase 2 → US1. Con eso ya se puede dar sombra a un texto; validar con `quickstart.md` §2–§5.
2. **Incremento 2**: US2 (fondo), validando lo mismo para el fondo.
3. **Incremento 3**: US3 (subtítulo), independiente y pequeño.
4. **Cierre**: fidelidad en Chrome real, comparación byte a byte y revisión manual.

## Resumen

- **Total**: 24 tareas.
- **Por fase**: Preparación 1 · Fundamentos 5 · US1 5 · US2 6 · US3 2 · Cierre 5.
- **Paralelas [P]**: T004, T005, T006, T007, T010, T012, T016, T017, T018, T022, T024.
- **MVP sugerido**: T001 a T011 (historia 1, sombra).
