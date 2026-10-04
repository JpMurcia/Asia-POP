# Revisión visual: plantillas del catálogo (feature 003)

**Fecha**: 2026-10-03 · **Alcance**: Neón Noche contra el PDF de 002 y `docs/Cat.pdf` (SC-003, FR-021); las otras tres bases contra el mockup (T095).

## Cómo se hizo

1. **Línea base de 002**, tomada antes de tocar el render (T004): `visual/baseline-002/` (`normal/` y `long/` con una captura por página, los dos PDF y una copia de `frontend/src/print/` en `src-print/`).
2. **Neón Noche con el render nuevo**: `visual/neon/normal/` y `visual/neon/long/` (mismo catálogo de muestra y mismo orden de páginas), generados con `TEMPLATE=neon` y `visual-sample.ts`; los PDF están en `visual/neon/catalog-neon-*.pdf`.
3. **Comparación píxel a píxel** con `backend/tests/fixtures/image-diff.ts` (umbral de color 48): `visual/neon/diff-normal-final/` y `visual/neon/diff-long-final/` guardan, por página, «002 | 003 | diferencias» (en rojo lo que cambia).
4. **Referencia de diseño**: páginas 1, 2, 3 y 38 de `docs/Cat.pdf` en `visual/cat-pdf/`.
5. **Otras bases**: `visual/<pop|kawaii|kraft>/normal/` y las hojas resumen de `visual/sheets/` (portada, portada de sección, portada con introducción, productos y políticas).

Catálogo de muestra (11 páginas): portada, BEBIDAS, MOCHIS (sección propia con introducción, opciones, sabores y un combo), RAMEN (2 páginas, un producto agotado), SNACKS y políticas.

## Resultado de Neón Noche contra 002

Porcentaje de píxeles que cambian (umbral 48 sobre la suma de canales; incluye el desplazamiento de 1 px por redondeo y el antialiasing de cada glifo):

| Página | Normal | Textos máximos |
| --- | --- | --- |
| 1 · Portada | 7,5 % | 10,9 % |
| 2 · Portada BEBIDAS | 5,1 % | 5,1 % |
| 3 · Productos BEBIDAS | 1,9 % | 3,0 % |
| 4 · Portada MOCHIS / sección larga | 5,7 % | 10,2 % |
| 5 · Productos MOCHIS (opciones, sabores, combo) | 4,9 % | 4,8 % |
| 6 · Portada RAMEN | 4,9 % | 4,9 % |
| 7 · Productos RAMEN (1) | 3,8 % | 5,2 % |
| 8 · Productos RAMEN (2) | 2,3 % | 3,4 % |
| 9 · Portada SNACKS / sección propia larga | 5,0 % | 16,8 % |
| 10 · Productos SNACKS | 2,1 % | 10,1 % |
| 11 · Políticas | 7,1 % | 34,1 % |

Antes de calibrar (primera versión de la plantilla) las portadas de sección cambiaban ≈ 20 %. El 34 % de la página 11 con textos máximos es sobre todo reposicionamiento de líneas de texto muy densas (10 políticas × 350 caracteres): visualmente las dos páginas son equivalentes (ver `diff-long-final/page-11.png`).

### Diferencias aceptadas (Clarifications de la spec)

| # | Diferencia | Dónde se ve |
| --- | --- | --- |
| 1 | El bloque «Domicilios» muestra los teléfonos como texto en una línea (`310 669 0585 · 318 807 0709`), sin los íconos de WhatsApp ni apilados | Portadas (páginas 1, 2, 4, 6, 9) |
| 2 | Los títulos usan Fredoka 700 en lugar de Fredoka One: las letras de «BEBIDAS», «MOCHIS»… son algo más angostas y menos pesadas | Portadas de sección |

### Otras diferencias que aparecieron al calibrar (no estaban en la lista y conviene que el responsable las vea)

| # | Diferencia | Motivo y decisión |
| --- | --- | --- |
| 3 | **Títulos de portada, de sección y de página**: la caja de cada título se subió ≈ 2–3 % de la hoja (banner `y` 27,5 % en lugar de 29,5 %, nombre de sección 32,2 % en lugar de 36 %, título de productos 1,5 % en lugar de 3,2 %, título de políticas 3,6 % en lugar de 5 %) | El PDF de 002 alinea el texto al **borde superior** de su caja y el editor lo **centra** verticalmente. Se movieron las cajas para que un título de una línea quede en el mismo sitio (diferencia < 1 px); con dos líneas el texto crece hacia arriba y hacia abajo en lugar de solo hacia abajo |
| 4 | El marco de las portadas se **estira** a su caja como en 002 (`fit: fill`) | Con «cubrir» el marco crecía 3 % y el logo quedaba desplazado. El ajuste «Estirar» es una tercera opción de imagen (la spec nombra «contener» y «cubrir»), necesaria para reproducir 002 |
| 5 | Pie de página: separador « · » entre los teléfonos y la dirección (002 usaba solo un espacio mayor) | Neón Noche usa el contenido por defecto `{telefonos} · {direccion}` |
| 6 | Pie de página con una dirección larga (160 caracteres, el máximo) pasa a **dos líneas**; 002 la cortaba con puntos suspensivos | FR-031 pide reducir la letra para caber, no cortar texto. Con direcciones normales sigue siendo una línea (`diff-long-final/page-11.png`) |
| 7 | La etiqueta de introducción de sección es crema sólido (`#E8DFD0`); 002 usaba el mismo crema al 90 % de opacidad | Los colores del editor no llevan transparencia parcial |
| 8 | El resplandor del título de portada es una doble sombra (cerrada y difusa) en lugar de una sola al 55 % | Es el efecto «neón» del editor; se ve algo más intenso. Se puede suavizar si el responsable lo prefiere |
| 9 | Estilos de agotado **cinta** y **gris**: sin espaciado entre letras | Con espaciado, el texto del PDF se extrae como «A G O T A D O» y no se puede buscar. El **sello** es el de 002 sin cambios |

