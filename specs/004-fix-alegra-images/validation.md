# Validación: fotos de productos de Alegra en el catálogo

**Feature**: `004-fix-alegra-images` | **Fecha**: 2026-10-04 | **Quickstart**: escenarios 1 a 8 de [quickstart.md](./quickstart.md) | **Origen de los datos**: la cuenta real de la tienda, solo lectura

Este documento no contiene nombres de productos, direcciones de fotos ni credenciales (principio III y regla de datos reales de la constitución).

## Resultado

| Escenario | Resultado |
| --- | --- |
| 1 · Pruebas en verde | ✅ Backend 47 archivos / 600 pruebas; frontend 19 archivos / 479 pruebas; `typecheck`, `lint` y `build` limpios |
| 2–4 · Simulador (fotos tipo Alegra, aviso general) | ✅ Verificados en la app: tres avisos separados, favorita elegida, aviso de problema general con todas las fotos prohibidas |
| 5 · Preparar con la cuenta real | ✅ Ver tabla "Antes y después" |
| 6 · Generar el PDF real | ✅ en **16,2 s**; ⚠️ pesa **156,4 MB** (ver "Riesgo") |
| 7 · Revisión visual | ✅ 182 de 182 fotos cargadas y 0 rotas (comprobación de DOM sobre todas las tarjetas) y revisión visual de páginas representativas |
| 8 · Foto borrada antes de generar | ✅ La generación falla en 1,5 s con *"No se pudo cargar la foto de 1 producto(s); no se generó el PDF."* y el historial no gana ninguna entrada |

## Antes y después con la cuenta real

La cuenta tiene 197 productos activos (2 son padres de variantes y se ignoran), 181 con foto y 14 sin foto.

| | Antes (código anterior) | Después |
| --- | --- | --- |
| Productos de Alegra en el catálogo | 0 | **181** (182 con el producto propio) |
| Omitidos por "no tener imagen" | 195 | **14** (los que de verdad no tienen foto) |
| Fotos que llegaron al catálogo | 0 de 181 | **181 de 181 (100 %)** |
| Fotos no obtenidas | — | 0 |
| Páginas del catálogo | 4 | 66 (62 de producto) |
| Productos agotados con foto e indicación AGOTADO | 0 | 30 de 30 |
| Tiempo de preparar | 13,2 s | 20,8 s (descarga de las 181 fotos) |
| La respuesta del informe incluye direcciones firmadas | — | no |

## Criterios de éxito

| Criterio | Medido | Estado |
| --- | --- | --- |
| **SC-001** ≥ 95 % de los productos con foto en Alegra aparecen con su foto | 181 de 181 (100 %); antes 0 | ✅ |
| **SC-002** el 100 % de los omitidos aparece en el informe con su causa | 14 omitidos, todos "sin foto en Alegra"; 0 con foto no obtenida | ✅ |
| **SC-003** el responsable entiende el informe en < 1 min | El informe separa los tres casos en avisos distintos y con texto claro (comprobado con datos reales y en pruebas). **No se cronometró con una persona** | ⚠️ pendiente de la lectura del responsable |
| **SC-004** 0 recuadros vacíos, rotos o deformados | 182 de 182 fotos cargadas, 0 rotas, 182 con `object-fit: cover`; además la generación real del PDF no se aborta (la guardia de fotos rotas habría abortado) | ✅ (revisión visual de páginas representativas, no de las 66) |
| **SC-005** agotados con foto e indicación AGOTADO | 30 de 30 | ✅ (estilo sello de Neón Noche; los estilos cinta y gris los cubren las pruebas automáticas) |
| **SC-006** PDF listo en < 2 min con hasta 200 productos | 16,2 s para generar con 182 productos | ✅ |
| **SC-007** foto favorita en los productos con varias fotos | 4 de 4 (se compararon los bytes de la foto servida con los de la favorita en Alegra; la favorita no era la primera en ninguno) | ✅ |
| **SC-008** nombre y descripción en todas las tarjetas | 182 de 182 con nombre; 3 con descripción y los 3 la muestran debajo del nombre; 0 textos distintos del dato; 0 desbordados ni cortados | ✅ (ver Historia 4) |

## Historia 4: nombre y descripción (pedido durante la validación)

El responsable pidió validar que el diseño conserve el nombre y la descripción del producto. Con datos reales se vio que 2 de los 181 productos de Alegra tienen descripción y que su tarjeta mostraba **solo** la descripción (una nota sobre el valor de envío), sin nombre. Eso incumplía FR-010 de `001` y no se había notado porque ninguna foto de Alegra llegaba al catálogo.

| Tarjetas (182) | Antes | Después |
| --- | --- | --- |
| Solo nombre (sin descripción en Alegra) | 179 | 179 |
| Solo descripción, sin nombre | **2** | **0** |
| Nombre y descripción | 1 (propio) | 3 (2 de Alegra y 1 propio) |
| Sin nombre ni descripción | 0 | 0 |

## Riesgo materializado: tamaño del PDF

El PDF real pesa **156,4 MB** para 182 fotos (106 PNG y 76 JPG de las elegidas, la mayor de ~2 MB). Es el riesgo previsto en [research.md](./research.md) §9: Chrome no comprime bien los PNG al incrustarlos. Un archivo así es difícil de enviar por correo o mensajería. **No bloquea esta feature** (el criterio de salida del quickstart lo trataba como una feature aparte) pero conviene abrirla: reducir las fotos al descargarlas necesita una librería de imágenes, que esta feature evitó (principio VI).

## Notas

- **Pestaña oculta**: en el panel oculto del navegador integrado, `window.__printReady` no llega a `true` porque `img.decode()` (en `preload.ts`) se detiene en pestañas ocultas. Con un navegador activo (Puppeteer) llega a `true` y `__printBrokenImages` vale 0, y `test:pdf` lo cubre.
- **Datos reales tocados** (la validación se hizo con la carpeta `data/` real por decisión del responsable): `data/image-cache/` ahora tiene las fotos descargadas (se puede borrar sin riesgo: se vuelve a llenar al preparar), el historial tiene una entrada de prueba de 156,4 MB y se borró y repuso un archivo del caché para el escenario 8.
- **Servidor del puerto 3000**: seguía ejecutando el código anterior (proceso arrancado antes de los cambios y sin modo watch), por eso la validación se hizo en una instancia aparte en el puerto 3011 sobre los mismos datos.
- **No se repitió** la comparación formal de Neón Noche con `docs/Cat.pdf`: la plantilla no cambió salvo el texto de la tarjeta (Historia 4), y el PDF conserva la estructura (portadas, páginas de producto, políticas).
