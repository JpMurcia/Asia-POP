# Implementation Plan: Panel de administración y personalización del catálogo

**Branch**: `002-admin-panel-theming` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`) | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-panel-theming/spec.md`

## Summary

Extiende la aplicación de la feature 001 (backend Express + frontend React ya funcionales) en cuatro frentes: (1) rehacer el panel de administración con la dirección visual **1b "Pop"** del mockup (barra lateral morada, fondo crema, acentos rosa/ámbar, tipografía redondeada), con una pantalla **Inicio** (indicadores, secciones, último catálogo) y contadores de alertas; (2) enriquecer Generar catálogo con selección de secciones, ocultar agotados, texto de banner y una **vista previa de estructura** que se recalcula en el servidor sin volver a consultar Alegra, corrigiendo de paso que el informe y las decisiones de combos ignoraban las secciones desmarcadas; (3) agregar un **editor de tema** (fondo + tres acentos + banner + contacto) guardado en SQLite, que viaja en el `CatalogPayload` como variables CSS para que vista previa y PDF usen el mismo tema, con control de edición concurrente entre pestañas; (4) completar la fidelidad del PDF: pie con teléfonos y dirección en las páginas de producto y de políticas, y textos largos sin desbordar. El tema recolorea **solo los elementos dibujados con CSS**, siempre anclados al color de fondo; las imágenes de portada y el mármol de Cat.pdf no cambian. La invocación externa (n8n) quedó fuera por decisión del responsable. Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x estricto, Node.js 22 LTS (sin cambios respecto a 001)

**Primary Dependencies**: Backend: Express, better-sqlite3, Puppeteer, zod, multer (sin cambios). Frontend: React, Vite, Tailwind CSS v4, React Router (sin cambios) + `@fontsource/fredoka` y `@fontsource/nunito-sans` (fuentes locales del estilo Pop)

**Storage**: SQLite `data/app.db`: una migración nueva (`002_theme.sql`) con la tabla `catalog_theme`; `params_json` del historial guarda además el número de páginas; sin otras tablas nuevas

**Testing**: Vitest (backend y frontend), supertest, servidor Alegra simulado, `pdf-parse`, Puppeteer para la prueba de desbordamiento; revisión visual manual contra el mockup 1b y `docs/Cat.pdf`

