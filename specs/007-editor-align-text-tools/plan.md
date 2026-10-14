# Implementation Plan: Alinear a la página, altura de línea y tachado en el editor de plantillas

**Branch**: `007-editor-align-text-tools` (el nombre solo identifica la feature; el trabajo se desarrolla en la rama asignada a la sesión) | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-editor-align-text-tools/spec.md`

## Summary

Tres controles nuevos en el editor de plantillas de la 003, elegidos del [inventario de campos de Canva](../../docs/specs/canva-fields-inventory.md). **Sin dependencias, rutas ni tablas nuevas**:

1. **Alinear a la página** (P1): una acción `align` en el reductor del editor (`useTemplateEditor`) con una función pura `alignBox` que reescribe `x` o `y` en % de la hoja, más una fila de seis botones en el inspector. Ignora elementos bloqueados y no registra pasos vacíos (research §4).
2. **Altura de línea** (P2) y **tachado** (P3): dos propiedades **opcionales** del texto, `lh` y `strike`. Sus valores por defecto (`1.05` y `false`, los de hoy) viven en un único `TEXT_DEFAULTS`. Así las plantillas guardadas se ven idénticas **sin migración** (research §1). Se validan en el esquema zod (si no, zod las borraría en silencio al guardar), se dibujan en `TemplateElement` y se editan con dos descriptores más en `inspector-fields.ts`.

La fidelidad lienzo ↔ PDF no requiere código propio: lienzo, miniaturas, vista previa y PDF dibujan con el mismo `TemplateElement` (constitución IV). Las pruebas de fidelidad en Chrome real se extienden a las dos propiedades nuevas.

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ línea base de PDFs → ① modelo compartido (`TEXT_DEFAULTS`, `RANGES.lh`, tipos y esquema) con su prueba de guardado → ② US1 alinear (reductor, inspector, pruebas) → ③ US2 altura de línea → ④ US3 tachado → ⑤ fidelidad en Chrome real y regresión visual de las 4 plantillas base.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–006)

**Primary Dependencies**: **ninguna nueva**. Backend: Express, better-sqlite3, Puppeteer, zod. Frontend: React 19, Vite, Tailwind CSS v4, React Router

**Storage**: SQLite local **sin cambios de esquema**. Las plantillas siguen como JSON en `catalog_template.doc_json` con `version: 1`; `lh` y `strike` son claves opcionales del elemento de texto

**Testing**: Vitest (backend y frontend), Testing Library, supertest y Chrome real para la fidelidad (`pdf-template-fidelity.test.ts`) y el PDF (`npm run test:pdf`). Nunca contra la cuenta real de Alegra (principio V)

**Target Platform**: Windows 11, navegador moderno en `localhost`, pantalla ≥ 1024 px (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: SC-005: un cambio de altura de línea o tachado se ve en el lienzo en < 0,2 s (un parche a un solo elemento memoizado, como el resto de controles); alinear es aritmética O(1)

**Constraints**: plantillas existentes idénticas sin migración (FR-015, SC-003); lienzo = vista previa = PDF (FR-013); deshacer/rehacer con las reglas de 003 (60 pasos, fusión de 800 ms en deslizadores); fuentes locales; sin dependencias nuevas

**Scale/Scope**: ≤ 30 plantillas × 4 páginas × ≤ 60 elementos (sin cambios). 0 archivos nuevos de backend, 1 componente nuevo de frontend (`AlignActions`), ~6 archivos con cambios pequeños

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | La feature no toca Alegra: son propiedades de diseño de la plantilla, guardadas en SQLite local | ✅ |
| II. El catálogo nunca engaña | Cambia la apariencia, no el contenido: precios, stock, AGOTADO, secciones y omisiones siguen en el constructor. El tachado es una decisión visual explícita del administrador sobre un texto que él escribe; no se aplica solo a precios de Alegra ni altera el precio que muestra el bloque de productos | ✅ |
| III. Seguridad de credenciales | Sin credenciales en juego. Los campos nuevos se validan con rango y tipo en el servidor (FR-016); las rutas de plantillas siguen detrás de la sesión | ✅ |
| IV. Fidelidad visual | El render vive en `TemplateElement`, compartido por editor, miniaturas, vista previa y PDF. Los valores por defecto reproducen el render actual (`line-height: 1.05`, sin tachado), así que las plantillas existentes y Neón Noche no cambian; se verifica contra la línea base (SC-003) | ✅ |
| V. Pruebas sobre las reglas | Pruebas del reductor (`alignBox` y sus casos borde, bloqueados, pasos vacíos), del inspector, del esquema (guardar, releer, rechazar), de fidelidad en Chrome real y regresión de PDFs. Sin la cuenta real | ✅ |
| VI. Simplicidad | Sin dependencias, sin migración, sin versión nueva del documento. Dos campos opcionales, una acción, un componente de seis botones con íconos SVG en línea. Fuera de alcance: multi-selección, alinear entre elementos, atajos nuevos y formato por palabras | ✅ |

Sin violaciones: **no hace falta enmendar la constitución**.

Re-evaluación tras el diseño (Fase 1): sin violaciones. El punto delicado, la compatibilidad con plantillas guardadas (IV), se resuelve con campos opcionales y un único origen de valores por defecto, en lugar de una migración (research §1).

## Project Structure

### Documentation (this feature)

```text
specs/007-editor-align-text-tools/
├── plan.md
├── research.md                  # compatibilidad sin migración, unidad de lh, tachado CSS, alinear en el reductor, UI, pruebas
├── data-model.md                # TextEl.lh / TextEl.strike, TEXT_DEFAULTS, validación, tabla de alineación
├── quickstart.md                # 7 escenarios + línea base de PDFs
├── contracts/
│   └── editor-actions.md        # documento de plantilla (PUT), inspector (aria-labels) y acción align del reductor
├── checklists/
│   └── requirements.md
└── tasks.md                     # lo crea /speckit-tasks
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── src/catalog/
│   ├── template.ts              # CAMBIA · TextEl.lh?/strike?, RANGES.lh, TEXT_DEFAULTS
│   └── template.schema.ts       # CAMBIA · lh (num opcional) y strike (boolean opcional)
└── tests/integration/
    ├── templates.test.ts        # CAMBIA · guardar/releer lh y strike; rechazar fuera de rango; plantilla sin los campos no los gana
    └── pdf-template-fidelity.test.ts  # CAMBIA · line-height y text-decoration coinciden con el documento en Chrome real

