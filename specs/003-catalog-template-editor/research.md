# Research: Editor visual de plantillas del catálogo

**Feature**: [spec.md](./spec.md) | **Fecha**: 2026-10-03

Resuelve las decisiones técnicas del plan. Parte de [001](../001-catalog-pdf-generator/research.md) y [002](../002-admin-panel-theming/research.md), que siguen vigentes salvo lo que aquí se reemplaza.

## 1. Qué reemplaza esta feature

| De la feature 002 | Destino |
| --- | --- |
| Tabla `catalog_theme`, `ThemeRepo`, `/settings/theme` | Se sustituyen por plantillas. La tabla **se conserva sin usar** (su fila alimenta la migración de §3); las rutas y el repositorio se eliminan |
| `ThemeEditor.tsx`, `ThemeSample.tsx`, `theme-vars.ts` | Se eliminan; los reemplaza el editor (§7) |
| Variables CSS `--pdf-*` y el CSS fijo de `print.css` para portada, sección, producto, políticas y pie | Se reemplazan por el render de plantillas (§4). `print.css` queda con `@page`, la hoja A4 y los estilos internos de los bloques automáticos |
| `Theme { background, accent1..3 }` y `themeWarnings` | Se generalizan a una paleta de 6 colores (§10); `isHexColor` y `contrastRatio` se reutilizan |
| `CatalogConfig.theme` | Pasa a `CatalogPayload.template` (§4) |

Sigue igual: `GenerationOptions`, `computeStructure`, `PanelSummary`, informe por secciones, `useFit`, `useUnsavedGuard`, primitivas `components/ui/`, estilo Pop del panel.

## 2. Modelo de la plantilla: un documento versionado

**Decisión**: una plantilla es **un documento JSON** (`TemplateDoc`) con paleta, par tipográfico y cuatro páginas, cada una con un fondo y una lista ordenada de elementos. Posición y tamaño en **porcentaje de la página**; los colores son **referencias** (`bg|a1|a2|a3|ink|paper`) o `#RRGGBB`, de modo que cambiar la paleta recolorea todos los elementos que la usan (FR-014, FR-015). Los tipos y rangos están en [data-model.md](./data-model.md).

**Por qué documento y no tablas por elemento**: el editor siempre carga y guarda la plantilla completa (un solo botón Guardar, atómico, FR-025); nunca se consulta un elemento suelto. Un documento evita 3-4 tablas, joins y migraciones por cada propiedad nueva. Se valida con zod al guardar y lleva `version: 1` para migraciones futuras.

**Bloques automáticos**: `intro`, `products`, `terms` y `footer`. Su obligatoriedad se **deriva del tipo y de la página** (no se guarda una marca `core`): la página `seccion` tiene exactamente un `intro`; `productos`, un `products` y un `footer`; `politicas`, un `terms` y un `footer`; ninguna otra página los admite. El servidor lo exige al guardar. Esto corrige una omisión del mockup: no contempla la introducción de las secciones propias (`introText`, feature 001), que se perdería de la portada de sección.

**Alternativas**: tablas `template_page`/`template_element` (sobrecarga sin consultas parciales); guardar solo diferencias respecto al estilo base (frágil si cambia el estilo base).

## 3. Almacenamiento, guardado atómico, concurrencia y migración

**Tablas** (`003_templates.sql`):
- `catalog_template (id PK, name, base, position, doc_json)`.
- `template_workspace (id = 1, default_template_id, revision INTEGER)`.

**Guardado**: `PUT /settings/templates` recibe **todo el conjunto** `{ templates, defaultId, business, expectedRevision }` y lo aplica en **una transacción** (borra las plantillas ausentes, reemplaza las demás, fija la predeterminada, escribe `business_settings`, incrementa `revision`). Si cualquier validación falla no se escribe nada (FR-025). Si `expectedRevision` no coincide → `409 templates_changed` (FR-027).

**`PUT /settings/business`** (001) se conserva y también incrementa `revision`, de modo que la detección de ediciones simultáneas cubra los datos del negocio.

