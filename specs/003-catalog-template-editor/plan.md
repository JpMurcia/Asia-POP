# Implementation Plan: Editor visual de plantillas del catálogo

**Branch**: `003-catalog-template-editor` (sin repositorio git aún) | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-catalog-template-editor/spec.md`

## Summary

Reemplaza el formulario de colores de la feature 002 por un **editor visual de plantillas** a pantalla completa, con varias plantillas guardables. Cuatro frentes: (1) **modelo y persistencia**: una plantilla es un documento versionado (paleta de 6 colores, par tipográfico y cuatro páginas con elementos posicionados en %), guardado con los datos del negocio en **una sola transacción** con control de revisión entre pestañas, sembrado con 4 plantillas base y migrando el tema de 002 a la paleta de Neón Noche; (2) **render único**: un componente `TemplatePage` dibuja la página en el lienzo, las miniaturas, la vista previa y el PDF, de modo que el editor y el PDF coinciden por construcción; los bloques automáticos (introducción, productos con 3 distribuciones y 3 estilos de agotado, políticas, pie) se llenan con los datos reales y reducen su letra para caber; (3) **editor**: lienzo con arrastre, redimensionado, ajuste al centro, atajos, deshacer/rehacer de 60 pasos, inspector dirigido por datos, capas, paleta, tipografías, galería y datos insertables, con Pointer Events propios y sin librerías de interacción; (4) **Generar** elige plantilla por generación con reemplazo si fue eliminada, más cuatro ajustes menores de paridad con el mockup. Las únicas dependencias nuevas son 4 paquetes de tipografías locales. Decisiones en [research.md](./research.md).

**Orden de implementación recomendado** (para `/speckit-tasks`): ① base compartida (módulo puro, presets, migración, repo y rutas) y render de plantillas en el PDF con Neón Noche calibrada (Historia 2) → ② editor (Historia 1) → ③ paleta y tipografía (Historia 3) → ④ galería (Historia 4) → ⑤ datos y marcadores (Historia 5) → ⑥ paridad menor (Historia 6). La enmienda de la constitución (v1.1.0) ya está aplicada.

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001 y 002)

**Primary Dependencies**: Backend: Express, better-sqlite3, Puppeteer, zod, multer (sin cambios). Frontend: React, Vite, Tailwind CSS v4, React Router (sin cambios) + `@fontsource/bungee`, `@fontsource/zen-maru-gothic`, `@fontsource/space-grotesk` y `@fontsource/dm-serif-display` (tipografías locales). Sin librerías de arrastre, color, historial ni estado global (research §8)

**Storage**: SQLite `data/app.db`: migración `003_templates.sql` con `catalog_template` y `template_workspace`; `catalog_theme` queda sin uso (solo alimenta la migración inicial); `business_settings` sin cambios de esquema

**Testing**: Vitest (backend y frontend), supertest, servidor Alegra simulado, `pdf-parse`, Puppeteer para la prueba de fidelidad editor ↔ PDF y la de desbordamiento; revisión visual manual de las 4 plantillas base y de Neón Noche contra `docs/Cat.pdf`

**Target Platform**: Windows 11, navegador moderno en `localhost`; el editor es para pantalla de escritorio o portátil (≥ 1024 px de ancho)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: arrastre fluido a 1366×768 con 60 elementos por página; un cambio de propiedad se ve en el lienzo en < 0,2 s; guardar < 1 s; cambio de color a PDF < 3 min. Se verifican a mano (quickstart, escenario 15)

**Constraints**: solo `127.0.0.1`; fuentes locales (sin CDN, aunque el mockup use Google Fonts); generación solo manual; un solo trabajo a la vez; todas las rutas exigen sesión; el cuerpo del `PUT /settings/templates` admite 2 MB; ≤ 30 plantillas, ≤ 60 elementos por página

**Scale/Scope**: un usuario, ≤ 30 plantillas × 4 páginas × ≤ 60 elementos, ~200 productos; 1 pantalla nueva a pantalla completa (editor) más 4 pantallas con ajustes menores

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | Las plantillas y los datos viven en SQLite; el editor no llama a Alegra (usa datos de muestra); lo único nuevo hacia Alegra es mostrar `syncedAt` y los intentos de prueba, sin escribir nada | ✅ |
| II. El catálogo nunca engaña | La plantilla cambia la apariencia, no el contenido: las reglas de stock, imagen, combos, precio y paginación (≤ 3) siguen en el constructor. Los tres estilos de agotado muestran la palabra AGOTADO y solo en productos agotados de Alegra o combos (la v1.1.0 cambia "sello AGOTADO" por "indicación AGOTADO" para que cinta y gris cumplan); un fallo sigue abortando sin PDF parcial. Las fuentes son locales | ✅ |
| III. Seguridad de credenciales | Rutas nuevas detrás de la sesión; el token no aparece en ninguna respuesta; `testAttempts` no expone secretos; sin vías de acceso externas | ✅ |
| IV. Fidelidad visual | El texto 1.0.0 exigía un PDF "con fondo oscuro y acentos neón" siguiendo `docs/Cat.pdf`, y tres de las cuatro plantillas base del mockup tienen fondo claro. La constitución **v1.1.0 (2026-10-03)** acota esa exigencia a la plantilla predeterminada: Neón Noche sigue a Cat.pdf y se valida contra él; las demás son personalizaciones del responsable. Además exige un único componente de página para editor, vista previa y PDF, que es `TemplatePage` | ✅ enmendado en v1.1.0 |
| V. Pruebas sobre las reglas | Pruebas de esquema y de bloques obligatorios, marcadores, geometría de distribuciones, guardado atómico y revisión, migración del tema, fidelidad editor ↔ PDF (SC-002), páginas = estructura con cada plantilla, AGOTADO en los tres estilos y desbordamiento en las 4 bases | ✅ |
| VI. Simplicidad | Sin librerías de interacción, sin colas ni nuevo motor de PDF, un documento JSON por plantilla en vez de tablas por elemento, un único guardado. La complejidad restante la pide la spec y se justifica abajo | ✅ con justificación |

**Enmienda aplicada** (`/speckit-constitution`, 2026-10-03, versión 1.0.0 → 1.1.0, MINOR): el principio IV ahora exige que la plantilla predeterminada de fábrica (Neón Noche) siga `docs/Cat.pdf`, deja las demás plantillas como personalizaciones del responsable y exige un único componente de página para editor, vista previa y PDF. De paso corrige la descripción del diseño de referencia: portadas moradas, páginas de producto sobre mármol, tarjetas oscuras y acentos neón (antes decía solo "fondo oscuro"). El principio II cambia "sello AGOTADO" por "indicación AGOTADO". Texto completo e informe de impacto en `.specify/memory/constitution.md`.

Re-evaluación tras el diseño (Fase 1): sin violaciones pendientes.

## Project Structure

### Documentation (this feature)

```text
specs/003-catalog-template-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rest-api.md
├── checklists/
│   └── requirements.md
├── tasks.md             # lo crea /speckit-tasks
├── visual-review.md     # revisión visual: diferencias de Neón Noche frente a Cat.pdf y al PDF de 002, aprobación del responsable
└── visual/              # capturas de la revisión visual; baseline-002/ = línea base del render de 002 (PDF, capturas y copia de frontend/src/print/) tomada antes de reemplazarlo
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── src/
│   ├── catalog/
│   │   ├── template.ts          # NUEVO · puro (lo importa el frontend): tipos, constantes y rangos, resolveTokens, resolveColor, paletteWarnings, bloques obligatorios, tamaño de página
│   │   ├── template-layout.ts   # NUEVO · puro: layoutRows (geometría de las 3 distribuciones del bloque de productos)
│   │   ├── template-presets.ts  # NUEVO · puro: 4 plantillas base (neon calibrada), paletas sugeridas, pares tipográficos
│   │   ├── template.schema.ts   # NUEVO · zod: valida plantillas, bloques obligatorios por página y límites (solo servidor)
│   │   ├── template.repo.ts     # NUEVO · siembra, lectura, guardado transaccional con revisión, resolución por id con reemplazo, resumen
│   │   ├── theme.ts             # CAMBIA · queda con isHexColor y contrastRatio; Theme y themeWarnings desaparecen
│   │   ├── theme.repo.ts        # ELIMINA
│   │   ├── catalog-builder.ts   # CAMBIA · recibe `template` en lugar de `theme`
│   │   ├── catalog.service.ts   # CAMBIA · `templateId` en las opciones, plantilla leída al construir, reemplazo por la predeterminada
│   │   ├── panel-summary.ts     # CAMBIA · `alegra.syncedAt`
│   │   └── types.ts             # CAMBIA · CatalogConfig sin theme, CatalogPayload.template, GenerationOptions.templateId, PanelSummary.syncedAt
│   ├── api/
│   │   ├── templates.routes.ts  # NUEVO · /settings/templates (GET, PUT con 422/409) y /settings/templates/summary
│   │   ├── theme.routes.ts      # ELIMINA
│   │   ├── business.routes.ts   # CAMBIA · exporta el esquema; el PUT incrementa la revisión
│   │   ├── catalog.routes.ts    # CAMBIA · templateId en prepare/options, plantilla en el payload, respuesta de generate
│   │   └── alegra-settings.routes.ts  # CAMBIA · testAttempts
│   ├── auth/middleware.ts       # CAMBIA · rateLimit expone los intentos restantes
│   ├── app.ts                   # CAMBIA · monta templatesRoutes (límite de 2 MB en su PUT), retira themeRoutes
│   └── db/migrations/003_templates.sql   # NUEVO
└── tests/
    ├── unit/                    # template.test.ts (marcadores, colores, advertencias de paleta), template-schema.test.ts, template-presets.test.ts, layout-rows.test.ts, rate-limit.test.ts; theme.test.ts se reduce
    └── integration/             # templates.test.ts, template-migration.test.ts, generation-template.test.ts, pdf-template-fidelity.test.ts, pdf-sold-out-styles.test.ts, pdf-fonts.test.ts, pdf-tokens.test.ts; theme.test.ts y pdf-theme.test.ts se eliminan; print-overflow.test.ts se reescribe; panel-layout.test.ts, panel-summary.test.ts, alegra-settings.test.ts y security.test.ts se actualizan

