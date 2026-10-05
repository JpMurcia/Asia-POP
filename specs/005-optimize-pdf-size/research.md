# Investigación: PDF del catálogo liviano para enviar

**Feature**: `005-optimize-pdf-size` | **Fecha**: 2026-10-04

El Contexto Técnico del plan no dejó ningún `NEEDS CLARIFICATION`, pero la spec pidió algo previo a cualquier decisión: **medir de qué está hecho el PDF de 156 MB** antes de comprometer el tamaño objetivo de 25 MB (Supuestos, "De dónde viene el peso"). Esa medición se hizo con los datos reales que ya hay en disco (la carpeta `data/` de la validación de 004), de solo lectura, sin consultar Alegra y sin llevar al repositorio nombres de productos ni direcciones de fotos: solo agregados. Los experimentos usaron scripts desechables en una carpeta temporal; no forman parte del producto.

## 0. Lo medido

### 0.1 De qué está hecho el PDF real (156,41 MB, 66 páginas)

| Contenido | Objetos | Tamaño | % del archivo |
| --- | --- | --- | --- |
| Imágenes comprimidas con Flate (fotos PNG, ya decodificadas por Chrome) | 113 | 140,93 MB | **90,1 %** |
| Imágenes JPEG (Chrome las incrusta tal cual vienen) | 75 | 8,14 MB | 5,2 % |
| Máscaras de transparencia (Flate y JPEG) | 250 | 5,84 MB | 3,7 % |
| Formularios (fondos, íconos de plantilla) | 251 | 0,94 MB | 0,6 % |
| Estructura del archivo | — | 0,51 MB | 0,3 % |
| Tipografías y otros | 93 | 0,06 MB | 0,0 % |

**Conclusión**: el peso es de las fotos (**más del 95 %**) y, dentro de ellas, de los PNG. Las tipografías, los fondos y las portadas pesan menos de 1,5 MB en total: la suposición de la spec se confirma y **ningún otro elemento compromete los 25 MB**.

**Por qué los PNG pesan tanto**: Chrome decodifica cada PNG a píxeles y los vuelve a comprimir con Flate; los 106 PNG ocupan 93,5 MB como archivos y **141 MB** dentro del PDF (1,5 veces más). Un JPEG, en cambio, se incrusta sin recodificar. Lo que manda es la **cantidad de píxeles**, no el tipo de archivo.

### 0.2 Las fotos que hay en el caché

| | PNG | JPG |
| --- | --- | --- |
| Contenidos distintos | 106 | 74 |
| Peso como archivo | 93,5 MB (media 903 KB) | 17,2 MB (media 238 KB) |
| Lado mayor (mediana / p90 / máximo) | 640 / 1.536 / 1.956 px | 597 / 1.600 / 4.000 px |
| Con canal de transparencia | **82** (64 con transparencia real, 18 opacos) | 0 |

38 de las 180 fotos miden menos de 480 px de lado mayor y no hay que reducirlas. De los JPG, 5 traen perfil de color y 12 son progresivos; ninguno es CMYK.

### 0.3 Experimento controlado con las 180 fotos reales

Se armó un PDF de prueba con las 180 fotos en tarjetas de la medida de Neón Noche (aproximada a 173 × 227 unidades, es decir, ~361 × 473 px a 150 ppp; 3 por página, ~60 páginas) y se midió con el mismo Chrome que usa la aplicación:

| Escenario | PDF | Chrome tarda | Fotos preparadas |
| --- | --- | --- | --- |
| Fotos originales (reproduce el problema; el real pesa 156,4 MB) | **149,2 MB** | 12,6 s | — |
| Todo a JPEG aplanado sobre blanco (cota inferior) | 8,4 MB | 2,0 s | 2,5 s (14 ms por foto) |
| **JPEG + PNG con transparencia real reducido** (calidad 88, 4:4:4) | **18,1 MB** | 2,6 s | 2,5 s |

El experimento reproduce el problema (149 contra 156 MB: el real incluye además portadas, fondos y 2 fotos más) y valida la solución: **18,1 MB**. Sumando la base real del catálogo (~1,5 MB) la estimación es de **~20 MB, con un margen de unos 5 MB (20 %) frente a los 25 MB**.

## 1. Dónde actuar: antes de Chrome, sobre las fotos

