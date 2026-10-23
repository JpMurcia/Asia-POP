# Tasks: Texto estilo Canva

**Input**: `specs/012-canva-text-styles/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

**Pruebas incluidas** (constitución V). **Rutas**: `backend/src/catalog/`, `frontend/src/print/`, `frontend/src/pages/TemplateEditor/`, `frontend/tests/`, `backend/tests/`.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: paralelizable. **[Story]**: US1 formato · US2 efectos · US3 curvar · US4 copiar estilo.

---

## Fase 1: Preparación

- [X] T001 (8 PDF capturados el 2026-10-22 con el commit `f362bb6`) Reconstruir `frontend/dist` y capturar la línea base de PDFs **antes de tocar código**: `BASELINE_DIR=<carpeta temporal> npx tsx tests/fixtures/pdf-baseline.ts capture` en `backend/` (8 PDF); anotar carpeta y commit en `specs/012-canva-text-styles/quickstart.md` §1

## Fase 2: Fundamentos (bloquea las historias)

- [X] T002 En `backend/src/catalog/template.ts` agregar a `TextEl` los campos opcionales de `data-model.md` (`italic`, `underline`, `list`, `bright`, `echo`, `misalign`, `glitch`, `hollow`, `fxColor`, `fxColor2`, `fxDist`, `fxI`, `curve`), extender `align` con `'justify'`, agregar `fxDist`, `fxI` y `curve` a `RANGES` y ampliar `TEXT_EFFECT_DEFAULTS`
- [X] T003 En `backend/src/catalog/template.schema.ts` declarar los campos nuevos y aceptar `'justify'` en `align`
- [X] T004 [P] Prueba `backend/tests/unit/template-schema-012.test.ts`: plantilla sin campos válida; los campos sobreviven a validar; `justify` aceptado; fuera de rango (`curve: 150`, `fxDist: 99`, `fxI: -1`), `list` inválida y colores inválidos rechazados
- [X] T005 [P] Crear `frontend/src/print/text-format.ts` con funciones puras: `listLines(text, kind)` (líneas con marcador; numeración solo de líneas no vacías), `arcPath(w, h, curve)` (recto con 0; arco que sube con positivo y baja con negativo) y `decorationLine(el)` (`underline` y `line-through` combinados)
- [X] T006 [P] Prueba `frontend/tests/text-format.test.ts` de lo anterior
- [X] T007 [P] Ampliar `frontend/src/print/text-effects.ts` con `shadowList(el, palette)` (lista de `{dx, dy, blur, color}` en el **orden fijo** neón → brillo → eco → desalineado → distorsión → sombra) y `effectsStyle(el, palette)` (`textShadow`, relleno transparente y contorno de «sin relleno»); `shadowCss` pasa a apoyarse en ella sin cambiar su salida de la 011
- [X] T008 [P] Ampliar `frontend/tests/text-effects.test.ts`: orden fijo con todos activos; cada efecto por separado; sin efectos no devuelve nada; la salida de la 011 no cambia
- [X] T009 [P] Crear `frontend/src/pages/TemplateEditor/text-style.ts` con `STYLE_KEYS` y `pickStyle(el)`; prueba `frontend/tests/text-style.test.ts` (no copia `id, name, text, x, y, w, h, rot, opacity, visible, locked`)

**Punto de control**: `npx vitest run` sin regresiones en backend y frontend.

---

## Fase 3: US1 — Cursiva, subrayado, justificado y listas (P1) 🎯 MVP

**Prueba independiente**: texto de tres líneas con cada formato; lienzo y PDF coinciden.

- [X] T010 [P] [US1] Pruebas de render en `frontend/tests/text-styles-012.test.tsx` (sección formato): sin campos el marcado es el de siempre; `italic` → `font-style: italic`; `underline` + `strike` → `underline line-through`; `align: 'justify'` → `text-align: justify`; `list` bullet/number → una línea por renglón con marcador, sangría y sin marcador en líneas vacías
- [X] T011 [US1] En `frontend/src/print/TemplateElement.tsx` (`textStyle` y `TextBody`/`FitText`) dibujar cursiva, subrayado, justificado (caja a ancho completo) y lista; sin campos, ningún cambio en el HTML; agregar `list`, `italic`, `underline`, `align` a las dependencias de `useFit`
- [X] T012 [US1] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` agregar los interruptores «Cursiva» y «Subrayado», la opción «Justificado» en la alineación y el selector «Lista» (Sin lista · Viñetas · Numerada)
- [X] T013 [P] [US1] Pruebas del inspector en `frontend/tests/text-styles-012.test.tsx`: cada control cambia el lienzo, un cambio = un paso de deshacer, el bloqueo deshabilita, los valores faltantes se muestran como apagados

