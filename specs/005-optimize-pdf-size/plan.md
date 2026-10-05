# Implementation Plan: PDF del catálogo liviano para enviar

**Branch**: `005-optimize-pdf-size` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`) | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-optimize-pdf-size/spec.md`

## Summary

El PDF real pesa **156,4 MB** porque Chrome incrusta las fotos casi sin reducir: la medición de [research.md](./research.md) §0 muestra que **más del 95 % del archivo son imágenes** y que el 90 % son los PNG ya decodificados; tipografías, fondos y portadas no llegan a 1,5 MB. Con las 180 fotos reales, un PDF de prueba pasa de **149,2 MB a 18,1 MB** (estimado ~20 MB para el catálogo real, bajo el objetivo de **25 MB**), y Chrome lo dibuja 5 veces más rápido. El plan tiene cuatro frentes, con **una sola dependencia nueva** (`sharp`) y sin cambios de esquema:

1. **Reducir las fotos antes de que Chrome dibuje** (Historia 1, P1): en cada generación en calidad Optimizada, cada foto se reduce a **150 ppp al tamaño de su recuadro**, calculado desde la plantilla (nunca se agranda), y pasa a JPEG calidad 88 con 4:4:4. Una foto con **transparencia real** se conserva como PNG reducido, para que se vea idéntica (FR-006); si la copia no pesa menos que el original o falla, se usa el original (FR-007, FR-008).
2. **Cambiar solo las direcciones de las fotos** (FR-005): la vista de impresión se abre con `?quality=optimized` y el endpoint de datos devuelve el mismo payload con las `imageUrl` reemplazadas por copias temporales. `CatalogDocument` no se toca: diseño, textos, precios y AGOTADO son idénticos por construcción, y la vista previa y el editor no cambian.
3. **Elegir y saber cuánto pesa** (Historias 1 y 2, P1-P2): opción **Calidad del PDF** en Generar (Optimizada preseleccionada), tamaño al terminar y columna **Tamaño** en el Historial, y aviso si Optimizada supera 25 MB.
4. **Original sigue igual** (Historia 3, P3): la calidad Original no pasa por el optimizador y produce lo mismo que hoy (FR-009).

Decisiones y alternativas en [research.md](./research.md). El hallazgo de que el caché de fotos nunca se limpia (§12) queda **fuera de alcance**.

**Orden de implementación recomendado** (para `/speckit-tasks`): ① núcleo puro y optimizador (`pdf-quality`, `photo-target`, `photo-variants`, `image-optimizer`, con sus pruebas unitarias y la dependencia) → ② integración en la generación (servicio, rutas, almacén de preparaciones, trabajo, historial, vista de impresión, limpieza de copias) con pruebas de integración: por sí solo ya entrega PDF livianos → ③ interfaz (opción en Generar, tamaño y aviso, columna del Historial) → ④ validación con Chrome real (`test:pdf`) y con la cuenta real (quickstart): medición antes y después, revisión visual y Neón Noche contra `docs/Cat.pdf`.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–004)

**Primary Dependencies**: Backend: Express, better-sqlite3, Puppeteer, zod, multer; **nueva: `sharp` ^0.35** (Apache-2.0, Node ≥ 20,9, binario precompilado de 19 MB para Windows; justificada en Complejidad y en research §2). Frontend: React, Vite, Tailwind CSS v4, React Router, sin cambios

**Storage**: **sin cambios de esquema ni migraciones**. El tamaño de cada catálogo se lee del archivo guardado (`data/output/`); la calidad elegida se guarda en el `params_json` existente. Carpeta temporal nueva `data/pdf-photos/<trabajo>/` con las copias reducidas, que se borra al terminar cada trabajo y al arrancar el servidor (`data/` ya está en `.gitignore`)

**Testing**: Vitest (backend y frontend), supertest, servidor Alegra simulado ampliado con fotos sintéticas pesadas (opaca, con transparencia real, con canal alfa opaco, diminuta, dañada), `FakeRenderer` para la integración y `InspectingRenderer`/Chrome real (`npm run test:pdf`) para comparar ambas calidades. Las fotos de prueba se crean con la propia librería; **nunca** se prueba contra la cuenta real de forma automática (principio V)

