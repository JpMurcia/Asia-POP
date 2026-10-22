# Implementation Plan: Ajustes avanzados de texto en el editor de plantillas

**Branch**: `008-text-advanced-settings` (el nombre solo identifica la feature; el trabajo vive en `main`) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-text-advanced-settings/spec.md`

## Summary

Es un cambio **pequeño y casi todo de editor**: tres propiedades que ya existen o casi (`lh`, `ls`, y un anclaje nuevo) y un panel que las agrupa. No hay motor nuevo, ni dependencias, ni cambio de esquema de base de datos.

1. **Rangos** (`backend/src/catalog/template.ts`, `RANGES`): `lh` pasa de 0,8–2,5 a **0,5–2,5** y `ls` de −2…12 a **−10…60**. Ambos contienen por completo el rango anterior, así que todo valor guardado sigue siendo válido sin migrar. El esquema (`template.schema.ts`) ya lee los rangos de `RANGES`; basta cambiar la constante.
2. **Anclaje vertical** (`vAlign?: 'top' | 'middle' | 'bottom'`, opcional en `TextEl`). Se dibuja con `align-items` de la caja flexible que ya envuelve cada texto (`.tpl-text-box`). **Hallazgo de la planificación**: hoy esa caja ya **centra** el texto en vertical, no lo pega arriba como suponía la primera versión de la spec. Por eso la ausencia del campo equivale a **`middle`** (render idéntico al actual, byte a byte) y la spec se corrigió (FR-007–FR-009, US3, SC-004). `TEXT_DEFAULTS` gana `vAlign: 'middle'`, único lugar donde vive el valor por defecto.
3. **Panel «Configuración avanzada»** en el inspector de texto: un descriptor nuevo `section` plegable en `inspector-fields.ts` que contiene **altura de línea, espaciado y anclaje**; los dos controles actuales salen de «Tipografía». Cada control numérico gana un **campo numérico** junto al deslizador (la misma lógica de `NumberField`, con recorte al rango). El estado abierto/cerrado vive en el `Inspector` (que no se desmonta al cambiar de elemento), no en la plantilla.
4. **Historial y robustez** en el reductor del editor: un parche de texto que no cambia ningún valor **no agrega paso** de deshacer (FR-016), y los valores de `lh`/`ls` escritos a mano se **recortan** a su rango antes de guardarse (FR-003). El deslizador ya agrupa un arrastre en un solo paso por `mergeKey`.

El render (`TemplateElement.tsx`) cambia en una sola línea (el `align-items` de la caja) y solo cuando el texto trae `vAlign` distinto de `middle`; sin el campo, el marcado y el CSS son los de hoy. Editor, miniaturas, vista previa y PDF usan el mismo componente, así que FR-013 se cumple sin trabajo extra.

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ comprobar que la línea base de PDFs de la 007 sigue idéntica → ① modelo y esquema (`RANGES`, `vAlign`, `TEXT_DEFAULTS`) con pruebas de compatibilidad → ② render del anclaje en `TemplateElement` + prueba de que sin campo no cambia → ③ reductor (recorte y parche sin cambio) → ④ inspector: descriptor `section`, campo numérico y panel → ⑤ pruebas del editor y actualización de las existentes (rangos 0,05 / −2…12 / 0,8) → ⑥ fidelidad en Chrome (lienzo = PDF con los tres ajustes) y línea base byte a byte → ⑦ documentación.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–010)

**Primary Dependencies**: **ninguna nueva**. Backend: zod (esquema). Frontend: React 19, Vite, Tailwind CSS v4.

**Storage**: SQLite local **sin cambios de esquema**. Las plantillas siguen siendo JSON en `catalog_template.doc_json` con `version: 1`; `vAlign` es una clave **opcional** (como `lh` y `strike` de la 007). Hay que declararla en el esquema zod, que descarta las claves que no conoce.

**Testing**: Vitest (backend y frontend), Testing Library, y Chrome real para la fidelidad (`pdf-template-fidelity.test.ts`) y la línea base byte a byte (`tests/fixtures/pdf-baseline.ts`, 8 PDF de la 007). Sin fotos ni Alegra.

**Target Platform**: navegador de escritorio en `localhost` (editor) y Chrome headless (PDF), igual que hoy.

**Project Type**: aplicación web local (backend + frontend), una sola aplicación.

**Performance Goals**: un cambio de cualquiera de los tres ajustes se ve en el lienzo en < 0,2 s (SC-005); ya se cumple con el resto de controles, porque cada parche vuelve a dibujar solo el elemento editado (`TemplateElement` está memorizado).

**Constraints**: PDF de las 4 plantillas base (y la 5ª, `base`) **idéntico byte a byte** sin tocar nada (FR-015, SC-001, SC-007); mismo componente de página en editor, vista previa y PDF; sin recursos de Canva (FR-018).

**Scale/Scope**: ~8 archivos de código tocados, 0 nuevos en el backend, 1–2 componentes pequeños nuevos en el frontend.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|-----------|-----------|
| I. Alegra solo lectura | ✅ No toca Alegra. |
| II. El catálogo no engaña | ✅ No cambia precios, AGOTADO ni fotos. Con espaciado o interlineado extremos el texto puede no caber; el ajuste automático de tamaño (`useFit`) sigue actuando como hoy. |
| III. Seguridad de credenciales | ✅ Sin credenciales ni endpoints nuevos. |
| IV. Fidelidad visual | ✅ Mismo componente de página para editor, vista previa y PDF; Neón Noche y las demás plantillas no cambian (comparación byte a byte). |
| V. Pruebas sobre reglas | ✅ Pruebas de esquema (rangos, `vAlign`), render (sin campo = igual), reductor (recorte y no-op), inspector y fidelidad en Chrome; escritas junto con el código. |
| VI. Simplicidad | ✅ Sin dependencias ni estructuras nuevas: un campo opcional, dos rangos y un descriptor de panel. |

**Resultado**: sin violaciones; la tabla de complejidad queda vacía. Re-evaluado tras el diseño (Fase 1): sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/008-text-advanced-settings/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones y alternativas
├── data-model.md        # Fase 1: TextEl.vAlign, rangos, estado del panel
├── quickstart.md        # Fase 1: cómo validar la feature
├── contracts/
│   └── editor-ui.md     # Fase 1: esquema de la plantilla y descriptor del inspector
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
backend/
├── src/catalog/
│   ├── template.ts            # RANGES.lh / RANGES.ls, TextEl.vAlign, TEXT_DEFAULTS.vAlign
│   └── template.schema.ts     # vAlign opcional (enum); lh y ls ya leen RANGES
└── tests/unit/                # template-schema-008 (nuevo) y rangos de las pruebas existentes

frontend/
├── src/print/
│   ├── TemplateElement.tsx    # align-items de la caja del texto según vAlign
│   └── template.css           # (solo si hace falta una regla; el estilo va inline)
├── src/pages/TemplateEditor/
│   ├── inspector-fields.ts    # descriptor `section` + `numeric` en `range`; panel «Configuración avanzada»
│   ├── FieldRenderer.tsx      # dibuja `section` plegable y el campo numérico junto al deslizador
│   ├── Inspector.tsx          # estado abierto/cerrado del panel
│   ├── useTemplateEditor.ts   # recorte de lh/ls y parche de texto sin cambio
│   └── editor.css             # estilos del panel
└── tests/                     # text-advanced-settings.test.tsx (nuevo); reductor e inspector existentes
```

**Structure Decision**: aplicación web existente (backend + frontend en el mismo repositorio). El modelo de plantilla y su esquema viven en el backend y el frontend los importa (`../../../../backend/src/catalog/template`), como en 007 y 010; no se crean carpetas nuevas.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
