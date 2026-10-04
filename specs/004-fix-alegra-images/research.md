# Research: Fotos de productos de Alegra en el catálogo

**Feature**: `004-fix-alegra-images` | **Date**: 2026-10-04

El Contexto Técnico del plan no dejó ningún `NEEDS CLARIFICATION`: la investigación de fondo (qué entrega Alegra y por qué falla la descarga) se hizo antes del plan, con la cuenta real y solo lectura, y está en la spec ("Verificación con la cuenta real"). Aquí quedan las decisiones de diseño que salen de ella.

## 1. Reconocer la foto por sus bytes, no por el tipo declarado

- **Decisión**: un módulo puro `image-sniff.ts` mira los primeros bytes: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, GIF `GIF87a`/`GIF89a`, WebP `RIFF`…`WEBP`. La extensión del archivo local sale de ese reconocimiento. El tipo declarado por el servidor solo sirve para distinguir el motivo del rechazo (`image/*` desconocido → "formato no admitido"; cualquier otro → "no es una imagen").
- **Razón**: Alegra sirve el 100 % de sus fotos como `binary/octet-stream` (verificado en 6 descargas reales, JPG y PNG). El tipo declarado es inútil como criterio; el contenido sí es fiable y también rechaza páginas de error HTML, archivos vacíos y SVG.
- **Alternativas**: (a) añadir `binary/octet-stream` a la lista blanca: aceptaría cualquier archivo (HTML de error incluido) y la extensión habría que adivinarla; (b) librería `file-type`: dependencia nueva para 4 firmas de 3 a 12 bytes (principio VI); (c) `Content-Type` de la URL por extensión: las URLs terminan en `.jpg`/`.png` pero la extensión tampoco es de fiar.

## 2. Elegir la foto: favorita primero, luego el resto en orden

- **Decisión**: `extractImageUrls(raw)` devuelve las direcciones https/http válidas con las `favorite === true` primero (en su orden) y después las demás (en su orden), sin duplicados. La elegida es la primera; las demás son candidatas de respaldo (FR-003, FR-004). `extractImageUrl` se conserva y devuelve la primera, y el mapeo sigue tolerando texto suelto, `{ url }`, `{ link }` y `{ src }` (las pruebas actuales lo usan).
- **Razón**: la marca real es `favorite`, no `isPrimary` (verificado: 177 productos con 1 foto siempre favorita; 4 con varias y la favorita nunca es la primera). Con "primera foto" hoy se mostraría la equivocada en esos 4.
- **Alternativas**: aceptar también `isPrimary` por si Alegra lo añade: es especulación sin evidencia (principio VI); se descarta. Elegir la foto de mayor tamaño: no hay dato de tamaño en la respuesta.

## 3. Consulta de ítems: sin detalle, con `mode=advanced` explícito

- **Decisión**: `listActiveItems` pide `status=active&mode=advanced`. No se consulta el detalle de cada producto ni `GET /items/{id}/attachment`.
- **Razón**: verificado que la lista ya trae `images` y que el detalle no añade nada; `GET /items/{id}/attachment` devuelve el propio ítem. La documentación de Alegra dice que `mode=simple` quita `images` y **no documenta el valor por defecto**: hoy el valor por defecto se comporta como `advanced`, pero pedirlo explícitamente evita que un cambio silencioso de Alegra vuelva a dejar el catálogo sin fotos. Verificado con la cuenta real que `advanced` devuelve exactamente lo mismo que sin parámetro.
- **Alternativas**: no enviar `mode` (menos código pero depende de un comportamiento no documentado); consulta de detalle como respaldo (200 peticiones más sin necesidad, riesgo de límite de peticiones; principio VI).

## 4. Fallo de descarga con motivo, y candidatas en orden

- **Decisión**: `ImageCache.download(url)` devuelve `{ ok: true, url }` o `{ ok: false, reason }`. Motivos (código → causa): `unauthorized` (HTTP 401/403), `not_found` (404/410), `timeout` (se agotó el tiempo límite de 10 s, que cubre cabeceras y cuerpo), `not_image` (bytes que no son imagen o cuerpo vacío), `unsupported_format` (declara `image/*` pero no es JPG/PNG/WebP/GIF), `too_large` (`content-length` o cuerpo > 10 MB; se comprueba la cabecera antes de leer el cuerpo), `unavailable` (otro HTTP no exitoso, p. ej. 5xx, o error de red). Un `fetchFirst(urls)` prueba las candidatas en orden y devuelve la primera que sirva; si ninguna sirve, devuelve el motivo de la **primera** candidata (la favorita), que es la que el responsable espera ver.
- **Razón**: el informe necesita un motivo por producto (FR-007) y FR-004 exige probar las demás fotos. El motivo de la favorita es el más representativo; si la segunda falla por otra causa no cambia lo que hay que arreglar.
- **Alternativas**: devolver siempre `null` y registrar el motivo en un log: el responsable no abre registros (SC-003); lanzar excepciones por foto: forzaría `try/catch` en cada llamada y cortaría la preparación (FR-006 lo prohíbe).

## 5. Qué entra y qué no en el informe de revisión

