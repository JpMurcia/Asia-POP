# Implementation Plan: Omitir artículos de Alegra del catálogo

**Branch**: `006-omit-alegra-articles` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`) | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-omit-alegra-articles/spec.md`

## Summary

Hoy el catálogo incluye todo producto activo de Alegra con sección y foto; para sacar uno solo hay que quitar su sección entera o tocar Alegra (que este sistema no hace). La feature agrega **una lista permanente de artículos omitidos**, local, y una pantalla para administrarla. Un artículo omitido no entra a la vista previa ni al PDF, no genera avisos y no cambia los combos que lo usan. El plan, sin dependencias nuevas:

1. **Una sola regla, en el constructor** (FR-005, FR-010): `buildCatalog` recibe `omittedIds` y es lo primero que mira de cada ítem. La lista llega por `loadLocalInputs`, así que la revisión de Generar, la vista previa, el PDF y el resumen de Inicio la reciben sin código propio y **no pueden divergir**. La omisión se aplica *dentro* del bucle de ítems, no antes: los combos siguen resolviendo todos los componentes con sus datos de Alegra (FR-011).
2. **Persistir la marca** (FR-004, FR-006, FR-007): tabla `omitted_item` con el identificador del artículo en Alegra (migración 004) y `OmittedItemRepo`, hermano de `OverrideRepo`. Solo local; nada se escribe en Alegra.
3. **Pantalla «Artículos de Alegra»** (FR-001 a FR-003, FR-011, FR-015): una consulta en vivo trae los ~200 artículos con su marca; búsqueda sin tildes, filtro por sección y vista «Omitidos» se resuelven en el navegador. Omitir y volver a incluir son `PUT`/`DELETE` idempotentes con respuesta inmediata en pantalla.
4. **Verlo y confiar en ello** (FR-008, FR-009, FR-012, FR-013): `report.omittedByChoice` alimenta un aviso informativo en Generar; Sin categoría, la alerta de Generar e Inicio dejan de contar a los omitidos; `prepare` ya no descarga sus fotos; y una **firma** de la lista fijada al preparar hace que `generate` responda `409 omitted_changed` si la lista cambió, en lugar de generar algo distinto de lo revisado.

Decisiones y alternativas en [research.md](./research.md). El detalle de formas está en [data-model.md](./data-model.md) y los contratos en [contracts/](./contracts/).

**Orden de implementación recomendado** (para `/speckit-tasks`): ① núcleo: migración, repositorio y regla en el constructor con sus pruebas unitarias (por sí solo ya hace que una lista guardada saque artículos del catálogo) → ② integración en el servidor: entradas locales, `prepare`, firma y `409`, resumen de Inicio, rutas nuevas y `Sin categoría`, con pruebas de integración → ③ interfaz: pantalla nueva, menú, aviso en Generar, Sin categoría, Inicio y el tono `info` de `Alert` → ④ validación: texto del PDF real sin los omitidos (`test:pdf`) y el quickstart con el simulador y con la cuenta real (manual, solo lectura).

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–005)

**Primary Dependencies**: **ninguna nueva**. Backend: Express, better-sqlite3, Puppeteer, zod, multer, sharp (de 005). Frontend: React, Vite, Tailwind CSS v4, React Router

**Storage**: SQLite local. **Una tabla nueva**, `omitted_item (alegra_item_id TEXT PRIMARY KEY)`, en la migración `004_omitted_items.sql` (el mismo patrón que `category_override`). Sin cambios en `generated_catalog`, plantillas ni archivos en `data/`

**Testing**: Vitest (backend y frontend), supertest, servidor Alegra simulado (`alegra-mock`) con `mock.requests` para comprobar que no se piden fotos de omitidos, `FakeRenderer` para la integración y Chrome real (`npm run test:pdf`) para comprobar el texto del PDF. Nunca contra la cuenta real de forma automática (principio V)

