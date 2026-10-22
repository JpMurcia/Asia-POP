# Análisis de la plantilla base «PRUEBA CATALOGO» (Canva)

**Fecha**: 2026-10-22 · **Método**: REA sobre el editor de Canva en Vivaldi (solo interfaz ya dibujada) · **Diseño**: «PRUEBA CATALOGO - A4», 42 páginas

> Esta es la **base del catálogo** y uno de los pilares de Asia-POP: es el catálogo que hoy se arma a mano en Canva y que la aplicación debe poder generar solo, a partir de Alegra. Todo lo de este documento está **medido con REA** salvo lo marcado «no verificado». Capturas en `docs/specs/rea-evidence/` (18 a 22). De Canva se toman medidas y criterios; la marca, los textos, las ilustraciones y las fotos son del negocio.

> **Especificación completa y exportación**: ver `docs/specs/canva-base-template-spec.md` (incluye las opciones de descarga e impresión).

## 1. Qué es y cómo está organizado

- **Formato**: A4 vertical (**21 × 29,7 cm**), 42 páginas, 6 con título propio y el resto sin título. Las medidas del editor están en **centímetros**.
- **Tipos de página**, en este orden (páginas 1 a 27 verificadas en la vista de cuadrícula; **28 a 42 no se alcanzaron a ver**):

| Tipo | Páginas vistas | Cómo es |
| --- | --- | --- |
| **Portada general** «Portada CON licores» | 1 | Logo grande, «Catálogo de productos», collage de productos, franja morada con la ola y «Domicilios» + dos WhatsApp |
| **Portada de sección** «Portada SIN licores» | 2 (RAMEN), 13 (TTEOKBOKKI), 17 (SNACKS), 20 (DULCES), 27 (BEBIDAS) | Título enorme en mayúsculas, una ilustración de la categoría, el logo y los mismos datos de domicilios |
| **Página de productos** | 3–12 (ramen), 14–16 (tteokbokki), 18–19 (snacks), 21–26 (dulces) | Título «CATÁLOGO <SECCIÓN>», logo arriba a la derecha y **tres productos** por página, en zigzag |

- **Orden**: la portada general va primero; después, cada sección abre con su portada y sigue con sus páginas de producto. El nombre de la página («Portada CON licores», «Portada SIN licores») sirve para distinguir las dos versiones de la portada, una con licores y otra sin.
- **Contacto fijo** en portadas: «Domicilios» y dos números de WhatsApp con ícono verde.
- **Páginas con huecos**: las páginas 10, 12 y 16 muestran un producto con un **marcador de imagen vacío** (un cuadro con nube) y a veces un texto suelto «°». Es decir, la plantilla admite productos aún sin foto, y el hueco vacío es un defecto visible que conviene que el generador nunca produzca (la constitución ya exige dejar fuera los ítems sin imagen).

## 2. Anatomía de una página de productos (página 3, medida capa por capa)

Orden de las capas, de arriba hacia abajo (REA, pestaña Capas de Posición):

1. **Cintas «AGOTADO»** (texto) · 2. **Precios** (texto) · 3. **Etiquetas de precio** (forma) · 4. **Descripciones** (texto) · 5. **Título** (texto) · 6. **Logo** (imagen) · 7. **Estrella** (elemento gráfico) · 8. **Manchas verdes** (elementos gráficos) · 9. por cada producto: **marco de foto** (elemento de marco con la imagen), **burbuja** (forma) y **sombra** (imagen «Circular Blur Shadow») · 10. **Estrella** de fondo · 11. **Fondo** (imagen de mármol, color de referencia `#FAFAFA`).

### 2.1 Medidas y estilos de cada pieza