**Target Platform**: Windows 11, navegador moderno en `localhost` (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: recalcular la vista previa de estructura en < 1 s (no llama a Alegra); guardar tema < 1 s; Inicio carga en < 2 s con datos de Alegra en caché; cambiar un color y obtener el PDF en < 3 min. Se verifican manualmente (quickstart, escenario 13)

**Constraints**: solo `127.0.0.1`; sin infraestructura externa; todas las rutas nuevas exigen sesión; fuentes locales (sin CDN, aunque el mockup use Google Fonts); generación solo manual; un solo trabajo a la vez; consulta de Alegra del resumen con timeout de 8 s

**Scale/Scope**: un usuario, ~200 productos, ~10 pantallas (2 nuevas: Inicio y Apariencia; el resto se reestiliza)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | El resumen de Inicio solo hace `GET` a Alegra; el tema y las opciones viven en SQLite/memoria; nada se escribe en Alegra | ✅ |
| II. El catálogo nunca engaña | Las reglas de stock, imagen, combos y precio no cambian; ocultar agotados y excluir secciones se aplican en el mismo constructor que valida el catálogo; el informe y las decisiones se calculan solo sobre secciones incluidas; una decisión "omitir" nunca vuelve a incluir un combo; un fallo sigue abortando sin PDF parcial | ✅ |
| III. Seguridad de credenciales | Rutas nuevas (`/settings/theme`, `/panel/summary`, `/catalog/prepare/:id/options`) detrás de la sesión; el resumen nunca devuelve el token; sin vías de acceso externas | ✅ |
| IV. Fidelidad visual | El tema entra al `CatalogPayload` y los componentes de `print/` lo reciben como variables CSS; vista previa e impresión siguen siendo la misma vista; los acentos se dibujan anclados al fondo para garantizar legibilidad; defaults validados contra Cat.pdf en la revisión visual | ✅ (riesgo aceptado en research §2) |
| V. Pruebas sobre reglas | Pruebas nuevas: validación y contraste del tema, concurrencia, estructura = páginas del PDF, informe por secciones, opciones de generación, resumen del Panel, desbordamiento de textos | ✅ |
| VI. Simplicidad | Sin n8n, sin colas, sin nuevo motor de PDF, una tabla nueva; la estructura y el resumen reutilizan el constructor existente; sin selector de direcciones visuales | ✅ |

Re-evaluación tras el diseño (Fase 1) y tras `/speckit-analyze`: sin violaciones. No se requiere enmienda de la constitución.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-panel-theming/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rest-api.md
├── tasks.md             # lo crea /speckit-tasks
├── visual-review.md     # revisión visual: diferencias contra Cat.pdf y el mockup, defectos corregidos
└── visual/              # capturas de la revisión visual
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── src/
│   ├── alegra/
│   │   ├── alegra.client.ts     # CAMBIA · opción `timeoutMs` (por defecto sin límite)
│   │   └── connection.repo.ts   # CAMBIA · `client()` acepta opciones (timeout del resumen)
│   ├── catalog/
│   │   ├── theme.ts             # NUEVO · tipos, valores por defecto, validación hex y contraste (puro, sin Node: lo importa el frontend)
│   │   ├── theme.repo.ts        # NUEVO · lectura/escritura/restauración de `catalog_theme` con `updatedAt`
│   │   ├── catalog-inputs.ts    # NUEVO · carga de los datos locales del constructor (secciones, combos, overrides, negocio), compartida por `prepare` y el resumen
│   │   ├── panel-summary.ts     # NUEVO · servicio del resumen de Inicio (caché de 60 s salvo `lastCatalog`)
│   │   ├── structure.ts         # NUEVO · calcula la estructura a partir de un CatalogPayload
│   │   ├── catalog-builder.ts   # CAMBIA · opciones por llamada, tema, informe filtrado por sección, `availableSections`, combos y `hideSoldOut`
│   │   ├── catalog.service.ts   # CAMBIA · opciones guardadas por preparación, `setOptions`, tema leído al construir, `pages` en el historial
│   │   ├── prepare-store.ts     # CAMBIA · la entrada guarda las opciones vigentes
│   │   ├── settings.repo.ts     # CAMBIA · `BusinessSettings extends BusinessInfo` (sin tema)
│   │   └── types.ts             # CAMBIA · `BusinessInfo`, `CatalogConfig.theme`, `GenerationOptions`, `AvailableSection`, `CatalogStructure`, `PanelSummary`
│   ├── context.ts               # CAMBIA · registra el servicio del resumen
│   ├── app.ts                   # CAMBIA · monta las rutas nuevas
│   ├── api/
│   │   ├── theme.routes.ts      # NUEVO · /settings/theme (GET, PUT con 409, DELETE) y mapeo de errores a `invalid_theme`
│   │   ├── panel.routes.ts      # NUEVO · /panel/summary
│   │   ├── catalog.routes.ts    # CAMBIA · PUT /catalog/prepare/:id/options, estructura en prepare, tema en el payload
│   │   ├── business.routes.ts   # CAMBIA · límite de 3500 caracteres en políticas (`invalid_business`)
│   │   ├── uncategorized.routes.ts, alegra-settings.routes.ts, sections.routes.ts, custom.routes.ts  # CAMBIAN · invalidan el resumen
│   └── db/migrations/002_theme.sql   # NUEVO
└── tests/
    ├── unit/                    # theme.test.ts, structure.test.ts, generation-options.test.ts
    └── integration/             # theme.test.ts, panel-summary.test.ts, generation-options.test.ts, pdf-theme.test.ts, print-overflow.test.ts

frontend/
├── src/
│   ├── components/
│   │   ├── ui/                  # NUEVO · primitivas Pop: Card, Button, Field, Alert, Badge, PageHeader, StatusDot
│   │   ├── Sidebar.tsx          # NUEVO · navegación lateral con contadores y estado de conexión
│   │   ├── AppShell.tsx         # NUEVO · layout lateral + contenido
│   │   ├── StructurePreview.tsx # NUEVO · portadas / páginas / contenido propio
│   │   └── ThemeSample.tsx      # NUEVO · muestra de página con el tema en edición
│   ├── pages/
│   │   ├── Home.tsx             # NUEVO · Inicio: indicadores, secciones, último catálogo
│   │   ├── ThemeEditor.tsx      # NUEVO · "Apariencia": colores, banner, contacto, políticas
│   │   ├── Generate.tsx         # CAMBIA · secciones a incluir, banner, vista previa de estructura
│   │   ├── Login.tsx            # CAMBIA · estilo Pop con logo
│   │   └── (AlegraSettings, Sections + CustomProducts como pestañas de "Contenido propio", Bundles, Uncategorized, History)  # CAMBIAN · solo estilo con las primitivas ui/
│   ├── print/
│   │   ├── print.css            # CAMBIA · colores dibujados pasan a variables `--pdf-*`; pie; textos largos
│   │   ├── FooterInfo.tsx       # NUEVO · pie con teléfonos y dirección en páginas de producto y de políticas
│   │   └── CatalogDocument.tsx  # CAMBIA · aplica el tema como variables CSS en `.print-root`
│   ├── hooks/usePanelSummary.ts # NUEVO · resumen compartido por Sidebar e Inicio
│   ├── hooks/useUnsavedGuard.ts # NUEVO · aviso de cambios sin guardar (cierre de pestaña y barra lateral)
│   ├── print/useFit.ts          # NUEVO · reduce la letra de un bloque de altura limitada hasta que cabe (`--fit`)
│   ├── print/theme-vars.ts      # NUEVO · variables CSS `--pdf-*` del tema
│   ├── assets/logo.jpg          # NUEVO · copia de docs/…/assets/logo.jpg
│   └── styles/theme.css         # CAMBIA · tokens Pop (@theme) y fuentes locales
└── tests/                       # login, sidebar, generate, theme-editor, print (variables, pie), screens (humo de pantallas reestilizadas)
```

**Structure Decision**: se mantiene el monorepo de 001 (`backend` + `frontend`). No se adopta la estructura `src/admin`, `src/renderer` de la solicitud original, porque ya existe una equivalente funcional (`backend/src/pdf`, `frontend/src/print`); la reestructuración no aporta valor y rompería lo implementado.

## Complexity Tracking

Sin violaciones de la constitución; no se requiere justificación.