---

## Fase 4: US2 — Panel «Efectos» en cuadrícula (P1)

**Prueba independiente**: elegir cada estilo, ajustar, «Ninguno», guardar, recargar, PDF.

- [X] T014 [P] [US2] Pruebas en `frontend/tests/text-styles-012.test.tsx` (sección efectos): cada efecto nuevo se dibuja con su `text-shadow`/contorno; «Sin relleno» deja el relleno transparente; todos a la vez no fallan y mantienen el orden fijo; «Ninguno» los apaga todos
- [X] T015 [US2] En `frontend/src/print/TemplateElement.tsx` aplicar `effectsStyle` en `textStyle` (sin efectos nuevos la salida es la de hoy)
- [X] T016 [US2] Crear `frontend/src/pages/TemplateEditor/EffectsGrid.tsx`: cuadrícula de 3 columnas con una vista previa «Ag» por estilo (dibujada con `effectsStyle` sobre el propio texto de Asia-POP), nombre debajo, activo resaltado (`aria-pressed`), y «Ninguno»; estilos: Ninguno, Sombra, Brillo, Eco, Contorno, Fondo, Desalineado, Sin relleno, Neón, Distorsión
- [X] T017 [US2] En `frontend/src/pages/TemplateEditor/inspector-fields.ts` y `FieldRenderer.tsx` agregar el tipo de campo `effects` y reemplazar, en el texto, los interruptores y selectores sueltos de efectos por la cuadrícula; bajo ella, los parámetros del efecto activo (Contorno: color y grosor; Neón: color; Sombra y Fondo: los de la 011; Brillo, Eco, Desalineado, Distorsión: `fxColor`, `fxColor2`, `fxDist`, `fxI` según corresponda), con los selectores de color de la 009
- [X] T018 [US2] En `frontend/src/pages/TemplateEditor/useTemplateEditor.ts` recortar y redondear `fxDist`, `fxI` (y `curve`) en `settleText`; comparar contra los valores por defecto
- [X] T019 [US2] Ajustar `frontend/tests/text-shadow-background.test.tsx` y las pruebas del inspector existentes (`template-editor-inspector.test.tsx`, `color-picker.test.tsx`) al nuevo panel (los interruptores «Sombra» y «Fondo» pasan a ser botones de la cuadrícula)
- [X] T020 [P] [US2] Pruebas de la cuadrícula en `frontend/tests/text-styles-012.test.tsx`: aparecen los 10 estilos con vista previa; elegir uno lo marca y muestra sus parámetros; combinar dos; «Ninguno» los quita; un cambio = un paso de deshacer; bloqueo

---

## Fase 5: US3 — Curvar (P2)

- [X] T021 [P] [US3] Pruebas en `frontend/tests/text-styles-012.test.tsx` (sección curvar): con `curve` 0 o ausente no hay `<svg>`; con valor aparece un `<svg>` con `textPath`; el signo cambia la dirección del arco; solo la primera línea; color, contorno y sombra presentes
- [X] T022 [US3] Crear `frontend/src/print/CurvedText.tsx` (`<svg>` de la caja, `overflow: visible`, arco de `arcPath`, `<textPath startOffset="50%">`, `fill`, `stroke`/`paint-order`, `filter: drop-shadow` desde `shadowList`) y usarlo desde `TextBody` cuando `curve` ≠ 0
- [X] T023 [US3] En `inspector-fields.ts` agregar la sección «Forma» con «Curvar» (deslizador y campo, −100 a 100) y el aviso breve «Curvar admite una línea» cuando el texto tiene varias
- [X] T024 [P] [US3] Prueba del inspector: el control y el aviso; un cambio = un paso; bloqueo

