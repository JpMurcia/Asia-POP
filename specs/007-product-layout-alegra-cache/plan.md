# Implementation Plan: Productos del catálogo más claros y datos de Alegra guardados

**Branch**: `007-product-layout-alegra-cache` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`) | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-product-layout-alegra-cache/spec.md`

## Summary

Cinco mejoras sobre lo que ya existe, sin dependencias nuevas: (1) la persona controla el **tamaño de la zona y de la foto** de los productos, (2) el **nombre del producto va aparte, en neón**, como en `docs/Cat.pdf`, con el texto ajustado para verse completo, (3) los **datos de Alegra se guardan en el equipo** para no descargarlos en cada pantalla, (4) **Artículos de Alegra** gana pantalla de carga y filtro por categorías y (5) se **ajusta el diseño** de esa pantalla y de Apariencia, con un botón de **Consejos**. El plan:

1. **El bloque de productos aprende dos cosas** (FR-001 a FR-013). `ProductsEl` gana seis campos (`photoW`, `photoH`, `nameStyle`, `nameColor`, `nameFill`, `nameGlow`); `layoutRows` (módulo puro que ya comparten editor, miniaturas y PDF) recibe esas opciones, entrega un rectángulo `name` por fila y calcula los **límites** de la foto (`photoScaleLimits`). Con las opciones en su valor de origen, la geometría es **idéntica** a la de hoy. El nombre se dibuja con el mismo `ProductRow` para productos de Alegra, propios y combos. La letra del nombre y de las opciones se ajusta con el `useFit` de siempre, que además marca `data-clipped` cuando recorta.
2. **Avisar lo que no cabe** (FR-013). La vista `Print` junta los productos con texto recortado o desbordado, `PuppeteerRenderer` los lee y el trabajo los entrega como `textOverflow`; Generar los muestra al terminar. Es el único momento en que se miden las fuentes reales, y por eso es un ajuste menor a la spec (research §4).
3. **Una copia local de Alegra** (FR-014 a FR-022). Una tabla de una fila (`alegra_snapshot`, migración 005) y un `AlegraDataService` con `get`, `refresh`, `store` y `discard`: los seis lugares que hoy consultan Alegra en cada apertura leen la copia; `prepare` conserva su propia descarga (las fotos vencen) y la guarda como copia nueva; guardar la conexión la descarga en segundo plano y la descarta si la cuenta cambia. Dos rutas nuevas informan el avance y piden la actualización.
4. **Pantalla de carga, categorías y barra de datos** (FR-023 a FR-025). Un `LoadingScreen` que reserva el espacio, un `AlegraDataBar` reutilizable («Datos de Alegra actualizados hace N min · Actualizar desde Alegra») y etiquetas de categoría con conteos que reemplazan al selector de sección.
5. **Diseño y Consejos** (FR-026, FR-027). El inspector del bloque de productos se reordena en secciones (la de tamaño, arriba y visible), la pantalla de Artículos agrupa sus herramientas en una tarjeta, y un `TipsPanel` con 7 consejos se abre desde la barra superior sin tocar el estado del editor.

Decisiones y alternativas en [research.md](./research.md). El detalle de formas está en [data-model.md](./data-model.md) y los contratos en [contracts/](./contracts/).

**Orden de implementación recomendado** (para `/speckit-tasks`): ① **copia local de Alegra** en el servidor, con sus pruebas (por sí sola ya acelera todas las pantallas y no depende de nada visual) → ② **geometría y esquema del bloque de productos** (`template.ts`, `template-layout.ts`, esquema, presets y normalización al leer), con pruebas unitarias → ③ **dibujo** del nombre separado y ajuste de texto (`ProductsBlock`, CSS, `useFit`) y el aviso de textos recortados (`Print`, renderizador, trabajo) → ④ **interfaz**: inspector de tamaño y nombre, Consejos, barra de datos, pantalla de carga, categorías, Generar, Conexión e Inicio → ⑤ **validación**: PDF real contra `docs/Cat.pdf`, quickstart con el simulador y con la cuenta real (manual, solo lectura).

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–006)

**Primary Dependencies**: **ninguna nueva**. Backend: Express, better-sqlite3, Puppeteer, zod, multer, sharp. Frontend: React, Vite, Tailwind CSS v4, React Router