| Pieza | Posición y tamaño (cm) | Estilo medido |
| --- | --- | --- |
| **Título** «CATÁLOGO RAMEN» | X 5,05 · Y 0,76 · ancho 10,91, centrado en la hoja | **Poppins 32**, **negrita**, **MAYÚSCULA activada**, centrado, negro; interlineado 1,4 |
| **Logo** AsianPop Market | X 16,64 · Y 0,3 · 4,06 × 4,06 | Imagen cuadrada pegada a la esquina superior derecha, margen de 0,3 cm a la derecha |
| **Marco de foto** (producto 3) | X 3,14 · Y 20,37 · 6,10 × 8,03 | Imagen con esquinas redondeadas, trazo negro, relleno transparente. La foto **ya trae el nombre del producto en neón**, sobre fondo oscuro |
| **Burbuja** de descripción (producto 3) | X 6,55 · Y 21,92 · 10,58 × 5,13 | Rectángulo `#E7DECF` (beige), **radio de esquina 51**, sin trazo, 4 lados; la burbuja **se mete por detrás** de la foto |
| **Sombra** de la burbuja | imagen «Circular Blur Shadow» bajo cada burbuja | Es una **imagen aparte**, no un efecto de la forma |
| **Descripción** | dentro de la burbuja | **Poppins 14**, centrado, negro, interlineado **1,4**, interletrado 0, anclaje al comienzo; texto de 2 a 6 líneas |
| **Etiqueta de precio** (tercer producto) | X 10,9 · Y 27,05 · 3,45 × 1,08 | Forma `#1F021D` (rosa neón muy oscuro) con transparencia |
| **Precio** «$9.000» | ancho 2,56 · X 11,35 · Y 9,89 (primer producto) | **Poppins 21**, **negrita**, centrado, **`#C04B0F`** (naranja), efecto **Neón con intensidad 100** |
| **Cinta «AGOTADO»** | ancho 10,26 · X 1,51 · Y 2,33 | **Open Sans 58**, **negrita**, **`#FF3131`** (rojo brillante), centrado, **rotada −45°**, efecto **Neón con intensidad 50**; se dibuja **encima** de la foto |
| **Estrellas** | elementos gráficos «Diamond Star Silhouette» | Destellos de cuatro puntas como adorno; dos por página |
| **Manchas** | elementos gráficos «Green blob» | Dos por página, como adorno de fondo |
| **Fondo** | toda la hoja | Imagen de mármol claro |

Márgenes derivados: el logo deja 0,3 cm a la derecha; la última foto termina en Y 28,4 cm (1,3 cm sobre el borde inferior); el título queda a 0,76 cm del borde superior.

### 2.2 Composición de cada tarjeta de producto

- **Foto-tarjeta**: una imagen vertical con esquinas redondeadas (≈ 6,1 × 8 cm), oscura, con el **nombre del producto dibujado en neón dentro de la imagen** y el empaque real. Estas imágenes vienen de una carpeta propia de Canva («Productos AsianPopMarket») ya preparadas.
- **Burbuja beige** con la **descripción** al lado de la foto; la burbuja y la foto **se solapan** (la foto tapa un borde de la burbuja) para dar profundidad.
- **Precio** en una pastilla bajo la burbuja, con el color naranja neón.
- **Zigzag**: la foto va a la izquierda en el producto 1 y 3 y a la derecha en el 2, de modo que cada página alterna lados.
- **Cinta AGOTADO** diagonal sobre la foto cuando no hay existencias, en rojo neón (cumple el principio II de la constitución: la palabra AGOTADO siempre visible).

## 3. Criterios de diseño que se deducen de la base

