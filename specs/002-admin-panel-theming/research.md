# Research: Panel de administración y personalización del catálogo

**Feature**: [spec.md](./spec.md) | **Fecha**: 2026-10-03 (revisado tras `/speckit-analyze`)

Resuelve las decisiones técnicas del plan. Parte de la base de [001 research](../001-catalog-pdf-generator/research.md), que sigue vigente.

## 1. Estilo Pop del panel (tokens y fuentes)

**Decisión**: definir los tokens del mockup 1b en `frontend/src/styles/theme.css` con `@theme` de Tailwind v4. Las fuentes se instalan **localmente** con `@fontsource/fredoka` (títulos) y `@fontsource/nunito-sans` (cuerpo); el mockup carga Google Fonts, que se descarta por la regla de fuentes locales de la constitución.

| Token | Valor | Uso |
| --- | --- | --- |
| `bg` | `#FFF7EC` | fondo de la página |
| `surface` / `surface2` | `#FFFFFF` / `#FFF1DE` | tarjetas / franjas alternas (`stripeA #FFF1DE`, `stripeB #FBE7CC`) |
| `line` | `#F0DFC8` | bordes |
| `ink` / `muted` | `#2A1258` / `#7A6A92` | texto / texto secundario |
| `accent` / `accentInk` | `#E5368C` / `#FFFFFF` | botón principal, precio, enlaces (`link #C41E72`) |
| `amber` / `amberInk` | `#FFB800` / `#2A1258` | ítem activo, contadores |
| `side` / `sideCard` | `#2A1258` / `#3A1E78` | barra lateral y su tarjeta de conexión |
| `sideText` / `sideMuted` | `#FFF4E2` / `#B9A8D9` | texto de la barra lateral |
| ok | fondo `#E2F7EA`, texto `#16653A` | éxito |
| warn | fondo `#FFE9B3`, texto `#5C3B00`, borde `#FFB800` | advertencia (`chip` igual) |
| err | fondo `#FFE1EA`, texto `#B3123F` | error |
| `inputBg` | `#FFFCF7` | campos |
| origen Alegra / propia | `#E6E9FF` + `#2A3BA8` / `#FFE1EF` + `#A01460` | etiquetas de origen en Inicio |
| radios | `14px` (campos, botones) / `22px` (tarjetas) | |
| sombras | `0 6px 0 #2A1258` (tarjeta) / `0 4px 0 #8E1553` (botón principal) | sombra sólida desplazada |

**Primitivas compartidas**: `components/ui/` (Card, Button, Field, Alert, Badge, PageHeader, StatusDot). Las pantallas existentes se reestilizan con ellas, sin clases ad hoc por pantalla.

**Alternativas**: copiar el CSS en línea del mockup (duplicación); librería UI externa (dependencia nueva sin necesidad); mantener el estilo actual (contradice la decisión del responsable).

## 2. Qué hace el tema en el PDF (decisión del responsable) y cómo se garantiza la legibilidad

**Decisión**: el tema recolorea **solo los elementos que el PDF dibuja con CSS**. Las imágenes de Cat.pdf (`cover-bg.jpg`, `frame.png`, `marble.jpg`, `collage.png`, `sold-out.png`) no cambian. Los acentos se dibujan **siempre sobre o pegados a una forma del color `background`**, de modo que la regla de contraste "acento vs. fondo" sea la que realmente determina la legibilidad.

| Token | Defecto | Elemento (CSS actual) | Tipo | Cambio exacto |
| --- | --- | --- | --- | --- |
| `background` | `#11052C` | `.cover-title` y `.section-title` (relleno; hoy `#2a0a35`) | recolor | `color` / relleno = `--pdf-bg` |
| `background` | | `.image-card` (hoy `#0a0a0a`) | recolor | `background: var(--pdf-bg)` |
| `background` | | `.price` (hoy `rgba(103,84,96,.82)`) | recolor | fondo `--pdf-bg`, texto blanco (se mantiene) |
| `background` | | pie `FooterInfo` y chips de políticas | **nuevo** | fondo `--pdf-bg`, texto blanco |
| `accent1` | `#FF007A` | `.section-title` contorno (hoy `#d6119a`) | recolor | `-webkit-text-stroke-color: var(--pdf-accent-1)` |
| `accent1` | | `.cover-title` resplandor (hoy `rgba(180,0,150,.35)`) | recolor | `text-shadow` con `--pdf-accent-1` |
| `accent1` | | `.terms-block h3` (hoy texto `#5a1478` sobre crema) | **nuevo** | chip: fondo `--pdf-bg`, texto `--pdf-accent-1`, `border-radius:999px` |
| `accent2` | `#00FF66` | `.image-card` | **nuevo** | borde de 4 px `--pdf-accent-2` pegado al fondo oscuro de la tarjeta |
| `accent3` | `#FF9900` | `.price` | **nuevo** | borde de 2 px `--pdf-accent-3` |
| `accent3` | | línea separadora del pie | **nuevo** | `border-top: 2px solid var(--pdf-accent-3)` |