### Qué coincide

Estructura de las once páginas; fondos (atardecer y mármol), marco, collage, logo y su posición; tarjetas de imagen con anillo verde, burbuja crema y etiqueta de precio con borde naranja (misma geometría: filas del 27 % cada 29,1 %); sello AGOTADO; chips de las políticas; pie con línea naranja; ajuste de texto de nombres y descripciones largos.

## Otras tres plantillas base (T095, contra el mockup)

Se revisaron las cuatro páginas de cada una con el catálogo de muestra (`visual/sheets/`) y con textos máximos (la prueba automática `print-overflow` las comprueba en Chrome: nada desborda, nada sale de la hoja y ningún texto baja de 6 pt salvo el recorte por líneas de último recurso).

- **Pop crema**: portada con logo, banner rosa y círculo amarillo; portada de sección rosa con círculo y la introducción dentro del círculo; productos alternados con anillo amarillo.
- **Kawaii pastel**: degradado rosa, círculos menta y ámbar, insignia «NUEVO»; productos en tarjetas con la introducción en una caja blanca.
- **Kraft minimal**: papel kraft, tipografía serif alineada a la izquierda, línea fina, productos en lista con precio en caja recta; la portada de sección es oscura.

Los bloques `intro` de estas tres plantillas no existen en el mockup (no contempla la introducción de las secciones propias); se colocaron donde no pisan el título ni el pie.

## Texto mínimo de 6 pt

El mínimo se cuenta sobre el **texto más pequeño de cada bloque**: en la burbuja de un producto las líneas de sabores y opciones (10,5 px) fijan el mínimo del bloque en 0,57. Si con ese mínimo el texto aún no cabe (nombre de 120 caracteres + descripción de 600 + 12 sabores de 60 caracteres + 4 opciones de 80), se muestran menos líneas de cada párrafo con «…» (descripción 4→1, nombre 3→1, sabores 3→1) y, en las políticas, interlineado y espacios más apretados. Con los textos máximos de la prueba, ningún elemento queda marcado `data-overflow`.

## El editor contra el mockup (T095)

**Cómo se hizo.** `Apariencia Editor.dc.html` no se puede abrir como una página (es una plantilla del mockup con marcas `{{ … }}` que necesita su propio entorno): se compararon su estructura, medidas y colores (que se leyeron de su HTML) con el editor real. Las capturas salen de la aplicación en marcha con `backend/tests/fixtures/editor-shots.ts` (datos de muestra de `dev-mock.ts`), en `visual/editor/`:

| Captura | Qué muestra |
| --- | --- |
| `editor-1366-plantillas.png` · `editor-1024-plantillas.png` | El editor a 1366×768 y a 1024 px con el panel Plantillas (el que abre por defecto) |
| `editor-<ancho>-elementos.png` · `-estilo.png` · `-datos.png` | Los otros tres paneles del riel |
| `editor-<ancho>-seleccion.png` | Un elemento seleccionado: contorno, manija, acciones e inspector |
| `editor-<ancho>-vista-previa.png` | Las cuatro páginas lado a lado, sin marcos ni guías |
| `galeria-<ancho>.png` | La vista Plantillas |
| `bases/<neon\|pop\|kawaii\|kraft>/<portada\|seccion\|productos\|politicas>.png` | Las 4 bases × 4 páginas dibujadas en el lienzo del editor (a doble resolución) |
| `pantallas/` | Inicio («Sincronizado hace N min»), Conexión Alegra (intentos), Combos (desglose) y Generar |

