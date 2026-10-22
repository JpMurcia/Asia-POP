# Quickstart de validación: plantilla «Base AsianPop» y foto-tarjeta

**Feature**: [spec.md](spec.md) · **Contratos**: [contracts/api.md](contracts/api.md) · **Modelo**: [data-model.md](data-model.md)

Guía para comprobar de punta a punta que la feature funciona. No contiene código de implementación. **No usa la cuenta real de Alegra**: todo corre con respuestas simuladas y fotos sintetizadas, con datos temporales (ver la memoria del proyecto sobre probar con `DATA_DIR` temporal).

## 0. Requisitos

- Node.js 22, dependencias instaladas (`npm install` en la raíz y en `backend/` y `frontend/`).
- Chrome o Edge instalado (el PDF y las pruebas de fidelidad usan el navegador real).
- Un `DATA_DIR` temporal y un servidor aparte para las pruebas en el navegador; no leer `.env` ni credenciales.

## 1. Línea base: nada existente cambia (FR-022, SC-004)

La línea base de PDF de la feature 007 (`specs/007-editor-align-text-tools/visual/baseline/`) ya **no sirve** para la comparación byte a byte: es anterior a la feature 005 y sus tamaños no coinciden con el código actual (p. ej. `neon.pdf` 4.398.843 bytes frente a 4.449.759 de hoy). Se captura una línea base nueva con el código de **antes** de la 010 y se compara con el de después.

1. Con el código de antes: `BASELINE_DIR=<carpeta> npx tsx backend/tests/fixtures/pdf-baseline.ts capture` (frontend compilado con `npm run build -w frontend`; sirve un `git worktree` del commit anterior con la fusión pendiente aplicada). Guarda 8 PDF: las 4 plantillas base × (textos normales, textos máximos).
2. Con el código de ahora: `BASELINE_DIR=<carpeta> npx tsx backend/tests/fixtures/pdf-baseline.ts compare`. Los PDF de Chrome traen fecha de creación e identificador distintos en cada corrida (dos corridas del mismo código difieren solo en esos 4 bytes); el script los anula y compara el resto byte a byte.
3. Resultado esperado: «Sin diferencias.»
4. Repetir después de cada tarea que toque el modelo, el bloque de productos o el render.

### Estado inicial (antes de empezar la 010, 2026-10-22)

- Backend: 958 pruebas, todas en verde (con el frontend compilado: una prueba de fidelidad fallaba solo por un `dist` desactualizado).
- Frontend: 532 pruebas en verde; **2 archivos no cargan** por conflictos de fusión sin resolver de la persona usuaria (`tests/template-editor-inspector.test.tsx`, `tests/template-editor-reducer.test.ts`, fusión en curso con `MERGE_HEAD`). Eso también impide `tsc --noEmit` del frontend; se filtra su ruido.

## 2. Foto-tarjeta, modo «Dejar como está» (US1)

1. Crear 5 fotos de prueba con `sharp`: vertical, horizontal, cuadrada, con transparencia y diminuta; y 5 productos con nombres de 6, 18, 40 y 60 caracteres y uno de una sola palabra de 30 letras.
2. Elegir la plantilla **Base AsianPop** y pedir la vista previa del catálogo.
3. Esperado:
   - cada producto aparece como tarjeta oscura de proporción 6,10 × 8,03 cm con esquinas redondeadas;
   - la foto completa dentro de un marco claro sobre fondo desenfocado, **sin deformarse**;
   - el nombre en neón dentro de la franja superior, partido en líneas y reducido hasta caber, **sin salirse**;
   - pedir la vista previa dos veces da **exactamente la misma imagen** (comparar los bytes de `/media/cards/…`).
4. Un producto **sin foto** queda fuera y se informa cuál y cuántos.

## 3. Foto-tarjeta, modo «Quitar el fondo automáticamente» (US1, FR-008a)

1. En **Generar**, con la plantilla Base AsianPop, mirar la **tarjeta de ejemplo** y cambiar entre los dos modos: debe actualizarse en menos de 10 s (SC-011).
2. Con el modo «Quitar el fondo»:
   - foto de producto sobre **fondo blanco liso** → el producto flota sobre el fondo oscuro, con bordes limpios;
   - foto con **fondo degradado**, **producto cortado por el borde**, **dos productos separados** o **empaque blanco sobre blanco** → esa foto usa «Dejar como está» y el resumen final dice «N fotos se dejaron con su fondo original» con sus nombres.
3. Esperado en ambos modos: ninguna tarjeta con recorte roto ni partes del producto borradas (SC-010).

## 4. Plantilla «Base AsianPop» contra la base (US2, SC-001)

1. Generar una página con 3 productos (uno agotado) y compararla con la página 3 de la base (`docs/specs/rea-evidence/19-base-pagina-producto-agotado.png`).
2. Esperado, con diferencias de posición < 2 mm: título «CATÁLOGO <SECCIÓN>» centrado en mayúsculas; logo a 0,3 cm del borde superior y derecho; tres productos en zigzag; burbuja beige con la descripción centrada; precio naranja con neón sobre su pastilla; cinta AGOTADO roja diagonal **encima** de la foto.
3. **Confirmar con REA** las posiciones estimadas (filas 1 y 2 y lado derecho): en Canva, Posición → Capas → Organizar de las tarjetas 1 y 2 de la página 3, y ajustar la distribución `base` si difieren más de 2 mm (research R4).
4. Generar secciones con **0, 1, 2, 3, 4 y 7 productos**: sin huecos, sin marcadores vacíos y con las filas centradas (FR-015, SC-008).