**Siembra y migración (FR-021)**: la primera lectura crea, si no hay `template_workspace`, las **4 plantillas base** (definidas en código, §6) con `neon` como predeterminada y `revision = 1`. Si existe una fila en `catalog_theme`, sus cuatro colores sustituyen `bg/a1/a2/a3` de la paleta de `neon` (y de su estilo base al restaurar no cambia: restaurar vuelve a la paleta de fábrica). No hay SQL de datos; la siembra es idempotente y vive en `TemplateRepo.ensureSeeded()`.

**Revision como entero** (no marca de tiempo): evita el truco de 002 para guardados en el mismo milisegundo.

**Límites defensivos** (el servidor rechaza con `422 invalid_templates`): ≤ 30 plantillas, ≤ 60 elementos por página, nombre ≤ 60 caracteres, texto de un elemento ≤ 500 caracteres. El tamaño del cuerpo de este `PUT` sube a 2 MB (el límite global de `express.json` es 1 MB y 30 plantillas × 4 páginas × 60 elementos lo superaría).

**Alternativas**: `PUT` por plantilla (guardado parcial, concurrencia por plantilla, y los datos del negocio quedarían fuera de la transacción); `expectedUpdatedAt` por fila como en 002 (no cubre la plantilla predeterminada ni los datos).

## 4. Un único componente de página para editor, miniaturas, vista previa y PDF

**Decisión**: `TemplatePage` (React) dibuja una página a partir de `{ template, page, scale, data }`. Lo usan **el lienzo, la tira de páginas, las miniaturas, la galería, la vista previa y el PDF**. Fidelidad por construcción (SC-002, principio IV).

- **Unidad lógica**: la página mide 595,28 × 841,89 px lógicos (A4 en puntos). Cada elemento se coloca con `left/top/width/height` en `%` y los tamaños de letra, bordes y radios están en px lógicos. La página se escala con `transform: scale(s)` desde la esquina superior izquierda, dentro de un contenedor de tamaño `595,28·s × 841,89·s`.
- **Impresión**: contenedor `210mm × 297mm` y `s = 96/72 = 4/3` (exacto, porque 1 pt = 4/3 px CSS). `@page { size: A4; margin: 0 }` y `break-after` se mantienen. El texto sigue siendo vectorial en el PDF.
- **Ajuste de letra**: `useFit` mide `scrollHeight` y `clientHeight` en px de maquetación, que **no cambian con `transform`**, así que funciona igual en el editor y en la impresión.
- **Recorte**: el contenedor de la página lleva `overflow: hidden`; lo que sale de la hoja se recorta y no agranda el documento ni crea páginas extra.
- **Datos insertables**: `resolveTokens(text, ctx)` es una función pura: `{banner}`, `{tienda}`, `{telefonos}` (teléfonos no vacíos unidos con " · "), `{direccion}`, `{seccion}` (vacío en páginas sin sección); un marcador desconocido queda tal cual (FR-024). `banner` ya trae el efecto de `bannerText` porque el servidor lo aplica a `config.coverTitle`.
- **Viaja en el payload**: `CatalogPayload.template` (la plantilla elegida, completa) sustituye a `config.theme`. El servidor la lee **al construir** (como el tema en 002), de modo que una plantilla guardada entre preparar y generar se aplica (FR-022). `GET /catalog/payload/:id` refresca `template` en cada lectura.
- **Estructura**: `computeStructure` no cambia y no depende de la plantilla (FR-029, SC-010). `termsPages` sigue siendo 1 si hay políticas.
- **Documento de impresión**: portada → `portada`; por sección → `seccion` + una `productos` por cada bloque de ≤ 3 ítems; al final → `politicas` (solo si hay políticas).

**Alternativas**: un renderizador distinto para el editor (rompe SC-002 y duplica código); renderizar el PDF en el servidor sin navegador (cambia el motor, viola el principio VI).

## 5. Bloques automáticos y ajuste de texto

**Productos** (`ProductsBlock`): tres filas dentro de la caja del bloque. Tres distribuciones calculadas por una función pura `layoutRows(layout, W, H)` (testeable sin DOM): `alternado` (imagen a izquierda y derecha alternando, **calibrada con la geometría actual del PDF**: filas de 27 % de alto cada 29,1 %, tarjeta del 29 % de ancho, burbuja del 40 %, etiqueta de precio al 82 % de la fila), `tarjetas` (3 columnas) y `lista` (3 filas con separadores), estas dos con las fórmulas del mockup. Cada fila: foto (fondo, anillo, esquinas), burbuja con descripción y etiqueta de precio. El contenido de la burbuja reutiliza la lógica actual de `ProductCard` (nombre si no hay descripción, opciones y sabores de productos propios, "Incluye:" de combos) con `useFit`.