**Coincide con el mockup**: cuadrícula de cuatro columnas (riel de 72 px, panel de 288, lienzo y inspector de 304); barra superior morada con «← Menú», título, pestañas Editor/Plantillas, nombre, deshacer/rehacer, indicador, Vista previa, «Usar»/«Predeterminada» y Guardar rosa; riel con Plantillas, Elementos, Estilo y Datos; panel Elementos (Texto, Datos del catálogo, Formas, Imágenes); tira de páginas con miniatura y nota y control de zoom; inspector con tipo y nombre, seis acciones, campos por tipo (muestras de color, deslizadores, segmentados, interruptor, posición en 4 columnas) y, sin selección, el fondo, las capas y los atajos; galería con tarjetas de dos miniaturas, puntos de paleta, par tipográfico y la marca «Predeterminada»; tarjeta punteada «Nueva plantilla» con los cuatro estilos.

**Diferencias con el mockup** (todas por un requisito de la spec o por una decisión de implementación):

| # | Diferencia | Motivo |
| --- | --- | --- |
| E1 | El indicador de guardado dice «Todo guardado» / «Cambios sin guardar» junto al punto de color (el mockup solo tiene el punto) | FR-026: el estado debe indicarse permanentemente y a quien no distingue colores |
| E2 | El panel Estilo agrega un campo hexadecimal por color, con su validación («Debe ser un color en formato #RRGGBB»), y la lista de advertencias de contraste | FR-015 y FR-016 |
| E3 | El panel Datos agrega contadores (n/80, n/160, n / 3500) que pasan a rojo al excederse, y Guardar se deshabilita con el motivo como ayuda | FR-023 |
| E4 | El inspector agrega un aviso cuando un bloque llega al tamaño mínimo legible y aun así no cabe | Edge Case de la spec |
| E5 | A 1024 px la tira de páginas muestra una o dos páginas y el resto se desplaza (el mockup también la desplaza) y el nombre de la plantilla se acorta | Ancho disponible; ningún botón queda fuera de la ventana (lo comprueba `panel-layout.test.ts`) |
| E6 | Las pestañas de la barra superior se llaman «Vista Editor» y «Vista Plantillas» para lectores de pantalla (se ven «Editor» y «Plantillas») | Evitar dos botones con el mismo nombre que el riel |
| E7 | La vista previa tiene una escala mínima de 0,3: en ventanas angostas las cuatro páginas no caben y el área se desplaza | Con menos, el texto de las páginas no se lee |
| E8 | El contorno de selección es violeta (`#6D4AFF`, trazo discontinuo si el elemento está fijo) con la manija blanca y las guías de centro rosas; el color exacto del mockup se define dentro de su componente `Pagina Catalogo.dc.html` y no se comparó | Contraste con las cuatro paletas, incluidas las claras. Es una constante (`SELECTION` en `Canvas.tsx`) fácil de cambiar |

El contorno y la manija de selección se dibujan **fuera** de la hoja recortada: un elemento que sale de la página (se permite hasta −300 % / 400 %) sigue teniendo su manija a la vista. Lo encontró la prueba de navegador real `editor-browser.test.ts` (en jsdom no se ve).

## Mediciones (T097, quickstart 8 y 15)

`backend/tests/fixtures/editor-perf.ts`, en Chrome headless a 1366×768 con **60 elementos** en Portada y datos de muestra:

| Medida | Resultado | Meta | ¿Cumple? |
| --- | --- | --- | --- |
| Arrastre: de `pointermove` al siguiente cuadro pintado (p95, 60 movimientos) | ≈ 34 ms | < 100 ms | sí |
| Propiedad → lienzo (escribir X en el inspector hasta verlo; p95, 20 cambios) | ≈ 33 ms | < 200 ms | sí |
| Guardar (60 elementos) | ≈ 8 ms | < 1 s | sí |
| Cambio de color → PDF (cambiar, guardar, preparar y generar) | ≈ 2 s | < 3 min | sí |

Los ≈ 33 ms son dos cuadros a 60 Hz (el piso de la medición: se espera el cuadro siguiente al que pinta el cambio). El resultado cambia con la máquina; la herramienta imprime la tabla y sale con error si algo no cumple.

**SC-004 (crear una plantilla desde un estilo base, cambiar un color, mover un elemento, marcarla predeterminada y generar el PDF en menos de 10 minutos, sin ayuda)**: el recorrido completo, sin pausas humanas, toma ≈ 2,5 s (el piso técnico). **El tiempo de una persona sin ayuda debe cronometrarlo el responsable**: anótalo aquí.

- Tiempo del recorrido por una persona sin ayuda: ____ min ____ s

## Aprobación del responsable (SC-003)

- [ ] Neón Noche coincide con `docs/Cat.pdf` en estructura y estilo, salvo las diferencias aceptadas 1 y 2.
- [ ] Neón Noche coincide con el PDF de 002 (`visual/baseline-002/`), y las diferencias 3–9 son aceptables.
- [ ] Pop crema, Kawaii pastel y Kraft minimal son aceptables frente al mockup (`visual/editor/bases/`).
- [ ] El editor (`visual/editor/`) es aceptable frente al mockup, con las diferencias E1–E8.
- [ ] Aprobación pendiente de 002 (sus T057 y T062: Cat.pdf y el PDF generado de 002), que se valida junto con esta.

Nombre y fecha de quien aprueba: _______________________
