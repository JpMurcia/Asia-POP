# Implementation Plan: Texto estilo Canva

**Branch**: `012-canva-text-styles` (el nombre solo identifica la feature; el trabajo vive en `main`) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-canva-text-styles/spec.md`

## Summary

Igual que la 011, toca el modelo y el render **solo cuando el formato está activo**: sin ningún campo nuevo, el HTML y el PDF son los de hoy. Cuatro piezas:

1. **Formato** (US1): `italic`, `underline`, alineación `justify` y `list` (`none` / `bullet` / `number`). Cursiva y subrayado son CSS (`font-style`, `text-decoration-line` combinado con el tachado). La lista se dibuja como una línea por renglón con **sangría francesa** (`padding-left` + `text-indent` negativo) y el marcador como texto («•» o «1.») : sirve igual en el lienzo y en el PDF, sin depender de `list-style`.
2. **Efectos** (US2): cinco indicadores nuevos (`bright`, `echo`, `misalign`, `glitch`, `hollow`) con cuatro parámetros compartidos (`fxColor`, `fxColor2`, `fxDist`, `fxI`). Todos son `text-shadow` o contorno de texto: se suman a la lista que ya arman el resplandor neón y la sombra (011), en un **orden fijo**. En el inspector, una **cuadrícula de 3 columnas** con vista previa «Ag» reemplaza los interruptores sueltos de «Color y efectos»; los parámetros del efecto activo aparecen debajo.
3. **Curvar** (US3): `curve` de −100 a 100. Un texto curvo se dibuja como un `<svg>` del tamaño de la caja con el texto sobre un arco (`<textPath>`); solo la primera línea. Color, contorno y sombra se conservan (la sombra con `filter: drop-shadow`, porque `text-shadow` no se aplica de forma fiable al texto SVG). Con `curve` 0 o ausente, no hay SVG.
4. **Copiar estilo** (US4): un estado de edición `styleBrush` (no se guarda) con las acciones `copyStyle`, `pasteStyle` y `cancelBrush`. Pegar es un parche normal: **un** paso de deshacer. Una lista cerrada de claves (`STYLE_KEYS`) define qué se copia; nunca el contenido, la posición, el tamaño ni el nombre.

**Orden de dibujo de los efectos** (fijo, de atrás hacia delante): resplandor neón → brillo → eco → desalineado → distorsión → sombra. El **fondo** va detrás de todo (es el `<span>` de la 011) y **sin relleno** deja el relleno transparente y dibuja el borde.

**Hallazgos de la planificación**:

- Las fuentes son locales y no traen variante cursiva: el navegador sintetiza la inclinación (Chrome hace lo mismo al generar el PDF). Se documenta como «cursiva sintética» (escenario 5 de la US1).
- `FitText` mide el texto con datos insertables: la lista y el justificado cambian su altura, así que `useFit` debe depender de `list`, `italic`, `underline` y `align`. Un texto **curvo** no pasa por `FitText` (usa `el.size` tal cual): queda documentado.
- Hay que reescribir las pruebas de la 011 que buscan los interruptores «Sombra» y «Fondo» (ahora son botones de la cuadrícula).

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ línea base de PDFs de antes → ① modelo, rangos y esquema con pruebas → ② cálculos puros (`effectsCss`, `listLines`, `arcPath`, `STYLE_KEYS`) con pruebas → ③ formato (US1) → ④ efectos y cuadrícula (US2) → ⑤ curvar (US3) → ⑥ copiar estilo (US4) → ⑦ pruebas de ida y vuelta, historial y bloqueo → ⑧ fidelidad en Chrome real y comparación byte a byte → ⑨ revisión en el navegador y documentación.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios)

**Primary Dependencies**: **ninguna nueva**. React 19, Vite, Tailwind CSS v4 (CSS propio en `editor.css`), zod.

**Storage**: sin tablas ni migraciones; campos opcionales nuevos en los textos del JSON de la plantilla (`version: 1`). Ver [data-model.md](data-model.md).

**Testing**: Vitest + Testing Library; pruebas unitarias del esquema y de los cálculos puros; de componente del render, la cuadrícula y copiar estilo; de integración en Chrome real (`pdf-template-fidelity.test.ts`); línea base de PDFs con `backend/tests/fixtures/pdf-baseline.ts`.

**Target Platform**: navegador de escritorio en `localhost` y Chrome sin cabeza (PDF).

**Project Type**: aplicación web local (backend + frontend); toca ambos.

**Performance Goals**: un cambio de control se ve en < 0,2 s (SC-006); los efectos son CSS; el arco se calcula una vez por render.

**Constraints**: render idéntico lienzo/PDF (FR-014); PDF de plantillas base idéntico byte a byte (FR-016); sin recursos de Canva (FR-020); un paso de deshacer por cambio (FR-017).

**Scale/Scope**: ~12 campos opcionales, 4 módulos puros, 1 componente nuevo (cuadrícula), ~8 archivos tocados.

## Constitution Check

| Principio | Evaluación |
|-----------|-----------|
| I. Alegra solo lectura | ✅ No toca Alegra. |
| II. El catálogo no engaña | ✅ No cambia precios, AGOTADO ni fotos. |
| III. Seguridad de credenciales | ✅ Sin credenciales ni endpoints nuevos. |
| IV. Fidelidad visual | ✅ Un solo componente de render; prueba en Chrome real; 4 plantillas base byte a byte. |
| V. Pruebas sobre reglas | ✅ Esquema, cálculos, render, historial y bloqueo con pruebas junto al código. |
| VI. Simplicidad | ✅ Sin dependencias; parámetros compartidos entre efectos para no inflar el modelo; Curvar limitado a una línea. |

**Resultado**: sin violaciones. Re-evaluado tras el diseño: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/012-canva-text-styles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/catalog/
│   ├── template.ts            # TextEl (+campos), RANGES, TEXT_EFFECT_DEFAULTS (+fx*), align 'justify'
│   └── template.schema.ts     # declarar los campos y rangos
└── tests/
    ├── unit/template-schema-012.test.ts           # nuevo
    └── integration/pdf-template-fidelity.test.ts  # casos de formato, efectos y curvar

frontend/
├── src/
│   ├── print/
│   │   ├── text-effects.ts    # + effectsCss, shadowList (orden fijo)
│   │   ├── text-format.ts     # nuevo: listLines, arcPath, formatStyle (puros)
│   │   ├── CurvedText.tsx     # nuevo: <svg> con <textPath>
│   │   └── TemplateElement.tsx
│   └── pages/TemplateEditor/
│       ├── EffectsGrid.tsx    # nuevo: cuadrícula con vista previa «Ag»
│       ├── text-style.ts      # nuevo: STYLE_KEYS, pickStyle
│       ├── FieldRenderer.tsx  # nuevo tipo de campo 'effects'
│       ├── inspector-fields.ts
│       ├── useTemplateEditor.ts   # styleBrush: copyStyle/pasteStyle/cancelBrush
│       ├── Canvas.tsx / index.tsx # clic con la brocha activa
│       └── editor.css
└── tests/
    ├── text-format.test.ts, text-effects.test.ts (ampliada)
    ├── text-styles-012.test.tsx   # nuevo: render, cuadrícula, curvar, copiar estilo
    └── text-shadow-background.test.tsx  # ajustada (interruptores → cuadrícula)
```

**Structure Decision**: aplicación web existente. Los cálculos viven en módulos puros dentro de `print/` (compartidos por lienzo y PDF) y lo propio del editor en `pages/TemplateEditor/`.

## Complexity Tracking

Sin violaciones que justificar.