---

## Fase 6: US4 — Copiar estilo (P3)

- [X] T025 [P] [US4] Pruebas en `frontend/tests/text-styles-012.test.tsx` (sección copiar estilo): la brocha copia el formato del texto seleccionado; un clic en otro texto lo pega sin tocar contenido, posición, tamaño ni nombre; un solo paso de deshacer; Escape y clic en vacío cancelan; clic en un elemento que no es texto no hace nada
- [X] T026 [US4] En `useTemplateEditor.ts` agregar `styleBrush` al estado y las acciones `copyStyle(id)`, `pasteStyle(id)` y `cancelBrush()` (pegar = parche único con `pickStyle`)
- [X] T027 [US4] En `Inspector.tsx` agregar el botón «Copiar estilo» (marcado mientras la brocha está activa) y en `index.tsx`/`Canvas.tsx` aplicar el estilo con el clic en un texto, y cancelar con Escape o clic en vacío

---

## Fase 7: Cierre y compatibilidad

- [X] T028 Pruebas de fidelidad en Chrome real en `backend/tests/integration/pdf-template-fidelity.test.ts` («feature 012»): cursiva, subrayado, justificado, lista con viñetas y numerada, cada efecto, todos a la vez, y curvar +60/−60 se ven igual en el lienzo y en el PDF; un texto con datos largo con lista no desborda
- [X] T029 (8 de 8 PDF idénticos byte a byte) Reconstruir `frontend/dist` y comparar byte a byte: `BASELINE_DIR=<carpeta de T001> npx tsx tests/fixtures/pdf-baseline.ts compare`; las 8 salidas **idénticas** (SC-001)
- [X] T030 (frontend 979/979; backend: todo en verde salvo el límite de plantillas del arnés de fidelidad, ya corregido, y `pdf-template-fidelity` 41/41; `tsc` limpio; `eslint` solo marca `round1` sin usar en `FieldRenderer.tsx`, anterior a esta feature) [P] Suites completas (`npx vitest run` en `frontend/` y `backend/`), `tsc --noEmit` en ambos y `eslint` de lo tocado; corregir regresiones
- [X] T031 (23-oct-2026, app con `DATA_DIR` temporal y simulador: lista numerada, cursiva, cuadrícula de efectos con Sombra + Neón combinados, Curvar +60 y guardar/recargar conservan todo; el PDF de Chrome lo cubre T028; Copiar estilo y −60 solo con pruebas automáticas; el arco de Curvar sobresale de la caja y puede tapar elementos vecinos) Revisión manual en el navegador con datos temporales (`quickstart.md` §6) y anotar el resultado
- [X] T032 [P] Actualizar documentación: `docs/specs/ROADMAP-CANVA.md` (012 hecha), `docs/specs/canva-fields-inventory.md` §3.2, `docs/specs/PENDIENTES-REA.md` y `README.md`

---

## Dependencias y orden

- **T001** primero. **Fase 2** bloquea las historias (T002 → T003; T004–T009 [P]).
- **US1** y **US2** tocan los mismos archivos (`TemplateElement.tsx`, `inspector-fields.ts`): hacer **US1 → US2**.
- **US3** necesita `shadowList` (T007) y el render de US2; **US4** necesita `STYLE_KEYS` (T009) y es independiente de US3.
- **Cierre** al final.

## Resumen

- **Total**: 32 tareas · Preparación 1 · Fundamentos 8 · US1 4 · US2 7 · US3 4 · US4 3 · Cierre 5.
- **MVP**: T001 a T013 (formato).
