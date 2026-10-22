# Implementation Plan: Plantilla «Base AsianPop» y foto-tarjeta generada

**Branch**: `010-base-template-product-card` (el nombre solo identifica la feature; el trabajo vive en `main`) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-base-template-product-card/spec.md`

## Summary

La base de Canva (medida en `docs/specs/canva-base-template-spec.md`) es, en esencia, la misma familia de diseño que **Neón Noche** (mármol, tarjetas oscuras, burbujas, acentos neón), de modo que casi todo se resuelve **ampliando el bloque de productos y la galería de plantillas**, no con un motor nuevo. Lo que de verdad falta son cinco piezas:

1. **Foto-tarjeta generada** (P1). Un módulo nuevo de backend (`photo-card.ts`, con `sharp`, la única dependencia de imágenes que el proyecto ya tiene) compone **una sola imagen JPEG por producto** al tamaño de su recuadro a 150 ppp: fondo oscuro, la foto de Alegra sin deformar y, según el modo elegido, **marco claro sobre fondo desenfocado** («Dejar como está») o **producto recortado sobre el fondo oscuro** («Quitar el fondo automáticamente»). El **nombre en neón no se hornea en la imagen**: lo dibuja el componente de página como texto vectorial dentro de la tarjeta, así el PDF conserva el texto buscable y el peso no crece.
2. **Mismo canal que la feature 005**. Las tarjetas entran por el payload (`GET /catalog/payload/:prepareId`) reemplazando `imageUrl`, igual que las copias reducidas; el componente `ProductsBlock` sigue siendo el único que dibuja productos (constitución IV), y la vista previa, el editor y el PDF muestran lo mismo.
3. **Quitar el fondo sin servicios externos**. Algoritmo propio sobre `sharp` (relleno desde el borde en fondos casi lisos, con comprobaciones de confianza); si no hay confianza, **esa foto cae al modo seguro** y se informa cuántas y cuáles. Sin modelos de IA ni dependencias nuevas.
4. **Plantilla de fábrica «Base AsianPop»** (quinta plantilla base, `base`). Reutiliza el bloque de productos con una **distribución nueva `base`** (geometría medida), un **nombre dentro de la foto** (`nameStyle: 'tarjeta'`), un **AGOTADO diagonal** (`sold: 'diagonal'`), **precio con neón**, **burbuja con sombra** e **interlineado 1,4**. Las cuatro plantillas existentes no cambian: los campos nuevos son opcionales con el valor de hoy por defecto, completados por `normalizeProductsBlocks`.
5. **Subir logo e ilustraciones de portada** (FR-021). La feature 003 dejó fuera subir imágenes a las plantillas; esta feature levanta esa restricción de forma mínima: un `ImageEl.src` puede ser `upload:<archivo>`, con una ruta para subir, listar y borrar imágenes de plantilla que reutiliza la validación de subidas de productos.

El contacto de las portadas sale del dato de negocio ya existente (marcador `{telefonos}`); no hay texto suelto por plantilla.

**Orden de implementación recomendado** (para `/speckit-tasks`): ⓪ comprobar que la línea base de PDFs de la 007 sigue idéntica → ① modelo y esquema (nuevos valores, campos opcionales, `normalizeProductsBlocks`) con pruebas de compatibilidad → ② distribución `base` en `template-layout.ts` → ③ `ProductsBlock` (tarjeta, nombre dentro, AGOTADO diagonal, neón del precio, sombra de burbuja, interlineado) con pruebas → ④ `photo-card.ts` (composición, quitar fondo, confianza) con pruebas sobre fotos de prueba → ⑤ cableado: opción de generación `photoBackdrop`, payload, vista previa de una tarjeta, informe de fotos que cayeron al modo seguro → ⑥ plantilla `base` en la galería y prueba de fidelidad contra la geometría medida → ⑦ subidas de imágenes de plantilla y selector en el inspector → ⑧ pantalla Generar → ⑨ validación visual y de peso del PDF.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–007)

**Primary Dependencies**: **ninguna nueva**. Backend: Express, better-sqlite3, Puppeteer, zod, **sharp** (ya usado por la feature 005). Frontend: React 19, Vite, Tailwind CSS v4, React Router. Quitar el fondo se implementa con `sharp` y código propio.

**Storage**: SQLite local **sin cambios de esquema**. Las plantillas siguen siendo JSON en `catalog_template.doc_json` con `version: 1`; los campos nuevos son claves **opcionales**. Archivos nuevos en disco: `data/card-cache/` (tarjetas generadas, temporal, se vacía al arrancar como `pdf-photos`) y las imágenes subidas de plantilla en la carpeta de subidas existente (`data/uploads/`, prefijo `tpl-`). La preferencia «Fondo de la foto» se guarda como opción de generación (ver research §R7).

**Testing**: Vitest (backend y frontend), Testing Library, supertest, y Chrome real para la fidelidad (`pdf-template-fidelity.test.ts`) y el PDF (`npm run test:pdf`). Fotos de prueba **sintetizadas con `sharp`** (fondo liso, fondo degradado, producto cortado por el borde, transparencia, panorámica, diminuta); nunca se usa la cuenta real de Alegra. La línea base de PDFs de la 007 (`specs/007-editor-align-text-tools/visual/baseline/`) se vuelve a comparar byte a byte.

**Target Platform**: Windows 11, navegador moderno en `localhost`, pantalla ≥ 1024 px (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: SC-009: primera generación con tarjetas ≤ 2× el tiempo de una plantilla actual (con 4 trabajos simultáneos, unos 60–120 ms por foto de composición y hasta ~300 ms con quitar fondo: ~10–25 s para 180 fotos); generaciones siguientes y la vista previa reutilizan la caché de tarjetas y no pagan nada. SC-011: cambiar de modo y ver una tarjeta de ejemplo en < 10 s. SC-006 de 009 no aplica.

**Constraints**: plantillas existentes idénticas byte a byte (FR-022, SC-004); PDF de ~180 productos < 25 MB (FR-023, SC-005; presupuesto en research §R6: ~45 KB por tarjeta ≈ 8 MB); lienzo = vista previa = PDF (FR-016); nada sale de la máquina (fotos de Alegra y subidas se procesan localmente); Alegra solo lectura (FR-005); la palabra AGOTADO siempre legible (FR-012).

**Scale/Scope**: ≤ 30 plantillas × 4 páginas × ≤ 60 elementos; un catálogo de ~180 productos con foto. 1 módulo nuevo de backend (`photo-card.ts`), 1 ruta nueva (`template-images.routes.ts`), 1 endpoint nuevo (`card-preview`), 1 plantilla base nueva, ~14 archivos modificados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
| --- | --- | --- |
| I. Alegra es la fuente de verdad (solo lectura) | Solo se leen fotos y datos; las tarjetas y las subidas viven en disco local; nada se escribe en Alegra | ✅ |
| II. El catálogo nunca engaña al cliente | Productos sin foto siguen fuera del PDF; AGOTADO se dibuja siempre con la palabra (diagonal, texto real y buscable); el precio mantiene el formato `$9.000`; un fallo al componer una tarjeta no aborta: usa el modo seguro, y una foto que no carga sí aborta como hoy | ✅ |
| III. Seguridad de credenciales | No toca el token ni las sesiones; la nueva ruta de subida exige sesión, valida tipo y tamaño de imagen y usa nombres seguros | ✅ |
| IV. Fidelidad visual | Neón Noche y las otras tres plantillas **no cambian** (comprobado por la línea base de la 007); editor, vista previa y PDF siguen dibujando con `ProductsBlock` y reciben la tarjeta por payload | ✅ |
| V. Pruebas sobre las reglas de negocio | Pruebas antes o junto con el código: productos sin foto, AGOTADO, páginas con 0/1/3/4 productos en la distribución `base`, compatibilidad de plantillas guardadas, determinismo y respaldo de las tarjetas | ✅ |
| VI. Simplicidad (YAGNI) | Se justifican abajo cuatro complejidades: distribución `base`, AGOTADO diagonal, subida de imágenes de plantilla y quitar fondo propio. Sin colas, sin servicios externos, sin dependencias nuevas | ✅ con justificación |
| Restricciones técnicas | TypeScript estricto; PDF por navegador headless; fuentes e imágenes locales; español de Colombia | ✅ |

**Re-evaluación tras el diseño (Phase 1)**: sin cambios; ninguna decisión del diseño exige una excepción adicional.

## Project Structure

### Documentation (this feature)

```text
specs/010-base-template-product-card/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1: opción de generación, vista previa de tarjeta, subidas de imágenes de plantilla, payload
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (lo crea /speckit-tasks, no este comando)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── catalog/
│   │   ├── template.ts            # BASE_IDS += 'base'; NAME_STYLES += 'tarjeta'; SoldOutStyle += 'diagonal'; ProductsLayout += 'base'; campos opcionales nuevos de ProductsEl; ImageKey con 'upload:' y claves 'sparkle' y 'chat'
│   │   ├── template.schema.ts     # validación de los valores nuevos y del nombre seguro de `upload:`
│   │   ├── template-layout.ts     # distribución `base` y rectángulo `name` dentro de la foto (nameStyle 'tarjeta')
│   │   ├── template-presets.ts    # fábrica `base()`; BASE_TEMPLATES con cinco; normalizeProductsBlocks completa los campos nuevos
│   │   ├── catalog.service.ts     # opción `photoBackdrop` de la generación; informe de fotos que cayeron al modo seguro
│   │   └── pdf-quality.ts         # sin cambios (la tarjeta no depende de la calidad)
│   ├── pdf/
│   │   ├── photo-card.ts          # NUEVO: compone la tarjeta (marco / sin fondo / respaldo) y decide la confianza
│   │   ├── card-cache.ts          # NUEVO: caché en disco por (foto, modo, tamaño, color) y carpeta servida
│   │   ├── image-optimizer.ts     # sin cambios (las tarjetas viven en /media/cards y no coinciden con su patrón)
│   │   └── job.ts                 # JobState.backdropFallbacks
│   ├── api/
│   │   ├── catalog.routes.ts      # payload con tarjetas; POST /catalog/card-preview; opción photoBackdrop
│   │   └── template-images.routes.ts  # NUEVO: subir, listar y borrar imágenes de plantilla
│   └── context.ts                 # cardMaker y carpeta de tarjetas
└── tests/
    ├── unit/                      # photo-card, layout base, schema, normalize
    └── integration/               # payload con tarjetas, subidas, pdf de la plantilla base, línea base 007