**Agotado** (principio II): tres estilos, todos con la palabra AGOTADO en el DOM:
- `sello`: imagen `sold-out.png` actual + etiqueta invisible (buscable en el PDF), como hoy.
- `cinta`: banda diagonal con el texto AGOTADO (color `soldFill`).
- `gris`: foto en escala de grises + etiqueta "AGOTADO" visible.
Solo se pinta si `item.kind !== 'custom' && item.soldOut` (regla de 001, sin cambios).

**Políticas** (`TermsBlock`): lista de bloques título/texto en la caja del bloque; `useFit` reduce la letra hasta caber. **Introducción** (`IntroBlock`): caja con el `introText`; no se pinta si la sección no lo tiene. **Pie** (`FooterBlock`): una línea con `resolveTokens(content)`; `useFit` se amplía para reducir también por **ancho** (`scrollWidth > clientWidth`) con mínimo `MIN_FIT` y puntos suspensivos como último recurso (FR-031).

**Tamaño mínimo legible: 6 pt.** `useFit` conserva `MIN_FIT` (0,45), pero el factor mínimo de cada elemento es `máx(MIN_FIT, 6 / tamaño base en px lógicos)`, de modo que un texto base de 8 px no baja de 6 px y uno de 40 px llega a 18 px. Se expone como la opción `minFontPx` (por defecto 6).

**Bloque muy pequeño** (Edge Case): si `useFit` llega a ese mínimo y aún no cabe, el elemento marca `data-overflow="true"` y el inspector muestra la advertencia (el editor lee la marca del DOM tras cada render; no bloquea). Con las cuatro plantillas base y textos máximos la marca no debe aparecer (prueba de desbordamiento).

**Textos con marcadores** (`{seccion}`, `{banner}`, etc.) en textos, insignias y pie: usan `useFit` por ambos ejes, igual que los bloques, porque su largo depende de los datos (el nombre de una sección puede tener 60 caracteres). Neón Noche depende de esto para sus títulos de portada y de sección, como el CSS actual.

**Textos libres** (sin marcadores): se muestran tal cual, sin ajuste automático, dentro de su caja (`overflow-wrap: anywhere`); lo que sobresale de la hoja se recorta. Lo que el usuario ve en el editor es lo que se imprime.

## 6. Las cuatro plantillas base y diferencias con el mockup

Las plantillas base viven en `backend/src/catalog/template-presets.ts` (módulo puro, lo importa el frontend para "Nueva plantilla", "Restaurar colores originales" y la siembra). Sus paletas y pares tipográficos salen del mockup. **Neón Noche se calibra contra el PDF actual** (feature 002), no contra la aproximación del mockup, porque FR-021 y SC-003 piden reproducir lo ya aprobado.

| Aspecto | PDF actual (002) | Preset del mockup | Decisión para `neon` |
| --- | --- | --- | --- |
| Marco de portadas | Imagen `frame.png` (logo y hoja crema incluidos) sobre `cover-bg.jpg` | Forma con resplandor + logo suelto | **Imagen `frame`** (quinta imagen incorporada; ajuste a la spec) sin logo suelto |
| Bloque "Domicilios" con íconos de WhatsApp | Sí, en portadas | Solo `{telefonos}` en texto | Texto "Domicilios" + `{telefonos}`; **sin íconos** (diferencia para la revisión visual) |
| Título de página de producto | "CATÁLOGO {sección}" en mayúsculas, negro, logo arriba a la derecha | `{seccion}` con relleno `bg` y contorno `a1`, sin logo | Texto "Catálogo {seccion}" en mayúsculas, color `#111111`, más imagen `logo` |
| Títulos de portada y sección | Relleno `bg`, contorno/resplandor `a1`, Fredoka One | Fredoka | Fredoka 700 (`@fontsource/fredoka`); diferencia de forma mínima, a validar |
| Etiqueta de precio, anillo, burbuja, pie | Pastilla `bg` con borde `a3`; anillo `a2`; burbuja `#E8DFD0`; pie `bg` con línea `a3` | Igual | Igual |
| Introducción de sección | Caja crema bajo el título | No existe | Bloque `intro` (§2) |
| Políticas | Chips `bg`/`a1` sobre tarjetas crema | Igual | Igual |