1. **Un solo sistema tipográfico**: Poppins para casi todo (título, descripciones, precios); Open Sans solo para la cinta AGOTADO. Tamaños: **58** (cinta), **32** (título de página), **21** (precio), **14** (descripción). Escala por saltos grandes, no continua.
2. **Todos los textos con interlineado 1,4**, interletrado 0 y anclaje al comienzo. Es un dato importante: la base necesita 1,4; Asia-POP hoy usa 1,05 por defecto (ver §5).
3. **Jerarquía por color y efecto, no por tamaño**: el precio destaca por naranja y neón; el agotado por rojo y rotación; la descripción es negra y plana.
4. **Paleta corta**: beige `#E7DECF` (burbujas), naranja `#C04B0F` (precio), rojo `#FF3131` (agotado), rosa oscuro `#1F021D` (etiqueta), blanco-mármol `#FAFAFA` (fondo), negro (texto). Con los morados y neones de las portadas y las fotos-tarjeta.
5. **Neón controlado**: el efecto neón se usa solo en dos textos (precio y agotado) y con intensidades distintas (100 y 50), no en todo.
6. **Profundidad por capas**: sombra como imagen aparte, burbuja detrás de la foto, cinta delante, adornos al fondo.
7. **Coherencia**: mismo encabezado, mismo logo, mismas posiciones de las piezas en todas las páginas de una sección; solo cambian el título, las fotos, los textos y los precios.
8. **Portadas de sección** como separadores con identidad propia (ilustración de la categoría) y el contacto repetido.
9. **Aire**: 3 productos por página, sin amontonar; coincide con el máximo de 3 de la constitución.

## 4. Herramientas y funciones de Canva que se usaron en la base

| Herramienta | Para qué se usó |
| --- | --- |
| **Páginas con título** («Portada CON licores», «Portada SIN licores») | Distinguir versiones de portada |
| **Capas** (Posición → Capas) y orden «Delante/Detrás» | Solapar foto, burbuja, sombra y cinta |
| **Posición** (X, Y, ancho, alto, girar en cm y grados) | Colocar con precisión; la cinta usa −45° |
| **Efectos de texto: Neón** con intensidad | Precio (100) y agotado (50) |
| **Marcos de imagen** + redondeo de esquinas + trazo | Foto-tarjeta con esquinas redondeadas |
| **Formas** con radio de esquina (51) y color exacto | Burbujas y etiquetas de precio |
| **Imagen de fondo** | Mármol de las páginas de producto |
| **Elementos gráficos** (estrellas, manchas) y **logo** como imagen | Adornos y marca |
| **Carpeta/app «Productos AsianPopMarket»** | Biblioteca de fotos-tarjeta ya diseñadas, listas para arrastrar |
| **Carpeta «Combos mes madre»** | Biblioteca de imágenes ya diseñadas de **promociones y combos** (cajas de regalo, «Especial Día de la Madre», «7 de Agosto»): son material promocional aparte del catálogo |
| **App «Colorize»** | App genérica de Canva que colorea imágenes en blanco y negro; no forma parte de la base |
| **Duplicar página** | Repetir el molde de página de producto |
| **«Permitir solo reemplazar contenido»** (botón de cada página) | Bloquea la estructura y deja cambiar solo textos e imágenes: justo la lógica de una plantilla que se rellena con datos |
| **Vista de cuadrícula y tira de páginas** | Revisar las 42 páginas |

## 5. Qué significa para Asia-POP

### Lo que Asia-POP ya cubre (según los tipos de elemento y las propiedades del editor)

Texto con fuente, tamaño, color, contorno, resplandor neón, mayúsculas, espaciado, altura de línea y giro (−180° a 180°); formas con borde y radio; imágenes; fondo de imagen; bloque de productos con precio y estado agotado en cinta; portada de sección; pie; guías y alineación a la hoja; 4 plantillas base, entre ellas Neón Noche.

### Brechas frente a la base (a decidir, no a suponer)

