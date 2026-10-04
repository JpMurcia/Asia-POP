# Implementation Plan: Fotos de productos de Alegra en el catálogo

**Branch**: `004-fix-alegra-images` (el nombre solo identifica la feature; no tiene rama propia, el trabajo vive en `main`) | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-fix-alegra-images/spec.md`

## Summary

Ningún producto de Alegra llega al catálogo porque **la descarga de fotos descarta las 186 fotos de la cuenta real**: Alegra las sirve con `content-type: binary/octet-stream` y `ImageCache` solo acepta tipos de imagen declarados. El fallo es silencioso y se confunde con "producto sin foto". El plan tiene tres frentes, todos sin dependencias nuevas ni cambios de esquema:

1. **Obtener la foto correcta** (Historia 1, P1): reconocer JPG/PNG/WebP/GIF **por sus bytes** y no por el tipo declarado; elegir la foto `favorite` (en los 4 productos con varias fotos la favorita no es la primera) y, si falla, probar las demás; pedir los ítems con `mode=advanced` para no depender de un valor por defecto no documentado.
2. **Explicar cada foto que falta** (Historia 2, P2): `ImageCache` devuelve un motivo por cada fallo y el informe de revisión gana un campo aditivo `photos` que separa "sin foto en Alegra" de "foto no obtenida" (con motivo) y avisa cuando **ninguna** foto informada se pudo obtener. `omittedNoImage` no cambia, así que la regla de omitir (opción A) y sus pruebas quedan intactas.
3. **Que nada roto llegue al PDF** (Historia 3, P3): la página de impresión cuenta las fotos de producto que no cargaron y el render aborta con un mensaje claro en lugar de imprimir un ícono de imagen rota (principio II). El recorte proporcional (`object-fit: cover`) y la indicación AGOTADO ya existen y solo se verifican.

Decisiones y alternativas en [research.md](./research.md). La causa raíz y las medidas reales de la cuenta están en la spec ("Verificación con la cuenta real").

**Orden de implementación recomendado** (para `/speckit-tasks`): ① Historia 1 completa (reconocimiento por bytes, motivos internos, elección de favorita, `mode=advanced`, simulador con fotos tipo Alegra): por sí sola ya devuelve las fotos al catálogo → ② Historia 2 (informe `photos` y avisos en Generar) → ③ Historia 3 (fotos rotas abortan el render, verificación visual, PDF y tiempos con la cuenta real) → ④ documentación (FR-013).

## Technical Context

**Language/Version**: TypeScript estricto, Node.js 22 LTS (sin cambios respecto a 001–003)

**Primary Dependencies**: Backend: Express, better-sqlite3, Puppeteer, zod, multer. Frontend: React, Vite, Tailwind CSS v4, React Router. **Sin dependencias nuevas**: reconocer 4 formatos por sus primeros bytes no justifica una librería (research §1)

**Storage**: copias de fotos en `data/image-cache/` (archivos nombrados por hash de la URL + extensión real); **sin cambios de esquema** ni migraciones. El informe de revisión vive en la preparación en memoria, no en SQLite

**Testing**: Vitest (backend y frontend), supertest, servidor Alegra simulado (`backend/tests/fixtures/alegra-mock.ts`, ampliado con fotos con la forma real y respuestas de fallo), Puppeteer para el aborto por foto rota; revisión visual manual con la cuenta real (quickstart). Nunca se prueba contra la cuenta real de forma automática (principio V)

**Target Platform**: Windows 11, navegador moderno en `localhost` (sin cambios)

**Project Type**: web-application (frontend + backend, un solo proceso)

**Performance Goals**: SC-006: con hasta 200 productos el PDF listo en < 2 min. Medido con la cuenta real: 186 fotos, 70–625 ms cada una, la mayor de ~2 MB; con concurrencia 6 la descarga estimada es de ~10–30 s. Se verifica a mano en el quickstart

**Constraints**: Alegra solo lectura (únicamente `GET`); sin credenciales ni direcciones firmadas en informe, registros ni mensajes; tiempo límite de 10 s y tope de 10 MB por foto (valores actuales); un fallo de foto no detiene la preparación; un fallo de Alegra o de render sigue abortando sin PDF parcial

**Scale/Scope**: cuenta real de 197 productos activos (181 con foto, 186 fotos: 77 JPG y 109 PNG); 3 módulos de backend con cambios de comportamiento, 2 archivos nuevos puros, 3 pantallas/páginas de frontend con cambios menores

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
| --- | --- | --- |
| I. Alegra solo lectura | Solo `GET /items` (con `mode=advanced`) y descargas de fotos sin credenciales. No se usa `POST`/`DELETE /items/{id}/attachment` (FR-014) y no se consulta el detalle ni `GET /items/{id}/attachment`. Hay una prueba que exige que todas las peticiones a Alegra sean `GET` (ya existe; se extiende al flujo de fotos) | ✅ |
| II. El catálogo nunca engaña | Un producto sin foto utilizable sigue **fuera del PDF y se informa** (opción A, sin enmienda); el informe ahora dice cuáles y por qué. Una foto que no carga al renderizar **aborta** la generación en vez de imprimir un recuadro roto; no se entrega un PDF parcial. Reglas de AGOTADO, precio y combos intactas | ✅ |
| III. Seguridad de credenciales | El informe y los mensajes llevan **solo el código de motivo y el nombre del producto**; las URLs firmadas (`Expires`, `Signature`, `Key-Pair-Id`) no se guardan en el informe, no se registran y no se devuelven por la API. El token no interviene en las descargas (las fotos se piden sin `Authorization`). Una prueba verifica que el cuerpo de la respuesta no contiene la URL de origen | ✅ |
| IV. Fidelidad visual | Sin cambios de diseño: la tarjeta la dibuja `TemplatePage` y `.pb-img` ya usa `object-fit: cover`. Se verifica visualmente con fotos reales (JPG y PNG de proporciones variadas) en la plantilla Neón Noche contra `docs/Cat.pdf` | ✅ |
| V. Pruebas sobre las reglas | Pruebas unitarias del reconocimiento por bytes, de la descarga con cada motivo y del orden de candidatas; del constructor (informe `photos`); de integración de preparar con fotos de forma real; y del aborto por foto rota (con el navegador real, en la suite `test:pdf`). Las pruebas contra Alegra usan respuestas simuladas | ✅ |
| VI. Simplicidad | Sin dependencias, sin esquema, sin endpoints nuevos, sin imagen de respaldo (descartada), sin consulta de detalle ni revisión manual repetible (descartadas tras la verificación real). Complejidad mínima y justificada: un campo aditivo en el informe y un contador de fotos rotas en la página de impresión | ✅ |

Sin violaciones: **no hace falta enmendar la constitución** (la opción A conserva el principio II tal cual).

Re-evaluación tras el diseño (Fase 1): sin violaciones pendientes. El campo `photos` es aditivo, `omittedNoImage` conserva su forma y la guardia de render solo se activa cuando una foto de producto realmente no cargó.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-alegra-images/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── alegra-item-photos.md   # forma real verificada de las fotos de Alegra y de lo que debe simular el servidor de pruebas
│   └── review-report.md        # cambio aditivo del informe de revisión (`report.photos`) y sus motivos
├── checklists/
│   └── requirements.md
└── tasks.md                    # lo crea /speckit-tasks
```