## 5. Descripción, contacto y portadas (US3 y US4)

1. Tres productos con descripción corta, de 400 caracteres y sin descripción: la corta queda centrada; la larga se reduce y, si no cabe, se corta con «…»; el que no tiene **no muestra burbuja vacía**.
2. Cambiar un número de teléfono en la configuración del negocio y volver a generar: se actualiza en **todas** las portadas sin editar la plantilla (SC-006).
3. Subir un logo y una ilustración (imágenes de prueba): aparecen en la portada y en las páginas; quitar la ilustración deja la portada completa y equilibrada.

## 6. Peso y velocidad (SC-005, SC-009)

1. Catálogo sintético de ~180 productos con fotos del tamaño de las reales (JPG y PNG de hasta 2 MB), plantilla Base AsianPop, calidad **Optimizada**.
2. Anotar: tamaño del PDF (esperado **< 25 MB**, estimado 11–17 MB), tiempo de la **primera** generación (≤ 2 × el de una plantilla actual) y de la **segunda** (sin recomponer tarjetas: igual que hoy).
3. Si el peso supera 25 MB, bajar la calidad JPEG de la tarjeta a 82 y repetir (research R6).

## 7. Texto buscable y legibilidad (principio II)

1. Abrir el PDF generado y buscar «AGOTADO»: debe encontrar el texto en cada producto agotado.
2. Verificar a simple vista que el neón del precio y de la cinta se parece a la base (research R5) y ajustar los `text-shadow` si hace falta.

## 8. Pruebas automatizadas (resumen de lo que deben cubrir)

| Área | Pruebas |
| --- | --- |
| Modelo y esquema | Valores nuevos aceptados y rechazados; `upload:` con nombres peligrosos rechazado; `normalizeProductsBlocks` completa campos sin cambiar plantillas existentes |
| Distribución `base` | Posiciones con 0, 1, 2, 3 y 4 productos; filas centradas; sin solapes entre filas |
| `ProductsBlock` | Tarjeta, nombre dentro, AGOTADO diagonal con texto real, neón, sombra, interlineado; las otras plantillas sin cambio |
| `photo-card` | Determinismo; aceptación y rechazo del fondo con su motivo; peso por tarjeta; foto diminuta y con transparencia |
| Integración | Payload con tarjetas y sin ellas; respaldo e informe; vista previa de tarjeta; subidas de imagen (tipo, tamaño, borrado en uso) |
| PDF | Plantilla `base` con Chrome real: peso, texto «AGOTADO» buscable, sin imágenes rotas; la línea base de la 007 intacta |

Ejecutar toda la suite al final: ninguna prueba existente debe cambiar de resultado.

## 9. Resultados de la validación (2026-10-22)

Con datos temporales y Alegra simulado; nunca con la cuenta real.

| Escenario | Resultado |
| --- | --- |
| §1 No regresión | 8 de 8 PDF idénticos a la línea base (`pdf-baseline.ts compare`) |
| §2 Foto-tarjeta, «Dejar como está» | Proporción, nombre dentro de la franja, determinismo y productos sin foto fuera: cubiertos por `photo-card.test.ts`, `catalog-cards.test.ts` y `products-block-card.test.tsx`; revisado a simple vista en un PDF real |
| §3 «Quitar el fondo» | Fondo liso aceptado; degradado, producto cortado, dos productos, casi llena y blanco sobre blanco caen al marco con su motivo (`photo-card-backdrop.test.ts`); aviso final con nombres cubierto en `catalog-cards.test.ts` y `generate-photo-backdrop.test.tsx`. **Falta** probarlo con fotos reales de Alegra |
| §4 Plantilla contra la base | Fila 3 igual a lo medido (±0,1 cm, `template-layout-base.test.ts`); filas 1 y 2 y lado derecho dentro de ~1,5 mm según la captura 19 (T038 pendiente con REA); 0, 1, 2, 3, 4 y 7 productos sin huecos |
| §5 Descripción, contacto y portadas | Corta centrada, 400 caracteres sin desbordes en Chrome, sin descripción sin burbuja; contacto desde la configuración en todas las portadas; imágenes subidas |
| §6 Peso y velocidad (180 productos, calidad Optimizada) | **Marco**: 1.ª vez 9,1 s, 2.ª vez 4,6 s, PDF de 15,9 MB (Neón Noche con las mismas fotos: 6,6 s y 27,5 MB). **Sin fondo**: 12,9 s la 1.ª vez (135 de 180 fotos sintéticas cayeron al marco), 5,1 s la 2.ª, 17,0 MB. Cumple SC-005 (< 25 MB) y SC-009 (1.ª vez ≤ 2× Neón Noche: 13,2 s) |
| §7 Texto buscable | «AGOTADO» aparece como texto en el PDF solo en la página del producto agotado. Con neón, cada capa de resplandor es otra copia del texto (como el nombre de cada producto) |

Suites: backend 68 archivos y 1072 pruebas; frontend 575 pruebas (más 2 archivos con conflicto de fusión ajenos a la 010).