Las otras tres bases (`pop`, `kawaii`, `kraft`) siguen el mockup, agregando los bloques `intro` y los ajustes necesarios para que los textos de ejemplo quepan. Se genera con ellas el mismo conjunto de pruebas de desbordamiento (SC-006).

**Diferencias aceptadas** (spec, Clarifications): los íconos de WhatsApp de «Domicilios» y Fredoka 700 en lugar de Fredoka One. Todo lo demás de `neon` debe coincidir con el PDF de 002.

**Riesgo**: ninguna calibración reproduce el PDF al píxel. Mitigación: (1) **línea base** de 002 capturada antes de tocar nada (PDF, una captura por página y copia de `frontend/src/print/`, en `specs/003-catalog-template-editor/visual/baseline-002/`; el proyecto no es un repositorio git, así que esa copia es la única referencia una vez eliminados los componentes antiguos); (2) revisión visual con capturas lado a lado (como `visual-review.md` de 002); (3) la aprobación visual de 002 (sus T057 y T062) sigue abierta y se valida junto con SC-003.

## 7. Arquitectura del editor (frontend)

**Ruta**: `/apariencia` se monta **fuera** de `AppShell` (como `/print/:id`), a pantalla completa; "← Menú" navega a `/` tras `confirmLeave()`. El guard existente (`useUnsavedGuard`) cubre cierre de pestaña y salida (FR-026).

**Estado**: un reductor (`useTemplateEditor`) con el **conjunto completo** `{ templates, defaultId, business }` + UI (plantilla y página activas, selección, pestaña, zoom, vista). Historial de deshacer/rehacer = pila de instantáneas de **la plantilla activa más `defaultId` y los datos del negocio** (≤ 60, `structuredClone` por paso; unos pocos KB, no todo el conjunto de hasta 30 plantillas). Una acción continua (arrastrar, deslizar, teclear en un mismo campo) se **fusiona en un paso** por clave (`id:propiedad`) en una ventana de 800 ms, como el mockup. Cambiar de plantilla y las acciones de la galería (crear, duplicar, eliminar) reinician la pila (FR-010), como en el mockup. `dirty` compara **por referencia** las plantillas no tocadas (las actualizaciones son inmutables) y por contenido solo la activa, los datos y la predeterminada, para no serializar todo el conjunto en cada render.

**Interacciones** con Pointer Events: `pointerdown` en el elemento → captura del puntero → `pointermove` calcula `Δ%` respecto del rectángulo de la página en pantalla → parche de `x/y` o `w/h` → `pointerup`. Ajuste al centro con tolerancia de 1,2 % (horizontal) y 0,9 % (vertical) y guías. Atajos en un único listener de `window` que ignora `input/textarea/select`. Elementos bloqueados se seleccionan pero no se mueven.

**Inspector dirigido por datos**: `inspector-fields.ts` mapea cada tipo de elemento a una lista de descriptores de campo (`color`, `range`, `segmented`, `select`, `text`, `toggle`, `numbers`) con los rangos de la spec; un componente `FieldRenderer` los dibuja. Agregar una propiedad es agregar una línea. Es la misma idea del mockup, tipada.

**Rendimiento (SC-008)**: `TemplateElement` con `React.memo` por elemento; durante el arrastre solo cambia el objeto del elemento movido. Hasta 60 elementos por página es holgado.

**Vistas**: `Editor` (lienzo + paneles) y `Plantillas` (galería) dentro de la misma pantalla; Vista previa muestra `TemplatePage` ×4 sin overlays. Miniaturas de la galería: `TemplatePage` a escala ≈ 0,22.

**Datos de muestra del editor**: 3 productos (uno agotado, con imágenes del collage como en el mockup), nombre de sección "RAMEN" y los datos reales del negocio; no depende de Alegra (Edge Case "Alegra cae").

