# Implementation Plan: Elementos y formas estilo Canva

**Branch**: `013-canva-elements-shapes` (el nombre solo identifica la feature; el trabajo vive en `main`) | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-canva-elements-shapes/spec.md`

## Summary

Igual que la 011 y la 012, toca el modelo y el render **solo cuando un campo nuevo está presente**: sin ninguno, el HTML y el PDF son los de hoy. Seis piezas:

1. **Formas nuevas** (US1): `ShapeEl.kind` crece con `triangle`, `diamond`, `star`, `burst`, `arrow` y `bubble`. Los tres tipos actuales (`rect`, `circle`, `pill`) **siguen dibujándose con el mismo CSS**, así los bytes no cambian. Los nuevos se dibujan con un `<svg>` del tamaño real de la caja en px (`elementSize`), con el contorno calculado por una función pura `shapePath(kind, w, h)` en `print/shapes.ts`.
2. **Estilo de borde** (US2): `bs` (`solid` · `dashed` · `dotted`). En `rect`/`circle`/`pill` es `border-style`; en las formas SVG, `stroke-dasharray` (punteado con `stroke-linecap: round`). Ausente = sólido, y la cadena CSS del borde sigue siendo `Npx solid color`.
3. **Línea** (US3): `kind: 'line'` de `ShapeEl` (no un tipo de elemento nuevo: así no se tocan los `switch` por tipo). Color = `fill`, grosor = `bw` (mínimo 1 al dibujar), `bs`, y los extremos `capStart` / `capEnd` (`none` · `arrow` · `circle` · `square` · `diamond`). Se dibuja como `<svg>` en px: el extremo ocupa `s = 3·grosor + 4` px **dentro** de la caja y la línea recorre el resto, así nunca se sale ni se deforma. Los rectángulos delgados de las plantillas base y guardadas siguen siendo `rect`.
4. **Voltear** (US4): `flipH` / `flipV` en forma e imagen. Se aplican en el contenedor del elemento: `transform: rotate(rot) scale(sx, sy)`; sin volteo ni giro no hay `transform`, y con giro solo queda el `rotate` de siempre.
5. **Bloquear proporción** (US5): `lockAspect`, solo del editor. `computeDrag` recibe el bloqueo y deriva el alto del ancho con la relación original; el reductor, si un parche trae solo `w` o solo `h` de un elemento bloqueado, deriva el otro y recorta con `clampBox`. No afecta al render.
6. **Enlace** (US6): `href` en texto, insignia, forma e imagen. Con enlace, el cuerpo se envuelve en un `<a href target="_blank" rel="noopener">` que cubre toda la caja; Chrome lo convierte en una anotación de enlace en el PDF. Sin enlace, el DOM es idéntico. En el editor, `.ed-canvas a { pointer-events: none }` hace que el clic solo seleccione.

**Hallazgos de la planificación**:

- zod descarta las claves que no declara: todos los campos nuevos van en `template.schema.ts` (lección de 011 y 012).
- El borde de una forma SVG se centra sobre el trazo; para que quede **dentro** de la caja, igual que el `border` CSS, el contorno se calcula con la caja reducida en el grosor y se desplaza medio grosor.
- El resplandor neón de las formas SVG usa `filter: drop-shadow` (el `box-shadow` con inset del CSS no sigue la figura); la forma CSS conserva el suyo.
- `href` vacío significa «sin enlace»: el reductor lo trata como ausente al comparar para no agregar pasos de deshacer.
- El campo «Enlace» necesita un tipo de campo nuevo en el inspector (`input`, una línea), que confirma al pulsar Enter o salir del campo (un solo paso de deshacer).
- Las pruebas que buscan los botones de tipo de forma (`Rectángulo`, `Círculo`, `Píldora`) deben seguir pasando: el selector de tipo conserva esas etiquetas.

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ línea base de PDFs de antes (ya capturada en `%TEMP%\asiapop-baseline-013`, commit `8eacd38`) → ① modelo, rangos y esquema con pruebas → ② cálculos puros (`shapePath`, `lineGeometry`, `isValidLink`, `lockedSize`) con pruebas → ③ formas y borde (US1, US2) → ④ línea (US3) → ⑤ voltear y enlace en el render (US4, US6) → ⑥ inspector y panel «Elementos» → ⑦ bloquear proporción (US5) → ⑧ pruebas de ida y vuelta, historial y bloqueo → ⑨ fidelidad en Chrome real y comparación byte a byte → ⑩ revisión en el navegador y documentación.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios)

**Primary Dependencies**: **ninguna nueva**. React 19, Vite, Tailwind CSS v4 (CSS propio en `editor.css`), zod.

**Storage**: sin tablas ni migraciones; campos opcionales nuevos en los elementos del JSON de la plantilla (`version: 1`). Ver [data-model.md](data-model.md).

**Testing**: Vitest + Testing Library; pruebas unitarias del esquema y de los cálculos puros; de componente del render, el inspector y el redimensionado; de integración en Chrome real (`pdf-template-fidelity.test.ts`, incluida la anotación de enlace del PDF); línea base de PDFs con `backend/tests/fixtures/pdf-baseline.ts`.

**Target Platform**: navegador de escritorio en `localhost` y Chrome sin cabeza (PDF).

**Project Type**: aplicación web local (backend + frontend); toca ambos.

**Performance Goals**: un cambio de control se ve en < 0,2 s (SC-007); las figuras son SVG pequeños sin dependencias.

**Constraints**: render idéntico lienzo/PDF (FR-017); PDF de plantillas base idéntico byte a byte (FR-019); sin recursos de Canva (FR-022); un paso de deshacer por cambio (FR-020).

**Scale/Scope**: ~9 campos opcionales, 3 módulos puros, 1 tipo de campo nuevo en el inspector, ~12 archivos tocados.

## Constitution Check

| Principio | Evaluación |
|-----------|-----------|
| I. Alegra solo lectura | ✅ No toca Alegra. |
| II. El catálogo no engaña | ✅ No cambia precios, AGOTADO ni fotos. |
| III. Seguridad de credenciales | ✅ Sin credenciales ni endpoints nuevos. El enlace solo admite `http(s)` (sin `javascript:` ni `data:`) y se abre con `rel="noopener"`. |
| IV. Fidelidad visual | ✅ Un solo componente de render; prueba en Chrome real; 4 plantillas base byte a byte. |
| V. Pruebas sobre reglas | ✅ Esquema, cálculos, render, historial, proporción y bloqueo con pruebas junto al código. |
| VI. Simplicidad | ✅ Sin dependencias; la línea es un `kind` más, no un tipo nuevo; sin degradados, codos ni curvas. |

**Resultado**: sin violaciones. Re-evaluado tras el diseño: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/013-canva-elements-shapes/
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
│   ├── template.ts            # ShapeEl (+kinds, bs, capStart, capEnd), flipH/flipV/lockAspect/href, constantes y rangos
│   └── template.schema.ts     # declarar los campos y la validación del enlace
└── tests/
    ├── unit/template-schema-013.test.ts           # nuevo
    └── integration/pdf-template-fidelity.test.ts  # casos de formas, línea, volteo y enlace

frontend/
├── src/
│   ├── print/
│   │   ├── shapes.ts          # nuevo: shapePath, lineGeometry, dashArray (puros)
│   │   ├── ShapeSvg.tsx       # nuevo: <svg> de las formas nuevas y de la línea
│   │   └── TemplateElement.tsx    # volteo en el contenedor, <a> con enlace, ShapeBody
│   └── pages/TemplateEditor/
│       ├── inspector-fields.ts    # tipo de forma, borde, línea, voltear, proporción, enlace
│       ├── FieldRenderer.tsx      # nuevo tipo de campo 'input'
│       ├── panels/ElementosPanel.tsx  # formas nuevas con vista previa; «Línea» como kind 'line'
│       ├── usePointerDrag.ts      # computeDrag con lockAspect
│       ├── useTemplateEditor.ts   # derivar w/h con lockAspect; href '' = ausente
│       ├── lock-aspect.ts         # nuevo: lockedSize (puro)
│       └── editor.css             # .ed-canvas a { pointer-events: none }; vistas previas
└── tests/
    ├── shapes.test.ts, lock-aspect.test.ts
    └── shapes-013.test.tsx        # nuevo: render, inspector, panel, proporción, enlace
```

**Structure Decision**: aplicación web existente. Los cálculos de figuras viven en módulos puros dentro de `print/` (compartidos por lienzo y PDF) y lo propio del editor en `pages/TemplateEditor/`.

## Complexity Tracking

Sin violaciones que justificar.