**Mecanismo**: `CatalogDocument` escribe `--pdf-bg`, `--pdf-accent-1`, `--pdf-accent-2`, `--pdf-accent-3` como `style` de `.print-root`. En `print.css` cada `var(--pdf-…, <default>)` usa como valor de reserva el **valor por defecto del tema** (no "el aspecto actual"): sirve solo si un componente se usa fuera de `CatalogDocument`.

**Riesgo**: al pintar elementos nuevos (anillo, borde de precio, chips de políticas, pie), el PDF por defecto se ve distinto del actual. Mitigación: la tarea de revisión visual (SC-007) lo valida contra Cat.pdf y los mockups; los valores por defecto se cambian en un solo archivo (`theme.ts`).

**Alternativas**: rediseñar a fondo sólido neón (rehacer todas las páginas); colorear texto de acento sobre las burbujas crema (el contraste real contra `#E8DFD0` es 1,6:1 para `accent3`, 2,9:1 para `accent1` y 1,03:1 para `accent2`, no verificable con el fondo del tema); usar los colores actuales como defaults (obligaría a cambiar la spec).

## 3. Persistencia y validación del tema

**Decisión**: tabla `catalog_theme` de una fila (`id = 1`) con cuatro colores `#RRGGBB` y `updated_at`. Sin fila se devuelven los valores por defecto (no se inserta hasta el primer guardado). "Restaurar" borra la fila. El texto de banner y el contacto **no se duplican**: siguen en `business_settings` (`cover_title`, `phone_1`, `phone_2`, `address`); Apariencia tiene **un solo botón Guardar** que llama a `PUT /settings/theme` y luego a `PUT /settings/business` en secuencia; si el segundo falla, muestra qué parte no se guardó y mantiene el estado sucio del formulario.

**Validación** (zod en el servidor, mapeada a `HttpError(422, 'invalid_theme', …, [{field,message}])` porque el manejador global convertiría un `ZodError` en `validation_error`; la misma función `isHexColor` en el cliente): cada color es `#RRGGBB` (se normaliza a mayúsculas; se rechaza `#RGB`, nombres y alfas).

**Advertencias de contraste** (no bloquean): relación WCAG entre `background` y blanco menor que 4,5 (`low_text_contrast`: texto blanco sobre las superficies de fondo), y entre cada acento y `background` menor que 3 (`low_accent_contrast`: los acentos se dibujan pegados al fondo, ver §2). Con los defaults: blanco/fondo 19,4; acentos 5,1 / 14,3 / 9,1 — sin advertencias. La lógica vive en `backend/src/catalog/theme.ts`, un módulo puro sin importaciones de Node, para la muestra en vivo y para el `PUT`.

**Concurrencia entre pestañas**: `GET` y `PUT` devuelven `updatedAt` (`null` si es el tema por defecto). El `PUT` acepta `expectedUpdatedAt`; si no coincide con el valor guardado responde `409 theme_changed` y el editor pide recargar. `DELETE` (restaurar) no exige la marca.

**Alternativas**: guardar el tema en `business_settings` (mezcla dos conceptos y complica restaurar); `#RGB`/`rgb()` (más casos de borde sin valor); bloqueo con versión obligatoria (innecesario con un solo usuario).

## 4. Opciones de generación, informe por secciones y vista previa de estructura