- **Decisión**: reducir y recomprimir las fotos **antes** de que Chrome dibuje la página, y que el PDF las incruste ya livianas.
- **Razón**: Chrome incrusta el mapa de píxeles de lo que la página le muestra. Si la foto trae 1.500 × 1.500 píxeles para un recuadro de 360 × 474, el PDF paga los píxeles que sobran. Reducir antes es lo único que ataca la causa (0.1).
- **Alternativas descartadas**: (a) **procesar el PDF ya generado** con una herramienta externa (Ghostscript, qpdf, pdf-lib): Ghostscript hay que instalarlo aparte en Windows y su licencia es AGPL; qpdf y pdf-lib no recomprimen imágenes. (b) **Opciones de Chrome**: `page.pdf` no tiene ninguna para la calidad de las imágenes.

## 2. Qué librería de imágenes

- **Decisión**: `sharp` (^0.35), en el backend.
- **Razón**: medida con las fotos reales, procesa cada foto en **14 ms** (2,5 s las 180); maneja JPG, PNG, WebP y GIF; aplica la orientación EXIF, convierte los perfiles de color y detecta si un PNG tiene transparencia real. Es la forma habitual de hacerlo en Node, Apache-2.0, pide Node ≥ 20,9 (el proyecto usa 22) y su binario para Windows (19 MB) se instaló sin compilar en 4 s en esta misma máquina. Se prueba sin navegador, con imágenes sintéticas (principio V).
- **Alternativas consideradas**:

| Opción | Por qué se descarta |
| --- | --- |
| Reducir con un `canvas` en el propio Chrome | Sin dependencia nueva, pero no se puede probar sin abrir un navegador, hay que pasar los bytes de ida y vuelta por la página, y la orientación EXIF y los perfiles de color quedan a merced del navegador |
| `jimp` (JavaScript puro) | Sin binario, pero decodificar cada PNG grande lleva del orden de segundos: 180 fotos se acercarían a los 2 minutos de SC-004 |
| Ghostscript / qpdf / pdf-lib | Ver sección 1 |

- **Justificación del principio VI** (dependencia nueva): 004 evitó una librería de imágenes porque reconocer cuatro formatos por sus bytes no la justificaba; reducir y recomprimir sí: no se puede hacer a mano con fiabilidad y es el núcleo de la feature. Se importa de forma estática: si el binario no estuviera, el servidor falla al arrancar con un error claro, en lugar de generar en silencio PDF de 156 MB.

## 3. Qué hacer con la transparencia

- **Decisión**: una foto con **transparencia real** se conserva como PNG con transparencia (solo reducida). Una foto sin transparencia, o con un canal alfa totalmente opaco, pasa a JPEG.
- **Razón**: 64 de las 180 fotos son recortes sobre fondo transparente. Si se aplanaran sobre un color fijo se verían con una caja blanca o negra sobre la tarjeta (FR-006). Conservar la transparencia garantiza **por construcción** que se vean igual y evita decidir un color de fondo: el estilo AGOTADO «gris» aplica un filtro de grises sobre la foto pero no sobre el fondo de la tarjeta, por lo que aplanar sobre el color de la tarjeta tampoco sería equivalente. Cuesta unos 12 MB más que aplanar (18,1 contra 8,4 MB) y cabe en el objetivo.
- **Alternativa de reserva**: aplanar sobre el color de la tarjeta cuando sea un color sólido y no sea el estilo gris. Bajaría el total a ~9 MB, pero añade reglas y riesgo visual que hoy no hacen falta (principio VI). Queda como palanca si algún día el objetivo se acerca al límite.
- Las 18 fotos con canal alfa **opaco** se detectan y van a JPEG: no pierden nada.

## 4. Resolución objetivo (FR-004)