### Source Code (repository root) — solo lo que cambia o se agrega

```text
backend/
├── src/
│   ├── alegra/
│   │   ├── alegra.types.ts      # CAMBIA · AlegraImageRaw { id, name, url|link|src, favorite }; images admite texto suelto u objeto
│   │   ├── alegra.mapper.ts     # CAMBIA · extractImageUrls (favoritas primero, luego el resto en orden; solo http/https); extractImageUrl = la primera; NormalizedItem.imageUrls
│   │   └── alegra.client.ts     # CAMBIA · listActiveItems pide status=active&mode=advanced
│   ├── pdf/
│   │   ├── image-sniff.ts       # NUEVO · puro: reconoce JPG/PNG/WebP/GIF por sus primeros bytes
│   │   ├── image-cache.ts       # CAMBIA · acepta por contenido, devuelve motivo, prueba candidatas en orden, DownloadResult/PhotoOutcome
│   │   └── pdf.service.ts       # CAMBIA · aborta si la página informa fotos de producto rotas
│   └── catalog/
│       ├── types.ts             # CAMBIA · PhotoFailureReason, PhotoNotObtained, PhotoReport; ReviewReport.photos
│       ├── photo-reasons.ts     # NUEVO · puro (lo importa el frontend): texto en español de cada motivo
│       ├── catalog-builder.ts   # CAMBIA · entrada photoFailures; calcula report.photos (informed, obtained, notObtained, allFailed)
│       └── catalog.service.ts   # CAMBIA · pasa las candidatas de cada producto al caché y los resultados al constructor
└── tests/
    ├── fixtures/alegra-mock.ts  # CAMBIA · fotos con forma real (id, name, url, favorite) y rutas de foto: tipo genérico, 403, 404, HTML, SVG, 500, lenta, grande; registra la consulta
    ├── fixtures/dev-mock.ts     # CAMBIA · el simulador manual sirve fotos como Alegra, con un producto de foto prohibida y variante "todas fallan"
    ├── unit/
    │   ├── image-sniff.test.ts          # NUEVO
    │   ├── image-cache.test.ts          # NUEVO · cada motivo, tipo genérico, candidatas, sin archivos a medias
    │   ├── photo-selection.test.ts      # NUEVO · favorita primero, varias favoritas, sin marca, enlaces inválidos, formas toleradas
    │   ├── alegra-client.test.ts        # CAMBIA · pide mode=advanced y solo GET
    │   └── catalog-builder.test.ts      # CAMBIA · informe photos: notObtained, allFailed, conteos; omittedNoImage intacto
    └── integration/
        ├── catalog-photos.test.ts       # NUEVO · preparar con la forma real de Alegra (tipo genérico, favorita), informe photos, sin URLs firmadas, solo GET
        └── pdf-render.test.ts           # CAMBIA · con el navegador real, una foto de producto rota aborta el render con el mensaje claro (npm run test:pdf)

frontend/
├── src/
│   ├── pages/
│   │   ├── Generate.tsx          # CAMBIA · aviso general, lista "foto no obtenida" con motivo y lista "sin foto en Alegra"
│   │   └── Print.tsx             # CAMBIA · cuenta fotos de producto rotas → window.__printBrokenImages
│   └── print/
│       ├── broken-images.ts      # NUEVO · puro: countBrokenProductImages(root)
│       └── blocks/ProductsBlock.tsx  # CAMBIA (pedido durante la implementación, Historia 4) · todo producto muestra su nombre y, si la tiene, su descripción debajo
└── tests/
    ├── generate.test.tsx         # CAMBIA · fixture con photos y tres avisos
    ├── template-page.test.tsx    # CAMBIA · nombre y descripción en la tarjeta de Alegra (Historia 4)
    ├── parity.test.tsx           # CAMBIA · fixture del informe con photos
    └── broken-images.test.ts     # NUEVO

docs/
└── Alegra integracion.md         # CAMBIA · estructura real de las fotos; se retira la imagen de respaldo (FR-013)
```