**Decisión**: las opciones (`sectionKeys`, `hideSoldOut`, `bannerText`) se guardan **en la entrada de preparación** y se pueden cambiar sin consultar Alegra:
- `POST /catalog/prepare` consulta Alegra y descarga imágenes una sola vez (acepta las opciones iniciales).
- `PUT /catalog/prepare/:id/options` guarda opciones y devuelve `{ report, structure, availableSections, options }` reconstruidos con el mismo `buildCatalog` (función pura, sin red).
- `GET /catalog/payload/:id` **sigue sirviendo el payload guardado** en la entrada (lo actualizan `prepare`, `setOptions` y `generate`), pero reemplaza `config.theme` por el tema guardado en ese momento, para que la vista previa refleje un tema guardado después de preparar. `generate` reconstruye el payload con las `bundleDecisions` del cuerpo y el tema vigente antes de renderizar, por lo que una decisión "omitir" nunca vuelve a incluir un combo (principio II).

**Informe filtrado por secciones (corrige un defecto de 001)**: hoy `soldOutBundles`, `omittedNoImage` y los conteos se calculan antes de aplicar `sectionKeys`; desmarcar una sección con un combo agotado seguiría exigiendo `bundle_decision_required`. `buildCatalog` etiqueta cada entrada del informe con su `sectionKey` y filtra por las secciones seleccionadas antes de devolver el informe y los conteos. Siguen siendo globales `uncategorized` y `omittedNoSection` (ítems de Alegra sin sección, que no pertenecen a ninguna sección).

**`hideSoldOut` y combos**: con `hideSoldOut = true`, los combos con algún componente agotado se omiten sin pedir decisión y no entran en `soldOutBundles` (igual que los productos agotados ocultos, no cuentan como omitidos). Con `false`, rige el flujo de 001 (decisión por combo).

**Secciones disponibles (`availableSections`)**: lista `{ key, name, source, items }` de todas las secciones con al menos un ítem elegible, calculada **antes** de aplicar `sectionKeys` y con el `hideSoldOut` vigente; es la fuente de la lista de casillas de Generar y de la selección por defecto (todas). No se usa `GET /sections`, que consulta Alegra en vivo y falla con 502 si está caído. Las claves de `sectionKeys` que ya no estén disponibles se ignoran.

**`structure`** se calcula en `backend/src/catalog/structure.ts` a partir del `CatalogPayload`: `coverPages` (1), `sectionCoverPages`, `productPages`, `termsPages` (1 si hay políticas), `ownItems`, `totalPages` y `sections[]` con el detalle de lo **incluido**. Si no hay secciones (selección vacía o catálogo vacío), devuelve todo en cero con `nothingToGenerate: true` para no mostrar un total engañoso.

**`PUT …/options` durante un renderizado**: el `JobManager` no conoce el `prepareId`; la regla es global: si hay un trabajo en estado `rendering`, responde `409 job_in_progress`.

**Alternativas**: recalcular en el cliente (duplica reglas); repreparar tras cada cambio (descarga de nuevo todo); reconstruir el payload en cada `GET` sin guardar decisiones (reintroduciría combos omitidos).

## 5. Texto del banner

**Decisión**: `bannerText` es un parámetro opcional **por generación** que no se persiste. El campo de Generar parte del `cover_title` guardado en Apariencia cada vez que se abre la pantalla; si llega vacío se usa `cover_title`. Largo máximo 80 caracteres (igual que `coverTitle`); el CSS reduce el tamaño del título de portada para textos largos.

## 6. Resumen de Inicio y contadores

**Decisión**: un solo endpoint `GET /panel/summary` devuelve `alegra` (`status`, `email`, `lastTestedAt`), `stats` (productos activos, agotados, sin categoría, páginas estimadas), `sections[]` (nombre, origen, productos, agotados) y `lastCatalog` (con `pages`). La parte que depende de Alegra se cachea **60 s** en memoria; `?refresh=1` la invalida; la invalidan además: guardar o quitar un override, guardar credenciales, crear/editar/borrar secciones o productos propios y terminar `prepare`. **`lastCatalog` no se cachea**: se lee siempre de `HistoryRepo` (local, barato), así que una generación recién terminada aparece de inmediato. El número de páginas del último catálogo se guarda dentro de `params_json` del historial al generar (sin migración).

**Cómo se calculan los indicadores sin duplicar reglas**: el servicio consulta categorías e ítems (como `prepare`, pero **sin descargar imágenes**: se considera con imagen todo ítem con URL remota), ejecuta `buildCatalog` y `computeStructure` y deriva de ahí secciones y `estimatedPages`; así hay una sola fuente de reglas (de ahí "estimadas" en el mockup).