## 8. Librerías evaluadas

| Necesidad | Opciones evaluadas | Decisión |
| --- | --- | --- |
| Tipografías Bungee, Zen Maru Gothic, Space Grotesk, DM Serif Display | CDN de Google (viola la regla de fuentes locales); `@fontsource/*` (ya se usa para Fredoka, Poppins y Nunito) | **Instalar** `@fontsource/bungee`, `@fontsource/zen-maru-gothic`, `@fontsource/space-grotesk`, `@fontsource/dm-serif-display` (v5.3.0 verificada en npm) |
| Arrastrar y redimensionar | `react-moveable`, `react-rnd`, `interactjs` | **Ninguna.** Se necesita mover, redimensionar desde una esquina y ajustar al centro, en coordenadas porcentuales con zoom. Eso son ~120 líneas de Pointer Events y la dependencia chocaría con el escalado propio. Se reevalúa si se piden multi-selección, grupos o manijas de rotación |
| Selector de color | `react-colorful` | **Ninguna.** `<input type="color">` nativo más los seis colores de la paleta (como el mockup) |
| Deshacer/rehacer | `immer`, `zundo` | **Ninguna.** Pila de instantáneas con `structuredClone` |
| Estado global | Redux/Zustand | **Ninguna.** Un reductor local en la pantalla |
| Validación de plantillas | — | `zod` ya instalado en el backend (solo servidor) |

**Pesos a importar**: Poppins 400/500/600/700 (ya), Fredoka 400/500/600/700, Zen Maru Gothic 400/500/700/900, Space Grotesk 400/500/700, Bungee 400, DM Serif Display 400. El peso "Semi" del editor (600) se mapea al más cercano disponible en cada familia. El editor y la impresión importan las mismas hojas de estilo, y `Print.tsx` ya espera `document.fonts.ready` antes de exportar.

## 9. Plantilla al generar y reemplazo de eliminadas

**Decisión**: `GenerationOptions` gana `templateId?: string`. Vacío = predeterminada. `GET /settings/templates/summary` alimenta el selector de Generar (id, nombre, marca, paleta y fuentes; sin los documentos). Como la plantilla se lee al construir, si el id ya no existe se usa la predeterminada y `generate` responde `202 { jobId, template: { id, name, fallback: true } }`; la pantalla avisa (Edge Case). No es un error: el usuario no pierde la generación.

## 10. Paleta, contraste y validación

**Reglas** (siguen siendo advertencias, FR-016): `Texto` sobre `Papel` ≥ 4,5 (`low_text_contrast`); blanco sobre `Fondo` ≥ 4,5 (el precio y el pie dibujan texto blanco sobre `Fondo`); cada acento contra `Fondo` ≥ 3 (`low_accent_contrast`), con los mismos umbrales de 002. Función pura `paletteWarnings(palette)` en el módulo compartido; el servidor devuelve las advertencias en el `PUT` y la pestaña Estilo las calcula en vivo. Con la paleta de `neon` no hay advertencias. Un color con formato inválido se rechaza en el campo (cliente) y en el `PUT` (`422 invalid_templates`).

## 11. Ajustes menores de paridad (Historia 6)

| Requisito | Implementación |
| --- | --- |
| FR-032 seleccionar/quitar todas | Solo frontend (`Generate.tsx`); actualiza la selección y la vista previa existente |
| FR-033 desglose del combo | Solo frontend: la vista del combo ya trae `components[].unitPrice` y `quantity`; suma = Σ, ahorro = máx(0, suma − precio), precio = `computedPrice` o el valor tecleado. Hay que confirmar en las tareas que el selector de componentes entrega `unitPrice` para productos aún no guardados |
| FR-034 antigüedad de la sincronización | `PanelSummary.alegra.syncedAt` (instante de la lectura que llenó la caché); Inicio calcula "hace N min" en el cliente |
| FR-035 intentos restantes | `rateLimit` expone `remaining(req)`; `GET /settings/alegra` y las respuestas de `POST /settings/alegra/test` (incluido el `429`) devuelven `testAttempts: { limit, remaining }`. El límite **sigue en 10 por minuto** (el mockup muestra 5; la spec solo pide mostrar los que quedan) |

## 12. Pruebas

