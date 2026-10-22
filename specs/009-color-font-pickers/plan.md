# Implementation Plan: Selectores de color y de fuente de la plantilla

**Branch**: `009-color-font-pickers` (el nombre solo identifica la feature; el trabajo vive en `main`) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-color-font-pickers/spec.md`

## Summary

Es una mejora **solo del editor**: cambia **cómo se elige** un color o una fuente, no cómo se guardan ni cómo se dibujan. No toca el backend, el esquema de la plantilla ni el render; el PDF de las plantillas existentes no puede cambiar.

1. **Un panel anclado reutilizable** (`Popover`): se abre junto al control del inspector, lleva título y botón de cierre, se cierra con Escape o al hacer clic fuera, devuelve el foco al control que lo abrió y se coloca con posición fija (el inspector tiene `overflow: auto` y recortaría un panel interno). Lo usan los dos selectores.
2. **Selector de color** (`ColorPicker`) que reemplaza los cuadritos fijos de `ColorField`: un botón-muestra con el color activo abre el panel con (a) buscador, (b) grupo **«Colores de la plantilla»** (los seis de la paleta y los libres usados en cualquier página, sin repetir y con `#abc` ≡ `#AABBCC`), (c) colores básicos, (d) «Ninguno» o «Transparente» donde existen, (e) el selector gráfico del navegador de siempre y (f) un **cuentagotas** solo si `window.EyeDropper` existe. El formato guardado no cambia: una clave de la paleta se guarda como clave, un color libre como `#RRGGBB` en mayúsculas.
3. **Selector de fuente** (`FontPicker`) que reemplaza la lista desplegable de `FieldRenderer`: botón con el nombre en su propia tipografía abre el panel con buscador, grupo **«Fuentes de la plantilla»** («Título», «Cuerpo» y las familias que los elementos ya usan) y **«Todas las fuentes»** (las seis de siempre), cada una escrita con su tipografía y con marca de verificación en la activa. «Título» y «Cuerpo» siguen guardándose como referencias.
4. **Cálculos puros y sin estado nuevo** (`template-colors.ts`, `template-fonts.ts`): normalizar códigos, recorrer la plantilla para reunir colores y fuentes usados, buscar sin distinguir mayúsculas ni tildes. Se calculan al abrir el panel y no se guardan.
5. **Historial**: elegir el color o la fuente que ya está activos no agrega un paso de deshacer. El reductor hoy solo descarta parches sin cambio en textos (feature 008); se generaliza a todos los elementos y al fondo de la página.

**Hallazgo de la planificación**: hoy el inspector deja editar los colores de un elemento **bloqueado** (los cuadritos no se deshabilitan). La spec (FR-019) pide deshabilitar los selectores en ese caso, igual que la 008 hizo con «Configuración avanzada». Se sigue la spec y se avisa: es un cambio pequeño de comportamiento.

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ capturar la línea base de PDFs de antes → ① cálculos puros (`template-colors`, `template-fonts`) con pruebas → ② reductor sin cambio para todos los elementos y el fondo → ③ `Popover` → ④ `ColorPicker` (US1: colores de la plantilla; US2: buscador; US4: cuentagotas) → ⑤ `FontPicker` (US3) → ⑥ cableado en `FieldRenderer` y bloqueo → ⑦ actualizar las pruebas existentes que buscaban cuadritos y listas → ⑧ comparación byte a byte y revisión de teclado → ⑨ documentación.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–010)

**Primary Dependencies**: **ninguna nueva**. Frontend: React 19, Vite, Tailwind CSS v4 (el editor usa CSS propio en `editor.css`). Sin librerías de selectores de color ni de popover.

**Storage**: **sin cambios**. Los colores siguen siendo `ColorRef` (clave de paleta o `#RRGGBB`) y las fuentes `FontRef` (`title`, `body` o una de seis familias). «Colores de la plantilla» y «Fuentes de la plantilla» se calculan y no se guardan.

**Testing**: Vitest + Testing Library (frontend). Pruebas unitarias de los cálculos puros, de componentes (`ColorPicker`, `FontPicker`, `Popover`) y del inspector; `EyeDropper` se simula con un doble. Línea base de PDFs con `tests/fixtures/pdf-baseline.ts` (la de la 007 ya no sirve; se captura una propia antes de empezar, como en la 008).

**Target Platform**: navegador de escritorio en `localhost` (editor).

**Project Type**: aplicación web local (backend + frontend); esta feature solo toca `frontend/`.

**Performance Goals**: abrir un selector y ver su contenido en < 0,2 s (SC-006). El recorrido de la plantilla es lineal en el número de elementos (decenas) y se hace al abrir, no en cada render.

**Constraints**: render y PDF idénticos (FR-016, FR-017); teclado completo y foco devuelto (FR-018); sin recursos de Canva (FR-020); selector gráfico del navegador conservado (FR-007) para no perder ninguna capacidad (SC-005).

**Scale/Scope**: 3 componentes nuevos, 2 módulos puros, ~4 archivos tocados; ninguno del backend.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|-----------|-----------|
| I. Alegra solo lectura | ✅ No toca Alegra. |
| II. El catálogo no engaña | ✅ No cambia precios, AGOTADO ni fotos. |
| III. Seguridad de credenciales | ✅ Sin credenciales ni endpoints. El cuentagotas solo lee un color que la persona señala. |
| IV. Fidelidad visual | ✅ No cambia el render; mismo componente de página; las 4 plantillas base (y `base`) se comparan byte a byte. |
| V. Pruebas sobre reglas | ✅ Pruebas de los cálculos (dedupe, normalización, búsqueda), de cada selector, del historial y del teclado, escritas junto con el código. |
| VI. Simplicidad | ✅ Sin dependencias; un `Popover` compartido en lugar de dos implementaciones. |

**Resultado**: sin violaciones; la tabla de complejidad queda vacía. Re-evaluado tras el diseño: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/009-color-font-pickers/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones y alternativas
├── data-model.md        # Fase 1: entidades calculadas, normalización y búsqueda
├── quickstart.md        # Fase 1: cómo validar la feature
├── contracts/
│   └── picker-ui.md     # Fase 1: contrato de los componentes y del teclado
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
frontend/
├── src/pages/TemplateEditor/
│   ├── Popover.tsx             # panel anclado: posición fija, Escape, clic fuera, foco
│   ├── ColorPicker.tsx         # botón-muestra + panel de color
│   ├── FontPicker.tsx          # botón + panel de fuente
│   ├── template-colors.ts      # normalizar, reunir colores usados, buscar (puro)
│   ├── template-fonts.ts       # reunir fuentes usadas, buscar (puro)
│   ├── FieldRenderer.tsx       # ColorField y 'select' de fuente pasan a los selectores; locked
│   ├── inspector-fields.ts     # descriptor `font` (kind propio) en lugar de `select`
│   ├── Inspector.tsx           # pasa la plantilla para calcular colores y fuentes usados
│   ├── useTemplateEditor.ts    # parche sin cambio para cualquier elemento y para el fondo
│   └── editor.css              # estilos de los selectores
└── tests/
    ├── template-colors.test.ts       # nuevo
    ├── color-picker.test.tsx         # nuevo
    ├── font-picker.test.tsx          # nuevo
    └── template-editor-*.test.tsx    # existentes: cuadritos y lista de fuentes → selectores
```

**Structure Decision**: aplicación web existente. Todo vive en `frontend/src/pages/TemplateEditor/`; los cálculos son funciones puras en el mismo directorio y se prueban sin DOM. No se crean carpetas ni cambios en `backend/`.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