- **Decisión**: `ReviewReport.photos = { informed, obtained, notObtained: [{ id, name, reason }], allFailed }`, todo calculado en el constructor del catálogo a partir de dos entradas nuevas: las URLs informadas por producto (ya están en `NormalizedItem`) y los fallos con motivo (`photoFailures`). `omittedNoImage` conserva su forma y su contenido: los productos con foto no obtenida **siguen estando en él** (así `counts.omitted` no cambia y la regla "se omite e informa" es la misma). La pantalla separa: `sin foto en Alegra` = `omittedNoImage` de origen Alegra menos los de `notObtained`.
- **`allFailed`** = hay al menos un producto con foto informada y **ninguno** la obtuvo (FR-008). Se calcula sobre todos los productos activos que no son padres de variantes, sin importar qué secciones estén seleccionadas, porque es una señal de problema general y no de una sección.
- **Razón**: aditivo y retrocompatible; no mezcla propios/combos con motivos de descarga. El panel de Inicio (`panel-summary`) pasa las URLs remotas como si fueran locales (no descarga), por lo que allí `allFailed` es siempre falso, que es lo correcto.
- **Alternativas**: añadir `reason` a `OmittedItem` (rompe pruebas y mezcla orígenes); guardar el motivo en la base de datos (el informe es efímero por preparación; no hace falta persistencia).

## 6. Una foto que no carga al renderizar aborta la generación

- **Decisión**: tras `whenAssetsReady`, `Print.tsx` cuenta las imágenes de producto (`img.pb-img`) que terminaron sin cargar (`complete && naturalWidth === 0`) y lo expone en `window.__printBrokenImages`. `PuppeteerRenderer.render` lo lee tras `__printReady` y, si es mayor que 0, lanza un error con mensaje en español ("No se pudo cargar la foto de N producto(s); no se generó el PDF.") que el trabajo muestra tal cual y que no deja PDF parcial.
- **Razón**: FR-012 y el principio II. Hoy `whenAssetsReady` resuelve igual en `load` que en `error`, así que una copia local borrada o corrupta entre preparar y generar imprimiría un ícono roto sin que nadie lo notara. Se acota a `img.pb-img` para no confundir con imágenes decorativas de la plantilla (un SVG sin tamaño intrínseco puede tener `naturalWidth` 0 sin estar roto).
- **Alternativas**: `onError` con imagen de respaldo (descartado con la opción A: ocultaría el problema y mostraría algo que el cliente no esperaba); verificar los archivos en el servidor antes de renderizar (no detecta un fallo del propio navegador al decodificarlos).

## 7. Lo que ya está resuelto y solo se verifica

- **Esperar la carga**: el render usa `networkidle0` y la página de impresión espera fotos y fuentes. Las fotos se descargan a disco antes de dibujar, así que el navegador solo carga archivos locales (`/media/cache/...`). No hay nada que cambiar; la conversión a Base64 no aporta (descartada).
- **Recorte proporcional**: `.pb-img` ya usa `object-fit: cover`. Se verifica con fotos reales de proporciones variadas.
- **AGOTADO con foto**: ya existe en sello, cinta y gris. Se verifica con fotos reales.
- **Enlaces temporales**: se observó un vencimiento de ~7 días en la lista (la documentación habla de 30 minutos para la respuesta de subida). Como las fotos se descargan en la misma preparación en que se obtienen los enlaces, el vencimiento no aplica y FR-015 se cumple sin renovar enlaces. La copia local se nombra con el hash de la URL: reutilizarla dentro de la hora es reutilizar bytes ya descargados, no un enlace.

## 8. Simulador de pruebas con la forma real de Alegra

- **Decisión**: el servidor Alegra simulado sirve fotos con la forma `{ id, name, url, favorite }` y rutas de foto con el comportamiento real y los fallos: `/img/generic.png` y `/img/generic.jpg` (200 con `binary/octet-stream`), `/img/forbidden` (403), `/img/missing` (404), `/img/html` (200 `text/html`), `/img/svg` (200 `image/svg+xml`), `/img/slow` (tarda más que el tiempo límite de la prueba), `/img/big` (supera el tope configurado en la prueba) y `/img/error` (500). `dev-mock.ts` sirve sus fotos igual que Alegra para poder revisar a mano. El registro de peticiones guarda también la consulta (`search`) para comprobar `mode=advanced`. `ok.png` (con `image/png`) se conserva para no tocar las pruebas actuales.
- **Razón**: FR-016 exige que las pruebas imiten la forma real, y sin esto el bug no se habría reproducido jamás: el simulador actual sirve las fotos con `image/png`, que es justo lo que Alegra **no** hace. Ver [contracts/alegra-item-photos.md](./contracts/alegra-item-photos.md).
- `ImageCache` recibe un cuarto parámetro opcional `maxBytes` (por defecto 10 MB) para probar `too_large` sin generar archivos enormes.

## 9. Riesgos y medidas

- **Tamaño del PDF**: 109 de las 186 fotos son PNG y una de las seis de muestra pesa ~2 MB. Con fotos reales por primera vez, el PDF podría pesar decenas de MB. **Medida**: el quickstart registra el tamaño y el tiempo de generación con la cuenta real. Si resulta excesivo, el remedio (reducir las fotos al descargarlas) necesitaría una librería de imágenes y se abre como feature aparte; no es parte de esta.
- **Foto favorita no descargable pero otra sí**: FR-004 usa la otra. El informe no marca ese producto como fallo (sí aparece con foto); es el comportamiento pedido.
- **Cambio futuro de la forma de Alegra** (por ejemplo, otro nombre de campo): el efecto sería "todos sin foto en Alegra". No se añade una alerta nueva (no hay evidencia, principio VI); el informe ya mostraría 197 productos omitidos, y la documentación de integración (FR-013) deja registrada la forma verificada y la fecha.
- **Documentación oficial desactualizada**: los 30 minutos de vencimiento, `isPrimary` y `attachments` no coinciden con la cuenta real. El plan se basa en lo verificado, no en la documentación.