**Decisión**: Vitest. Backend:
- **Unitarias**: esquema de plantilla (rangos, bloques obligatorios por página, límites), `resolveTokens`, `layoutRows` (las filas caben en la caja y no se solapan; `alternado` coincide con la geometría actual), `paletteWarnings`, siembra y migración de `catalog_theme`, presets base válidos.
- **Integración**: `GET/PUT /settings/templates` (siembra, guardado atómico, `422` sin escribir nada, `409`, `401`), `PUT /settings/business` incrementa la revisión, `templateId` en `prepare`/`options`/`generate` con reemplazo por la predeterminada, `payload.template` refrescada, `syncedAt` y `testAttempts`.
- **PDF (Puppeteer)**: (a) **fidelidad editor ↔ PDF**: para cada plantilla base y página, se miden los rectángulos de los elementos en la vista de impresión y se comparan con los del lienzo a la misma escala; tolerancia 1 % de la página (SC-002); (b) páginas del PDF = `structure.totalPages` con cada plantilla (SC-010); (c) la prueba de desbordamiento de 002 se extiende a los bloques de plantilla con textos máximos en las 4 bases (SC-006); (d) AGOTADO presente en los tres estilos y ausente en productos propios (SC-009); (e) texto de `{telefonos}`/`{banner}`/`{seccion}` en cada página con `pdf-parse`.

Frontend (Testing Library): reductor y historial (60 pasos, fusión de acciones continuas), arrastre y redimensionado con eventos de puntero, atajos (y que se ignoren al teclear), bloques automáticos (no eliminar/ocultar/duplicar), inspector por tipo, paleta (cambio, restaurar, sugeridas), galería (nueva, duplicar, predeterminada, eliminar), Datos (límites y marcadores), Guardar (éxito, `422`, `409`), aviso de cambios sin guardar, selector de plantilla en Generar, y humo de las pantallas de la Historia 6.

**Revisión visual manual**: las 4 plantillas base × 4 páginas contra el mockup, y `neon` contra el PDF de 002 y `docs/Cat.pdf`.

**Rendimiento (objetivos del plan)**: se verifican a mano en el quickstart (escenario 15): arrastre con retraso < 100 ms a 1366×768 con 60 elementos, propiedad→lienzo < 0,2 s, guardar < 1 s; el recorrido cronometrado de SC-004 va en el escenario 8.

## 13. Fuera de alcance y riesgos

**Fuera de alcance** (por la spec): subir imágenes propias; plantillas por sección; multi-selección, grupos y rotación con manija; exportar/importar plantillas; columna "Origen" del Historial; selector de dirección visual; interceptar el botón "Atrás".

**Riesgos**: (1) calibración de `neon` contra el PDF actual (§6); (2) fuentes que no cargan a tiempo en la impresión: `Print.tsx` espera `document.fonts.ready`, pero `font-display` y la carga perezosa de subconjuntos de `@fontsource` deben verificarse con una prueba de PDF por familia; (3) la constitución v1.1.0 exige comparar Neón Noche con `docs/Cat.pdf`, pero esa comparación es visual y manual; queda en el quickstart (escenario 11).

## Resumen de incógnitas

| Incógnita | Estado |
| --- | --- |
| Qué librerías hacen falta | Resuelto: 4 paquetes de tipografías; ninguna librería de arrastre, color o historial (§8) |
| Cómo se persiste una plantilla y se migra el tema de 002 | Resuelto: documento JSON, guardado atómico, siembra lazy (§2, §3) |
| Cómo garantizar que editor y PDF coinciden | Resuelto: un solo `TemplatePage` y prueba de rectángulos (§4, §12) |
| Introducción de secciones propias | Resuelto: bloque automático `intro` (§2); ajuste a la spec |
| Imagen del marco de portada | Resuelto: quinta imagen incorporada (§6); ajuste a la spec |
| Reproducir el PDF actual con `neon` | Riesgo aceptado, lista de diferencias en §6 y revisión visual |
| Principio IV de la constitución (fondo oscuro) | Resuelto: enmienda v1.1.0 aplicada (plan.md) |
| Límite de intentos de prueba (mockup 5, código 10) | Resuelto: se mantiene 10 (§11) |