- **Decisión**: 150 puntos por pulgada al tamaño impreso de la foto, calculado **desde la plantilla** de la generación, nunca desde un tamaño fijo.
- **Cómo**: la página lógica mide 595,28 unidades de ancho sobre 210 mm, es decir, **1 unidad = 1/72 de pulgada**, así que 150 ppp = 150 / 72 ≈ 2,083 píxeles por unidad. Para cada bloque de productos de la página «Productos» de la plantilla se obtienen las medidas de sus tres recuadros de foto con `layoutRows` (ya existe y lo usan el editor y el PDF) y se toma el **mayor** ancho y el mayor alto. Calculado con el código real para las cuatro plantillas base: Neón Noche (`alternado`) 172,6 × 227,3 unidades → **360 × 474 px**; Pop crema (`alternado`) 158,8 × 213,4 → 331 × 445 px; Kawaii (`tarjetas`) 167,9 × 193,1 → 350 × 403 px; Kraft minimal (`lista`) 148,2 × 148,2 → 309 × 309 px. (El experimento de la sección 0.3 usó una caja aproximada de 173 × 227 unidades, 361 × 473 px; la diferencia no cambia el resultado.)
- **Reducción**: la foto se escala hasta que **cubra** ese recuadro (`fit: outside`) y **nunca se agranda**; sin recorte, porque el recorte lo sigue haciendo `object-fit: cover` en la página, igual que en Original (FR-004, FR-005).
- **Razón de calcularlo desde la plantilla**: el editor (003) permite agrandar el bloque; un tamaño fijo bajaría de 150 ppp en una plantilla con fotos más grandes, o desperdiciaría peso en una con fotos pequeñas.

## 5. Parámetros del JPEG

Se midió la pérdida de cada foto con la métrica PSNR (reducida sin pérdida contra su versión JPEG) en las 116 fotos que van a JPEG:

| Calidad y submuestreo del color | Peso de las 116 | PSNR peor caso | PSNR mediana |
| --- | --- | --- | --- |
| 82, 4:2:0 | 3,4 MB | 27,0 dB | 35,1 dB |
| 82, 4:4:4 | 4,4 MB | 31,7 dB | 38,1 dB |
| **88, 4:4:4** | **5,3 MB** | **34,0 dB** | **40,2 dB** |
| 82, 4:4:4 con mozjpeg | 4,0 MB | 30,9 dB | 37,0 dB |

- **Decisión**: **calidad 88 con 4:4:4**.
- **Razón**: subir la calidad sin cambiar el submuestreo casi no mejoraba el peor caso (27,0 → 27,5 dB): la pérdida venía de la reducción del color en bordes saturados, típicos de los empaques de colores y su texto. Con 4:4:4 el peor caso pasa a 34 dB y la mediana a 40 dB (por encima de ~35 dB la diferencia suele ser imperceptible, aunque la palabra final es la revisión visual del responsable). Cuesta ~2 MB más sobre el total, que cabe. `mozjpeg` se descarta: ahorra ~8 % pero pierde calidad y tarda más.

## 6. Cuándo y dónde se preparan las copias

- **Decisión**: se preparan **en cada generación**, en una carpeta temporal `data/pdf-photos/<trabajo>/`, y se borran al terminar el trabajo (con éxito o con error). Al arrancar el servidor se borra cualquier resto.
- **Razón**: (a) las copias se derivan siempre de la foto vigente, así que FR-014 se cumple sin invalidar nada; (b) el costo es de ~2,5 s por generación; (c) un caché entre generaciones apenas serviría, porque el nombre de la copia local de una foto de Alegra cambia en cada preparación (ver 12) y solo se reutilizaría si se genera dos veces la misma preparación.
- **Alternativa descartada**: un caché persistente de copias reducidas: más estado en disco (ya hay un caché que no se limpia), reglas de caducidad y de invalidación, para ahorrar 2,5 s.
- Las copias solo se piden desde el navegador de la generación, vía `/media/pdf/<trabajo>/<archivo>`, detrás de la sesión como el resto de `/media`.

## 7. Cómo llegan las copias al navegador (sin tocar el componente de página)

- **Decisión**: la generación abre la vista de impresión con `?quality=optimized` y el endpoint de datos (`GET /catalog/payload/:id`) devuelve, **solo en ese caso**, el mismo payload con las direcciones de foto reemplazadas por las de las copias. La vista previa y el editor siguen pidiendo el payload sin ese parámetro y no cambian.
- **Razón**: el principio IV exige un único componente de página con datos y plantilla por parámetros: `CatalogDocument` no se toca; solo cambian los textos `imageUrl`, así que el diseño, los textos, los precios y las indicaciones AGOTADO son **idénticos por construcción** (FR-005). Reemplazar las direcciones es una función pura sobre el payload: se prueba sin Chrome.
- **Alternativas descartadas**: (a) cambiar las direcciones del payload guardado en la preparación: la vista previa posterior mostraría las copias ya borradas; (b) un indicador en la preparación sin parámetro: no distingue la vista previa de la impresión, que usan el mismo endpoint.
- Si el parámetro llega pero no hay copias (todas fallaron o no hay nada que reducir), se devuelve el payload original: es el mismo resultado que en Original.