**Target Platform**: Windows 11, navegador moderno en `localhost` (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: SC-004: preparar y generar con hasta 200 productos en < 2 min. Medido: preparar las copias ~2,5 s (14 ms por foto) y que Chrome dibuje 2,6 s en lugar de 12,6 s; hoy se tardan ~37 s en total y con Optimizada el paso de generar queda por debajo de los 16,2 s actuales

**Constraints**: 150 ppp mínimos al tamaño impreso (o la resolución propia si es menor); PDF ≤ 25 MB para el catálogo real (estimado ~20 MB); transparencia real conservada; Alegra solo lectura; la foto original, la copia local y las subidas nunca se modifican; un fallo de una foto no detiene la generación; un fallo de Alegra o de render sigue abortando sin PDF parcial

**Scale/Scope**: catálogo real de 197 productos activos (182 con foto, 66 páginas); 4 archivos nuevos de backend (3 puros y 1 con `sharp`), 6 módulos de backend con cambios, 3 páginas de frontend con cambios menores

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | Esta feature **no habla con Alegra**: trabaja con las copias locales ya descargadas, que no modifica; las copias reducidas son temporales y viven aparte. Los productos propios y las subidas tampoco se tocan | ✅ |
| II. El catálogo nunca engaña | El payload es el mismo y solo cambian los textos `imageUrl`: mismas páginas, productos, precios, AGOTADO y secciones (se prueba con Chrome real comparando el texto de ambas calidades). Un producto sin foto sigue fuera del PDF. Una copia que no carga **aborta** la generación con la guardia de 004, sin PDF parcial. Pasar el tamaño objetivo no aborta: avisa | ✅ |
| III. Seguridad de credenciales | Sin credenciales en juego. `/media/pdf/...` queda detrás de la sesión, como el resto de `/media`, con el mismo filtro de nombres seguros; no se registran direcciones de fotos | ✅ |
| IV. Fidelidad visual | **No se toca `CatalogDocument` ni ninguna plantilla**: editor, vista previa y PDF siguen dibujando con el mismo componente y solo cambia de dónde sale cada imagen. 150 ppp se calculan desde la plantilla elegida; la transparencia se conserva. Neón Noche en Optimizada se compara con `docs/Cat.pdf` (quickstart, escenario 6) | ✅ |
| V. Pruebas sobre las reglas | Pruebas unitarias de los cuatro módulos nuevos (resolución objetivo desde cada plantilla base, reducción, transparencia, "nunca más pesada", foto dañada, orientación EXIF, reemplazo de direcciones), de integración con `FakeRenderer` (calidad por defecto, Original intacto, copias temporales borradas, tamaño en el trabajo y el historial) y con Chrome real (peso y texto de ambas calidades). Fotos sintéticas, nunca la cuenta real | ✅ |
| VI. Simplicidad | **Una dependencia nueva**, justificada abajo. Sin esquema, sin endpoints nuevos (se amplían los existentes), sin caché entre generaciones (las copias son temporales), sin ajuste guardado de la calidad, sin herramienta externa. Complejidad mínima: un parámetro de consulta en la vista de impresión y una carpeta temporal | ✅ |

Sin violaciones: **no hace falta enmendar la constitución**. La dependencia nueva se justifica en la tabla de Complejidad, como exige la gobernanza.

Re-evaluación tras el diseño (Fase 1): sin violaciones pendientes. La calidad Original no importa el optimizador en su ruta (aunque el módulo se carga al arrancar), y Optimizada solo reemplaza direcciones: el riesgo para las reglas del principio II es el mismo que antes de la feature.

## Project Structure

### Documentation (this feature)

```text
specs/005-optimize-pdf-size/
├── plan.md
├── research.md                  # medición del PDF real, experimento con las 180 fotos, decisiones y alternativas
├── data-model.md                # calidad, resolución objetivo, copias, y los campos que gana el trabajo, el historial y la preparación
├── quickstart.md                # validación: pruebas, simulador y medición antes/después con la cuenta real
├── contracts/
│   ├── rest-api.md              # cambios aditivos: `quality` al generar, `?quality=optimized` en el payload, tamaño en el trabajo y el historial, `/media/pdf`
│   └── generate-ui.md           # pantalla Generar, aviso de tamaño y columna del Historial (textos incluidos)
├── checklists/
│   └── requirements.md
└── tasks.md                     # lo crea /speckit-tasks
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── package.json                 # CAMBIA · dependencia `sharp` (y package-lock.json de la raíz)
├── src/
│   ├── catalog/
│   │   ├── pdf-quality.ts       # NUEVO · puro (lo importa el frontend): PdfQuality, opciones con sus textos, PDF_TARGET_BYTES (25 MB), formatMegabytes, exceedsTarget
│   │   ├── catalog.service.ts   # CAMBIA · generate(prepareId, decisions, quality); render() prepara las copias, abre la vista con ?quality, limpia y entrega el tamaño
│   │   └── prepare-store.ts     # CAMBIA · la preparación guarda, solo durante el render, el mapa foto → copia
│   ├── pdf/
│   │   ├── photo-target.ts      # NUEVO · puro: píxeles a 150 ppp desde las medidas de las fotos de la plantilla (usa layoutRows)
│   │   ├── photo-variants.ts    # NUEVO · puro: lista las fotos de un payload y devuelve otro con las direcciones reemplazadas
│   │   ├── image-optimizer.ts   # NUEVO · `sharp`: reduce una foto (JPEG o PNG con transparencia), regla «nunca más pesada»; PhotoOptimizer gestiona la carpeta temporal y el progreso
│   │   ├── job.ts               # CAMBIA · el trabajo terminado informa sizeBytes y quality
│   │   └── history.repo.ts      # CAMBIA · cada entrada informa sizeBytes (del archivo; sin él, ausente)
│   ├── api/
│   │   └── catalog.routes.ts    # CAMBIA · generate acepta `quality`; payload aplica las copias con ?quality=optimized; /media/pdf/:run/:file
│   └── context.ts               # CAMBIA · photoOptimizer en el contexto (borra restos al crearse)
└── tests/
    ├── fixtures/
    │   ├── photos.ts            # NUEVO · crea fotos sintéticas con la librería: opaca grande, con transparencia real, con alfa opaco, diminuta, con orientación EXIF, dañada
    │   ├── alegra-mock.ts       # CAMBIA · sirve esas fotos pesadas
    │   └── pdf-harness.ts       # CAMBIA · generate({ quality }) y devuelve también el tamaño del PDF
    ├── unit/
    │   ├── pdf-quality.test.ts          # NUEVO · formato de MB, objetivo, aviso solo en Optimizada
    │   ├── photo-target.test.ts         # NUEVO · 150 ppp en las 4 plantillas base y con un bloque agrandado; sin bloque de productos
    │   ├── photo-variants.test.ts       # NUEVO · reemplazo puro, sin mutar, solo direcciones locales
    │   ├── image-optimizer.test.ts      # NUEVO · reducción, JPEG vs transparencia, nunca más pesada, no agranda, EXIF, dañada, GIF
    │   └── history-size.test.ts         # NUEVO · sizeBytes del archivo guardado; ausente si el archivo ya no existe (hoy el historial solo se ejerce desde las pruebas de generación)
    └── integration/
        ├── catalog-quality.test.ts      # NUEVO · calidad por defecto, Original intacto, copias temporales borradas, tamaño en trabajo e historial, fallo de una foto
        └── pdf-render.test.ts           # CAMBIA · con Chrome real: Optimizada pesa menos, mismo texto y páginas que Original, transparencia visible (npm run test:pdf)

frontend/
├── src/
│   └── pages/
│       ├── Generate.tsx          # CAMBIA · opción Calidad del PDF, tamaño al terminar y aviso si supera el objetivo
│       ├── History.tsx           # CAMBIA · columna Tamaño
│       └── Print.tsx             # CAMBIA · reenvía ?quality=optimized al pedir los datos de la página
└── tests/
    ├── generate.test.tsx         # CAMBIA · opción preseleccionada, se envía la calidad, tamaño y aviso solo con Optimizada
    └── screens.test.tsx          # CAMBIA · el Historial muestra la columna Tamaño y «—» cuando no hay dato
```

**Structure Decision**: se conserva la aplicación web de un solo proceso (backend + frontend) de 001–004. Los tres módulos nuevos de lógica son **puros** (`pdf-quality`, `photo-target`, `photo-variants`) para probarlos sin red, sin Chrome y sin `sharp`, y para que el frontend reutilice textos y el objetivo sin duplicarlos, igual que 003 hizo con `template.ts` y 004 con `photo-reasons.ts`. Todo lo que usa `sharp` queda en un solo archivo (`image-optimizer.ts`).

### Cobertura de la spec

| Requisito | Dónde se cumple |
| --- | --- |
| FR-001, FR-002 | `Generate.tsx` (opción y valor por defecto), `pdf-quality.ts` (textos) |
| FR-003, SC-001, SC-006 | `photo-target.ts` + `image-optimizer.ts`; medición con la cuenta real en el quickstart |
| FR-004 | `photo-target.ts` (150 ppp desde la plantilla) + `image-optimizer.ts` (cubrir, nunca agrandar) |
| FR-005 | `photo-variants.ts` (solo cambian las `imageUrl`); el texto del PDF se compara en `pdf-render.test.ts` |
| FR-006 | `image-optimizer.ts` (transparencia real conservada como PNG) |
| FR-007, FR-008 | `image-optimizer.ts` (descarta la copia que no pesa menos y cualquier fallo devuelve el original) |
| FR-009 | `catalog.service.ts` (Original no prepara copias) |
| FR-010 | las copias son archivos nuevos en `data/pdf-photos/`; los originales solo se leen |
| FR-011 | `history.repo.ts`, `job.ts`, `Generate.tsx`, `History.tsx` |
| FR-012 | `Generate.tsx` con `exceedsTarget`; el servidor no aborta por el tamaño |
| FR-013, SC-004 | medición en el quickstart (hoy ~37 s en total) |
| FR-014 | las copias se derivan en cada generación de la foto vigente y se borran |
| FR-015 | las cuatro suites de pruebas listadas arriba, con fotos sintéticas |

## Complexity Tracking

Sin violaciones de la constitución. Lo que podría parecer extra, o requiere justificación por escrito:

| Añadido | Por qué hace falta | Alternativa más simple descartada |
| --- | --- | --- |
| Dependencia nueva `sharp` | Reducir y recomprimir fotos de 4 formatos con transparencia, orientación EXIF y perfiles de color; medida con las fotos reales: 14 ms por foto, 18,1 MB de PDF frente a 149,2 MB. Se prueba sin navegador. Instalación verificada en Windows en 4 s, sin compilar | Reducir con `canvas` en Chrome (no se puede probar sin navegador y delega EXIF y color), `jimp` (segundos por PNG grande, riesgo para los 2 minutos), Ghostscript/qpdf/pdf-lib (instalación aparte, AGPL, o no recomprimen). Detalle en research §1 y §2 |
| Parámetro `?quality=optimized` en la vista de impresión y en el endpoint de datos | Es la forma de que solo el navegador de la generación vea las copias sin tocar `CatalogDocument` (principio IV) ni la vista previa (FR-001) | Reemplazar las direcciones en el payload guardado (la vista previa posterior mostraría copias ya borradas) o un indicador sin parámetro (no distingue vista previa de impresión). Research §7 |
| Carpeta temporal `data/pdf-photos/` | Las copias deben existir como archivos para que Chrome las pida por HTTP con la sesión; se borran al terminar | Un caché persistente de copias: más estado y reglas de invalidación para ahorrar ~2,5 s. Research §6 |