frontend/
├── package.json                 # CAMBIA · 4 paquetes @fontsource
├── src/
│   ├── pages/
│   │   ├── TemplateEditor/      # NUEVO · pantalla completa
│   │   │   ├── index.tsx            # carga, guardado (422/409), guard de cambios, atajos, vistas
│   │   │   ├── useTemplateEditor.ts # reductor del conjunto + historial de 60 pasos con fusión de acciones continuas
│   │   │   ├── usePointerDrag.ts    # mover, redimensionar, ajuste al centro
│   │   │   ├── sample-data.ts       # tres productos de muestra (uno agotado) y sección de ejemplo
│   │   │   ├── TopBar.tsx, SideRail.tsx, Canvas.tsx, PageStrip.tsx, ZoomControls.tsx, PreviewPages.tsx
│   │   │   ├── panels/              # PlantillasPanel, ElementosPanel, EstiloPanel, DatosPanel
│   │   │   ├── Inspector.tsx, inspector-fields.ts, FieldRenderer.tsx, Layers.tsx
│   │   │   └── Gallery.tsx
│   │   ├── ThemeEditor.tsx      # ELIMINA
│   │   ├── Generate.tsx         # CAMBIA · selector de plantilla con aviso de reemplazo, seleccionar/quitar todas
│   │   ├── Bundles.tsx          # CAMBIA · desglose de precio
│   │   ├── Home.tsx             # CAMBIA · "hace N min"
│   │   └── AlegraSettings.tsx   # CAMBIA · intentos restantes
│   ├── print/
│   │   ├── TemplatePage.tsx     # NUEVO · página escalable con fondo y elementos
│   │   ├── TemplateElement.tsx  # NUEVO · texto, insignia, forma, imagen; delega en los bloques
│   │   ├── blocks/              # NUEVO · ProductsBlock, TermsBlock, FooterBlock, IntroBlock
│   │   ├── assets.ts            # NUEVO · registro de imágenes y de familias tipográficas
│   │   ├── fonts.css            # NUEVO · importa las 6 familias desde @fontsource
│   │   ├── CatalogDocument.tsx  # CAMBIA · portada → secciones → productos → políticas con TemplatePage
│   │   ├── useFit.ts            # CAMBIA · también reduce por ancho
│   │   ├── print.css            # CAMBIA · queda @page, hoja A4 y estilos internos de los bloques
│   │   └── CatalogPage, CoverPage, SectionCover, TermsPage, ProductCard, FooterInfo, Contact, theme-vars   # ELIMINAN
│   ├── components/ThemeSample.tsx   # ELIMINA
│   └── App.tsx                  # CAMBIA · /apariencia fuera de AppShell
└── tests/                       # template-editor-{reducer,canvas,keyboard,inspector,save,style,gallery,data}.test.ts(x), template-page.test.tsx, catalog-document.test.tsx, generate.test.tsx, parity.test.tsx; theme-editor.test.tsx, print.test.tsx y print-theme.test.tsx se reemplazan
```

**Structure Decision**: se mantiene el monorepo de 001 y 002 (`backend` + `frontend`). La lógica compartida y pura (tipos, marcadores, geometría, advertencias, plantillas base) vive en `backend/src/catalog/` sin importar nada de Node, igual que `theme.ts` en 002, para que el frontend la importe sin duplicarla. El render de plantillas reemplaza los componentes fijos de `print/`; el servicio de PDF, las rutas de impresión y la cola de trabajo no cambian.

## Complexity Tracking

| Complejidad | Por qué es necesaria | Alternativa más simple rechazada porque |
| --- | --- | --- |
| Enmienda MINOR del principio IV (aplicada: v1.1.0) | Tres de las cuatro plantillas del mockup tienen fondo claro y el principio exigía fondo oscuro | Entregar solo Neón Noche descartaría lo que el responsable pidió en el mockup; ocultar las claras sería saltarse la regla sin documentarla |
| Editor con interacciones propias (arrastre, redimensionado, ajuste al centro, atajos, historial) | La spec exige un editor visual; son ≈ 150 líneas de Pointer Events sobre coordenadas porcentuales | Una librería (`react-moveable`, `react-rnd`) añadiría una dependencia que choca con el escalado propio y sobra para mover y redimensionar desde una esquina (research §8) |
| Documento JSON versionado por plantilla | El editor guarda y carga la plantilla completa, atómicamente, con un solo botón | Tablas por página y por elemento exigirían joins y una migración por cada propiedad nueva sin ninguna consulta parcial que las justifique |
| Reemplazo (no extensión) del tema de 002 y retiro de `/settings/theme` | Mantener ambos crearía dos fuentes de verdad para los colores | Conservar el tema de 4 colores junto a la paleta de 6 duplicaría reglas, pruebas y la migración de datos |
| Dos ajustes a la spec detectados al planificar (quinta imagen "marco" y bloque automático `intro`) | Sin ellos Neón Noche no puede reproducir las portadas actuales ni se conserva la introducción de las secciones propias (feature 001) | Omitirlos rompería FR-021 y reintroduciría una regresión sobre 001 |