**Timeout**: el cliente de Alegra gana una opción `timeoutMs` (por defecto sin límite, para no cambiar 001); el resumen lo usa con 8 s para que un Alegra colgado no bloquee la barra lateral. Si falla, `alegra.status = 'unreachable'` y `stats`/`sections` quedan en `null`.

**Estados**: `ok` | `unreachable` | `not_configured` (un único campo; se descarta `configured`/`isConfigured` en esta respuesta). `ok` si la última consulta del propio resumen tuvo éxito.

**Alternativas**: sondear Alegra en cada pantalla (lento, riesgo de 429); consultar con `setInterval` desde el navegador.

## 7. Navegación y nombres

**Decisión**: se usan los nombres del mockup; entradas en el orden del mockup más la nueva "Apariencia": **Inicio**, **Conexión Alegra**, **Sin categoría** (con contador), **Contenido propio**, **Combos**, **Generar catálogo**, **Historial**, **Apariencia**. Rutas: `/` Inicio, `/alegra`, `/sin-categoria`, `/contenido`, `/combos`, `/generar`, `/historial`, `/apariencia`. "Contenido propio" aloja Secciones y, como pestaña, Productos propios (`/contenido?tab=productos`); `/secciones` y `/productos-propios` redirigen allí. "Negocio" se funde en Apariencia (nombre, políticas, contacto y banner); durante US1 se conserva como entrada transitoria hasta que US3 crea Apariencia y `/negocio` redirige. El nombre de pantalla "Inicio" reemplaza a "Panel" en todo documento y en el código (`Home.tsx`).

## 8. Pruebas

**Decisión**: Vitest. Backend: unitarias de `theme.ts` (hex, contraste con los pares verificados), `structure.ts` (portadas, páginas con 0, 1, 3, 4 y 7 productos, secciones excluidas, agotados ocultos, selección vacía ⇒ ceros) y de las opciones del constructor (informe filtrado por secciones, combos y `hideSoldOut`); integración del tema (`GET/PUT/DELETE`, rechazo conserva el anterior, `409 theme_changed`, `401`), del resumen (caché, Alegra caído con timeout, `lastCatalog` sin caché) y de `PUT …/options`; integración con `pdf-parse` (**páginas del PDF = `structure.totalPages`**, texto del pie por página); **prueba de desbordamiento con Puppeteer** (`scrollHeight ≤ clientHeight` en `.bubble`, `.terms-body`, `.terms-block`, pie e introducción de sección con textos extremos), porque `pdf-parse` no detecta texto recortado. Frontend: Testing Library para Login, barra lateral, Generar (opciones → estructura, selección vacía), editor de tema (muestra, advertencias, restaurar, aviso de cambios sin guardar, conflicto 409), `CatalogDocument` (variables `--pdf-*`), y **pruebas de humo** de las pantallas reestilizadas (conexión, sin categoría, contenido propio, combos, historial) para cumplir FR-004.

**Rendimiento (objetivos del plan)**: se verifican manualmente en el quickstart (escenario 13): recálculo de estructura < 1 s, Inicio < 2 s con caché, cambio de color a PDF < 3 min.

**Revisión visual manual**: panel contra el mockup 1b y PDF contra Cat.pdf (`pdf-parse` no ve colores).

## 9. Fuera de alcance (decidido)

- Invocación desde n8n u otras herramientas (la generación sigue siendo solo manual).
- Direcciones visuales 1a "Neón" y 1c "Sobrio" y su selector.
- Editor libre de maquetación y varios temas guardados.
- Interceptar el botón "Atrás" del navegador en el editor de tema.

## Resumen de incógnitas

| Incógnita | Estado |
| --- | --- |
| Alcance del tema en el PDF | Resuelto: solo elementos dibujados, anclados al fondo (§2) |
| Contraste real de los acentos | Resuelto: los acentos se dibujan sobre `background` (§2, §3) |
| Dirección visual del panel | Resuelto: 1b Pop (§1) |
| Invocación externa | Resuelto: fuera de alcance (§9) |
| Informe y decisiones de combos por sección | Resuelto: filtrado por sección y regla de `hideSoldOut` (§4) |
| Fuente de la lista de secciones | Resuelto: `availableSections` de la preparación (§4) |
| Hex del tema por defecto vs. aspecto actual | Riesgo aceptado, se valida visualmente (§2) |
| Pendientes de 001 (T080 cuenta real, T085 escenarios y revisión visual) | Siguen abiertos; esta feature no depende de ellos ni los reemplaza |