**Target Platform**: Windows 11, navegador moderno en `localhost` (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: SC-009: la lista aparece en < 10 s con ~200 artículos (una sola consulta a Alegra, del orden de la que ya hace Sin categoría) y buscar o filtrar responde en < 1 s (200 filas en memoria, sin ir al servidor). `prepare` se acorta un poco: no descarga las fotos de los omitidos

**Constraints**: Alegra solo lectura; la lista persiste entre reinicios; la omisión sigue al identificador de Alegra, no al nombre; con la lista vacía el catálogo es idéntico al de hoy (FR-014); el PDF coincide siempre con la revisión mostrada (FR-012); sin cambios en `CatalogDocument` ni en las plantillas

**Scale/Scope**: hasta unos 200 artículos (la cuenta real tiene 197 activos). 2 archivos nuevos de backend (repositorio y rutas) + 1 migración, 8 módulos de backend con cambios pequeños, 1 página nueva de frontend y 7 archivos de frontend con cambios menores

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | La omisión es una marca **local** sobre el identificador del artículo; ni omitir, ni incluir, ni la nueva lista escriben en Alegra (`PUT`/`DELETE` ni siquiera la consultan). La prueba que exige `GET` en toda petición a Alegra cubre las rutas nuevas. Los productos propios y combos no se mezclan con esta lista | ✅ |
| II. El catálogo nunca engaña | Una omisión es una **decisión explícita y visible**: la revisión informa cuántos y cuáles se omiten por decisión propia, aparte de los que faltan por foto o sección; el PDF usa siempre la lista revisada (`409` si cambió); un combo con un componente omitido conserva su precio y su alerta de agotado calculados con datos de Alegra; los agotados omitidos no cuentan ni disparan reglas. Las demás reglas (AGOTADO, precios en COP, sin foto fuera del PDF, aborto sin PDF parcial) no se tocan | ✅ |
| III. Seguridad de credenciales | Sin credenciales en juego. Las rutas nuevas quedan detrás de la sesión (se agregan a la prueba de guardia); las respuestas no llevan fotos ni direcciones firmadas; el identificador se valida (≤ 64 caracteres) | ✅ |
| IV. Fidelidad visual | **No se toca `CatalogDocument` ni ninguna plantilla**: solo cambia qué artículos trae el payload. Editor, vista previa y PDF siguen dibujando con el mismo componente. Las páginas se reagrupan de a 3 por la regla de siempre. Neón Noche se revisa contra `docs/Cat.pdf` en el quickstart (escenario 8) | ✅ |
| V. Pruebas sobre las reglas | Pruebas unitarias del constructor (exclusión, avisos, agotados, fotos, combos, secciones vacías, lista vacía idéntica), del repositorio (idempotencia, firma, persistencia entre aperturas de la base) y de integración (rutas, `prepare`, `409`, Inicio, Sin categoría, solo `GET` a Alegra), del PDF real (texto sin los omitidos) y de las seis pantallas tocadas. Respuestas simuladas, nunca la cuenta real | ✅ |
| VI. Simplicidad | **Sin dependencia nueva.** Una tabla de una columna, un repositorio, un archivo de rutas, una página. Sin omisión por reglas, sin bloque, sin fecha, sin historial de omisiones, sin nombre guardado, sin paginación (research §11). La complejidad añadida se justifica abajo | ✅ |

Sin violaciones: **no hace falta enmendar la constitución**.

Re-evaluación tras el diseño (Fase 1): sin violaciones pendientes. El único punto que el diseño tuvo que defender fue el principio II frente al comportamiento actual de «instantánea al preparar»: se resuelve con la firma y el `409` (research §4), y se limita a la lista de omitidos para no cambiar el comportamiento de «Sin categoría».

## Project Structure

### Documentation (this feature)

```text
specs/006-omit-alegra-articles/
├── plan.md
├── research.md                  # hallazgos del código, decisiones y alternativas
├── data-model.md                # tabla omitted_item, entrada del constructor, informe, preparación, resumen y vista de la lista
├── quickstart.md                # validación: pruebas, simulador y cuenta real (manual, solo lectura)
├── contracts/
│   ├── rest-api.md              # 3 rutas nuevas y cambios aditivos (informe, uncategorized, resumen) + el 409 de generate
│   └── articles-ui.md           # pantalla Artículos de Alegra, aviso en Generar, Sin categoría e Inicio (textos incluidos)
├── checklists/
│   └── requirements.md
└── tasks.md                     # lo crea /speckit-tasks
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── src/
│   ├── db/migrations/
│   │   └── 004_omitted_items.sql        # NUEVO · tabla omitted_item
│   ├── custom/
│   │   └── omitted-item.repo.ts         # NUEVO · OmittedItemRepo (all/add/remove) y omittedSignature()
│   ├── catalog/
│   │   ├── catalog-builder.ts           # CAMBIA · omittedIds (primera regla por ítem), report.omittedByChoice, fuera de photos.informed
│   │   ├── catalog-inputs.ts            # CAMBIA · loadLocalInputs entrega omittedIds
│   │   ├── catalog.service.ts           # CAMBIA · prepare no descarga fotos de omitidos y fija la firma; generate compara y responde 409
│   │   ├── prepare-store.ts             # CAMBIA · la preparación guarda omittedSignature
│   │   ├── panel-summary.ts             # CAMBIA · stats.omitted y soldOut sin omitidos
│   │   └── types.ts                     # CAMBIA · ReviewReport.omittedByChoice, PanelSummary.stats.omitted
│   ├── api/
│   │   ├── articles.routes.ts           # NUEVO · GET /catalog/articles, PUT y DELETE /catalog/omitted/:itemId
│   │   └── uncategorized.routes.ts      # CAMBIA · cada ítem trae omitted
│   └── app.ts                           # CAMBIA · registra articlesRoutes
└── tests/
    ├── unit/
    │   ├── omitted-items.test.ts        # NUEVO · regla del constructor: exclusión, avisos, agotados, fotos, combos, secciones vacías, lista vacía idéntica
    │   └── omitted-item-repo.test.ts    # NUEVO · idempotencia, firma estable, persistencia al reabrir la base
    └── integration/
        ├── omitted-articles.test.ts     # NUEVO · rutas, prepare (sin descargar fotos), 409, payload, Inicio, Sin categoría, solo GET a Alegra, errores de Alegra
        ├── auth-guard.test.ts           # CAMBIA · las 3 rutas nuevas sin sesión → 401
        ├── panel-summary.test.ts        # CAMBIA · stats.omitted y agotados sin omitidos
        └── pdf-render.test.ts           # CAMBIA · con Chrome real, un omitido no aparece en el texto del PDF (npm run test:pdf)

frontend/
├── src/
│   ├── pages/
│   │   ├── Articles.tsx                 # NUEVO · pantalla Artículos de Alegra
│   │   ├── Generate.tsx                 # CAMBIA · aviso informativo de omitidos
│   │   ├── Uncategorized.tsx            # CAMBIA · etiqueta «Omitido», pendientes sin omitidos
│   │   └── Home.tsx                     # CAMBIA · nota de «Productos activos en Alegra» con omitidos
│   ├── components/
│   │   ├── Sidebar.tsx                  # CAMBIA · entrada «Artículos de Alegra»
│   │   ├── UncategorizedAlert.tsx       # CAMBIA · no cuenta omitidos
│   │   └── ui/Alert.tsx                 # CAMBIA · tono info
│   └── App.tsx                          # CAMBIA · ruta /articulos
└── tests/
    ├── articles.test.tsx                # NUEVO · lista, búsqueda sin tildes, filtros, omitir/incluir (éxito y fallo), combos, errores de Alegra
    ├── generate.test.tsx                # CAMBIA · aviso de omitidos (singular/plural, más de 30) y mensaje del 409
    ├── screens.test.tsx                 # CAMBIA · Sin categoría con omitidos
    ├── home.test.tsx                    # CAMBIA · nota con omitidos; fixture stats.omitted
    ├── sidebar.test.tsx                 # CAMBIA · nueva entrada en el orden; fixture stats.omitted
    └── parity.test.tsx                  # CAMBIA · fixture stats.omitted
```

**Structure Decision**: se conserva la aplicación web de un solo proceso (backend + frontend) de 001–005. La regla vive en el módulo que ya concentra las reglas del catálogo (`catalog-builder.ts`) y el almacenamiento en la carpeta de datos locales (`custom/`) junto a `OverrideRepo`, que es su molde. La ruta nueva va en su propio archivo (`articles.routes.ts`) porque agrupa tres endpoints de un concepto nuevo; «Sin categoría» no se amplía más de lo necesario.

### Cobertura de la spec

| Requisito | Dónde se cumple |
| --- | --- |
| FR-001, FR-003 | `articles.routes.ts` (GET) y `Articles.tsx` (lista, búsqueda, sección, vistas con conteos) |
| FR-002 | `articles.routes.ts` (PUT/DELETE idempotentes) y `Articles.tsx` (cambio inmediato, vuelve atrás si falla) |
| FR-004, FR-006 | `004_omitted_items.sql` + `omitted-item.repo.ts` (clave: identificador de Alegra; sobrevive a reinicios) |
| FR-005, FR-013, FR-014 | `catalog-builder.ts` (primera regla por ítem; `availableSections` ya descarta secciones vacías; sin lista = igual que hoy) |
| FR-007 | Ninguna ruta de esta feature llama a Alegra con otro método que `GET`, y `PUT`/`DELETE` no la llaman; lo comprueba la prueba existente de solo `GET` |
| FR-008 | `catalog-builder.ts` (`omittedByChoice`), `Generate.tsx` (aviso con nombres y enlace) |
| FR-009 | `catalog-builder.ts` (los omitidos no se clasifican ni cuentan en `photos.informed`), `Uncategorized.tsx`, `UncategorizedAlert.tsx` |
| FR-010 | `catalog-inputs.ts` (misma lista para `prepare` y el resumen), `panel-summary.ts` (`omitted`, `soldOut`), `Home.tsx` |
| FR-011 | `catalog-builder.ts` (`alegraById` sin filtrar), `articles.routes.ts` (`bundles`), `Articles.tsx` (nota) |
| FR-012 | `catalog.service.ts` + `prepare-store.ts` + `omitted-item.repo.ts` (firma y `409 omitted_changed`) |
| FR-015 | `Articles.tsx` (mensaje del servidor, enlace a la conexión, «Reintentar»); la lista guardada no se toca en ningún error |
| FR-016 | Las suites de pruebas listadas arriba (unitarias, de integración, Chrome real y de las pantallas) |
| SC-009 | Una sola consulta en vivo; filtros en memoria; medido a mano en el quickstart (escenario 8) |

## Complexity Tracking

Sin violaciones de la constitución. Lo que podría parecer extra, o requiere justificación por escrito:

| Añadido | Por qué hace falta | Alternativa más simple descartada |
| --- | --- | --- |
| Tabla nueva `omitted_item` (migración 004) | La spec exige que la lista sea permanente (FR-004) y consultable por artículo (FR-002); es el mismo patrón que `category_override` | Un JSON en los ajustes (no se actualiza un artículo sin reescribir todo) o un archivo suelto (otra forma de persistir, sin transacciones). Research §2 |
| Firma de la lista + `409 omitted_changed` | La revisión es una instantánea y FR-012 prohíbe generar con una lista distinta sin avisar (principio II) | Leer la lista al generar (el PDF podría no coincidir con la revisión) o volver a preparar a escondidas (~20 s sin avisar). Research §4 |
| Filtros en el navegador con la lista completa | 200 filas caben sin problema y la búsqueda debe responder en < 1 s (SC-009) | Parámetros de consulta y paginación: más código y una búsqueda más lenta para un volumen que no lo necesita. Research §8 |
| Tono `info` en `Alert` | Una omisión es una decisión de la persona, no un problema: pintarla de advertencia la acostumbraría a ignorar los avisos amarillos | Reutilizar `warning`. Research §10 |