## 8. Fallos y garantías

- **Una foto que no se puede optimizar** (archivo dañado, formato que la librería no lee, GIF animado) no detiene nada: se usa tal cual, como en Original (FR-008). Un GIF animado muestra su primer cuadro, como hoy.
- **Nunca más pesada** (FR-007): si la copia resultante pesa igual o más que el original, se descarta y se usa el original. Ocurre con fotos ya livianas o diminutas.
- **Foto rota después de optimizar**: la guardia de 004 sigue activa (la página cuenta las fotos que no cargaron y el render aborta sin PDF parcial); una copia faltante o corrupta se detecta igual que una foto rota.
- **Transparencia**: ver sección 3; las fotos con transparencia real nunca van a JPEG.

## 9. Mostrar el tamaño y el aviso (FR-011, FR-012)

- **Decisión**: el tamaño se obtiene del archivo guardado (`fs.stat`) al listar el historial y de la longitud del PDF al terminar el trabajo. **No hay cambio de esquema**: el historial ya guarda el archivo; el tamaño es una propiedad suya. La calidad elegida se guarda en `params_json` junto a las páginas.
- **«MB»** = 1.048.576 bytes, como lo muestra Windows y como se midieron los 156,4 MB; el objetivo es `25 × 1.048.576` bytes. Se muestra con un decimal y coma (`18,4 MB`).
- **El aviso** lo decide la pantalla comparando `sizeBytes` con la constante del objetivo (que vive en un módulo puro compartido), solo cuando la calidad fue Optimizada: con Original el responsable ya eligió el archivo grande y no se le avisa.
- Un archivo que ya no existe se muestra como «—».

## 10. Tiempo (FR-013, SC-004)

Hoy: preparar 20,8 s + generar 16,2 s = ~37 s con 182 productos. Con Optimizada: preparar igual, preparar las copias ~2,5 s y renderizar ~3 s (Chrome tarda **5 veces menos** porque dibuja imágenes pequeñas: 2,6 s contra 12,6 s en el experimento), así que **generar queda por debajo de lo de hoy**. Margen amplio frente a los 2 minutos.

## 11. Riesgos y medidas

- **El objetivo de 25 MB**: la estimación (~20 MB) sale de un experimento con las fotos reales, no del PDF final. **Medida**: el quickstart mide el PDF real antes y después con la cuenta real (solo lectura). Si superara 25 MB, la palanca de reserva (sección 3) está documentada, y la spec exige consultar al responsable antes de bajar de 150 ppp.
- **Catálogos mayores**: el peso crece con las fotos, a unos 0,1 MB por foto (18,1 MB por 180). Con la misma mezcla de fotos, a partir de unas 235 se superaría el objetivo; FR-012 lo avisa en lugar de abortar.
- **Binario nativo**: `sharp` se instala con `npm install` sin compilar y se verificó en Windows con Node 24 (el proyecto declara Node 22 y `sharp` pide ≥ 20,9). Si faltara, el servidor no arranca y lo dice (sección 2).
- **Calidad percibida**: el PSNR respalda el criterio, pero **SC-002 y SC-008 son una revisión visual del responsable**: se hace con el catálogo real, página por página, Original contra Optimizada y Neón Noche contra `docs/Cat.pdf` (quickstart, escenarios 5 y 6).
- **El texto del PDF no cambia**: Optimizada reemplaza solo `imageUrl`; una prueba con Chrome real compara el texto y las páginas de ambas calidades (SC-003).

## 12. Hallazgo fuera de alcance: el caché de fotos nunca se limpia

El caché de fotos tiene **361 archivos para 180 contenidos distintos** (221 MB para 111 MB de fotos únicas). El nombre de cada copia es el hash de la dirección de la foto, y las direcciones de Alegra son firmadas y cambian en cada preparación, así que cada preparación vuelve a descargar todo y **deja ~110 MB nuevos** que nadie borra (el código solo borra archivos del historial y de las subidas). No afecta al tamaño del PDF ni a esta feature, y no se corrige aquí; se deja anotado como tarea aparte.
