# Implementation Plan: Sombra y fondo del texto, y estilos de texto predeterminados

**Branch**: `011-text-shadow-background` (el nombre solo identifica la feature; el trabajo vive en `main`) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-text-shadow-background/spec.md`

## Summary

Dos efectos opcionales del texto y un botón nuevo del panel «Elementos». A diferencia de la 009, **sí toca el modelo y el render**, pero solo cuando el efecto está activo: sin efecto, el HTML que se dibuja es el mismo de hoy y el PDF de las plantillas existentes no cambia.

1. **Modelo** (`backend/src/catalog/template.ts` y `template.schema.ts`): once campos **opcionales y planos** en `TextEl`, como `lh`, `strike` y `vAlign` (008): `shadow` y `bg` (interruptores) y los parámetros de cada uno. Si faltan, se leen de `TEXT_EFFECT_DEFAULTS`; no hay migración ni cambio de versión. Hay que declararlos en el esquema (`z.object` descarta las claves que no conoce).
2. **Render** (`frontend/src/print/TemplateElement.tsx`): la **sombra** se suma a `textShadow` junto al resplandor neón (un único valor con varias capas); el **fondo** envuelve el contenido en un `<span>` en línea con `background`, `padding`, `border-radius` y `box-decoration-break: clone`, para que siga cada línea de un texto de varias. Sin `bg`, **no se agrega el `<span>`**. Lo comparten lienzo, miniaturas, vista previa y PDF (constitución IV).
3. **Inspector** (`inspector-fields.ts`): bajo «Color y efectos», dos interruptores «Sombra» y «Fondo»; al activarlos aparecen sus controles (deslizador + campo numérico, el patrón de la 008) y selectores de color (009). Apagar el interruptor equivale a «Ninguno». Con el elemento bloqueado, todo deshabilitado (como en la 008/009).
4. **Estilos predeterminados**: el panel «Elementos» ya tiene «Agregar título» y «Agregar texto» (con la fuente de título y de cuerpo de la plantilla). Solo falta **«Agregar subtítulo»**, y dejar los tres con una jerarquía clara (40 / 24 / 16 px). No hay entidad nueva ni cambio de esquema.
5. **Compatibilidad**: línea base de PDFs capturada **antes** de tocar código y comparada al final; las 4 plantillas base no usan los efectos, así que deben salir idénticas byte a byte.

**Hallazgos de la planificación** (corrigen la spec, ya actualizada):

- «Título» y «Texto» ya existen como botones; la historia 3 se reduce a «Subtítulo» y a afinar la jerarquía.
- El texto con datos insertables (`{banner}`, etc.) usa `FitText`/`useFit`, que reduce la letra para que quepa. El relleno del fondo es en línea y puede ensanchar una sola línea; hay que probar que no desborde la caja (riesgo R1 en `research.md`).

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ línea base de PDFs de antes → ① modelo, rangos, valores por defecto y esquema con pruebas → ② ayudante puro `withAlpha` y función que arma `textShadow` → ③ render de sombra → ④ render de fondo → ⑤ campos del inspector → ⑥ botón «Agregar subtítulo» → ⑦ pruebas de ida y vuelta, historial y bloqueo → ⑧ comparación byte a byte y fidelidad en Chrome real → ⑨ documentación.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–010)

**Primary Dependencies**: **ninguna nueva**. React 19, Vite, Tailwind CSS v4 (CSS propio en `editor.css`), zod en el backend.

**Storage**: sin tablas ni migraciones. Todo vive en el JSON de la plantilla (`catalog_template.doc_json`, `version: 1`); campos opcionales nuevos en los textos. Ver [data-model.md](data-model.md).

**Testing**: Vitest + Testing Library (frontend y backend). Pruebas unitarias del esquema, del armado de la sombra y de `withAlpha`; de componente del render y del inspector; de integración con Chrome real para fidelidad lienzo/PDF (`backend/tests/integration/pdf-template-fidelity.test.ts` y `editor-browser.test.ts`); línea base de PDFs con `backend/tests/fixtures/pdf-baseline.ts`.

**Target Platform**: navegador de escritorio en `localhost` (editor) y Chrome sin cabeza (PDF).

**Project Type**: aplicación web local (backend + frontend); esta feature toca ambos.

**Performance Goals**: el cambio de un parámetro se ve en < 0,2 s (SC-004); la sombra y el fondo son CSS, sin cálculo extra por render.

**Constraints**: render idéntico en lienzo y PDF (FR-009); PDF existente idéntico byte a byte (FR-011); sin recursos de Canva (FR-014); un paso de deshacer por cambio (FR-012).

**Scale/Scope**: 11 campos opcionales, 1 ayudante puro, ~6 archivos tocados, 1 botón nuevo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|-----------|-----------|
| I. Alegra solo lectura | ✅ No toca Alegra. |
| II. El catálogo no engaña | ✅ No cambia precios, AGOTADO ni fotos; el fondo no puede tapar el precio porque solo afecta a un texto y respeta el orden de capas. |
| III. Seguridad de credenciales | ✅ Sin credenciales ni endpoints nuevos. |
| IV. Fidelidad visual | ✅ Un único componente de render; prueba de fidelidad en Chrome real; las 4 plantillas base se comparan byte a byte. |
| V. Pruebas sobre reglas | ✅ Pruebas del esquema, de los valores por defecto, del armado del CSS, del historial y del bloqueo, escritas con el código. |
| VI. Simplicidad | ✅ Sin dependencias; campos planos como los de 007/008; sin editor de efectos genérico. |

**Resultado**: sin violaciones; la tabla de complejidad queda vacía. Re-evaluado tras el diseño: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/011-text-shadow-background/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md              # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/catalog/
│   ├── template.ts            # TextEl (+11 opcionales), RANGES, TEXT_EFFECT_DEFAULTS
│   └── template.schema.ts     # declarar los campos y sus rangos
└── tests/
    ├── unit/template-schema-011.test.ts          # nuevo
    └── integration/pdf-template-fidelity.test.ts # caso con sombra y fondo

frontend/
├── src/
│   ├── print/TemplateElement.tsx                 # textShadow combinado y <span> de fondo
│   ├── print/text-effects.ts                     # nuevo: withAlpha, shadowCss, bgStyle (puros)
│   └── pages/TemplateEditor/
│       ├── inspector-fields.ts                   # interruptores y controles
│       └── panels/ElementosPanel.tsx             # «Agregar subtítulo»
└── tests/
    ├── text-effects.test.ts                      # nuevo
    ├── text-shadow-background.test.tsx           # nuevo: render e inspector
    └── template-editor-inspector.test.tsx        # ajustes
```

**Structure Decision**: aplicación web existente (backend + frontend). Los efectos viven en un módulo puro nuevo dentro de `print/` para probarlos sin montar React y compartirlos con cualquier otro render futuro; lo demás se añade a los archivos que ya manejan `lh`, `strike` y `vAlign`.

## Complexity Tracking

Sin violaciones que justificar.