**Storage**: SQLite local. **Una tabla nueva**, `alegra_snapshot` (una fila: cuenta, instante, formato, artículos y categorías en JSON), en la migración `005_alegra_data.sql`. Los seis campos nuevos del bloque de productos viajan dentro del documento de plantilla que ya se guarda (`doc_json`): sin columnas ni migración de datos, porque las plantillas guardadas se completan al leerlas. Sin cambios en `generated_catalog`, `omitted_item`, `category_override` ni en los archivos de `data/`

**Testing**: Vitest (backend y frontend), supertest, servidor Alegra simulado (`alegra-mock`) con `mock.requests` para comprobar que **abrir pantallas no consulta Alegra**, `FakeRenderer` para la integración y Chrome real (`npm run test:pdf`, `print-overflow`) para el nombre separado, el texto completo y los avisos. Nunca contra la cuenta real de forma automática (principio V). Las suites que cambian los datos del simulador entre dos lecturas piden la actualización explícita (research §11)

**Target Platform**: Windows 11, navegador moderno en `localhost` (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: SC-005: las pantallas con datos de Alegra aparecen en < 2 s con copia (hoy esperan a Alegra, ~20 s con 197 artículos); SC-006: la primera descarga de ~200 artículos en < 1 min con avance visible; SC-009: filtrar por categoría en < 1 s (en memoria); SC-001: el cambio de tamaño se ve en < 1 s (el mismo dibujo del editor, sin ida al servidor). `prepare` y la generación **no se alargan**: no hay descargas extra

**Constraints**: Alegra solo lectura (las descargas usan solo `GET`); la copia no guarda credenciales, direcciones de fotos ni productos propios; un PDF siempre sale con datos de la preparación recién descargada (principio II); con las opciones de tamaño y nombre en su valor de origen, la geometría de las filas es la de hoy (SC-004); las plantillas guardadas no cambian de aspecto salvo `neon`; sin cambios en `CatalogDocument`, portadas, pie, políticas ni calidad del PDF; una sola descarga de la copia a la vez

**Scale/Scope**: hasta unos 200 artículos (la cuenta real tiene 197 activos) y unas 20 categorías. 4 archivos nuevos de backend (repositorio, servicio, rutas y migración) + 1 página de ayuda y 3 componentes nuevos de frontend + 1 hook; ~15 módulos de backend y ~14 de frontend con cambios acotados

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | La copia se llena **solo con `GET`** (la prueba que exige `GET` en toda petición a Alegra cubre las descargas nuevas). Se guarda en una tabla **aparte** de los productos propios y las marcas locales (omitidos, asignaciones, combos), que se siguen leyendo en cada petición. Ni omitir, ni asignar sección, ni las dos rutas nuevas escriben en Alegra | ✅ |
| II. El catálogo nunca engaña | **Un PDF nunca sale de la copia**: `prepare` descarga en vivo (precios, inventario y fotos del momento) y, si falla, aborta sin PDF parcial; la copia solo alimenta pantallas de consulta y muestra su antigüedad, y un error de actualización no la reemplaza ni la oculta. El nombre separado no cambia ninguna regla visible: AGOTADO, precios en COP y sin foto fuera del PDF se mantienen, y el sello **no oculta** nombre ni precio. Un texto que no cabe **se avisa** al terminar la generación en lugar de cortarse en silencio | ✅ |
| III. Seguridad de credenciales | Sin credenciales en juego: la copia no guarda token, correo de acceso a Alegra ni direcciones firmadas (solo el correo de la cuenta, para saber de quién son los datos, que ya vive en `alegra_connection`). Las dos rutas nuevas quedan detrás de la sesión (prueba de guardia), sin token en respuestas ni en el registro de errores | ✅ |
| IV. Fidelidad visual | **Neón Noche adopta el nombre en neón de `docs/Cat.pdf`** y conserva foto, burbuja y precio donde estaban. Editor, vista previa y PDF siguen dibujando con **el mismo `ProductsBlock`** y la misma geometría pura (`layoutRows`); no se toca `CatalogDocument`. El PDF real de Neón Noche se compara con `docs/Cat.pdf` en el quickstart (escenarios 3 y 10). Las demás plantillas conservan su aspecto | ✅ |
| V. Pruebas sobre las reglas | Pruebas unitarias de la geometría (origen idéntico, límites, 0/1/2/3 productos, tres distribuciones), del esquema y la normalización de plantillas, del servicio de la copia (descarga única, reemplazo atómico, falla que conserva, cambio de cuenta, formato distinto, descargas simultáneas) y de integración (`mock.requests` sin cambios al abrir pantallas, `prepare` guarda la copia, rutas nuevas, `textOverflow`), de Chrome real (nombre separado, texto completo, `data-clipped`) y de las pantallas tocadas. Respuestas simuladas, nunca la cuenta real | ✅ |
| VI. Simplicidad | **Sin dependencia nueva.** Una tabla de una fila, un servicio, dos rutas, un componente de carga, una barra y un panel. Sin actualización programada, sin tabla por artículo, sin medidas absolutas ni por producto, sin migración de plantillas en la base, sin tutorial (research §12). La complejidad añadida se justifica abajo | ✅ |

Sin violaciones: **no hace falta enmendar la constitución**.

Re-evaluación tras el diseño (Fase 1): sin violaciones pendientes. Los dos puntos que el diseño tuvo que defender fueron el principio II frente a la copia (resuelto: el PDF **nunca** sale de ella, `prepare` descarga en vivo y la renueva, research §5) y el principio IV frente a la geometría nueva (resuelto: `layoutRows` con opciones de origen devuelve exactamente la geometría de hoy y los recortes que nacen de espacio ya libre mantienen foto, burbuja y precio de Neón Noche en su sitio, research §2).

## Project Structure

### Documentation (this feature)

```text
specs/007-product-layout-alegra-cache/
├── plan.md
├── research.md                  # hallazgos del código, decisiones y alternativas
├── data-model.md                # alegra_snapshot, estado de los datos, campos del bloque, normalización, textOverflow
├── quickstart.md                # validación: pruebas, simulador y cuenta real (manual, solo lectura)
├── contracts/
│   ├── rest-api.md              # 2 rutas nuevas y cambios aditivos en las existentes
│   └── ui.md                    # Apariencia (tamaño, nombre, Consejos), Artículos, barra de datos, Generar (textos incluidos)
├── checklists/
│   └── requirements.md
└── tasks.md                     # lo crea /speckit-tasks
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── src/
│   ├── db/migrations/
│   │   └── 005_alegra_data.sql              # NUEVO · tabla alegra_snapshot
│   ├── alegra/
│   │   ├── alegra-data.repo.ts              # NUEVO · AlegraDataRepo: leer, reemplazar y borrar la copia; SnapshotItem
│   │   ├── alegra-data.service.ts           # NUEVO · AlegraDataService: get / refresh / store / discard / status (una descarga a la vez)
│   │   ├── alegra.client.ts                 # CAMBIA · onProgress opcional en la paginación
│   │   └── alegra.mapper.ts                 # CAMBIA · toSnapshotItem y snapshotToNormalized (hasPhoto)
│   ├── api/
│   │   ├── alegra-data.routes.ts            # NUEVO · GET /alegra/data y POST /alegra/data/refresh
│   │   ├── alegra-settings.routes.ts        # CAMBIA · cuenta distinta descarta la copia; inicia la descarga; respuesta con data
│   │   ├── articles.routes.ts               # CAMBIA · lee la copia
│   │   ├── uncategorized.routes.ts          # CAMBIA · lee la copia
│   │   ├── bundles.routes.ts                # CAMBIA · lee la copia
│   ├── catalog/
│   │   ├── sections.service.ts              # CAMBIA · categorías de la copia
│   │   ├── panel-summary.ts                 # CAMBIA · calcula con la copia, sin caché de 60 s; ?refresh=1 actualiza la copia; syncError
│   │   ├── catalog.service.ts               # CAMBIA · prepare guarda la copia (store); el trabajo recoge textOverflow
│   │   ├── template.ts                      # CAMBIA · seis campos de ProductsEl, RANGES.photoScale, PRODUCTS_ZONE_MIN
│   │   ├── template.schema.ts               # CAMBIA · validación de los campos nuevos y de la zona mínima
│   │   ├── template-presets.ts              # CAMBIA · valores de cada plantilla base
│   │   ├── template-layout.ts               # CAMBIA · opciones, rectángulo name, photoScaleLimits
│   │   ├── template.repo.ts                 # CAMBIA · normaliza los campos que falten al leer
│   │   └── types.ts                         # CAMBIA · AlegraDataStatus, TextOverflow, PanelSummary.alegra.syncError
│   ├── pdf/
│   │   ├── pdf.service.ts                   # CAMBIA · el renderizador lee window.__printTextOverflow (parámetro de salida opcional)
│   │   └── job.ts                           # CAMBIA · JobState.textOverflow en done
│   ├── context.ts                           # CAMBIA · ctx.alegraData
│   └── app.ts                               # CAMBIA · registra alegraDataRoutes
└── tests/
    ├── fixtures/
    │   ├── alegra-mock.ts                   # CAMBIA · opciones de demora (delayMs) para la pantalla de carga
    │   └── dev-mock.ts                      # CAMBIA · MOCK_ITEMS, MOCK_DELAY_MS y MOCK_LOG (quickstart)
    ├── helpers.ts                           # CAMBIA · refreshAlegraData(agent): pide la actualización y espera
    ├── unit/
    │   ├── alegra-data-repo.test.ts         # NUEVO · reemplazo atómico, formato, borrar, JSON sin direcciones de fotos
    │   ├── alegra-data-service.test.ts      # NUEVO · descarga única, simultáneas, falla conserva, cambio de cuenta, store, progreso
    │   ├── layout-rows.test.ts              # CAMBIA · origen idéntico, escalas, límites, name, 0/1/2/3 productos
    │   ├── template-schema.test.ts          # CAMBIA · campos nuevos, rangos, zona mínima
    │   ├── template-presets.test.ts         # CAMBIA · valores por plantilla base
    │   └── template.test.ts                 # CAMBIA · constantes
    └── integration/
        ├── alegra-data.test.ts              # NUEVO · rutas, primera lectura, mock.requests sin cambios con copia, refresh, error, cuenta, prepare guarda la copia
        ├── template-migration.test.ts       # CAMBIA · plantilla guardada sin los campos nuevos se completa al leer (neon vs otras)
        ├── templates.test.ts                # CAMBIA · PUT con los campos nuevos y mensajes de 422
        ├── auth-guard.test.ts               # CAMBIA · las 2 rutas nuevas sin sesión → 401
        ├── panel-summary.test.ts            # CAMBIA · sin caché de 60 s; leer no consulta; ?refresh=1 sí; syncError
        ├── omitted-articles.test.ts         # CAMBIA · actualización explícita tras cambiar el simulador
        ├── uncategorized.test.ts            # CAMBIA · idem
        ├── bundles.test.ts                  # CAMBIA · idem
        ├── catalog-generate.test.ts         # CAMBIA · textOverflow en el trabajo terminado
        ├── security.test.ts                 # CAMBIA · solo GET a Alegra también en las descargas de la copia
        ├── print-overflow.test.ts           # CAMBIA · nombre separado, opciones partidas, data-clipped, con las cuatro plantillas (npm run test:pdf)
        └── pdf-render.test.ts               # CAMBIA · el texto del PDF real trae el nombre fuera de la burbuja (npm run test:pdf)

frontend/
├── src/
│   ├── print/
│   │   ├── blocks/ProductsBlock.tsx         # CAMBIA · rótulo del nombre, burbuja sin nombre, opciones y useFit del nombre
│   │   ├── blocks/products-block.css        # CAMBIA · estilos del rótulo, opciones que se parten, data-clipped
│   │   └── useFit.ts                        # CAMBIA · marca data-clipped al aplicar lastResort
│   ├── pages/
│   │   ├── Print.tsx                        # CAMBIA · window.__printTextOverflow
│   │   ├── TemplateEditor/
│   │   │   ├── inspector-fields.ts          # CAMBIA · secciones del bloque de productos, campos nuevos, nota y botón de restaurar
│   │   │   ├── FieldRenderer.tsx            # CAMBIA · tipos de campo «note» y «button»
│   │   │   ├── Inspector.tsx                # CAMBIA · calcula límites y los pasa a la nota
│   │   │   ├── useTemplateEditor.ts         # CAMBIA · recorte de zona mínima y de escalas con aviso; restaurar tamaños en un paso
│   │   │   ├── TopBar.tsx                   # CAMBIA · botón «Consejos»
│   │   │   ├── TipsPanel.tsx                # NUEVO · panel de consejos (diálogo con foco contenido)
│   │   │   ├── editor-tips.ts               # NUEVO · los 7 consejos
│   │   │   ├── index.tsx                    # CAMBIA · abre y cierra el panel; atajos en pausa mientras está abierto
│   │   │   └── editor.css                   # CAMBIA · estilos de secciones, nota, botón y panel
│   │   ├── Articles.tsx                     # CAMBIA · tarjeta de herramientas, categorías con conteos, pantalla de carga, barra de datos
│   │   ├── Uncategorized.tsx                # CAMBIA · barra de datos y pantalla de carga
│   │   ├── Bundles.tsx                      # CAMBIA · barra de datos
│   │   ├── AlegraSettings.tsx               # CAMBIA · avance de la primera descarga y aviso de cambio de cuenta
│   │   ├── Home.tsx                         # CAMBIA · antigüedad de la copia y aviso de error de actualización
│   │   └── Generate.tsx                     # CAMBIA · aviso de textOverflow al terminar
│   ├── components/
│   │   ├── AlegraDataBar.tsx                # NUEVO · estado de los datos, actualizar y reintentar
│   │   └── ui/LoadingScreen.tsx             # NUEVO · pantalla de carga con esqueleto, mensaje y avance
│   └── hooks/useAlegraData.ts               # NUEVO · estado de la copia, consulta cada ~800 ms mientras descarga, refresh
└── tests/
    ├── alegra-data-bar.test.tsx             # NUEVO · estados, actualizar, reintentar, recarga de la lista
    ├── loading-screen.test.tsx              # NUEVO · umbral de 300 ms, avance, espacio reservado
    ├── articles.test.tsx                    # CAMBIA · categorías con conteos, combinación con búsqueda y vista, sin resultados, pantalla de carga
    ├── tips-panel.test.tsx                  # NUEVO · abrir, cerrar (botón, Esc, fuera), foco, estado del editor intacto
    ├── template-editor-inspector.test.tsx   # CAMBIA · sección de tamaño, límites con mensaje, restaurar, estilo del nombre
    ├── template-editor-reducer.test.ts      # CAMBIA · recortes y restaurar en un solo paso de deshacer
    ├── template-page.test.tsx               # CAMBIA · nombre separado, burbuja sin nombre ni vacía, tres distribuciones
    ├── catalog-document.test.tsx            # CAMBIA · productos de Alegra, propios y combos con el mismo rótulo
    ├── use-fit.test.tsx                     # CAMBIA · data-clipped
    ├── generate.test.tsx                    # CAMBIA · aviso de textOverflow
    ├── home.test.tsx · screens.test.tsx     # CAMBIAN · antigüedad de la copia, barra de datos, syncError
    ├── sidebar.test.tsx · parity.test.tsx   # CAMBIAN · fixtures de plantilla con los campos nuevos
    └── editor-helpers.tsx                   # CAMBIA · fixtures con los campos nuevos
```

**Structure Decision**: se conserva la aplicación web de un solo proceso (backend + frontend) de 001–006. La copia vive en la carpeta que ya agrupa todo lo de Alegra (`backend/src/alegra/`), con un repositorio (SQLite) y un servicio (cuándo descargar) separados, porque el servicio se prueba sin base de datos. La geometría sigue en el módulo puro `template-layout.ts`, que es lo que garantiza que editor, miniaturas y PDF dibujen igual. La ruta nueva va en su propio archivo (`alegra-data.routes.ts`) porque es un concepto nuevo con dos endpoints; las demás rutas solo cambian de dónde leen.

### Cobertura de la spec

| Requisito | Dónde se cumple |
| --- | --- |
| FR-001, FR-002 | `inspector-fields.ts`, `FieldRenderer.tsx` (sección «Tamaño de los productos»), `template.ts`/`template.schema.ts` (`photoW`, `photoH`) |
| FR-003, FR-004 | `template-layout.ts` (`layoutRows`, `photoScaleLimits`), `useTemplateEditor.ts` (recorte con aviso), `template.schema.ts` (zona mínima) |
| FR-005 | `template-presets.ts` (100/100), `template.repo.ts` (normalización), botón «Restaurar tamaños originales», `layout-rows.test.ts` (origen idéntico) |
| FR-006 | `ProductsBlock.tsx` + `template-layout.ts` compartidos por editor, miniaturas y PDF; `template-page.test.tsx`, `pdf-render.test.ts` |
| FR-007 a FR-009 | `ProductsBlock.tsx`, `products-block.css`, `template-presets.ts` (Neón Noche separado), `template.repo.ts` (neon vs otras), inspector («Nombre del producto») |
| FR-010, FR-011 | `ProductRow` único para Alegra, propios y combos; burbuja omitida si queda vacía; la insignia de agotado en la foto no toca el rótulo |
| FR-012 | `useFit` del nombre y de la burbuja, opciones que se parten (`products-block.css`), `print-overflow.test.ts` |
| FR-013 | `useFit` (`data-clipped`), `Print.tsx`, `pdf.service.ts`, `job.ts`, `Generate.tsx` (aviso al terminar), editor (advertencia por bloque que ya existe) |
| FR-014 a FR-016 | `alegra-data.service.ts`, `alegra-data.routes.ts`, `alegra-settings.routes.ts` (primera descarga), `AlegraDataBar.tsx`, rutas de lectura |
| FR-017 | `catalog.service.ts` (`prepare` descarga en vivo y guarda la copia) |
| FR-018, FR-019 | `005_alegra_data.sql`, `alegra-data.repo.ts` (sin direcciones ni credenciales), `alegra-settings.routes.ts` (descarta si cambia el correo) |
| FR-020, FR-021 | `alegra-data.service.ts` (falla conserva, una descarga a la vez, reemplazo atómico), `AlegraDataBar.tsx` («No se pudo actualizar…») |
| FR-022 | `security.test.ts` (solo `GET`), las demás rutas siguen leyendo omitidos, asignaciones y combos en cada petición |
| FR-023 | `LoadingScreen.tsx`, `Articles.tsx`, `useAlegraData.ts` |
| FR-024, FR-025 | `Articles.tsx` (categorías, conteos, combinación, limpiar), `articles.test.tsx` (incluye lo de 006) |
| FR-026 | `Articles.tsx`, `inspector-fields.ts`, `editor.css`, `panel-layout.test.ts` |
| FR-027 | `TopBar.tsx`, `TipsPanel.tsx`, `editor-tips.ts`, `tips-panel.test.tsx` |
| FR-028 | Las suites listadas arriba (unitarias, de integración, Chrome real y de las pantallas) |
| SC-001 | `useTemplateEditor.ts` (sin ida al servidor), `editor-perf` existente, `layout-rows.test.ts` (0/1/2/3 productos) |
| SC-002 | Quickstart escenarios 3 y 10 (comparación con `docs/Cat.pdf`, aprobación del responsable) |
| SC-003 | `print-overflow.test.ts`, `Generate.tsx`, quickstart escenarios 4 y 10 |
| SC-004 | `layout-rows.test.ts` (origen idéntico), `pdf-template-fidelity.test.ts` existente, quickstart escenario 9 |
| SC-005, SC-006 | `alegra-data.test.ts` (`mock.requests` sin cambios), quickstart escenarios 5, 8 y 10 |
| SC-007 | `alegra-data.test.ts` (`prepare` renueva la copia; con Alegra caído no hay PDF) |
| SC-008 | `loading-screen.test.tsx`, quickstart escenario 6 |
| SC-009 | `articles.test.tsx`, quickstart escenario 6 |
| SC-010 | `tips-panel.test.tsx`, quickstart escenario 7 |

## Complexity Tracking

Sin violaciones de la constitución. Lo que podría parecer extra, o requiere justificación por escrito:

| Añadido | Por qué hace falta | Alternativa más simple descartada |
| --- | --- | --- |
| Tabla `alegra_snapshot` + `AlegraDataService` (migración 005) | La persona pide que los datos de Alegra se guarden y sobrevivan a un reinicio (FR-014, FR-018); seis lugares leen de ella | Una caché en memoria con más vida: no sobrevive al reinicio, que es justo lo que se pidió (research §5) |
| Estado y progreso de la descarga (`GET /api/alegra/data` con consulta periódica) | La pantalla de carga necesita mostrar el avance mientras la petición de la pantalla espera la primera descarga | Un `409 sin datos` en cada ruta y reintentos del cliente: seis pantallas con la misma lógica (research §6) |
| Seis campos nuevos en el bloque de productos | Tamaño de la foto y estilo del nombre son preferencias de cada plantilla; el nombre en neón necesita su rótulo oscuro para leerse sobre mármol (research §2) | Un único `nameColor` con el resto fijo: el neón sobre mármol no se lee. Medidas absolutas de la foto: cambian de significado con la distribución |
| `textOverflow` desde Chrome hasta Generar | Solo el navegador que genera el PDF conoce las medidas reales de texto; sin esto no hay forma de decir «no cupo» (research §4) | Estimar en el servidor con métricas aproximadas, o un render de prueba extra en `prepare` que duplica el trabajo de Chrome |
| `TipsPanel` con 7 consejos | La spec pide un botón de consejos; vive fuera del reductor para no ensuciar el historial ni los cambios sin guardar | Un texto fijo en el inspector (ya existe «Atajos» y se ignora) o un tutorial paso a paso (fuera de alcance) |
| Opciones nuevas del simulador (`MOCK_ITEMS`, `MOCK_DELAY_MS`, `MOCK_LOG`) | El quickstart necesita 200 artículos, una demora que haga visible la pantalla de carga y ver que no hay peticiones | Probar a mano con 10 artículos y sin demora: la pantalla de carga y el rendimiento no se verían |