**Structure Decision**: se conserva la aplicación web de un solo proceso (backend + frontend) de 001–003. Los dos archivos nuevos de lógica son **puros** (`image-sniff.ts`, `photo-reasons.ts`) para probarlos sin red y para que el frontend reutilice los textos sin duplicarlos, igual que 003 hizo con `template.ts`.

## Complexity Tracking

Sin violaciones de la constitución; no hay nada que justificar. Los dos añadidos que podrían parecer extra y por qué se quedan:

| Añadido | Por qué hace falta | Alternativa más simple descartada |
| --- | --- | --- |
| Campo aditivo `report.photos` | FR-007 y FR-008 exigen separar "sin foto en Alegra" de "foto no obtenida" con motivo y avisar de un problema general; hoy un solo dato (`omittedNoImage`) los mezcla y por eso este bug no se vio desde el panel | Añadir `reason` a `OmittedItem`: rompería las pruebas que comparan `omittedNoImage` con `toEqual` (`catalog-builder`, `custom-product`, `bundle-soldout`, `generation-options`, `custom-sections`) y mezclaría custom/combos con motivos de descarga |
| Contador de fotos rotas en `Print.tsx` + aborto en el render | FR-012 prohíbe un recuadro roto en el PDF; hoy `whenAssetsReady` da por lista la página aunque una foto falle | Confiar en que las fotos locales siempre existen: una copia borrada o corrupta entre preparar y generar imprimiría un ícono roto y violaría el principio II |