frontend/
├── src/
│   ├── print/
│   │   ├── assets.ts              # IMAGES resuelve 'sparkle', 'chat' y `upload:<archivo>`
│   │   ├── blocks/ProductsBlock.tsx  # tarjeta, nombre dentro, AGOTADO diagonal, neón del precio, sombra, interlineado
│   │   ├── blocks/products-block.css
│   │   └── TemplateElement.tsx    # imagen subida
│   ├── pages/
│   │   ├── Generate.tsx           # opción «Fondo de la foto» con tarjeta de ejemplo
│   │   └── TemplateEditor/
│   │       ├── inspector-fields.ts # campos nuevos del bloque de productos y selector de imagen
│   │       └── panels/ElementosPanel.tsx / PlantillasPanel.tsx  # galería con la quinta plantilla
│   └── assets/print/              # sparkle.svg y chat.svg propios
└── tests/                         # ProductsBlock (modos), Generar, galería, inspector
```

**Structure Decision**: aplicación web existente (frontend + backend en un solo proceso). No se agregan paquetes ni servicios; todo vive en los directorios de arriba.

## Complexity Tracking

> Complejidades que la constitución (VI) exige justificar por escrito.

| Complejidad | Por qué hace falta | Alternativa más simple descartada porque… |
| --- | --- | --- |
| Distribución nueva `base` en `layoutRows` | Las tres existentes (`alternado`, `tarjetas`, `lista`) no reproducen las medidas de la base (foto de 6,10 × 8,03 cm, burbuja de 10,58 × 5,13 cm, paso entre filas ≈ 8,5 cm) y el requisito es 2 mm de tolerancia (SC-001) | Ajustar `alternado` con `photoW`/`photoH` cambiaría el diseño de Neón Noche, que debe quedar idéntico (FR-022) |
| `sold: 'diagonal'` (texto AGOTADO girado −45° con neón) | La base lo usa y el requisito FR-012 pide giro y neón; `sello`, `cinta` y `gris` no lo ofrecen | Reutilizar `cinta` cambiaría el aspecto frente a la base y no cumple la medida |
| Subir imágenes de plantilla (`upload:`) | FR-021 exige que el responsable suba logo e ilustraciones; la 003 solo ofrecía cinco imágenes fijas | Dejar el logo y las ilustraciones como arte incluido en el código obligaría a incorporar arte del negocio al repositorio (prohibido por FR-021) |
| Quitar el fondo con código propio en `sharp` | El responsable pidió la opción; sin servicios externos de pago (supuesto de la spec) | Un modelo de segmentación (U²-Net/ONNX) añade ~40–170 MB y una dependencia nativa; se deja como mejora posterior detrás de la misma interfaz `composeCard` |
| Caché en disco de tarjetas | Evita recomponer ~180 fotos en cada vista previa y generación (SC-009) | Componer en cada petición haría la vista previa lenta (varios segundos por apertura) |