frontend/
├── src/
│   ├── print/
│   │   └── TemplateElement.tsx  # CAMBIA · textStyle usa lh y strike; lh en las dependencias de useFit
│   └── pages/TemplateEditor/
│       ├── useTemplateEditor.ts # CAMBIA · AlignEdge, alignBox(), acción align y actions.align
│       ├── AlignActions.tsx     # NUEVO · seis botones (SVG en línea), deshabilitados si está bloqueado
│       ├── Inspector.tsx        # CAMBIA · monta AlignActions bajo las acciones del elemento
│       ├── inspector-fields.ts  # CAMBIA · range "Altura de línea" (fallback 1.05) y toggle "Tachado"
│       ├── FieldRenderer.tsx    # CAMBIA · range admite fallback cuando falta el valor
│       └── editor.css           # CAMBIA · estilo de la fila de alineación (.ed-align)
└── tests/
    ├── template-editor-reducer.test.ts    # CAMBIA · alignBox y acción align
    ├── template-editor-inspector.test.tsx # CAMBIA · botones de alinear, altura de línea y tachado
    └── template-page.test.tsx             # CAMBIA · render de lh y strike; por defecto 1.05 sin tachado
```

**Structure Decision**: web-application existente (`backend/` + `frontend/`), sin módulos nuevos salvo `AlignActions.tsx`. El modelo compartido sigue en `backend/src/catalog/template.ts`, que el frontend importa por ruta relativa, como en 003.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