| # | Brecha | Por qué importa | Posible camino |
| --- | --- | --- | --- |
| 1 | **Interlineado 1,4** en toda la base; Asia-POP usa 1,05 por defecto | Para reproducir la base el valor 1,4 debe poder fijarse fácil; 1,05 se mantiene para no cambiar plantillas guardadas | Ya cabe en el rango (0,8–2,5); la feature 008 lo hace más fino. Una plantilla nueva «Base AsianPop» puede traer 1,4 |
| 2 | **La foto del producto trae el nombre dibujado dentro** | Las fotos de Alegra son fotos de empaque sin nombre ni fondo neón; la base usa imágenes ya diseñadas | **Decisión del responsable**: ¿se generan esas fotos-tarjeta (fondo oscuro, nombre en neón) a partir de la foto de Alegra, o se sigue mostrando foto + nombre en texto? |
| 3 | **Descripción larga por producto** en burbuja | Alegra no necesariamente tiene una descripción así de larga | Decidir de dónde sale (campo de Alegra, texto propio por producto o sin descripción) |
| 4 | **Sombra como imagen aparte** | En el PDF, una imagen con desenfoque pesa; Asia-POP ya optimiza el tamaño del PDF (feature 005) | Evaluar sombra nativa del elemento frente a imagen, sin aumentar el peso |
| 5 | **Efecto neón con intensidad** (100 y 50) | Asia-POP tiene resplandor neón con color; conviene confirmar que la intensidad se parece | Comparar el resplandor actual con los valores 100 y 50 en una prueba lado a lado |
| 6 | **Solapes foto/burbuja** | Requiere orden de capas por elemento | Asia-POP ya ordena capas; verificar que el bloque de productos permita el solape |
| 7 | **Portada general y portadas de sección con ilustración** | La ilustración y el collage son arte del negocio | Subir imágenes propias (candidata ya prevista: logo y fotos propias) |
| 8 | **Contacto repetido** (WhatsApp) | Se repite en 6 o más portadas | Dato de configuración reutilizable, no texto suelto por plantilla |
| 9 | **Productos sin foto** muestran marcador vacío | Defecto visible | El generador debe excluirlos, como ya manda la constitución |
| 10 | **Selector de color con los colores de la plantilla** y **selector de fuente que muestra cada fuente** | La base usa una paleta corta y repite sus colores | Feature 009 ya especificada |

### Propuesta de siguiente paso

1. Confirmar con el responsable las decisiones de las brechas 2, 3 y 7 (foto-tarjeta, descripción y arte de portadas), porque cambian el alcance de «plantilla base».
2. Crear una **plantilla «Base AsianPop»** en Asia-POP que reproduzca la página de productos de §2.1 con estas medidas, y compararla con la página 3 de la base (captura `19-base-pagina-producto-agotado.png`).
3. Seguir con las features 008 y 009 sabiendo que la base usa interlineado 1,4 y una paleta corta.

## 6. No verificado

- **Páginas 28 a 42**: no se vieron (la cuadrícula no se pudo desplazar con automatización).
- **Cómo «Productos AsianPopMarket» recibe sus imágenes** (se ve que son fotos-tarjeta ya hechas, pero no cómo se crearon).
- **Páginas no exploradas a fondo**: las portadas (posiciones y tipografías del título, del contacto y de los íconos), las páginas con 2 productos, y los combos; los menús Archivo → Descargar / Imprimir (opciones de PDF, sangrado, marcas de corte); y las pestañas Canva IA, Fotos, Fondo, Gráficos y Favoritos.
- **Efectos de la burbuja y de las etiquetas** (sombra, si la hay): el panel no mostró un efecto activo.
- **Unidad del tamaño de letra** de Canva (32, 21, 14, 58): se asume puntos del lienzo A4; hay que confirmar la equivalencia en milímetros antes de copiarla a Asia-POP.
- **Colores y espaciados de la interfaz del editor** en píxeles (REA pasivo no entrega estilos computados).
- **Imagen de fondo y colores de la ola morada** de las portadas.

## 7. Cómo se hizo y cómo repetirlo

`list_browser_targets` → `capture_browser_scenario` en modo `connect` sobre la pestaña del diseño. Para elementos que Canva cubre con una capa (descripciones, imágenes, formas) se entra por **Posición → Capas**, que lista cada elemento y permite seleccionarlo. El interlineado, interletrado y anclaje se leen en «Configuración avanzada»; la posición en «Posición → Organizar»; el color y la fuente salen del árbol de accesibilidad de la barra contextual. Un clic en el botón de alineación **cambia** la alineación (cicla); evitarlo.
